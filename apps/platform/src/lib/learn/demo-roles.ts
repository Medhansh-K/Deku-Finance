import type { OrgRole } from "@/modules/departments-members/team";

export type DemoModuleKey =
  | "gateway"
  | "vouchers"
  | "day-book"
  | "gst"
  | "gst-returns"
  | "purchases"
  | "collect"
  | "inventory"
  | "banking"
  | "reports"
  | "fpa"
  | "approvals"
  | "audit"
  | "departments-members"
  | "marketplace"
  | "executive"
  | "consultant"
  | "settings";

export type DemoActionKey =
  | "post_voucher"
  | "approve_voucher"
  | "reverse_voucher"
  | "create_draft"
  | "issue_invoice"
  | "reconcile_bank"
  | "invite_members"
  | "manage_members"
  | "manage_departments"
  | "run_payroll"
  | "edit_settings"
  | "manage_billing"
  | "view_salary"
  | "export_gstn";

export interface DemoRoleConfig {
  role: OrgRole;
  label: string;
  duty: string;
  governanceSummary: string;
  readOnly: boolean;
  salaryMasked: boolean;
  badgeTone: "amber" | "emerald" | "sky" | "indigo" | "purple" | "slate" | "zinc";
  visibleModules: DemoModuleKey[];
  allowedActions: DemoActionKey[];
  restrictedExplanations: Partial<Record<DemoActionKey, string>>;
  recommendedTutorials: string[];
  defaultRoute: string;
}

export const DEMO_ROLES: DemoRoleConfig[] = [
  {
    role: "owner",
    label: "Owner",
    duty: "Licence holder, root authority",
    governanceSummary:
      "Full operational, statutory, payroll, member-role assignment, billing, and Maker-Checker approval authority across the company.",
    readOnly: false,
    salaryMasked: false,
    badgeTone: "amber",
    visibleModules: [
      "gateway",
      "vouchers",
      "day-book",
      "gst",
      "gst-returns",
      "purchases",
      "collect",
      "inventory",
      "banking",
      "reports",
      "fpa",
      "approvals",
      "audit",
      "departments-members",
      "marketplace",
      "executive",
      "consultant",
      "settings",
    ],
    allowedActions: [
      "post_voucher",
      "approve_voucher",
      "reverse_voucher",
      "create_draft",
      "issue_invoice",
      "reconcile_bank",
      "invite_members",
      "manage_members",
      "manage_departments",
      "run_payroll",
      "edit_settings",
      "manage_billing",
      "view_salary",
      "export_gstn",
    ],
    restrictedExplanations: {},
    recommendedTutorials: ["first-setup", "administrator", "reports-control"],
    defaultRoute: "/gateway",
  },
  {
    role: "cfo",
    label: "CFO",
    duty: "Final sign-off, budgets and payouts",
    governanceSummary:
      "Approves & posts Maker-Checker drafts, runs monthly payroll, oversees FP&A/cash flow, and invites team members — without root licence ownership or org deletion.",
    readOnly: false,
    salaryMasked: false,
    badgeTone: "purple",
    visibleModules: [
      "gateway",
      "vouchers",
      "day-book",
      "gst",
      "gst-returns",
      "purchases",
      "collect",
      "inventory",
      "banking",
      "reports",
      "fpa",
      "approvals",
      "audit",
      "departments-members",
      "marketplace",
      "executive",
      "consultant",
      "settings",
    ],
    // Matches the database (lib/learn/engine/rbac.ts): the CFO approves and posts but doesn't make drafts,
    // issue invoices (issue_sales_invoice) or reverse entries (reverse_journal_entry).
    allowedActions: ["post_voucher", "approve_voucher", "reconcile_bank", "invite_members", "run_payroll", "view_salary", "export_gstn"],
    restrictedExplanations: {
      create_draft: "Drafting vouchers and invoices is done by the Owner, Admin or Accountant (journal_entries insert policy, migration 005).",
      issue_invoice: "Issuing or cancelling an invoice posts its journal; the database allows Owner or Admin only (issue_sales_invoice, migration 041).",
      reverse_voucher: "Reversals post a contra entry; the database allows Owner or Admin only (reverse_journal_entry, migration 006).",
      manage_members: "Promoting/removing existing organisation members requires Owner or Admin role (migration 002/041).",
      manage_departments: "Department schema & budget creation is restricted to Owner and Admin roles (migration 013).",
      edit_settings: "Core GSTIN regime & commercial licence ownership changes require Owner.",
      manage_billing: "Plan licence changes and billing actions require Owner authority.",
    },
    recommendedTutorials: ["reports-control", "accounting-fundamentals", "workflow-financial-close"],
    defaultRoute: "/executive",
  },
  {
    role: "admin",
    label: "Admin",
    duty: "Operations, invitations, documents",
    governanceSummary:
      "Manages departments, non-owner invitations/members, payroll runs, operational billing, and Maker-Checker approvals without granting the Owner role.",
    readOnly: false,
    salaryMasked: false,
    badgeTone: "sky",
    visibleModules: [
      "gateway",
      "vouchers",
      "day-book",
      "gst",
      "gst-returns",
      "purchases",
      "collect",
      "inventory",
      "banking",
      "reports",
      "approvals",
      "audit",
      "departments-members",
      "marketplace",
      "settings",
    ],
    allowedActions: [
      "post_voucher",
      "approve_voucher",
      "reverse_voucher",
      "create_draft",
      "issue_invoice",
      "reconcile_bank",
      "invite_members",
      "manage_members",
      "manage_departments",
      "run_payroll",
      "edit_settings",
      "view_salary",
      "export_gstn",
    ],
    restrictedExplanations: {
      manage_billing: "Only the Owner holds licence renewal and subscription authority (admins can invite non-owner members only).",
    },
    recommendedTutorials: ["administrator", "first-setup", "documents-operations"],
    defaultRoute: "/gateway",
  },
  {
    role: "accountant",
    label: "Accountant",
    duty: "Data entry, draft vouchers, reconciliation",
    governanceSummary:
      "Maker role: enters sales invoices, purchase bills, vouchers, and bank statement matching. Submits Maker-Checker drafts for Owner/CFO/Admin approval rather than self-posting.",
    readOnly: false,
    salaryMasked: true,
    badgeTone: "emerald",
    visibleModules: [
      "gateway",
      "vouchers",
      "day-book",
      "gst",
      "gst-returns",
      "purchases",
      "collect",
      "inventory",
      "banking",
      "reports",
      "approvals",
      "marketplace",
    ],
    // issue_invoice is excluded: issuing posts the invoice's journal, which post_journal_entry allows only to Owner, CFO or Admin.
    allowedActions: ["create_draft", "reconcile_bank", "export_gstn"],
    restrictedExplanations: {
      post_voucher:
        "Accountants save & submit vouchers for Maker-Checker review. Direct ledger posting requires Owner, CFO, or Admin.",
      approve_voucher:
        "Separation of duties: only an independent Checker (Owner, CFO, or Admin) may Approve & Post queued vouchers.",
      reverse_voucher: "Reversing a posted voucher requires Owner or Admin (reverse_journal_entry).",
      issue_invoice: "Accountants save draft invoices; issuing posts the journal, so the database needs Owner or Admin to issue or cancel.",
      invite_members: "Inviting team members requires Owner, CFO, or Admin.",
      manage_members: "Member role administration requires Owner or Admin.",
      manage_departments: "Department management requires Owner or Admin.",
      run_payroll: "Monthly payroll execution is restricted to Owner, CFO, or Admin (migration 022).",
      edit_settings: "Company fiscal & statutory settings require Owner or Admin.",
      manage_billing: "Licence & subscription management requires Owner.",
      view_salary: "Salary figures are masked for Accountant to protect compensation confidentiality.",
    },
    recommendedTutorials: ["accounting-fundamentals", "sales-invoicing", "purchases-expenses"],
    defaultRoute: "/vouchers",
  },
  {
    role: "analyst",
    label: "Analyst",
    duty: "FP&A, DSO/DPO analysis",
    governanceSummary:
      "Analytical access to P&L, Balance Sheet, Cash Flow, Debtors/Creditors ageing, FP&A ratios, and GST summaries without voucher posting or admin controls.",
    readOnly: true,
    salaryMasked: true,
    badgeTone: "indigo",
    visibleModules: ["gateway", "day-book", "collect", "reports", "fpa", "gst-returns", "inventory", "executive"],
    allowedActions: [],
    restrictedExplanations: {
      create_draft: "Analysts inspect operational and FP&A trends read-only and do not post or draft accounting vouchers.",
      post_voucher: "Voucher posting requires Owner, CFO, or Admin.",
      approve_voucher: "Approvals require Owner, CFO, or Admin.",
      reverse_voucher: "Voucher reversals require Owner, CFO, or Admin.",
      issue_invoice: "Issuing invoices is restricted to operational accounting roles.",
      reconcile_bank: "Bank matching is performed by Accountants and approved checkers.",
      invite_members: "Only Owner, CFO, or Admin can invite team members.",
      manage_members: "Member management requires Owner or Admin.",
      manage_departments: "Department management requires Owner or Admin.",
      run_payroll: "Payroll runs require Owner, CFO, or Admin.",
      edit_settings: "Settings changes require Owner or Admin.",
      manage_billing: "Billing changes require Owner.",
      view_salary: "Individual salary figures are masked for Analyst.",
      export_gstn: "GSTN return filing/export is restricted to filing roles.",
    },
    recommendedTutorials: ["reports-control", "workflow-financial-intelligence"],
    defaultRoute: "/reports/fpa",
  },
  {
    role: "auditor",
    label: "Auditor",
    duty: "Read-only audit and ledger inspection",
    governanceSummary:
      "Strict read-only compliance inspection across immutable Audit Trail, Day Book, Trial Balance, ITC registers, and GSTR reconciliations.",
    readOnly: true,
    salaryMasked: true,
    badgeTone: "slate",
    visibleModules: ["gateway", "day-book", "reports", "gst-returns", "purchases", "banking", "audit"],
    allowedActions: [],
    restrictedExplanations: {
      create_draft: "Auditors operate in strict read-only independence; creating or editing transactions is blocked.",
      post_voucher: "Auditors cannot mutate the general ledger.",
      approve_voucher: "Auditors verify controls and never approve operational entries.",
      reverse_voucher: "Auditors inspect reversals in the immutable Audit Log.",
      issue_invoice: "Read-only role: cannot issue or cancel invoices.",
      reconcile_bank: "Read-only role: can inspect completed bank reconciliations but cannot alter matches.",
      invite_members: "Read-only role.",
      manage_members: "Read-only role.",
      manage_departments: "Read-only role.",
      run_payroll: "Read-only role.",
      edit_settings: "Read-only role.",
      manage_billing: "Read-only role.",
      view_salary: "Employee-level compensation details remain masked during financial audit views.",
      export_gstn: "Auditors review returns read-only.",
    },
    recommendedTutorials: ["reports-control", "workflow-team-governance"],
    defaultRoute: "/audit",
  },
  {
    role: "viewer",
    label: "Viewer",
    duty: "Macro KPIs and financial reports only",
    governanceSummary:
      "Executive read-only visibility into Gateway KPIs, financial statements, and high-level receivables/payables without drill-down mutation.",
    readOnly: true,
    salaryMasked: true,
    badgeTone: "zinc",
    visibleModules: ["gateway", "reports", "executive"],
    allowedActions: [],
    restrictedExplanations: {
      create_draft: "Viewers have read-only access to macro reports and KPIs.",
      post_voucher: "Viewers cannot enter or post transactions.",
      approve_voucher: "Viewers cannot approve vouchers.",
      reverse_voucher: "Viewers cannot reverse vouchers.",
      issue_invoice: "Viewers cannot create or issue invoices.",
      reconcile_bank: "Viewers cannot modify bank reconciliations.",
      invite_members: "Viewers cannot manage team members.",
      manage_members: "Viewers cannot manage roles.",
      manage_departments: "Viewers cannot modify departments.",
      run_payroll: "Viewers cannot run payroll.",
      edit_settings: "Viewers cannot change company settings.",
      manage_billing: "Viewers cannot view or change billing.",
      view_salary: "Salary & personal employee compensation are masked for Viewer.",
      export_gstn: "GST export tools require operational or admin roles.",
    },
    recommendedTutorials: ["reports-control"],
    defaultRoute: "/reports/profit-loss",
  },
];

export function getDemoRoleConfig(role: string | null | undefined): DemoRoleConfig {
  return DEMO_ROLES.find((r) => r.role === role) ?? DEMO_ROLES[0];
}

export function canDemoRolePerform(
  role: OrgRole | string,
  action: DemoActionKey
): { allowed: boolean; reason: string } {
  const cfg = getDemoRoleConfig(role);
  if (cfg.allowedActions.includes(action)) {
    return { allowed: true, reason: `Permitted under the ${cfg.label} role.` };
  }
  return {
    allowed: false,
    reason:
      cfg.restrictedExplanations[action] ??
      `This action is restricted in ${cfg.label} view (${cfg.duty}). Switch to Owner, CFO, or Admin in the Demo Control Bar to test it.`,
  };
}

