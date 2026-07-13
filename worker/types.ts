export interface Env {
  DB: D1Database;
  API_KEY: string;
  SESSION_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  CLIENT_URL: string;
  SERVER_URL: string;
  RESEND_API: string;
  LEMONSQUEEZY_API_KEY: string;
  LEMONSQUEEZY_STORE_ID: string;
  LEMONSQUEEZY_WEBHOOK_SECRET: string;
  LEMONSQUEEZY_VARIANT_ID_STANDARD_MONTHLY: string;
  LEMONSQUEEZY_VARIANT_ID_STANDARD_YEARLY: string;
  LEMONSQUEEZY_VARIANT_ID_PRO_MONTHLY: string;
  LEMONSQUEEZY_VARIANT_ID_PRO_YEARLY: string;
  LEMONSQUEEZY_VARIANT_ID_ELITE_MONTHLY: string;
  LEMONSQUEEZY_VARIANT_ID_ELITE_YEARLY: string;
  FACEBOOK_PIXEL_ID: string;
  FACEBOOK_ACCESS_TOKEN: string;
  GA_MEASUREMENT_ID: string;
  GA_API_SECRET: string;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_CHAT_ID: string;
}

export interface User {
  id: number;
  google_id: string | null;
  email: string;
  display_name: string | null;
  role: 'user' | 'admin';
  created_at: string;
  generations_used: number;
  generations_remaining: number | null;
  subscription_plan: string | null;
  subscription_expires_at: string | null;
  lemonsqueezy_subscription_id: string | null;
  referrer_id: number | null;
  referral_code: string | null;
  referral_points: number;
  deleted_at: string | null;
}

export interface HonoEnv {
  Bindings: Env;
  Variables: {
    user: User;
    sessionId: string;
  };
}
