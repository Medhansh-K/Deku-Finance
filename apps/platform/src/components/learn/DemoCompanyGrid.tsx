"use client";

import React from "react";
import Link from "next/link";
import { DEMO_COMPANIES } from "@/lib/learn/companies";
import { ArrowRight, Building2, Check, Info, ShieldCheck } from "lucide-react";

export function DemoCompanyGrid() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {DEMO_COMPANIES.map((company) => (
        <article
          key={company.slug}
          className="rounded-2xl border border-line-strong bg-surface p-6 shadow-xs hover:shadow-md transition-all flex flex-col justify-between gap-5"
        >
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-panel text-brand flex items-center justify-center border border-edge shrink-0">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-brand-strong">
                    {company.industry}
                  </span>
                  <h2 className="text-lg font-bold text-ink">{company.tradeName}</h2>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-canvas-sunken border border-line text-[11px] font-mono font-semibold text-ink-soft uppercase">
                Default Plan: {company.recommendedPlan}
              </span>
            </div>

            <p className="text-xs sm:text-sm text-ink-soft leading-relaxed">{company.summary}</p>

            <dl className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-3 rounded-xl bg-canvas border border-line">
              {company.highlights.map((h) => (
                <div key={h.label}>
                  <dt className="text-[10px] font-mono uppercase text-ink-muted">{h.label}</dt>
                  <dd className="text-xs font-semibold text-ink mt-0.5">{h.value}</dd>
                </div>
              ))}
            </dl>

            <div className="space-y-2">
              <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-ink-muted">
                Demonstrated Modules &amp; Workflows
              </div>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-ink-soft">
                {company.keyModules.map((mod) => (
                  <li key={mod} className="flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <span>{mod}</span>
                  </li>
                ))}
              </ul>
            </div>

            {company.disclosures && company.disclosures.length > 0 && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-[11px] text-amber-900 flex items-start gap-2">
                <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-700" />
                <span>{company.disclosures.join(" ")}</span>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-line flex flex-wrap items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 text-[11px] text-ink-muted">
              <ShieldCheck className="h-3.5 w-3.5 text-brand-strong" />
              Zero login · Frontend sample books · Reset anytime
            </span>
            <Link
              href={`/learn/demo/workspace?company=${company.slug}&plan=${company.recommendedPlan}`}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand hover:bg-brand-hover text-ink font-bold text-xs shadow-xs transition-colors"
            >
              <span>Enter Demo Workspace</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </article>
      ))}
    </div>
  );
}
