import axios from 'axios';
import type { User } from '@feastfite/shared';

const client = axios.create({
  baseURL: '/api/auth',
  headers: { 'Content-Type': 'application/json' },
});

interface AuthResponse {
  user: User;
  token: string;
}

export const authApi = {
  async login(email: string, password: string): Promise<AuthResponse> {
    const { data } = await client.post<AuthResponse>('/login', { email, password });
    return data;
  },

  async register(email: string, username: string, password: string): Promise<AuthResponse> {
    const { data } = await client.post<AuthResponse>('/register', { email, username, password });
    return data;
  },

  async me(token: string): Promise<User> {
    const { data } = await client.get<User>('/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return data;
  },
};
