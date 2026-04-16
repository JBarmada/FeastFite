import { Router, type Request, type Response } from 'express';
import { pool } from '../db/client';

export const leaderboardRouter = Router();

// Global All-Time Leaderboard
leaderboardRouter.get('/global', async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query<{ userId: string; totalPoints: number; currentStreak: number }>(`
      SELECT user_id as "userId", total_points as "totalPoints", current_streak as "currentStreak"
      FROM user_stats
      ORDER BY total_points DESC
      LIMIT 100
    `);
    res.json({ leaderboard: rows });
  } catch (err) {
    console.error('[economy] global leaderboard error:', err);
    res.status(500).json({ error: 'Failed to fetch global leaderboard' });
  }
});

// Weekly Leaderboard
leaderboardRouter.get('/weekly', async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query<{ userId: string; totalPoints: number }>(`
      SELECT user_id as "userId", SUM(delta)::int as "totalPoints"
      FROM ledger_entries
      WHERE created_at >= date_trunc('week', NOW())
      GROUP BY user_id
      ORDER BY "totalPoints" DESC
      LIMIT 100
    `);
    res.json({ leaderboard: rows });
  } catch (err) {
    console.error('[economy] weekly leaderboard error:', err);
    res.status(500).json({ error: 'Failed to fetch weekly leaderboard' });
  }
});

// Restaurant-Specific Leaderboard
leaderboardRouter.get('/restaurant/:id', async (req: Request, res: Response) => {
  const restaurantId = req.params.id;
  try {
    const { rows } = await pool.query<{ userId: string; totalPoints: number }>(`
      SELECT user_id as "userId", SUM(delta)::int as "totalPoints"
      FROM ledger_entries
      WHERE restaurant_id = $1
      GROUP BY user_id
      ORDER BY "totalPoints" DESC
      LIMIT 100
    `, [restaurantId]);
    res.json({ leaderboard: rows });
  } catch (err) {
    console.error('[economy] restaurant leaderboard error:', err);
    res.status(500).json({ error: 'Failed to fetch restaurant leaderboard' });
  }
});
