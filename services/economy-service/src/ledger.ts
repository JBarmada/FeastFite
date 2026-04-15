import type { PoolClient } from 'pg';
import { pool } from './db/client';

export async function getBalance(userId: string): Promise<number> {
  const { rows } = await pool.query<{ b: string }>(
    `SELECT COALESCE(SUM(delta), 0)::bigint AS b FROM ledger_entries WHERE user_id = $1`,
    [userId]
  );
  return Number(rows[0].b);
}

export async function getBalanceClient(client: PoolClient, userId: string): Promise<number> {
  const { rows } = await client.query<{ b: string }>(
    `SELECT COALESCE(SUM(delta), 0)::bigint AS b FROM ledger_entries WHERE user_id = $1`,
    [userId]
  );
  return Number(rows[0].b);
}

/**
 * Idempotent award: same reference_id only inserts once (unique index).
 */
export async function awardPoints(
  userId: string,
  delta: number,
  reason: string,
  referenceId: string
): Promise<boolean> {
  try {
    const { rowCount } = await pool.query(
      `INSERT INTO ledger_entries (user_id, delta, reason, reference_id)
       VALUES ($1, $2, $3, $4)`,
      [userId, delta, reason, referenceId]
    );
    return (rowCount ?? 0) > 0;
  } catch (err: unknown) {
    const pg = err as { code?: string };
    if (pg.code === '23505') {
      return false;
    }
    throw err;
  }
}
