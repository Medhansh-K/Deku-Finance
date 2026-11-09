export type OperatingMode = "pure_accounting" | "gst_enterprise";

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
  state_code?: string;
  registered_address?: RegisteredAddress;
  upi_vpa?: string;
  bank_account_number?: string;
  bank_ifsc?: string;
  bank_beneficiary?: string;
  bank_name?: string;
  udyam_number?: string;
  composition_scheme?: boolean;
  onboarded_at?: string;
}

export interface RegisteredAddress {
  line1?: string;
  line2?: string;
  city?: string;
  pincode?: string;
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
