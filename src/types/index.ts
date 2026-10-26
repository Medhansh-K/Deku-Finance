export type OperatingMode = "pure_accounting" | "gst_enterprise";

export type LicenseType = "temp" | "plan";
export type PlanTier = "go" | "pro";
export type LicenseStatus =
  | "pending_activation"
  | "active"
  | "grace_period"
  | "expired"
  | "revoked";

export interface OrganisationLicense {
  id: string;
  organisation_id: string;
  license_key: string;
  license_type: LicenseType;
  plan_tier: PlanTier;
  owner_email: string;
  issued_at: string;
  trial_ends_at?: string; // 15 days from issue
  grace_period_ends_at?: string; // 20 days from issue (5 days migration/purchase)
  expires_at: string; // Hard termination
  status: LicenseStatus;
  activated_at?: string;
  activated_by_email?: string;
  last_email_sent_at?: string;
  features: {
    max_monthly_bills: number;
    has_gstn_json: boolean;
    has_custom_fields: boolean;
    has_upi_qr: boolean;
    seats: number;
  };
}

export interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  is_demo?: boolean;
}

export interface Organisation {
  id: string;
  name: string;
  slug: string;
  legal_name?: string;
  gstin?: string;
  pan?: string;
  currency: string;
  timezone: string;
  fy_start_month: number;
  operating_mode: OperatingMode;
  operating_state?: string;
  state_code?: string;
  upi_vpa?: string;
  turnover_limit?: number;
  current_turnover?: number;
  license?: OrganisationLicense;
}

export interface FiscalPeriod {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: "open" | "closed" | "locked";
}

export interface CustomInvoiceFields {
  po_number?: string;
  po_date?: string;
  eway_bill_no?: string;
  vehicle_no?: string;
  payment_terms?: string;
  due_date?: string;
  notes?: string;
  batch_no?: string;
  serial_no?: string;
}

export interface InvoiceItem {
  id: string;
  item_name: string;
  hsn_sac: string;
  quantity: number;
  unit_price: number;
  gst_rate: number; // 0, 5, 12, 18, 28
  taxable_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  total_amount: number;
  custom_attributes?: Record<string, string>;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  invoice_type: "bill_of_supply" | "tax_invoice";
  operating_mode: OperatingMode;
  issue_date: string;
  due_date: string;
  party_name: string;
  party_gstin?: string;
  party_pan?: string;
  party_state: string;
  place_of_supply: string;
  items: InvoiceItem[];
  taxable_subtotal: number;
  cgst_total: number;
  sgst_total: number;
  igst_total: number;
  grand_total: number;
  payment_status: "unpaid" | "partially_paid" | "paid";
  upi_vpa: string;
  custom_fields: CustomInvoiceFields;
  alerx_journal_status: "posted" | "draft";
  created_at: string;
}

export interface Party {
  id: string;
  name: string;
  trade_name?: string;
  party_type: "customer" | "vendor" | "both";
  gstin?: string;
  pan?: string;
  state: string;
  state_code: string;
  email?: string;
  phone?: string;
  address?: string;
  outstanding_balance: number;
}

export interface AlerxAccount {
  id: string;
  code: string;
  name: string;
  class: "asset" | "liability" | "equity" | "revenue" | "expense";
  tier: "group" | "ledger" | "sub_ledger" | "leaf_label";
  is_postable: boolean;
  balance_inr: number;
  units_count: number;
  parent_code?: string;
}
