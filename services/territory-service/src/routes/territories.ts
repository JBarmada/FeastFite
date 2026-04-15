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
    `SELECT id, name, geojson, owner_id, owner_type,
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

// ── GET /territories/:id ──────────────────────────────────────────────────────

territoriesRouter.get('/:id', async (req: Request, res: Response) => {
  const { rows } = await pool.query(
    `SELECT id, name, geojson, owner_id, owner_type,
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
// Contested    → delegate to vote-service.

territoriesRouter.post('/:id/claim', requireAuth, async (req: Request, res: Response) => {
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
  const isLocked = territory.locked_until && new Date(territory.locked_until) > new Date();

  if (isLocked) {
    res.status(409).json({ error: 'Territory is locked — use a Battering Ram to break it' });
    return;
  }

  // Uncontested claim
  if (!territory.owner_id) {
    await pool.query(
      `UPDATE territories
          SET owner_id = $1, owner_type = 'user',
              captured_at = NOW(), locked_until = NOW() + INTERVAL '1 hour',
              updated_at = NOW()
        WHERE id = $2`,
      [userId, territory.id],
    );
    res.json({ claimed: true });
    return;
  }

  // Contested — kick off vote session
  try {
    const { data } = await axios.post<{ sessionId: string }>(
      `${VOTE_SERVICE_URL}/api/vote/sessions`,
      { territoryId: territory.id, challengerId: userId, defenderId: territory.owner_id },
      { headers: { Authorization: req.headers.authorization } },
    );
    res.json({ claimed: false, voteSessionId: data.sessionId });
  } catch {
    res.status(502).json({ error: 'vote-service unavailable' });
  }
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
