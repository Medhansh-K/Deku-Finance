import React from "react";
import Link from "next/link";
import { LearnShell } from "@/components/learn/LearnShell";
import { DEMO_COMPANIES } from "@/lib/learn/companies";
import { DOC_CATEGORIES } from "@/lib/learn/docs-data";
import { TUTORIAL_PATHS } from "@/lib/tutorials/paths";
import {
  ArrowRight,
  BookOpen,
  Building2,
  CheckCircle2,
  Compass,
  Layers,
  Play,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";

export default function LearnPage() {
  const guidedWorkflowCount = TUTORIAL_PATHS.filter((p) => p.audience !== "implementer").length;

  return (
    <LearnShell>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-line-strong bg-gradient-to-b from-brand/10 via-canvas to-surface py-14 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-panel px-4 py-1.5 text-xs font-mono font-bold text-white border border-edge shadow-xs">
            <Sparkles className="h-3.5 w-3.5 text-brand" />
            <span>Public Deku Learn Centre · Zero Signup · Zero Licence Required</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-ink max-w-4xl mx-auto leading-tight">
            Learn &amp; Test Drive{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-panel via-brand-strong to-brand">
              Deku Finance ERP
            </span>
          </h1>

          <p className="text-sm sm:text-base text-ink-soft max-w-2xl mx-auto leading-relaxed">
            Explore full double-entry accounting, GST compliance, inventory, banking reconciliation, role governance, and plan entitlements inside live industry workbenches—or study the structured manuals before onboarding your business.
          </p>

          {/* Two Primary Entry Points */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto pt-4 text-left">
            {/* Experience A: Interactive Demo */}
            <div className="rounded-2xl border-2 border-brand/50 bg-panel-deep text-white p-6 sm:p-8 flex flex-col justify-between gap-6 shadow-lg">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-brand/15 border border-brand/30 text-brand-soft font-mono text-[11px] font-bold">
                  <Play className="h-3.5 w-3.5 fill-current" />
                  <span>INTERACTIVE DEMO</span>
                </div>
                <h2 className="text-2xl font-black tracking-tight">
                  Experience Deku. Don&apos;t just read about it.
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  Explore realistic business environments, operate financial workflows and understand how Deku works without purchasing a licence.
                </p>
                <ul className="space-y-1.5 text-xs text-slate-300 pt-2">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-brand shrink-0" />
                    <span>4 fictional industry companies (Wholesale, Services, D2C, Retail)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-brand shrink-0" />
                    <span>Instant switching across 7 RBAC roles &amp; GO / PRO / Enterprise plans</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-brand shrink-0" />
                    <span>{guidedWorkflowCount} guided workflow paths inside the real ERP workspace</span>
                  </li>
                </ul>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href="/learn/demo"
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-brand hover:bg-brand-hover text-ink font-bold text-xs sm:text-sm transition-colors shadow-sm"
                >
                  <span>Explore Interactive Demo</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/learn/demo/companies"
                  className="inline-flex items-center gap-1.5 px-4 py-3 rounded-xl border border-edge bg-panel hover:bg-panel-raised text-slate-200 font-semibold text-xs transition-colors"
                >
                  <Building2 className="h-3.5 w-3.5 text-brand-soft" />
                  <span>Pick a Company</span>
                </Link>
              </div>
            </div>

            {/* Experience B: Manuals & Documentation */}
            <div className="rounded-2xl border border-line-strong bg-surface p-6 sm:p-8 flex flex-col justify-between gap-6 shadow-xs">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-canvas-sunken border border-line text-brand-strong font-mono text-[11px] font-bold">
                  <BookOpen className="h-3.5 w-3.5" />
                  <span>MANUALS &amp; DOCUMENTATION</span>
                </div>
                <h2 className="text-2xl font-black tracking-tight text-ink">
                  Understand every layer of Deku.
                </h2>
                <p className="text-xs sm:text-sm text-ink-soft leading-relaxed">
                  Learn how to configure, operate, manage and implement Deku through structured manuals and technical documentation.
                </p>
                <ul className="space-y-1.5 text-xs text-ink-soft pt-2">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <span>8 structured manual categories from Getting Started to Technical</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <span>Full search, Table of Contents, tags, and version metadata</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <span>Direct launch links from manuals into live demo modules</span>
                  </li>
                </ul>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href="/learn/docs"
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-panel hover:bg-panel-deep text-white font-bold text-xs sm:text-sm transition-colors shadow-sm"
                >
                  <span>Explore Documentation</span>
                  <ArrowRight className="h-4 w-4 text-brand" />
                </Link>
                <Link
                  href="/learn/docs/getting-started"
                  className="inline-flex items-center gap-1.5 px-4 py-3 rounded-xl border border-line-strong bg-canvas hover:bg-canvas-sunken text-ink font-semibold text-xs transition-colors"
                >
                  <Compass className="h-3.5 w-3.5 text-brand-strong" />
                  <span>Getting Started</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Industry Demo Preview Strip */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-brand-strong">
              4 Industry Templates
            </span>
            <h2 className="text-2xl font-black text-ink tracking-tight mt-1">
              Realistic Companies With Reconciled Books
            </h2>
          </div>
          <Link
            href="/learn/demo/companies"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-strong hover:underline"
          >
            <span>Compare all demo companies</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {DEMO_COMPANIES.map((c) => (
            <Link
              key={c.slug}
              href={`/learn/demo/workspace?company=${c.slug}&plan=${c.recommendedPlan}`}
              className="rounded-2xl border border-line-strong bg-surface p-5 hover:border-brand transition-all flex flex-col justify-between gap-4 group"
            >
              <div className="space-y-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-brand-strong">
                  {c.industry}
                </span>
                <h3 className="text-base font-bold text-ink group-hover:text-brand-strong transition-colors">
                  {c.tradeName}
                </h3>
                <p className="text-xs text-ink-soft leading-relaxed line-clamp-3">{c.summary}</p>
              </div>
              <div className="pt-2 border-t border-line flex items-center justify-between text-xs font-semibold text-ink">
                <span className="font-mono text-[10px] text-ink-muted uppercase">{c.recommendedPlan} tier</span>
                <span className="inline-flex items-center gap-1 text-brand-strong">
                  Launch <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* 8 Documentation Categories Preview */}
      <section className="border-t border-line-strong bg-surface py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-brand-strong">
                Structured Manuals
              </span>
              <h2 className="text-2xl font-black text-ink tracking-tight mt-1">
                Documentation by Layer &amp; Role
              </h2>
            </div>
            <Link
              href="/learn/docs"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-strong hover:underline"
            >
              <span>Search all documentation</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {DOC_CATEGORIES.map((cat) => (
              <Link
                key={cat.slug}
                href={`/learn/docs/${cat.slug}`}
                className="rounded-xl border border-line bg-canvas p-4 hover:border-brand transition-colors space-y-2 group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono font-bold text-brand-strong">SECTION {cat.order}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-ink-muted group-hover:text-brand-strong" />
                </div>
                <h3 className="text-sm font-bold text-ink">{cat.title}</h3>
                <p className="text-xs text-ink-soft leading-relaxed">{cat.summary}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Architecture & Safety Guarantee */}
      <section className="border-t border-line-strong bg-canvas-sunken py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
          <div className="flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-brand-strong shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-ink">Zero-Login, Zero-Mutation Safety</h4>
              <p className="text-ink-soft mt-1 leading-relaxed">
                Runs cleanly in your browser on curated sample datasets—strictly separated from production customer tenants, credentials, and external provider gateways.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Layers className="h-5 w-5 text-brand-strong shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-ink">Reused ERP Screens — Real Double-Entry Parity</h4>
              <p className="text-ink-soft mt-1 leading-relaxed">
                Navigate Gateway (Esc), Vouchers (F4–F9), GST Returns, Inventory, Bank Recon, and Financial Statements using the real Deku UI with live mathematical parity.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Users className="h-5 w-5 text-brand-strong shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-ink">Live 7-Role &amp; 3-Plan Simulation</h4>
              <p className="text-ink-soft mt-1 leading-relaxed">
                Switch seamlessly between all 7 RBAC roles and GO / PRO / Enterprise tiers in the Demo Control Bar to preview access boundaries and feature availability.
              </p>
            </div>
          </div>
        </div>
      </section>
    </LearnShell>
  );
}
