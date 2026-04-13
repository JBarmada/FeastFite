import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';

const app = express();
const httpServer = createServer(app);
const PORT = process.env['PORT'] ?? 3003;
const SERVICE_NAME = 'vote-service';

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: SERVICE_NAME });
});

// TODO: attach Socket.io and mount routers here
// import { Server } from 'socket.io';
// const io = new Server(httpServer, { cors: { origin: '*' } });
// import { voteRouter } from './routes/vote.js';
// app.use('/api/vote', voteRouter);

httpServer.listen(PORT, () => {
  console.info(`[${SERVICE_NAME}] listening on port ${PORT}`);
});

export default app;
