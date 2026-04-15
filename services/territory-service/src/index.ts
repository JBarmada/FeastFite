import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { initDb } from './db.js';
import { territoriesRouter } from './routes/territories.js';
import { createAmqpConnection } from '@feastfite/shared';
import { startVoteWinnerConsumer } from './consumers/voteWinner.js';

const app = express();
const PORT = process.env['PORT'] ?? 3002;
const SERVICE_NAME = 'territory-service';

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: SERVICE_NAME });
});

app.use('/api/territory/territories', territoriesRouter);

async function start() {
  await initDb();

  const { channel } = await createAmqpConnection();
  await startVoteWinnerConsumer(channel);

  app.listen(PORT, () => {
    console.info(`[${SERVICE_NAME}] listening on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error(`[${SERVICE_NAME}] startup failed:`, err);
  process.exit(1);
});

export default app;
