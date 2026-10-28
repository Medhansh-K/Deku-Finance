/**
 * Deku Finance — Authoritative Accounting Types
 * Mapped 1-to-1 against Rust Axum Backend & PostgreSQL ALERX schema.
 */

export type AccountType = "asset" | "liability" | "equity" | "income" | "expense";
export type AlerxGroup = "asset" | "liability" | "equity" | "revenue" | "expense";

export interface Account {
  id: string;
  organisation_id: string;
  code: string;
  name: string;
  type: AccountType;
  account_group: AlerxGroup;
  ledger: string;
  sub_ledger: string;
  label: string;
  is_postable: boolean;
  is_active: boolean;
  is_system: boolean;
  description?: string | null;
  parent_account_id?: string | null;
  unit_name?: string;
  units?: number;
  value?: number;
  total_debit?: number;
  total_credit?: number;
  created_at?: string;
}

export interface CreateAccountRequest {
  code: string;
  name: string;
  account_group: AlerxGroup;
  ledger?: string;
  sub_ledger?: string;
  label?: string;
  is_postable?: boolean;
  description?: string;
  parent_account_id?: string;
}

export interface FiscalPeriod {
  id: string;
  organisation_id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: "open" | "closed";
  created_at?: string;
}

export type PartyType = "customer" | "vendor";

export interface Address {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
}

export interface Party {
  id: string;
  organisation_id: string;
  type: PartyType;
  legal_name: string;
  display_name?: string | null;
  gstin?: string | null;
  pan?: string | null;
  email?: string | null;
  phone?: string | null;
  billing_address?: Address | null;
  shipping_address?: Address | null;
  is_active?: boolean;
  notes?: string | null;
  created_at?: string;
}

export type CatalogueItemType = "goods" | "services";

export interface CatalogueItem {
  id: string;
  organisation_id: string;
  type: CatalogueItemType;
  name: string;
  description?: string | null;
  sku: string;
  hsn_sac_code?: string | null;
  unit_code: string;
  default_unit_price: number;
  default_gst_rate: number;
  is_taxable: boolean;
  is_active?: boolean;
  created_at?: string;
}

export type JournalStatus = "draft" | "posted" | "reversed";

export interface JournalEntryLine {
  id?: string;
  journal_entry_id?: string;
  line_number: number;
  account_id: string;
  party_id?: string | null;
  description?: string | null;
  debit: number;
  credit: number;
  unit_delta?: number;
  created_at?: string;
}

export interface JournalEntry {
  id: string;
  organisation_id: string;
  fiscal_period_id: string;
  entry_number: string;
  entry_date: string;
  status: JournalStatus;
  narration: string;
  reference?: string | null;
  reversal_of_id?: string | null;
  posted_at?: string | null;
  posted_by?: string | null;
  created_at?: string;
  created_by?: string | null;
  submitted_at?: string | null;
  submitted_by?: string | null;
  rejected_at?: string | null;
  rejected_by?: string | null;
  rejection_reason?: string | null;
  journal_entry_lines: JournalEntryLine[];
}

export interface CreateJournalLineRequest {
  line_number: number;
  account_id: string;
  party_id?: string | null;
  description?: string | null;
  debit: number;
  credit: number;
}

export interface CreateJournalRequest {
  fiscal_period_id: string;
  entry_number: string;
  entry_date: string;
  narration: string;
  reference?: string;
  lines: CreateJournalLineRequest[];
}

// Financial Report Contracts
export interface GeneralLedgerRow {
  line_id: string;
  organisation_id: string;
  journal_entry_id: string;
  entry_number: string;
  entry_date: string;
  reference?: string | null;
  status: JournalStatus;
  line_number: number;
  account_id: string;
  account_code: string;
  account_name: string;
  account_type: AccountType;
  party_id?: string | null;
  party_name?: string | null;
  description?: string | null;
  debit: number;
  credit: number;
  fiscal_period_id: string;
  fiscal_period_name: string;
}

export interface AccountBalanceRow {
  organisation_id: string;
  account_id: string;
  account_code: string;
  account_name: string;
  account_type: AccountType;
  account_group?: AlerxGroup;
  ledger?: string;
  sub_ledger?: string;
  label?: string;
  is_active: boolean;
  total_debit: number;
  total_credit: number;
  natural_balance: number;
  units?: number;
  value?: number;
  state_changes?: number;
}

export interface ProfitLossRow {
  organisation_id: string;
  fiscal_period_id: string;
  fiscal_period_name: string;
  account_id: string;
  account_code: string;
  account_name: string;
  account_type: AccountType;
  total_debit: number;
  total_credit: number;
  net_amount: number;
}

export interface BalanceSheetRow {
  organisation_id: string;
  fiscal_period_id: string;
  fiscal_period_name: string;
  account_id: string;
  account_code: string;
  account_name: string;
  account_type: AccountType;
  total_debit: number;
  total_credit: number;
  balance: number;
}

// Invoices & GST Contracts
export type InvoiceStatus = "draft" | "issued" | "cancelled" | "paid";
export type SupplyType = "intra_state" | "inter_state";

export interface SalesInvoiceLine {
  id?: string;
  invoice_id?: string;
  line_number: number;
  item_id?: string | null;
  item_name: string;
  description?: string | null;
  hsn_sac_code?: string | null;
  unit_code: string;
  quantity: number;
  unit_price: number;
  discount_amount?: number;
  taxable_amount: number;
  gst_rate: number;
  cgst_rate?: number;
  cgst_amount?: number;
  sgst_rate?: number;
  sgst_amount?: number;
  igst_rate?: number;
  igst_amount?: number;
  cess_rate?: number;
  cess_amount?: number;
  total_amount: number;
}

export interface SalesInvoice {
  id: string;
  organisation_id: string;
  customer_id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  status: InvoiceStatus;
  supply_type: SupplyType;
  place_of_supply: string;
  taxable_amount: number;
  total_amount: number;
  notes?: string | null;
  terms?: string | null;
  journal_entry_id?: string | null;
  created_at?: string;
  sales_invoice_lines?: SalesInvoiceLine[];
  parties?: {
    legal_name: string;
    gstin?: string | null;
  };
}

export interface CreateInvoiceRequest {
  customer_id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  supply_type: SupplyType;
  place_of_supply: string;
  taxable_amount: number;
  total_amount: number;
  notes?: string;
  terms?: string;
  lines: Omit<SalesInvoiceLine, "id" | "invoice_id">[];
}

export interface AuditEvent {
  id: string;
  organisation_id: string;
  event_type: string;
  actor_id?: string | null;
  resource_type: string;
  resource_id: string;
  metadata?: any;
  created_at: string;
}
