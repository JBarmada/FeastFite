import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { Pool } from 'pg';
import { createAmqpConnection, type VoteWinnerDeclaredEvent } from '@feastfite/shared';

const app = express();
const PORT = process.env['PORT'] ?? 3005;
const SERVICE_NAME = 'profile-service';

// ── DB ────────────────────────────────────────────────────────────────────────

const pool = new Pool({
  host:     process.env['DB_HOST']     ?? 'localhost',
  port:     Number(process.env['DB_PORT'] ?? 5436),
  database: process.env['DB_NAME']     ?? 'profile_db',
  user:     process.env['DB_USER']     ?? 'feastfite',
  password: process.env['DB_PASSWORD'] ?? 'devpassword',
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (err) => {
  console.error('[profile-service] pool error:', err.message);
});

// ── Migrations ────────────────────────────────────────────────────────────────

async function runMigrations(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS territory_wins (
      user_id      TEXT        NOT NULL,
      territory_id TEXT        NOT NULL,
      win_count    INT         NOT NULL DEFAULT 1,
      last_won_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, territory_id)
    );
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS territory_wins_territory_idx
      ON territory_wins (territory_id, win_count DESC);
  `);
  console.info('[profile-service] migrations done');
}

// ── Middleware ────────────────────────────────────────────────────────────────

app.use(helmet());
app.use(cors());
app.use(express.json());

// ── Routes ────────────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: SERVICE_NAME });
});

/**
 * GET /api/profile/leaderboard/territory/:id
 * Top 10 users by win count for a specific territory.
 */
app.get('/api/profile/leaderboard/territory/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  const { rows } = await pool.query<{
    user_id: string;
    win_count: string;
    last_won_at: string;
  }>(
    `SELECT user_id, win_count, last_won_at
     FROM territory_wins
     WHERE territory_id = $1
     ORDER BY win_count DESC, last_won_at DESC
     LIMIT 10`,
    [id]
  );

  res.json({
    territoryId: id,
    leaderboard: rows.map((r, i) => ({
      rank: i + 1,
      userId: r.user_id,
      winCount: Number(r.win_count),
      lastWonAt: r.last_won_at,
    })),
  });
});

// ── RabbitMQ consumer ─────────────────────────────────────────────────────────

async function startConsumer(): Promise<void> {
  const { channel } = await createAmqpConnection();
  const QUEUE = 'profile-service.wins';
  const EXCHANGE = process.env['RABBITMQ_EXCHANGE'] ?? 'feastfite.events';

  await channel.assertQueue(QUEUE, { durable: true });
  await channel.bindQueue(QUEUE, EXCHANGE, 'vote.winner_declared');
  await channel.bindQueue(QUEUE, EXCHANGE, 'territory.claimed');
  channel.prefetch(1);

  channel.consume(QUEUE, async (msg) => {
    if (!msg) return;

    let event: VoteWinnerDeclaredEvent;
    try {
      event = JSON.parse(msg.content.toString()) as VoteWinnerDeclaredEvent;
    } catch {
      channel.nack(msg, false, false);
      return;
    }

    if (
      event.eventType !== 'vote.winner_declared' &&
      (event as { eventType: string }).eventType !== 'territory.claimed'
    ) {
      channel.ack(msg);
      return;
    }

    const userId = event.winnerId;
    const territoryId = event.territoryId;

    if (!userId || !territoryId) {
      channel.ack(msg);
      return;
    }

    try {
      await pool.query(
        `INSERT INTO territory_wins (user_id, territory_id, win_count, last_won_at)
         VALUES ($1, $2, 1, NOW())
         ON CONFLICT (user_id, territory_id) DO UPDATE
           SET win_count   = territory_wins.win_count + 1,
               last_won_at = NOW()`,
        [userId, territoryId]
      );
      channel.ack(msg);
    } catch (err) {
      console.error('[profile-service] failed to record win:', err);
      channel.nack(msg, false, true);
    }
  });

  console.info('[profile-service] listening for vote.winner_declared events');
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

async function start(): Promise<void> {
  await pool.query('SELECT 1');
  await runMigrations();

  try {
    await startConsumer();
  } catch (err) {
    console.warn('[profile-service] AMQP not available on startup (non-fatal):', String(err));
  }

  app.listen(PORT, () => {
    console.info(`[${SERVICE_NAME}] listening on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error(`[${SERVICE_NAME}] fatal startup error:`, err);
  process.exit(1);
});

export default app;
