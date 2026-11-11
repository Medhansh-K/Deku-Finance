import type { OrgSummary } from "@/api/endpoints";
import type { BusinessDocument } from "@/lib/builder/business-documents";
import type { StockSummaryRow } from "@/lib/inventory/stock";
import type { PurchaseBill } from "@/lib/purchases/bills";
import type {
  Account,
  CatalogueItem,
  FiscalPeriod,
  JournalEntry,
  Party,
  SalesInvoice,
  SalesNote,
} from "@/types/accounting";
import type {
  Department,
  Invitation,
  OrgMember,
  PayrollRun,
} from "@/modules/departments-members/team";
import type { DemoCompanySlug } from "./companies";
import { getDemoCompany } from "./companies";

export interface DemoMarketplaceSettlement {
  id: string;
  organisation_id: string;
  channel: string;
  batch_reference: string;
  settlement_date: string;
  gross_sales: number;
  commission_fee: number;
  tcs_deducted: number;
  net_payout: number;
  gst_rate: number;
  eco_gstin: string;
  status: "draft" | "posted";
  journal_entry_id?: string | null;
}

export interface DemoAuditItem {
  id: string;
  created_at: string;
  actor_email: string;
  actor_role: string;
  action: string;
  entity_type: string;
  entity_id: string;
  summary: string;
}

export interface DemoWarehouse {
  id: string;
  organisation_id: string;
  code: string;
  name: string;
  city: string;
  state_code: string;
  is_default: boolean;
  is_active: boolean;
}

export interface DemoBankReconciliation {
  id: string;
  bank_account_id: string;
  statement_date: string;
  statement_closing_balance: number;
  book_balance: number;
  matched_count: number;
  status: "completed" | "in_progress";
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
  businessDocuments: BusinessDocument[];
  departments: Department[];
  members: OrgMember[];
  invitations: Invitation[];
  payrollRuns: PayrollRun[];
  warehouses: DemoWarehouse[];
  stockSummary: StockSummaryRow[];
  marketplaceSettlements: DemoMarketplaceSettlement[];
  auditEvents: DemoAuditItem[];
  reconciliations: DemoBankReconciliation[];
}

function makeStandardAccounts(orgId: string): Account[] {
  const mk = (
    code: string,
    name: string,
    type: Account["type"],
    account_group: Account["account_group"],
    ledger: string
  ): Account => ({
    id: `${orgId}-acc-${code}`,
    organisation_id: orgId,
    code,
    name,
    type,
    account_group,
    ledger,
    sub_ledger: name,
    label: `${code} · ${name}`,
    is_postable: true,
    is_active: true,
    is_system: true,
  });

  return [
    mk("1010", "Petty Cash", "asset", "asset", "Cash & Liquid Capital"),
    mk("1020", "HDFC Bank Current A/c", "asset", "asset", "Cash & Liquid Capital"),
    mk("1030", "Accounts Receivable (Sundry Debtors)", "asset", "asset", "Trade Receivables"),
    mk("1040", "Inventory / Stock-in-Hand", "asset", "asset", "Current Assets"),
    mk("1050", "Input CGST Credit", "asset", "asset", "GST Input Tax Credit"),
    mk("1051", "Input SGST Credit", "asset", "asset", "GST Input Tax Credit"),
    mk("1052", "Input IGST Credit", "asset", "asset", "GST Input Tax Credit"),
    mk("1060", "Marketplace Escrow & TCS Receivable", "asset", "asset", "Current Assets"),
    mk("2010", "Accounts Payable (Sundry Creditors)", "liability", "liability", "Trade Payables"),
    mk("2020", "Output CGST Payable", "liability", "liability", "GST Output Tax Liability"),
    mk("2021", "Output SGST Payable", "liability", "liability", "GST Output Tax Liability"),
    mk("2022", "Output IGST Payable", "liability", "liability", "GST Output Tax Liability"),
    mk("2030", "TDS & EPF Statutory Payables", "liability", "liability", "Statutory Liabilities"),
    mk("3010", "Share Capital & Retained Earnings", "equity", "equity", "Equity & Reserves"),
    mk("4010", "Operating Revenue", "income", "revenue", "Sales & Services"),
    mk("5010", "Cost of Goods Sold / Purchases", "expense", "expense", "Direct Expenses"),
    mk("5020", "Salaries, Commissions & Overheads", "expense", "expense", "Operating Expenses"),
  ];
}

function accId(orgId: string, code: string): string {
  return `${orgId}-acc-${code}`;
}

/**
 * Maker-checker trail for the demo, using only the members defined below: the accountant
 * (the owner for capital entries) makes and submits each voucher, and the CFO approves and
 * posts it. Times sit on the voucher's own date, an hour and half an hour before posting.
 */
function withApprovalTrail(journals: JournalEntry[]): JournalEntry[] {
  const before = (iso: string, minutes: number) => new Date(Date.parse(iso) - minutes * 60_000).toISOString();
  return journals.map((j) => {
    const at = j.posted_at ?? j.submitted_at;
    if (!at) return j;
    const maker = j.journal_entry_lines.some((l) => l.account_id.endsWith("-acc-3010")) ? "u-owner" : "u-acc";
    return {
      created_by: maker,
      created_at: before(at, 60),
      submitted_by: maker,
      submitted_at: before(at, 30),
      ...(j.status === "posted" ? { posted_by: "u-cfo" } : {}),
      ...j,
    };
  });
}

export function createInitialDemoDataset(slug: DemoCompanySlug): DemoDataset {
  const tmpl = getDemoCompany(slug) ?? getDemoCompany("aster-trading")!;
  const orgId = `demo-${tmpl.slug}`;
  const fpId = `${orgId}-fp-2627`;
  const accounts = makeStandardAccounts(orgId);

  const org: OrgSummary = {
    id: orgId,
    name: tmpl.tradeName,
    slug: tmpl.slug,
    currency: "INR",
    timezone: "Asia/Kolkata",
    gstin: tmpl.gstin,
    pan: tmpl.gstin ? tmpl.gstin.slice(2, 12) : "AAZFA0001A",
    financial_year_start_month: 4,
    require_journal_approval: true,
    allow_negative_stock: false,
    operating_mode: tmpl.operatingMode,
    state_code: tmpl.stateCode,
    registered_address: {
      line1: "Plot 42, Industrial & Commercial Park",
      city: tmpl.stateCode === "29" ? "Bengaluru" : tmpl.stateCode === "07" ? "New Delhi" : "Mumbai",
      pincode: tmpl.stateCode === "29" ? "560001" : tmpl.stateCode === "07" ? "110001" : "400001",
    },
    upi_vpa: `${tmpl.slug}@okicici`,
    bank_name: "HDFC Bank Ltd.",
    bank_beneficiary: tmpl.legalName,
    bank_ifsc: "HDFC0000123",
    bank_account_number: "50200048192011",
    onboarded_at: "2026-04-01T09:00:00.000Z",
  };

  const fiscalPeriods: FiscalPeriod[] = [
    {
      id: fpId,
      organisation_id: orgId,
      name: "FY 2026-27",
      start_date: "2026-04-01",
      end_date: "2027-03-31",
      status: "open",
    },
  ];

  const baseDepartments: Department[] = [
    { id: `${orgId}-d1`, name: "Finance & Accounts", code: "FIN", description: "General ledger, GST & statutory audit", lead_name: "Aarav Mehta", budget_allocated: 1200000, budget_utilized: 680000 },
    { id: `${orgId}-d2`, name: "Sales & Revenue Ops", code: "SLS", description: "Invoicing, collections & customer accounts", lead_name: "Priya Nair", budget_allocated: 900000, budget_utilized: 510000 },
    { id: `${orgId}-d3`, name: "Procurement & Inventory", code: "PRC", description: "Supplier bills, ITC & stock valuation", lead_name: "Rohan Kulkarni", budget_allocated: 1500000, budget_utilized: 920000 },
    { id: `${orgId}-d4`, name: "Treasury & Banking", code: "TRS", description: "Bank reconciliation & cash flow control", lead_name: "Kavita Iyer", budget_allocated: 600000, budget_utilized: 310000 },
    { id: `${orgId}-d5`, name: "People & Payroll", code: "HR", description: "Monthly payroll, TDS & EPF statutory runs", lead_name: "Neha Verma", budget_allocated: 1800000, budget_utilized: 1120000 },
  ];

  const members: OrgMember[] = [
    { id: `${orgId}-m1`, user_id: "u-owner", role: "owner", created_at: "2026-04-01T00:00:00Z", profiles: { id: "u-owner", email: `owner@${tmpl.slug}.example`, full_name: "Siddharth Rao (Owner)", avatar_url: null } },
    { id: `${orgId}-m2`, user_id: "u-cfo", role: "cfo", created_at: "2026-04-02T00:00:00Z", profiles: { id: "u-cfo", email: `cfo@${tmpl.slug}.example`, full_name: "Meera Joshi (CFO)", avatar_url: null } },
    { id: `${orgId}-m3`, user_id: "u-acc", role: "accountant", created_at: "2026-04-03T00:00:00Z", profiles: { id: "u-acc", email: `accounts@${tmpl.slug}.example`, full_name: "Vikram Desai (Accountant)", avatar_url: null } },
    { id: `${orgId}-m4`, user_id: "u-aud", role: "auditor", created_at: "2026-04-04T00:00:00Z", profiles: { id: "u-aud", email: `audit@${tmpl.slug}.example`, full_name: "CA Ananya Sen (Auditor)", avatar_url: null } },
  ];

  const invitations: Invitation[] = [
    {
      id: `${orgId}-inv1`,
      email: `analyst@${tmpl.slug}.example`,
      role: "analyst",
      designation: "FP&A Analyst",
      department_id: `${orgId}-d1`,
      status: "pending",
      expires_at: "2027-01-15T00:00:00Z",
      created_at: "2026-11-05T10:00:00Z",
    },
  ];

  const auditEvents: DemoAuditItem[] = [
    {
      id: `${orgId}-aud-1`,
      created_at: "2026-11-09T11:20:00Z",
      actor_email: `cfo@${tmpl.slug}.example`,
      actor_role: "cfo",
      action: "journal.posted",
      entity_type: "journal_entry",
      entity_id: `${orgId}-je-2`,
      summary: "Approved & posted primary operating revenue & GST entries to ALERX ledger",
    },
    {
      id: `${orgId}-aud-2`,
      created_at: "2026-11-08T16:40:00Z",
      actor_email: `accounts@${tmpl.slug}.example`,
      actor_role: "accountant",
      action: "journal.submitted",
      entity_type: "journal_entry",
      entity_id: `${orgId}-je-pending`,
      summary: "Submitted expense voucher draft for Maker-Checker review",
    },
  ];

  // Company-specific coherent books
  if (slug === "aster-trading") {
    const c1: Party = {
      id: `${orgId}-p-c1`,
      organisation_id: orgId,
      type: "customer",
      legal_name: "Bharat Switchgear Works Pvt Ltd",
      display_name: "Bharat Switchgear",
      gstin: "27AABCB1234D1ZC",
      email: "ap@bharatswitchgear.example",
      phone: "9820011223",
      billing_address: { city: "Pune", state: "Maharashtra", pincode: "411001" },
      is_active: true,
    };
    const c2: Party = {
      id: `${orgId}-p-c2`,
      organisation_id: orgId,
      type: "customer",
      legal_name: "Kaveri Infra Controls LLP",
      display_name: "Kaveri Infra",
      gstin: "27AAACK5566E1ZJ",
      email: "finance@kaveriinfra.example",
      phone: "9820044556",
      billing_address: { city: "Nagpur", state: "Maharashtra", pincode: "440001" },
      is_active: true,
    };
    const v1: Party = {
      id: `${orgId}-p-v1`,
      organisation_id: orgId,
      type: "vendor",
      legal_name: "Deccan Cables & Conductors Pvt Ltd",
      display_name: "Deccan Cables",
      gstin: "29AABCD7788K1ZW",
      email: "billing@deccancables.example",
      phone: "9845011223",
      billing_address: { city: "Bengaluru", state: "Karnataka", pincode: "560048" },
      is_active: true,
    };

    const i1: CatalogueItem = {
      id: `${orgId}-item-1`,
      organisation_id: orgId,
      type: "goods",
      name: "Industrial MCB Panel 63A (3-Phase)",
      sku: "AST-MCB-63A",
      hsn_sac_code: "853620",
      unit_code: "NOS",
      default_unit_price: 12000,
      default_gst_rate: 18,
      is_taxable: true,
      track_inventory: true,
      is_active: true,
    };
    const i2: CatalogueItem = {
      id: `${orgId}-item-2`,
      organisation_id: orgId,
      type: "goods",
      name: "Armoured Copper Cable 4C x 16mm (100m)",
      sku: "AST-CAB-4C16",
      hsn_sac_code: "854460",
      unit_code: "COIL",
      default_unit_price: 20000,
      default_gst_rate: 18,
      is_taxable: true,
      track_inventory: true,
      is_active: true,
    };

    const journals: JournalEntry[] = [
      {
        id: `${orgId}-je-1`,
        organisation_id: orgId,
        fiscal_period_id: fpId,
        entry_number: "JV-2627-0001",
        entry_date: "2026-10-01",
        status: "posted",
        narration: "Initial partner capital introduced in HDFC Bank",
        posted_at: "2026-10-01T10:00:00Z",
        journal_entry_lines: [
          { line_number: 1, account_id: accId(orgId, "1020"), debit: 2500000, credit: 0, description: "Capital deposit" },
          { line_number: 2, account_id: accId(orgId, "3010"), debit: 0, credit: 2500000, description: "Partner equity" },
        ],
      },
      {
        id: `${orgId}-je-2`,
        organisation_id: orgId,
        fiscal_period_id: fpId,
        entry_number: "PB-2627-0001",
        entry_date: "2026-10-12",
        status: "posted",
        narration: "Inter-state stock purchase from Deccan Cables (IGST 18% eligible ITC)",
        reference: "DC-INV-908",
        posted_at: "2026-10-12T12:00:00Z",
        journal_entry_lines: [
          { line_number: 1, account_id: accId(orgId, "1040"), debit: 800000, credit: 0, description: "MCB & Cable Stock" },
          { line_number: 2, account_id: accId(orgId, "1052"), debit: 144000, credit: 0, description: "Input IGST 18%" },
          { line_number: 3, account_id: accId(orgId, "2010"), party_id: v1.id, debit: 0, credit: 944000, description: "Deccan Cables payable" },
        ],
      },
      {
        id: `${orgId}-je-3`,
        organisation_id: orgId,
        fiscal_period_id: fpId,
        entry_number: "PMT-2627-0001",
        entry_date: "2026-10-20",
        status: "posted",
        narration: "Partial supplier settlement to Deccan Cables via NEFT",
        posted_at: "2026-10-20T15:00:00Z",
        journal_entry_lines: [
          { line_number: 1, account_id: accId(orgId, "2010"), party_id: v1.id, debit: 544000, credit: 0, description: "Payable settled" },
          { line_number: 2, account_id: accId(orgId, "1020"), debit: 0, credit: 544000, description: "HDFC NEFT outflow" },
        ],
      },
      {
        id: `${orgId}-je-4`,
        organisation_id: orgId,
        fiscal_period_id: fpId,
        entry_number: "SI-2627-0001",
        entry_date: "2026-10-25",
        status: "posted",
        narration: "Issued Tax Invoice AST/26-27/001 to Bharat Switchgear (CGST 9% + SGST 9%)",
        posted_at: "2026-10-25T11:30:00Z",
        journal_entry_lines: [
          { line_number: 1, account_id: accId(orgId, "1030"), party_id: c1.id, debit: 708000, credit: 0, description: "Receivable Bharat Switchgear" },
          { line_number: 2, account_id: accId(orgId, "4010"), debit: 0, credit: 600000, description: "Sales revenue" },
          { line_number: 3, account_id: accId(orgId, "2020"), debit: 0, credit: 54000, description: "Output CGST 9%" },
          { line_number: 4, account_id: accId(orgId, "2021"), debit: 0, credit: 54000, description: "Output SGST 9%" },
        ],
      },
      {
        id: `${orgId}-je-5`,
        organisation_id: orgId,
        fiscal_period_id: fpId,
        entry_number: "RCT-2627-0001",
        entry_date: "2026-10-29",
        status: "posted",
        narration: "Full collection received from Bharat Switchgear against AST/26-27/001",
        posted_at: "2026-10-29T14:15:00Z",
        journal_entry_lines: [
          { line_number: 1, account_id: accId(orgId, "1020"), debit: 708000, credit: 0, description: "HDFC Bank receipt" },
          { line_number: 2, account_id: accId(orgId, "1030"), party_id: c1.id, debit: 0, credit: 708000, description: "Bharat Switchgear settled" },
        ],
      },
      {
        id: `${orgId}-je-6`,
        organisation_id: orgId,
        fiscal_period_id: fpId,
        entry_number: "SI-2627-0002",
        entry_date: "2026-11-02",
        status: "posted",
        narration: "Issued Tax Invoice AST/26-27/002 to Kaveri Infra (open receivable)",
        posted_at: "2026-11-02T10:45:00Z",
        journal_entry_lines: [
          { line_number: 1, account_id: accId(orgId, "1030"), party_id: c2.id, debit: 472000, credit: 0, description: "Receivable Kaveri Infra" },
          { line_number: 2, account_id: accId(orgId, "4010"), debit: 0, credit: 400000, description: "Sales revenue" },
          { line_number: 3, account_id: accId(orgId, "2020"), debit: 0, credit: 36000, description: "Output CGST 9%" },
          { line_number: 4, account_id: accId(orgId, "2021"), debit: 0, credit: 36000, description: "Output SGST 9%" },
        ],
      },
      {
        id: `${orgId}-je-7`,
        organisation_id: orgId,
        fiscal_period_id: fpId,
        entry_number: "COGS-2627-0001",
        entry_date: "2026-11-02",
        status: "posted",
        narration: "FIFO Cost of Goods Sold for October–November dispatches",
        posted_at: "2026-11-02T10:46:00Z",
        journal_entry_lines: [
          { line_number: 1, account_id: accId(orgId, "5010"), debit: 620000, credit: 0, description: "COGS (FIFO)" },
          { line_number: 2, account_id: accId(orgId, "1040"), debit: 0, credit: 620000, description: "Stock drawdown" },
        ],
      },
      {
        id: `${orgId}-je-8`,
        organisation_id: orgId,
        fiscal_period_id: fpId,
        entry_number: "PMT-2627-0002",
        entry_date: "2026-11-05",
        status: "posted",
        narration: "Warehouse rent and freight overheads",
        posted_at: "2026-11-05T17:00:00Z",
        journal_entry_lines: [
          { line_number: 1, account_id: accId(orgId, "5020"), debit: 135000, credit: 0, description: "Godown & logistics expense" },
          { line_number: 2, account_id: accId(orgId, "1020"), debit: 0, credit: 135000, description: "Bank payment" },
        ],
      },
      {
        id: `${orgId}-je-pending`,
        organisation_id: orgId,
        fiscal_period_id: fpId,
        entry_number: "JV-2627-0009",
        entry_date: "2026-11-09",
        status: "draft",
        submitted_at: "2026-11-09T14:00:00Z",
        submitted_by: "u-acc",
        narration: "Awaiting Checker Approval: Annual calibration & ISO audit fee",
        journal_entry_lines: [
          { line_number: 1, account_id: accId(orgId, "5020"), debit: 24000, credit: 0, description: "Calibration expense" },
          { line_number: 2, account_id: accId(orgId, "1020"), debit: 0, credit: 24000, description: "HDFC payout pending" },
        ],
      },
    ];

    const invoices: SalesInvoice[] = [
      {
        id: `${orgId}-inv-1`,
        organisation_id: orgId,
        customer_id: c1.id,
        invoice_number: "AST/26-27/001",
        invoice_date: "2026-10-25",
        due_date: "2026-11-09",
        status: "paid",
        supply_type: "intra_state",
        place_of_supply: "27-Maharashtra",
        taxable_amount: 600000,
        cgst_amount: 54000,
        sgst_amount: 54000,
        igst_amount: 0,
        total_amount: 708000,
        journal_entry_id: `${orgId}-je-4`,
        parties: { legal_name: c1.legal_name, gstin: c1.gstin },
        sales_invoice_lines: [
          { line_number: 1, item_id: i1.id, item_name: i1.name, hsn_sac_code: "853620", unit_code: "NOS", quantity: 25, unit_price: 12000, taxable_amount: 300000, gst_rate: 18, cgst_amount: 27000, sgst_amount: 27000, total_amount: 354000 },
          { line_number: 2, item_id: i2.id, item_name: i2.name, hsn_sac_code: "854460", unit_code: "COIL", quantity: 15, unit_price: 20000, taxable_amount: 300000, gst_rate: 18, cgst_amount: 27000, sgst_amount: 27000, total_amount: 354000 },
        ],
      },
      {
        id: `${orgId}-inv-2`,
        organisation_id: orgId,
        customer_id: c2.id,
        invoice_number: "AST/26-27/002",
        invoice_date: "2026-09-20",
        due_date: "2026-11-04",
        status: "issued",
        supply_type: "intra_state",
        place_of_supply: "27-Maharashtra",
        taxable_amount: 400000,
        cgst_amount: 36000,
        sgst_amount: 36000,
        igst_amount: 0,
        total_amount: 472000,
        journal_entry_id: `${orgId}-je-6`,
        parties: { legal_name: c2.legal_name, gstin: c2.gstin },
        sales_invoice_lines: [
          { line_number: 1, item_id: i2.id, item_name: i2.name, hsn_sac_code: "854460", unit_code: "COIL", quantity: 20, unit_price: 20000, taxable_amount: 400000, gst_rate: 18, cgst_amount: 36000, sgst_amount: 36000, total_amount: 472000 },
        ],
      },
    ];

    const purchases: PurchaseBill[] = [
      {
        id: `${orgId}-pb-1`,
        organisation_id: orgId,
        party_id: v1.id,
        supplier_name: v1.legal_name,
        supplier_gstin: v1.gstin || "",
        bill_number: "DC-INV-908",
        bill_date: "2026-10-12",
        place_of_supply: "27-Maharashtra",
        taxable_amount: 800000,
        cgst: 0,
        sgst: 0,
        igst: 144000,
        cess: 0,
        total_amount: 944000,
        itc_eligibility: "eligible",
        blocked_reason: null,
        journal_entry_id: `${orgId}-je-2`,
      },
    ];

    const warehouses: DemoWarehouse[] = [
      { id: `${orgId}-wh-1`, organisation_id: orgId, code: "BHI-01", name: "Bhiwandi Main Hub", city: "Thane", state_code: "27", is_default: true, is_active: true },
    ];

    const stockSummary: StockSummaryRow[] = [
      { item_id: i1.id, item_name: i1.name, sku: i1.sku, unit_code: "NOS", warehouse_id: `${orgId}-wh-1`, warehouse_name: "Bhiwandi Main Hub", qty_on_hand: 35, fifo_value: 105000 },
      { item_id: i2.id, item_name: i2.name, sku: i2.sku, unit_code: "COIL", warehouse_id: `${orgId}-wh-1`, warehouse_name: "Bhiwandi Main Hub", qty_on_hand: 15, fifo_value: 75000 },
    ];

    return {
      org,
      fiscalPeriods,
      accounts,
      parties: [c1, c2, v1],
      catalogue: [i1, i2],
      journals: withApprovalTrail(journals),
      invoices,
      notes: [],
      purchases,
      businessDocuments: [],
      departments: baseDepartments,
      members,
      invitations,
      payrollRuns: [
        { id: `${orgId}-pr-1`, period: "2026-10", total_gross: 110000, total_net_disbursed: 98000, total_tds: 8000, total_epf: 4000, headcount: 4, executed_at: "2026-10-31T18:00:00Z", status: "posted" },
      ],
      warehouses,
      stockSummary,
      marketplaceSettlements: [],
      auditEvents,
      reconciliations: [
        { id: `${orgId}-rec-1`, bank_account_id: accId(orgId, "1020"), statement_date: "2026-10-31", statement_closing_balance: 2664000, book_balance: 2664000, matched_count: 3, status: "completed" },
      ],
    };
  }

  if (slug === "northstar-consulting") {
    const c1: Party = { id: `${orgId}-p-c1`, organisation_id: orgId, type: "customer", legal_name: "FinBridge Analytics Pvt Ltd", display_name: "FinBridge", gstin: "29AABCF2345G1ZS", email: "finance@finbridge.example", phone: "9845123456", billing_address: { city: "Bengaluru", state: "Karnataka", pincode: "560001" }, is_active: true };
    const c2: Party = { id: `${orgId}-p-c2`, organisation_id: orgId, type: "customer", legal_name: "Apex Cloud Labs India Pvt Ltd", display_name: "Apex Cloud", gstin: "27AAACA8899B1ZH", email: "ap@apexcloud.example", phone: "9820123456", billing_address: { city: "Mumbai", state: "Maharashtra", pincode: "400051" }, is_active: true };
    const v1: Party = { id: `${orgId}-p-v1`, organisation_id: orgId, type: "vendor", legal_name: "Indiranagar CoWork Spaces LLP", display_name: "Indiranagar CoWork", gstin: "29AAACI3344L1ZE", billing_address: { city: "Bengaluru", state: "Karnataka", pincode: "560038" }, is_active: true };

    const s1: CatalogueItem = { id: `${orgId}-item-1`, organisation_id: orgId, type: "services", name: "Enterprise Cloud FinOps Retainer", sku: "NS-FINOPS-M", hsn_sac_code: "998313", unit_code: "MON", default_unit_price: 200000, default_gst_rate: 18, is_taxable: true, is_active: true };
    const s2: CatalogueItem = { id: `${orgId}-item-2`, organisation_id: orgId, type: "services", name: "SOC-2 Compliance Readiness Sprint", sku: "NS-SOC2-SPR", hsn_sac_code: "998314", unit_code: "PROJ", default_unit_price: 500000, default_gst_rate: 18, is_taxable: true, is_active: true };

    const journals: JournalEntry[] = [
      {
        id: `${orgId}-je-1`,
        organisation_id: orgId,
        fiscal_period_id: fpId,
        entry_number: "JV-2627-0001",
        entry_date: "2026-10-01",
        status: "posted",
        narration: "Opening equity infusion",
        posted_at: "2026-10-01T09:00:00Z",
        journal_entry_lines: [
          { line_number: 1, account_id: accId(orgId, "1020"), debit: 1800000, credit: 0 },
          { line_number: 2, account_id: accId(orgId, "3010"), debit: 0, credit: 1800000 },
        ],
      },
      {
        id: `${orgId}-je-2`,
        organisation_id: orgId,
        fiscal_period_id: fpId,
        entry_number: "SI-2627-0001",
        entry_date: "2026-10-15",
        status: "posted",
        narration: "Service retainer invoice NSC/26-27/011 to FinBridge (CGST+SGST 18%)",
        posted_at: "2026-10-15T10:00:00Z",
        journal_entry_lines: [
          { line_number: 1, account_id: accId(orgId, "1030"), party_id: c1.id, debit: 944000, credit: 0 },
          { line_number: 2, account_id: accId(orgId, "4010"), debit: 0, credit: 800000 },
          { line_number: 3, account_id: accId(orgId, "2020"), debit: 0, credit: 72000 },
          { line_number: 4, account_id: accId(orgId, "2021"), debit: 0, credit: 72000 },
        ],
      },
      {
        id: `${orgId}-je-3`,
        organisation_id: orgId,
        fiscal_period_id: fpId,
        entry_number: "RCT-2627-0001",
        entry_date: "2026-10-22",
        status: "posted",
        narration: "Receipt from FinBridge against NSC/26-27/011",
        posted_at: "2026-10-22T12:00:00Z",
        journal_entry_lines: [
          { line_number: 1, account_id: accId(orgId, "1020"), debit: 944000, credit: 0 },
          { line_number: 2, account_id: accId(orgId, "1030"), party_id: c1.id, debit: 0, credit: 944000 },
        ],
      },
      {
        id: `${orgId}-je-4`,
        organisation_id: orgId,
        fiscal_period_id: fpId,
        entry_number: "SI-2627-0002",
        entry_date: "2026-11-01",
        status: "posted",
        narration: "Inter-state SOC-2 advisory invoice NSC/26-27/012 to Apex Cloud (IGST 18%)",
        posted_at: "2026-11-01T10:00:00Z",
        journal_entry_lines: [
          { line_number: 1, account_id: accId(orgId, "1030"), party_id: c2.id, debit: 590000, credit: 0 },
          { line_number: 2, account_id: accId(orgId, "4010"), debit: 0, credit: 500000 },
          { line_number: 3, account_id: accId(orgId, "2022"), debit: 0, credit: 90000 },
        ],
      },
      {
        id: `${orgId}-je-5`,
        organisation_id: orgId,
        fiscal_period_id: fpId,
        entry_number: "PAY-2627-0010",
        entry_date: "2026-10-31",
        status: "posted",
        narration: "October Payroll Run: Consulting & Advisory team (TDS & EPF withheld)",
        posted_at: "2026-10-31T18:00:00Z",
        journal_entry_lines: [
          { line_number: 1, account_id: accId(orgId, "5020"), debit: 620000, credit: 0 },
          { line_number: 2, account_id: accId(orgId, "1020"), debit: 0, credit: 545000 },
          { line_number: 3, account_id: accId(orgId, "2030"), debit: 0, credit: 75000 },
        ],
      },
      {
        id: `${orgId}-je-6`,
        organisation_id: orgId,
        fiscal_period_id: fpId,
        entry_number: "PB-2627-0001",
        entry_date: "2026-11-02",
        status: "posted",
        narration: "Studio office lease from Indiranagar CoWork",
        posted_at: "2026-11-02T11:00:00Z",
        journal_entry_lines: [
          { line_number: 1, account_id: accId(orgId, "5020"), debit: 180000, credit: 0 },
          { line_number: 2, account_id: accId(orgId, "1050"), debit: 16200, credit: 0 },
          { line_number: 3, account_id: accId(orgId, "1051"), debit: 16200, credit: 0 },
          { line_number: 4, account_id: accId(orgId, "2010"), party_id: v1.id, debit: 0, credit: 212400 },
        ],
      },
    ];

    return {
      org,
      fiscalPeriods,
      accounts,
      parties: [c1, c2, v1],
      catalogue: [s1, s2],
      journals: withApprovalTrail(journals),
      invoices: [
        {
          id: `${orgId}-inv-1`,
          organisation_id: orgId,
          customer_id: c1.id,
          invoice_number: "NSC/26-27/011",
          invoice_date: "2026-10-15",
          due_date: "2026-10-30",
          status: "paid",
          supply_type: "intra_state",
          place_of_supply: "29-Karnataka",
          taxable_amount: 800000,
          cgst_amount: 72000,
          sgst_amount: 72000,
          igst_amount: 0,
          total_amount: 944000,
          parties: { legal_name: c1.legal_name, gstin: c1.gstin },
          sales_invoice_lines: [
            { line_number: 1, item_id: s1.id, item_name: s1.name, hsn_sac_code: "998313", unit_code: "MON", quantity: 4, unit_price: 200000, taxable_amount: 800000, gst_rate: 18, cgst_amount: 72000, sgst_amount: 72000, total_amount: 944000 },
          ],
        },
        {
          id: `${orgId}-inv-2`,
          organisation_id: orgId,
          customer_id: c2.id,
          invoice_number: "NSC/26-27/012",
          invoice_date: "2026-11-01",
          due_date: "2026-11-16",
          status: "issued",
          supply_type: "inter_state",
          place_of_supply: "27-Maharashtra",
          taxable_amount: 500000,
          cgst_amount: 0,
          sgst_amount: 0,
          igst_amount: 90000,
          total_amount: 590000,
          parties: { legal_name: c2.legal_name, gstin: c2.gstin },
          sales_invoice_lines: [
            { line_number: 1, item_id: s2.id, item_name: s2.name, hsn_sac_code: "998314", unit_code: "PROJ", quantity: 1, unit_price: 500000, taxable_amount: 500000, gst_rate: 18, igst_amount: 90000, total_amount: 590000 },
          ],
        },
      ],
      notes: [],
      purchases: [
        {
          id: `${orgId}-pb-1`,
          organisation_id: orgId,
          party_id: v1.id,
          supplier_name: v1.legal_name,
          supplier_gstin: v1.gstin || "",
          bill_number: "ICW/26-27/402",
          bill_date: "2026-11-02",
          place_of_supply: "29-Karnataka",
          taxable_amount: 180000,
          cgst: 16200,
          sgst: 16200,
          igst: 0,
          cess: 0,
          total_amount: 212400,
          itc_eligibility: "eligible",
          blocked_reason: null,
          journal_entry_id: `${orgId}-je-6`,
        },
      ],
      businessDocuments: [
        {
          id: `${orgId}-doc-q1`,
          organisation_id: orgId,
          doc_type: "quotation",
          doc_number: "QTN-2627-018",
          doc_date: "2026-11-04",
          valid_until: "2026-11-30",
          party_id: c2.id,
          party_name: c2.legal_name,
          party_gstin: c2.gstin,
          place_of_supply: "27-Maharashtra",
          status: "sent",
          taxable_amount: 350000,
          tax_amount: 63000,
          total_amount: 413000,
          notes: "Q3 Virtual CFO & Governance Retainer Proposal",
          items: [
            { line_number: 1, item_name: s1.name, hsn_sac: "998313", quantity: 1, unit_price: 350000, gst_rate: 18, taxable_amount: 350000, total_amount: 413000 },
          ],
          created_at: "2026-11-04T09:30:00Z",
        } as unknown as BusinessDocument,
      ],
      departments: baseDepartments,
      members,
      invitations,
      payrollRuns: [
        { id: `${orgId}-pr-1`, period: "2026-10", total_gross: 620000, total_net_disbursed: 545000, total_tds: 52000, total_epf: 23000, headcount: 8, executed_at: "2026-10-31T18:00:00Z", status: "posted" },
      ],
      warehouses: [],
      stockSummary: [],
      marketplaceSettlements: [],
      auditEvents,
      reconciliations: [
        { id: `${orgId}-rec-1`, bank_account_id: accId(orgId, "1020"), statement_date: "2026-10-31", statement_closing_balance: 2199000, book_balance: 2199000, matched_count: 3, status: "completed" },
      ],
    };
  }

  if (slug === "urbannest-retail") {
    const c1: Party = { id: `${orgId}-p-c1`, organisation_id: orgId, type: "customer", legal_name: "Direct D2C Checkout Pool", display_name: "D2C Direct", gstin: null, email: "orders@urbannest.example", billing_address: { city: "New Delhi", state: "Delhi", pincode: "110016" }, is_active: true };
    const c2: Party = { id: `${orgId}-p-c2`, organisation_id: orgId, type: "customer", legal_name: "Amazon Seller Services Pvt Ltd (ECO)", display_name: "Amazon ECO", gstin: "07AAACA0000E1ZS", email: "settlements@amazon-eco.example", billing_address: { city: "New Delhi", state: "Delhi", pincode: "110001" }, is_active: true };
    const v1: Party = { id: `${orgId}-p-v1`, organisation_id: orgId, type: "vendor", legal_name: "Jaipur Homecrafts Export House", display_name: "Jaipur Homecrafts", gstin: "08AAACJ9988P1ZF", billing_address: { city: "Jaipur", state: "Rajasthan", pincode: "302001" }, is_active: true };

    const k1: CatalogueItem = { id: `${orgId}-item-1`, organisation_id: orgId, type: "goods", name: "Ceramic Pour-Over Carafe Set", sku: "UN-CER-01", hsn_sac_code: "691200", unit_code: "SET", default_unit_price: 2000, default_gst_rate: 12, is_taxable: true, track_inventory: true, is_active: true };
    const k2: CatalogueItem = { id: `${orgId}-item-2`, organisation_id: orgId, type: "goods", name: "Woven Organic Linen Throw", sku: "UN-TEX-04", hsn_sac_code: "630492", unit_code: "PCS", default_unit_price: 2500, default_gst_rate: 5, is_taxable: true, track_inventory: true, is_active: true };

    const journals: JournalEntry[] = [
      {
        id: `${orgId}-je-1`,
        organisation_id: orgId,
        fiscal_period_id: fpId,
        entry_number: "JV-2627-0001",
        entry_date: "2026-10-01",
        status: "posted",
        narration: "Founder seed working capital",
        posted_at: "2026-10-01T09:00:00Z",
        journal_entry_lines: [
          { line_number: 1, account_id: accId(orgId, "1020"), debit: 3000000, credit: 0 },
          { line_number: 2, account_id: accId(orgId, "3010"), debit: 0, credit: 3000000 },
        ],
      },
      {
        id: `${orgId}-je-2`,
        organisation_id: orgId,
        fiscal_period_id: fpId,
        entry_number: "PB-2627-0001",
        entry_date: "2026-10-08",
        status: "posted",
        narration: "Inventory procurement from Jaipur Homecrafts (IGST 18%)",
        posted_at: "2026-10-08T10:00:00Z",
        journal_entry_lines: [
          { line_number: 1, account_id: accId(orgId, "1040"), debit: 1200000, credit: 0 },
          { line_number: 2, account_id: accId(orgId, "1052"), debit: 216000, credit: 0 },
          { line_number: 3, account_id: accId(orgId, "2010"), party_id: v1.id, debit: 0, credit: 1416000 },
        ],
      },
      {
        id: `${orgId}-je-3`,
        organisation_id: orgId,
        fiscal_period_id: fpId,
        entry_number: "SI-2627-0001",
        entry_date: "2026-10-18",
        status: "posted",
        narration: "D2C storefront invoice batch UN/26-27/101 + UPI settlement",
        posted_at: "2026-10-18T11:00:00Z",
        journal_entry_lines: [
          { line_number: 1, account_id: accId(orgId, "1020"), debit: 472000, credit: 0 },
          { line_number: 2, account_id: accId(orgId, "4010"), debit: 0, credit: 400000 },
          { line_number: 3, account_id: accId(orgId, "2020"), debit: 0, credit: 36000 },
          { line_number: 4, account_id: accId(orgId, "2021"), debit: 0, credit: 36000 },
        ],
      },
      {
        id: `${orgId}-je-4`,
        organisation_id: orgId,
        fiscal_period_id: fpId,
        entry_number: "MKT-2627-0001",
        entry_date: "2026-10-31",
        status: "posted",
        narration: "Amazon ECO Sec 14 / Table 3.1.1 Settlement AMZ-OCT-B2 (Commission & TCS split)",
        posted_at: "2026-10-31T12:30:00Z",
        journal_entry_lines: [
          { line_number: 1, account_id: accId(orgId, "1020"), debit: 984200, credit: 0, description: "Net payout credited" },
          { line_number: 2, account_id: accId(orgId, "5020"), debit: 180000, credit: 0, description: "Marketplace commission & shipping fee" },
          { line_number: 3, account_id: accId(orgId, "1060"), debit: 10000, credit: 0, description: "1% TCS u/s 52 receivable" },
          { line_number: 4, account_id: accId(orgId, "4010"), debit: 0, credit: 1000000, description: "ECO Table 3.1.1 gross taxable sales" },
          { line_number: 5, account_id: accId(orgId, "2022"), debit: 0, credit: 174200, description: "Output IGST on ECO sales" },
        ],
      },
      {
        id: `${orgId}-je-5`,
        organisation_id: orgId,
        fiscal_period_id: fpId,
        entry_number: "COGS-2627-0001",
        entry_date: "2026-11-01",
        status: "posted",
        narration: "COGS for October D2C + Marketplace orders",
        posted_at: "2026-11-01T09:00:00Z",
        journal_entry_lines: [
          { line_number: 1, account_id: accId(orgId, "5010"), debit: 740000, credit: 0 },
          { line_number: 2, account_id: accId(orgId, "1040"), debit: 0, credit: 740000 },
        ],
      },
    ];

    return {
      org,
      fiscalPeriods,
      accounts,
      parties: [c1, c2, v1],
      catalogue: [k1, k2],
      journals: withApprovalTrail(journals),
      invoices: [
        {
          id: `${orgId}-inv-1`,
          organisation_id: orgId,
          customer_id: c1.id,
          invoice_number: "UN/26-27/101",
          invoice_date: "2026-10-18",
          due_date: "2026-10-18",
          status: "paid",
          supply_type: "intra_state",
          place_of_supply: "07-Delhi",
          taxable_amount: 400000,
          cgst_amount: 36000,
          sgst_amount: 36000,
          igst_amount: 0,
          total_amount: 472000,
          parties: { legal_name: c1.legal_name, gstin: null },
          sales_invoice_lines: [
            { line_number: 1, item_id: k1.id, item_name: k1.name, hsn_sac_code: "691200", unit_code: "SET", quantity: 200, unit_price: 2000, taxable_amount: 400000, gst_rate: 18, cgst_amount: 36000, sgst_amount: 36000, total_amount: 472000 },
          ],
        },
      ],
      notes: [],
      purchases: [
        {
          id: `${orgId}-pb-1`,
          organisation_id: orgId,
          party_id: v1.id,
          supplier_name: v1.legal_name,
          supplier_gstin: v1.gstin || "",
          bill_number: "JH-4410",
          bill_date: "2026-10-08",
          place_of_supply: "07-Delhi",
          taxable_amount: 1200000,
          cgst: 0,
          sgst: 0,
          igst: 216000,
          cess: 0,
          total_amount: 1416000,
          itc_eligibility: "eligible",
          blocked_reason: null,
          journal_entry_id: `${orgId}-je-2`,
        },
      ],
      businessDocuments: [],
      departments: baseDepartments,
      members,
      invitations,
      payrollRuns: [],
      warehouses: [
        { id: `${orgId}-wh-1`, organisation_id: orgId, code: "DEL-FC", name: "Okhla Fulfillment Centre", city: "New Delhi", state_code: "07", is_default: true, is_active: true },
      ],
      stockSummary: [
        { item_id: k1.id, item_name: k1.name, sku: k1.sku, unit_code: "SET", warehouse_id: `${orgId}-wh-1`, warehouse_name: "Okhla Fulfillment Centre", qty_on_hand: 220, fifo_value: 264000 },
        { item_id: k2.id, item_name: k2.name, sku: k2.sku, unit_code: "PCS", warehouse_id: `${orgId}-wh-1`, warehouse_name: "Okhla Fulfillment Centre", qty_on_hand: 140, fifo_value: 196000 },
      ],
      marketplaceSettlements: [
        {
          id: `${orgId}-ms-1`,
          organisation_id: orgId,
          channel: "Amazon India",
          batch_reference: "AMZ-OCT-B2",
          settlement_date: "2026-10-31",
          gross_sales: 1174200,
          commission_fee: 180000,
          tcs_deducted: 10000,
          net_payout: 984200,
          gst_rate: 18,
          eco_gstin: "07AAACA0000E1Z5",
          status: "posted",
          journal_entry_id: `${orgId}-je-4`,
        },
      ],
      auditEvents,
      reconciliations: [
        { id: `${orgId}-rec-1`, bank_account_id: accId(orgId, "1020"), statement_date: "2026-10-31", statement_closing_balance: 4456200, book_balance: 4456200, matched_count: 3, status: "completed" },
      ],
    };
  }

  // Default: meridian-retail (Multi-Warehouse Retail)
  const c1: Party = { id: `${orgId}-p-c1`, organisation_id: orgId, type: "customer", legal_name: "Westside Metro Marts LLP", display_name: "Westside Metro", gstin: "27AAACW4455R1ZM", email: "accounts@westsidemetro.example", phone: "9820998877", billing_address: { city: "Mumbai", state: "Maharashtra", pincode: "400013" }, is_active: true };
  const v1: Party = { id: `${orgId}-p-v1`, organisation_id: orgId, type: "vendor", legal_name: "Sahyadri FMCG Supply Corp", display_name: "Sahyadri Supply", gstin: "27AAACS6677Q1ZG", billing_address: { city: "Nashik", state: "Maharashtra", pincode: "422001" }, is_active: true };

  const m1: CatalogueItem = { id: `${orgId}-item-1`, organisation_id: orgId, type: "goods", name: "Cold-Pressed Olive Oil 1L Tin", sku: "MR-OIL-1L", hsn_sac_code: "150910", unit_code: "TIN", default_unit_price: 800, default_gst_rate: 18, is_taxable: true, track_inventory: true, is_active: true };
  const m2: CatalogueItem = { id: `${orgId}-item-2`, organisation_id: orgId, type: "goods", name: "Single-Origin Arabica Beans 1kg", sku: "MR-COF-1K", hsn_sac_code: "090121", unit_code: "BAG", default_unit_price: 1200, default_gst_rate: 18, is_taxable: true, track_inventory: true, is_active: true };

  const journals: JournalEntry[] = [
    {
      id: `${orgId}-je-1`,
      organisation_id: orgId,
      fiscal_period_id: fpId,
      entry_number: "JV-2627-0001",
      entry_date: "2026-10-01",
      status: "posted",
      narration: "Share capital across Mumbai & Pune retail hubs",
      posted_at: "2026-10-01T09:00:00Z",
      journal_entry_lines: [
        { line_number: 1, account_id: accId(orgId, "1020"), debit: 4000000, credit: 0 },
        { line_number: 2, account_id: accId(orgId, "3010"), debit: 0, credit: 4000000 },
      ],
    },
    {
      id: `${orgId}-je-2`,
      organisation_id: orgId,
      fiscal_period_id: fpId,
      entry_number: "PB-2627-0001",
      entry_date: "2026-10-10",
      status: "posted",
      narration: "Bulk multi-godown intake from Sahyadri Supply (CGST+SGST 18%)",
      posted_at: "2026-10-10T10:00:00Z",
      journal_entry_lines: [
        { line_number: 1, account_id: accId(orgId, "1040"), debit: 1600000, credit: 0 },
        { line_number: 2, account_id: accId(orgId, "1050"), debit: 144000, credit: 0 },
        { line_number: 3, account_id: accId(orgId, "1051"), debit: 144000, credit: 0 },
        { line_number: 4, account_id: accId(orgId, "2010"), party_id: v1.id, debit: 0, credit: 1888000 },
      ],
    },
    {
      id: `${orgId}-je-3`,
      organisation_id: orgId,
      fiscal_period_id: fpId,
      entry_number: "PMT-2627-0001",
      entry_date: "2026-10-18",
      status: "posted",
      narration: "Partial payment to Sahyadri Supply",
      posted_at: "2026-10-18T14:00:00Z",
      journal_entry_lines: [
        { line_number: 1, account_id: accId(orgId, "2010"), party_id: v1.id, debit: 1200000, credit: 0 },
        { line_number: 2, account_id: accId(orgId, "1020"), debit: 0, credit: 1200000 },
      ],
    },
    {
      id: `${orgId}-je-4`,
      organisation_id: orgId,
      fiscal_period_id: fpId,
      entry_number: "SI-2627-0001",
      entry_date: "2026-10-22",
      status: "posted",
      narration: "Wholesale retail supply MR/26-27/201 to Westside Metro",
      posted_at: "2026-10-22T12:00:00Z",
      journal_entry_lines: [
        { line_number: 1, account_id: accId(orgId, "1030"), party_id: c1.id, debit: 1416000, credit: 0 },
        { line_number: 2, account_id: accId(orgId, "4010"), debit: 0, credit: 1200000 },
        { line_number: 3, account_id: accId(orgId, "2020"), debit: 0, credit: 108000 },
        { line_number: 4, account_id: accId(orgId, "2021"), debit: 0, credit: 108000 },
      ],
    },
    {
      id: `${orgId}-je-5`,
      organisation_id: orgId,
      fiscal_period_id: fpId,
      entry_number: "RCT-2627-0001",
      entry_date: "2026-10-28",
      status: "posted",
      narration: "Collection from Westside Metro",
      posted_at: "2026-10-28T16:00:00Z",
      journal_entry_lines: [
        { line_number: 1, account_id: accId(orgId, "1020"), debit: 1180000, credit: 0 },
        { line_number: 2, account_id: accId(orgId, "1030"), party_id: c1.id, debit: 0, credit: 1180000 },
      ],
    },
    {
      id: `${orgId}-je-6`,
      organisation_id: orgId,
      fiscal_period_id: fpId,
      entry_number: "CN-2627-0001",
      entry_date: "2026-11-01",
      status: "posted",
      narration: "Credit Note CN/26-27/004 for damaged batch return from Westside Metro",
      posted_at: "2026-11-01T10:30:00Z",
      journal_entry_lines: [
        { line_number: 1, account_id: accId(orgId, "4010"), debit: 50000, credit: 0 },
        { line_number: 2, account_id: accId(orgId, "2020"), debit: 4500, credit: 0 },
        { line_number: 3, account_id: accId(orgId, "2021"), debit: 4500, credit: 0 },
        { line_number: 4, account_id: accId(orgId, "1030"), party_id: c1.id, debit: 0, credit: 59000 },
      ],
    },
    {
      id: `${orgId}-je-7`,
      organisation_id: orgId,
      fiscal_period_id: fpId,
      entry_number: "COGS-2627-0001",
      entry_date: "2026-11-02",
      status: "posted",
      narration: "FIFO stock cost + store operating costs",
      posted_at: "2026-11-02T11:00:00Z",
      journal_entry_lines: [
        { line_number: 1, account_id: accId(orgId, "5010"), debit: 820000, credit: 0 },
        { line_number: 2, account_id: accId(orgId, "1040"), debit: 0, credit: 820000 },
        { line_number: 3, account_id: accId(orgId, "5020"), debit: 210000, credit: 0 },
        { line_number: 4, account_id: accId(orgId, "1020"), debit: 0, credit: 210000 },
      ],
    },
  ];

  return {
    org,
    fiscalPeriods,
    accounts,
    parties: [c1, v1],
    catalogue: [m1, m2],
    journals: withApprovalTrail(journals),
    invoices: [
      {
        id: `${orgId}-inv-1`,
        organisation_id: orgId,
        customer_id: c1.id,
        invoice_number: "MR/26-27/201",
        invoice_date: "2026-10-22",
        due_date: "2026-11-21",
        status: "issued",
        supply_type: "intra_state",
        place_of_supply: "27-Maharashtra",
        taxable_amount: 1200000,
        cgst_amount: 108000,
        sgst_amount: 108000,
        igst_amount: 0,
        total_amount: 1416000,
        parties: { legal_name: c1.legal_name, gstin: c1.gstin },
        sales_invoice_lines: [
          { line_number: 1, item_id: m1.id, item_name: m1.name, hsn_sac_code: "150910", unit_code: "TIN", quantity: 1000, unit_price: 800, taxable_amount: 800000, gst_rate: 18, cgst_amount: 72000, sgst_amount: 72000, total_amount: 944000 },
          { line_number: 2, item_id: m2.id, item_name: m2.name, hsn_sac_code: "090121", unit_code: "BAG", quantity: 400, unit_price: 1000, taxable_amount: 400000, gst_rate: 18, cgst_amount: 36000, sgst_amount: 36000, total_amount: 472000 },
        ],
      },
    ],
    notes: [
      {
        id: `${orgId}-cn-1`,
        organisation_id: orgId,
        invoice_id: `${orgId}-inv-1`,
        customer_id: c1.id,
        note_type: "credit_note",
        note_number: "CN/26-27/004",
        note_date: "2026-11-01",
        status: "issued",
        reason: "Damaged transit cartons returned",
        supply_type: "intra_state",
        place_of_supply: "27-Maharashtra",
        taxable_amount: 50000,
        cgst_amount: 4500,
        sgst_amount: 4500,
        igst_amount: 0,
        total_amount: 59000,
        parties: { legal_name: c1.legal_name, gstin: c1.gstin },
      } as unknown as SalesNote,
    ],
    purchases: [
      {
        id: `${orgId}-pb-1`,
        organisation_id: orgId,
        party_id: v1.id,
        supplier_name: v1.legal_name,
        supplier_gstin: v1.gstin || "",
        bill_number: "SS-2627-881",
        bill_date: "2026-10-10",
        place_of_supply: "27-Maharashtra",
        taxable_amount: 1600000,
        cgst: 144000,
        sgst: 144000,
        igst: 0,
        cess: 0,
        total_amount: 1888000,
        itc_eligibility: "eligible",
        blocked_reason: null,
        journal_entry_id: `${orgId}-je-2`,
      },
    ],
    businessDocuments: [],
    departments: baseDepartments,
    members,
    invitations,
    payrollRuns: [],
    warehouses: [
      { id: `${orgId}-wh-1`, organisation_id: orgId, code: "MUM-CEN", name: "Mumbai Central Godown", city: "Mumbai", state_code: "27", is_default: true, is_active: true },
      { id: `${orgId}-wh-2`, organisation_id: orgId, code: "PUN-WST", name: "Pune Chakan Warehouse", city: "Pune", state_code: "27", is_default: false, is_active: true },
    ],
    stockSummary: [
      { item_id: m1.id, item_name: m1.name, sku: m1.sku, unit_code: "TIN", warehouse_id: `${orgId}-wh-1`, warehouse_name: "Mumbai Central Godown", qty_on_hand: 650, fifo_value: 455000 },
      { item_id: m2.id, item_name: m2.name, sku: m2.sku, unit_code: "BAG", warehouse_id: `${orgId}-wh-2`, warehouse_name: "Pune Chakan Warehouse", qty_on_hand: 325, fifo_value: 325000 },
    ],
    marketplaceSettlements: [],
    auditEvents,
    reconciliations: [
      { id: `${orgId}-rec-1`, bank_account_id: accId(orgId, "1020"), statement_date: "2026-10-31", statement_closing_balance: 3770000, book_balance: 3770000, matched_count: 3, status: "completed" },
    ],
  };
}
