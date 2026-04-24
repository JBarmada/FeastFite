import axios from 'axios';

const client = axios.create({
  baseURL: '/api/economy',
  headers: { 'Content-Type': 'application/json' },
});

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export interface ShopItemDto {
  id: string;
  name: string;
  pricePoints: number;
  itemType: string;
}

export const economyApi = {
  async getBalance(token: string): Promise<number> {
    const { data } = await client.get<{ balance: number }>('/balance', {
      headers: authHeader(token),
    });
    return data.balance;
  },

  async getShop(): Promise<{ items: ShopItemDto[] }> {
    const { data } = await client.get<{ items: ShopItemDto[] }>('/shop');
    return data;
  },

  async purchase(
    token: string,
    itemId: string
  ): Promise<{ balance: number; itemId: string }> {
    const { data } = await client.post<{ balance: number; success: boolean; itemId: string }>(
      '/shop/purchase',
      { itemId },
      { headers: authHeader(token) }
    );
    return { balance: data.balance, itemId: data.itemId };
  },

  async getInventory(token: string): Promise<{ items: { itemId: string; quantity: number }[] }> {
    const { data } = await client.get<{ items: { itemId: string; quantity: number }[] }>(
      '/inventory',
      { headers: authHeader(token) }
    );
    return data;
  },

  async getActiveBoosts(token: string): Promise<{ boosts: { itemType: string; expiresAt: string }[] }> {
    const { data } = await client.get<{ boosts: { itemType: string; expiresAt: string }[] }>(
      '/boosts/active',
      { headers: authHeader(token) }
    );
    return data;
  },

  async activateBoost(token: string, itemId: string): Promise<{ expiresAt: string }> {
    const { data } = await client.post<{ success: boolean; expiresAt: string }>(
      '/boosts/activate',
      { itemId },
      { headers: authHeader(token) }
    );
    return { expiresAt: data.expiresAt };
  },
};
