import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

const app = express();
const PORT = process.env['PORT'] ?? 3004;
const SERVICE_NAME = 'economy-service';

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: SERVICE_NAME });
});

// TODO: mount routers here
// import { economyRouter } from './routes/economy.js';
// app.use('/api/economy', economyRouter);

app.listen(PORT, () => {
  console.info(`[${SERVICE_NAME}] listening on port ${PORT}`);
});

export default app;
