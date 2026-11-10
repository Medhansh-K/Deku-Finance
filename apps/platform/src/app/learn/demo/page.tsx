import React from "react";
import Link from "next/link";
import { LearnShell } from "@/components/learn/LearnShell";
import { DemoCompanyGrid } from "@/components/learn/DemoCompanyGrid";
import { WorkflowDemoExplorer } from "@/components/learn/WorkflowDemoExplorer";
import { BookOpen, Layers, ShieldAlert, Sliders, Users } from "lucide-react";

export default function LearnDemoPage() {
  return (
    <LearnShell>
      <section className="border-b border-line-strong bg-surface py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="max-w-3xl space-y-3">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-panel text-brand-soft font-mono text-[11px] font-bold border border-edge">
              INTERACTIVE DEMO CENTRE · ZERO LOGIN
            </span>
            <h1 className="text-3xl sm:text-4xl font-black text-ink tracking-tight">
              Explore Deku Finance Instantly. No Login, No Hassle.
            </h1>
            <p className="text-sm sm:text-base text-ink-soft leading-relaxed">
              Launch any of our four fictional companies or eight guided workflow tours directly in your browser. Switch across all seven RBAC roles, compare GO / PRO / Enterprise plans live, and reset sample books anytime.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2 text-xs">
            <div className="rounded-xl border border-line bg-canvas p-4 space-y-1">
              <Users className="h-4 w-4 text-brand-strong" />
              <div className="font-bold text-ink">7 RBAC Roles</div>
              <p className="text-ink-soft">Owner, CFO, Admin, Accountant, Analyst, Auditor &amp; Viewer governance previews.</p>
            </div>
            <div className="rounded-xl border border-line bg-canvas p-4 space-y-1">
              <Sliders className="h-4 w-4 text-brand-strong" />
              <div className="font-bold text-ink">3 Commercial Tiers</div>
              <p className="text-ink-soft">Switch between GO, PRO, and Enterprise to inspect seat, volume &amp; feature gates.</p>
            </div>
            <div className="rounded-xl border border-line bg-canvas p-4 space-y-1">
              <Layers className="h-4 w-4 text-brand-strong" />
              <div className="font-bold text-ink">Reconciled Sample Books</div>
              <p className="text-ink-soft">Four industry datasets powered by the real Deku UI with in-browser double-entry parity.</p>
            </div>
            <div className="rounded-xl border border-line bg-canvas p-4 space-y-1">
              <ShieldAlert className="h-4 w-4 text-amber-600" />
              <div className="font-bold text-ink">No Real Transactions</div>
              <p className="text-ink-soft">Nothing writes to a live company database, and external GSTN/payment/WhatsApp calls stay simulated.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-14">
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-ink">Select an Industry Company</h2>
              <p className="text-xs text-ink-soft mt-0.5">
                Every company opens immediately in your browser with fresh, resettable sample books.
              </p>
            </div>
            <Link
              href="/learn/docs"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-line-strong bg-surface text-xs font-semibold text-ink hover:bg-canvas-sunken"
            >
              <BookOpen className="h-3.5 w-3.5 text-brand-strong" />
              <span>Read Manuals First</span>
            </Link>
          </div>

          <DemoCompanyGrid />
        </div>

        <WorkflowDemoExplorer />
      </section>
    </LearnShell>
  );
}
