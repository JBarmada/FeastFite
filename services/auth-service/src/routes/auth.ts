import { Router } from 'express';
import bcrypt from 'bcryptjs';
import type { Request, Response } from 'express';
import type { SignOptions } from 'jsonwebtoken';
import { signToken } from '@feastfite/shared';
import { db } from '../db/client';
import { redis } from '../redis/client';
import { config } from '../config';
import { requireAuth } from '../middleware/requireAuth';
import { publishUserRegistered } from '../events/publisher';

export const authRouter = Router();

// ── Helpers ───────────────────────────────────────────────────────

function generateRefreshToken(): string {
  return crypto.randomUUID();
}

function setRefreshCookie(res: Response, token: string): void {
  res.cookie(config.refreshToken.cookieName, token, {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'strict',
    maxAge: config.refreshToken.ttlSeconds * 1000,
    path: '/api/auth',
  });
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie(config.refreshToken.cookieName, { path: '/api/auth' });
}

function redisRefreshKey(token: string): string {
  return `refresh_token:${token}`;
}

interface UserRow {
  id: string;
  email: string;
  username: string;
  clan_id: string | null;
  created_at: Date;
  updated_at: Date;
}

function toUserPayload(row: UserRow) {
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    clanId: row.clan_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ── POST /register ────────────────────────────────────────────────

authRouter.post('/register', async (req: Request, res: Response) => {
  const { email, username, password } = req.body as {
    email?: string;
    username?: string;
    password?: string;
  };

  if (!email || !username || !password) {
    res.status(400).json({ error: 'email, username, and password are required' });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: 'password must be at least 8 characters' });
    return;
  }
  if (username.length < 3 || username.length > 20) {
    res.status(400).json({ error: 'username must be 3–20 characters' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  let row: UserRow;
  try {
    const result = await db.query<UserRow>(
      `INSERT INTO users (email, username, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, email, username, clan_id, created_at, updated_at`,
      [email.toLowerCase().trim(), username.trim(), passwordHash]
    );
    row = result.rows[0];
  } catch (err: unknown) {
    const pgErr = err as { code?: string };
    if (pgErr.code === '23505') {
      res.status(409).json({ error: 'Email or username already taken' });
      return;
    }
    throw err;
  }

  const user = toUserPayload(row);

  const accessToken = signToken(
    { userId: user.id, email: user.email, username: user.username },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn as SignOptions['expiresIn'] }
  );
  const refreshToken = generateRefreshToken();

  await redis.set(
    redisRefreshKey(refreshToken),
    user.id,
    'EX',
    config.refreshToken.ttlSeconds
  );

  setRefreshCookie(res, refreshToken);

  await publishUserRegistered({
    userId: user.id,
    email: user.email,
    timestamp: new Date().toISOString(),
  });

  res.status(201).json({ user, token: accessToken });
});

// ── POST /login ───────────────────────────────────────────────────

authRouter.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    res.status(400).json({ error: 'email and password are required' });
    return;
  }

  const result = await db.query<UserRow & { password_hash: string }>(
    `SELECT id, email, username, clan_id, password_hash, created_at, updated_at
     FROM users WHERE email = $1`,
    [email.toLowerCase().trim()]
  );

  const row = result.rows[0];
  if (!row) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  const valid = await bcrypt.compare(password, row.password_hash);
  if (!valid) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  const user = toUserPayload(row);

  const accessToken = signToken(
    { userId: user.id, email: user.email, username: user.username },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn as SignOptions['expiresIn'] }
  );
  const refreshToken = generateRefreshToken();

  await redis.set(
    redisRefreshKey(refreshToken),
    user.id,
    'EX',
    config.refreshToken.ttlSeconds
  );

  setRefreshCookie(res, refreshToken);

  res.json({ user, token: accessToken });
});

// ── POST /refresh ─────────────────────────────────────────────────

authRouter.post('/refresh', async (req: Request, res: Response) => {
  const oldToken: string | undefined = req.cookies?.[config.refreshToken.cookieName];

  if (!oldToken) {
    res.status(401).json({ error: 'No refresh token' });
    return;
  }

  const userId = await redis.get(redisRefreshKey(oldToken));
  if (!userId) {
    clearRefreshCookie(res);
    res.status(401).json({ error: 'Refresh token expired or revoked' });
    return;
  }

  const result = await db.query<UserRow>(
    `SELECT id, email, username, clan_id, created_at, updated_at
     FROM users WHERE id = $1`,
    [userId]
  );
  const row = result.rows[0];
  if (!row) {
    clearRefreshCookie(res);
    res.status(401).json({ error: 'User not found' });
    return;
  }

  // Rotate: delete old token, create new one
  await redis.del(redisRefreshKey(oldToken));
  const newRefreshToken = generateRefreshToken();
  await redis.set(
    redisRefreshKey(newRefreshToken),
    userId,
    'EX',
    config.refreshToken.ttlSeconds
  );

  setRefreshCookie(res, newRefreshToken);

  const accessToken = signToken(
    { userId: row.id, email: row.email, username: row.username },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn as SignOptions['expiresIn'] }
  );

  const user = toUserPayload(row);
  res.json({ user, token: accessToken });
});

// ── POST /logout ──────────────────────────────────────────────────

authRouter.post('/logout', async (req: Request, res: Response) => {
  const token: string | undefined = req.cookies?.[config.refreshToken.cookieName];

  if (token) {
    await redis.del(redisRefreshKey(token));
  }

  clearRefreshCookie(res);
  res.status(204).send();
});

// ── GET /me ───────────────────────────────────────────────────────

authRouter.get('/me', requireAuth, async (req: Request, res: Response) => {
  const result = await db.query<UserRow>(
    `SELECT id, email, username, clan_id, created_at, updated_at
     FROM users WHERE id = $1`,
    [req.user!.userId]
  );

  const row = result.rows[0];
  if (!row) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.json(toUserPayload(row));
});

// ── GET /users/lookup?ids=id1,id2,... ────────────────────────────────────────

authRouter.get('/users/lookup', async (req: Request, res: Response) => {
  const raw = req.query['ids'];
  const ids = (typeof raw === 'string' ? raw : '').split(',').map((s) => s.trim()).filter(Boolean);

  if (ids.length === 0) {
    res.json({ users: [] });
    return;
  }

  const result = await db.query<{ id: string; username: string; clan_id: string | null; clan_name: string | null }>(
    `SELECT u.id, u.username, u.clan_id, c.name AS clan_name
     FROM users u
     LEFT JOIN clans c ON c.id = u.clan_id
     WHERE u.id = ANY($1::uuid[])`,
    [ids],
  );

  res.json({
    users: result.rows.map((r) => ({
      id: r.id,
      username: r.username,
      clanId: r.clan_id,
      clanName: r.clan_name,
    })),
  });
});

// ── POST /clans ───────────────────────────────────────────────────

authRouter.post('/clans', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as Request & { userId: string }).userId;
  const { name, tag } = req.body as { name?: string; tag?: string };

  if (!name || !tag) {
    res.status(400).json({ error: 'name and tag are required' });
    return;
  }
  if (name.length < 2 || name.length > 50) {
    res.status(400).json({ error: 'name must be 2–50 characters' });
    return;
  }
  if (tag.length < 2 || tag.length > 8) {
    res.status(400).json({ error: 'tag must be 2–8 characters' });
    return;
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const { rows: existing } = await client.query<{ clan_id: string | null }>(
      `SELECT clan_id FROM users WHERE id = $1`,
      [userId],
    );
    if (existing[0]?.clan_id) {
      await client.query('ROLLBACK');
      res.status(409).json({ error: 'You are already in a clan' });
      return;
    }

    const { rows } = await client.query<{ id: string; name: string; tag: string }>(
      `INSERT INTO clans (name, tag, created_by) VALUES ($1, $2, $3) RETURNING id, name, tag`,
      [name.trim(), tag.trim().toUpperCase(), userId],
    );
    const clan = rows[0]!;

    await client.query(`UPDATE users SET clan_id = $1 WHERE id = $2`, [clan.id, userId]);
    await client.query('COMMIT');

    res.status(201).json({ clan });
  } catch (err: unknown) {
    await client.query('ROLLBACK');
    if ((err as { code?: string }).code === '23505') {
      res.status(409).json({ error: 'Clan name already taken' });
      return;
    }
    res.status(500).json({ error: 'Failed to create clan' });
  } finally {
    client.release();
  }
});

// ── GET /clans/leaderboard ────────────────────────────────────────

authRouter.get('/clans/leaderboard', async (_req: Request, res: Response) => {
  const { rows } = await db.query<{ id: string; name: string; tag: string; member_count: string }>(
    `SELECT c.id, c.name, c.tag, COUNT(u.id)::text AS member_count
     FROM clans c
     LEFT JOIN users u ON u.clan_id = c.id
     GROUP BY c.id, c.name, c.tag
     ORDER BY member_count DESC
     LIMIT 20`,
  );
  res.json({
    clans: rows.map((r, i) => ({
      rank: i + 1,
      id: r.id,
      name: r.name,
      tag: r.tag,
      memberCount: Number(r.member_count),
    })),
  });
});

// ── GET /clans/:id ────────────────────────────────────────────────

authRouter.get('/clans/:id', async (req: Request, res: Response) => {
  const { rows } = await db.query<{ id: string; name: string; tag: string; created_at: Date }>(
    `SELECT id, name, tag, created_at FROM clans WHERE id = $1`,
    [req.params['id']],
  );
  if (rows.length === 0) {
    res.status(404).json({ error: 'Clan not found' });
    return;
  }
  const clan = rows[0]!;

  const { rows: members } = await db.query<{ id: string; username: string }>(
    `SELECT id, username FROM users WHERE clan_id = $1 LIMIT 50`,
    [clan.id],
  );

  res.json({ clan: { ...clan, members } });
});

// ── POST /clans/:id/join ──────────────────────────────────────────

authRouter.post('/clans/:id/join', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as Request & { userId: string }).userId;
  const clanId = req.params['id'];

  const { rows } = await db.query<{ clan_id: string | null }>(
    `SELECT clan_id FROM users WHERE id = $1`,
    [userId],
  );
  if (rows[0]?.clan_id) {
    res.status(409).json({ error: 'Leave your current clan first' });
    return;
  }

  const { rowCount } = await db.query(
    `UPDATE users SET clan_id = $1 WHERE id = $2`,
    [clanId, userId],
  );
  if (!rowCount) {
    res.status(404).json({ error: 'Clan not found' });
    return;
  }
  res.json({ joined: true });
});

// ── POST /clans/:id/leave ─────────────────────────────────────────

authRouter.post('/clans/:id/leave', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as Request & { userId: string }).userId;
  await db.query(
    `UPDATE users SET clan_id = NULL WHERE id = $1 AND clan_id = $2`,
    [userId, req.params['id']],
  );
  res.json({ left: true });
});

// ── POST /forgot-password (stub) ──────────────────────────────────

authRouter.post('/forgot-password', async (req: Request, res: Response) => {
  const { email } = req.body as { email?: string };
  if (!email) {
    res.status(400).json({ error: 'email is required' });
    return;
  }
  // Return 200 regardless to avoid email enumeration
  res.json({ message: 'If that email exists, a reset link has been sent.' });
});
