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
  pointsDeducted?: number;
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

  /** Claim a territory — starts a vote session if already owned, direct claim if uncontested */
  async claim(id: string, token: string): Promise<ClaimResult> {
    const { data } = await client.post<ClaimResult>(
      `/territories/${id}/claim`,
      {},
      { headers: authHeader(token) },
    );
    return data;
  },

  /** Spend battering-ram points to break a lock on a territory */
  async batteringRam(id: string, token: string): Promise<BatteringRamResult> {
    const { data } = await client.post<BatteringRamResult>(
      `/territories/${id}/battering-ram`,
      {},
      { headers: authHeader(token) },
    );
    return data;
  },
};
