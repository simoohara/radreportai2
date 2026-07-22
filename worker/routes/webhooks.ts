import { Hono } from 'hono';
import type { HonoEnv, User } from '../types';
import { sendFacebookEvent, sendGAEvent } from '../services/analytics';

const app = new Hono<HonoEnv>();

// ── Helpers ──────────────────────────────────────────────────────

/** Timing-safe comparison of two hex strings using Web Crypto-safe logic. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/** Compute HMAC-SHA256 hex digest using Web Crypto API (Workers-compatible). */
async function hmacSha256Hex(secret: string, data: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

interface PlanDetails {
  planName: string;
  value: number;
  currency: string;
  monthlyQuota: number | null;
}

/** Map variant IDs to plan details for subscription updates. */
function buildVariantMap(env: HonoEnv['Bindings']): Record<string, PlanDetails> {
  return {
    [env.LEMONSQUEEZY_VARIANT_ID_STANDARD_MONTHLY]: { planName: 'Standard', value: 29, currency: 'EUR', monthlyQuota: 1000 },
    [env.LEMONSQUEEZY_VARIANT_ID_STANDARD_YEARLY]: { planName: 'Standard', value: 299, currency: 'EUR', monthlyQuota: 1000 },
    [env.LEMONSQUEEZY_VARIANT_ID_PRO_MONTHLY]: { planName: 'Pro', value: 49, currency: 'EUR', monthlyQuota: 2000 },
    [env.LEMONSQUEEZY_VARIANT_ID_PRO_YEARLY]: { planName: 'Pro', value: 499, currency: 'EUR', monthlyQuota: 2000 },
    [env.LEMONSQUEEZY_VARIANT_ID_ELITE_MONTHLY]: { planName: 'Elite', value: 99, currency: 'EUR', monthlyQuota: null },
    [env.LEMONSQUEEZY_VARIANT_ID_ELITE_YEARLY]: { planName: 'Elite', value: 999, currency: 'EUR', monthlyQuota: null },
  };
}

// ── Referral Rewards ─────────────────────────────────────────────

async function grantFreeMonths(db: D1Database, user: User, months: number) {
  const hasActiveSub =
    user.subscription_plan &&
    user.subscription_expires_at &&
    new Date(user.subscription_expires_at) > new Date();

  const startDate = hasActiveSub ? new Date(user.subscription_expires_at!) : new Date();
  const newExpiryDate = new Date(startDate);
  newExpiryDate.setMonth(newExpiryDate.getMonth() + months);

  const newPlan = hasActiveSub ? user.subscription_plan : 'Pro';
  const quota = newPlan === 'Elite' ? null : (newPlan === 'Standard' ? 1000 : 2000);

  await db
    .prepare('UPDATE users SET subscription_plan = ?, subscription_expires_at = ?, generations_remaining = ?, transcriptions_remaining = ? WHERE id = ?')
    .bind(newPlan, newExpiryDate.toISOString(), quota, newPlan === 'Elite' || newPlan === 'Standard' || newPlan === 'Pro' ? null : 50, user.id)
    .run();

  console.log(
    `Referral Reward: Granted ${months} month(s) of ${newPlan} to user ${user.id}. New expiry: ${newExpiryDate.toISOString()}`
  );
}

async function handleReferralPoints(db: D1Database, newlySubscribedUserId: number) {
  const row = await db
    .prepare('SELECT referrer_id FROM users WHERE id = ?')
    .bind(newlySubscribedUserId)
    .first<{ referrer_id: number | null }>();

  if (!row?.referrer_id) return;

  const referrerId = row.referrer_id;

  // Increment referral points
  await db
    .prepare('UPDATE users SET referral_points = referral_points + 1 WHERE id = ?')
    .bind(referrerId)
    .run();

  // Re-fetch to check threshold
  const referrer = await db
    .prepare('SELECT * FROM users WHERE id = ?')
    .bind(referrerId)
    .first<User>();

  if (!referrer) return;

  if (referrer.referral_points >= 5) {
    const rewardsToGrant = Math.floor(referrer.referral_points / 5);
    const remainingPoints = referrer.referral_points % 5;

    await grantFreeMonths(db, referrer, rewardsToGrant);

    await db
      .prepare('UPDATE users SET referral_points = ? WHERE id = ?')
      .bind(remainingPoints, referrerId)
      .run();
  }

  console.log(`Referral point awarded to user ${referrerId}.`);
}

// ── Subscription Update ──────────────────────────────────────────

async function updateUserSubscription(
  db: D1Database,
  env: HonoEnv['Bindings'],
  userId: number,
  lsSubscriptionObject: any
) {
  console.log('Webhook Log: Attempting to update subscription for User ID:', userId);

  const attrs = lsSubscriptionObject.attributes;
  const subscriptionId = lsSubscriptionObject.id;
  const variantId = String(attrs.variant_id);
  const status: string = attrs.status;

  // Determine expiry date
  let expiryDateString: string | null = null;
  if (status === 'on_trial') {
    expiryDateString = attrs.trial_ends_at;
    console.log(`Webhook Log: Subscription on trial. Expiry: ${expiryDateString}`);
  } else if (status === 'active') {
    expiryDateString = attrs.renews_at;
    console.log(`Webhook Log: Subscription active. Expiry: ${expiryDateString}`);
  }

  const variantMap = buildVariantMap(env);
  const planDetails = variantMap[variantId];
  if (!planDetails) {
    console.error(`Webhook Error: No plan details for variantId: ${variantId}.`);
    throw new Error(`Invalid variantId: ${variantId}`);
  }

  if (status !== 'active' && status !== 'on_trial') {
    console.log(
      `Webhook Log: Subscription ${subscriptionId} has non-actionable status '${status}'. Skipping.`
    );
    return;
  }

  const newExpiryDate = expiryDateString ? new Date(expiryDateString) : null;
  if (!newExpiryDate || isNaN(newExpiryDate.getTime())) {
    console.error(
      `Webhook Error: Invalid expiry date for user ${userId}. Status: ${status}, trial_ends_at: ${attrs.trial_ends_at}, renews_at: ${attrs.renews_at}`
    );
    throw new Error('Subscription data missing a valid expiry date.');
  }

  await db
    .prepare(
      'UPDATE users SET subscription_plan = ?, subscription_expires_at = ?, lemonsqueezy_subscription_id = ?, generations_remaining = ?, transcriptions_remaining = ? WHERE id = ?'
    )
    .bind(planDetails.planName, newExpiryDate.toISOString(), subscriptionId, planDetails.monthlyQuota, null, userId)
    .run();

  console.log(
    `Webhook Log: SUCCESS! User ${userId} → ${planDetails.planName}. Sub ID: ${subscriptionId}. Expiry: ${newExpiryDate.toISOString()}`
  );

  // Award referral points
  await handleReferralPoints(db, userId);

  return planDetails;
}

// ── Webhook Route ────────────────────────────────────────────────

const ACTIONABLE_EVENTS = [
  'order_created',
  'subscription_created',
  'subscription_updated',
  'subscription_payment_success',
];

/**
 * POST /api/webhooks/lemonsqueezy
 * Handle LemonSqueezy subscription webhooks.
 * This route is NOT behind isAuthenticated — webhooks come from LemonSqueezy servers.
 */
app.post('/webhooks/lemonsqueezy', async (c) => {
  const env = c.env;
  const secret = env.LEMONSQUEEZY_WEBHOOK_SECRET;

  if (!secret) {
    console.error('Webhook Error: LEMONSQUEEZY_WEBHOOK_SECRET is not set.');
    return c.json({ error: 'Webhook secret not configured.' }, 500);
  }

  // Read raw body for HMAC verification
  const rawBody = await c.req.text();

  // Verify signature
  const digest = await hmacSha256Hex(secret, rawBody);
  const signature = c.req.header('X-Signature') || '';

  if (!timingSafeEqual(digest, signature)) {
    console.warn('Webhook Warning: Invalid LemonSqueezy webhook signature.');
    return c.json({ error: 'Invalid signature' }, 400);
  }

  const payload = JSON.parse(rawBody);
  const eventName: string = payload.meta.event_name;
  console.log(`Webhook Log: Received and validated event '${eventName}'.`);

  if (!ACTIONABLE_EVENTS.includes(eventName)) {
    console.log(`Webhook Log: Ignoring non-actionable event '${eventName}'.`);
    return c.json({ message: 'OK (ignored)' }, 200);
  }

  const db = env.DB;

  try {
    let subscriptionObject: any = null;

    if (eventName === 'order_created') {
      // For order_created, fetch the related subscription object from LemonSqueezy API
      const subscriptionsUrl =
        payload.data?.relationships?.subscriptions?.links?.related;
      if (!subscriptionsUrl) {
        console.warn(
          "Webhook Log: 'order_created' event has no subscription URL. Ignoring."
        );
        return c.json({ message: 'OK (ignored, no subscription link)' }, 200);
      }

      console.log(
        `Webhook Log: 'order_created'. Fetching subscription details from ${subscriptionsUrl}`
      );
      const response = await fetch(subscriptionsUrl, {
        method: 'GET',
        headers: {
          Accept: 'application/vnd.api+json',
          'Content-Type': 'application/vnd.api+json',
          Authorization: `Bearer ${env.LEMONSQUEEZY_API_KEY}`,
        },
      });

      if (!response.ok) {
        const errorBody = await response.json();
        console.error('LemonSqueezy API fetch error:', JSON.stringify(errorBody, null, 2));
        throw new Error('Failed to fetch subscription details from LemonSqueezy API.');
      }

      const subData = (await response.json()) as any;
      if (subData.data && subData.data.length > 0) {
        subscriptionObject = subData.data[0];
        console.log(
          `Webhook Log: Fetched subscription object ID ${subscriptionObject.id}.`
        );
      } else {
        console.warn(
          'Webhook Log: Fetched subscription URL but no data returned. Ignoring.'
        );
      }
    } else {
      subscriptionObject = payload.data;
    }

    if (!subscriptionObject) {
      console.error(
        `Webhook Log: Could not resolve subscription object for event ${eventName}. Ignoring.`
      );
      return c.json({ message: 'OK (ignored, subscription object not found)' }, 200);
    }

    // Identify user — first by custom_data.user_id, then by email
    let userId: number | null = null;

    const customUserId = payload.meta?.custom_data?.user_id;
    if (customUserId) {
      const parsedUserId = parseInt(customUserId, 10);
      if (!isNaN(parsedUserId)) {
        const row = await db
          .prepare('SELECT id FROM users WHERE id = ?')
          .bind(parsedUserId)
          .first<{ id: number }>();
        if (row) {
          userId = row.id;
          console.log(`Webhook Log: User identified as ID ${userId} via custom_data.`);
        }
      }
    }

    if (!userId) {
      const email =
        subscriptionObject.attributes.user_email ||
        payload.data.attributes.user_email;
      if (email) {
        console.log(`Webhook Log: Falling back to email identification: ${email}`);
        const row = await db
          .prepare('SELECT id FROM users WHERE email = ?')
          .bind(email)
          .first<{ id: number }>();
        if (row) {
          userId = row.id;
          console.log(`Webhook Log: User identified as ID ${userId} via email.`);
        }
      }
    }

    if (!userId) {
      console.warn('Webhook Log: Could not match webhook to any user. Ignoring.');
      return c.json({ message: 'OK (ignored, user not found)' }, 200);
    }

    const planDetails = await updateUserSubscription(db, env, userId, subscriptionObject);

    if (planDetails && eventName === 'subscription_payment_success') {
      const email = subscriptionObject.attributes.user_email || payload.data.attributes.user_email;
      const total = subscriptionObject.attributes.total || 0;
      const value = total > 0 ? total / 100 : 0; // LemonSqueezy total is in cents

      c.executionCtx.waitUntil(
        Promise.all([
          sendFacebookEvent(env, 'Subscribe', { email }, { currency: 'EUR', value, plan: planDetails.planName }, c.req.url),
          sendGAEvent(env, 'purchase', { currency: 'EUR', value, plan: planDetails.planName, transaction_id: subscriptionObject.id }, userId),
        ])
      );
    }

    return c.json({ message: 'OK (processed)' }, 200);
  } catch (error) {
    console.error(`Webhook Error processing event ${eventName}:`, error);
    return c.json({ error: 'Internal Server Error' }, 500);
  }
});

export default app;
