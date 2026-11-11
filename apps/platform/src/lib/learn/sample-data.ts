import type { DemoActivity } from "./activity";
import type { BankReconciliation, DocumentFile, MarketplaceColumnMap, MarketplaceSettlement, OrgSummary, ReconciliationStatement } from "@/api/endpoints";
import type { BusinessDocument } from "@/lib/builder/business-documents";
import type { StockSourceType } from "@/lib/inventory/stock";
import type { PurchaseBill } from "@/lib/purchases/bills";
import type {
  Account,
  CatalogueItem,
  FiscalPeriod,
  JournalEntry,
  JournalEntryLine,
  Party,
  SalesInvoice,
  SalesInvoiceLine,
  SalesNote,
} from "@/types/accounting";
import type { Department, Invitation, OrgMember, PayrollRun } from "@/modules/departments-members/team";
import type { DemoCompanySlug } from "./companies";
import { getDemoCompany } from "./companies";

/**
 * The four fictional demo companies' books. Every figure is built from the same few journals the
 * engine would have posted, so the seed reconciles exactly: each journal balances, the trial
 * balance and balance sheet agree, FIFO stock value equals the inventory ledger (1050), invoice
 * totals equal their journals, and each completed bank reconciliation matches the book balance on
 * its date. tests/learn-engine-seed.test.ts checks all of that for every company.
 * Names, GSTINs, emails (.example) and banks are invented.
 */

/** A user_activity_logs row (migration 14), the feed GET /audit-events returns. */
export interface DemoAuditItem {
  id: string;
  organisation_id: string;
  created_at: string;
  actor_id: string | null;
  actor_name: string;
  actor_role: string;
  category: "VOUCHER" | "MASTER" | "DOCUMENT" | "DEPARTMENT" | "REPORT" | "SETTING" | "SECURITY";
  action: string;
  description: string;
  entity_type: string;
  entity_id: string;
  status: "success" | "info" | "warning" | "error";
  metadata: Record<string, unknown>;
}

export interface DemoWarehouse {
  id: string;
  organisation_id: string;
  code: string;
  name: string;
  is_default: boolean;
}

/** One row of stock_movements (migration 42). Immutable; a reversal points at what it voids. */
export interface DemoStockMovement {
  id: string;
  seq: number;
  organisation_id: string;
  item_id: string;
  warehouse_id: string;
  movement_date: string;
  direction: "in" | "out";
  qty: number;
  unit_cost: number | null;
  source_type: StockSourceType;
  source_id: string | null;
  narration: string | null;
  reversal_of: string | null;
  created_at: string;
}

/** A line of the supplied demo bank statement (what the bank says, not what the books say). */
export interface DemoStatementLine {
  id: string;
  date: string;
  amount: number; // + deposit, − withdrawal
  reference: string;
  narration: string;
}

/** The bank statement the demo supplies for its bank account; loading it is "importing" it. */
export interface DemoBankStatement {
  id: string;
  bank_account_id: string;
  file_name: string;
  period_from: string;
  period_to: string;
  opening_balance: number;
  closing_balance: number;
  lines: DemoStatementLine[];
  imported_at: string | null;
}

/** employees row: the pay figures run_monthly_payroll reads (migration 13/58). Invented people. */
export interface DemoEmployee {
  id: string;
  name: string;
  email: string;
  designation: string;
  department_id: string | null;
  status: "active" | "inactive";
  monthly_gross: number;
  monthly_net: number;
  tds_deduction_monthly: number;
  epf_monthly: number;
}

export interface DemoPayrollRun extends PayrollRun {
  journal_entry_id: string | null;
}

export interface DemoGstFiling {
  id: string;
  period: string;
  return_type: "gstr1" | "gstr3b";
  status: "recorded" | "filed";
  arn: string | null;
  recorded_at: string;
  filed_at: string | null;
}

/** purchase_bill_lines (migration 42): goods on a bill that move stock when the bill reaches the books. */
export interface DemoPurchaseBillLine {
  bill_id: string;
  item_id: string;
  quantity: number;
  rate: number;
}

export interface DemoDataset {
  org: OrgSummary;
  fiscalPeriods: FiscalPeriod[];
  accounts: Account[];
  parties: Party[];
  catalogue: CatalogueItem[];
  journals: JournalEntry[];
  invoices: SalesInvoice[];
  notes: SalesNote[];
  purchases: PurchaseBill[];
  purchaseLines: DemoPurchaseBillLine[];
  businessDocuments: BusinessDocument[];
  departments: Department[];
  members: OrgMember[];
  invitations: Invitation[];
  employees: DemoEmployee[];
  payrollRuns: DemoPayrollRun[];
  warehouses: DemoWarehouse[];
  stockMovements: DemoStockMovement[];
  auditEvents: DemoAuditItem[];
  bankStatements: DemoBankStatement[];
  bankMatches: BankReconciliation[];
  reconciliationStatements: ReconciliationStatement[];
  files: DocumentFile[];
  gstFilings: DemoGstFiling[];
  marketplaceSettlements: MarketplaceSettlement[];
  marketplaceColumnMaps: MarketplaceColumnMap[];
  /** Notification ids the visitor has marked read. */
  readNotifications: string[];
  /** Everything the visitor has done in this company, oldest first (lib/learn/activity.ts). */
  activity: DemoActivity[];
}

type Grp = Account["account_group"];
type Typ = Account["type"];

/** The default chart (seed_default_chart_of_accounts, migration 35) plus add_inventory_accounts (migration 42). */
const CHART: [string, string, Typ, Grp, string, string, string, boolean][] = [
  ["1000", "Assets", "asset", "asset", "Assets Root Group", "Assets Root", "Assets", false],
  ["1010", "Cash on Hand (Petty Cash Reserve)", "asset", "asset", "Cash & Liquid Capital", "Cash In-Hand", "Petty Cash Reserve", true],
  ["1020", "Operating Bank Account", "asset", "asset", "Cash & Liquid Capital", "Operating Bank Accounts", "Bank Current Account", true],
  ["1030", "Accounts Receivable (Customer Trade Debtors)", "asset", "asset", "Current Assets & Receivables", "Trade Debtors", "Customer Trade Receivables", true],
  ["1040", "Marketplace Receivable (Clearing)", "asset", "asset", "Current Assets & Receivables", "Marketplace Clearing", "Marketplace Settlement Clearing", true],
  ["1050", "Inventory (Stock-in-Trade)", "asset", "asset", "Current Assets & Receivables", "Inventory", "Inventory", true],
  ["1081", "Input CGST 9%", "asset", "asset", "Tax Assets & Input Credits", "Input GST Credits", "Input CGST 9%", true],
  ["1082", "Input SGST 9%", "asset", "asset", "Tax Assets & Input Credits", "Input GST Credits", "Input SGST 9%", true],
  ["1083", "Input IGST 18%", "asset", "asset", "Tax Assets & Input Credits", "Input GST Credits", "Input IGST 18%", true],
  ["1084", "TCS Receivable (Section 52 CGST)", "asset", "asset", "Tax Assets & Input Credits", "TCS / TDS Receivable", "GST TCS Collected by E-commerce Operators", true],
  ["1085", "TDS Receivable (Section 194-O)", "asset", "asset", "Tax Assets & Input Credits", "TCS / TDS Receivable", "Income-tax TDS by E-commerce Operators", true],
  ["2000", "Liabilities", "liability", "liability", "Liabilities Root Group", "Liabilities Root", "Liabilities", false],
  ["2010", "Accounts Payable (Trade Creditors)", "liability", "liability", "Current Liabilities & Payables", "Trade Creditors", "Domestic Vendor Payables", true],
  ["2081", "Output CGST Payable (9%)", "liability", "liability", "Statutory & Tax Liabilities", "Output GST Control", "Output CGST 9% Payable", true],
  ["2082", "Output SGST Payable (9%)", "liability", "liability", "Statutory & Tax Liabilities", "Output GST Control", "Output SGST 9% Payable", true],
  ["2083", "Output IGST Payable (18%)", "liability", "liability", "Statutory & Tax Liabilities", "Output GST Control", "Output IGST 18% Payable", true],
  ["3000", "Equity", "equity", "equity", "Equity Root Group", "Equity Root", "Equity", false],
  ["3010", "Shareholder / Owner Capital", "equity", "equity", "Owner / Contributed Capital", "Shareholder Capital", "Primary Shareholder Capital", true],
  ["3020", "Retained Earnings", "equity", "equity", "Reserves & Retained Earnings", "Retained Earnings", "Accumulated Retained Earnings", true],
  ["3030", "Opening Balance Equity", "equity", "equity", "Owner / Contributed Capital", "Opening Balances", "Opening Balance Equity", true],
  ["4000", "Operating Revenue", "income", "revenue", "Revenue Root Group", "Revenue Root", "Revenue", false],
  ["4010", "Sales Revenue - Products", "income", "revenue", "Operating Revenue / Sales", "Product Sales Revenue", "Domestic Product Sales Revenue", true],
  ["4020", "Service Fees & Professional Revenue", "income", "revenue", "Operating Revenue / Sales", "Service & Advisory Fees", "Professional Advisory & Consulting Revenue", true],
  ["4090", "Other Income & Interest", "income", "revenue", "Other Income & Receipts", "Incidental Revenue", "Interest & Miscellaneous Income", true],
  ["5000", "Operating Expenses", "expense", "expense", "Expense Root Group", "Expense Root", "Expenses", false],
  ["5010", "Cost of Goods Sold (COGS)", "expense", "expense", "Cost of Sales / Direct Delivery", "Cost of Goods Sold (COGS)", "Direct Operational Delivery Costs", true],
  ["5015", "Inventory Adjustment", "expense", "expense", "Cost of Sales / Direct Delivery", "Inventory Adjustment", "Inventory Adjustment", true],
  ["5020", "Salaries and Contractor Compensation", "expense", "expense", "Operating Overheads & Administration", "Human Resources & Payroll", "Staff Salaries & Contractor Fees", true],
  ["5030", "Cloud Infrastructure & Software", "expense", "expense", "Operating Overheads & Administration", "Technology & SaaS Infrastructure", "Cloud Infrastructure & SaaS Subscriptions", true],
  ["5040", "Office & Operational Rent", "expense", "expense", "Operating Overheads & Administration", "Facilities & Real Estate", "Office Workspace Lease & Utilities", true],
  ["5090", "Bank & Payment Processing Charges", "expense", "expense", "Operating Overheads & Administration", "Financial & Banking Charges", "Bank Transaction Fees & Payment Gateway Charges", true],
  ["5091", "Marketplace Commission & Fees", "expense", "expense", "Operating Overheads & Administration", "Selling & Marketplace Fees", "E-commerce Operator Commission & Fees", true],
];

/** Accounts run_monthly_payroll creates on first use (_payroll_liability_account, migration 58). */
export const PAYROLL_ACCOUNTS: [string, string, string, string, string][] = [
  ["2091", "Salaries Payable", "Current Liabilities & Payables", "Payroll Payable", "Net Salaries Payable"],
  ["2092", "TDS on Salaries Payable", "Statutory & Tax Liabilities", "TDS Payable", "TDS on Salaries"],
  ["2093", "EPF Payable", "Statutory & Tax Liabilities", "EPF Payable", "Employee Provident Fund Payable"],
];

export const accountId = (orgId: string, code: string) => `${orgId}-acc-${code}`;

export function makeAccount(orgId: string, code: string, name: string, type: Typ, group: Grp, ledger: string, sub: string, label: string, postable = true): Account {
  return {
    id: accountId(orgId, code),
    organisation_id: orgId,
    code,
    name,
    type,
    account_group: group,
    ledger,
    sub_ledger: sub,
    label,
    is_postable: postable,
    is_active: true,
    is_system: true,
  };
}

const chartFor = (orgId: string, withPayroll: boolean): Account[] => {
  const base = CHART.map(([c, n, t, g, l, s, lb, p]) => makeAccount(orgId, c, n, t, g, l, s, lb, p));
  if (!withPayroll) return base;
  return [...base, ...PAYROLL_ACCOUNTS.map(([c, n, l, s, lb]) => makeAccount(orgId, c, n, "liability", "liability", l, s, lb))].sort((a, b) =>
    a.code.localeCompare(b.code)
  );
};

/** The seven demo roles, held by invented people. Same people in each company; emails per company. */
const TEAM: [OrgMember["role"], string, string, string][] = [
  ["owner", "u-owner", "owner", "Siddharth Rao"],
  ["cfo", "u-cfo", "cfo", "Meera Joshi"],
  ["admin", "u-admin", "admin", "Farhan Qureshi"],
  ["accountant", "u-acc", "accounts", "Vikram Desai"],
  ["analyst", "u-analyst", "analyst", "Ishita Banerjee"],
  ["auditor", "u-aud", "audit", "Ananya Sen"],
  ["viewer", "u-viewer", "board", "Rahul Menon"],
];

type L = [code: string, debit: number, credit: number, party?: string | null, description?: string];

interface SeedCtx {
  orgId: string;
  fpId: string;
  journals: JournalEntry[];
  movements: DemoStockMovement[];
}

/** A voucher the accountant made and submitted, waiting for an approver (Owner, CFO or Admin). */
function pending(c: SeedCtx, number: string, date: string, narration: string, lines: L[]) {
  je(c, "pending", number, date, narration, lines, { status: "draft", created_by: "u-acc", created_at: `${date}T13:30:00.000Z`, submitted_by: "u-acc", submitted_at: `${date}T14:00:00.000Z` });
}

/** A posted journal: accountant makes and submits it, the CFO approves (the owner makes capital entries). */
function je(c: SeedCtx, key: string, number: string, date: string, narration: string, lines: L[], extra: Partial<JournalEntry> = {}): string {
  const id = `${c.orgId}-je-${key}`;
  const journal_entry_lines: JournalEntryLine[] = lines.map(([code, debit, credit, party, description], i) => ({
    id: `${id}-l${i + 1}`,
    journal_entry_id: id,
    line_number: i + 1,
    account_id: accountId(c.orgId, code),
    party_id: party ?? null,
    description: description ?? narration,
    debit,
    credit,
  }));
  const status = extra.status ?? "posted";
  const at = (min: number) => `${date}T${String(9 + Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}:00.000Z`;
  const maker = lines.some(([code]) => code === "3010") ? "u-owner" : "u-acc";
  c.journals.push({
    id,
    organisation_id: c.orgId,
    fiscal_period_id: c.fpId,
    entry_number: number,
    entry_date: date,
    status,
    narration,
    reference: extra.reference ?? null,
    created_at: at(0),
    created_by: maker,
    submitted_at: at(30),
    submitted_by: maker,
    ...(status === "posted" ? { posted_at: at(60), posted_by: "u-cfo" } : {}),
    journal_entry_lines,
    ...extra,
  });
  return id;
}

function mv(c: SeedCtx, item: string, wh: string, date: string, direction: "in" | "out", qty: number, unitCost: number | null, source: StockSourceType, sourceId: string | null, narration: string) {
  const seq = c.movements.length + 1;
  c.movements.push({
    id: `${c.orgId}-stk-${seq}`,
    seq,
    organisation_id: c.orgId,
    item_id: item,
    warehouse_id: wh,
    movement_date: date,
    direction,
    qty,
    unit_cost: direction === "in" ? unitCost : null,
    source_type: source,
    source_id: sourceId,
    narration,
    reversal_of: null,
    created_at: `${date}T12:00:00.000Z`,
  });
}

interface LineSpec {
  item: CatalogueItem;
  qty: number;
  rate: number;
}

/** Invoice lines with the GST split issue_sales_invoice checks (CGST = SGST intra-state, IGST inter-state). */
function invoiceLines(specs: LineSpec[], inter: boolean): SalesInvoiceLine[] {
  return specs.map(({ item, qty, rate }, i) => {
    const taxable = qty * rate;
    const gst = item.default_gst_rate;
    const tax = Math.round(taxable * gst) / 100;
    const half = Math.round((tax / 2) * 100) / 100;
    return {
      line_number: i + 1,
      item_id: item.id,
      item_name: item.name,
      hsn_sac_code: item.hsn_sac_code,
      unit_code: item.unit_code,
      quantity: qty,
      unit_price: rate,
      discount_amount: 0,
      taxable_amount: taxable,
      gst_rate: gst,
      cgst_rate: inter ? 0 : gst / 2,
      cgst_amount: inter ? 0 : half,
      sgst_rate: inter ? 0 : gst / 2,
      sgst_amount: inter ? 0 : half,
      igst_rate: inter ? gst : 0,
      igst_amount: inter ? tax : 0,
      cess_rate: 0,
      cess_amount: 0,
      total_amount: taxable + tax,
    };
  });
}

/** A seeded invoice and its JRN-<number> journal, exactly as issue_sales_invoice would post it. */
function invoice(
  c: SeedCtx,
  key: string,
  number: string,
  date: string,
  due: string,
  party: Party,
  specs: LineSpec[],
  inter: boolean,
  channel = "direct"
): SalesInvoice {
  const lines = invoiceLines(specs, inter);
  const sum = (k: keyof SalesInvoiceLine) => Math.round(lines.reduce((s, l) => s + Number(l[k] ?? 0), 0) * 100) / 100;
  const taxable = sum("taxable_amount");
  const cgst = sum("cgst_amount");
  const sgst = sum("sgst_amount");
  const igst = sum("igst_amount");
  const total = Math.round((taxable + cgst + sgst + igst) * 100) / 100;
  const debit = channel === "direct" ? "1030" : "1040";
  const jl: L[] = [
    [debit, total, 0, party.id, `Sales Invoice ${number}`],
    ["4010", 0, taxable, null, `Taxable Revenue ${number}`],
  ];
  if (cgst) jl.push(["2081", 0, cgst, null, `Output CGST ${number}`]);
  if (sgst) jl.push(["2082", 0, sgst, null, `Output SGST ${number}`]);
  if (igst) jl.push(["2083", 0, igst, null, `Output IGST ${number}`]);
  const journalId = je(c, key, `JRN-${number}`, date, `Sales Invoice ${number}`, jl, { reference: number, submitted_at: null, submitted_by: null });
  return {
    id: `${c.orgId}-inv-${key}`,
    organisation_id: c.orgId,
    customer_id: party.id,
    invoice_number: number,
    invoice_date: date,
    due_date: due,
    status: "issued",
    supply_type: inter ? "inter_state" : "intra_state",
    place_of_supply: placeOf(party),
    sales_channel: channel,
    invoice_type: "tax_invoice",
    taxable_amount: taxable,
    cgst_amount: cgst,
    sgst_amount: sgst,
    igst_amount: igst,
    cess_amount: 0,
    round_off: 0,
    total_amount: total,
    journal_entry_id: journalId,
    created_at: `${date}T09:00:00.000Z`,
    parties: { legal_name: party.legal_name, gstin: party.gstin },
    sales_invoice_lines: lines.map((l) => ({ ...l, invoice_id: `${c.orgId}-inv-${key}` })),
  };
}

const STATE_NAMES: Record<string, string> = { "07": "Delhi", "08": "Rajasthan", "27": "Maharashtra", "29": "Karnataka" };
const placeOf = (p: Party) => {
  const code = (p.gstin ?? "").slice(0, 2) || "07";
  return `${code}-${STATE_NAMES[code] ?? "State"}`;
};

function bill(
  c: SeedCtx,
  key: string,
  supplier: Party,
  billNumber: string,
  date: string,
  ownState: string,
  taxable: number,
  tax: number,
  debitCode: "1050" | "5040" | "5030",
  billLines: { item: string; qty: number; rate: number }[] = []
): { bill: PurchaseBill; lines: DemoPurchaseBillLine[] } {
  const inter = (supplier.gstin ?? "").slice(0, 2) !== ownState;
  const half = Math.round((tax / 2) * 100) / 100;
  const total = taxable + tax;
  const desc = `Bill ${billNumber} from ${supplier.legal_name}`;
  const jl: L[] = [[debitCode, taxable, 0, null, desc]];
  if (inter) jl.push(["1083", tax, 0, null, `Input IGST on ${desc}`]);
  else jl.push(["1081", half, 0, null, `Input CGST on ${desc}`], ["1082", tax - half, 0, null, `Input SGST on ${desc}`]);
  jl.push(["2010", 0, total, supplier.id, desc]);
  const journalId = je(c, key, `PUR-${supplier.gstin}-${billNumber}`, date, `[PURCHASE] Bill ${billNumber} from ${supplier.legal_name}`, jl, { reference: billNumber });
  const id = `${c.orgId}-pb-${key}`;
  return {
    bill: {
      id,
      organisation_id: c.orgId,
      party_id: supplier.id,
      supplier_name: supplier.legal_name,
      supplier_gstin: supplier.gstin ?? "",
      bill_number: billNumber,
      bill_date: date,
      place_of_supply: ownState,
      taxable_amount: taxable,
      cgst: inter ? 0 : half,
      sgst: inter ? 0 : tax - half,
      igst: inter ? tax : 0,
      cess: 0,
      total_amount: total,
      itc_eligibility: "eligible",
      blocked_reason: null,
      journal_entry_id: journalId,
      created_at: `${date}T09:00:00.000Z`,
    },
    lines: billLines.map((l) => ({ bill_id: id, item_id: l.item, quantity: l.qty, rate: l.rate })),
  };
}

const party = (orgId: string, key: string, type: Party["type"], legal: string, display: string, gstin: string | null, city: string, state: string, pincode: string, email: string): Party => ({
  id: `${orgId}-p-${key}`,
  organisation_id: orgId,
  type,
  legal_name: legal,
  display_name: display,
  gstin,
  email,
  phone: null,
  billing_address: { city, state, pincode },
  is_active: true,
});

const goods = (orgId: string, key: string, name: string, sku: string, hsn: string, unit: string, price: number, gst: number): CatalogueItem => ({
  id: `${orgId}-item-${key}`,
  organisation_id: orgId,
  type: "goods",
  name,
  sku,
  hsn_sac_code: hsn,
  unit_code: unit,
  default_unit_price: price,
  default_gst_rate: gst,
  is_taxable: true,
  track_inventory: true,
  is_active: true,
});

const service = (orgId: string, key: string, name: string, sku: string, sac: string, unit: string, price: number): CatalogueItem => ({
  id: `${orgId}-item-${key}`,
  organisation_id: orgId,
  type: "services",
  name,
  sku,
  hsn_sac_code: sac,
  unit_code: unit,
  default_unit_price: price,
  default_gst_rate: 18,
  is_taxable: true,
  track_inventory: false,
  is_active: true,
});

/**
 * The supplied bank statement: one line per bank movement in the books (same date and amount) plus
 * two the books don't have yet (a bank charge and an unidentified credit) for the visitor to resolve.
 * The October part is already reconciled; its completed snapshot is seeded with matching numbers.
 */
function bankStatement(
  c: SeedCtx,
  orgId: string,
  extras: [date: string, amount: number, reference: string, narration: string][]
): { statement: DemoBankStatement; matches: BankReconciliation[]; snapshot: ReconciliationStatement } {
  const bankId = accountId(orgId, "1020");
  const bankLines = c.journals
    .filter((j) => j.status === "posted")
    .flatMap((j) => j.journal_entry_lines.filter((l) => l.account_id === bankId).map((l) => ({ j, l })))
    .sort((a, b) => a.j.entry_date.localeCompare(b.j.entry_date));
  const lines: DemoStatementLine[] = [
    ...bankLines.map(({ j, l }, i) => ({
      id: `${orgId}-bsl-${i + 1}`,
      date: j.entry_date,
      amount: Math.round((l.debit - l.credit) * 100) / 100,
      reference: `UTR${j.entry_date.replace(/-/g, "")}${String(i + 1).padStart(4, "0")}`,
      narration: (l.debit > 0 ? "CR " : "DR ") + (j.narration.replace(/^\[[A-Z]+\]\s*/, "").slice(0, 48)),
    })),
    ...extras.map(([date, amount, reference, narration], i) => ({ id: `${orgId}-bsl-x${i + 1}`, date, amount, reference, narration })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  const closing = Math.round(lines.reduce((s, l) => s + l.amount, 0) * 100) / 100;
  const octEnd = "2026-10-31";
  const matches: BankReconciliation[] = bankLines
    .filter(({ j }) => j.entry_date <= octEnd)
    .map(({ j, l }) => {
      const sl = lines.find((x) => x.date === j.entry_date && x.amount === Math.round((l.debit - l.credit) * 100) / 100)!;
      return {
        id: `${orgId}-brec-${sl.id}`,
        organisation_id: orgId,
        bank_account_id: bankId,
        statement_date: sl.date,
        statement_amount: sl.amount,
        statement_reference: sl.reference,
        statement_narration: sl.narration,
        journal_entry_line_id: l.id!,
        reconciled_by: "u-acc",
        reconciled_at: `${octEnd}T17:00:00.000Z`,
      };
    });
  const octBook = Math.round(bankLines.filter(({ j }) => j.entry_date <= octEnd).reduce((s, { l }) => s + l.debit - l.credit, 0) * 100) / 100;
  const matched = Math.round(matches.reduce((s, m) => s + m.statement_amount, 0) * 100) / 100;
  return {
    statement: {
      id: `${orgId}-bst-1`,
      bank_account_id: bankId,
      file_name: "demo-bank-statement-oct-nov-2026.csv",
      period_from: "2026-10-01",
      period_to: "2026-11-10",
      opening_balance: 0,
      closing_balance: closing,
      lines,
      imported_at: null,
    },
    matches,
    snapshot: {
      id: `${orgId}-rst-1`,
      organisation_id: orgId,
      bank_account_id: bankId,
      statement_date: octEnd,
      closing_balance: octBook,
      book_balance: octBook,
      matched_amount: matched,
      uncleared_amount: Math.round((octBook - matched) * 100) / 100,
      statement_only_amount: 0,
      difference: 0,
      unexplained_difference: Math.round((octBook - matched) * 100) / 100,
      accepted_difference: null,
      recorded_by: "u-acc",
      recorded_by_name: "Vikram Desai",
      recorded_at: `${octEnd}T17:30:00.000Z`,
    },
  };
}

export function createInitialDemoDataset(slug: DemoCompanySlug): DemoDataset {
  return { ...buildSeedDataset(slug), activity: [] };
}

function buildSeedDataset(slug: DemoCompanySlug): Omit<DemoDataset, "activity"> {
  const tmpl = getDemoCompany(slug) ?? getDemoCompany("aster-trading")!;
  const orgId = `demo-${tmpl.slug}`;
  const fpId = `${orgId}-fp-2627`;
  const c: SeedCtx = { orgId, fpId, journals: [], movements: [] };
  const mail = (local: string) => `${local}@${tmpl.slug}.example`;
  const city = tmpl.stateCode === "29" ? "Bengaluru" : tmpl.stateCode === "07" ? "New Delhi" : "Mumbai";

  const org: OrgSummary = {
    id: orgId,
    name: tmpl.tradeName,
    slug: tmpl.slug,
    currency: "INR",
    timezone: "Asia/Kolkata",
    gstin: tmpl.gstin,
    pan: tmpl.gstin ? tmpl.gstin.slice(2, 12) : null,
    financial_year_start_month: 4,
    require_journal_approval: true,
    allow_negative_stock: false,
    operating_mode: tmpl.operatingMode,
    state_code: tmpl.stateCode,
    registered_address: {
      line1: "Plot 42, Demo Industrial Estate",
      city,
      pincode: tmpl.stateCode === "29" ? "560001" : tmpl.stateCode === "07" ? "110001" : "400001",
    },
    upi_vpa: `${tmpl.slug}@demobank`,
    bank_name: "Demo Co-operative Bank (fictional)",
    bank_beneficiary: tmpl.legalName,
    bank_ifsc: "DEMO0000123",
    bank_account_number: "000123456789",
    onboarded_at: "2026-04-01T09:00:00.000Z",
  };

  const fiscalPeriods: FiscalPeriod[] = [
    { id: fpId, organisation_id: orgId, name: "FY 2026-27", start_date: "2026-04-01", end_date: "2027-03-31", status: "open" },
  ];

  const departments: Department[] = [
    { id: `${orgId}-d1`, name: "Finance & Accounts", code: "FIN", description: "General ledger, GST and statutory audit", lead_name: "Meera Joshi", budget_allocated: 1200000, budget_utilized: 680000 },
    { id: `${orgId}-d2`, name: "Sales & Revenue Ops", code: "SLS", description: "Invoicing, collections and customer accounts", lead_name: "Priya Nair", budget_allocated: 900000, budget_utilized: 510000 },
    { id: `${orgId}-d3`, name: "Procurement & Inventory", code: "PRC", description: "Supplier bills, ITC and stock valuation", lead_name: "Rohan Kulkarni", budget_allocated: 1500000, budget_utilized: 1620000 },
    { id: `${orgId}-d4`, name: "Treasury & Banking", code: "TRS", description: "Bank reconciliation and cash control", lead_name: "Kavita Iyer", budget_allocated: 600000, budget_utilized: 310000 },
    { id: `${orgId}-d5`, name: "People & Payroll", code: "HR", description: "Monthly payroll, TDS and EPF", lead_name: "Neha Verma", budget_allocated: 1800000, budget_utilized: 1120000 },
  ];

  const members: OrgMember[] = TEAM.map(([role, userId, local, name], i) => ({
    id: `${orgId}-m${i + 1}`,
    user_id: userId,
    role,
    created_at: `2026-04-0${Math.min(i + 1, 9)}T00:00:00Z`,
    profiles: { id: userId, email: mail(local), full_name: name, avatar_url: null },
  }));

  const invitations: Invitation[] = [
    {
      id: `${orgId}-invite-1`,
      email: mail("intern"),
      role: "viewer",
      designation: "Finance intern",
      department_id: `${orgId}-d1`,
      status: "pending",
      expires_at: "2027-03-31T23:59:00Z",
      created_at: "2026-11-05T10:00:00Z",
    },
  ];

  const emp = (key: string, name: string, designation: string, dept: string, gross: number, tds: number, epf: number): DemoEmployee => ({
    id: `${orgId}-emp-${key}`,
    name,
    email: mail(key),
    designation,
    department_id: `${orgId}-${dept}`,
    status: "active",
    monthly_gross: gross,
    monthly_net: gross - tds - epf,
    tds_deduction_monthly: tds,
    epf_monthly: epf,
  });

  const wh = (key: string, code: string, name: string, isDefault: boolean): DemoWarehouse => ({ id: `${orgId}-wh-${key}`, organisation_id: orgId, code, name, is_default: isDefault });

  const auditEvents: DemoAuditItem[] = [];
  let purchases: PurchaseBill[] = [];
  let purchaseLines: DemoPurchaseBillLine[] = [];
  let invoices: SalesInvoice[] = [];
  let notes: SalesNote[] = [];
  let parties: Party[] = [];
  let catalogue: CatalogueItem[] = [];
  let warehouses: DemoWarehouse[] = [wh("1", "MAIN", "Main warehouse", true)];
  let employees: DemoEmployee[] = [];
  let payrollRuns: DemoPayrollRun[] = [];
  let withPayroll = false;
  let extras: [string, number, string, string][] = [];
  let marketplaceSettlements: MarketplaceSettlement[] = [];
  const S = tmpl.stateCode;

  if (slug === "aster-trading") {
    const c1 = party(orgId, "c1", "customer", "Bharat Switchgear Works Pvt Ltd", "Bharat Switchgear", "27AABCB1234D1ZC", "Pune", "Maharashtra", "411001", "ap@bharatswitchgear.example");
    const c2 = party(orgId, "c2", "customer", "Kaveri Infra Controls LLP", "Kaveri Infra", "27AAACK5566E1ZJ", "Nagpur", "Maharashtra", "440001", "finance@kaveriinfra.example");
    const v1 = party(orgId, "v1", "vendor", "Deccan Cables & Conductors Pvt Ltd", "Deccan Cables", "29AABCD7788K1ZW", "Bengaluru", "Karnataka", "560048", "billing@deccancables.example");
    const v2 = party(orgId, "v2", "vendor", "Konkan Freight Carriers", "Konkan Freight", "27AAFFK3344M1ZQ", "Thane", "Maharashtra", "400601", "accounts@konkanfreight.example");
    const i1 = goods(orgId, "1", "Industrial MCB Panel 63A (3-Phase)", "AST-MCB-63A", "853620", "NOS", 12000, 18);
    const i2 = goods(orgId, "2", "Armoured Copper Cable 4C x 16mm (100m)", "AST-CAB-4C16", "854460", "COIL", 20000, 18);
    parties = [c1, c2, v1, v2];
    catalogue = [i1, i2];
    warehouses = [wh("1", "BHI-01", "Bhiwandi Main Hub", true)];
    const W = warehouses[0].id;

    je(c, "cap", "JRN-2026-0001", "2026-10-01", "Partners' capital introduced into the bank account", [["1020", 2500000, 0], ["3010", 0, 2500000]]);
    const b1 = bill(c, "pb1", v1, "DC-INV-908", "2026-10-12", S, 1020000, 183600, "1050", [
      { item: i1.id, qty: 60, rate: 7000 },
      { item: i2.id, qty: 50, rate: 12000 },
    ]);
    mv(c, i1.id, W, "2026-10-12", "in", 60, 7000, "purchase_bill", b1.bill.id, "Purchase bill DC-INV-908");
    mv(c, i2.id, W, "2026-10-12", "in", 50, 12000, "purchase_bill", b1.bill.id, "Purchase bill DC-INV-908");
    je(c, "pay1", "PAY-2026-0001", "2026-10-20", "Part payment to Deccan Cables against DC-INV-908", [["2010", 700000, 0, v1.id], ["1020", 0, 700000]]);
    const inv1 = invoice(c, "1", "AST/26-27/001", "2026-10-25", "2026-11-09", c1, [{ item: i1, qty: 25, rate: 12000 }, { item: i2, qty: 15, rate: 20000 }], false);
    mv(c, i1.id, W, "2026-10-25", "out", 25, null, "sales_invoice", inv1.id, "Sales invoice AST/26-27/001");
    mv(c, i2.id, W, "2026-10-25", "out", 15, null, "sales_invoice", inv1.id, "Sales invoice AST/26-27/001");
    je(c, "cogs1", "JRN-2026-0002", "2026-10-25", "Cost of goods sold for AST/26-27/001 at FIFO cost", [["5010", 355000, 0], ["1050", 0, 355000]]);
    je(c, "rct1", "RCT-2026-0001", "2026-10-29", "Receipt from Bharat Switchgear against AST/26-27/001", [["1020", 708000, 0], ["1030", 0, 708000, c1.id]]);
    const inv2 = invoice(c, "2", "AST/26-27/002", "2026-11-02", "2026-11-17", c2, [{ item: i2, qty: 20, rate: 20000 }], false);
    mv(c, i2.id, W, "2026-11-02", "out", 20, null, "sales_invoice", inv2.id, "Sales invoice AST/26-27/002");
    je(c, "cogs2", "JRN-2026-0003", "2026-11-02", "Cost of goods sold for AST/26-27/002 at FIFO cost", [["5010", 240000, 0], ["1050", 0, 240000]]);
    je(c, "pay2", "PAY-2026-0002", "2026-11-05", "Bhiwandi godown rent for November", [["5040", 135000, 0], ["1020", 0, 135000]]);
    pending(c, "PAY-2026-0003", "2026-11-09", "Annual calibration and ISO audit fee (awaiting approval)", [["5040", 24000, 0], ["1020", 0, 24000]]);
    purchases = [b1.bill];
    purchaseLines = b1.lines;
    invoices = [inv1, inv2];
    employees = [
      emp("e1", "Kunal Shah", "Warehouse supervisor", "d3", 45000, 2000, 1800),
      emp("e2", "Pooja Iyer", "Accounts executive", "d1", 38000, 1200, 1800),
      emp("e3", "Arjun Patil", "Sales executive", "d2", 32000, 600, 1800),
    ];
    extras = [
      ["2026-11-07", -590, "CHG20261107", "DR SMS and NEFT charges for October"],
      ["2026-11-08", 50000, "UPI20261108KAVERI", "CR UPI Kaveri Infra Controls part payment"],
    ];
  } else if (slug === "northstar-consulting") {
    const c1 = party(orgId, "c1", "customer", "FinBridge Analytics Pvt Ltd", "FinBridge", "29AABCF2345G1ZS", "Bengaluru", "Karnataka", "560001", "finance@finbridge.example");
    const c2 = party(orgId, "c2", "customer", "Apex Cloud Labs India Pvt Ltd", "Apex Cloud", "27AAACA8899B1ZH", "Mumbai", "Maharashtra", "400051", "ap@apexcloud.example");
    const v1 = party(orgId, "v1", "vendor", "Indiranagar CoWork Spaces LLP", "Indiranagar CoWork", "29AAACI3344L1ZE", "Bengaluru", "Karnataka", "560038", "billing@indiranagarcowork.example");
    const v2 = party(orgId, "v2", "vendor", "Cirrus Hosting Services Pvt Ltd", "Cirrus Hosting", "29AABCC6611H1ZN", "Bengaluru", "Karnataka", "560103", "billing@cirrushosting.example");
    const s1 = service(orgId, "1", "Enterprise Cloud FinOps Retainer", "NS-FINOPS-M", "998313", "MON", 200000);
    const s2 = service(orgId, "2", "SOC-2 Compliance Readiness Sprint", "NS-SOC2-SPR", "998314", "PROJ", 500000);
    parties = [c1, c2, v1, v2];
    catalogue = [s1, s2];
    withPayroll = true;

    je(c, "cap", "JRN-2026-0001", "2026-10-01", "Opening equity infusion by the founders", [["1020", 1800000, 0], ["3010", 0, 1800000]]);
    const inv1 = invoice(c, "1", "NSC/26-27/011", "2026-10-15", "2026-10-30", c1, [{ item: s1, qty: 4, rate: 200000 }], false);
    je(c, "rct1", "RCT-2026-0001", "2026-10-22", "Receipt from FinBridge against NSC/26-27/011", [["1020", 944000, 0], ["1030", 0, 944000, c1.id]]);
    const payroll = je(c, "payroll", "PAYROLL-2026-10", "2026-10-31", "Payroll for 2026-10", [
      ["5020", 620000, 0, null, "Gross salaries 2026-10"],
      ["2091", 0, 557200, null, "Net salaries 2026-10"],
      ["2092", 0, 52000, null, "TDS 2026-10"],
      ["2093", 0, 10800, null, "EPF 2026-10"],
    ]);
    je(c, "pay1", "PAY-2026-0001", "2026-10-31", "October net salaries paid from the bank", [["2091", 557200, 0], ["1020", 0, 557200]]);
    const inv2 = invoice(c, "2", "NSC/26-27/012", "2026-11-01", "2026-11-16", c2, [{ item: s2, qty: 1, rate: 500000 }], true);
    const b1 = bill(c, "pb1", v1, "ICW/26-27/402", "2026-11-02", S, 180000, 32400, "5040");
    pending(c, "PAY-2026-0002", "2026-11-09", "Cloud hosting for November from Cirrus Hosting (awaiting approval)", [["5030", 42000, 0], ["1020", 0, 42000]]);
    purchases = [b1.bill];
    invoices = [inv1, inv2];
    employees = [
      emp("e1", "Aditya Kulkarni", "Principal consultant", "d2", 180000, 22000, 1800),
      emp("e2", "Sneha Reddy", "Senior consultant", "d2", 120000, 12000, 1800),
      emp("e3", "Karthik Rao", "Consultant", "d2", 90000, 6000, 1800),
      emp("e4", "Divya Menon", "Consultant", "d2", 85000, 5200, 1800),
      emp("e5", "Rohit Bhat", "Finance manager", "d1", 75000, 4000, 1800),
      emp("e6", "Lakshmi Nair", "People operations", "d5", 70000, 2800, 1800),
    ];
    // The October run from these six people: gross 6,20,000 = net 5,57,200 + TDS 52,000 + EPF 10,800.
    payrollRuns = [
      { id: `${orgId}-pr-1`, period: "2026-10", total_gross: 620000, total_net_disbursed: 557200, total_tds: 52000, total_epf: 10800, headcount: 6, executed_at: "2026-10-31T18:00:00Z", status: "processed", journal_entry_id: payroll },
    ];
    extras = [
      ["2026-11-03", -1180, "CHG20261103", "DR Account maintenance charges"],
      ["2026-11-06", 100000, "NEFT20261106APEX", "CR NEFT Apex Cloud Labs part payment"],
    ];
  } else if (slug === "urbannest-retail") {
    const c1 = party(orgId, "c1", "customer", "Direct D2C Checkout Pool", "D2C Direct", null, "New Delhi", "Delhi", "110016", "orders@urbannest.example");
    const c2 = party(orgId, "c2", "customer", "ShopSphere Marketplace Buyers (via e-commerce operator)", "ShopSphere buyers", null, "New Delhi", "Delhi", "110001", "settlements@shopsphere.example");
    const c3 = party(orgId, "c3", "customer", "Casa Verde Interiors LLP", "Casa Verde", "07AAFFC2211K1ZD", "New Delhi", "Delhi", "110024", "accounts@casaverde.example");
    const v1 = party(orgId, "v1", "vendor", "Jaipur Homecrafts Export House", "Jaipur Homecrafts", "08AAACJ9988P1ZF", "Jaipur", "Rajasthan", "302001", "billing@jaipurhomecrafts.example");
    const k1 = goods(orgId, "1", "Ceramic Pour-Over Carafe Set", "UN-CER-01", "691200", "SET", 2000, 12);
    const k2 = goods(orgId, "2", "Woven Organic Linen Throw", "UN-TEX-04", "630492", "PCS", 2500, 5);
    parties = [c1, c2, c3, v1];
    catalogue = [k1, k2];
    warehouses = [wh("1", "DEL-FC", "Okhla Fulfilment Centre", true)];
    const W = warehouses[0].id;

    je(c, "cap", "JRN-2026-0001", "2026-10-01", "Founder seed working capital", [["1020", 3000000, 0], ["3010", 0, 3000000]]);
    const b1 = bill(c, "pb1", v1, "JH-4410", "2026-10-08", S, 784000, 74480, "1050", [
      { item: k1.id, qty: 420, rate: 1200 },
      { item: k2.id, qty: 200, rate: 1400 },
    ]);
    mv(c, k1.id, W, "2026-10-08", "in", 420, 1200, "purchase_bill", b1.bill.id, "Purchase bill JH-4410");
    mv(c, k2.id, W, "2026-10-08", "in", 200, 1400, "purchase_bill", b1.bill.id, "Purchase bill JH-4410");
    const inv1 = invoice(c, "1", "UN/26-27/101", "2026-10-18", "2026-10-18", c1, [{ item: k1, qty: 200, rate: 2000 }], false);
    mv(c, k1.id, W, "2026-10-18", "out", 200, null, "sales_invoice", inv1.id, "Sales invoice UN/26-27/101");
    je(c, "rct1", "RCT-2026-0001", "2026-10-18", "UPI settlement of storefront batch UN/26-27/101", [["1020", 448000, 0], ["1030", 0, 448000, c1.id]]);
    je(c, "pay1", "PAY-2026-0001", "2026-10-20", "Part payment to Jaipur Homecrafts against JH-4410", [["2010", 500000, 0, v1.id], ["1020", 0, 500000]]);
    const inv2 = invoice(c, "2", "UN/26-27/102", "2026-10-26", "2026-10-31", c2, [{ item: k2, qty: 120, rate: 2500 }], false, "amazon");
    mv(c, k2.id, W, "2026-10-26", "out", 120, null, "sales_invoice", inv2.id, "Sales invoice UN/26-27/102");
    const mktJournal = je(c, "mkt1", "MKT-AMAZON-SSP-OCT-B2", "2026-10-31", "Marketplace settlement SSP-OCT-B2 (2026-10-01 to 2026-10-31)", [
      ["1020", 254200, 0, null, "Net payout"],
      ["5091", 45000, 0, null, "Marketplace commission"],
      ["5091", 5000, 0, null, "Marketplace fees"],
      ["1083", 9000, 0, null, "IGST on marketplace fees"],
      ["1084", 1500, 0, null, "GST TCS u/s 52"],
      ["1085", 300, 0, null, "TDS u/s 194-O"],
      ["1040", 0, 315000, null, "Sales less refunds"],
    ], { reference: "SSP-OCT-B2" });
    je(c, "cogs1", "JRN-2026-0002", "2026-11-01", "Cost of goods sold for October orders at FIFO cost", [["5010", 408000, 0], ["1050", 0, 408000]]);
    const inv3 = invoice(c, "3", "UN/26-27/103", "2026-11-04", "2026-12-04", c3, [{ item: k1, qty: 60, rate: 2000 }], false);
    mv(c, k1.id, W, "2026-11-04", "out", 60, null, "sales_invoice", inv3.id, "Sales invoice UN/26-27/103");
    je(c, "cogs2", "JRN-2026-0003", "2026-11-04", "Cost of goods sold for UN/26-27/103 at FIFO cost", [["5010", 72000, 0], ["1050", 0, 72000]]);
    je(c, "pay2", "PAY-2026-0002", "2026-11-05", "Fulfilment centre rent for November", [["5040", 90000, 0], ["1020", 0, 90000]]);
    pending(c, "PAY-2026-0003", "2026-11-09", "Packaging material for November dispatches (awaiting approval)", [["5040", 18500, 0], ["1020", 0, 18500]]);
    purchases = [b1.bill];
    purchaseLines = b1.lines;
    invoices = [inv1, inv2, inv3];
    marketplaceSettlements = [
      {
        id: `${orgId}-ms-1`,
        channel: "amazon",
        settlement_ref: "SSP-OCT-B2",
        period_from: "2026-10-01",
        period_to: "2026-10-31",
        gross_sales: 315000,
        refunds: 0,
        commission: 45000,
        other_fees: 5000,
        gst_on_fees: 9000,
        fee_gst_split: "igst",
        tcs_amount: 1500,
        tds_amount: 300,
        net_payout: 254200,
        journal_entry_id: mktJournal,
        source_filename: "shopsphere-settlement-oct-b2.csv",
        created_at: "2026-10-31T10:00:00.000Z",
      },
    ];
    employees = [
      emp("e1", "Tanvi Arora", "Fulfilment lead", "d3", 42000, 1500, 1800),
      emp("e2", "Imran Siddiqui", "Customer care", "d2", 30000, 0, 1800),
    ];
    extras = [
      ["2026-11-06", -1416, "PGW20261106", "DR Payment gateway charges October"],
      ["2026-11-09", 25000, "NEFT20261109UNK", "CR NEFT unidentified credit"],
    ];
  } else {
    const c1 = party(orgId, "c1", "customer", "Westside Metro Marts LLP", "Westside Metro", "27AAACW4455R1ZM", "Mumbai", "Maharashtra", "400013", "accounts@westsidemetro.example");
    const c2 = party(orgId, "c2", "customer", "Lakeview Gourmet Stores Pvt Ltd", "Lakeview Gourmet", "27AABCL7788T1ZK", "Pune", "Maharashtra", "411045", "ap@lakeviewgourmet.example");
    const v1 = party(orgId, "v1", "vendor", "Sahyadri FMCG Supply Corp", "Sahyadri Supply", "27AAACS6677Q1ZG", "Nashik", "Maharashtra", "422001", "billing@sahyadrisupply.example");
    const m1 = goods(orgId, "1", "Cold-Pressed Olive Oil 1L Tin", "MR-OIL-1L", "150910", "TIN", 800, 18);
    const m2 = goods(orgId, "2", "Single-Origin Arabica Beans 1kg", "MR-COF-1K", "090121", "BAG", 1000, 18);
    parties = [c1, c2, v1];
    catalogue = [m1, m2];
    warehouses = [wh("1", "MUM-CEN", "Mumbai Central Godown", true), wh("2", "PUN-WST", "Pune Chakan Warehouse", false)];
    const [W1, W2] = [warehouses[0].id, warehouses[1].id];

    je(c, "cap", "JRN-2026-0001", "2026-10-01", "Share capital for the Mumbai and Pune retail hubs", [["1020", 4000000, 0], ["3010", 0, 4000000]]);
    je(c, "stk1", "STK-OPENPUNE01", "2026-10-01", "Opening stock MR-COF-1K: Pune Chakan Warehouse", [["1050", 152000, 0], ["3030", 0, 152000]], { reference: "stock:opening-pune" });
    mv(c, m2.id, W2, "2026-10-01", "in", 200, 760, "opening", null, "Opening stock MR-COF-1K");
    const b1 = bill(c, "pb1", v1, "SS-2627-881", "2026-10-10", S, 1100000, 198000, "1050", [
      { item: m1.id, qty: 1300, rate: 500 },
      { item: m2.id, qty: 600, rate: 750 },
    ]);
    mv(c, m1.id, W1, "2026-10-10", "in", 1300, 500, "purchase_bill", b1.bill.id, "Purchase bill SS-2627-881");
    mv(c, m2.id, W1, "2026-10-10", "in", 600, 750, "purchase_bill", b1.bill.id, "Purchase bill SS-2627-881");
    je(c, "pay1", "PAY-2026-0001", "2026-10-18", "Part payment to Sahyadri Supply against SS-2627-881", [["2010", 900000, 0, v1.id], ["1020", 0, 900000]]);
    const inv1 = invoice(c, "1", "MR/26-27/201", "2026-10-22", "2026-11-21", c1, [{ item: m1, qty: 1000, rate: 800 }, { item: m2, qty: 400, rate: 1000 }], false);
    mv(c, m1.id, W1, "2026-10-22", "out", 1000, null, "sales_invoice", inv1.id, "Sales invoice MR/26-27/201");
    mv(c, m2.id, W1, "2026-10-22", "out", 400, null, "sales_invoice", inv1.id, "Sales invoice MR/26-27/201");
    je(c, "cogs1", "JRN-2026-0002", "2026-10-22", "Cost of goods sold for MR/26-27/201 at FIFO cost", [["5010", 800000, 0], ["1050", 0, 800000]]);
    je(c, "rct1", "RCT-2026-0001", "2026-10-28", "Collection from Westside Metro against MR/26-27/201", [["1020", 1180000, 0], ["1030", 0, 1180000, c1.id]]);
    const cnJournal = je(c, "cn1", "JRN-CN-CN/26-27/004", "2026-11-01", "Credit Note CN/26-27/004", [
      ["4010", 50000, 0, null, "Credit Note CN/26-27/004"],
      ["2081", 4500, 0, null, "Output CGST Credit Note CN/26-27/004"],
      ["2082", 4500, 0, null, "Output SGST Credit Note CN/26-27/004"],
      ["1030", 0, 59000, c1.id, "Credit Note CN/26-27/004"],
    ], { reference: "CN/26-27/004", submitted_at: null, submitted_by: null });
    je(c, "pay2", "PAY-2026-0002", "2026-11-02", "Store operating costs for November", [["5040", 210000, 0], ["1020", 0, 210000]]);
    pending(c, "PAY-2026-0003", "2026-11-09", "Cold-chain van hire, Pune route (awaiting approval)", [["5040", 32000, 0], ["1020", 0, 32000]]);
    purchases = [b1.bill];
    purchaseLines = b1.lines;
    invoices = [inv1];
    notes = [
      {
        id: `${orgId}-cn-1`,
        organisation_id: orgId,
        note_type: "credit",
        original_invoice_id: inv1.id,
        customer_id: c1.id,
        note_number: "CN/26-27/004",
        note_date: "2026-11-01",
        reason_code: "deficiency_in_service",
        reason: "Damaged transit cartons (goods written off by the customer, not returned)",
        status: "issued",
        supply_type: "intra_state",
        place_of_supply: "27-Maharashtra",
        taxable_amount: 50000,
        total_tax: 9000,
        total_amount: 59000,
        journal_entry_id: cnJournal,
        parties: { legal_name: c1.legal_name, gstin: c1.gstin },
      },
    ];
    employees = [
      emp("e1", "Sameer Joshi", "Godown manager", "d3", 48000, 2200, 1800),
      emp("e2", "Ritu Kapoor", "Store accountant", "d1", 40000, 1400, 1800),
      emp("e3", "Nikhil Pawar", "Key account manager", "d2", 52000, 2600, 1800),
    ];
    extras = [
      ["2026-11-04", -885, "CHG20261104", "DR Card machine rental"],
      ["2026-11-07", 40000, "NEFT20261107WSM", "CR NEFT Westside Metro part payment"],
    ];
  }

  const bank = bankStatement(c, orgId, extras);
  // post_journal_entry logs every posting (record_user_activity); newest first, as the feed returns them.
  for (const j of c.journals.filter((x) => x.status === "posted")) {
    auditEvents.unshift({
      id: `${orgId}-aud-${j.id}`,
      organisation_id: orgId,
      created_at: j.posted_at!,
      actor_id: "u-cfo",
      actor_name: "Meera Joshi",
      actor_role: "cfo",
      category: "VOUCHER",
      action: "Voucher Posted to Universal Ledger",
      description: `Posted voucher ${j.entry_number} to the general ledger`,
      entity_type: "journal_entry",
      entity_id: j.id,
      status: "success",
      metadata: { entry_number: j.entry_number, entry_date: j.entry_date },
    });
  }

  return {
    org,
    fiscalPeriods,
    accounts: chartFor(orgId, withPayroll),
    parties,
    catalogue,
    journals: c.journals,
    invoices,
    notes,
    purchases,
    purchaseLines,
    businessDocuments: [],
    departments,
    members,
    invitations,
    employees,
    payrollRuns,
    warehouses,
    stockMovements: c.movements,
    auditEvents,
    bankStatements: [bank.statement],
    bankMatches: bank.matches,
    reconciliationStatements: [bank.snapshot],
    files: [],
    gstFilings: [],
    marketplaceSettlements,
    marketplaceColumnMaps: [],
    readNotifications: [],
  };
}

/**
 * The supplied statement as a bank-style CSV (HDFC column layout) that the Reconciliation screen's
 * in-browser parser reads. Offer it for download in the tour; the file never reaches a server.
 */
export function demoStatementCsv(statement: DemoBankStatement): string {
  const dmy = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
  const q = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  let bal = statement.opening_balance;
  const rows = statement.lines.map((l) => {
    bal = Math.round((bal + l.amount) * 100) / 100;
    return [dmy(l.date), q(l.narration), l.reference, l.amount < 0 ? (-l.amount).toFixed(2) : "", l.amount > 0 ? l.amount.toFixed(2) : "", bal.toFixed(2)].join(",");
  });
  return ["Date,Narration,Chq./Ref.No.,Withdrawal Amt.,Deposit Amt.,Closing Balance", ...rows].join("\n") + "\n";
}
