/**
 * Reads GST invoice fields out of plain text (typed, PDF text layer or on-device OCR).
 * Rule: never invent a value. Anything not found is null and listed in `missing`.
 */

export interface ParsedInvoice {
  invoiceNumber: string | null;
  invoiceDate: string | null; // ISO yyyy-mm-dd
  counterpartyGstin: string | null;
  direction: "purchase" | "sales" | null;
  taxable: number | null;
  cgst: number | null;
  sgst: number | null;
  igst: number | null;
  total: number | null;
  missing: string[];
  warnings: string[];
}

const GSTIN_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const GSTIN_SHAPE = /\b\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]\b/g;

/** GSTIN's 15th character is a mod-36 check digit; this rejects OCR misreads. */
export function isValidGstin(gstin: string): boolean {
  const g = gstin.toUpperCase();
  if (!/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(g)) return false;
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const v = GSTIN_CHARS.indexOf(g[i]) * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(v / 36) + (v % 36);
  }
  return GSTIN_CHARS[(36 - (sum % 36)) % 36] === g[14];
}

// Indian (1,18,000.50) or plain (118000.5) amounts, not followed by "%".
const AMOUNT = /(?<![\d.,])(\d{1,3}(?:,\d{2,3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)(?![\d,]|\s*%)/g;

function lastAmountOnLine(line: string): number | null {
  const matches = [...line.matchAll(AMOUNT)];
  if (matches.length === 0) return null;
  const value = Number(matches[matches.length - 1][1].replace(/,/g, ""));
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
}

/** Amount on the last line matching the label (summary rows sit at the bottom). */
function amountFor(lines: string[], label: RegExp): number | null {
  for (let i = lines.length - 1; i >= 0; i--) {
    if (label.test(lines[i])) {
      const v = lastAmountOnLine(lines[i].replace(label, " "));
      if (v !== null) return v;
    }
  }
  return null;
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function toIso(y: number, m: number, d: number): string | null {
  if (y < 100) y += 2000;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return dt.toISOString().slice(0, 10);
}

function findDate(text: string): string | null {
  const patterns: [RegExp, (m: RegExpMatchArray) => string | null][] = [
    [/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/, (m) => toIso(+m[1], +m[2], +m[3])],
    // India writes day first.
    [/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})\b/, (m) => toIso(+m[3], +m[2], +m[1])],
    [
      /\b(\d{1,2})[\s-]([A-Za-z]{3})[A-Za-z]*[\s-,]+(\d{4}|\d{2})\b/,
      (m) => {
        const mi = MONTHS.indexOf(m[2].toLowerCase());
        return mi < 0 ? null : toIso(+m[3], mi + 1, +m[1]);
      },
    ],
  ];
  for (const [re, conv] of patterns) {
    const m = text.match(re);
    if (m) {
      const iso = conv(m);
      if (iso) return iso;
    }
  }
  return null;
}

const TOTAL_LABEL =
  /grand\s*total|total\s*(?:invoice\s*)?(?:amount|value)|invoice\s*(?:total|value)|net\s*(?:payable|amount)|(?:amount|total)\s*payable/i;
const TAXABLE_LABEL = /taxable\s*(?:value|amount)|sub\s*-?\s*total/i;

export function parseInvoiceText(text: string, orgGstin?: string | null): ParsedInvoice {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const upper = text.toUpperCase();

  const gstins = [...new Set((upper.match(GSTIN_SHAPE) || []).filter(isValidGstin))];
  const org = orgGstin?.trim().toUpperCase() || null;
  const orgIndex = org ? gstins.indexOf(org) : -1;
  // Supplier GSTIN is printed first on a tax invoice.
  const direction = orgIndex === -1 ? null : orgIndex === 0 ? "sales" : "purchase";
  const counterpartyGstin = gstins.find((g) => g !== org) ?? null;

  const invMatch = text.match(
    /(?:invoice|inv|bill)\.?\s*(?:no\.?|number|#)\s*[:.\-#]?\s*([A-Z0-9][A-Z0-9\-/]*)/i
  );
  // GST rules cap invoice numbers at 16 characters.
  const invoiceNumber =
    invMatch && /\d/.test(invMatch[1]) && invMatch[1].length <= 16 ? invMatch[1] : null;

  const dateLine = lines.find((l) => /(?:invoice|inv\.?|bill)\s*date|dated|^date\b/i.test(l) && !/due/i.test(l));
  const invoiceDate = (dateLine && findDate(dateLine)) || findDate(text);

  const total = amountFor(lines, TOTAL_LABEL);
  const taxable = amountFor(lines, TAXABLE_LABEL);
  const cgst = amountFor(lines, /\bc\.?gst\b/i);
  const sgst = amountFor(lines, /\b(?:s|ut)\.?gst\b/i);
  const igst = amountFor(lines, /\bi\.?gst\b/i);

  const missing: string[] = [];
  if (!invoiceNumber) missing.push("Invoice number");
  if (!invoiceDate) missing.push("Invoice date");
  if (!counterpartyGstin) missing.push("Party GSTIN");
  if (total === null) missing.push("Invoice total");
  if (taxable === null) missing.push("Taxable value");
  if (cgst === null && sgst === null && igst === null) missing.push("GST amounts");
  if (!direction) missing.push("Sales or purchase (your GSTIN not found on the document)");

  const warnings: string[] = [];
  const tax = (cgst ?? 0) + (sgst ?? 0) + (igst ?? 0);
  if (total !== null && taxable !== null) {
    const diff = Math.abs(taxable + tax - total);
    // Up to ₹1 is normal round-off.
    if (diff > 1) warnings.push(`Taxable value + GST differs from the total by ₹${diff.toFixed(2)}.`);
  }
  if (cgst !== null && sgst !== null && Math.abs(cgst - sgst) > 0.02) {
    warnings.push("CGST and SGST should be equal on an intra-state invoice.");
  }
  if (igst && (cgst || sgst)) {
    warnings.push("An invoice should have either IGST or CGST + SGST, not both.");
  }

  return { invoiceNumber, invoiceDate, counterpartyGstin, direction, taxable, cgst, sgst, igst, total, missing, warnings };
}
