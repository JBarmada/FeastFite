import axios from 'axios';
import type { User } from '@feastfite/shared';

// withCredentials ensures the httpOnly refresh-token cookie is
// sent on every request, including /refresh on page reload.
const client = axios.create({
  baseURL: '/api/auth',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
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

  /** Called on page reload to silently re-issue an access token using the httpOnly cookie. */
  async refresh(): Promise<AuthResponse> {
    const { data } = await client.post<AuthResponse>('/refresh');
    return data;
  },

  async logout(): Promise<void> {
    await client.post('/logout');
  },

  async me(token: string): Promise<User> {
    const { data } = await client.get<User>('/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return data;
  },

  async forgotPassword(email: string): Promise<void> {
    await client.post('/forgot-password', { email });
  },
};
