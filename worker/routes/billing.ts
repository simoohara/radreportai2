import { Hono } from 'hono';
import type { HonoEnv } from '../types';
import { isAuthenticated } from '../middleware/auth';
import { billingLimiter } from '../middleware/rateLimit';

const app = new Hono<HonoEnv>();

/** Map frontend plan IDs to env var keys */
function getVariantId(env: HonoEnv['Bindings'], planId: string): string | undefined {
  const map: Record<string, string | undefined> = {
    standard_monthly: env.LEMONSQUEEZY_VARIANT_ID_STANDARD_MONTHLY,
    standard_yearly: env.LEMONSQUEEZY_VARIANT_ID_STANDARD_YEARLY,
    pro_monthly: env.LEMONSQUEEZY_VARIANT_ID_PRO_MONTHLY,
    pro_yearly: env.LEMONSQUEEZY_VARIANT_ID_PRO_YEARLY,
    elite_monthly: env.LEMONSQUEEZY_VARIANT_ID_ELITE_MONTHLY,
    elite_yearly: env.LEMONSQUEEZY_VARIANT_ID_ELITE_YEARLY,
  };
  return map[planId];
}

/**
 * POST /api/billing/create-checkout-session
 * Creates a LemonSqueezy checkout and returns the URL for the overlay.
 */
app.post('/billing/create-checkout-session', isAuthenticated, billingLimiter, async (c) => {
  const { planId } = await c.req.json<{ planId: string }>();
  const env = c.env;
  const user = c.get('user');

  const variantId = getVariantId(env, planId);
  if (!variantId) {
    return c.json({ error: 'Invalid plan ID' }, 400);
  }

  if (!env.LEMONSQUEEZY_API_KEY || !env.LEMONSQUEEZY_STORE_ID) {
    return c.json({ error: 'Billing service not configured.' }, 500);
  }

  try {
    const response = await fetch('https://api.lemonsqueezy.com/v1/checkouts', {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.api+json',
        'Content-Type': 'application/vnd.api+json',
        Authorization: `Bearer ${env.LEMONSQUEEZY_API_KEY}`,
      },
      body: JSON.stringify({
        data: {
          type: 'checkouts',
          attributes: {
            test_mode: env.LEMONSQUEEZY_TEST_MODE === 'true',
            checkout_data: {
              email: user.email,
              custom: {
                user_id: String(user.id),
              },
            },
          },
          relationships: {
            store: {
              data: { type: 'stores', id: env.LEMONSQUEEZY_STORE_ID },
            },
            variant: {
              data: { type: 'variants', id: variantId },
            },
          },
        },
      }),
    });
    
    console.log(`Attempting checkout with Store ID: ${env.LEMONSQUEEZY_STORE_ID}, Variant ID: ${variantId}, Test Mode: ${env.LEMONSQUEEZY_TEST_MODE === 'true'}`);

    if (!response.ok) {
      const errorBody = await response.json();
      console.error('LemonSqueezy API error:', JSON.stringify(errorBody, null, 2));
      throw new Error('Failed to create checkout session with LemonSqueezy.');
    }

    const checkout = (await response.json()) as any;
    return c.json({ url: checkout.data.attributes.url });
  } catch (error) {
    console.error('Checkout creation error:', error);
    return c.json({ error: 'Failed to create checkout session.' }, 500);
  }
});

/**
 * GET /api/billing/manage-url
 * Returns the LemonSqueezy customer portal URL for the user's active subscription.
 */
app.get('/billing/manage-url', isAuthenticated, billingLimiter, async (c) => {
  const user = c.get('user');
  const env = c.env;

  if (!user.lemonsqueezy_subscription_id) {
    return c.json({ error: 'Aucun abonnement actif trouvé pour cet utilisateur.' }, 404);
  }
  if (!env.LEMONSQUEEZY_API_KEY) {
    return c.json({ error: 'Le service de facturation est mal configuré.' }, 500);
  }

  try {
    const response = await fetch(
      `https://api.lemonsqueezy.com/v1/subscriptions/${user.lemonsqueezy_subscription_id}`,
      {
        method: 'GET',
        headers: {
          Accept: 'application/vnd.api+json',
          'Content-Type': 'application/vnd.api+json',
          Authorization: `Bearer ${env.LEMONSQUEEZY_API_KEY}`,
        },
      }
    );

    if (!response.ok) {
      const errorBody = await response.json();
      console.error('LemonSqueezy Customer Portal API error:', JSON.stringify(errorBody, null, 2));
      throw new Error('Failed to retrieve customer portal URL.');
    }

    const subData = (await response.json()) as any;
    const portalUrl = subData.data.attributes.urls.customer_portal;
    if (!portalUrl) {
      throw new Error('Customer portal URL not found in subscription data.');
    }
    return c.json({ url: portalUrl });
  } catch (error) {
    console.error('Billing portal URL retrieval error:', error);
    return c.json({ error: 'Impossible de récupérer le portail de facturation.' }, 500);
  }
});

export default app;
