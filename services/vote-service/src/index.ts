import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import Redis from 'ioredis';
import { Client as MinioClient } from 'minio';
import { Server } from 'socket.io';
import { startAmqpConnector, type VoteWinnerDeclaredEvent } from '@feastfite/shared';
import type { Channel } from 'amqplib';

const app = express();
const httpServer = createServer(app);
const PORT = process.env['PORT'] ?? 3003;
const SERVICE_NAME = 'vote-service';
// Sessions are open-ended — no automatic timer close
const SESSION_TTL_SECONDS = 365 * 24 * 60 * 60;
const VOTE_REDIS_PREFIX = 'vote-service';
const RABBITMQ_EXCHANGE = process.env['RABBITMQ_EXCHANGE'] ?? 'feastfite.events';
const MINIO_BUCKET_PHOTOS = process.env['MINIO_BUCKET_PHOTOS'] ?? 'fight-photos';

type SessionStatus = 'pending' | 'active' | 'completed' | 'cancelled';

interface VoteCandidate {
  id: string;
  userId: string;
  displayName: string;
  photoKey: string;
  votes: number;
  totalRating: number;
}

interface ClientVoteCandidate extends VoteCandidate {
  photoUrl: string;
}

interface VoteSessionRecord {
  id: string;
  territoryId: string;
  status: SessionStatus;
  createdBy: string;
  createdAt: string;
  startedAt: string;
  endsAt: string;
  completedAt: string | null;
  winnerId: string | null;
  winnerPhotoKey: string | null;
  candidates: VoteCandidate[];
  votesByUser: Record<string, string[]>;
  ratingByUser: Record<string, Record<string, number>>;
}

interface ClientVoteSession extends Omit<VoteSessionRecord, 'candidates'> {
  candidates: ClientVoteCandidate[];
}

interface UploadUrlRequest {
  fileName?: string;
  contentType?: string;
}

interface CreateSessionRequest {
  territoryId?: string;
  photoKey?: string;
  challengerId?: string;
  challengerName?: string;
  defenderId?: string;
  defenderName?: string;
  defenderPhotoKey?: string;
}

interface AddCandidateRequest {
  photoKey?: string;
  userId?: string;
  displayName?: string;
}

interface VoteRequest {
  userId?: string;
  candidateId?: string;
  rating?: number;
}

interface VoteParticipantEvent {
  eventType: 'vote.participant';
  sessionId: string;
  territoryId: string;
  userId: string;
  candidateId: string;
  candidateUserId: string;
  rating: number;
  timestamp: string;
}

const redis = new Redis(process.env['REDIS_URL'] ?? 'redis://localhost:6379');
const minio = new MinioClient({
  endPoint: process.env['MINIO_ENDPOINT'] ?? 'localhost',
  port: Number(process.env['MINIO_PORT'] ?? 9000),
  useSSL: process.env['MINIO_USE_SSL'] === 'true',
  accessKey: process.env['MINIO_ACCESS_KEY'] ?? 'minioadmin',
  secretKey: process.env['MINIO_SECRET_KEY'] ?? 'minioadmin123',
});

const io = new Server(httpServer, {
  cors: { origin: '*' },
  path: '/ws/vote',
});

let amqpChannel: Channel | null = null;

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: SERVICE_NAME });
});

// ── Direct upload (replaces presigned PUT — MinIO stays internal) ─────────────

app.post(
  '/api/vote/votes/upload',
  express.raw({ type: ['image/*', 'application/octet-stream'], limit: '20mb' }),
  async (req, res) => {
    const rawContentType = req.headers['content-type'] ?? 'image/jpeg';
    const mimeType = rawContentType.split(';')[0]?.trim() ?? 'image/jpeg';
    const extMap: Record<string, string> = { 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif', 'image/heic': '.heic' };
    const extension = extMap[mimeType] ?? '.jpg';
    const photoKey = `territories/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}${extension}`;
    const buffer = req.body as Buffer;

    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
      return res.status(400).json({ message: 'No image data received.' });
    }

    try {
      await minio.putObject(MINIO_BUCKET_PHOTOS, photoKey, buffer, buffer.length, { 'Content-Type': mimeType });
      return res.status(200).json({ bucket: MINIO_BUCKET_PHOTOS, photoKey });
    } catch (error) {
      console.error('[vote-service] failed to upload photo', error);
      return res.status(500).json({ message: 'Failed to upload photo.' });
    }
  },
);

// ── Photo URL → proxy URL (no direct MinIO URLs reach the browser) ────────────

app.get('/api/vote/votes/photo-url', (req, res) => {
  const photoKey = req.query['key'];
  if (typeof photoKey !== 'string' || !photoKey) {
    return res.status(400).json({ message: 'key query param required.' });
  }

  if (photoKey.startsWith('seed/')) {
    return res.json({ url: buildFallbackImageDataUrl(photoKey) });
  }

  return res.json({ url: `/api/vote/votes/photo-proxy?key=${encodeURIComponent(photoKey)}` });
});

// ── Photo proxy (streams from MinIO, serves over HTTPS) ───────────────────────

app.get('/api/vote/votes/photo-proxy', async (req, res) => {
  const photoKey = req.query['key'];
  if (typeof photoKey !== 'string' || !photoKey) {
    return res.status(400).json({ message: 'key required.' });
  }

  try {
    const stat = await minio.statObject(MINIO_BUCKET_PHOTOS, photoKey);
    const contentType = (stat.metaData?.['content-type'] as string | undefined) ?? 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    const stream = await minio.getObject(MINIO_BUCKET_PHOTOS, photoKey);
    stream.pipe(res);
  } catch {
    return res.status(404).json({ message: 'Photo not found.' });
  }
});

// ── Create session ────────────────────────────────────────────────────────────

app.post('/api/vote/votes/sessions', async (req, res) => {
  const {
    territoryId,
    photoKey,
    challengerId,
    challengerName,
    defenderId,
    defenderName,
    defenderPhotoKey,
  }: CreateSessionRequest = req.body ?? {};

  if (!territoryId || !photoKey) {
    return res.status(400).json({ message: 'territoryId and photoKey are required.' });
  }

  const now = Date.now();
  const sessionId = crypto.randomUUID();
  const farFuture = new Date(now + 365 * 24 * 60 * 60 * 1000).toISOString();

  const candidates: VoteCandidate[] = [
    {
      id: `challenger-${sessionId}`,
      userId: challengerId ?? 'demo-user',
      displayName: challengerName ?? 'Cupcake Crusher',
      photoKey,
      votes: 0,
      totalRating: 0,
    },
  ];

  if (defenderId && defenderPhotoKey) {
    candidates.push({
      id: `defender-${sessionId}`,
      userId: defenderId,
      displayName: defenderName ?? 'Donut Defender',
      photoKey: defenderPhotoKey,
      votes: 0,
      totalRating: 0,
    });
  }

  const session: VoteSessionRecord = {
    id: sessionId,
    territoryId,
    status: 'active',
    createdBy: challengerId ?? 'demo-user',
    createdAt: new Date(now).toISOString(),
    startedAt: new Date(now).toISOString(),
    endsAt: farFuture,
    completedAt: null,
    winnerId: null,
    winnerPhotoKey: null,
    candidates,
    votesByUser: {},
    ratingByUser: {},
  };

  await saveSession(session);
  await redis.set(`${VOTE_REDIS_PREFIX}:territory:active:${territoryId}`, sessionId, 'EX', SESSION_TTL_SECONDS);
  void emitSessionUpdate(session);

  return res.status(201).json({
    session: serializeSession(session),
    websocketPath: '/ws/vote',
  });
});

// ── Add candidate to existing session ────────────────────────────────────────

app.post('/api/vote/votes/sessions/:sessionId/candidates', async (req, res) => {
  const { photoKey, userId, displayName }: AddCandidateRequest = req.body ?? {};

  if (!photoKey || !userId) {
    return res.status(400).json({ message: 'photoKey and userId are required.' });
  }

  const session = await loadSession(req.params['sessionId']!);
  if (!session) return res.status(404).json({ message: 'Session not found.' });
  if (session.status !== 'active') return res.status(409).json({ message: 'Session is no longer active.' });

  const alreadyIn = session.candidates.some((c) => c.userId === userId);
  if (alreadyIn) {
    return res.status(409).json({ message: 'You already have a dish in this session.', session: serializeSession(session) });
  }

  const candidateId = `candidate-${userId}-${Date.now()}`;
  session.candidates.push({ id: candidateId, userId, displayName: displayName ?? 'Mystery Foodie', photoKey, votes: 0, totalRating: 0 });
  await saveSession(session);
  void emitSessionUpdate(session);

  return res.status(200).json({ session: serializeSession(session) });
});

// ── Get session by territory ──────────────────────────────────────────────────

app.get('/api/vote/votes/sessions/by-territory/:territoryId', async (req, res) => {
  const { territoryId } = req.params;
  const sessionId = await redis.get(`${VOTE_REDIS_PREFIX}:territory:active:${territoryId}`);
  if (!sessionId) return res.status(404).json({ message: 'No active session for this territory.' });

  const session = await loadSession(sessionId);
  if (!session || session.status !== 'active') {
    await redis.del(`${VOTE_REDIS_PREFIX}:territory:active:${territoryId}`);
    return res.status(404).json({ message: 'No active session for this territory.' });
  }
  return res.status(200).json({ session: serializeSession(session) });
});

// ── Get session by id ─────────────────────────────────────────────────────────

app.get('/api/vote/votes/sessions/:sessionId', async (req, res) => {
  const session = await loadSession(req.params['sessionId']!);
  if (!session) return res.status(404).json({ message: 'Voting session not found.' });
  return res.status(200).json({ session: serializeSession(session) });
});

// ── Submit vote ───────────────────────────────────────────────────────────────

app.post('/api/vote/votes/sessions/:sessionId/vote', async (req, res) => {
  const { userId, candidateId, rating }: VoteRequest = req.body ?? {};

  if (!userId || !candidateId) {
    return res.status(400).json({ message: 'userId and candidateId are required.' });
  }

  const ratingValue = typeof rating === 'number'
    ? Math.min(10, Math.max(1, Math.round(rating)))
    : 5;

  const session = await loadSession(req.params['sessionId']!);
  if (!session) return res.status(404).json({ message: 'Voting session not found.' });
  if (session.status !== 'active') return res.status(409).json({ message: 'Voting session is no longer active.' });

  const alreadyRated: string[] = session.votesByUser[userId] ?? [];
  if (alreadyRated.includes(candidateId)) {
    return res.status(409).json({ message: 'You already rated this dish.', session: serializeSession(session) });
  }

  const candidate = session.candidates.find((entry) => entry.id === candidateId);
  if (!candidate) return res.status(400).json({ message: 'Candidate not found in session.' });

  candidate.votes += 1;
  candidate.totalRating += ratingValue;
  session.votesByUser[userId] = [...alreadyRated, candidateId];
  session.ratingByUser = session.ratingByUser ?? {};
  session.ratingByUser[userId] = { ...(session.ratingByUser[userId] ?? {}), [candidateId]: ratingValue };
  await saveSession(session);

  const participantEvent: VoteParticipantEvent = {
    eventType: 'vote.participant',
    sessionId: session.id,
    territoryId: session.territoryId,
    userId,
    candidateId,
    candidateUserId: candidate.userId,
    rating: ratingValue,
    timestamp: new Date().toISOString(),
  };

  await publishEvent('vote.participant', participantEvent);
  void emitSessionUpdate(session);

  // Auto-finalize when every candidate has at least 3 votes
  const MIN_VOTES = 3;
  if (session.candidates.every((c) => c.votes >= MIN_VOTES)) {
    void finalizeSession(session.id);
  }

  return res.status(200).json({ session: serializeSession(session) });
});

// ── Manual finalize ───────────────────────────────────────────────────────────

app.post('/api/vote/votes/sessions/:sessionId/finalize', async (req, res) => {
  const session = await loadSession(req.params['sessionId']!);
  if (!session) return res.status(404).json({ message: 'Session not found.' });
  if (session.status !== 'active') return res.status(409).json({ message: 'Session already ended.' });

  const totalVotes = session.candidates.reduce((sum, c) => sum + c.votes, 0);
  if (totalVotes === 0) return res.status(409).json({ message: 'No votes yet — cast at least one vote first.' });

  await finalizeSession(session.id);
  const updated = await loadSession(session.id);
  return res.status(200).json({ session: updated ? serializeSession(updated) : null });
});

// ── Socket.io ─────────────────────────────────────────────────────────────────

io.on('connection', (socket) => {
  const rawSessionId = socket.handshake.query['sessionId'];
  const sessionId = Array.isArray(rawSessionId) ? rawSessionId[0] : rawSessionId;

  if (sessionId) socket.join(getRoomName(sessionId));

  socket.on('join-session', async (requestedSessionId: string) => {
    socket.join(getRoomName(requestedSessionId));
    const session = await loadSession(requestedSessionId);
    if (session) socket.emit('session:update', serializeSession(session));
  });
});

// ── Bootstrap ─────────────────────────────────────────────────────────────────

async function bootstrap(): Promise<void> {
  await ensureMinioBucket();
  startAmqpConnector({
    logPrefix: '[vote-service][amqp]',
    onConnect: ({ channel }) => {
      amqpChannel = channel;
    },
    onDisconnect: async () => {
      amqpChannel = null;
      console.warn('[vote-service][amqp] channel unavailable until reconnect');
    },
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getRoomName(sessionId: string): string { return `vote-session:${sessionId}`; }
function getSessionKey(sessionId: string): string { return `${VOTE_REDIS_PREFIX}:session:${sessionId}`; }
function getActiveSessionsKey(): string { return `${VOTE_REDIS_PREFIX}:sessions:active`; }

function getFileExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf('.');
  return lastDot >= 0 ? fileName.slice(lastDot) : '.jpg';
}

async function ensureMinioBucket(): Promise<void> {
  const exists = await minio.bucketExists(MINIO_BUCKET_PHOTOS);
  if (!exists) {
    await minio.makeBucket(MINIO_BUCKET_PHOTOS);
    console.info(`[${SERVICE_NAME}] created MinIO bucket ${MINIO_BUCKET_PHOTOS}`);
  }
}

function serializeSession(session: VoteSessionRecord): ClientVoteSession {
  return {
    ...session,
    candidates: session.candidates.map((candidate) => ({
      ...candidate,
      photoUrl: resolveCandidatePhotoUrl(candidate),
    })),
  };
}

function resolveCandidatePhotoUrl(candidate: VoteCandidate): string {
  if (candidate.photoKey.startsWith('seed/')) return buildFallbackImageDataUrl(candidate.displayName);
  return `/api/vote/votes/photo-proxy?key=${encodeURIComponent(candidate.photoKey)}`;
}

function buildFallbackImageDataUrl(label: string): string {
  const safeLabel = escapeXml(label);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480"><defs><linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#ffd682"/><stop offset="100%" stop-color="#f6a4bc"/></linearGradient></defs><rect width="640" height="480" rx="36" fill="url(#bg)"/><circle cx="140" cy="120" r="44" fill="#fff4d3" opacity="0.65"/><circle cx="520" cy="340" r="58" fill="#fff4d3" opacity="0.45"/><text x="320" y="228" text-anchor="middle" font-size="34" font-family="Trebuchet MS, sans-serif" fill="#5c3759">${safeLabel}</text><text x="320" y="278" text-anchor="middle" font-size="18" font-family="Trebuchet MS, sans-serif" fill="#8e5372">Waiting for dish photo</text></svg>`.trim();
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function escapeXml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
}

function getFinalizeLockKey(sessionId: string): string {
  return `${VOTE_REDIS_PREFIX}:lock:finalize:${sessionId}`;
}

async function finalizeSession(sessionId: string): Promise<void> {
  const lockResult = await redis.set(getFinalizeLockKey(sessionId), '1', 'EX', 60, 'NX');
  if (lockResult !== 'OK') return;

  const session = await loadSession(sessionId);
  if (!session || session.status !== 'active') return;

  const winner = pickWinner(session.candidates);
  session.status = 'completed';
  session.completedAt = new Date().toISOString();
  session.winnerId = winner.userId;
  session.winnerPhotoKey = winner.photoKey;
  await saveSession(session);
  void emitSessionUpdate(session);

  await redis.del(`${VOTE_REDIS_PREFIX}:territory:active:${session.territoryId}`);

  const winnerEvent: VoteWinnerDeclaredEvent = {
    eventType: 'vote.winner_declared',
    sessionId: session.id,
    territoryId: session.territoryId,
    winnerId: winner.userId,
    winnerName: winner.displayName,
    winnerPhotoKey: winner.photoKey,
    timestamp: session.completedAt,
    candidates: session.candidates.map((c) => ({
      userId: c.userId,
      photoKey: c.photoKey,
      votes: c.votes,
      totalRating: c.totalRating,
      avgRating: c.votes > 0 ? Math.round((c.totalRating / c.votes) * 10) / 10 : 0,
    })),
  };

  await publishEvent('vote.winner_declared', winnerEvent);
  console.info(`[${SERVICE_NAME}] session ${sessionId} finalized — winner: ${winner.userId}`);
}

function pickWinner(candidates: VoteCandidate[]): VoteCandidate {
  const highestRating = Math.max(...candidates.map((c) => c.totalRating));
  const tied = candidates.filter((c) => c.totalRating === highestRating);
  return tied[Math.floor(Math.random() * tied.length)]!;
}

async function loadSession(sessionId: string): Promise<VoteSessionRecord | null> {
  const raw = await redis.get(getSessionKey(sessionId));
  return raw ? (JSON.parse(raw) as VoteSessionRecord) : null;
}

async function saveSession(session: VoteSessionRecord): Promise<void> {
  await redis.set(getSessionKey(session.id), JSON.stringify(session), 'EX', SESSION_TTL_SECONDS);
  if (session.status === 'active') {
    await redis.sadd(getActiveSessionsKey(), session.id);
  } else {
    await redis.srem(getActiveSessionsKey(), session.id);
  }
}

async function publishEvent(routingKey: string, payload: VoteWinnerDeclaredEvent | VoteParticipantEvent) {
  if (!amqpChannel) {
    console.warn(`[${SERVICE_NAME}] AMQP channel unavailable, skipping publish for ${routingKey}`);
    return;
  }
  amqpChannel.publish(RABBITMQ_EXCHANGE, routingKey, Buffer.from(JSON.stringify(payload)), {
    contentType: 'application/json',
    persistent: true,
  });
}

async function emitSessionUpdate(session: VoteSessionRecord): Promise<void> {
  io.to(getRoomName(session.id)).emit('session:update', serializeSession(session));
}

void bootstrap()
  .then(() => {
    httpServer.listen(PORT, () => {
      console.info(`[${SERVICE_NAME}] listening on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error(`[${SERVICE_NAME}] failed to bootstrap`, error);
    process.exit(1);
  });

export default app;
