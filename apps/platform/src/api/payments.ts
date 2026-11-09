import { apiClient } from "./client";
import type { ApiResponse } from "./endpoints";

/** Each company's own Razorpay account (migration 036). Tokens never reach the browser. */
export interface PaymentConnection {
  razorpay_account_id: string;
  mode: "test" | "live";
  status: "connected" | "revoked" | "error";
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentsStatus {
  configured: boolean;
  reason?: string;
  connection: PaymentConnection | null;
}

export interface PaymentLink {
  id: string;
  invoice_id: string;
  link_id: string;
  short_url: string;
  amount_paise: number;
  status: "created" | "paid" | "cancelled" | "expired";
  created_at?: string;
}

/** Exactly what Deku sends to Razorpay for a payment link; shown as the consent note. */
export const SHARED_WITH_RAZORPAY = [
  "Invoice number",
  "Amount due on the invoice",
  "Customer name, email and phone number (only the ones saved on the customer)",
] as const;

export const isConnected = (s: PaymentsStatus | null) => !!s?.configured && s.connection?.status === "connected";

/** The link to share for an invoice: the open one, else the paid one (for the record). */
export function linkForInvoice(links: PaymentLink[], invoiceId: string): PaymentLink | null {
  const mine = links.filter((l) => l.invoice_id === invoiceId && /^https:\/\//.test(l.short_url));
  return mine.find((l) => l.status === "created") ?? mine.find((l) => l.status === "paid") ?? null;
}

const base = (orgId: string) => `/api/v1/organisations/${orgId}`;

export const paymentsApi = {
  status: (orgId: string) => apiClient<ApiResponse<PaymentsStatus>>(`${base(orgId)}/payments/status`),
  links: (orgId: string, invoiceId?: string) =>
    apiClient<ApiResponse<PaymentLink[]>>(
      `${base(orgId)}/payments/links${invoiceId ? `?invoice_id=${encodeURIComponent(invoiceId)}` : ""}`
    ),
  connect: (orgId: string, mode: "live" | "test") =>
    apiClient<ApiResponse<{ authorize_url: string }>>(`${base(orgId)}/payments/razorpay/connect`, {
      method: "POST",
      body: JSON.stringify({ mode }),
    }),
  disconnect: (orgId: string) =>
    apiClient<ApiResponse<{ status: string }>>(`${base(orgId)}/payments/razorpay/disconnect`, { method: "POST" }),
  createLink: (orgId: string, invoiceId: string) =>
    apiClient<ApiResponse<PaymentLink>>(`${base(orgId)}/invoices/${invoiceId}/payment-link`, { method: "POST" }),
};
