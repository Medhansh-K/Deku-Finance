/** Bank and UPI details printed on a sales invoice, plus the UPI payment link for its QR. */

export interface Settlement {
  upiId: string;
  bankName: string;
  accountNumber: string;
  ifsc: string;
  beneficiaryName: string;
}

export const EMPTY_SETTLEMENT: Settlement = {
  upiId: "",
  bankName: "",
  accountNumber: "",
  ifsc: "",
  beneficiaryName: "",
};

export const SALES_CHANNELS = [
  { value: "direct", label: "Direct" },
  { value: "amazon", label: "Amazon" },
  { value: "flipkart", label: "Flipkart" },
  { value: "meesho", label: "Meesho" },
  { value: "myntra", label: "Myntra" },
  { value: "blinkit", label: "Blinkit" },
  { value: "shopify", label: "Shopify" },
  { value: "b2b_portal", label: "B2B portal" },
  { value: "other", label: "Other" },
] as const;

export type SalesChannel = (typeof SALES_CHANNELS)[number]["value"];

export const isValidIfsc = (ifsc: string) => /^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc);

export const isValidUpiId = (upiId: string) => /^[a-zA-Z0-9._-]{2,255}@[a-zA-Z][a-zA-Z0-9.-]{1,63}$/.test(upiId);

/** Field-level errors; empty fields are fine because empty means "not printed". */
export function settlementErrors(s: Settlement): Partial<Record<keyof Settlement, string>> {
  const errors: Partial<Record<keyof Settlement, string>> = {};
  if (s.upiId && !isValidUpiId(s.upiId)) errors.upiId = "UPI ID should look like name@bank";
  const anyBank = s.bankName || s.accountNumber || s.ifsc;
  if (s.ifsc && !isValidIfsc(s.ifsc)) errors.ifsc = "IFSC is 4 letters, then 0, then 6 letters or digits";
  else if (anyBank && !s.ifsc) errors.ifsc = "IFSC is needed to print bank details";
  if (s.accountNumber && !/^\d{9,18}$/.test(s.accountNumber)) errors.accountNumber = "Account number is 9 to 18 digits";
  else if (anyBank && !s.accountNumber) errors.accountNumber = "Account number is needed to print bank details";
  if (anyBank && !s.bankName.trim()) errors.bankName = "Bank name is needed to print bank details";
  return errors;
}

export function buildUpiPayload(p: { vpa: string; payee: string; amountPaise: number; invoiceNumber: string }): string {
  // pa is left raw: UPI apps expect a literal "@" and the ID is already validated to URL-safe characters.
  return (
    `upi://pay?pa=${p.vpa}&pn=${encodeURIComponent(p.payee)}` +
    `&am=${(p.amountPaise / 100).toFixed(2)}&cu=INR&tn=${encodeURIComponent(p.invoiceNumber)}`
  );
}

/** The company's bank and UPI details from its profile (Settings). */
export const settlementFromOrg = (
  org?: { upi_vpa?: string; bank_name?: string; bank_account_number?: string; bank_ifsc?: string; bank_beneficiary?: string } | null
): Settlement => ({
  upiId: org?.upi_vpa ?? "",
  bankName: org?.bank_name ?? "",
  accountNumber: org?.bank_account_number ?? "",
  ifsc: org?.bank_ifsc ?? "",
  beneficiaryName: org?.bank_beneficiary ?? "",
});
