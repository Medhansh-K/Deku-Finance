/**
 * Who may do what, copied from the database (has_role checks in the SQL functions and RLS
 * policies under supabase/migrations). Where a function calls another, the effective set is the
 * intersection: issuing an invoice with its journal runs post_journal_entry, so only roles both
 * functions allow can do it. The demo is never looser than this table.
 */
import { ApiError } from "@/api/client";
import type { OrgRole } from "@/modules/departments-members/team";
import { getDemoRoleConfig } from "../demo-roles";
import type { DemoApiRuntimeContext } from "../demo-api";

const R = (...roles: OrgRole[]) => roles;

export const SQL_ROLES = {
  // RLS journal_entries_insert_draft / edit_draft_journal (migrations 5, 55)
  createDraft: R("owner", "admin", "accountant"),
  // submit_journal_for_approval (migration 20)
  submitVoucher: R("owner", "cfo", "admin", "accountant"),
  // post_journal_entry, reject_journal_entry (migration 20)
  approveVoucher: R("owner", "cfo", "admin"),
  // reverse_journal_entry allows owner/admin/accountant, then posts the reversal through post_journal_entry (owner/cfo/admin)
  reverseVoucher: R("owner", "admin"),
  // RLS sales_invoices_insert_draft (migration 7)
  createInvoice: R("owner", "admin", "accountant"),
  // issue_sales_invoice (owner/admin/accountant, migration 41) ∩ post_journal_entry for its journal (owner/cfo/admin)
  issueInvoice: R("owner", "admin"),
  // cancel_sales_invoice → reverse_journal_entry → post_journal_entry
  cancelInvoice: R("owner", "admin"),
  // sales_notes_insert_draft (migration 31)
  createNote: R("owner", "admin", "accountant"),
  // issue_sales_note / cancel_sales_note (owner/admin/accountant) ∩ post_journal_entry
  issueNote: R("owner", "admin"),
  // purchase_bills insert/update/delete (migration 24)
  purchaseBill: R("owner", "cfo", "admin", "accountant"),
  // parties / catalogue insert-update (migrations 3, 4)
  masters: R("owner", "admin", "accountant"),
  // accounts_manage (migration 5)
  accounts: R("owner", "admin", "accountant"),
  // record_stock_adjustment (migration 42); its journal posts for owner/cfo/admin, else waits for approval
  stockAdjust: R("owner", "admin", "accountant"),
  // warehouses insert/update (migration 42); delete is owner/admin
  warehouseWrite: R("owner", "admin", "accountant"),
  warehouseDelete: R("owner", "admin"),
  // bank_reconciliations insert/delete, reconciliation_statements insert (migrations 52, 56)
  reconcileBank: R("owner", "cfo", "admin", "accountant"),
  // organisations_update_admins (migration 2)
  settings: R("owner", "admin"),
  // invite_user_to_organisation (migration 16)
  invite: R("owner", "cfo", "admin"),
  // protect_membership_changes (migration 41)
  manageMembers: R("owner", "admin"),
  // departments_modify_owners (migration 13)
  departments: R("owner", "admin"),
  // tasks_modify_permitted (migration 13)
  tasks: R("owner", "admin", "accountant"),
  // run_monthly_payroll (migration 58)
  payroll: R("owner", "cfo", "admin"),
  // business_documents insert/update (migration 44); delete is owner/admin
  businessDocs: R("owner", "admin", "accountant"),
  businessDocsDelete: R("owner", "admin"),
  // gst_return_filings, files: owner/cfo/admin/accountant record work
  gstRecord: R("owner", "cfo", "admin", "accountant"),
  files: R("owner", "cfo", "admin", "accountant"),
  // invoice_payment_links insert (migration 36)
  paymentLink: R("owner", "admin", "cfo", "accountant"),
} satisfies Record<string, OrgRole[]>;

export type SqlAction = keyof typeof SQL_ROLES;

const ROLE_LIST = (roles: readonly OrgRole[]) => roles.map((r) => getDemoRoleConfig(r).label).join(", ");

/** Throws a 403 the screen shows, and raises the demo's "blocked" notice, when the role may not act. */
export function assertRole(ctx: DemoApiRuntimeContext, action: SqlAction, what: string) {
  const role = ctx.getRole();
  const allowed = SQL_ROLES[action] as readonly OrgRole[];
  if (allowed.includes(role)) return;
  const label = getDemoRoleConfig(role).label;
  const reason = `Permission denied: ${what} needs the ${ROLE_LIST(allowed)} role. You're previewing ${label}.`;
  ctx.notifyAction(`Blocked for ${label}`, reason, "blocked");
  throw new ApiError(reason, 403, { code: "permission_denied", action, label: what });
}

export const roleMay = (role: OrgRole, action: SqlAction) => (SQL_ROLES[action] as readonly OrgRole[]).includes(role);
