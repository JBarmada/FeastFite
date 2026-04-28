import axios from 'axios';

const client = axios.create({
  baseURL: '/api/vote',
  headers: { 'Content-Type': 'application/json' },
});

export interface UploadUrlResponse {
  bucket: string;
  photoKey: string;
  uploadUrl: string;
  expiresInSeconds: number;
  contentType: string;
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

export const voteApi = {
  client,

  async createUploadUrl(file: File) {
    const response = await client.post<UploadUrlResponse>('/votes/upload-url', {
      fileName: file.name,
      contentType: file.type || 'image/jpeg',
    });
    return response.data;
  },

  async uploadPhoto(uploadUrl: string, file: File) {
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type || 'image/jpeg' },
      body: file,
    });
    if (!response.ok) throw new Error(`Upload failed with status ${response.status}`);
  },

  async createSession(input: {
    territoryId: string;
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
