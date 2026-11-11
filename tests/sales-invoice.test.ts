import { describe, it, expect } from "vitest";
import {
  computeTaxSummary,
  isInterState,
  stateCodeOf,
  placeOfSupplyLabel,
} from "@/lib/invoices/tax-summary";
import {
  buildUpiPayload,
  isValidIfsc,
  isValidUpiId,
  settlementErrors,
  EMPTY_SETTLEMENT,
} from "@/lib/invoices/settlement";
import { numberToIndianWords } from "@/lib/builder/number-to-words";

describe("computeTaxSummary", () => {
  it("splits intra-state GST into equal CGST and SGST in paise", () => {
    const s = computeTaxSummary([{ quantity: 2, unitPrice: 500, gstRate: 18 }], { interState: false, roundToRupee: false });
    expect(s).toMatchObject({ taxable: 100000, cgst: 9000, sgst: 9000, igst: 0, cess: 0, total: 118000, roundOff: 0, grandTotal: 118000 });
  });

  it("charges only IGST when inter-state", () => {
    const s = computeTaxSummary([{ quantity: 1, unitPrice: 1000, gstRate: 12 }], { interState: true, roundToRupee: false });
    expect(s).toMatchObject({ taxable: 100000, cgst: 0, sgst: 0, igst: 12000, grandTotal: 112000 });
  });

  it("keeps CGST equal to SGST on odd tax amounts", () => {
    const s = computeTaxSummary([{ quantity: 1, unitPrice: 99.99, gstRate: 5 }], { interState: false, roundToRupee: false });
    expect(s.cgst).toBe(s.sgst);
    expect(s.cgst).toBe(250); // 9999 * 2.5% = 249.975
  });

  it("rounds the grand total to the nearest rupee, up or down", () => {
    const down = computeTaxSummary([{ quantity: 1, unitPrice: 101.4, gstRate: 0 }], { interState: false, roundToRupee: true });
    expect(down).toMatchObject({ total: 10140, roundOff: -40, grandTotal: 10100 });
    const up = computeTaxSummary([{ quantity: 1, unitPrice: 101.5, gstRate: 0 }], { interState: false, roundToRupee: true });
    expect(up).toMatchObject({ roundOff: 50, grandTotal: 10200 });
  });

  it("applies discount and cess on the taxable value and sums lines", () => {
    const s = computeTaxSummary(
      [
        { quantity: 3, unitPrice: 19.99, discount: 0.97, gstRate: 28, cessRate: 12 },
        { quantity: 1.5, unitPrice: 10, gstRate: 18 },
      ],
      { interState: true, roundToRupee: false }
    );
    expect(s.lines[0]).toEqual({ taxable: 5900, cgst: 0, sgst: 0, igst: 1652, cess: 708, total: 8260 });
    expect(s.lines[1].taxable).toBe(1500);
    expect(s.taxable).toBe(7400);
    expect(s.grandTotal).toBe(8260 + 1500 + 270);
  });

  it("never goes below zero taxable", () => {
    const s = computeTaxSummary([{ quantity: 1, unitPrice: 10, discount: 50, gstRate: 18 }], { interState: false, roundToRupee: false });
    expect(s.grandTotal).toBe(0);
  });
});

describe("place of supply", () => {
  it("compares company and place-of-supply state codes", () => {
    expect(stateCodeOf("27AAPFU0939F1ZV")).toBe("27");
    expect(stateCodeOf("29-Karnataka")).toBe("29");
    expect(stateCodeOf("")).toBe("");
    expect(isInterState("27", "27")).toBe(false);
    expect(isInterState("27", "29")).toBe(true);
    expect(placeOfSupplyLabel("27")).toBe("27-Maharashtra");
    expect(placeOfSupplyLabel("99")).toBe("");
  });
});

describe("settlement validation", () => {
  it("validates IFSC", () => {
    expect(isValidIfsc("HDFC0001234")).toBe(true);
    expect(isValidIfsc("SBIN0ABC123")).toBe(true);
    expect(isValidIfsc("HDFC1001234")).toBe(false);
    expect(isValidIfsc("hdfc0001234")).toBe(false);
    expect(isValidIfsc("HDFC000123")).toBe(false);
  });

  it("validates UPI IDs as name@handle", () => {
    expect(isValidUpiId("shop.name-1@okaxis")).toBe(true);
    expect(isValidUpiId("9876543210@ybl")).toBe(true);
    expect(isValidUpiId("noatsign")).toBe(false);
    expect(isValidUpiId("a@b")).toBe(false);
    expect(isValidUpiId("name@1bank")).toBe(false);
    expect(isValidUpiId("na me@okaxis")).toBe(false);
  });

  it("treats empty as not printed, and partial bank details as an error", () => {
    expect(settlementErrors(EMPTY_SETTLEMENT)).toEqual({});
    const errs = settlementErrors({ ...EMPTY_SETTLEMENT, bankName: "Some Bank" });
    expect(Object.keys(errs).sort()).toEqual(["accountNumber", "ifsc"]);
    expect(settlementErrors({ ...EMPTY_SETTLEMENT, upiId: "bad" }).upiId).toBeTruthy();
  });
});

describe("buildUpiPayload", () => {
  it("builds a UPI pay link for the grand total", () => {
    expect(
      buildUpiPayload({ vpa: "shop@okaxis", payee: "Shop & Co", amountPaise: 118050, invoiceNumber: "INV/26-27/001" })
    ).toBe("upi://pay?pa=shop@okaxis&pn=Shop%20%26%20Co&am=1180.50&cu=INR&tn=INV%2F26-27%2F001");
  });
});

describe("numberToIndianWords", () => {
  it("spells paise", () => {
    expect(numberToIndianWords(1180.5)).toBe("Rupees One Thousand One Hundred Eighty and Fifty Paise Only");
    expect(numberToIndianWords(0.29)).toBe("Twenty-Nine Paise Only");
    expect(numberToIndianWords(1.1)).toBe("Rupees One and Ten Paise Only");
  });

  it("spells lakh and crore", () => {
    expect(numberToIndianWords(145800)).toBe("Rupees One Lakh Forty-Five Thousand Eight Hundred Only");
    expect(numberToIndianWords(12345678.9)).toBe(
      "Rupees One Crore Twenty-Three Lakh Forty-Five Thousand Six Hundred Seventy-Eight and Ninety Paise Only"
    );
    expect(numberToIndianWords(10000000000)).toBe("Rupees One Thousand Crore Only");
  });
});
