"use client";

import React from "react";
import Link from "next/link";
import { DEMO_COMPANIES } from "@/lib/learn/companies";
import { LEARN_WORKFLOWS } from "@/lib/learn/workflows/catalogue";
import { ArrowRight, Building2, Check, Info } from "lucide-react";

export function DemoCompanyGrid() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {DEMO_COMPANIES.map((company) => {
        const fits = LEARN_WORKFLOWS.filter((w) => w.industries.includes(company.slug)).length;
        return (
          <article key={company.slug} className="rounded-panel border border-line bg-surface p-5 flex flex-col justify-between gap-4">
            <div className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-[8px] bg-canvas-sunken text-ink-soft grid place-items-center shrink-0">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-[15px] font-semibold tracking-tight text-ink">{company.tradeName}</h3>
                    <p className="text-[12.5px] text-ink-muted">{company.industry}</p>
                  </div>
                </div>
                <span className="inline-flex items-center h-[22px] px-2 rounded-chip text-xs font-medium bg-canvas-sunken text-ink-soft">
                  {company.recommendedPlan.toUpperCase()} plan
                </span>
              </div>

              <p className="text-[13.5px] text-ink-soft leading-relaxed">{company.summary}</p>

              <dl className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 rounded-ctl bg-canvas p-3">
                {company.highlights.map((h) => (
                  <div key={h.label}>
                    <dt className="text-[12.5px] text-ink-muted">{h.label}</dt>
                    <dd className="text-[13.5px] font-medium text-ink">{h.value}</dd>
                  </div>
                ))}
              </dl>

              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[13px] text-ink-soft">
                {company.keyModules.map((mod) => (
                  <li key={mod} className="flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5 text-ok shrink-0" />
                    <span>{mod}</span>
                  </li>
                ))}
              </ul>

              {company.disclosures && company.disclosures.length > 0 && (
                <p className="rounded-ctl bg-warn-wash px-3 py-2 text-[12.5px] text-warn flex items-start gap-2">
                  <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>{company.disclosures.join(" ")}</span>
                </p>
              )}
            </div>

            <div className="pt-3 border-t border-line flex flex-wrap items-center justify-between gap-3">
              <span className="text-[12.5px] text-ink-muted">
                {fits} of {LEARN_WORKFLOWS.length} workflows fit this company
              </span>
              <Link
                href={`/learn/demo/workspace?company=${company.slug}&plan=${company.recommendedPlan}`}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-ctl bg-ink text-white hover:bg-panel-raised text-[13px] font-medium"
              >
                Open {company.tradeName}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </article>
        );
      })}
    </div>
  );
}
