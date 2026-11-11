"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Clock, Search } from "lucide-react";
import { DEMO_COMPANIES, getDemoCompany, type DemoCompanySlug } from "@/lib/learn/companies";
import { DEMO_ROLES, getDemoRoleConfig } from "@/lib/learn/demo-roles";
import { CAPABILITY_STATUS_LABELS, DEMO_PLANS, DEMO_PLAN_FEATURES } from "@/lib/learn/demo-plans";
import { LEARN_WORKFLOWS } from "@/lib/learn/workflows/catalogue";
import {
  WORKFLOW_CATEGORIES,
  WORKFLOW_PROGRESS_EVENT,
  filterWorkflows,
  loadWorkflowState,
  workflowStatus,
  workspaceHref,
  type CompanyWorkflowState,
  type WorkflowFilter,
  type WorkflowStatus,
} from "@/lib/learn/workflows/runner";
import type { LearnWorkflow, WorkflowDifficulty, WorkflowModule } from "@/lib/learn/workflows/types";
import type { OrgRole } from "@/modules/departments-members/team";
import { WorkflowStatusChip, startLabel } from "./workflow-ui";

const MODULE_LABELS: Record<WorkflowModule, string> = {
  sales: "Sales",
  purchases: "Purchases",
  vouchers: "Vouchers",
  "day-book": "Day Book",
  inventory: "Inventory",
  banking: "Banking",
  gst: "GST",
  reports: "Reports",
  fpa: "FP&A",
  executive: "Executive",
  consultant: "Deku Consultant",
  settings: "Settings",
  team: "Team",
  approvals: "Approvals",
  audit: "Audit",
  masters: "Masters",
};

const DIFFICULTY_LABELS: Record<WorkflowDifficulty, string> = { starter: "Starter", intermediate: "Intermediate", advanced: "Advanced" };

const chip = "inline-flex items-center h-[22px] px-2 rounded-chip text-xs font-medium whitespace-nowrap";
const selectClass = "h-9 max-w-full rounded-ctl border border-line-strong bg-surface px-2.5 text-[13.5px] text-ink focus:outline-none focus:ring-2 focus:ring-brand";

type Progress = Partial<Record<DemoCompanySlug, CompanyWorkflowState>>;

/** Where the visitor has this workflow: the running company first, then a finished one, else not started. */
function progressFor(wf: LearnWorkflow, all: Progress): { status: WorkflowStatus; company: DemoCompanySlug } {
  let best: { status: WorkflowStatus; company: DemoCompanySlug; at: string } | null = null;
  for (const c of DEMO_COMPANIES) {
    const p = all[c.slug]?.progress[wf.id];
    if (!p) continue;
    const status = workflowStatus(wf, p);
    const rank = status.kind === "in-progress" ? 2 : 1;
    const bestRank = best ? (best.status.kind === "in-progress" ? 2 : 1) : 0;
    if (rank > bestRank || (rank === bestRank && best && p.startedAt > best.at)) best = { status, company: c.slug, at: p.startedAt };
  }
  return best ?? { status: { kind: "not-started" }, company: wf.recommendedCompany };
}

function useAllProgress(): Progress {
  const [all, setAll] = useState<Progress>({});
  useEffect(() => {
    const read = () => setAll(Object.fromEntries(DEMO_COMPANIES.map((c) => [c.slug, loadWorkflowState(c.slug)])));
    read();
    window.addEventListener(WORKFLOW_PROGRESS_EVENT, read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener(WORKFLOW_PROGRESS_EVENT, read);
      window.removeEventListener("storage", read);
    };
  }, []);
  return all;
}

function StartLink({ wf, all, className }: { wf: LearnWorkflow; all: Progress; className?: string }) {
  const { status, company } = progressFor(wf, all);
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="flex flex-wrap items-center gap-1.5">
        <WorkflowStatusChip status={status} />
        {status.kind !== "not-started" && <span className="text-[12.5px] text-ink-muted">{getDemoCompany(company)?.tradeName}</span>}
      </span>
      <Link
        href={workspaceHref(wf, company)}
        className={
          className ??
          "inline-flex items-center gap-1.5 h-8 px-3 rounded-ctl bg-brand text-panel-deep hover:bg-brand-hover text-[13px] font-semibold"
        }
        aria-label={`${startLabel(status)} ${wf.code} ${wf.name}`}
      >
        {startLabel(status)}
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

function Meta({ wf }: { wf: LearnWorkflow }) {
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-ink-muted">
      <span>{getDemoRoleConfig(wf.primaryRole).label}</span>
      <span aria-hidden="true">·</span>
      <span className="inline-flex items-center gap-1">
        <Clock className="h-3 w-3" />
        about {wf.estimatedMinutes} min
      </span>
      <span aria-hidden="true">·</span>
      <span>{DIFFICULTY_LABELS[wf.difficulty]}</span>
      <span aria-hidden="true">·</span>
      <span>{wf.steps.length} steps</span>
    </p>
  );
}

function WorkflowCard({ wf, all }: { wf: LearnWorkflow; all: Progress }) {
  return (
    <article className="rounded-panel border border-line bg-surface p-5 flex flex-col justify-between gap-4" data-testid="workflow-card">
      <div className="space-y-2">
        <span className="font-mono text-[12.5px] text-brand-strong">{wf.code}</span>
        <h3 className="text-[15px] font-semibold tracking-tight text-ink">{wf.name}</h3>
        <p className="text-[13.5px] text-ink-soft leading-relaxed">{wf.description}</p>
        <Meta wf={wf} />
        <div className="flex flex-wrap gap-1">
          {wf.modules.map((m) => (
            <span key={m} className={`${chip} bg-canvas-sunken text-ink-soft`}>
              {MODULE_LABELS[m]}
            </span>
          ))}
        </div>
      </div>
      <StartLink wf={wf} all={all} />
    </article>
  );
}

/** WF-18: one company, every role, start to close. */
function FlagshipCard({ wf, all }: { wf: LearnWorkflow; all: Progress }) {
  const roles = wf.steps.reduce<OrgRole[]>((acc, s) => {
    const r = s.role ?? wf.primaryRole;
    return acc.at(-1) === r ? acc : [...acc, r];
  }, []);
  return (
    <article className="rounded-panel border border-brand bg-brand-wash p-5 sm:p-7 space-y-4" data-testid="workflow-flagship">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[13px] text-brand-strong">{wf.code}</span>
        <span className={`${chip} bg-surface text-brand-strong`}>Flagship, the full business cycle</span>
      </div>
      <div className="space-y-2 max-w-3xl">
        <h3 className="text-[22px] sm:text-[26px] font-semibold tracking-[-0.03em] text-ink">{wf.name}</h3>
        <p className="text-[14px] text-ink-soft leading-relaxed">{wf.description}</p>
        <Meta wf={wf} />
      </div>
      <ol className="flex flex-wrap items-center gap-1.5 text-[13px]" aria-label="Roles in order">
        {roles.map((r, i) => (
          <li key={`${r}-${i}`} className="flex items-center gap-1.5">
            {i > 0 && <ArrowRight className="h-3.5 w-3.5 text-ink-subtle" aria-hidden="true" />}
            <span className="inline-flex items-center h-7 px-2.5 rounded-ctl border border-line bg-surface text-ink">{getDemoRoleConfig(r).label}</span>
          </li>
        ))}
      </ol>
      <StartLink
        wf={wf}
        all={all}
        className="inline-flex items-center gap-1.5 h-10 px-4 rounded-ctl bg-ink text-white hover:bg-panel-raised text-[14px] font-medium"
      />
    </article>
  );
}

export function WorkflowDemoExplorer() {
  const all = useAllProgress();
  const [filter, setFilter] = useState<Required<WorkflowFilter>>({ role: "all", category: "all", industry: "all", query: "" });
  const shown = useMemo(() => filterWorkflows(LEARN_WORKFLOWS, filter), [filter]);
  const set = <K extends keyof WorkflowFilter>(k: K, v: Required<WorkflowFilter>[K]) => setFilter((f) => ({ ...f, [k]: v }));
  const industryNotes = filter.industry === "all" ? [] : LEARN_WORKFLOWS.filter((w) => !w.industries.includes(filter.industry as DemoCompanySlug) && w.industryNote);

  return (
    <div className="space-y-14">
      <div className="space-y-6" id="workflows">
        <div className="space-y-1">
          <h2 className="text-[22px] font-semibold tracking-tight text-ink">{LEARN_WORKFLOWS.length} guided workflows</h2>
          <p className="text-[14px] text-ink-soft max-w-3xl">
            Each one runs on the real screens with sample books in your browser. A step completes only when you have actually done it, and
            what you create carries into the next workflow in the same company. Pick one and start; the company, role and plan are set for you.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="h-3.5 w-3.5 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={filter.query}
              onChange={(e) => set("query", e.target.value)}
              placeholder="Search workflows"
              aria-label="Search workflows"
              className="h-9 w-full rounded-ctl border border-line-strong bg-surface pl-8 pr-3 text-[13.5px] text-ink placeholder:text-ink-subtle focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>
          <select aria-label="Filter by role" value={filter.role} onChange={(e) => set("role", e.target.value as OrgRole | "all")} className={selectClass}>
            <option value="all">All roles</option>
            {DEMO_ROLES.map((r) => (
              <option key={r.role} value={r.role}>
                {r.label}
              </option>
            ))}
          </select>
          <select aria-label="Filter by category" value={filter.category} onChange={(e) => set("category", e.target.value as typeof filter.category)} className={selectClass}>
            <option value="all">All categories</option>
            {WORKFLOW_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          <select aria-label="Filter by company" value={filter.industry} onChange={(e) => set("industry", e.target.value as typeof filter.industry)} className={selectClass}>
            <option value="all">All companies</option>
            {DEMO_COMPANIES.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.tradeName} ({c.industry})
              </option>
            ))}
          </select>
          <span className="text-[13px] text-ink-muted tabular-nums">
            {shown.length} of {LEARN_WORKFLOWS.length}
          </span>
        </div>

        {shown.length === 0 && <p className="text-[13.5px] text-ink-muted">No workflow matches these filters.</p>}

        {/* The flagship cycle leads; the other categories follow in catalogue order. */}
        {[...WORKFLOW_CATEGORIES.filter((c) => c.id === "complete-cycle"), ...WORKFLOW_CATEGORIES.filter((c) => c.id !== "complete-cycle")].map((cat) => {
          const list = shown.filter((w) => w.category === cat.id);
          if (list.length === 0) return null;
          return (
            <section key={cat.id} className="space-y-3" aria-label={cat.label}>
              <h3 className="text-[15px] font-semibold tracking-tight text-ink">{cat.label}</h3>
              {cat.id === "complete-cycle" ? (
                list.map((wf) => <FlagshipCard key={wf.id} wf={wf} all={all} />)
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {list.map((wf) => (
                    <WorkflowCard key={wf.id} wf={wf} all={all} />
                  ))}
                </div>
              )}
            </section>
          );
        })}

        {industryNotes.length > 0 && (
          <div className="rounded-panel border border-line bg-surface p-4 space-y-1 text-[13px] text-ink-soft">
            <p className="font-medium text-ink">Not shown for {getDemoCompany(filter.industry as string)?.tradeName}</p>
            {industryNotes.map((w) => (
              <p key={w.id}>
                <span className="font-mono text-brand-strong">{w.code}</span> {w.name}: {w.industryNote}
              </p>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <h2 className="text-[17px] font-semibold tracking-tight text-ink">Explore freely as any of the {DEMO_ROLES.length} roles</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {DEMO_ROLES.map((r) => (
            <Link
              key={r.role}
              href={`/learn/demo/workspace?company=aster-trading&role=${r.role}&route=${encodeURIComponent(r.defaultRoute)}`}
              className="rounded-panel border border-line bg-surface p-4 hover:bg-brand-wash transition-colors space-y-1.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[14px] font-[550] text-ink">{r.label}</span>
                <span className={`${chip} bg-canvas-sunken text-ink-muted`}>{r.readOnly ? "Read-only" : "Can post"}</span>
              </div>
              <p className="text-[12.5px] text-brand-strong">{r.duty}</p>
              <p className="text-[12.5px] text-ink-muted leading-relaxed line-clamp-2">{r.governanceSummary}</p>
            </Link>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-[17px] font-semibold tracking-tight text-ink">GO, PRO and Enterprise in the demo</h2>
          <div className="flex flex-wrap gap-2">
            {Object.values(DEMO_PLANS).map((p) => (
              <Link
                key={p.id}
                href={`/learn/demo/workspace?company=aster-trading&plan=${p.id}`}
                className="inline-flex items-center h-8 px-3 rounded-ctl border border-line-strong bg-surface hover:bg-canvas text-[13px] font-medium text-ink"
              >
                Preview {p.name} ({p.priceLabel})
              </Link>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto rounded-panel border border-line bg-surface">
          <table className="w-full text-left">
            <thead>
              <tr>
                <th className="deku-table-th">Capability</th>
                <th className="deku-table-th">GO</th>
                <th className="deku-table-th">PRO</th>
                <th className="deku-table-th">Enterprise</th>
                <th className="deku-table-th">In the demo</th>
              </tr>
            </thead>
            <tbody>
              {DEMO_PLAN_FEATURES.map((f) => (
                <tr key={f.key}>
                  <td className="deku-table-td font-medium text-ink">{f.label}</td>
                  <td className="deku-table-td text-ink-soft">{f.detailsByPlan.go}</td>
                  <td className="deku-table-td text-ink-soft">{f.detailsByPlan.pro}</td>
                  <td className="deku-table-td text-ink-soft">{f.detailsByPlan.enterprise}</td>
                  <td className="deku-table-td">
                    <span className={`${chip} bg-canvas-sunken text-ink-soft`}>{CAPABILITY_STATUS_LABELS[f.status]}</span>
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
