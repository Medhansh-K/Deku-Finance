import { apiClient } from "./client";
import { ApiError } from "./errors";
import type { ApiResponse, GstReturnType } from "./endpoints";

/** Third-party integrations (backend/src/routes/gsp.rs, kyc.rs). Both are off until the server configures a provider. */

export interface GspConnection {
  id: string;
  provider: string;
  gstin: string;
  status: "disconnected" | "otp_pending" | "connected" | "error";
  session_expires_at: string | null;
  last_error: string | null;
  enabled_at: string | null;
}

export interface GspStatus {
  configured: boolean;
  reason: string | null;
  provider: string | null;
  sandbox: boolean;
  connection: GspConnection | null;
}

export interface EInvoice {
  id: string;
  provider: string;
  irn: string;
  ack_no: string | null;
  ack_date: string | null;
  signed_qr: string | null;
  status: "generated" | "cancelled";
  cancel_reason: string | null;
}

export interface EwayBill {
  id: string;
  provider: string;
  ewb_no: string;
  valid_upto: string | null;
  vehicle_no: string | null;
  transporter_id: string | null;
  distance_km: number;
  status: "active" | "cancelled";
  cancel_reason: string | null;
}

export type KycMethod = "pan" | "udyam" | "gstin" | "digilocker" | "entitylocker";

export interface KycVerification {
  id: string;
  subject: "person" | "business";
  user_id: string | null;
  method: KycMethod;
  status: "pending" | "verified" | "failed" | "expired";
  provider: string;
  verified_name: string | null;
  verified_at: string | null;
  expires_at: string | null;
  failure_reason: string | null;
  created_at: string;
}

export interface TrustLevel {
  trust_level: 0 | 1 | 2;
  business_verified: boolean;
  person_verified: boolean;
  verified_methods: KycMethod[];
}

export interface KycStatus {
  configured: boolean;
  provider: string | null;
  sandbox: boolean;
  verifications: KycVerification[];
  trust: TrustLevel | null;
}

/** True when the server answered 503 because the integration is switched off. */
export function isNotConfigured(err: unknown): boolean {
  return err instanceof ApiError && err.status === 503 && /_not_configured$/.test(err.message);
}

/** Readable text for an integration error; the 503 codes are not meant for people. */
export function integrationErrorText(err: unknown): string {
  if (isNotConfigured(err)) {
    return (err as ApiError).message.startsWith("gsp")
      ? "No GST Suvidha Provider is configured on this server, so Deku can't reach the GST portal."
      : "No KYC provider is configured on this server, so identity checks are unavailable.";
  }
  return (err as Error)?.message || "Request failed";
}

const post = (body?: unknown): RequestInit => ({ method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });

export const gspApi = {
  status: (orgId: string) => apiClient<ApiResponse<GspStatus>>(`/api/v1/organisations/${orgId}/gsp/status`),
  connect: (orgId: string, username: string) =>
    apiClient<ApiResponse<GspConnection>>(`/api/v1/organisations/${orgId}/gsp/connect`, post({ username })),
  startOtp: (orgId: string) => apiClient<ApiResponse<GspConnection>>(`/api/v1/organisations/${orgId}/gsp/otp/start`, post()),
  verifyOtp: (orgId: string, otp: string) =>
    apiClient<ApiResponse<GspConnection>>(`/api/v1/organisations/${orgId}/gsp/otp/verify`, post({ otp })),
  disconnect: (orgId: string) => apiClient<ApiResponse<GspConnection>>(`/api/v1/organisations/${orgId}/gsp/disconnect`, post()),
  requestEvcOtp: (orgId: string, period: string, type: GstReturnType, evcPan: string) =>
    apiClient<ApiResponse<{ sent: boolean }>>(`/api/v1/organisations/${orgId}/gsp/gst/${period}/${type}/evc-otp`, post({ evc_pan: evcPan })),
  file: (orgId: string, period: string, type: GstReturnType, evcPan: string, evcOtp: string) =>
    apiClient<ApiResponse<{ arn: string }>>(
      `/api/v1/organisations/${orgId}/gsp/gst/${period}/${type}/file`,
      post({ evc_pan: evcPan, evc_otp: evcOtp }),
    ),
  invoiceDocuments: (orgId: string, invId: string) =>
    apiClient<ApiResponse<{ e_invoices: EInvoice[]; eway_bills: EwayBill[] }>>(`/api/v1/organisations/${orgId}/gsp/invoices/${invId}`),
  generateIrn: (orgId: string, invId: string) =>
    apiClient<ApiResponse<EInvoice>>(`/api/v1/organisations/${orgId}/gsp/invoices/${invId}/irn`, post()),
  cancelIrn: (orgId: string, invId: string, reasonCode: number, remark: string) =>
    apiClient<ApiResponse<EInvoice>>(
      `/api/v1/organisations/${orgId}/gsp/invoices/${invId}/irn/cancel`,
      post({ reason_code: reasonCode, remark }),
    ),
  generateEway: (orgId: string, invId: string, body: { vehicle_no?: string; transporter_id?: string; distance_km: number }) =>
    apiClient<ApiResponse<EwayBill>>(`/api/v1/organisations/${orgId}/gsp/invoices/${invId}/eway`, post(body)),
  cancelEway: (orgId: string, invId: string, reasonCode: number, remark: string) =>
    apiClient<ApiResponse<EwayBill>>(
      `/api/v1/organisations/${orgId}/gsp/invoices/${invId}/eway/cancel`,
      post({ reason_code: reasonCode, remark }),
    ),
};

export const kycApi = {
  status: (orgId: string) => apiClient<ApiResponse<KycStatus>>(`/api/v1/organisations/${orgId}/kyc/status`),
  verifyPan: (orgId: string, subject: "person" | "business", pan: string, name?: string) =>
    apiClient<ApiResponse<KycVerification>>(`/api/v1/organisations/${orgId}/kyc/pan`, post({ subject, pan, name })),
  verifyUdyam: (orgId: string, udyamNumber: string) =>
    apiClient<ApiResponse<KycVerification>>(`/api/v1/organisations/${orgId}/kyc/udyam`, post({ udyam_number: udyamNumber })),
  verifyGstin: (orgId: string, gstin?: string) =>
    apiClient<ApiResponse<KycVerification>>(`/api/v1/organisations/${orgId}/kyc/gstin`, post({ gstin })),
  startDigilocker: (orgId: string, subject: "person" | "business") =>
    apiClient<ApiResponse<{ id: string; authorize_url: string }>>(`/api/v1/organisations/${orgId}/kyc/digilocker/start`, post({ subject })),
  completeDigilocker: (orgId: string, id: string, code: string) =>
    apiClient<ApiResponse<KycVerification>>(`/api/v1/organisations/${orgId}/kyc/digilocker/complete`, post({ id, code })),
};

export const TRUST_LABELS: Record<0 | 1 | 2, { label: string; detail: string }> = {
  0: { label: "Unverified", detail: "No current identity check for this company." },
  1: { label: "Business verified", detail: "The company's PAN, GSTIN, Udyam or EntityLocker record was checked." },
  2: { label: "Business and people verified", detail: "The company and at least one member were checked." },
};

/** The latest row per method, so a newer failure or re-check replaces an older one. */
export function latestByMethod(rows: KycVerification[], subject: "person" | "business", userId?: string): Partial<Record<KycMethod, KycVerification>> {
  const out: Partial<Record<KycMethod, KycVerification>> = {};
  for (const r of rows) {
    if (r.subject !== subject || (subject === "person" && userId && r.user_id !== userId)) continue;
    const prev = out[r.method];
    if (!prev || r.created_at > prev.created_at) out[r.method] = r;
  }
  return out;
}
