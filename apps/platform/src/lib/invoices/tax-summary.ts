/**
 * Sales invoice tax maths in paise. Mirrors issue_sales_invoice (migration 10, redefined in 25):
 * intra-state lines carry equal CGST/SGST and no IGST, inter-state lines carry only IGST,
 * and the grand total is taxable + tax + round-off.
 */

export const GST_STATES: ReadonlyArray<readonly [string, string]> = [
  ["01", "Jammu and Kashmir"], ["02", "Himachal Pradesh"], ["03", "Punjab"], ["04", "Chandigarh"],
  ["05", "Uttarakhand"], ["06", "Haryana"], ["07", "Delhi"], ["08", "Rajasthan"],
  ["09", "Uttar Pradesh"], ["10", "Bihar"], ["11", "Sikkim"], ["12", "Arunachal Pradesh"],
  ["13", "Nagaland"], ["14", "Manipur"], ["15", "Mizoram"], ["16", "Tripura"],
  ["17", "Meghalaya"], ["18", "Assam"], ["19", "West Bengal"], ["20", "Jharkhand"],
  ["21", "Odisha"], ["22", "Chhattisgarh"], ["23", "Madhya Pradesh"], ["24", "Gujarat"],
  ["26", "Dadra and Nagar Haveli and Daman and Diu"], ["27", "Maharashtra"], ["29", "Karnataka"],
  ["30", "Goa"], ["31", "Lakshadweep"], ["32", "Kerala"], ["33", "Tamil Nadu"],
  ["34", "Puducherry"], ["35", "Andaman and Nicobar Islands"], ["36", "Telangana"],
  ["37", "Andhra Pradesh"], ["38", "Ladakh"], ["97", "Other Territory"],
];

/** "27-Maharashtra" for a state code, the format place_of_supply is stored in. */
export function placeOfSupplyLabel(code: string): string {
  const state = GST_STATES.find(([c]) => c === code);
  return state ? `${state[0]}-${state[1]}` : "";
}

export const stateCodeOf = (placeOfSupplyOrGstin: string | null | undefined): string =>
  /^\d{2}/.exec(placeOfSupplyOrGstin ?? "")?.[0] ?? "";

export const isInterState = (companyStateCode: string, placeOfSupplyCode: string) =>
  companyStateCode !== placeOfSupplyCode;

export const toPaise = (rupees: number) => Math.round((Number(rupees) || 0) * 100);

export interface TaxLineInput {
  quantity: number;
  unitPrice: number; // rupees, as typed
  discount?: number; // rupees
  gstRate: number; // percent
  cessRate?: number; // percent
}

export interface LineTax {
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  total: number;
}

export interface TaxSummary extends LineTax {
  lines: LineTax[];
  interState: boolean;
  roundOff: number;
  grandTotal: number;
}

export function computeTaxSummary(
  lines: TaxLineInput[],
  opts: { interState: boolean; roundToRupee: boolean }
): TaxSummary {
  const lineTaxes = lines.map((l): LineTax => {
    const taxable = Math.max(0, Math.round((Number(l.quantity) || 0) * toPaise(l.unitPrice)) - toPaise(l.discount ?? 0));
    const rate = Number(l.gstRate) || 0;
    // Each half is rounded on its own so CGST always equals SGST, as the database requires.
    const half = opts.interState ? 0 : Math.round((taxable * rate) / 200);
    const igst = opts.interState ? Math.round((taxable * rate) / 100) : 0;
    const cess = Math.round((taxable * (Number(l.cessRate) || 0)) / 100);
    return { taxable, cgst: half, sgst: half, igst, cess, total: taxable + 2 * half + igst + cess };
  });
  const sum = (k: keyof LineTax) => lineTaxes.reduce((s, l) => s + l[k], 0);
  const total = sum("total");
  const roundOff = opts.roundToRupee ? Math.round(total / 100) * 100 - total : 0;
  return {
    lines: lineTaxes,
    interState: opts.interState,
    taxable: sum("taxable"),
    cgst: sum("cgst"),
    sgst: sum("sgst"),
    igst: sum("igst"),
    cess: sum("cess"),
    total,
    roundOff,
    grandTotal: total + roundOff,
  };
}
