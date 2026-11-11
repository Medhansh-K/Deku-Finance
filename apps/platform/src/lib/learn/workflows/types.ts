/**
 * The Learn Centre's workflow format. One definition drives the catalogue card, the tour,
 * step validation (against the activity log, lib/learn/activity.ts) and the docs link.
 */
import type { OrgRole } from "@/modules/departments-members/team";
import type { StepExpectation } from "../activity";
import type { DemoCompanySlug } from "../companies";
import type { DemoPlanId } from "../demo-plans";

export type WorkflowCategory =
  | "daily-accounting"
  | "sales-purchases"
  | "inventory-banking"
  | "financial-management"
  | "business-administration"
  | "audit-compliance"
  | "complete-cycle";

export type WorkflowDifficulty = "starter" | "intermediate" | "advanced";

/** Screen areas a workflow touches, shown on its card. */
export type WorkflowModule =
  | "sales" | "purchases" | "vouchers" | "day-book" | "inventory" | "banking" | "gst"
  | "reports" | "fpa" | "executive" | "consultant" | "settings" | "team" | "approvals" | "audit" | "masters";

export interface LearnWorkflowStep {
  id: string;
  title: string;
  /** What to do and why, in plain words. */
  body: string;
  /** Screen the step happens on; the tour opens it. */
  route: string;
  /** `data-tour` value of the element to highlight. Must exist on that screen. */
  target?: string;
  /** Role the step is done as; the tour switches role first when it differs. */
  role?: OrgRole;
  /** What the visitor must actually do. Omitted only for pure read steps, which complete on arrival. */
  expect?: StepExpectation;
  /** What changes in the books when the step is done, for the step card. */
  impact?: string;
}

export interface LearnWorkflow {
  /** `wf-01-sales-invoice` … `wf-18-close-cycle` */
  id: string;
  /** `WF-01` … `WF-18` */
  code: string;
  name: string;
  description: string;
  category: WorkflowCategory;
  primaryRole: OrgRole;
  supportingRoles: OrgRole[];
  /** Companies the workflow fits. If a company is missing, `industryNote` says why and what to try. */
  industries: DemoCompanySlug[];
  industryNote?: string;
  /** Company the Start button opens. */
  recommendedCompany: DemoCompanySlug;
  modules: WorkflowModule[];
  minPlan: DemoPlanId;
  startRoute: string;
  /** Data the workflow needs in the books before it starts, in words. */
  startingData: string;
  estimatedMinutes: number;
  difficulty: WorkflowDifficulty;
  steps: LearnWorkflowStep[];
  /** The completion condition from the spec, in words. */
  completion: string;
  /** Learn Centre article slugs: `category/slug`. */
  docs: string[];
}
