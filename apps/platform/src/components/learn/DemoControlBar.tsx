"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Info,
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
import { DEMO_ROLES, getDemoRoleConfig } from "@/lib/learn/demo-roles";
import { LEARN_WORKFLOWS } from "@/lib/learn/workflows/catalogue";
import { openWorkflow, workflowStatus } from "@/lib/learn/workflows/runner";
import type { LearnWorkflow } from "@/lib/learn/workflows/types";
import { useOptionalLearnDemo } from "@/context/LearnDemoContext";
import type { OrgRole } from "@/modules/departments-members/team";
import { WorkflowStatusChip, startLabel } from "./workflow-ui";

const PLAN_RANK: Record<DemoPlanId, number> = { go: 0, pro: 1, enterprise: 2 };

export function DemoControlBar() {
  const demo = useOptionalLearnDemo();
  const [tab, setTab] = useState<"workflows" | "activity">("workflows");
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
    resetDemo,
    workflowState,
    updateWorkflows,
    activity,
    dataset,
  } = demo;

  // The coach opens the step's screen and switches role; the plan only ever goes up to what the workflow needs.
  const launchWorkflow = (wf: LearnWorkflow) => {
    if (PLAN_RANK[plan] < PLAN_RANK[wf.minPlan]) switchPlan(wf.minPlan);
    updateWorkflows((s, log) => openWorkflow(s, wf, log));
    setWorkflowDrawerOpen(false);
  };

  const confirmReset = () => {
    if (window.confirm(`Reset ${dataset.org.name}'s books, activity and workflow progress to the starting sample data?`)) resetDemo();
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
              onClick={() => setWorkflowDrawerOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-ctl border border-brand-wash-strong bg-brand-wash hover:bg-brand-wash-strong h-8 px-3 text-[13px] font-medium text-brand-strong transition-colors cursor-pointer"
            >
              <Compass className="h-3.5 w-3.5 text-brand-strong" />
              <span>Workflows</span>
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
              onClick={confirmReset}
              className="inline-flex items-center gap-1.5 rounded-ctl border border-line bg-surface hover:bg-canvas h-8 px-3 text-[13px] font-medium text-ink transition-colors"
              title="Restore this company's starting sample books and clear its workflow progress"
            >
              <RotateCcw className="h-3.5 w-3.5 text-ink-soft" />
              <span>Reset</span>
            </button>

            <Link
              href="/learn"
              className="inline-flex items-center gap-1.5 rounded-ctl border border-line bg-surface hover:bg-bad-wash h-8 px-3 text-[13px] font-medium text-bad transition-colors"
            >
              <XCircle className="h-3.5 w-3.5" />
              <span>Exit demo</span>
            </Link>
          </div>
        </div>

        {/* Dismissible Role / Plan / Reset notice */}
        {actionNotice && (
          <div
            role="status"
            className={`mt-2 flex items-start justify-between gap-2 rounded-ctl px-3 py-1.5 text-[13px] ${actionNotice.tone === "blocked"
                ? "bg-bad-wash text-bad"
                : actionNotice.tone === "warning"
                  ? "bg-warn-wash text-warn"
                  : "bg-brand-wash text-ink"
              }`}
          >
            <div className="flex items-start gap-2">
              {actionNotice.tone === "info" ? (
                <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-brand-strong" />
              ) : (
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              )}
              <div>
                <strong className="font-semibold">{actionNotice.title}. </strong>
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

      {workflowDrawerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Workflows and activity"
          className="fixed inset-0 z-50 flex justify-end bg-black/40"
          onClick={(e) => e.target === e.currentTarget && setWorkflowDrawerOpen(false)}
        >
          <div className="w-full max-w-lg bg-surface h-full overflow-y-auto border-l border-line shadow-pop">
            <div className="sticky top-0 z-10 bg-surface border-b border-line px-5 pt-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-[15px] font-semibold tracking-tight text-ink">{dataset.org.name}</h2>
                  <p className="text-[13px] text-ink-muted">Progress and activity are kept for this company, in this browser.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setWorkflowDrawerOpen(false)}
                  aria-label="Close"
                  className="p-1.5 rounded-ctl border border-line hover:bg-canvas text-ink-soft"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div role="tablist" className="mt-3 flex gap-4 text-[13.5px]">
                {(["workflows", "activity"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    role="tab"
                    aria-selected={tab === t}
                    onClick={() => setTab(t)}
                    className={`pb-2 border-b-2 font-medium ${tab === t ? "border-brand text-ink" : "border-transparent text-ink-muted hover:text-ink"}`}
                  >
                    {t === "workflows" ? `Workflows (${LEARN_WORKFLOWS.length})` : `Activity (${activity.length})`}
                  </button>
                ))}
              </div>
            </div>

            {tab === "workflows" ? (
              <ul className="divide-y divide-line">
                {LEARN_WORKFLOWS.map((wf) => {
                  const status = workflowStatus(wf, workflowState.progress[wf.id]);
                  const running = workflowState.active === wf.id;
                  return (
                    <li key={wf.id} className={`px-5 py-3 flex items-start gap-3 ${running ? "bg-brand-wash" : ""}`}>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-baseline gap-2">
                          <span className="font-mono text-[12.5px] text-brand-strong">{wf.code}</span>
                          <h3 className="text-[14px] font-[550] text-ink truncate">{wf.name}</h3>
                        </div>
                        <p className="text-[12.5px] text-ink-muted">
                          {getDemoRoleConfig(wf.primaryRole).label} · {wf.steps.length} steps · about {wf.estimatedMinutes} min
                        </p>
                        <WorkflowStatusChip status={status} />
                      </div>
                      <button
                        type="button"
                        onClick={() => launchWorkflow(wf)}
                        className="shrink-0 h-8 px-3 rounded-ctl bg-brand text-panel-deep hover:bg-brand-hover text-[13px] font-semibold"
                      >
                        {running ? "Continue" : startLabel(status)}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div>
                <p className="px-5 pt-3 text-[13px] text-ink-muted">
                  Everything you did in this company, newest first. Workflow steps complete from this log.
                </p>
                {activity.length === 0 ? (
                  <p className="px-5 py-6 text-[13.5px] text-ink-muted">Nothing yet. Open a screen or start a workflow.</p>
                ) : (
                  <ol className="divide-y divide-line mt-2" data-testid="demo-activity-log">
                    {[...activity].reverse().map((a) => (
                      <li key={a.id} className="px-5 py-2.5 flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-[13.5px] text-ink">{a.summary}</p>
                          <p className="text-[12.5px] text-ink-muted tabular-nums">
                            {new Date(a.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                        <span className="shrink-0 inline-flex items-center h-[22px] px-2 rounded-chip text-xs font-medium bg-canvas-sunken text-ink-soft">
                          {getDemoRoleConfig(a.role).label}
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )}

            <div className="border-t border-line px-5 py-4">
              <button
                type="button"
                onClick={confirmReset}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-ctl border border-line-strong text-[13px] font-medium text-ink hover:bg-canvas"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset books and progress
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}


