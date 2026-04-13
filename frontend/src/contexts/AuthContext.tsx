import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { User } from '@feastfite/shared';
import { authApi } from '../api/authApi';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  register: (email: string, username: string, password: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: false,
  });

  const login = useCallback(async (email: string, password: string) => {
    setState((s) => ({ ...s, isLoading: true }));
    try {
      const { user, token } = await authApi.login(email, password);
      setState({ user, token, isAuthenticated: true, isLoading: false });
    } catch (err) {
      setState((s) => ({ ...s, isLoading: false }));
      throw err;
    }
  }, []);

  const logout = useCallback(() => {
    setState({ user: null, token: null, isAuthenticated: false, isLoading: false });
  }, []);

  const register = useCallback(async (email: string, username: string, password: string) => {
    setState((s) => ({ ...s, isLoading: true }));
    try {
      const { user, token } = await authApi.register(email, username, password);
      setState({ user, token, isAuthenticated: true, isLoading: false });
    } catch (err) {
      setState((s) => ({ ...s, isLoading: false }));
      throw err;
    }
  }, []);

  const value = useMemo(
    () => ({ ...state, login, logout, register }),
    [state, login, logout, register]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
