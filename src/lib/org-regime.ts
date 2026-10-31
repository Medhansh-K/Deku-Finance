/**
 * Deku Finance — Organisation Tax Regime
 *
 * The regime is read from the company record: a company with a GSTIN is GST-registered,
 * one without is treated as unregistered (Sec 22). Converting saves the GSTIN on the record.
 * A GST-registered company cannot revert to Sec 22.
 */

import { organisationsApi } from "@/api/endpoints";

export type TaxRegime = "sec22" | "gst";

export interface OrgTaxProfile {
  orgId: string;
  regime: TaxRegime;
  gstin: string | null;
}

/**
 * Validates 15-character Indian GSTIN format
 * Pattern: 2 state digits + 5 PAN chars + 4 PAN digits + 1 PAN char + 1 entity num + 'Z' + 1 checksum
 */
export function validateGstin(gstin: string): { isValid: boolean; error?: string } {
  const clean = gstin.trim().toUpperCase();
  if (!clean) {
    return { isValid: false, error: "GSTIN is required" };
  }
  if (clean.length !== 15) {
    return { isValid: false, error: "GSTIN must be exactly 15 characters" };
  }
  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  if (!gstinRegex.test(clean)) {
    return {
      isValid: false,
      error: "Invalid GSTIN format. Expected: 2 state digits + 10-char PAN + 1 entity + 'Z' + check char (e.g. 27AAACD1234E1Z5)",
    };
  }
  return { isValid: true };
}

export function taxProfileFor(org: { id: string; gstin?: string | null }): OrgTaxProfile {
  const gstin = org.gstin?.trim() || null;
  return { orgId: org.id, regime: gstin ? "gst" : "sec22", gstin };
}

/** Reads the company record; null when it can't be loaded (the regime is then unknown). */
export async function loadOrgTaxProfile(orgId: string): Promise<OrgTaxProfile | null> {
  if (!orgId) return null;
  try {
    const org = (await organisationsApi.get(orgId)).data?.[0];
    return org ? taxProfileFor(org) : null;
  } catch {
    return null;
  }
}

/** Saves the GSTIN on the company record, which makes it GST-registered. */
export async function convertOrgToGst(
  orgId: string,
  gstin: string
): Promise<{ success: boolean; error?: string; profile?: OrgTaxProfile }> {
  const validation = validateGstin(gstin);
  if (!validation.isValid) {
    return { success: false, error: validation.error };
  }
  try {
    const clean = gstin.trim().toUpperCase();
    const res = await organisationsApi.updateSettings(orgId, {
      gstin: clean,
      operating_mode: "gst",
      state_code: clean.slice(0, 2),
    });
    const org = res.data?.[0];
    if (!org?.gstin) return { success: false, error: "The company record was not updated." };
    const profile = taxProfileFor(org);
    window.dispatchEvent(new CustomEvent("deku_org_regime_changed", { detail: { orgId, profile } }));
    return { success: true, profile };
  } catch (e: any) {
    return { success: false, error: e?.message || "Could not save the GSTIN" };
  }
}
