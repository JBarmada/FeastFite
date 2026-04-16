import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createAmqpConnection } from '@feastfite/shared';
import { pool } from './db/client';
import { runMigrations } from './db/migrate';
import { economyRouter } from './routes/economy';
import { leaderboardRouter } from './routes/leaderboard';
import { setAmqpChannel } from './events/publisher';
import { startAwardsConsumer } from './consumers/awards';

const PORT = process.env['PORT'] ?? '3004';
const SERVICE_NAME = 'economy-service';

async function start(): Promise<void> {
  await pool.query('SELECT 1');
  await runMigrations();

  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: ['http://localhost:5173', 'https://feastfite.com'],
      credentials: true,
    })
  );
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: SERVICE_NAME });
  });

  app.use('/api/economy', economyRouter);
  app.use('/api/economy/leaderboard', leaderboardRouter);

  try {
    const { channel } = await createAmqpConnection();
    setAmqpChannel(channel);
    await startAwardsConsumer(channel);
  } catch (err) {
    console.warn('[amqp] could not connect on startup (non-fatal in dev):', String(err));
  }

  app.listen(PORT, () => {
    console.info(`[${SERVICE_NAME}] listening on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error(`[${SERVICE_NAME}] fatal startup error:`, err);
  process.exit(1);
});
