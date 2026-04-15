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

// ── POST /inventory/use ───────────────────────────────────────────
// Consumes one consumable (e.g. battering ram) from inventory.

economyRouter.post('/inventory/use', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as Request & { userId: string }).userId;
  const itemId = (req.body as { itemId?: string }).itemId;
  if (!itemId || typeof itemId !== 'string') {
    res.status(400).json({ error: 'itemId is required' });
    return;
  }

  if (itemId !== 'battering_ram') {
    res.status(400).json({ error: 'Only the battering ram can be used from this endpoint' });
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
