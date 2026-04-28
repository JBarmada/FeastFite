import { Router, type Request, type Response } from 'express';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import { pool } from '../db.js';
import { DEV_AUTH_BYPASS, DEV_USER_ID } from '../devAuth.js';

export const territoriesRouter = Router();

/** Must match auth-service default when JWT_SECRET is unset. */
const JWT_SECRET = process.env['JWT_SECRET'] ?? 'dev_only_secret_change_in_production';
const VOTE_SERVICE_URL   = process.env['VOTE_SERVICE_URL']   ?? 'http://vote-service:3003';
const ECONOMY_SERVICE_URL = process.env['ECONOMY_SERVICE_URL'] ?? 'http://economy-service:3004';

// ── Auth middleware ───────────────────────────────────────────────────────────

interface JwtPayload { userId: string; }

function requireAuth(req: Request, res: Response, next: () => void): void {
  // Dev bypass — set DEV_AUTH_BYPASS false in devAuth.ts to enforce JWT again.
  if (DEV_AUTH_BYPASS) {
    (req as Request & { userId: string }).userId = DEV_USER_ID;
    next();
    return;
  }

  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing token' });
    return;
  }
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET) as JwtPayload;
    (req as Request & { userId: string }).userId = payload.userId;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// ── Row → Territory shape ─────────────────────────────────────────────────────

function rowToTerritory(row: Record<string, unknown>) {
  return {
    id:            row['id'],
    name:          row['name'],
    geoJson:       row['geojson'],
    ownerId:       row['owner_id']       ?? null,
    ownerName:     row['owner_name']     ?? null,
    ownerType:     row['owner_type']     ?? null,
    capturedAt:    row['captured_at']    ?? null,
    lockedUntil:   row['locked_until']   ?? null,
    dishPhotoKey:  row['dish_photo_key'] ?? null,
    updatedAt:     row['updated_at'],
  };
}

// ── GET /territories?bbox=minLng,minLat,maxLng,maxLat ─────────────────────────

territoriesRouter.get('/', async (req: Request, res: Response) => {
  const raw = req.query['bbox'];
  if (typeof raw !== 'string') {
    res.status(400).json({ error: 'bbox query param required: minLng,minLat,maxLng,maxLat' });
    return;
  }

  const parts = raw.split(',').map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) {
    res.status(400).json({ error: 'bbox must be four numbers: minLng,minLat,maxLng,maxLat' });
    return;
  }

  const [minLng, minLat, maxLng, maxLat] = parts;

  const { rows } = await pool.query(
    `SELECT id, name, geojson, owner_id, owner_name, owner_type,
            captured_at, locked_until, dish_photo_key, updated_at
     FROM territories
     WHERE ST_Intersects(
       geom,
       ST_MakeEnvelope($1, $2, $3, $4, 4326)
     )`,
    [minLng, minLat, maxLng, maxLat],
  );

  res.json(rows.map(rowToTerritory));
});

// ── GET /territories/owned ────────────────────────────────────────────────────
// Must be registered before /:id to avoid "owned" being treated as an id.

territoriesRouter.get('/owned', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as Request & { userId: string }).userId;
  const { rows } = await pool.query(
    `SELECT id, name, geojson, owner_id, owner_name, owner_type,
            captured_at, locked_until, dish_photo_key, updated_at
     FROM territories WHERE owner_id = $1`,
    [userId],
  );
  res.json(rows.map(rowToTerritory));
});

// ── GET /territories/my-history ──────────────────────────────────────────────
// Must be registered before /:id to avoid "my-history" being treated as an id.

territoriesRouter.get('/my-history', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as Request & { userId: string }).userId;
  const { rows } = await pool.query(
    `SELECT ch.id, ch.territory_id, t.name AS territory_name,
            ch.claimant_id, ch.claimant_name, ch.photo_key, ch.is_winner,
            ch.avg_rating, ch.vote_count, ch.total_rating, ch.session_id, ch.claimed_at
     FROM claim_history ch
     JOIN territories t ON t.id = ch.territory_id
     WHERE ch.claimant_id = $1
     ORDER BY ch.claimed_at DESC`,
    [userId],
  );

  res.json({
    submissions: rows.map((r) => ({
      id:            r['id'],
      territoryId:   r['territory_id'],
      territoryName: r['territory_name'],
      claimantId:    r['claimant_id'],
      claimantName:  r['claimant_name'],
      photoKey:      r['photo_key'],
      isWinner:      r['is_winner'],
      avgRating:     r['avg_rating'] ? Number(r['avg_rating']) : null,
      voteCount:     Number(r['vote_count'] ?? 0),
      totalRating:   Number(r['total_rating'] ?? 0),
      sessionId:     r['session_id'],
      claimedAt:     r['claimed_at'],
    })),
  });
});

// ── GET /territories/:id ──────────────────────────────────────────────────────

territoriesRouter.get('/:id', async (req: Request, res: Response) => {
  const { rows } = await pool.query(
    `SELECT id, name, geojson, owner_id, owner_name, owner_type,
            captured_at, locked_until, dish_photo_key, updated_at
     FROM territories WHERE id = $1`,
    [req.params['id']],
  );

  if (rows.length === 0) {
    res.status(404).json({ error: 'Territory not found' });
    return;
  }

  res.json(rowToTerritory(rows[0] as Record<string, unknown>));
});

// ── POST /territories/:id/claim ───────────────────────────────────────────────
// Uncontested → commit ownership directly.
// Contested    → join existing active session or start a new one.

territoriesRouter.post('/:id/claim', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as Request & { userId: string }).userId;
  const { photoKey, displayName } = (req.body ?? {}) as { photoKey?: string; displayName?: string };

  const { rows } = await pool.query(
    `SELECT id, owner_id, owner_name FROM territories WHERE id = $1`,
    [req.params['id']],
  );

  if (rows.length === 0) {
    res.status(404).json({ error: 'Territory not found' });
    return;
  }

  const territory = rows[0] as { id: string; owner_id: string | null; owner_name: string | null };

  // Uncontested claim — save dish photo and owner immediately
  if (!territory.owner_id) {
    await pool.query(
      `UPDATE territories
          SET owner_id = $1, owner_name = $4, owner_type = 'user',
              captured_at = NOW(), locked_until = NULL,
              dish_photo_key = COALESCE($3, dish_photo_key),
              updated_at = NOW()
        WHERE id = $2`,
      [userId, territory.id, photoKey ?? null, displayName ?? 'Unknown Foodie'],
    );
    await pool.query(
      `INSERT INTO claim_history (territory_id, claimant_id, claimant_name, photo_key, is_winner)
       VALUES ($1, $2, $3, $4, true)`,
      [territory.id, userId, displayName ?? 'Unknown Foodie', photoKey ?? null],
    );
    res.json({ claimed: true });
    return;
  }

  // Contested — check for an existing active session first
  let sessionId: string;
  try {
    // Try to join the existing active session by adding this user as a candidate
    const checkRes = await axios.get<{ session: { id: string } }>(
      `${VOTE_SERVICE_URL}/api/vote/votes/sessions/by-territory/${territory.id}`,
    );
    const existingSessionId = checkRes.data.session.id;

    if (photoKey) {
      await axios.post(
        `${VOTE_SERVICE_URL}/api/vote/votes/sessions/${existingSessionId}/candidates`,
        { photoKey, userId, displayName: displayName ?? 'Challenger' },
      ).catch(() => {});
    }
    sessionId = existingSessionId;
  } catch {
    // No active session — create one
    try {
      const { data } = await axios.post<{ session: { id: string } }>(
        `${VOTE_SERVICE_URL}/api/vote/votes/sessions`,
        {
          territoryId: territory.id,
          photoKey: photoKey ?? 'seed/default-defender-donut.png',
          challengerId: userId,
          challengerName: displayName ?? 'Challenger',
          defenderId: territory.owner_id,
          defenderName: territory.owner_name ?? 'Current Owner',
        },
      );
      sessionId = data.session.id;
    } catch {
      res.status(502).json({ error: 'vote-service unavailable' });
      return;
    }
  }

  if (photoKey) {
    await pool.query(
      `INSERT INTO claim_history (territory_id, claimant_id, claimant_name, photo_key, is_winner, session_id)
       VALUES ($1, $2, $3, $4, false, $5)`,
      [territory.id, userId, displayName ?? 'Challenger', photoKey ?? null, sessionId],
    );
  }

  res.json({ claimed: false, voteSessionId: sessionId });
});

// ── GET /territories/:id/history ─────────────────────────────────────────────

territoriesRouter.get('/:id/history', async (req: Request, res: Response) => {
  const { rows } = await pool.query(
    `SELECT id, claimant_id, claimant_name, photo_key, is_winner,
            avg_rating, vote_count, total_rating, session_id, claimed_at
     FROM claim_history
     WHERE territory_id = $1
     ORDER BY
       CASE WHEN is_winner THEN 0 ELSE 1 END,
       COALESCE(avg_rating, 0) DESC,
       claimed_at DESC
     LIMIT 50`,
    [req.params['id']],
  );

  res.json({
    history: rows.map((r) => ({
      id:           r['id'],
      claimantId:   r['claimant_id'],
      claimantName: r['claimant_name'],
      photoKey:     r['photo_key'],
      isWinner:     r['is_winner'],
      avgRating:    r['avg_rating'] ? Number(r['avg_rating']) : null,
      voteCount:    Number(r['vote_count'] ?? 0),
      totalRating:  Number(r['total_rating'] ?? 0),
      sessionId:    r['session_id'],
      claimedAt:    r['claimed_at'],
    })),
  });
});

// ── GET /territories/stats/owners ────────────────────────────────────────────

territoriesRouter.get('/stats/owners', async (_req: Request, res: Response) => {
  const { rows } = await pool.query<{ owner_id: string; count: string }>(
    `SELECT owner_id, COUNT(*)::text AS count
     FROM territories
     WHERE owner_id IS NOT NULL
     GROUP BY owner_id
     ORDER BY count DESC`,
  );
  res.json({
    owners: rows.map((r) => ({ userId: r.owner_id, blocksHeld: Number(r.count) })),
  });
});

// ── POST /territories/:id/shield ─────────────────────────────────────────────
// Consumes a Territory Shield from inventory and locks the territory for 12 h.

territoriesRouter.post('/:id/shield', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as Request & { userId: string }).userId;

  const { rows } = await pool.query(
    `SELECT id, owner_id, locked_until FROM territories WHERE id = $1`,
    [req.params['id']],
  );

  if (rows.length === 0) {
    res.status(404).json({ error: 'Territory not found' });
    return;
  }

  const territory = rows[0] as { id: string; owner_id: string | null; locked_until: string | null };

  if (territory.owner_id !== userId) {
    res.status(403).json({ error: 'You do not own this territory' });
    return;
  }

  try {
    await axios.post(
      `${ECONOMY_SERVICE_URL}/api/economy/inventory/use`,
      { itemId: 'territory_shield' },
      { headers: { Authorization: req.headers.authorization } },
    );
  } catch (err) {
    const status = axios.isAxiosError(err) ? err.response?.status : undefined;
    const msg =
      status === 400
        ? 'Buy a Territory Shield in the shop first'
        : 'Economy service unavailable';
    res.status(status === 400 ? 402 : 502).json({ error: msg });
    return;
  }

  await pool.query(
    `UPDATE territories
        SET locked_until = NOW() + INTERVAL '12 hours', updated_at = NOW()
      WHERE id = $1`,
    [territory.id],
  );

  res.json({ success: true, itemUsed: 'territory_shield' });
});

// ── POST /territories/:id/battering-ram ───────────────────────────────────────
// Deducts points from economy-service and clears the lock.

territoriesRouter.post('/:id/battering-ram', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as Request & { userId: string }).userId;

  const { rows } = await pool.query(
    `SELECT id, locked_until FROM territories WHERE id = $1`,
    [req.params['id']],
  );

  if (rows.length === 0) {
    res.status(404).json({ error: 'Territory not found' });
    return;
  }

  const territory = rows[0] as { id: string; locked_until: string | null };
  const isLocked = territory.locked_until && new Date(territory.locked_until) > new Date();

  if (!isLocked) {
    res.status(409).json({ error: 'Territory is not locked' });
    return;
  }

  // Consume one Battering Ram from economy inventory (buy from shop first).
  try {
    await axios.post(
      `${ECONOMY_SERVICE_URL}/api/economy/inventory/use`,
      { itemId: 'battering_ram' },
      { headers: { Authorization: req.headers.authorization } },
    );
  } catch (err) {
    const status = axios.isAxiosError(err) ? err.response?.status : undefined;
    const msg =
      status === 400
        ? 'Buy a Battering Ram in the shop first'
        : 'Economy service unavailable';
    res.status(status === 400 ? 402 : 502).json({ error: msg });
    return;
  }

  await pool.query(
    `UPDATE territories
        SET locked_until = NULL, updated_at = NOW()
      WHERE id = $1`,
    [territory.id],
  );

  res.json({ success: true, itemUsed: 'battering_ram' });
});
