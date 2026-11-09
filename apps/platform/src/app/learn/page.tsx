"use client";

import React, { useState } from "react";
import Link from "next/link";
import LandingNavbar from "@/components/landing/LandingNavbar";
import LandingFooter from "@/components/landing/LandingFooter";
import { TUTORIAL_PATHS } from "@/lib/tutorials/paths";
import {
  Compass,
  BookOpen,
  ArrowRight,
  Receipt,
  Scale,
  ShieldCheck,
  Code,
  Sparkles,
  ChevronRight,
  Landmark,
  Layers,
  Play,
  Check,
} from "lucide-react";

type AudienceFilter = "all" | "everyone" | "admin" | "implementer";

export default function LearnPage() {
  const [selectedAudience, setSelectedAudience] = useState<AudienceFilter>("all");
  const [activeExperience, setActiveExperience] = useState<"tutorials" | "docs">("tutorials");

  const filteredPaths = TUTORIAL_PATHS.filter((p) => {
    if (selectedAudience === "all") return true;
    return p.audience === selectedAudience;
  });

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col font-sans selection:bg-brand/30 selection:text-ink">
      <LandingNavbar />

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-16 lg:pt-20 lg:pb-24 border-b border-line-strong bg-gradient-to-b from-brand/10 via-canvas to-white">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-60 pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-panel px-4 py-1.5 text-xs font-mono font-bold text-white border border-edge shadow-sm">
            <Sparkles className="h-3.5 w-3.5 text-brand" />
            <span>Public Learn Centre • Zero Login Required</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-ink max-w-4xl mx-auto leading-tight">
            Learn Deku Finance.{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-panel via-[#2F6B6B] to-brand">
              Master Double-Entry &amp; GST.
            </span>
          </h1>

          <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-2xl mx-auto">
            Experience Deku through guided, context-aware interactive workflows and comprehensive technical documentation. No signup, no credit card, and safe sample data.
          </p>

          {/* Experience Switcher (Option A vs Option B) */}
          <div className="pt-2 flex items-center justify-center gap-2">
            <button
              onClick={() => setActiveExperience("tutorials")}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                activeExperience === "tutorials"
                  ? "bg-brand text-ink shadow-md shadow-brand/20 scale-105"
                  : "bg-slate-100 text-slate-700 hover:text-ink hover:bg-slate-200"
              }`}
            >
              <Compass className="h-4 w-4" />
              <span>Option A: Interactive Tutorials (9 Paths)</span>
            </button>
            <button
              onClick={() => setActiveExperience("docs")}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                activeExperience === "docs"
                  ? "bg-panel text-white shadow-md scale-105"
                  : "bg-slate-100 text-slate-700 hover:text-ink hover:bg-slate-200"
              }`}
            >
              <BookOpen className="h-4 w-4 text-brand-soft" />
              <span>Option B: Technical Documentation</span>
            </button>
          </div>
        </div>
      </section>

      {/* Main Experience Body */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 space-y-16">
        {/* ========================================================================= */}
        {/* OPTION A: INTERACTIVE TUTORIALS                                          */}
        {/* ========================================================================= */}
        {activeExperience === "tutorials" && (
          <div className="space-y-12 animate-fade-in">
            {/* 5-Dimension Explainer Callout */}
            <div className="p-6 rounded-2xl border border-line-strong bg-gradient-to-r from-brand/5 via-canvas to-white space-y-4">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-panel text-brand-soft border border-edge">
                  5-DIMENSION REACTIVE FRAMEWORK
                </span>
                <span className="text-xs font-bold text-ink">Beyond Clicking: Real Business Education</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed max-w-4xl">
                Every Deku tutorial teaches: <strong>1. Concept</strong> (What is it?) ➔ <strong>2. Business Importance</strong> (Why it matters to cash flow) ➔ <strong>3. Commercial Use Cases</strong> (Credit sales, cash counter, inter-state) ➔ <strong>4. Practical Operation</strong> (You execute in the actual UI; never automated) ➔ <strong>5. Consequences</strong> (Verified journal entries, Day Book, and Trial Balance changes).
              </p>
            </div>

            {/* Audience Filters */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
              <div>
                <h2 className="text-2xl font-black text-ink tracking-tight">Interactive Learning Paths</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Showing {filteredPaths.length} of {TUTORIAL_PATHS.length} available guided paths (76 total lessons)
                </p>
              </div>

              <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl text-xs font-medium">
                {[
                  { id: "all" as const, label: "All Audiences" },
                  { id: "everyone" as const, label: "For Everyone" },
                  { id: "admin" as const, label: "Admins & CFOs" },
                  { id: "implementer" as const, label: "Developers" },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setSelectedAudience(f.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      selectedAudience === f.id
                        ? "bg-white text-ink shadow-xs font-bold"
                        : "text-slate-600 hover:text-ink"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Path Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredPaths.map((path, idx) => {
                const audienceColor =
                  path.audience === "admin"
                    ? "bg-amber-50 text-amber-800 border-amber-200"
                    : path.audience === "implementer"
                    ? "bg-purple-50 text-purple-800 border-purple-200"
                    : "bg-emerald-50 text-emerald-800 border-emerald-200";

                return (
                  <div
                    key={path.id}
                    className="p-6 rounded-2xl border border-line-strong bg-surface shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4 group"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono font-bold text-slate-400">
                          PATH {String(idx + 1).padStart(2, "0")}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${audienceColor}`}>
                            {path.audience.toUpperCase()}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-700">
                            {path.steps.length} LESSONS
                          </span>
                        </div>
                      </div>

                      <h3 className="text-lg font-bold text-ink group-hover:text-brand-strong transition-colors">
                        {path.title}
                      </h3>

                      <p className="text-xs text-slate-600 leading-relaxed">
                        {path.summary}
                      </p>

                      <div className="pt-2 border-t border-line text-[11px] text-slate-500 space-y-1">
                        <div><strong>Outcome:</strong> {path.outcome}</div>
                        <div><strong>Prerequisites:</strong> {path.prerequisites}</div>
                      </div>
                    </div>

                    <Link
                      href={`/gateway?tour=${path.id}`}
                      className="inline-flex items-center justify-between w-full px-4 py-2.5 rounded-xl bg-panel hover:bg-panel-deep text-white text-xs font-bold transition-all shadow-sm group-hover:bg-brand group-hover:text-ink"
                    >
                      <span className="flex items-center gap-2">
                        <Play className="h-3.5 w-3.5 fill-current" />
                        <span>Launch Guided Tour</span>
                      </span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* OPTION B: TECHNICAL DOCUMENTATION                                        */}
        {/* ========================================================================= */}
        {activeExperience === "docs" && (
          <div className="space-y-12 animate-fade-in">
            <div className="max-w-3xl">
              <span className="text-xs font-mono font-bold text-brand-strong uppercase tracking-wider">
                Public Knowledge Base
              </span>
              <h2 className="text-3xl font-black text-ink tracking-tight mt-1">
                Technical, Statutory &amp; Implementation Docs
              </h2>
              <p className="text-slate-600 text-sm mt-2 leading-relaxed">
                Structured reference documentation explaining how Deku works under the hood, how modules interact, and how to configure compliance settings.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                {
                  cat: "Category 1",
                  title: "Understanding Deku",
                  topics: [
                    "What Deku is and who it is built for",
                    "The Desktop Gateway OS design philosophy",
                    "Single-tenant architecture & privacy model",
                    "Pure Accounting vs GST Registered Mode",
                  ],
                  icon: Layers,
                },
                {
                  cat: "Category 2",
                  title: "Accounting Mechanics",
                  topics: [
                    "ALERX 4-Tier chart of accounts hierarchy",
                    "Double-entry posting & zero-variance enforcement",
                    "Voucher taxonomy (Contra F4 to Purchase F9)",
                    "Period locking & fiscal year boundaries",
                  ],
                  icon: Scale,
                },
                {
                  cat: "Category 3",
                  title: "GST Compliance & Tax Rules",
                  topics: [
                    "Section 22 CGST Act turnover threshold rules",
                    "Intra-State (CGST+SGST) vs Inter-State (IGST)",
                    "Input Tax Credit (ITC) & Rule 36(4) verification",
                    "Offline GSTR-1 and GSTR-3B JSON schema mapping",
                  ],
                  icon: Receipt,
                },
                {
                  cat: "Category 4",
                  title: "Banking & Operations",
                  topics: [
                    "Bank ledger asset accounts (Code 1020)",
                    "CSV and OFX statement parsing algorithms",
                    "Bharat UPI Dynamic QR code embedding",
                    "Document Builder & Quotation-to-Invoice flows",
                  ],
                  icon: Landmark,
                },
                {
                  cat: "Category 5",
                  title: "Governance & Security",
                  topics: [
                    "Maker-Checker dual-gate authorization",
                    "Role-Based Access Control (RBAC) permission bits",
                    "PostgreSQL Row-Level Security (RLS) enforcement",
                    "Append-only cryptographic audit logging",
                  ],
                  icon: ShieldCheck,
                },
                {
                  cat: "Category 6",
                  title: "Deployment & DevOps",
                  topics: [
                    "8-Container Docker Compose topology",
                    "PostgreSQL 16 & PostgREST query layer",
                    "Rust accounting engine vs Next.js Shell",
                    "Zero-loss WAL backup & migration procedures",
                  ],
                  icon: Code,
                },
              ].map((doc) => {
                const Icon = doc.icon;
                return (
                  <div key={doc.title} className="p-6 rounded-2xl border border-line-strong bg-surface space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">
                        {doc.cat}
                      </span>
                      <Icon className="h-4 w-4 text-brand-strong" />
                    </div>

                    <h3 className="font-bold text-ink text-base">{doc.title}</h3>

                    <ul className="space-y-1.5 text-xs text-slate-600">
                      {doc.topics.map((t) => (
                        <li key={t} className="flex items-start gap-1.5">
                          <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                          <span>{t}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="pt-2 border-t border-line">
                      <span className="text-xs font-bold text-brand-strong hover:underline cursor-pointer inline-flex items-center gap-1">
                        <span>Read Documentation</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Safety & Isolation Invariant Banner */}
      <section className="bg-canvas-sunken border-t border-line-strong py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-xl bg-panel text-brand flex items-center justify-center shrink-0">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-bold text-ink text-sm">Safe Sandbox Guarantee</h4>
              <p className="text-xs text-slate-600 mt-0.5 leading-relaxed max-w-xl">
                The Public Learn Centre operates in an isolated demo context with mock data. Real customer accounts, internal admin portals, and external payment side effects are completely unreachable.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Link
              href="/gateway"
              className="px-5 py-2.5 rounded-xl bg-brand hover:bg-brand-soft text-ink font-bold text-xs shadow-sm transition-all"
            >
              Open Gateway Sandbox
            </Link>
          </div>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}

