"use client";

import React from "react";
import { useAuth } from "@/context/AuthContext";
import { AppShell } from "@/layouts/AppShell";
import { WorkspaceLayout } from "@/layouts/WorkspaceLayout";
import { formatINR } from "@/lib/formatters/currency";
import { formatDateTally } from "@/lib/formatters/date";
import { hasFeature, limitReached, trialTimeline, type Feature, type SubscriptionStatus } from "@/lib/subscription/entitlements";
import { CreditCard, PhoneCall, Loader2, CheckCircle2, MinusCircle } from "lucide-react";

const STATUS_LABEL: Record<SubscriptionStatus, string> = {
  trialing: "Free trial",
  active: "Active",
  past_due: "Payment overdue",
  cancelled: "Cancelled",
  expired: "Expired",
};

const FEATURES: { key: Feature; label: string }[] = [
  { key: "gstn_json", label: "GSTN offline JSON export" },
  { key: "direct_filing", label: "Direct GST filing" },
  { key: "payments", label: "Payment gateway collections" },
];

function UsageRow({ label, used, limit, reached }: { label: string; used: number; limit: number | null | undefined; reached: boolean }) {
  const unlimited = limit === null || limit === undefined;
  const pct = unlimited || limit === 0 ? (unlimited ? 0 : 100) : Math.min(100, Math.round((used / limit) * 100));
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-ink-soft">{label}</span>
        <span className={`font-bold ${reached ? "text-rose-700" : "text-ink"}`}>
          {used} / {unlimited ? "Unlimited" : limit}
        </span>
      </div>
      {!unlimited && (
        <div
          className="h-2 rounded-full bg-canvas-sunken overflow-hidden"
          role="progressbar"
          aria-label={label}
          aria-valuenow={used}
          aria-valuemin={0}
          aria-valuemax={limit}
        >
          <div className={`h-full ${reached ? "bg-rose-600" : "bg-brand"}`} style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}

export default function PlanBillingPage() {
  const { organisation, subscription, entitlements } = useAuth();
  const timeline = subscription ? trialTimeline(subscription) : null;
  const price = subscription?.plan?.price_paise_monthly;

  return (
    <AppShell>
      <WorkspaceLayout title="Plan & billing" breadcrumbs={[{ label: "Settings", href: "/settings" }, { label: "Plan & billing", href: "/settings/license" }]}>
        <div className="max-w-4xl mx-auto space-y-6 font-sans">
          <div className="border-b border-line pb-5">
            <h2 className="text-2xl font-black text-ink">Plan & billing</h2>
            <p className="text-xs text-ink-muted mt-1">
              {organisation?.name ?? "No company selected"}: your plan and this month&apos;s usage, as recorded by Deku.
            </p>
          </div>

          {!subscription ? (
            <div className="bg-surface rounded-2xl p-6 border border-line flex items-center gap-3 text-xs text-ink-muted">
              {organisation ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              <span>
                {organisation ? "Loading the plan… If this doesn't finish, Deku couldn't be reached; reload the page." : "Select a company to see its plan."}
              </span>
            </div>
          ) : (
            <>
              <section className="bg-surface rounded-2xl p-6 border border-line space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="h-11 w-11 rounded-xl bg-brand text-panel-deep flex items-center justify-center">
                      <CreditCard className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-black text-ink">{subscription.plan?.name ?? "No plan"}</span>
                        {subscription.status && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border border-line-strong text-ink-soft">
                            {STATUS_LABEL[subscription.status]}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-ink-muted">
                        {price === null || price === undefined ? "Price on request" : `${formatINR(price / 100, { minimumFractionDigits: 0 })} / month`}
                      </span>
                    </div>
                  </div>
                  <dl className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <dt className="text-[10px] uppercase font-bold text-ink-subtle">{timeline ? "Trial ends" : "Renews / ends"}</dt>
                      <dd className="font-bold text-ink mt-0.5">
                        {formatDateTally(timeline ? subscription.trial_ends_at : subscription.current_period_end)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] uppercase font-bold text-ink-subtle">Access until</dt>
                      <dd className="font-bold text-ink mt-0.5">{formatDateTally(subscription.current_period_end)}</dd>
                    </div>
                  </dl>
                </div>

                {timeline && (
                  <p className={`rounded-xl p-3 text-xs font-semibold border ${timeline.inGrace ? "bg-amber-50 border-amber-300 text-amber-900" : "bg-canvas border-line text-ink-soft"}`}>
                    {timeline.inGrace
                      ? `Your trial has ended. You have ${timeline.accessDaysLeft} day(s) of grace left to choose a plan before the company becomes read-only.`
                      : `${timeline.trialDaysLeft} day(s) left in your free trial, then ${(timeline.accessDaysLeft ?? 0) - (timeline.trialDaysLeft ?? 0)} days' grace.`}
                  </p>
                )}
                {entitlements?.read_only && (
                  <p className="rounded-xl p-3 text-xs font-semibold border bg-rose-50 border-rose-300 text-rose-900">
                    This company has no active plan. Your books stay readable, but new invoices and members are blocked.
                  </p>
                )}
              </section>

              <section className="bg-surface rounded-2xl p-6 border border-line space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-ink-subtle">Usage this month</h3>
                <UsageRow
                  label="Invoices issued"
                  used={subscription.usage.invoices_this_month}
                  limit={entitlements?.max_monthly_invoices}
                  reached={limitReached(entitlements, "max_monthly_invoices", subscription.usage.invoices_this_month)}
                />
                <UsageRow
                  label="Member seats"
                  used={subscription.usage.seats_used}
                  limit={entitlements?.seats}
                  reached={limitReached(entitlements, "seats", subscription.usage.seats_used)}
                />
                <ul className="pt-2 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  {FEATURES.map((f) => {
                    const on = hasFeature(entitlements, f.key);
                    return (
                      <li key={f.key} className="flex items-center gap-1.5 text-ink-soft">
                        {on ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <MinusCircle className="h-4 w-4 text-ink-subtle" />}
                        <span>{f.label}</span>
                        <span className="sr-only">{on ? "included" : "not included"}</span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            </>
          )}

          <section className="bg-surface rounded-2xl p-6 border border-line flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-black text-ink">Upgrade or renew</h3>
              <p className="text-xs text-ink-muted mt-1">
                Online payment isn&apos;t available yet. Contact us and we&apos;ll switch your plan once payment is received.
              </p>
            </div>
            <a
              href="tel:+917506461004"
              className="py-2.5 px-4 rounded-xl bg-brand hover:bg-brand-hover text-panel-deep text-xs font-bold flex items-center gap-2 shrink-0"
            >
              <PhoneCall className="h-4 w-4" />
              <span>+91 7506461004</span>
            </a>
          </section>
        </div>
      </WorkspaceLayout>
    </AppShell>
  );
}
