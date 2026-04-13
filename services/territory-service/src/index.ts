import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

const app = express();
const PORT = process.env['PORT'] ?? 3002;
const SERVICE_NAME = 'territory-service';

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: SERVICE_NAME });
});

// TODO: mount routers here
// import { territoriesRouter } from './routes/territories.js';
// app.use('/api/territory', territoriesRouter);

app.listen(PORT, () => {
  console.info(`[${SERVICE_NAME}] listening on port ${PORT}`);
});

export default app;
