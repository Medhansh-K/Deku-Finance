import { beforeEach, describe, expect, it } from "vitest";
import { nextActivity, type DemoActivity, type DemoActivityRefs, type DemoActivityType } from "@/lib/learn/activity";
import type { LearnWorkflow } from "@/lib/learn/workflows/types";
import {
  EMPTY_WORKFLOW_STATE,
  checkStep,
  clearWorkflowState,
  exitWorkflow,
  filterWorkflows,
  isWorkflowComplete,
  loadWorkflowState,
  nextStep,
  openWorkflow,
  previousStep,
  resumeWorkflow,
  roleSwitchFor,
  saveWorkflowState,
  skipStep,
  startWorkflow,
  summariseChanges,
  workflowStatus,
  workspaceHref,
} from "@/lib/learn/workflows/runner";

// Local fixture: the runner must not depend on the real catalogue's content.
const SALES: LearnWorkflow = {
  id: "wf-a-sales",
  code: "WF-A",
  name: "Sales invoice",
  description: "Raise and issue an invoice",
  category: "sales-purchases",
  primaryRole: "accountant",
  supportingRoles: ["owner"],
  industries: ["aster-trading", "northstar-consulting"],
  recommendedCompany: "aster-trading",
  modules: ["sales"],
  minPlan: "go",
  startRoute: "/gst",
  startingData: "Seeded customers",
  estimatedMinutes: 6,
  difficulty: "starter",
  steps: [
    { id: "open", title: "Open sales", body: "Read", route: "/gst" },
    { id: "issue", title: "Issue", body: "Issue it", route: "/gst", expect: { kind: "event", type: "invoice.issued" } },
    { id: "review", title: "CFO reviews", body: "Look", route: "/reports/profit-loss", role: "cfo" },
  ],
  completion: "Invoice issued and seen in P&L",
  docs: ["accounting/sales"],
};

const BANK: LearnWorkflow = {
  ...SALES,
  id: "wf-b-bank",
  code: "WF-B",
  name: "Bank reconciliation",
  description: "Match the statement",
  category: "inventory-banking",
  primaryRole: "accountant",
  supportingRoles: [],
  industries: ["meridian-retail"],
  steps: [{ id: "rec", title: "Reconcile", body: "Do it", route: "/banking/reconciliation", expect: { kind: "event", type: "bank.reconciled" } }],
};

const AUDIT: LearnWorkflow = {
  ...SALES,
  id: "wf-c-audit",
  code: "WF-C",
  name: "Trace a transaction",
  description: "Auditor trail",
  category: "audit-compliance",
  primaryRole: "auditor",
  supportingRoles: ["cfo"],
  industries: ["aster-trading"],
};

let log: DemoActivity[] = [];
const act = (type: DemoActivityType, refs?: DemoActivityRefs, role: DemoActivity["role"] = "accountant") => {
  log = [...log, nextActivity(log, type, role, type, refs)];
  return log.at(-1)!;
};

beforeEach(() => {
  log = [];
  localStorage.clear();
});

describe("workflow runner", () => {
  it("blocks Next until the expected activity happens after the step started", () => {
    act("invoice.issued"); // before the workflow: must not count
    let s = startWorkflow(EMPTY_WORKFLOW_STATE, SALES, log);
    s = nextStep(s, SALES, log, "/gst").state; // read step on its screen
    expect(s.progress[SALES.id].stepIndex).toBe(1);

    const blocked = nextStep(s, SALES, log, "/gst");
    expect(blocked.ok).toBe(false);
    expect(blocked.reason).toBe("Waiting for you to issue the invoice.");

    const done = act("invoice.issued", { number: "INV-1" });
    expect(checkStep(SALES, s.progress[SALES.id], log).by).toBe(done);
    const moved = nextStep(s, SALES, log, "/gst");
    expect(moved.ok).toBe(true);
    expect(moved.state.progress[SALES.id].completedSteps).toEqual(["open", "issue"]);
  });

  it("satisfies read steps on visiting the screen", () => {
    const s = startWorkflow(EMPTY_WORKFLOW_STATE, SALES, log);
    expect(nextStep(s, SALES, log, "/day-book").ok).toBe(false);
    act("route.visited", { path: "/gst?tab=invoices" });
    expect(nextStep(s, SALES, log, "/day-book").ok).toBe(true);
    // Already on the screen counts too (no new visit gets recorded then).
    expect(nextStep(startWorkflow(EMPTY_WORKFLOW_STATE, SALES, log), SALES, log, "/gst").ok).toBe(true);
  });

  it("records a skip as skipped, never completed", () => {
    let s = startWorkflow(EMPTY_WORKFLOW_STATE, SALES, log);
    s = skipStep(s, SALES, log);
    const p = s.progress[SALES.id];
    expect(p.skippedSteps).toEqual(["open"]);
    expect(p.completedSteps).toEqual([]);
    expect(p.stepIndex).toBe(1);
  });

  it("resumes the same step after a simulated reload", () => {
    let s = startWorkflow(EMPTY_WORKFLOW_STATE, SALES, log);
    s = nextStep(s, SALES, log, "/gst").state;
    saveWorkflowState("aster-trading", s);

    const reloaded = loadWorkflowState("aster-trading");
    expect(reloaded.active).toBe(SALES.id);
    expect(reloaded.progress[SALES.id].stepIndex).toBe(1);
    // The activity done before the reload is still recognised from the saved log.
    act("invoice.issued");
    expect(checkStep(SALES, reloaded.progress[SALES.id], log).satisfied).toBe(true);

    const exited = exitWorkflow(reloaded);
    expect(resumeWorkflow(exited, SALES, log).progress[SALES.id].stepIndex).toBe(1);
    expect(openWorkflow(exited, SALES, log).progress[SALES.id].stepIndex).toBe(1);
  });

  it("asks for a role switch when the step's role differs", () => {
    expect(roleSwitchFor(SALES.steps[2], "accountant")).toBe("cfo");
    expect(roleSwitchFor(SALES.steps[2], "cfo")).toBeNull();
    expect(roleSwitchFor(SALES.steps[0], "viewer")).toBeNull();
  });

  it("completes when every step is done or skipped, and summarises the changes", () => {
    let s = startWorkflow(EMPTY_WORKFLOW_STATE, SALES, log);
    s = nextStep(s, SALES, log, "/gst").state;
    act("invoice.issued");
    act("journal.posted");
    s = nextStep(s, SALES, log, "/gst").state;
    expect(isWorkflowComplete(SALES, s.progress[SALES.id])).toBe(false);
    expect(workflowStatus(SALES, s.progress[SALES.id])).toEqual({ kind: "in-progress", step: 3, of: 3 });
    act("route.visited", { path: "/reports/profit-loss" });
    s = nextStep(s, SALES, log, "/reports/profit-loss").state;
    const p = s.progress[SALES.id];
    expect(p.finishedAt).not.toBeNull();
    expect(isWorkflowComplete(SALES, p)).toBe(true);
    expect(workflowStatus(SALES, p)).toEqual({ kind: "done", skipped: 0 });
    expect(summariseChanges(log, 0).map((c) => c.label)).toEqual(["1 invoice issued", "1 voucher posted"]);
    // Back from the completion screen reopens the last step.
    expect(previousStep(s, SALES).progress[SALES.id]).toMatchObject({ stepIndex: 2, finishedAt: null });
    // Opening a finished workflow starts a fresh run.
    expect(openWorkflow(s, SALES, log).progress[SALES.id].stepIndex).toBe(0);
  });

  it("keeps progress per company", () => {
    saveWorkflowState("aster-trading", startWorkflow(EMPTY_WORKFLOW_STATE, SALES, log));
    expect(loadWorkflowState("meridian-retail")).toEqual(EMPTY_WORKFLOW_STATE);
    clearWorkflowState("meridian-retail");
    expect(loadWorkflowState("aster-trading").active).toBe(SALES.id);
    clearWorkflowState("aster-trading");
    expect(loadWorkflowState("aster-trading")).toEqual(EMPTY_WORKFLOW_STATE);
  });

  it("filters the catalogue by role, category, industry and search", () => {
    const all = [SALES, BANK, AUDIT];
    const ids = (f: Parameters<typeof filterWorkflows>[1]) => filterWorkflows(all, f).map((w) => w.code);
    expect(ids({ role: "auditor" })).toEqual(["WF-C"]);
    expect(ids({ role: "cfo" })).toEqual(["WF-C"]); // supporting role
    expect(ids({ role: "owner" })).toEqual(["WF-A"]);
    expect(ids({ category: "inventory-banking" })).toEqual(["WF-B"]);
    expect(ids({ industry: "aster-trading" })).toEqual(["WF-A", "WF-C"]);
    expect(ids({ industry: "meridian-retail", role: "accountant" })).toEqual(["WF-B"]);
    expect(ids({ query: "trace" })).toEqual(["WF-C"]);
    expect(ids({ role: "all", category: "all", industry: "all" })).toEqual(["WF-A", "WF-B", "WF-C"]);
  });

  it("builds the Start link with company, role, plan, route and workflow", () => {
    const url = new URL(workspaceHref(SALES), "http://x");
    expect(url.pathname).toBe("/learn/demo/workspace");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      company: "aster-trading",
      role: "accountant",
      plan: "go",
      route: "/gst",
      workflow: SALES.id,
    });
  });
});
