/**
 * Deku Finance — Organisation Tax Regime & Compliance Authority
 *
 * Core Business Rules:
 * 1. Sec 22 vs GST is NOT a dashboard view choice — it is an organisation-level entity status.
 * 2. A Sec 22 company can be converted to GST Registered once it obtains a valid GSTIN.
 * 3. A GST Registered company CANNOT revert back to Sec 22 exemption.
 * 4. Once converted to GST, the organisation operates permanently on the GST module.
 */

export type TaxRegime = "sec22" | "gst";

export interface OrgTaxProfile {
  orgId: string;
  regime: TaxRegime;
  gstin?: string | null;
  tradeName?: string;
  canRevertToSec22: false; // Irreversible per Indian GST statutory compliance
  convertedAt?: string;
  thresholdLimitINR: number;
}

// Canonical seed profiles for known demo organisations
const DEFAULT_TAX_REGIMES: Record<string, OrgTaxProfile> = {
  // 1. Deku Financial Technologies: Starts as Sec 22 Exempt (turnover ₹12.45L < ₹40L limit)
  "b127e064-5da8-437f-94c4-b8d6a0c12927": {
    orgId: "b127e064-5da8-437f-94c4-b8d6a0c12927",
    regime: "sec22",
    gstin: null,
    tradeName: "Deku Financial Technologies",
    canRevertToSec22: false,
    thresholdLimitINR: 4000000,
  },
  // 2. All Might Logistics & Warehousing: Approaching Sec 22 threshold (₹38.70L / ₹40L)
  "b093d7d9-395a-429b-8c9a-af31b8b270f2": {
    orgId: "b093d7d9-395a-429b-8c9a-af31b8b270f2",
    regime: "sec22",
    gstin: null,
    tradeName: "All Might Logistics & Warehousing",
    canRevertToSec22: false,
    thresholdLimitINR: 4000000,
  },
  // 3. Endeavor Energy & Tech Solutions: GST Registered Corporate (turnover ₹72.50L > ₹40L)
  "8aec2336-5531-459e-baba-6a37128cffa2": {
    orgId: "8aec2336-5531-459e-baba-6a37128cffa2",
    regime: "gst",
    gstin: "27AAECE9988C1Z8",
    tradeName: "Endeavor Energy & Tech Solutions",
    canRevertToSec22: false,
    thresholdLimitINR: 4000000,
  },
};

const STORAGE_KEY = "deku_org_tax_regimes_v1";

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

/**
 * Returns deterministic server-safe default tax profile without reading localStorage.
 * Used for initial React state to prevent SSR hydration mismatches.
 */
export function getDefaultTaxProfile(orgId: string): OrgTaxProfile {
  if (DEFAULT_TAX_REGIMES[orgId]) {
    return DEFAULT_TAX_REGIMES[orgId];
  }
  return {
    orgId,
    regime: "sec22",
    gstin: null,
    canRevertToSec22: false,
    thresholdLimitINR: 4000000,
  };
}

/**
 * Retrieves the persistent tax regime profile for an organisation from storage if on client
 */
export function getOrgTaxProfile(orgId: string): OrgTaxProfile {
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: Record<string, OrgTaxProfile> = JSON.parse(stored);
        if (parsed[orgId]) {
          return parsed[orgId];
        }
      }
    } catch (e) {
      console.warn("Failed to load tax regime from storage:", e);
    }
  }

  return getDefaultTaxProfile(orgId);
}

/**
 * Converts a Sec 22 organisation to GST Registered once a valid GSTIN is provided.
 * Under statutory compliance, this conversion is irreversible.
 */
export function convertOrgToGst(
  orgId: string,
  gstin: string,
  tradeName?: string
): { success: boolean; error?: string; profile?: OrgTaxProfile } {
  const validation = validateGstin(gstin);
  if (!validation.isValid) {
    return { success: false, error: validation.error };
  }

  const cleanGstin = gstin.trim().toUpperCase();
  const current = getOrgTaxProfile(orgId);

  const updatedProfile: OrgTaxProfile = {
    ...current,
    orgId,
    regime: "gst",
    gstin: cleanGstin,
    tradeName: tradeName || current.tradeName,
    convertedAt: new Date().toISOString(),
    canRevertToSec22: false, // Rule: A GST company cannot be Sec 22
  };

  if (typeof window !== "undefined") {
    try {
      let storeMap: Record<string, OrgTaxProfile> = {};
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        storeMap = JSON.parse(stored);
      }
      storeMap[orgId] = updatedProfile;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(storeMap));

      // Also sync active operating mode
      localStorage.setItem("deku_operating_mode", "gst_enterprise");

      // Notify entire app of the regime update
      window.dispatchEvent(
        new CustomEvent("deku_org_regime_changed", {
          detail: { orgId, profile: updatedProfile },
        })
      );
    } catch (e: any) {
      return { success: false, error: e?.message || "Storage error" };
    }
  }

  return { success: true, profile: updatedProfile };
}
