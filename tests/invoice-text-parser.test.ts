import { describe, it, expect } from "vitest";
import { isValidGstin, parseInvoiceText } from "@/lib/vouchers/invoice-text-parser";

const OUR = "27AABCD1234F1Z6";
const VENDOR = "29AABCT1332L1ZA";

const purchaseBill = `
TAX INVOICE
Cloudnine Hosting Pvt Ltd   GSTIN: ${VENDOR}
Bill To: Our Company        GSTIN: ${OUR}
Invoice No: CNH/26-27/0042
Invoice Date: 14/10/2026
Due Date: 13/11/2026
Taxable Value              1,00,000.00
IGST @ 18%                   18,000.00
Grand Total             ₹ 1,18,000.00
`;

describe("isValidGstin", () => {
  it("accepts a real check digit and rejects a one-character OCR slip", () => {
    expect(isValidGstin("27AAPFU0939F1ZV")).toBe(true);
    expect(isValidGstin("27AAPFU0939F1ZW")).toBe(false);
  });
});

describe("parseInvoiceText", () => {
  it("reads every field of an inter-state purchase bill", () => {
    const r = parseInvoiceText(purchaseBill, OUR);
    expect(r).toMatchObject({
      invoiceNumber: "CNH/26-27/0042",
      invoiceDate: "2026-10-14",
      counterpartyGstin: VENDOR,
      direction: "purchase",
      taxable: 100000,
      igst: 18000,
      cgst: null,
      total: 118000,
    });
    expect(r.missing).toEqual([]);
    expect(r.warnings).toEqual([]);
  });

  it("detects a sales invoice when our GSTIN is printed first, and ignores the % rate", () => {
    const r = parseInvoiceText(
      `GSTIN ${OUR}\nBuyer GSTIN ${VENDOR}\nInv No. S-101\nDated 2-Oct-2026\nSub Total 5000\nCGST @ 9% 450.00\nSGST @ 9% 450.00\nTotal Amount 5900.00`,
      OUR
    );
    expect(r).toMatchObject({ direction: "sales", cgst: 450, sgst: 450, total: 5900, invoiceDate: "2026-10-02" });
  });

  it("never invents values for text it cannot read", () => {
    const r = parseInvoiceText("blurry scan, nothing legible", OUR);
    expect(r).toMatchObject({ invoiceNumber: null, invoiceDate: null, total: null, taxable: null, direction: null });
    expect(r.missing).toContain("Invoice total");
  });

  it("warns when the totals do not add up", () => {
    const r = parseInvoiceText(`Taxable Value 1000\nCGST 90\nSGST 80\nGrand Total 1500`, OUR);
    expect(r.warnings.join(" ")).toMatch(/differs from the total/);
    expect(r.warnings.join(" ")).toMatch(/CGST and SGST should be equal/);
  });

  it("drops a GSTIN with a bad check digit instead of using it", () => {
    const r = parseInvoiceText(`Supplier GSTIN 29AABCT1332L1ZB\nGrand Total 100`, OUR);
    expect(r.counterpartyGstin).toBeNull();
  });
});
