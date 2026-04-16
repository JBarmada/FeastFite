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
  referenceId: string,
  restaurantId?: string
): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rowCount } = await client.query(
      `INSERT INTO ledger_entries (user_id, delta, reason, reference_id, restaurant_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, delta, reason, referenceId, restaurantId ?? null]
    );

    if ((rowCount ?? 0) > 0) {
      // Determine if this is an upload for streak purposes
      const isUpload = reason === 'vote_participant';
      await updateUserStats(client, userId, isUpload);
    }
    await client.query('COMMIT');
    return (rowCount ?? 0) > 0;
  } catch (err: unknown) {
    await client.query('ROLLBACK');
    const pg = err as { code?: string };
    if (pg.code === '23505') {
      return false; // idempotency key hit
    }
    throw err;
  } finally {
    client.release();
  }
}

export async function updateUserStats(client: PoolClient, userId: string, hasUpload: boolean): Promise<void> {
  const result = await client.query(
    `SELECT total_points, current_streak, last_upload_date FROM user_stats WHERE user_id = $1 FOR UPDATE`,
    [userId]
  );
  
  let stats = result.rows[0];
  if (!stats) {
    await client.query(
      `INSERT INTO user_stats (user_id, total_points, current_streak, last_upload_date) VALUES ($1, 0, 0, NULL)`,
      [userId]
    );
    stats = { total_points: 0, current_streak: 0, last_upload_date: null };
  }

  const newTotal = await getBalanceClient(client, userId);
  
  let newStreak = stats.current_streak;
  let newUploadDate = stats.last_upload_date;

  if (hasUpload) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    if (stats.last_upload_date) {
      const last = new Date(stats.last_upload_date);
      last.setUTCHours(0, 0, 0, 0);
      const diffDays = Math.floor((today.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1) {
        newStreak += 1;
        newUploadDate = today.toISOString().split('T')[0];
        
        // Award streak bonus points
        await client.query(
          `INSERT INTO ledger_entries (user_id, delta, reason, reference_id)
           VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
          [userId, 5, 'streak_bonus', `streak:${userId}:${newUploadDate}`]
        );
      } else if (diffDays > 1) {
        newStreak = 1;
        newUploadDate = today.toISOString().split('T')[0];
      }
    } else {
      newStreak = 1;
      newUploadDate = today.toISOString().split('T')[0];
    }
  }

  await client.query(
    `UPDATE user_stats SET total_points = $2, current_streak = $3, last_upload_date = $4 WHERE user_id = $1`,
    [userId, newTotal, newStreak, newUploadDate]
  );
}
