"use client";

import React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  BookOpen,
  Building2,
  Compass,
  Crown,
  RotateCcw,
  Shield,
  X,
  XCircle,
} from "lucide-react";
import { DEMO_COMPANIES, type DemoCompanySlug } from "@/lib/learn/companies";
import { DEMO_PLANS, type DemoPlanId } from "@/lib/learn/demo-plans";
import { DEMO_ROLES } from "@/lib/learn/demo-roles";
import { WORKFLOW_TUTORIAL_PATHS } from "@/lib/tutorials/workflows";
import { TUTORIAL_PATHS } from "@/lib/tutorials/paths";
import { loadProgress, saveProgress, startPath } from "@/lib/tutorials/progress";
import { useOptionalLearnDemo } from "@/context/LearnDemoContext";
import type { OrgRole } from "@/modules/departments-members/team";

export function DemoControlBar() {
  const demo = useOptionalLearnDemo();
  if (!demo) return null;

  const {
    companySlug,
    role,
    plan,
    roleConfig,
    workflowDrawerOpen,
    setWorkflowDrawerOpen,
    actionNotice,
    dismissActionNotice,
    switchCompany,
    switchRole,
    switchPlan,
    navigateTo,
    resetDemo,
  } = demo;

  const launchTutorial = (pathId: string, route?: string) => {
    const current = loadProgress("public-learn-demo");
    saveProgress("public-learn-demo", startPath(current, pathId));
    if (route) navigateTo(route);
    setWorkflowDrawerOpen(false);
  };

  return (
    <>
      <div
        data-testid="learn-demo-control-bar"
        data-tour="demo-control-bar"
        className="no-print shrink-0 border-b border-line bg-surface px-3 sm:px-6 py-2 text-[13px] text-ink"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Left: Non-transactional demo badge */}
          <div className="flex items-center gap-2 min-w-0">
            <span className="inline-flex items-center gap-1.5 rounded-chip bg-warn-wash px-2 py-0.5 text-xs font-medium text-warn">
              <span className="h-1.5 w-1.5 rounded-full bg-warn" />
              Demo, sample books only
            </span>
            <span className="hidden xl:inline text-[13px] text-ink-muted truncate">
              {roleConfig.readOnly
                ? "Read-only preview role"
                : `${roleConfig.label} preview · in-browser sample data`}
            </span>
          </div>

          {/* Center/Right: Interactive switchers & utility actions */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {/* 4 Demo Companies */}
            <label className="inline-flex items-center gap-1.5 rounded-ctl border border-line bg-surface h-8 px-2.5 text-[13px]">
              <Building2 className="h-3.5 w-3.5 text-ink-muted shrink-0" />
              <span className="sr-only">Demo Company</span>
              <select
                aria-label="Demo Company"
                value={companySlug}
                onChange={(e) => switchCompany(e.target.value as DemoCompanySlug)}
                className="bg-transparent font-medium text-ink focus:outline-none cursor-pointer"
              >
                {DEMO_COMPANIES.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.tradeName}
                  </option>
                ))}
              </select>
            </label>

            {/* 7 User Roles */}
            <label className="inline-flex items-center gap-1.5 rounded-ctl border border-line bg-surface h-8 px-2.5 text-[13px]">
              <Shield className="h-3.5 w-3.5 text-ink-muted shrink-0" />
              <span className="sr-only">Demo Role</span>
              <select
                aria-label="Demo Role"
                value={role}
                onChange={(e) => switchRole(e.target.value as OrgRole)}
                className="bg-transparent font-medium text-ink focus:outline-none cursor-pointer"
              >
                {DEMO_ROLES.map((r) => (
                  <option key={r.role} value={r.role}>
                    Role: {r.label}
                  </option>
                ))}
              </select>
            </label>

            {/* 3 Subscription Plans */}
            <label className="inline-flex items-center gap-1.5 rounded-ctl border border-line bg-surface h-8 px-2.5 text-[13px]">
              <Crown className="h-3.5 w-3.5 text-ink-muted shrink-0" />
              <span className="sr-only">Demo Plan</span>
              <select
                aria-label="Demo Plan"
                value={plan}
                onChange={(e) => switchPlan(e.target.value as DemoPlanId)}
                className="bg-transparent font-medium text-ink focus:outline-none cursor-pointer"
              >
                {Object.values(DEMO_PLANS).map((p) => (
                  <option key={p.id} value={p.id}>
                    Plan: {p.name}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={() => launchTutorial("product-walkthrough", "/gateway")}
              className="inline-flex items-center gap-1.5 rounded-ctl bg-ink text-white hover:bg-panel-raised h-8 px-3 text-[13px] font-medium transition-colors cursor-pointer"
            >
              <Compass className="h-3.5 w-3.5 text-brand" />
              <span>Guided Tour</span>
            </button>

            <button
              type="button"
              onClick={() => setWorkflowDrawerOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-ctl border border-brand-wash-strong bg-brand-wash hover:bg-brand-wash-strong h-8 px-3 text-[13px] font-medium text-brand-strong transition-colors cursor-pointer"
            >
              <Compass className="h-3.5 w-3.5 text-brand-strong" />
              <span>8 Workflows</span>
            </button>

            <Link
              href="/learn/docs"
              className="inline-flex items-center gap-1.5 rounded-ctl border border-line bg-surface hover:bg-canvas h-8 px-3 text-[13px] font-medium text-ink transition-colors"
            >
              <BookOpen className="h-3.5 w-3.5 text-ink-soft" />
              <span>Learn</span>
            </Link>

            <button
              type="button"
              onClick={resetDemo}
              className="inline-flex items-center gap-1.5 rounded-ctl border border-line bg-surface hover:bg-canvas h-8 px-3 text-[13px] font-medium text-ink transition-colors"
              title="Restore initial sample books for this company"
            >
              <RotateCcw className="h-3.5 w-3.5 text-ink-soft" />
              <span>Reset</span>
            </button>

            <Link
              href="/learn"
              className="inline-flex items-center gap-1.5 rounded-ctl border border-line bg-surface hover:bg-bad-wash h-8 px-3 text-[13px] font-medium text-bad transition-colors"
            >
              <XCircle className="h-3.5 w-3.5" />
              <span>Exit Demo</span>
            </Link>
          </div>
        </div>

        {/* Dismissible Role / Plan / Reset notice */}
        {actionNotice && (
          <div
            role="status"
            className={`mt-2 flex items-start justify-between gap-2 rounded-lg border px-3 py-1.5 text-[11px] ${actionNotice.tone === "blocked"
                ? "border-rose-300 bg-rose-50 text-rose-900"
                : actionNotice.tone === "warning"
                  ? "border-amber-300 bg-amber-50 text-amber-950"
                  : "border-brand/30 bg-surface text-ink"
              }`}
          >
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold">{actionNotice.title}: </strong>
                <span className="text-ink-soft">{actionNotice.body}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={dismissActionNotice}
              aria-label="Dismiss notice"
              className="p-0.5 rounded hover:bg-black/5 shrink-0"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Interactive Workflows & Role/Plan Explorer Drawer */}
      {workflowDrawerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Workflows and Guided Tours"
          className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs"
        >
          <div className="w-full max-w-lg bg-surface h-full overflow-y-auto border-l border-line-strong p-5 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-brand-strong">
                  Guided Interactive Tours
                </span>
                <h2 className="text-base font-bold text-ink">
                  8 End-to-End Business Workflows
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setWorkflowDrawerOpen(false)}
                aria-label="Close workflows drawer"
                className="p-1.5 rounded-lg border border-line hover:bg-canvas text-ink-soft"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              {WORKFLOW_TUTORIAL_PATHS.map((wf) => (
                <div
                  key={wf.id}
                  className="rounded-xl border border-line bg-canvas p-3.5 space-y-2 hover:border-brand/40 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-brand/15 px-1.5 py-0.5 text-[10px] font-mono font-bold text-brand-strong">
                        {wf.badge}
                      </span>
                      <h3 className="text-sm font-bold text-ink">{wf.title}</h3>
                    </div>
                    <span className="text-[10px] font-mono uppercase text-ink-muted">
                      {wf.steps.length} steps &middot; {wf.recommendedPlan}
                    </span>
                  </div>
                  <p className="text-xs text-ink-soft leading-relaxed">{wf.summary}</p>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] text-ink-muted">{wf.roleGuidance}</span>
                    <button
                      type="button"
                      onClick={() => launchTutorial(wf.id, wf.steps[0]?.route)}
                      className="shrink-0 rounded-lg bg-brand text-white hover:bg-brand-strong px-3 py-1.5 text-xs font-bold transition-colors"
                    >
                      Start Tour &rarr;
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-line pt-4 space-y-2">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-ink-muted">
                Core Module Tutorials
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {TUTORIAL_PATHS.filter((p) => p.audience !== "implementer").map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => launchTutorial(p.id, p.steps[0]?.route)}
                    className="text-left rounded-lg border border-line bg-canvas hover:border-brand/40 p-2.5 transition-colors"
                  >
                    <div className="text-xs font-bold text-ink">{p.title}</div>
                    <div className="text-[11px] text-ink-muted truncate">{p.summary}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}


