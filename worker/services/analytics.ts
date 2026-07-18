import type { HonoEnv } from '../types';

/**
 * Hashes a string using SHA-256 algorithm via Web Crypto API.
 */
async function hashSha256(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

interface UserData {
  email?: string;
  ip?: string;
  userAgent?: string;
}

/**
 * Sends a server-side event to the Facebook Conversions API.
 */
export async function sendFacebookEvent(
  env: HonoEnv['Bindings'],
  eventName: string,
  userData: UserData,
  customData: Record<string, any> = {},
  eventSourceUrl: string = 'https://radreportai2.simoohara.workers.dev'
) {
  const { FACEBOOK_PIXEL_ID, FACEBOOK_ACCESS_TOKEN } = env;

  if (!FACEBOOK_PIXEL_ID || !FACEBOOK_ACCESS_TOKEN) {
    console.warn('Facebook tracking is not configured. Skipping event.');
    return;
  }

  try {
    const payload = {
      data: [
        {
          event_name: eventName,
          event_time: Math.floor(Date.now() / 1000),
          action_source: 'website',
          event_source_url: eventSourceUrl,
          user_data: {
            em: userData.email ? [await hashSha256(userData.email.toLowerCase())] : undefined,
            client_ip_address: userData.ip,
            client_user_agent: userData.userAgent,
          },
          custom_data: customData,
        },
      ],
    };

    const url = `https://graph.facebook.com/v19.0/${FACEBOOK_PIXEL_ID}/events?access_token=${FACEBOOK_ACCESS_TOKEN}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const responseData = await response.json();
      console.error('Facebook API Error:', responseData);
    } else {
      console.log(`Successfully sent Facebook event: ${eventName}`);
    }
  } catch (error) {
    console.error('Failed to send event to Facebook Conversions API:', error);
  }
}

/**
 * Sends a server-side event to the Google Analytics 4 Measurement Protocol.
 */
export async function sendGAEvent(
  env: HonoEnv['Bindings'],
  eventName: string,
  eventParams: Record<string, any> = {},
  userId?: number
) {
  const { GA_MEASUREMENT_ID, GA_API_SECRET } = env;

  if (!GA_MEASUREMENT_ID || !GA_API_SECRET) {
    console.warn('Google Analytics server-side tracking is not configured. Skipping event.');
    return;
  }

  if (!userId) {
    console.warn('GA4 server event skipped: User ID is required.');
    return;
  }

  try {
    // Generate a random client_id as a fallback
    const randomCid = `${Date.now()}.${Math.random().toString(36).substring(2)}`;

    const payload = {
      user_id: String(userId),
      client_id: randomCid,
      events: [
        {
          name: eventName,
          params: {
            session_id: 'server_session',
            engagement_time_msec: '100',
            ...eventParams,
          },
        },
      ],
    };

    const url = `https://www.google-analytics.com/mp/collect?measurement_id=${GA_MEASUREMENT_ID}&api_secret=${GA_API_SECRET}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Google Analytics API Error (${response.status}):`, errorText);
    } else {
      console.log(`Successfully sent GA4 event: ${eventName} for user ${userId}`);
    }
  } catch (error) {
    console.error('Failed to send event to Google Analytics Measurement Protocol:', error);
  }
}
