import { randomUUID } from 'crypto';
import { Router, type Request, type Response } from 'express';
import type { ItemPurchasedEvent } from '@feastfite/shared';
import { pool } from '../db/client';
import { getBalance, getBalanceClient } from '../ledger';
import { requireAuth } from '../middleware/requireAuth';
import { publishItemPurchased } from '../events/publisher';

export const economyRouter = Router();

function mapItemType(rowType: string): ItemPurchasedEvent['itemType'] {
  if (rowType === 'boost') return 'boost';
  return 'consumable';
}

// ── GET /balance ────────────────────────────────────────────────────

economyRouter.get('/balance', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as Request & { userId: string }).userId;
  try {
    const balance = await getBalance(userId);
    res.json({ balance });
  } catch (err) {
    console.error('[economy] balance failed:', err);
    res.status(500).json({ error: 'Failed to load balance' });
  }
});

// ── GET /shop ───────────────────────────────────────────────────────

economyRouter.get('/shop', async (_req: Request, res: Response) => {
  const { rows } = await pool.query<{
    id: string;
    name: string;
    price_points: number;
    item_type: string;
  }>(`SELECT id, name, price_points, item_type FROM shop_items ORDER BY price_points ASC`);
  res.json({
    items: rows.map((r) => ({
      id: r.id,
      name: r.name,
      pricePoints: r.price_points,
      itemType: r.item_type,
    })),
  });
});

// ── GET /inventory ────────────────────────────────────────────────

economyRouter.get('/inventory', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as Request & { userId: string }).userId;
  const { rows } = await pool.query<{ item_id: string; quantity: number }>(
    `SELECT item_id, quantity FROM user_inventory WHERE user_id = $1 AND quantity > 0`,
    [userId]
  );
  res.json({
    items: rows.map((r) => ({ itemId: r.item_id, quantity: r.quantity })),
  });
});

// ── POST /shop/purchase ───────────────────────────────────────────

economyRouter.post('/shop/purchase', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as Request & { userId: string }).userId;
  const itemId = (req.body as { itemId?: string }).itemId;
  if (!itemId || typeof itemId !== 'string') {
    res.status(400).json({ error: 'itemId is required' });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1::text))', [userId]);

    const { rows: itemRows } = await client.query<{
      id: string;
      name: string;
      price_points: number;
      item_type: string;
    }>(`SELECT id, name, price_points, item_type FROM shop_items WHERE id = $1`, [itemId]);

    if (itemRows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: 'Unknown shop item' });
      return;
    }

    const item = itemRows[0];
    const bal = await getBalanceClient(client, userId);
    if (bal < item.price_points) {
      await client.query('ROLLBACK');
      res.status(402).json({ error: 'Insufficient points', balance: bal, required: item.price_points });
      return;
    }

    await client.query(
      `INSERT INTO ledger_entries (user_id, delta, reason, reference_id)
       VALUES ($1, $2, $3, $4)`,
      [userId, -item.price_points, `shop_purchase:${item.id}`, `purchase:${randomUUID()}`]
    );

    await client.query(
      `INSERT INTO user_inventory (user_id, item_id, quantity)
       VALUES ($1, $2, 1)
       ON CONFLICT (user_id, item_id) DO UPDATE SET quantity = user_inventory.quantity + 1`,
      [userId, item.id]
    );

    await client.query('COMMIT');

    const eventType = mapItemType(item.item_type);
    publishItemPurchased({
      userId,
      itemId: item.id,
      itemType: eventType,
      pointsSpent: item.price_points,
      timestamp: new Date().toISOString(),
    });

    const newBalance = await getBalance(userId);
    res.json({ success: true, itemId: item.id, balance: newBalance });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[economy] purchase failed:', err);
    res.status(500).json({ error: 'Purchase failed' });
  } finally {
    client.release();
  }
});

// ── GET /stats ───────────────────────────────────────────────────
// Balance + streak for the current user.

economyRouter.get('/stats', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as Request & { userId: string }).userId;
  try {
    const balance = await getBalance(userId);
    const { rows } = await pool.query<{ current_streak: number; last_upload_date: string | null }>(
      `SELECT current_streak, last_upload_date FROM user_stats WHERE user_id = $1`,
      [userId],
    );
    const streak = rows[0]?.current_streak ?? 0;
    const lastUploadDate = rows[0]?.last_upload_date ?? null;
    res.json({ balance, streak, lastUploadDate });
  } catch (err) {
    console.error('[economy] stats failed:', err);
    res.status(500).json({ error: 'Failed to load stats' });
  }
});

// ── GET /ledger ───────────────────────────────────────────────────
// Recent ledger entries for the current user.

economyRouter.get('/ledger', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as Request & { userId: string }).userId;
  const limit = Math.min(Number(req.query['limit'] ?? 30), 100);
  try {
    const { rows } = await pool.query<{
      id: string; delta: number; reason: string;
      restaurant_id: string | null; created_at: string;
    }>(
      `SELECT id, delta, reason, restaurant_id, created_at
       FROM ledger_entries WHERE user_id = $1
       ORDER BY created_at DESC LIMIT $2`,
      [userId, limit],
    );
    res.json({
      entries: rows.map((r) => ({
        id: r.id,
        delta: r.delta,
        reason: r.reason,
        territoryId: r.restaurant_id,
        createdAt: r.created_at,
      })),
    });
  } catch (err) {
    console.error('[economy] ledger failed:', err);
    res.status(500).json({ error: 'Failed to load ledger' });
  }
});

// ── GET /leaderboard ─────────────────────────────────────────────
// Top 50 users by total points (sum of all positive ledger entries).

economyRouter.get('/leaderboard', async (_req: Request, res: Response) => {
  const { rows } = await pool.query<{ user_id: string; total_points: string }>(
    `SELECT user_id, COALESCE(SUM(delta), 0)::bigint AS total_points
     FROM ledger_entries
     GROUP BY user_id
     ORDER BY total_points DESC
     LIMIT 50`
  );
  res.json({
    leaderboard: rows.map((r, i) => ({
      rank: i + 1,
      userId: r.user_id,
      totalPoints: Number(r.total_points),
    })),
  });
});

// ── POST /inventory/use ───────────────────────────────────────────
// Consumes one consumable (e.g. battering ram) from inventory.

economyRouter.post('/inventory/use', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as Request & { userId: string }).userId;
  const itemId = (req.body as { itemId?: string }).itemId;
  if (!itemId || typeof itemId !== 'string') {
    res.status(400).json({ error: 'itemId is required' });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1::text))', [userId]);

    const { rows: typeRows } = await client.query<{ item_type: string }>(
      `SELECT item_type FROM shop_items WHERE id = $1`,
      [itemId]
    );
    if (typeRows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: 'Unknown item' });
      return;
    }
    if (typeRows[0].item_type !== 'consumable') {
      await client.query('ROLLBACK');
      res.status(400).json({ error: 'This item is not consumed from inventory' });
      return;
    }

    const { rows: invRows } = await client.query<{ quantity: number }>(
      `SELECT quantity FROM user_inventory WHERE user_id = $1 AND item_id = $2 FOR UPDATE`,
      [userId, itemId]
    );

    const qty = invRows[0]?.quantity ?? 0;
    if (qty < 1) {
      await client.query('ROLLBACK');
      res.status(400).json({ error: 'Not in inventory' });
      return;
    }

    await client.query(
      `UPDATE user_inventory SET quantity = quantity - 1 WHERE user_id = $1 AND item_id = $2`,
      [userId, itemId]
    );

    await client.query('COMMIT');

    const remaining = qty - 1;
    res.json({ success: true, itemId, remaining });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[economy] use item failed:', err);
    res.status(500).json({ error: 'Could not use item' });
  } finally {
    client.release();
  }
});

// ── GET /boosts/active ────────────────────────────────────────────
// Returns the user's currently active timed boosts.

economyRouter.get('/boosts/active', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as Request & { userId: string }).userId;
  try {
    const { rows } = await pool.query<{ item_type: string; expires_at: string }>(
      `SELECT item_type, expires_at FROM user_boosts WHERE user_id = $1 AND expires_at > NOW()`,
      [userId]
    );
    res.json({ boosts: rows.map((r) => ({ itemType: r.item_type, expiresAt: r.expires_at })) });
  } catch (err) {
    console.error('[economy] boosts/active failed:', err);
    res.status(500).json({ error: 'Failed to load active boosts' });
  }
});

// ── POST /boosts/activate ─────────────────────────────────────────
// Consumes one double_points from inventory and activates a 1-hour boost.

economyRouter.post('/boosts/activate', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as Request & { userId: string }).userId;
  const itemId = (req.body as { itemId?: string }).itemId;
  if (itemId !== 'double_points') {
    res.status(400).json({ error: 'Only double_points can be activated as a boost' });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1::text))', [userId]);

    const { rows: invRows } = await client.query<{ quantity: number }>(
      `SELECT quantity FROM user_inventory WHERE user_id = $1 AND item_id = $2 FOR UPDATE`,
      [userId, itemId]
    );
    const qty = invRows[0]?.quantity ?? 0;
    if (qty < 1) {
      await client.query('ROLLBACK');
      res.status(400).json({ error: 'Not in inventory' });
      return;
    }

    await client.query(
      `UPDATE user_inventory SET quantity = quantity - 1 WHERE user_id = $1 AND item_id = $2`,
      [userId, itemId]
    );

    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    await client.query(
      `INSERT INTO user_boosts (user_id, item_type, expires_at)
       VALUES ($1, 'double_points', $2)
       ON CONFLICT (user_id, item_type) DO UPDATE SET expires_at = EXCLUDED.expires_at`,
      [userId, expiresAt]
    );

    await client.query('COMMIT');
    res.json({ success: true, expiresAt });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[economy] boost activate failed:', err);
    res.status(500).json({ error: 'Could not activate boost' });
  } finally {
    client.release();
  }
});
