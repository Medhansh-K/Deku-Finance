import { describe, it, expect } from "vitest";
import { daysUntil, hasFeature, limitReached, trialTimeline, type Subscription } from "@/lib/subscription/entitlements";

const sub = (over: Partial<Subscription>): Subscription => ({
  plan: { code: "go", name: "GO", price_paise_monthly: 149900, price_paise_yearly: 1438800 },
  status: "trialing",
  trial_ends_at: "2026-11-15T10:00:00Z",
  current_period_end: "2026-11-20T10:00:00Z",
  provider: "manual",
  entitlements: { max_monthly_invoices: 150, seats: 2, gstn_json: false },
  usage: { invoices_this_month: 0, seats_used: 1 },
  server_time: "2026-10-31T10:00:00Z",
  ...over,
});

describe("entitlement gating", () => {
  it("treats a null limit as unlimited and unknown entitlements as not blocking", () => {
    expect(limitReached({ max_monthly_invoices: 150 }, "max_monthly_invoices", 149)).toBe(false);
    expect(limitReached({ max_monthly_invoices: 150 }, "max_monthly_invoices", 150)).toBe(true);
    expect(limitReached({ max_monthly_invoices: null }, "max_monthly_invoices", 10_000)).toBe(false);
    expect(limitReached({ seats: 0, read_only: true }, "seats", 0)).toBe(true);
    expect(limitReached(null, "seats", 99)).toBe(false);
  });

  it("only an explicit true enables a feature", () => {
    expect(hasFeature({ gstn_json: true }, "gstn_json")).toBe(true);
    expect(hasFeature({ gstn_json: false }, "gstn_json")).toBe(false);
    expect(hasFeature({}, "direct_filing")).toBe(false);
    expect(hasFeature(null, "payments")).toBe(false);
  });

  it("counts days from the server clock", () => {
    expect(daysUntil("2026-11-15T10:00:00Z", "2026-10-31T10:00:00Z")).toBe(15);
    expect(daysUntil("2026-11-15T10:00:00Z", "2026-11-15T09:00:00Z")).toBe(1);
    expect(daysUntil("2026-11-01T00:00:00Z", "2026-11-02T00:00:00Z")).toBe(0);
    expect(daysUntil(null, "2026-10-31T10:00:00Z")).toBeNull();
  });

  it("splits a trial into trial days and grace days", () => {
    expect(trialTimeline(sub({}))).toEqual({ inGrace: false, trialDaysLeft: 15, accessDaysLeft: 20 });
    expect(trialTimeline(sub({ server_time: "2026-11-17T10:00:00Z" }))).toEqual({
      inGrace: true,
      trialDaysLeft: 0,
      accessDaysLeft: 3,
    });
    expect(trialTimeline(sub({ status: "active" }))).toBeNull();
  });
});
