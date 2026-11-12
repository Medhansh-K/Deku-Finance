import type { Metadata } from "next";
import React from "react";
import Link from "next/link";
import { LearnShell } from "@/components/learn/LearnShell";

export const metadata: Metadata = {
  title: "Interactive Demo | Sample Indian Business Books",
  description:
    "Try Deku Finance on sample Indian business books with 18 guided workflows and 7 user roles in your desktop or laptop browser, no sign-up required.",
  alternates: { canonical: "/learn/demo" },
};
import { DemoCompanyGrid } from "@/components/learn/DemoCompanyGrid";
import { WorkflowDemoExplorer } from "@/components/learn/WorkflowDemoExplorer";
import { DEMO_COMPANIES } from "@/lib/learn/companies";
import { DEMO_ROLES } from "@/lib/learn/demo-roles";
import { LEARN_WORKFLOWS } from "@/lib/learn/workflows/catalogue";
import { BookOpen } from "lucide-react";

export default function LearnDemoPage() {
  const facts = [
    { value: LEARN_WORKFLOWS.length, label: "Guided workflows", note: "Each step checks that you really did it." },
    { value: DEMO_COMPANIES.length, label: "Demo companies", note: "Fictional books that reconcile, one per industry." },
    { value: DEMO_ROLES.length, label: "Roles", note: "The same access rules as the real app." },
    { value: 0, label: "Real transactions", note: "Filing, payments and messages stay simulated." },
  ];
  return (
    <LearnShell>
      <section className="border-b border-line bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12 space-y-6">
          <div className="max-w-3xl space-y-2">
            <h1 className="text-[28px] sm:text-[34px] font-semibold tracking-[-0.03em] text-ink">Try Deku Finance on sample books</h1>
            <p className="text-[14px] sm:text-[15px] text-ink-soft leading-relaxed">
              No login. Everything runs in your browser: each demo company keeps its own books and activity log here, so an invoice you
              raise in one workflow is the one you collect, trace and report on in the next. Reset any time.
            </p>
          </div>
          <dl className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {facts.map((f) => (
              <div key={f.label} className="rounded-panel border border-line bg-canvas p-4">
                <dt className="text-[13px] text-ink-muted">{f.label}</dt>
                <dd className="text-[26px] font-semibold tracking-[-0.035em] text-ink tabular-nums">{f.value}</dd>
                <dd className="text-[12.5px] text-ink-muted">{f.note}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12 space-y-14">
        <WorkflowDemoExplorer />

        <div className="space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-[17px] font-semibold tracking-tight text-ink">Or open a company and look around</h2>
              <p className="text-[13.5px] text-ink-muted">Each opens straight away with its own sample books.</p>
            </div>
            <Link
              href="/learn/docs"
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-ctl border border-line-strong bg-surface text-[13px] font-medium text-ink hover:bg-canvas"
            >
              <BookOpen className="h-3.5 w-3.5 text-ink-soft" />
              Read the manuals
            </Link>
          </div>
          <DemoCompanyGrid />
        </div>
      </section>
    </LearnShell>
  );
}
