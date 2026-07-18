import type { User, Template, Feedback, EditLevel, AdminUser } from '../types';

const API_BASE = '';  // Same origin — Cloudflare Vite plugin handles routing

class SessionTerminatedError extends Error {
  constructor() {
    super('Session terminated');
    this.name = 'SessionTerminatedError';
  }
}

function getToken(): string | null {
  return localStorage.getItem('token');
}

export function setToken(token: string) {
  localStorage.setItem('token', token);
}

export function clearToken() {
  localStorage.removeItem('token');
}

async function fetchWithAuth<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Only set Content-Type for JSON bodies
  if (options.body && typeof options.body === 'string') {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    const data = await response.json().catch(() => ({})) as Record<string, string>;
    if (data.error === 'Session terminated') {
      clearToken();
      throw new SessionTerminatedError();
    }
    clearToken();
    throw new Error(data.error || 'Not authenticated');
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({})) as Record<string, string>;
    throw new Error(data.error || `HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
}

// ─── API Service ────────────────────────────────────────

export const api = {
  // ─── Auth ───────────────────────────────────────────
  checkAuth: () => fetchWithAuth<User>('/api/me'),

  logout: () => fetchWithAuth<{ message: string }>('/auth/logout', { method: 'POST' }),

  requestMagicLink: (email: string) =>
    fetchWithAuth<{ message: string }>('/auth/magiclink', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  // ─── User ───────────────────────────────────────────
  updateProfile: (display_name: string) =>
    fetchWithAuth<{ display_name: string }>('/api/me/profile', {
      method: 'PUT',
      body: JSON.stringify({ display_name }),
    }),

  updateKeywords: (custom_keywords: string | null) =>
    fetchWithAuth<{ custom_keywords: string | null }>('/api/me/keywords', {
      method: 'PUT',
      body: JSON.stringify({ custom_keywords }),
    }),

  deleteAccount: () =>
    fetchWithAuth<{ message: string }>('/api/me', { method: 'DELETE' }),

  // ─── Templates ──────────────────────────────────────
  getTemplates: () => fetchWithAuth<Template[]>('/api/templates'),

  createTemplate: (data: { name: string; modality: string; content: string }) =>
    fetchWithAuth<Template>('/api/templates', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateTemplate: (id: number, data: { name?: string; content?: string; modality?: string }) =>
    fetchWithAuth<Template>(`/api/templates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteTemplate: (id: number) =>
    fetchWithAuth<{ message: string }>(`/api/templates/${id}`, { method: 'DELETE' }),

  // ─── AI ─────────────────────────────────────────────
  generate: (data: { template: string; notes: string; editLevel: EditLevel; modality?: string }) =>
    fetchWithAuth<{ text: string }>('/api/generate', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  summarize: (reportContent: string) =>
    fetchWithAuth<{ text: string }>('/api/summarize-report', {
      method: 'POST',
      body: JSON.stringify({ reportContent }),
    }),

  transcribe: (audioData: string, mimeType: string, keywords?: string) =>
    fetchWithAuth<{ transcription: string }>('/api/transcribe', {
      method: 'POST',
      body: JSON.stringify({ audioData, mimeType, keywords }),
    }),

  generateNormalTemplate: (data: {
    modality: string;
    region: string;
    gender?: string;
    laterality?: string;
    indication?: string;
  }) =>
    fetchWithAuth<{ content: string }>('/api/generate-normal-template', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // ─── Feedback ───────────────────────────────────────
  getFeedback: () => fetchWithAuth<Feedback[]>('/api/feedback'),

  submitFeedback: (data: { type: string; subject: string; content: string }) =>
    fetchWithAuth<Feedback>('/api/feedback', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateFeedback: (id: number, data: { type?: string; subject?: string; content?: string }) =>
    fetchWithAuth<Feedback>(`/api/feedback/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteFeedback: (id: number) =>
    fetchWithAuth<{ message: string }>(`/api/feedback/${id}`, { method: 'DELETE' }),

  // ─── Billing ────────────────────────────────────────
  createCheckout: (planId: string) =>
    fetchWithAuth<{ url: string }>('/api/billing/create-checkout-session', {
      method: 'POST',
      body: JSON.stringify({ planId }),
    }),

  getManageUrl: () =>
    fetchWithAuth<{ url: string }>('/api/billing/manage-url'),

  // ─── Admin ──────────────────────────────────────────
  getAdminStats: () =>
    fetchWithAuth<{
      totalUsers: number;
      activeSubscribers: number;
      totalTemplates: number;
      totalGenerations: number;
      feedback: { new: number; in_progress: number; resolved: number };
    }>('/api/admin/stats'),

  getAdminFeedback: (includeArchived = false) =>
    fetchWithAuth<Feedback[]>(`/api/admin/feedback?includeArchived=${includeArchived}`),

  updateFeedbackStatus: (id: number, status: string) =>
    fetchWithAuth<{ message: string }>(`/api/admin/feedback/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    }),

  toggleFeedbackArchive: (id: number) =>
    fetchWithAuth<{ is_archived: boolean }>(`/api/admin/feedback/${id}/archive`, {
      method: 'PUT',
    }),

  deleteAdminFeedback: (id: number) =>
    fetchWithAuth<{ message: string }>(`/api/admin/feedback/${id}`, { method: 'DELETE' }),

  // ─── Admin Users ───────────────────────────────────
  getAdminUsers: () =>
    fetchWithAuth<AdminUser[]>('/api/admin/users'),

  updateUserSubscription: (id: number, data: { subscription_plan: string | null; subscription_expires_at: string | null }) =>
    fetchWithAuth<{ message: string }>(`/api/admin/users/${id}/subscription`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // ─── Config ─────────────────────────────────────────
  getConfig: () =>
    fetch(`${API_BASE}/api/config`).then((r) => r.json()) as Promise<{
      facebookPixelId: string | null;
      gaMeasurementId: string | null;
    }>,
};
