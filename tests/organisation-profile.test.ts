import { describe, it, expect } from "vitest";
import {
  currentFiscalPeriod,
  formFromOrg,
  isValidUdyam,
  onboardingSteps,
  orgFromRow,
  profileErrors,
  settingsFromForm,
  stepError,
} from "@/lib/organisation/profile";
import { settlementFromOrg } from "@/lib/invoices/settlement";

// 27AAPFU0939F1ZV is a GSTIN with a valid check digit (state 27, Maharashtra).
const GSTIN = "27AAPFU0939F1ZV";
const base = { ...formFromOrg(null), stateCode: "27" };

describe("profile validation", () => {
  it("accepts a complete GST profile", () => {
    expect(
      profileErrors({
        ...base, mode: "gst", gstin: GSTIN.toLowerCase(), upiVpa: "shop@okhdfc", bankAccountNumber: "5020 0012 3456",
        bankIfsc: "hdfc0001234", udyamNumber: "udyam-mh-01-0001234", compositionScheme: true,
      })
    ).toEqual({});
  });

  it("names each bad field", () => {
    const e = profileErrors({ ...base, stateCode: "", upiVpa: "nope", bankAccountNumber: "12", bankIfsc: "HDFC1001234", udyamNumber: "UDYAM-1" });
    expect(Object.keys(e).sort()).toEqual(["bankAccountNumber", "bankIfsc", "stateCode", "udyamNumber", "upiVpa"]);
  });

  it("checks the GSTIN check digit and its state", () => {
    expect(profileErrors({ ...base, mode: "gst", gstin: "" }).gstin).toMatch(/required/);
    expect(profileErrors({ ...base, mode: "gst", gstin: "27AAPFU0939F1ZA" }).gstin).toMatch(/not valid/);
    expect(profileErrors({ ...base, mode: "gst", gstin: GSTIN, stateCode: "29" }).gstin).toMatch(/match the state/);
  });

  it("keeps the composition scheme to GST mode", () => {
    expect(profileErrors({ ...base, mode: "pure", compositionScheme: true }).compositionScheme).toBeTruthy();
    expect(settingsFromForm({ ...base, mode: "pure", gstin: GSTIN, compositionScheme: true })).toMatchObject({
      operating_mode: "pure", gstin: "", composition_scheme: false,
    });
  });

  it("normalises what it sends", () => {
    expect(settingsFromForm({ ...base, mode: "gst", gstin: ` ${GSTIN.toLowerCase()} `, bankIfsc: "hdfc0001234", bankAccountNumber: "50 20" }))
      .toMatchObject({ gstin: GSTIN, bank_ifsc: "HDFC0001234", bank_account_number: "5020", state_code: "27" });
  });

  it("matches the Udyam format", () => {
    expect(isValidUdyam("UDYAM-MH-01-0001234")).toBe(true);
    expect(isValidUdyam("UDYAM-MH-1-0001234")).toBe(false);
  });
});

describe("onboarding steps", () => {
  it("skips the GSTIN step in pure mode", () => {
    expect(onboardingSteps("gst")).toEqual(["mode", "details", "gstin", "fiscal", "accounts"]);
    expect(onboardingSteps("pure")).toEqual(["mode", "details", "fiscal", "accounts"]);
  });

  it("blocks a step until its fields are valid", () => {
    expect(stepError("details", { ...base, stateCode: "" })).toMatch(/state/);
    expect(stepError("details", base)).toBeNull();
    expect(stepError("gstin", { ...base, mode: "gst", gstin: "" })).toMatch(/required/);
    expect(stepError("gstin", { ...base, mode: "gst", gstin: GSTIN })).toBeNull();
  });

  it("proposes the financial year that contains today", () => {
    expect(currentFiscalPeriod(new Date(2026, 9, 31))).toEqual({ name: "FY 2026-27", start_date: "2026-04-01", end_date: "2027-03-31" });
    expect(currentFiscalPeriod(new Date(2027, 2, 31))).toMatchObject({ start_date: "2026-04-01" });
    expect(currentFiscalPeriod(new Date(2026, 5, 1), 1)).toEqual({ name: "FY 2026", start_date: "2026-01-01", end_date: "2026-12-31" });
  });
});

describe("profile from the database", () => {
  const row = {
    id: "o1", name: "Co", slug: "co", currency: "INR", timezone: "Asia/Kolkata", financial_year_start_month: 4,
    operating_mode: "gst" as const, upi_vpa: "shop@okhdfc", bank_ifsc: "HDFC0001234", bank_account_number: "123456789",
    bank_name: "HDFC", bank_beneficiary: null, onboarded_at: null,
  };

  it("maps the mode and leaves missing values empty", () => {
    const org = orgFromRow(row);
    expect(org.operating_mode).toBe("gst_enterprise");
    expect(org.onboarded_at).toBeUndefined();
    expect(orgFromRow({ ...row, operating_mode: "pure" }).operating_mode).toBe("pure_accounting");
  });

  it("feeds invoice bank and UPI details", () => {
    expect(settlementFromOrg(orgFromRow(row))).toEqual({
      upiId: "shop@okhdfc", bankName: "HDFC", accountNumber: "123456789", ifsc: "HDFC0001234", beneficiaryName: "",
    });
    expect(settlementFromOrg(null).upiId).toBe("");
  });
});
