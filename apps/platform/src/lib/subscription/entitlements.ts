/** Deku's own plan for a company, as GET /organisations/:id/subscription returns it. The database decides; these helpers only read it. */

/** A numeric limit that is null (or missing) is unlimited. */
export interface Entitlements {
  read_only?: boolean;
  max_monthly_invoices?: number | null;
  seats?: number | null;
  gstn_json?: boolean;
  direct_filing?: boolean;
  payments?: boolean;
}

export type SubscriptionStatus = "trialing" | "active" | "past_due" | "cancelled" | "expired";

export interface Subscription {
  plan: {
    code: string;
    name: string;
    price_paise_monthly: number | null;
    price_paise_yearly: number | null;
  } | null;
  status: SubscriptionStatus | null;
  trial_ends_at: string | null;
  current_period_end: string | null;
  provider: "manual" | "razorpay" | null;
  entitlements: Entitlements;
  usage: { invoices_this_month: number; seats_used: number };
  server_time: string;
}

export type Feature = "gstn_json" | "direct_filing" | "payments";

export const hasFeature = (e: Entitlements | null | undefined, f: Feature) => e?.[f] === true;

/** Unknown entitlements (not loaded yet) never block in the UI; the server still enforces. */
export function limitReached(e: Entitlements | null | undefined, key: "max_monthly_invoices" | "seats", used: number) {
  const limit = e?.[key];
  return typeof limit === "number" && used >= limit;
}

const DAY_MS = 86_400_000;

/** Whole days until `iso`, counted from the server's clock so a wrong browser clock can't change it. */
export function daysUntil(iso: string | null | undefined, serverNow: string): number | null {
  if (!iso) return null;
  return Math.max(0, Math.ceil((Date.parse(iso) - Date.parse(serverNow)) / DAY_MS));
}

/** Trial days left, and the grace days after it, while trialing. */
export function trialTimeline(s: Subscription) {
  if (s.status !== "trialing") return null;
  const now = Date.parse(s.server_time);
  const inGrace = !!s.trial_ends_at && Date.parse(s.trial_ends_at) <= now;
  return {
    inGrace,
    trialDaysLeft: daysUntil(s.trial_ends_at, s.server_time),
    accessDaysLeft: daysUntil(s.current_period_end, s.server_time),
  };
}
