import axios from 'axios';
import type { Territory } from '@feastfite/shared';

const client = axios.create({
  baseURL: '/api/territory',
  headers: { 'Content-Type': 'application/json' },
});

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

/** [minLng, minLat, maxLng, maxLat] — matches the bbox query param format */
export type BBox = [number, number, number, number];

export interface ClaimResult {
  claimed: boolean;
  /** Present when a vote session was started instead of direct claim */
  voteSessionId?: string;
}

export interface BatteringRamResult {
  success: boolean;
  /** Present when a shop item was consumed */
  itemUsed?: string;
}

export interface MySubmission {
  id: string;
  territoryId: string;
  territoryName: string;
  claimantId: string;
  claimantName: string;
  photoKey: string | null;
  isWinner: boolean;
  avgRating: number | null;
  voteCount: number;
  totalRating: number;
  sessionId: string | null;
  claimedAt: string;
}

export interface ClaimHistoryEntry {
  id: string;
  claimantId: string;
  claimantName: string;
  photoKey: string | null;
  isWinner: boolean;
  avgRating: number | null;
  voteCount: number;
  totalRating: number;
  sessionId: string | null;
  claimedAt: string;
}

export const territoryApi = {
  /** Fetch all territories whose polygon intersects the given bounding box */
  async getByBbox(bbox: BBox): Promise<Territory[]> {
    const { data } = await client.get<Territory[]>('/territories', {
      params: { bbox: bbox.join(',') },
    });
    return data;
  },

  async getById(id: string): Promise<Territory> {
    const { data } = await client.get<Territory>(`/territories/${id}`);
    return data;
  },

  /** Claim a territory — direct claim if uncontested, starts vote session if already owned */
  async claim(
    id: string,
    token: string,
    body?: { photoKey?: string; displayName?: string },
  ): Promise<ClaimResult> {
    const { data } = await client.post<ClaimResult>(
      `/territories/${id}/claim`,
      body ?? {},
      { headers: authHeader(token) },
    );
    return data;
  },

  /** Photo submission history for a territory */
  async getHistory(id: string): Promise<ClaimHistoryEntry[]> {
    const { data } = await client.get<{ history: ClaimHistoryEntry[] }>(
      `/territories/${id}/history`,
    );
    return data.history;
  },

  /** Territories owned by the current user (requires auth token) */
  async getOwned(token: string): Promise<Territory[]> {
    const { data } = await client.get<Territory[]>('/territories/owned', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return data;
  },

  /** All submissions by the current user across all territories */
  async getMySubmissions(token: string): Promise<MySubmission[]> {
    const { data } = await client.get<{ submissions: MySubmission[] }>('/territories/my-history', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return data.submissions ?? [];
  },

  /** Use a Battering Ram from inventory (buy in shop first) to break a lock */
  async batteringRam(id: string, token: string): Promise<BatteringRamResult> {
    const { data } = await client.post<BatteringRamResult>(
      `/territories/${id}/battering-ram`,
      {},
      { headers: authHeader(token) },
    );
    return data;
  },

  /** Use a Territory Shield from inventory to lock an owned territory for 12h */
  async applyShield(id: string, token: string): Promise<{ success: boolean; itemUsed: string }> {
    const { data } = await client.post<{ success: boolean; itemUsed: string }>(
      `/territories/${id}/shield`,
      {},
      { headers: authHeader(token) },
    );
    return data;
  },
};
