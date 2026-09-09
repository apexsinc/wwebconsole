import { activateYearlySubscription } from './billing';
import { getSetting } from './settings';
import type { Env, StationRow, UserRow } from './types';

const POLAR_API_BASE = 'https://api.polar.sh/v1';

export async function getPolarToken(env: Env): Promise<string> {
  const token = env.POLAR_ACCESS_TOKEN || (await getSetting(env, 'polar_access_token'));
  return (token || '').trim();
}

export async function getPolarProductId(env: Env, token: string): Promise<string> {
  const configured = env.POLAR_PRODUCT_ID || (await getSetting(env, 'polar_product_id'));
  if (configured && configured.trim()) {
    return configured.trim();
  }

  // Auto-discover the first active product from the organization's catalog
  const res = await fetch(`${POLAR_API_BASE}/products/?is_archived=false`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Failed to list Polar products (${res.status}): ${errText}`);
  }

  const data = (await res.json().catch(() => ({}))) as { items?: Array<{ id: string; name?: string }> };
  const products = data.items || [];
  if (products.length === 0) {
    throw new Error('No active Polar products found. Please create a Console Pro product in your Polar dashboard.');
  }

  // Prefer a product with "pro" or "console" in the name, or default to the first one
  const matched =
    products.find((p) => /pro|console|subscription/i.test(p.name || '')) || products[0];
  return matched.id;
}

export interface CreateCheckoutResult {
  ok: boolean;
  checkoutUrl: string;
  checkoutId: string;
}

/**
 * Creates a Polar.sh checkout session for upgrading an account/device to Console Pro.
 */
export async function createPolarCheckoutSession(
  env: Env,
  user: UserRow,
  station: StationRow,
  appUrl: string
): Promise<CreateCheckoutResult> {
  const token = await getPolarToken(env);
  if (!token) {
    throw new Error('POLAR_ACCESS_TOKEN is not configured on this server.');
  }

  const productId = await getPolarProductId(env, token);

  const cleanAppUrl = (appUrl || env.APP_URL || 'https://wwebconsole.com').replace(/\/+$/, '');
  const successUrl = `${cleanAppUrl}/app?checkout=success&checkout_id={CHECKOUT_ID}`;

  const payload = {
    product_id: productId,
    customer_email: user.email,
    customer_name: user.name || undefined,
    customer_metadata: {
      userId: user.id,
      stationId: station.id,
    },
    metadata: {
      userId: user.id,
      stationId: station.id,
      userEmail: user.email,
    },
    success_url: successUrl,
  };

  const res = await fetch(`${POLAR_API_BASE}/checkouts/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => '');
    throw new Error(`Polar checkout creation failed (${res.status}): ${errorBody}`);
  }

  const session = (await res.json()) as { id: string; url: string };
  if (!session.url) {
    throw new Error('Polar returned an invalid checkout session without a URL.');
  }

  return {
    ok: true,
    checkoutUrl: session.url,
    checkoutId: session.id,
  };
}

/**
 * Fetches checkout details directly from Polar API by checkout ID.
 */
export async function getPolarCheckout(env: Env, checkoutId: string) {
  const token = await getPolarToken(env);
  if (!token) throw new Error('POLAR_ACCESS_TOKEN is missing');

  const res = await fetch(`${POLAR_API_BASE}/checkouts/${encodeURIComponent(checkoutId)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Failed to fetch Polar checkout (${res.status}): ${errText}`);
  }

  return (await res.json()) as {
    id: string;
    status: string;
    customer_email?: string;
    metadata?: Record<string, any>;
    customer_metadata?: Record<string, any>;
    product_id?: string;
  };
}

/**
 * Verifies a completed checkout ID and activates the station's yearly Pro subscription.
 */
export async function verifyAndApplyCheckout(
  env: Env,
  checkoutId: string,
  currentUser?: UserRow
) {
  const checkout = await getPolarCheckout(env, checkoutId);

  // Valid statuses for a completed checkout: 'confirmed', 'succeeded'
  const isConfirmed = checkout.status === 'confirmed' || checkout.status === 'succeeded';
  if (!isConfirmed) {
    return {
      ok: false,
      status: checkout.status,
      message: `Checkout status is '${checkout.status}'. Payment has not yet completed.`,
    };
  }

  const meta = { ...(checkout.customer_metadata || {}), ...(checkout.metadata || {}) };
  let stationId = meta.stationId as string | undefined;
  const userId = (meta.userId as string | undefined) || currentUser?.id;

  if (!stationId && userId) {
    const station = await env.DB.prepare('SELECT id FROM stations WHERE user_id = ? ORDER BY created_at ASC')
      .bind(userId)
      .first<{ id: string }>();
    if (station) {
      stationId = station.id;
    }
  }

  if (!stationId) {
    throw new Error('Could not identify station associated with this checkout.');
  }

  // Activate Pro yearly subscription (+1 year from now or extends current expiry)
  await activateYearlySubscription(env, stationId, 'pro');

  return {
    ok: true,
    status: checkout.status,
    stationId,
    userId,
    message: 'Subscription successfully activated for 1 year.',
  };
}

/**
 * Handles incoming Polar webhooks for subscription or order updates.
 */
export async function handlePolarWebhook(env: Env, event: any) {
  const type = event?.type;
  const data = event?.data;

  if (!type || !data) {
    return { ok: false, reason: 'Invalid event payload' };
  }

  let stationId = data?.metadata?.stationId || data?.customer_metadata?.stationId;
  const userId = data?.metadata?.userId || data?.customer_metadata?.userId;
  const customerEmail = data?.customer_email || data?.customer?.email;

  if (!stationId && (userId || customerEmail)) {
    let stationQuery = null;
    if (userId) {
      stationQuery = await env.DB.prepare('SELECT id FROM stations WHERE user_id = ? ORDER BY created_at ASC')
        .bind(userId)
        .first<{ id: string }>();
    } else if (customerEmail) {
      stationQuery = await env.DB.prepare(
        'SELECT s.id FROM stations s JOIN users u ON s.user_id = u.id WHERE LOWER(u.email) = LOWER(?) ORDER BY s.created_at ASC'
      )
        .bind(customerEmail)
        .first<{ id: string }>();
    }
    if (stationQuery) {
      stationId = stationQuery.id;
    }
  }

  if (
    type === 'checkout.updated' &&
    (data.status === 'confirmed' || data.status === 'succeeded') &&
    stationId
  ) {
    await activateYearlySubscription(env, stationId, 'pro');
    return { ok: true, action: 'activated', stationId };
  }

  if (
    (type === 'order.created' || type === 'subscription.created' || type === 'subscription.active') &&
    stationId
  ) {
    await activateYearlySubscription(env, stationId, 'pro');
    return { ok: true, action: 'activated', stationId };
  }

  return { ok: true, action: 'ignored', type };
}
