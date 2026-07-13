import { create } from 'zustand';
import type { User } from '../types';
import { api, setToken, clearToken } from '../services/api';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  checkAuth: () => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (partial: Partial<User>) => void;
  handleTokenFromUrl: () => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  /**
   * Check for token in URL (after OAuth/magic link redirect),
   * or use existing token in localStorage.
   */
  handleTokenFromUrl: () => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const error = params.get('error');

    if (error) {
      console.error('Auth error from server:', error);
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
      return false;
    }

    if (token) {
      setToken(token);
      // Clean URL — remove the token param
      window.history.replaceState({}, '', window.location.pathname);
      return true;
    }

    return !!localStorage.getItem('token');
  },

  checkAuth: async () => {
    const hasToken = get().handleTokenFromUrl();
    if (!hasToken) {
      set({ isLoading: false, isAuthenticated: false, user: null });
      return;
    }

    try {
      const user = await api.checkAuth();
      set({ user, isAuthenticated: true, isLoading: false });
    } catch {
      clearToken();
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  logout: async () => {
    try {
      await api.logout();
    } catch {
      // Ignore errors — we're logging out anyway
    }
    clearToken();
    set({ user: null, isAuthenticated: false });
  },

  updateUser: (partial) => {
    const current = get().user;
    if (current) {
      set({ user: { ...current, ...partial } });
    }
  },
}));
