import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { createAmqpConnection } from '@feastfite/shared';
import { config } from './config';
import { db } from './db/client';
import { runMigrations } from './db/migrate';
import { redis } from './redis/client';
import { setAmqpChannel } from './events/publisher';
import { authRouter } from './routes/auth';

const SERVICE_NAME = 'auth-service';

async function start(): Promise<void> {
  // ── Connect to DB ─────────────────────────────────────────────
  await db.connect().then((client) => {
    console.info('[db] connected');
    client.release();
  });
  await runMigrations();

  // ── Connect to Redis ──────────────────────────────────────────
  await redis.connect();

  // ── Connect to RabbitMQ ───────────────────────────────────────
  try {
    const { channel } = await createAmqpConnection(
      config.rabbitmq.url,
      config.rabbitmq.exchange
    );
    setAmqpChannel(channel);
  } catch (err) {
    console.warn('[amqp] could not connect on startup (non-fatal in dev):', String(err));
  }

  // ── HTTP Server ───────────────────────────────────────────────
  const app = express();

  app.use(helmet());
  app.use(cors({
    origin: ['http://localhost:5173', 'https://feastfite-demo.duckdns.org'],
    credentials: true,
  }));
  app.use(express.json());
  app.use(cookieParser());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: SERVICE_NAME });
  });

  app.use('/api/auth', authRouter);

  app.listen(config.port, () => {
    console.info(`[${SERVICE_NAME}] listening on port ${config.port}`);
  });
}

start().catch((err) => {
  console.error(`[${SERVICE_NAME}] fatal startup error:`, err);
  process.exit(1);
});
