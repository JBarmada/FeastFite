import axios from 'axios';

const profileClient = axios.create({
  baseURL: '/api/profile',
  headers: { 'Content-Type': 'application/json' },
});

const economyClient = axios.create({
  baseURL: '/api/economy',
  headers: { 'Content-Type': 'application/json' },
});

const authClient = axios.create({
  baseURL: '/api/auth',
  headers: { 'Content-Type': 'application/json' },
});

export interface GlobalLeaderboardEntry {
  rank: number;
  userId: string;
  totalPoints: number;
}

export interface TerritoryLeaderboardEntry {
  rank: number;
  userId: string;
  winCount: number;
  lastWonAt: string;
}

export interface UserStats {
  balance: number;
  streak: number;
  lastUploadDate: string | null;
}

export interface LedgerEntry {
  id: string;
  delta: number;
  reason: string;
  territoryId: string | null;
  createdAt: string;
}

export const profileApi = {
  /** Global top-50 by total points (from economy-service ledger) */
  async getGlobalLeaderboard(): Promise<GlobalLeaderboardEntry[]> {
    const { data } = await economyClient.get<{ leaderboard: GlobalLeaderboardEntry[] }>(
      '/leaderboard'
    );
    return data.leaderboard;
  },

  /** Top-10 win counts for a specific territory */
  async getTerritoryLeaderboard(territoryId: string): Promise<TerritoryLeaderboardEntry[]> {
    const { data } = await profileClient.get<{ leaderboard: TerritoryLeaderboardEntry[] }>(
      `/leaderboard/territory/${territoryId}`
    );
    return data.leaderboard;
  },

  /** Balance + streak for the current user */
  async getUserStats(token: string): Promise<UserStats> {
    const { data } = await economyClient.get<UserStats>('/stats', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return data;
  },

  /** Recent ledger entries for the current user */
  async getLedger(token: string, limit = 20): Promise<LedgerEntry[]> {
    const { data } = await economyClient.get<{ entries: LedgerEntry[] }>(`/ledger?limit=${limit}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return data.entries;
  },

  /** Resolve a list of user IDs to { id → username } map */
  async lookupUsernames(ids: string[]): Promise<Record<string, string>> {
    if (ids.length === 0) return {};
    const { data } = await authClient.get<{ users: { id: string; username: string }[] }>(
      `/users/lookup?ids=${ids.join(',')}`
    );
    return Object.fromEntries(data.users.map((u) => [u.id, u.username]));
  },
};
