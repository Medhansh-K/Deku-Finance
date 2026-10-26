/**
 * Deku Finance — Authoritative Financial Formatting (INR & Precision)
 * Follows Indian Rupee comma grouping: Lakhs and Crores (e.g. ₹ 1,50,000.00)
 */

export function formatINR(
  amount: number | string | null | undefined,
  options: {
    showCurrencySymbol?: boolean;
    showDrCr?: boolean;
    alwaysPositive?: boolean;
    minimumFractionDigits?: number;
  } = {}
): string {
  const {
    showCurrencySymbol = true,
    showDrCr = false,
    alwaysPositive = false,
    minimumFractionDigits = 2,
  } = options;

  if (amount === null || amount === undefined || isNaN(Number(amount))) {
    return showCurrencySymbol ? "₹ 0.00" : "0.00";
  }

  const num = Number(amount);
  const isNegative = num < 0;
  const absNum = Math.abs(num);

  const formattedNum = absNum.toLocaleString("en-IN", {
    minimumFractionDigits,
    maximumFractionDigits: 2,
  });

  const prefix = showCurrencySymbol ? "₹ " : "";

  if (showDrCr) {
    const drCr = isNegative ? "Cr" : num > 0 ? "Dr" : "";
    return `${prefix}${formattedNum} ${drCr}`.trim();
  }

  if (alwaysPositive) {
    return `${prefix}${formattedNum}`;
  }

  return isNegative ? `-${prefix}${formattedNum}` : `${prefix}${formattedNum}`;
}

export function parseAmount(val: string): number {
  if (!val) return 0;
  // Strip currency symbols and commas
  const cleaned = val.replace(/[₹,\s]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : Math.round(num * 100) / 100;
}
