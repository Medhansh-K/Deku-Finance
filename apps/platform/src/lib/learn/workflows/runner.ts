/**
 * Runs a Learn Centre workflow: where the visitor is, which steps are really done (checked
 * against the activity log), which were skipped. Pure functions plus guarded localStorage,
 * one record per demo company, so a workflow started in one company stays with it.
 */
import { isSatisfied, type DemoActivity, type DemoActivityType, type StepExpectation } from "../activity";
import type { DemoCompanySlug } from "../companies";
import type { OrgRole } from "@/modules/departments-members/team";
import type { LearnWorkflow, LearnWorkflowStep, WorkflowCategory } from "./types";

export interface WorkflowProgress {
  workflowId: string;
  /** Current step; `steps.length` means the workflow is finished and the completion screen shows. */
  stepIndex: number;
  /** Activity seq when each step started; only activity after it can satisfy the step. */
  stepStartedSeq: Record<string, number>;
  completedSteps: string[];
  skippedSteps: string[];
  startedAt: string;
  finishedAt: string | null;
}

export interface CompanyWorkflowState {
  active: string | null;
  progress: Record<string, WorkflowProgress>;
}

export const EMPTY_WORKFLOW_STATE: CompanyWorkflowState = { active: null, progress: {} };

const lastSeq = (log: readonly DemoActivity[]) => log.at(-1)?.seq ?? 0;
const basePath = (route: string) => route.split("?")[0];
const without = (list: string[], id: string) => list.filter((x) => x !== id);

function freshProgress(wf: LearnWorkflow, log: readonly DemoActivity[], now: Date): WorkflowProgress {
  const first = wf.steps[0];
  return {
    workflowId: wf.id,
    stepIndex: 0,
    stepStartedSeq: first ? { [first.id]: lastSeq(log) } : {},
    completedSteps: [],
    skippedSteps: [],
    startedAt: now.toISOString(),
    finishedAt: null,
  };
}

export function startWorkflow(s: CompanyWorkflowState, wf: LearnWorkflow, log: readonly DemoActivity[], now = new Date()): CompanyWorkflowState {
  return { active: wf.id, progress: { ...s.progress, [wf.id]: freshProgress(wf, log, now) } };
}

export const restartWorkflow = startWorkflow;

/** Back to where the visitor left off; starts it if it was never started. */
export function resumeWorkflow(s: CompanyWorkflowState, wf: LearnWorkflow, log: readonly DemoActivity[], now = new Date()): CompanyWorkflowState {
  return s.progress[wf.id] ? { ...s, active: wf.id } : startWorkflow(s, wf, log, now);
}

/** What the catalogue's Start/Resume does: resume an unfinished run, otherwise start a new one. */
export function openWorkflow(s: CompanyWorkflowState, wf: LearnWorkflow, log: readonly DemoActivity[], now = new Date()): CompanyWorkflowState {
  const p = s.progress[wf.id];
  return p && !p.finishedAt ? { ...s, active: wf.id } : startWorkflow(s, wf, log, now);
}

export const exitWorkflow = (s: CompanyWorkflowState): CompanyWorkflowState => ({ ...s, active: null });

export function currentStep(wf: LearnWorkflow, p: WorkflowProgress): LearnWorkflowStep | null {
  return wf.steps[p.stepIndex] ?? null;
}

/** Read steps (no `expect`) wait for a visit to the step's own screen. */
export const stepExpectation = (step: LearnWorkflowStep): StepExpectation => step.expect ?? { kind: "visit", route: basePath(step.route) };

export interface StepCheck {
  satisfied: boolean;
  /** The activity that satisfied it, or null when the visitor was simply already on the screen. */
  by: DemoActivity | null;
}

/**
 * Whether the current step is done. A visit expectation also counts when the visitor is already
 * on that screen (the previous step may have left them there, which records no new visit).
 */
export function checkStep(wf: LearnWorkflow, p: WorkflowProgress, log: readonly DemoActivity[], currentRoute?: string): StepCheck {
  const step = currentStep(wf, p);
  if (!step) return { satisfied: false, by: null };
  const expect = stepExpectation(step);
  const by = isSatisfied(log, expect, p.stepStartedSeq[step.id] ?? 0);
  if (by) return { satisfied: true, by };
  if (expect.kind === "visit" && currentRoute && basePath(currentRoute) === expect.route) return { satisfied: true, by: null };
  return { satisfied: false, by: null };
}

function advance(p: WorkflowProgress, wf: LearnWorkflow, nextStartSeq: number, now: Date): WorkflowProgress {
  const index = p.stepIndex + 1;
  const next = wf.steps[index];
  return {
    ...p,
    stepIndex: index,
    // Keep an earlier start if the visitor went back and forward again.
    stepStartedSeq: next && p.stepStartedSeq[next.id] === undefined ? { ...p.stepStartedSeq, [next.id]: nextStartSeq } : p.stepStartedSeq,
    finishedAt: index >= wf.steps.length ? now.toISOString() : p.finishedAt,
  };
}

function update(s: CompanyWorkflowState, p: WorkflowProgress): CompanyWorkflowState {
  return { ...s, progress: { ...s.progress, [p.workflowId]: p } };
}

export interface MoveResult {
  state: CompanyWorkflowState;
  ok: boolean;
  reason?: string;
}

/** Next is allowed only when the current step is satisfied. */
export function nextStep(s: CompanyWorkflowState, wf: LearnWorkflow, log: readonly DemoActivity[], currentRoute?: string, now = new Date()): MoveResult {
  const p = s.progress[wf.id];
  const step = p && currentStep(wf, p);
  if (!p || !step) return { state: s, ok: false, reason: "This workflow is not running." };
  const check = checkStep(wf, p, log, currentRoute);
  if (!check.satisfied) return { state: s, ok: false, reason: `Waiting for you to ${describeExpectation(step)}.` };
  // Activity after the one that finished this step can already count for the next step.
  const startSeq = check.by?.seq ?? p.stepStartedSeq[step.id] ?? lastSeq(log);
  const done: WorkflowProgress = {
    ...p,
    completedSteps: p.completedSteps.includes(step.id) ? p.completedSteps : [...p.completedSteps, step.id],
    skippedSteps: without(p.skippedSteps, step.id),
  };
  return { state: update(s, advance(done, wf, startSeq, now)), ok: true };
}

/** Explicit skip: moves on, recorded as skipped, never as completed. */
export function skipStep(s: CompanyWorkflowState, wf: LearnWorkflow, log: readonly DemoActivity[], now = new Date()): CompanyWorkflowState {
  const p = s.progress[wf.id];
  const step = p && currentStep(wf, p);
  if (!p || !step) return s;
  const skipped: WorkflowProgress = p.completedSteps.includes(step.id)
    ? p
    : { ...p, skippedSteps: p.skippedSteps.includes(step.id) ? p.skippedSteps : [...p.skippedSteps, step.id] };
  return update(s, advance(skipped, wf, lastSeq(log), now));
}

export function previousStep(s: CompanyWorkflowState, wf: LearnWorkflow): CompanyWorkflowState {
  const p = s.progress[wf.id];
  if (!p || p.stepIndex === 0) return s;
  return update(s, { ...p, stepIndex: Math.min(p.stepIndex, wf.steps.length) - 1, finishedAt: null });
}

/** Every step either done (seen by the recorder) or explicitly skipped. */
export function isWorkflowComplete(wf: LearnWorkflow, p: WorkflowProgress | undefined): boolean {
  if (!p || wf.steps.length === 0) return false;
  return wf.steps.every((st) => p.completedSteps.includes(st.id) || p.skippedSteps.includes(st.id));
}

export type WorkflowStatus =
  | { kind: "not-started" }
  | { kind: "in-progress"; step: number; of: number }
  | { kind: "done"; skipped: number };

export function workflowStatus(wf: LearnWorkflow, p: WorkflowProgress | undefined): WorkflowStatus {
  if (!p) return { kind: "not-started" };
  if (p.finishedAt && isWorkflowComplete(wf, p)) return { kind: "done", skipped: p.skippedSteps.length };
  return { kind: "in-progress", step: Math.min(p.stepIndex, wf.steps.length - 1) + 1, of: wf.steps.length };
}

/** The role the step needs, when it isn't the one being previewed. */
export function roleSwitchFor(step: LearnWorkflowStep | null, role: OrgRole): OrgRole | null {
  return step?.role && step.role !== role ? step.role : null;
}

// ---------- Words for the step card ----------

const GOALS: Partial<Record<DemoActivityType, string>> = {
  "party.created": "save a new party",
  "item.created": "save a new item",
  "account.created": "save a new ledger account",
  "invoice.created": "save the invoice",
  "invoice.issued": "issue the invoice",
  "invoice.cancelled": "cancel the invoice",
  "note.created": "save the note",
  "note.issued": "issue the note",
  "purchase.created": "save the purchase bill",
  "journal.created": "save the voucher",
  "journal.updated": "update the voucher",
  "journal.submitted": "submit the voucher for approval",
  "journal.posted": "post the voucher",
  "journal.rejected": "send the voucher back",
  "journal.reversed": "reverse the voucher",
  "stock.adjusted": "save a stock adjustment",
  "bank.statement_imported": "load the bank statement",
  "bank.matched": "match a statement line",
  "bank.unmatched": "unmatch a statement line",
  "bank.reconciled": "complete the reconciliation",
  "member.invited": "invite a member",
  "member.role_changed": "change a member's role",
  "department.updated": "update a department",
  "settings.updated": "save the settings",
  "marketplace.settlement_posted": "post the settlement",
  "payroll.run": "run payroll",
  "consultant.asked": "ask Deku Consultant a question",
  "report.viewed": "open the report",
  "document.attached": "attach a document",
  "role.switched": "switch role",
  "company.switched": "switch company",
};

export function describeExpectation(step: LearnWorkflowStep): string {
  const e = stepExpectation(step);
  if (e.kind === "visit") return `open ${e.route}`;
  return GOALS[e.type] ?? e.type.replace(/[._]/g, " ");
}

/** Business changes for the completion screen, in the order first seen. */
const CHANGE_LABELS: Partial<Record<DemoActivityType, [string, string]>> = {
  "party.created": ["party added", "parties added"],
  "item.created": ["item added", "items added"],
  "account.created": ["ledger account added", "ledger accounts added"],
  "invoice.created": ["invoice saved", "invoices saved"],
  "invoice.issued": ["invoice issued", "invoices issued"],
  "invoice.cancelled": ["invoice cancelled", "invoices cancelled"],
  "note.issued": ["credit or debit note issued", "credit or debit notes issued"],
  "purchase.created": ["purchase bill recorded", "purchase bills recorded"],
  "journal.created": ["voucher saved", "vouchers saved"],
  "journal.submitted": ["voucher submitted", "vouchers submitted"],
  "journal.posted": ["voucher posted", "vouchers posted"],
  "journal.rejected": ["voucher sent back", "vouchers sent back"],
  "journal.reversed": ["voucher reversed", "vouchers reversed"],
  "stock.adjusted": ["stock adjustment", "stock adjustments"],
  "bank.statement_imported": ["bank statement loaded", "bank statements loaded"],
  "bank.matched": ["statement line matched", "statement lines matched"],
  "bank.reconciled": ["reconciliation completed", "reconciliations completed"],
  "member.invited": ["member invited", "members invited"],
  "member.role_changed": ["role changed", "roles changed"],
  "department.updated": ["department updated", "departments updated"],
  "settings.updated": ["settings change", "settings changes"],
  "marketplace.settlement_posted": ["settlement posted", "settlements posted"],
  "payroll.run": ["payroll run", "payroll runs"],
  "consultant.asked": ["question to Deku Consultant", "questions to Deku Consultant"],
  "report.viewed": ["report viewed", "reports viewed"],
  "document.attached": ["document attached", "documents attached"],
};

export function summariseChanges(log: readonly DemoActivity[], sinceSeq: number): { type: DemoActivityType; count: number; label: string }[] {
  const counts = new Map<DemoActivityType, number>();
  for (const a of log) if (a.seq > sinceSeq && CHANGE_LABELS[a.type]) counts.set(a.type, (counts.get(a.type) ?? 0) + 1);
  return [...counts].map(([type, count]) => {
    const [one, many] = CHANGE_LABELS[type]!;
    return { type, count, label: `${count} ${count === 1 ? one : many}` };
  });
}

/** Seq the run started from: activity after it belongs to this run. */
export const runStartSeq = (wf: LearnWorkflow, p: WorkflowProgress) => p.stepStartedSeq[wf.steps[0]?.id ?? ""] ?? 0;

// ---------- Catalogue ----------

export const WORKFLOW_CATEGORIES: { id: WorkflowCategory; label: string }[] = [
  { id: "daily-accounting", label: "Daily accounting" },
  { id: "sales-purchases", label: "Sales & purchases" },
  { id: "inventory-banking", label: "Inventory & banking" },
  { id: "financial-management", label: "Financial management" },
  { id: "business-administration", label: "Business administration" },
  { id: "audit-compliance", label: "Audit & compliance" },
  { id: "complete-cycle", label: "Complete business workflow" },
];

export interface WorkflowFilter {
  role?: OrgRole | "all";
  category?: WorkflowCategory | "all";
  industry?: DemoCompanySlug | "all";
  query?: string;
}

/** Role matches the primary or a supporting role; industry matches the companies the workflow fits. */
export function filterWorkflows(list: readonly LearnWorkflow[], f: WorkflowFilter): LearnWorkflow[] {
  const q = f.query?.trim().toLowerCase() ?? "";
  return list.filter(
    (wf) =>
      (!f.role || f.role === "all" || wf.primaryRole === f.role || wf.supportingRoles.includes(f.role)) &&
      (!f.category || f.category === "all" || wf.category === f.category) &&
      (!f.industry || f.industry === "all" || wf.industries.includes(f.industry)) &&
      (!q || `${wf.code} ${wf.name} ${wf.description} ${wf.modules.join(" ")}`.toLowerCase().includes(q))
  );
}

export function workspaceHref(wf: LearnWorkflow, company: DemoCompanySlug = wf.recommendedCompany): string {
  const qs = new URLSearchParams({ company, role: wf.primaryRole, plan: wf.minPlan, route: wf.startRoute, workflow: wf.id });
  return `/learn/demo/workspace?${qs.toString()}`;
}

// ---------- Storage (per company, guarded) ----------

export const WORKFLOW_STORE_VERSION = 1;
export const WORKFLOW_PROGRESS_EVENT = "deku-learn-workflow-progress";
const keyFor = (slug: DemoCompanySlug) => `deku-learn:workflows:v${WORKFLOW_STORE_VERSION}:${slug}`;

export function loadWorkflowState(slug: DemoCompanySlug): CompanyWorkflowState {
  try {
    const raw = window.localStorage.getItem(keyFor(slug));
    if (!raw) return EMPTY_WORKFLOW_STATE;
    const parsed = JSON.parse(raw) as CompanyWorkflowState;
    if (!parsed || typeof parsed.progress !== "object" || parsed.progress === null) return EMPTY_WORKFLOW_STATE;
    return { active: typeof parsed.active === "string" ? parsed.active : null, progress: parsed.progress };
  } catch {
    return EMPTY_WORKFLOW_STATE;
  }
}

export function saveWorkflowState(slug: DemoCompanySlug, s: CompanyWorkflowState): void {
  try {
    window.localStorage.setItem(keyFor(slug), JSON.stringify(s));
    window.dispatchEvent(new Event(WORKFLOW_PROGRESS_EVENT));
  } catch {
    // Blocked storage: progress lasts for this page only.
  }
}

export function clearWorkflowState(slug: DemoCompanySlug): void {
  try {
    window.localStorage.removeItem(keyFor(slug));
    window.dispatchEvent(new Event(WORKFLOW_PROGRESS_EVENT));
  } catch {
    // nothing to clear
  }
}
