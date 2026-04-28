import axios from 'axios';

const client = axios.create({
  baseURL: '/api/vote',
  headers: { 'Content-Type': 'application/json' },
});

export interface UploadResponse {
  bucket: string;
  photoKey: string;
}

export interface VoteCandidate {
  id: string;
  userId: string;
  displayName: string;
  photoKey: string;
  photoUrl: string;
  votes: number;
  totalRating: number;
}

export interface VoteSession {
  id: string;
  territoryId: string;
  territoryName: string;
  status: 'pending' | 'active' | 'completed' | 'cancelled';
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

function compressToJpeg(file: File, maxPx = 1920, quality = 0.82): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const blobUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(blobUrl);
      const scale = Math.min(1, maxPx / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.round(img.naturalWidth * scale);
      const h = Math.round(img.naturalHeight * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Compression failed'))),
        'image/jpeg',
        quality,
      );
    };
    img.onerror = () => { URL.revokeObjectURL(blobUrl); reject(new Error('Image load failed')); };
    img.src = blobUrl;
  });
}

export const voteApi = {
  client,

  async uploadFile(file: File): Promise<UploadResponse> {
    const compressed = await compressToJpeg(file);
    const resp = await fetch('/api/vote/votes/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'image/jpeg' },
      body: compressed,
    });
    if (!resp.ok) throw new Error(`Upload failed: ${resp.status}`);
    return resp.json() as Promise<UploadResponse>;
  },

  async createSession(input: {
    territoryId: string;
    territoryName?: string;
    photoKey: string;
    challengerId?: string;
    challengerName?: string;
    defenderId?: string;
    defenderName?: string;
    defenderPhotoKey?: string;
  }) {
    const response = await client.post<{ session: VoteSession; websocketPath: string }>(
      '/votes/sessions',
      input,
    );
    return response.data;
  },

  async getSession(sessionId: string) {
    const response = await client.get<{ session: VoteSession }>(`/votes/sessions/${sessionId}`);
    return response.data.session;
  },

  async getActiveSessionForTerritory(territoryId: string): Promise<VoteSession | null> {
    try {
      const response = await client.get<{ session: VoteSession }>(`/votes/sessions/by-territory/${territoryId}`);
      return response.data.session;
    } catch {
      return null;
    }
  },

  async submitVote(sessionId: string, input: { userId: string; candidateId: string; rating: number }) {
    const response = await client.post<{ session: VoteSession }>(
      `/votes/sessions/${sessionId}/vote`,
      input,
    );
    return response.data.session;
  },

  async addCandidate(sessionId: string, input: { photoKey: string; userId: string; displayName: string }) {
    const response = await client.post<{ session: VoteSession }>(
      `/votes/sessions/${sessionId}/candidates`,
      input,
    );
    return response.data.session;
  },

  async finalizeSession(sessionId: string): Promise<VoteSession | null> {
    const response = await client.post<{ session: VoteSession }>(`/votes/sessions/${sessionId}/finalize`);
    return response.data.session;
  },

  async getActiveSessions(): Promise<VoteSession[]> {
    try {
      const response = await client.get<{ sessions: VoteSession[] }>('/votes/sessions/active');
      return response.data.sessions;
    } catch {
      return [];
    }
  },

  async getPhotoUrl(photoKey: string): Promise<string> {
    try {
      const response = await client.get<{ url: string }>(`/votes/photo-url?key=${encodeURIComponent(photoKey)}`);
      return response.data.url;
    } catch {
      return '';
    }
  },
};
