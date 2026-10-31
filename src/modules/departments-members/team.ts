import { limitReached, type Entitlements } from "@/lib/subscription/entitlements";

/** The 7-role matrix from migration 016. */
export const ROLES = [
  { value: "owner", label: "Owner", duty: "Licence holder, root authority" },
  { value: "cfo", label: "CFO", duty: "Final sign-off, budgets and payouts" },
  { value: "admin", label: "Admin", duty: "Operations, invitations, documents" },
  { value: "accountant", label: "Accountant", duty: "Data entry, draft vouchers, reconciliation" },
  { value: "analyst", label: "Analyst", duty: "FP&A, DSO/DPO analysis" },
  { value: "auditor", label: "Auditor", duty: "Read-only audit and ledger inspection" },
  { value: "viewer", label: "Viewer", duty: "Macro KPIs and financial reports only" },
] as const;

export type OrgRole = (typeof ROLES)[number]["value"];

export const roleLabel = (role: string) => ROLES.find((r) => r.value === role)?.label ?? role;

export interface OrgMember {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
  profiles: { id: string; email: string | null; full_name: string | null; avatar_url: string | null } | null;
}

export interface Invitation {
  id: string;
  email: string;
  role: string;
  designation: string;
  department_id: string | null;
  status: "pending" | "accepted" | "revoked" | "expired";
  expires_at: string;
  created_at: string;
  token?: string;
}

export interface DepartmentTask {
  id: string;
  title: string;
  task_type: "intra" | "inter";
  priority: "low" | "medium" | "high" | "urgent";
  status: "todo" | "in_progress" | "review" | "completed";
  assigned_to_name: string | null;
  target_department_name: string | null;
  due_date: string | null;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  description: string | null;
  lead_name: string | null;
  budget_allocated: number | null;
  budget_utilized: number | null;
  department_tasks?: DepartmentTask[];
}

export interface PayrollRun {
  id: string;
  period: string;
  total_gross: number;
  total_net_disbursed: number;
  total_tds: number;
  total_epf: number;
  headcount: number;
  executed_at: string;
  status: string;
}

/** What run_monthly_payroll returns. */
export type PayrollResult =
  | { success: true; payroll_run_id: string; period: string; headcount: number; total_net_disbursed: number; total_tds: number; total_epf: number }
  | { success: false; message: string };

// Mirrors the database checks; the server still enforces each of them.
const has = (roles: readonly string[]) => (role: string | null | undefined) => !!role && roles.includes(role);
/** invite_user_to_organisation (migration 016) */
export const canInvite = has(["owner", "cfo", "admin"]);
/** run_monthly_payroll (migration 022) */
export const canRunPayroll = has(["owner", "cfo", "admin"]);
/** protect_membership_changes + organisation_members RLS (migrations 002, 041) */
export const canManageMembers = has(["owner", "admin"]);
/** departments RLS (migration 013) */
export const canManageDepartments = has(["owner", "admin"]);

/** Only an owner may grant the owner role. */
export const assignableRoles = (myRole: string | null | undefined): OrgRole[] =>
  ROLES.map((r) => r.value).filter((r) => r !== "owner" || myRole === "owner");

export const memberName = (m: OrgMember) => m.profiles?.full_name?.trim() || m.profiles?.email || "–";

/** A pending invitation past its expiry is shown as expired, as accepting it would fail. */
export const inviteStatus = (inv: Invitation, nowMs: number): Invitation["status"] =>
  inv.status === "pending" && Date.parse(inv.expires_at) <= nowMs ? "expired" : inv.status;

/** check_org_seat_availability counts members plus unexpired pending invitations. */
export function seatUsage(e: Entitlements | null | undefined, members: number, pendingInvites: number) {
  const used = members + pendingInvites;
  const limit = typeof e?.seats === "number" ? e.seats : null;
  return { used, limit, reached: limitReached(e, "seats", used) };
}
