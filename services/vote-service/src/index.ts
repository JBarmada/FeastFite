import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import Redis from 'ioredis';
import { Client as MinioClient } from 'minio';
import { Server } from 'socket.io';
import { createAmqpConnection, type VoteWinnerDeclaredEvent } from '@feastfite/shared';
import type { Channel } from 'amqplib';

const app = express();
const httpServer = createServer(app);
const PORT = process.env['PORT'] ?? 3003;
const SERVICE_NAME = 'vote-service';
const SESSION_DURATION_MS = 10 * 60 * 1000;
const SESSION_TTL_SECONDS = 24 * 60 * 60;
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
  votesByUser: Record<string, string>;
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

interface VoteRequest {
  userId?: string;
  candidateId?: string;
}

interface VoteParticipantEvent {
  eventType: 'vote.participant';
  sessionId: string;
  territoryId: string;
  userId: string;
  candidateId: string;
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
  cors: {
    origin: '*',
  },
  path: '/ws/vote',
});

const sessionTimeouts = new Map<string, NodeJS.Timeout>();
let amqpChannel: Channel | null = null;

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: SERVICE_NAME });
});

app.post('/api/vote/votes/upload-url', async (req, res) => {
  const { fileName, contentType }: UploadUrlRequest = req.body ?? {};

  if (!fileName || !contentType) {
    return res.status(400).json({ message: 'fileName and contentType are required.' });
  }

  const extension = getFileExtension(fileName);
  const photoKey = `territories/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}${extension}`;

  try {
    const uploadUrl = await minio.presignedPutObject(MINIO_BUCKET_PHOTOS, photoKey, 60 * 10);

    return res.status(200).json({
      bucket: MINIO_BUCKET_PHOTOS,
      photoKey,
      uploadUrl,
      expiresInSeconds: 600,
      contentType,
    });
  } catch (error) {
    console.error('[vote-service] failed to generate upload URL', error);
    return res.status(500).json({ message: 'Failed to generate upload URL.' });
  }
});

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
  const session: VoteSessionRecord = {
    id: sessionId,
    territoryId,
    status: 'active',
    createdBy: challengerId ?? 'demo-user',
    createdAt: new Date(now).toISOString(),
    startedAt: new Date(now).toISOString(),
    endsAt: new Date(now + SESSION_DURATION_MS).toISOString(),
    completedAt: null,
    winnerId: null,
    winnerPhotoKey: null,
    candidates: [
      {
        id: `challenger-${sessionId}`,
        userId: challengerId ?? 'demo-user',
        displayName: challengerName ?? 'Cupcake Crusher',
        photoKey,
        votes: 0,
      },
      {
        id: `defender-${sessionId}`,
        userId: defenderId ?? 'house-defender',
        displayName: defenderName ?? 'Donut Defender',
        photoKey: defenderPhotoKey ?? 'seed/default-defender-donut.png',
        votes: 0,
      },
    ],
    votesByUser: {},
  };

  await saveSession(session);
  scheduleFinalization(session);
  void emitSessionUpdate(session);

  return res.status(201).json({
    session: await serializeSession(session),
    websocketPath: '/ws/vote',
  });
});

app.get('/api/vote/votes/sessions/:sessionId', async (req, res) => {
  const session = await loadSession(req.params.sessionId);

  if (!session) {
    return res.status(404).json({ message: 'Voting session not found.' });
  }

  return res.status(200).json({ session: await serializeSession(session) });
});

app.post('/api/vote/votes/sessions/:sessionId/vote', async (req, res) => {
  const { userId, candidateId }: VoteRequest = req.body ?? {};

  if (!userId || !candidateId) {
    return res.status(400).json({ message: 'userId and candidateId are required.' });
  }

  const session = await loadSession(req.params.sessionId);

  if (!session) {
    return res.status(404).json({ message: 'Voting session not found.' });
  }

  if (session.status !== 'active') {
    return res.status(409).json({ message: 'Voting session is no longer active.' });
  }

  if (new Date(session.endsAt).getTime() <= Date.now()) {
    await finalizeSession(session.id);
    const freshSession = await loadSession(session.id);
    return res.status(409).json({
      message: 'Voting session has ended.',
      session: freshSession ? await serializeSession(freshSession) : null,
    });
  }

  if (session.votesByUser[userId]) {
    return res.status(409).json({
      message: 'This user has already voted in the session.',
      session: await serializeSession(session),
    });
  }

  const candidate = session.candidates.find((entry) => entry.id === candidateId);

  if (!candidate) {
    return res.status(400).json({ message: 'Candidate not found in session.' });
  }

  candidate.votes += 1;
  session.votesByUser[userId] = candidateId;
  await saveSession(session);

  const participantEvent: VoteParticipantEvent = {
    eventType: 'vote.participant',
    sessionId: session.id,
    territoryId: session.territoryId,
    userId,
    candidateId,
    timestamp: new Date().toISOString(),
  };

  await publishEvent('vote.participant', participantEvent);
  void emitSessionUpdate(session);

  return res.status(200).json({ session: await serializeSession(session) });
});

io.on('connection', (socket) => {
  const rawSessionId = socket.handshake.query['sessionId'];
  const sessionId = Array.isArray(rawSessionId) ? rawSessionId[0] : rawSessionId;

  if (sessionId) {
    socket.join(getRoomName(sessionId));
  }

  socket.on('join-session', async (requestedSessionId: string) => {
    socket.join(getRoomName(requestedSessionId));
    const session = await loadSession(requestedSessionId);

    if (session) {
      socket.emit('session:update', await serializeSession(session));
    }
  });
});

async function bootstrap(): Promise<void> {
  const amqpConnection = await createAmqpConnection();
  amqpChannel = amqpConnection.channel;

  await ensureMinioBucket();
  await restoreActiveSessions();
}

function getRoomName(sessionId: string): string {
  return `vote-session:${sessionId}`;
}

function getSessionKey(sessionId: string): string {
  return `${VOTE_REDIS_PREFIX}:session:${sessionId}`;
}

function getActiveSessionsKey(): string {
  return `${VOTE_REDIS_PREFIX}:sessions:active`;
}

function getFinalizeLockKey(sessionId: string): string {
  return `${VOTE_REDIS_PREFIX}:lock:finalize:${sessionId}`;
}

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

async function serializeSession(session: VoteSessionRecord): Promise<ClientVoteSession> {
  return {
    ...session,
    candidates: await Promise.all(
      session.candidates.map(async (candidate) => ({
        ...candidate,
        photoUrl: await resolveCandidatePhotoUrl(candidate),
      }))
    ),
  };
}

async function resolveCandidatePhotoUrl(candidate: VoteCandidate): Promise<string> {
  if (candidate.photoKey.startsWith('seed/')) {
    return buildFallbackImageDataUrl(candidate.displayName);
  }

  try {
    return await minio.presignedGetObject(MINIO_BUCKET_PHOTOS, candidate.photoKey, 60 * 60);
  } catch (error) {
    console.warn(
      `[${SERVICE_NAME}] failed to create read URL for ${candidate.photoKey}, using fallback`,
      error
    );
    return buildFallbackImageDataUrl(candidate.displayName);
  }
}

function buildFallbackImageDataUrl(label: string): string {
  const safeLabel = escapeXml(label);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#ffd682" />
          <stop offset="100%" stop-color="#f6a4bc" />
        </linearGradient>
      </defs>
      <rect width="640" height="480" rx="36" fill="url(#bg)" />
      <circle cx="140" cy="120" r="44" fill="#fff4d3" opacity="0.65" />
      <circle cx="520" cy="340" r="58" fill="#fff4d3" opacity="0.45" />
      <text x="320" y="228" text-anchor="middle" font-size="34" font-family="Trebuchet MS, sans-serif" fill="#5c3759">
        ${safeLabel}
      </text>
      <text x="320" y="278" text-anchor="middle" font-size="18" font-family="Trebuchet MS, sans-serif" fill="#8e5372">
        Waiting for dish photo
      </text>
    </svg>
  `.trim();

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

async function restoreActiveSessions(): Promise<void> {
  const sessionIds = await redis.smembers(getActiveSessionsKey());

  await Promise.all(
    sessionIds.map(async (sessionId) => {
      const session = await loadSession(sessionId);

      if (!session) {
        await redis.srem(getActiveSessionsKey(), sessionId);
        return;
      }

      if (session.status !== 'active') {
        await redis.srem(getActiveSessionsKey(), sessionId);
        return;
      }

      scheduleFinalization(session);
    })
  );
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

function scheduleFinalization(session: VoteSessionRecord): void {
  const existingTimeout = sessionTimeouts.get(session.id);

  if (existingTimeout) {
    clearTimeout(existingTimeout);
  }

  const msUntilEnd = Math.max(new Date(session.endsAt).getTime() - Date.now(), 0);
  const timeout = setTimeout(() => {
    void finalizeSession(session.id);
  }, msUntilEnd);

  sessionTimeouts.set(session.id, timeout);
}

async function finalizeSession(sessionId: string): Promise<void> {
  const lockResult = await redis.set(getFinalizeLockKey(sessionId), '1', 'EX', 60, 'NX');

  if (lockResult !== 'OK') {
    return;
  }

  const session = await loadSession(sessionId);

  if (!session || session.status !== 'active') {
    return;
  }

  const winner = pickWinner(session.candidates);
  session.status = 'completed';
  session.completedAt = new Date().toISOString();
  session.winnerId = winner.userId;
  session.winnerPhotoKey = winner.photoKey;
  await saveSession(session);
  void emitSessionUpdate(session);
  void emitWinnerAnnouncement(session);

  const winnerEvent: VoteWinnerDeclaredEvent = {
    eventType: 'vote.winner_declared',
    sessionId: session.id,
    territoryId: session.territoryId,
    winnerId: winner.userId,
    winnerPhotoKey: winner.photoKey,
    timestamp: session.completedAt,
  };

  await publishEvent('vote.winner_declared', winnerEvent);
}

function pickWinner(candidates: VoteCandidate[]): VoteCandidate {
  const highestVoteCount = Math.max(...candidates.map((candidate) => candidate.votes));
  const tiedCandidates = candidates.filter((candidate) => candidate.votes === highestVoteCount);
  return tiedCandidates[Math.floor(Math.random() * tiedCandidates.length)];
}

async function publishEvent(
  routingKey: string,
  payload: VoteWinnerDeclaredEvent | VoteParticipantEvent
) {
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
  io.to(getRoomName(session.id)).emit('session:update', await serializeSession(session));
}

async function emitWinnerAnnouncement(session: VoteSessionRecord): Promise<void> {
  const winner = session.candidates.find((candidate) => candidate.userId === session.winnerId);
  io.to(getRoomName(session.id)).emit('session:completed', {
    sessionId: session.id,
    territoryId: session.territoryId,
    winner: winner
      ? {
          ...winner,
          photoUrl: await resolveCandidatePhotoUrl(winner),
        }
      : null,
    completedAt: session.completedAt,
  });
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
