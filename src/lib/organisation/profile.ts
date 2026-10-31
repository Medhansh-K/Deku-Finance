/** Company profile validation and onboarding steps. The database CHECKs and the Rust route enforce the same rules. */

import type { OperatingMode, Organisation, RegisteredAddress } from "@/types";
import type { OrgSummary, OrgSettingsUpdate } from "@/api/endpoints";
import { isValidIfsc, isValidUpiId } from "@/lib/invoices/settlement";
import { isValidGstin } from "@/lib/vouchers/invoice-text-parser";

export const isValidUdyam = (v: string) => /^UDYAM-[A-Z]{2}-\d{2}-\d{7}$/.test(v);
export const isValidStateCode = (v: string) => /^\d{2}$/.test(v);
export const isValidAccountNumber = (v: string) => /^\d{9,18}$/.test(v);

export const toOperatingMode = (m: OrgSummary["operating_mode"]): OperatingMode =>
  m === "gst" ? "gst_enterprise" : "pure_accounting";

/** Maps a database row to the Organisation the app works with. */
export function orgFromRow(o: OrgSummary): Omit<Organisation, "license"> {
  return {
    id: o.id,
    name: o.name,
    slug: o.slug,
    gstin: o.gstin ?? undefined,
    pan: o.pan ?? undefined,
    currency: o.currency,
    timezone: o.timezone,
    fy_start_month: o.financial_year_start_month,
    operating_mode: toOperatingMode(o.operating_mode),
    state_code: o.state_code ?? undefined,
    registered_address: o.registered_address ?? undefined,
    upi_vpa: o.upi_vpa ?? undefined,
    bank_account_number: o.bank_account_number ?? undefined,
    bank_ifsc: o.bank_ifsc ?? undefined,
    bank_beneficiary: o.bank_beneficiary ?? undefined,
    bank_name: o.bank_name ?? undefined,
    udyam_number: o.udyam_number ?? undefined,
    composition_scheme: o.composition_scheme ?? false,
    onboarded_at: o.onboarded_at ?? undefined,
  };
}

export interface ProfileForm {
  mode: "gst" | "pure";
  gstin: string;
  stateCode: string;
  address: RegisteredAddress;
  upiVpa: string;
  bankName: string;
  bankAccountNumber: string;
  bankIfsc: string;
  bankBeneficiary: string;
  udyamNumber: string;
  compositionScheme: boolean;
}

export const formFromOrg = (o?: Partial<Organisation> | null): ProfileForm => ({
  mode: o?.operating_mode === "gst_enterprise" ? "gst" : "pure",
  gstin: o?.gstin ?? "",
  stateCode: o?.state_code ?? "",
  address: o?.registered_address ?? {},
  upiVpa: o?.upi_vpa ?? "",
  bankName: o?.bank_name ?? "",
  bankAccountNumber: o?.bank_account_number ?? "",
  bankIfsc: o?.bank_ifsc ?? "",
  bankBeneficiary: o?.bank_beneficiary ?? "",
  udyamNumber: o?.udyam_number ?? "",
  compositionScheme: o?.composition_scheme ?? false,
});

export type ProfileErrors = Partial<Record<keyof ProfileForm, string>>;

/** Field-level errors. Optional fields may stay empty. */
export function profileErrors(f: ProfileForm): ProfileErrors {
  const e: ProfileErrors = {};
  const gstin = f.gstin.trim().toUpperCase();
  if (!isValidStateCode(f.stateCode)) e.stateCode = "Choose the state your business is registered in";
  if (f.mode === "gst") {
    if (!gstin) e.gstin = "GSTIN is required in GST mode";
    else if (!isValidGstin(gstin)) e.gstin = "This GSTIN is not valid (check the 15 characters)";
    else if (isValidStateCode(f.stateCode) && gstin.slice(0, 2) !== f.stateCode)
      e.gstin = "The first two digits of the GSTIN must match the state";
  } else if (f.compositionScheme) {
    e.compositionScheme = "The composition scheme is only for GST-registered businesses";
  }
  if (f.upiVpa.trim() && !isValidUpiId(f.upiVpa.trim())) e.upiVpa = "UPI ID should look like name@bank";
  const account = f.bankAccountNumber.replace(/\s/g, "");
  if (account && !isValidAccountNumber(account)) e.bankAccountNumber = "Account number is 9 to 18 digits";
  const ifsc = f.bankIfsc.trim().toUpperCase();
  if (ifsc && !isValidIfsc(ifsc)) e.bankIfsc = "IFSC is 4 letters, then 0, then 6 letters or digits";
  const udyam = f.udyamNumber.trim().toUpperCase();
  if (udyam && !isValidUdyam(udyam)) e.udyamNumber = "Udyam number looks like UDYAM-MH-01-0001234";
  return e;
}

/** The PATCH body for a valid form. Pure mode clears the GSTIN and composition flag. */
export const settingsFromForm = (f: ProfileForm): OrgSettingsUpdate => ({
  operating_mode: f.mode,
  gstin: f.mode === "gst" ? f.gstin.trim().toUpperCase() : "",
  state_code: f.stateCode,
  registered_address: f.address,
  upi_vpa: f.upiVpa.trim(),
  bank_name: f.bankName.trim(),
  bank_account_number: f.bankAccountNumber.replace(/\s/g, ""),
  bank_ifsc: f.bankIfsc.trim().toUpperCase(),
  bank_beneficiary: f.bankBeneficiary.trim(),
  udyam_number: f.udyamNumber.trim().toUpperCase(),
  composition_scheme: f.mode === "gst" && f.compositionScheme,
});

export type OnboardingStep = "mode" | "details" | "gstin" | "fiscal" | "accounts";

/** Pure (non-GST) businesses skip the GSTIN step. */
export const onboardingSteps = (mode: ProfileForm["mode"]): OnboardingStep[] =>
  mode === "gst" ? ["mode", "details", "gstin", "fiscal", "accounts"] : ["mode", "details", "fiscal", "accounts"];

/** What blocks leaving a step, or null when it is complete. */
export function stepError(step: OnboardingStep, f: ProfileForm): string | null {
  const e = profileErrors(f);
  if (step === "details") return e.stateCode ?? e.upiVpa ?? e.bankAccountNumber ?? e.bankIfsc ?? e.udyamNumber ?? null;
  if (step === "gstin") return e.gstin ?? e.compositionScheme ?? null;
  return null;
}

const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/** The financial year containing `today`, starting in `startMonth` (1-12; India uses April). */
export function currentFiscalPeriod(today: Date, startMonth = 4) {
  const startYear = today.getMonth() + 1 >= startMonth ? today.getFullYear() : today.getFullYear() - 1;
  const end = new Date(startYear + 1, startMonth - 1, 0); // last day of the month before the next start
  const endYear = end.getFullYear();
  return {
    name: endYear === startYear ? `FY ${startYear}` : `FY ${startYear}-${String(endYear % 100).padStart(2, "0")}`,
    start_date: iso(startYear, startMonth, 1),
    end_date: iso(endYear, end.getMonth() + 1, end.getDate()),
  };
}
