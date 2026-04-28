import { Router, type Request, type Response } from 'express';
import { pool } from '../db/client';

export const leaderboardRouter = Router();

// Global All-Time Leaderboard
leaderboardRouter.get('/global', async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query<{ userId: string; totalPoints: number; currentStreak: number }>(`
      SELECT l.user_id as "userId",
             SUM(l.delta)::int as "totalPoints",
             COALESCE(s.current_streak, 0) as "currentStreak"
      FROM ledger_entries l
      LEFT JOIN user_stats s ON s.user_id = l.user_id
      GROUP BY l.user_id, s.current_streak
      ORDER BY "totalPoints" DESC
      LIMIT 100
    `);
    res.json({ leaderboard: rows });
  } catch (err) {
    console.error('[economy] global leaderboard error:', err);
    res.status(500).json({ error: 'Failed to fetch global leaderboard' });
  }
});

// Monthly Leaderboard
leaderboardRouter.get('/monthly', async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query<{ userId: string; totalPoints: number }>(`
      SELECT user_id as "userId", SUM(delta)::int as "totalPoints"
      FROM ledger_entries
      WHERE created_at >= date_trunc('month', NOW())
      GROUP BY user_id
      ORDER BY "totalPoints" DESC
      LIMIT 100
    `);
    res.json({ leaderboard: rows });
  } catch (err) {
    console.error('[economy] monthly leaderboard error:', err);
    res.status(500).json({ error: 'Failed to fetch monthly leaderboard' });
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
