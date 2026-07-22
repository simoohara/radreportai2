// Shared types for the frontend

export interface User {
  id: number;
  email: string;
  display_name: string | null;
  role: 'user' | 'admin';
  created_at: string;
  generations_used: number;
  generations_remaining: number | null;
  transcriptions_used: number;
  transcriptions_remaining: number | null;
  subscription_plan: string | null;
  subscription_expires_at: string | null;
  lemonsqueezy_subscription_id: string | null;
  referral_code: string | null;
  referral_points: number;
  custom_keywords: string | null;
}

export interface Template {
  id: number;
  user_id: number | null;
  modality: string;
  name: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface Feedback {
  id: number;
  user_id: number;
  type: 'suggestion' | 'bug' | 'question' | 'billing' | 'other';
  subject: string;
  content: string;
  status: 'new' | 'in_progress' | 'resolved';
  is_archived: number;
  created_at: string;
  // Admin view additions
  display_name?: string;
  email?: string;
}

export type EditLevel = 'prudent' | 'equilibre' | 'ameliore';

export const MODALITIES = ['Radio', 'TDM', 'IRM', 'Écho'] as const;
export type Modality = (typeof MODALITIES)[number];

export const EDIT_LEVEL_LABELS: Record<EditLevel, string> = {
  prudent: 'Prudent',
  equilibre: 'Équilibré',
  ameliore: 'Amélioré',
};

export const FEEDBACK_TYPE_LABELS: Record<string, string> = {
  suggestion: 'Suggestion',
  bug: 'Bug',
  question: 'Question',
  billing: 'Facturation',
  other: 'Autre',
};

export const STATUS_LABELS: Record<string, string> = {
  new: 'Nouveau',
  in_progress: 'En cours',
  resolved: 'Résolu',
};

export interface AdminUser {
  id: number;
  email: string;
  display_name: string | null;
  role: 'user' | 'admin';
  created_at: string;
  generations_used: number;
  generations_remaining: number | null;
  transcriptions_used: number;
  transcriptions_remaining: number | null;
  subscription_plan: string | null;
  subscription_expires_at: string | null;
  referral_code: string | null;
  referral_points: number;
  deleted_at: string | null;
}
