"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Compass, Play, Search, Shield, Sliders } from "lucide-react";
import { WORKFLOW_TUTORIAL_PATHS } from "@/lib/tutorials/workflows";
import { DEMO_ROLES } from "@/lib/learn/demo-roles";
import { CAPABILITY_STATUS_LABELS, DEMO_PLANS, DEMO_PLAN_FEATURES, type DemoPlanId } from "@/lib/learn/demo-plans";

export function WorkflowDemoExplorer() {
  const [query, setQuery] = useState("");
  const [planFilter, setPlanFilter] = useState<"all" | DemoPlanId>("all");

  const filteredWorkflows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return WORKFLOW_TUTORIAL_PATHS.filter((wf) => {
      if (planFilter !== "all" && wf.recommendedPlan !== planFilter) return false;
      if (!q) return true;
      return (
        wf.title.toLowerCase().includes(q) ||
        wf.summary.toLowerCase().includes(q) ||
        wf.badge.toLowerCase().includes(q)
      );
    });
  }, [query, planFilter]);

  return (
    <div className="space-y-14">
      {/* Section A: Guided Business Workflows (Tally-style instant "Start Demo Tour" cards) */}
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-brand-strong">
              Interactive Guided Tours · Zero Login
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-ink mt-1">
              Select a Workflow. Start Instantly.
            </h2>
            <p className="text-xs sm:text-sm text-ink-soft mt-1">
              Launch any end-to-end financial workflow directly inside the real Deku workspace with floating step-by-step highlights.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="h-3.5 w-3.5 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search workflows..."
                aria-label="Search workflows"
                className="rounded-xl border border-line-strong bg-surface pl-8 pr-3 py-2 text-xs text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>

            <div className="inline-flex rounded-xl border border-line bg-surface p-1 text-[11px]">
              {(["all", "go", "pro", "enterprise"] as const).map((tier) => (
                <button
                  key={tier}
                  type="button"
                  onClick={() => setPlanFilter(tier)}
                  className={`px-2.5 py-1 rounded-lg font-semibold uppercase transition-colors ${planFilter === tier
                      ? "bg-panel text-white"
                      : "text-ink-soft hover:text-ink"
                    }`}
                >
                  {tier === "all" ? "All" : tier}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {filteredWorkflows.map((wf) => {
            const company = wf.recommendedCompanies[0] ?? "aster-trading";
            const startRoute = wf.steps[0]?.route ?? "/gateway";
            const href = `/learn/demo/workspace?company=${encodeURIComponent(company)}&plan=${encodeURIComponent(wf.recommendedPlan)}&route=${encodeURIComponent(startRoute)}&tour=${encodeURIComponent(wf.id)}`;
            return (
              <article
                key={wf.id}
                className="rounded-2xl border border-line-strong bg-surface p-5 flex flex-col justify-between gap-4 hover:border-brand/50 hover:shadow-md transition-all"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 rounded-md bg-brand/15 px-2 py-0.5 text-[10px] font-mono font-bold text-brand-strong uppercase">
                      <Compass className="h-3 w-3" />
                      {wf.badge}
                    </span>
                    <span className="text-[10px] font-mono uppercase text-ink-muted">
                      {wf.steps.length} steps
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-ink">{wf.title}</h3>
                  <p className="text-xs text-ink-soft leading-relaxed">{wf.summary}</p>
                </div>

                <div className="space-y-2 pt-2 border-t border-line">
                  <div className="text-[10px] font-mono text-ink-muted">
                    Plan: <strong className="uppercase text-ink">{wf.recommendedPlan}</strong> &middot;{" "}
                    {company.replace("-", " ")}
                  </div>
                  <Link
                    href={href}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-brand hover:bg-brand-hover px-3.5 py-2 text-xs font-bold text-ink transition-colors"
                  >
                    <Play className="h-3.5 w-3.5 fill-current" />
                    <span>Start Tour</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {/* Section B: Quick 7-Role Governance Preview */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-brand-strong" />
          <h2 className="text-lg font-black text-ink">Test Drive All 7 User Roles</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {DEMO_ROLES.map((r) => (
            <Link
              key={r.role}
              href={`/learn/demo/workspace?company=aster-trading&role=${r.role}&route=${encodeURIComponent(r.defaultRoute)}`}
              className="rounded-xl border border-line bg-surface p-4 hover:border-brand/50 transition-all space-y-1.5 group"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-ink group-hover:text-brand-strong">
                  {r.label}
                </span>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-canvas-sunken text-ink-muted">
                  {r.readOnly ? "Read-only" : "Operational"}
                </span>
              </div>
              <p className="text-[11px] font-medium text-brand-strong">{r.duty}</p>
              <p className="text-[11px] text-ink-soft leading-relaxed line-clamp-2">
                {r.governanceSummary}
              </p>
            </Link>
          ))}
        </div>
      </div>

      {/* Section C: Honest Plan Capability Preview */}
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Sliders className="h-4 w-4 text-brand-strong" />
            <h2 className="text-lg font-black text-ink">Compare GO / PRO / Enterprise in Demo</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.values(DEMO_PLANS).map((p) => (
              <Link
                key={p.id}
                href={`/learn/demo/workspace?company=aster-trading&plan=${p.id}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface hover:border-brand/50 px-3 py-1.5 text-xs font-bold text-ink"
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-brand-strong" />
                <span>Preview {p.name} ({p.priceLabel})</span>
              </Link>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-line-strong bg-surface">
          <table className="w-full text-left text-xs">
            <thead className="bg-canvas-sunken border-b border-line text-[10px] font-mono uppercase text-ink-muted">
              <tr>
                <th className="px-4 py-3">Capability</th>
                <th className="px-4 py-3">GO (₹24,999)</th>
                <th className="px-4 py-3">PRO (₹49,999)</th>
                <th className="px-4 py-3">Enterprise (₹1,19,999)</th>
                <th className="px-4 py-3">Demo Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {DEMO_PLAN_FEATURES.map((f) => (
                <tr key={f.key} className="hover:bg-canvas/60">
                  <td className="px-4 py-2.5 font-semibold text-ink">{f.label}</td>
                  <td className="px-4 py-2.5 text-ink-soft">{f.detailsByPlan.go}</td>
                  <td className="px-4 py-2.5 text-ink-soft">{f.detailsByPlan.pro}</td>
                  <td className="px-4 py-2.5 text-ink-soft">{f.detailsByPlan.enterprise}</td>
                  <td className="px-4 py-2.5">
                    <span className="inline-block rounded-full border border-line px-2 py-0.5 text-[10px] font-mono font-semibold text-ink-soft">
                      {CAPABILITY_STATUS_LABELS[f.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}


