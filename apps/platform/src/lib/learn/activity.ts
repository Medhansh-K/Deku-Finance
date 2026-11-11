/**
 * The Learn Centre's activity recorder: one ordered log of everything a visitor does in the
 * public demo. The demo engine (demo-api.ts) records a business event on every write it applies;
 * the workspace records screen visits and role/company switches. Workflows validate steps
 * against this log, so a step completes only when the matching activity really happened.
 *
 * Everything stays in the visitor's browser (see demo-store.ts). Nothing here reaches a server.
 */
import type { OrgRole } from "@/modules/departments-members/team";

/** Every activity the demo can record. `refs` keys per type are listed beside each. */
export const DEMO_ACTIVITY_TYPES = [
  "route.visited", // path
  "role.switched", // role
  "company.switched", // company
  "demo.reset", // company

  "party.created", // partyId, name, kind ("customer" | "vendor")
  "item.created", // itemId, name
  "account.created", // accountId, code, name

  "invoice.created", // invoiceId, number, total
  "invoice.issued", // invoiceId, number, journalId, total
  "invoice.cancelled", // invoiceId, number, reversalJournalId
  "note.created", // noteId, number, noteType ("credit_note" | "debit_note")
  "note.issued", // noteId, number, journalId, total

  "purchase.created", // purchaseId, number, total, itc ("eligible" | "blocked")

  "journal.created", // journalId, number, voucherType, total, status
  "journal.updated", // journalId, number
  "journal.submitted", // journalId, number
  "journal.posted", // journalId, number, total
  "journal.rejected", // journalId, number, reason
  "journal.reversed", // journalId, number, reversalJournalId

  "stock.adjusted", // itemId, warehouseId, direction ("in" | "out"), quantity, value

  "bank.statement_imported", // statementId, lines
  "bank.matched", // statementId, lineId, journalId
  "bank.unmatched", // statementId, lineId
  "bank.reconciled", // reconciliationId, difference

  "member.invited", // invitationId, email, role
  "member.role_changed", // memberId, from, to
  "department.updated", // departmentId, field

  "settings.updated", // fields (comma-separated)
  "marketplace.settlement_posted", // settlementId, journalId
  "payroll.run", // runId, journalId
  "consultant.asked", // question
  "report.viewed", // report ("trial-balance" | "profit-loss" | "balance-sheet" | "cash-flow" | "general-ledger" | "debtors" | "creditors" | "fpa" | "operating-expenses" | "gstr1" | "gstr3b")
  "document.attached", // journalId, fileName
] as const;

export type DemoActivityType = (typeof DEMO_ACTIVITY_TYPES)[number];

export type DemoActivityRefs = Record<string, string | number | boolean>;

export interface DemoActivity {
  /** Monotonic within one company's log: `act-1`, `act-2`, … */
  id: string;
  seq: number;
  type: DemoActivityType;
  /** ISO time of the visitor's action (real clock; the books keep their own dates). */
  at: string;
  role: OrgRole;
  summary: string;
  refs?: DemoActivityRefs;
}

/** Browser event fired for every recorded activity, so open tours can react immediately. */
export const DEMO_ACTIVITY_EVENT = "deku-learn-activity";

export function nextActivity(
  log: readonly DemoActivity[],
  type: DemoActivityType,
  role: OrgRole,
  summary: string,
  refs?: DemoActivityRefs,
  now: Date = new Date()
): DemoActivity {
  const seq = (log.at(-1)?.seq ?? 0) + 1;
  return { id: `act-${seq}`, seq, type, at: now.toISOString(), role, summary, refs };
}

/** What a workflow step waits for. */
export type StepExpectation =
  | { kind: "visit"; route: string }
  | { kind: "event"; type: DemoActivityType; match?: DemoActivityRefs; role?: OrgRole };

/** True when an activity after `sinceSeq` satisfies the expectation. */
export function isSatisfied(
  log: readonly DemoActivity[],
  expect: StepExpectation,
  sinceSeq = 0
): DemoActivity | null {
  for (const a of log) {
    if (a.seq <= sinceSeq) continue;
    if (expect.kind === "visit") {
      if (a.type === "route.visited" && String(a.refs?.path ?? "").split("?")[0] === expect.route) return a;
      continue;
    }
    if (a.type !== expect.type) continue;
    if (expect.role && a.role !== expect.role) continue;
    if (expect.match && !Object.entries(expect.match).every(([k, v]) => a.refs?.[k] === v)) continue;
    return a;
  }
  return null;
}

const SCREEN_NAMES: Record<string, string> = {
  "/gateway": "Gateway", "/executive": "Executive summary", "/consultant": "Deku Consultant",
  "/vouchers": "Vouchers", "/vouchers/contra": "Contra voucher", "/vouchers/payment": "Payment voucher",
  "/vouchers/receipt": "Receipt voucher", "/vouchers/journal": "Journal voucher", "/vouchers/sales": "Sales voucher",
  "/vouchers/purchase": "Purchase voucher", "/day-book": "Day Book", "/approvals": "Approvals", "/audit": "Audit log",
  "/gst": "Sales & GST invoices", "/gst/returns": "GST returns", "/gst/file": "GST filing", "/purchases": "Purchases & ITC",
  "/collect": "Collections", "/inventory": "Inventory & stock", "/banking/reconciliation": "Bank reconciliation",
  "/reconciliation": "Reconciliation & settlements", "/builder": "Document builder",
  "/masters/chart-of-accounts": "Chart of accounts", "/masters/parties": "Parties", "/masters/products-services": "Stock & services",
  "/reports/trial-balance": "Trial Balance", "/reports/profit-loss": "Profit & Loss", "/reports/balance-sheet": "Balance Sheet",
  "/reports/general-ledger": "General Ledger", "/reports/cash-flow": "Cash Flow", "/reports/debtors": "Debtors & DSO",
  "/reports/creditors": "Creditors & DPO", "/reports/fpa": "FP&A", "/reports/operating-expenses": "Operating expenses",
  "/departments-members": "Departments & members", "/settings": "Settings", "/help": "Help & tutorials",
  "/companies": "Company", "/import": "Import", "/export": "Export", "/kyc": "Identity & KYC",
};

const REPORT_NAMES: Record<string, string> = {
  "trial-balance": "Trial Balance", "profit-loss": "Profit & Loss", "balance-sheet": "Balance Sheet",
  "cash-flow": "Cash Flow", "general-ledger": "General Ledger", debtors: "Debtors ageing", creditors: "Creditors ageing",
  fpa: "FP&A", "operating-expenses": "Operating expenses", gstr1: "GSTR-1", gstr3b: "GSTR-3B",
};

/** "Day Book" for "/day-book?x=1"; unknown paths fall back to the path itself. */
export function screenName(path: string): string {
  const p = path.split("?")[0];
  return SCREEN_NAMES[p] ?? p;
}

export function reportName(report: string): string {
  return REPORT_NAMES[report] ?? report.replace(/-/g, " ");
}
