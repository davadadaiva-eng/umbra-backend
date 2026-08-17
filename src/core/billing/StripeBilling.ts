import * as crypto from 'crypto';
import { getLogger } from '../Logger';

export interface StripeBillingOptions {
  /** Stripe secret API key (sk_...). Never hard-code — read from config/env/vault. */
  secretKey: string;
  /** Webhook signing secret (whsec_...) used to verify incoming events. */
  webhookSecret: string;
  /** Stripe price id per plan tier, e.g. { pro: 'price_...', ultimate: 'price_...' }. */
  priceIds: Record<string, string>;
  /** Public base URL used for success/cancel redirects (no trailing slash). */
  publicUrl: string;
  /** Called once a checkout completes — wire to UmbraOS.activatePlan. */
  onPlanPaid: (tier: string) => Promise<unknown>;
  /** Injectable fetch for tests. */
  fetchImpl?: typeof fetch;
}

const STRIPE_API = 'https://api.stripe.com/v1';
/** Reject webhook timestamps older than this (replay protection). */
const MAX_WEBHOOK_AGE_MS = 5 * 60 * 1000;

/**
 * Minimal Stripe integration — checkout sessions + webhook verification.
 * Uses the Node 18+ global fetch and crypto's HMAC-SHA256 (Stripe's signature
 * scheme), so no npm dependency is needed.
 */
export class StripeBilling {
  private opts: StripeBillingOptions;

  constructor(opts: StripeBillingOptions) {
    this.opts = opts;
  }

  /** True when the operator has configured keys + at least one price id. */
  get enabled(): boolean {
    return !!this.opts.secretKey && !!this.opts.webhookSecret
      && Object.values(this.opts.priceIds).some(Boolean);
  }

  private fetch(url: string, init: RequestInit): Promise<Response> {
    const impl = this.opts.fetchImpl || fetch;
    return impl(url, init);
  }

  /** Create a Stripe Checkout Session for a plan tier; returns the hosted URL. */
  async createCheckoutSession(tier: string): Promise<{ url: string; sessionId: string }> {
    if (!this.enabled) {
      throw new Error('Stripe billing not configured — set billing.secretKey, billing.webhookSecret and billing.priceIds in config');
    }
    const priceId = this.opts.priceIds[tier];
    if (!priceId) throw new Error(`No Stripe price configured for plan: ${tier}`);

    const base = (this.opts.publicUrl || 'http://127.0.0.1:8787').replace(/\/+$/, '');
    const body = new URLSearchParams({
      mode: 'subscription',
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': '1',
      'metadata[tier]': tier,
      'success_url': `${base}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      'cancel_url': `${base}/billing/cancel`,
    });

    const res = await this.fetch(`${STRIPE_API}/checkout/sessions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.opts.secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });
    const json = (await res.json()) as any;
    if (!res.ok) {
      throw new Error(`Stripe checkout failed (${res.status}): ${json?.error?.message ?? JSON.stringify(json)}`);
    }
    if (!json.url) throw new Error('Stripe did not return a checkout URL');
    return { url: json.url, sessionId: json.id };
  }

  /**
   * Verify a Stripe webhook signature header (`t=...,v1=...`). Computes the
   * HMAC-SHA256 of `<timestamp>.<rawBody>` with the webhook secret and rejects
   * timestamps older than 5 minutes (replay protection).
   */
  verifySignature(rawBody: string, signatureHeader: string): boolean {
    if (!this.opts.webhookSecret || !signatureHeader) return false;
    const parts = new Map<string, string>();
    for (const item of signatureHeader.split(',')) {
      const i = item.indexOf('=');
      if (i > 0) parts.set(item.slice(0, i), item.slice(i + 1));
    }
    const timestamp = parts.get('t');
    const expected = parts.get('v1');
    if (!timestamp || !expected) return false;
    if (Math.abs(Date.now() / 1000 - Number(timestamp)) > MAX_WEBHOOK_AGE_MS / 1000) return false;

    const digest = crypto.createHmac('sha256', this.opts.webhookSecret)
      .update(`${timestamp}.${rawBody}`)
      .digest('hex');
    const a = Buffer.from(digest);
    const b = Buffer.from(expected);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  /**
   * Handle an incoming webhook: verify the signature, then on
   * `checkout.session.completed` activate the paid plan via onPlanPaid(tier).
   */
  async handleWebhook(rawBody: string, signatureHeader: string): Promise<{ event: string; activated?: string }> {
    if (!this.verifySignature(rawBody, signatureHeader)) {
      throw new Error('Invalid Stripe webhook signature');
    }
    const event = JSON.parse(rawBody) as any;
    if (event?.type === 'checkout.session.completed') {
      const tier = event.data?.object?.metadata?.tier || event.data?.object?.client_reference_id;
      if (tier) {
        await this.opts.onPlanPaid(String(tier));
        getLogger().info({ tier, session: event.data?.object?.id }, 'Paid plan activated via Stripe webhook');
        return { event: event.type, activated: String(tier) };
      }
    }
    return { event: event?.type ?? 'unknown' };
  }
}
