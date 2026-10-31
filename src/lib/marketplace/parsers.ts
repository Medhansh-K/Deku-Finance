/**
 * Marketplace settlement reports (runs in the browser; the file never leaves the device).
 * Report layouts change often, so nothing here knows a channel's format: the company maps its
 * file's columns to the canonical fields once per channel (saved in marketplace_column_maps).
 */
import { parseMoneyPaise, parseStatementDate, splitCsv } from "@/lib/bank/statement-parser";

export const AMOUNT_FIELDS = [
  "gross_sales",
  "refunds",
  "commission",
  "other_fees",
  "gst_on_fees",
  "tcs_amount",
  "tds_amount",
] as const;
export type AmountField = (typeof AMOUNT_FIELDS)[number];

export const FIELDS = [
  { key: "settlement_ref", label: "Settlement ID" },
  { key: "txn_date", label: "Date" },
  { key: "order_id", label: "Order ID" },
  { key: "sku", label: "SKU" },
  { key: "description", label: "Type / description" },
  { key: "gross_sales", label: "Sales (principal)" },
  { key: "refunds", label: "Refunds" },
  { key: "commission", label: "Commission" },
  { key: "other_fees", label: "Other fees (shipping, fulfilment, ...)" },
  { key: "gst_on_fees", label: "GST on fees" },
  { key: "tcs_amount", label: "TCS (section 52)" },
  { key: "tds_amount", label: "TDS (section 194-O)" },
  { key: "net_payout", label: "Net payout (optional, for the check)" },
] as const;
export type FieldKey = (typeof FIELDS)[number]["key"];

/** Canonical field -> header text in the company's file. */
export type ColumnMapping = Partial<Record<FieldKey, string>>;

export interface ColumnMap {
  mapping: ColumnMapping;
  /** Reports usually print deductions (fees, refunds, TCS) as negative numbers. */
  deductions_negative: boolean;
}

export interface SettlementLine {
  row: number;
  txn_date: string | null;
  order_id: string | null;
  sku: string | null;
  description: string | null;
  line_type: AmountField;
  /** Header sign convention: deductions positive. */
  amountPaise: number;
}

export interface RowError {
  row: number;
  raw: string;
  reason: string;
}

export type Totals = Record<AmountField, number>;

export interface ParsedSettlement {
  fileError: string | null;
  lines: SettlementLine[];
  errors: RowError[];
  totals: Totals;
  /** gross - refunds - every deduction: what the database CHECK requires as net payout. */
  computedNetPaise: number;
  /** Sum of the mapped net column, or null when no net column is mapped. */
  fileNetPaise: number | null;
  refs: string[];
  periodFrom: string | null;
  periodTo: string | null;
}

const norm = (h: string) => h.trim().toLowerCase();
const isBlank = (cells: string[]) => cells.every((c) => /^[\s*=\-_]*$/.test(c));

/**
 * Header row and its columns. With a saved mapping it is the first row holding every mapped header;
 * otherwise the first of the widest rows near the top (preamble lines are narrower than the table).
 */
export function readHeader(text: string, mapping: ColumnMapping = {}) {
  const rows = splitCsv(text);
  const top = rows.slice(0, 50);
  const wanted = Object.values(mapping).filter(Boolean).map((h) => norm(h!));
  let idx = -1;
  if (wanted.length) {
    idx = top.findIndex((r) => {
      const have = new Set(r.cells.map(norm));
      return wanted.every((w) => have.has(w));
    });
  }
  if (idx === -1) {
    const width = (r: { cells: string[] }) => r.cells.filter((c) => c.trim() !== "").length;
    const max = Math.max(0, ...top.map(width));
    idx = max >= 2 ? top.findIndex((r) => width(r) === max) : -1;
  }
  return {
    rows,
    headerIndex: idx,
    headers: idx === -1 ? [] : rows[idx].cells.map((c) => c.trim()).filter((c) => c !== ""),
  };
}

const zeroTotals = (): Totals =>
  Object.fromEntries(AMOUNT_FIELDS.map((f) => [f, 0])) as Totals;

export function netFrom(t: Totals): number {
  return t.gross_sales - t.refunds - t.commission - t.other_fees - t.gst_on_fees - t.tcs_amount - t.tds_amount;
}

export function parseSettlement(text: string, map: ColumnMap): ParsedSettlement {
  const result: ParsedSettlement = {
    fileError: null,
    lines: [],
    errors: [],
    totals: zeroTotals(),
    computedNetPaise: 0,
    fileNetPaise: null,
    refs: [],
    periodFrom: null,
    periodTo: null,
  };
  const { mapping } = map;
  const amountFields = AMOUNT_FIELDS.filter((f) => mapping[f]);
  if (amountFields.length === 0) {
    result.fileError = "Map at least one amount column.";
    return result;
  }

  const { rows, headerIndex } = readHeader(text, mapping);
  if (headerIndex === -1) {
    result.fileError = "No header row found in the file.";
    return result;
  }
  const headerCells = rows[headerIndex].cells.map(norm);
  const col: Partial<Record<FieldKey, number>> = {};
  for (const [field, header] of Object.entries(mapping) as [FieldKey, string | undefined][]) {
    if (header) col[field] = headerCells.indexOf(norm(header));
  }
  const missing = (Object.keys(col) as FieldKey[]).filter((f) => col[f] === -1).map((f) => `"${mapping[f]}"`);
  if (missing.length) {
    result.fileError = `The file has no column ${missing.join(", ")}. Check the mapping for this file.`;
    return result;
  }
  const cell = (cells: string[], f: FieldKey) => {
    const i = col[f];
    return i === undefined || i === -1 ? "" : (cells[i] ?? "").trim();
  };
  const optText = (cells: string[], f: FieldKey) => cell(cells, f) || null;

  const refs = new Set<string>();
  const dates: string[] = [];
  let fileNet = 0;

  for (const { row, cells } of rows.slice(headerIndex + 1)) {
    if (isBlank(cells)) continue;
    const raw = cells.join(",");
    const fail = (reason: string) => result.errors.push({ row, raw, reason });

    let txnDate: string | null = null;
    if (col.txn_date !== undefined && cell(cells, "txn_date")) {
      txnDate = parseStatementDate(cell(cells, "txn_date"));
      if (!txnDate) {
        fail(`Unreadable date "${cell(cells, "txn_date")}"`);
        continue;
      }
    }

    const amounts: [AmountField, number][] = [];
    let bad: string | null = null;
    for (const f of amountFields) {
      const v = parseMoneyPaise(cell(cells, f));
      if (v !== null && Number.isNaN(v)) {
        bad = `Unreadable ${FIELDS.find((x) => x.key === f)!.label.toLowerCase()} "${cell(cells, f)}"`;
        break;
      }
      if (v) amounts.push([f, f !== "gross_sales" && map.deductions_negative ? -v : v]);
    }
    let net: number | null = null;
    if (!bad && mapping.net_payout) {
      net = parseMoneyPaise(cell(cells, "net_payout"));
      if (net !== null && Number.isNaN(net)) bad = `Unreadable net payout "${cell(cells, "net_payout")}"`;
    }
    if (bad) {
      fail(bad);
      continue;
    }
    if (amounts.length === 0 && !net) {
      fail("No amount in the mapped columns");
      continue;
    }

    fileNet += net ?? 0;
    const ref = cell(cells, "settlement_ref");
    if (ref) refs.add(ref);
    if (txnDate) dates.push(txnDate);
    for (const [line_type, amountPaise] of amounts) {
      result.totals[line_type] += amountPaise;
      result.lines.push({
        row,
        txn_date: txnDate,
        order_id: optText(cells, "order_id"),
        sku: optText(cells, "sku"),
        description: optText(cells, "description"),
        line_type,
        amountPaise,
      });
    }
  }

  result.computedNetPaise = netFrom(result.totals);
  result.fileNetPaise = mapping.net_payout ? fileNet : null;
  result.refs = [...refs];
  dates.sort();
  result.periodFrom = dates[0] ?? null;
  result.periodTo = dates[dates.length - 1] ?? null;
  return result;
}

export interface SettlementMeta {
  channel: string;
  settlement_ref: string;
  period_from: string;
  period_to: string;
  fee_gst_split: "igst" | "cgst_sgst";
  source_filename: string | null;
}

const rupees = (p: number) => p / 100;

/** Problems that would stop the save; empty when the settlement can be saved. */
export function saveBlockers(parsed: ParsedSettlement, meta: SettlementMeta): string[] {
  const out: string[] = [];
  if (parsed.fileError) out.push(parsed.fileError);
  if (parsed.lines.length === 0) out.push("No lines to save.");
  if (parsed.refs.length > 1) out.push(`The file holds ${parsed.refs.length} settlement IDs; upload one settlement at a time.`);
  if (!meta.settlement_ref.trim()) out.push("Enter the settlement ID.");
  if (!meta.period_from || !meta.period_to) out.push("Enter the settlement period.");
  else if (meta.period_from > meta.period_to) out.push("The period starts after it ends.");
  if (parsed.fileNetPaise !== null && parsed.fileNetPaise !== parsed.computedNetPaise)
    out.push("The file's net payout does not equal sales less deductions; check the mapping and the rows with errors.");
  return out;
}

/** Body for POST /marketplace/settlements (rupees, as the database stores them). */
export function settlementPayload(parsed: ParsedSettlement, meta: SettlementMeta) {
  const t = parsed.totals;
  return {
    settlement: {
      ...meta,
      settlement_ref: meta.settlement_ref.trim(),
      ...Object.fromEntries(AMOUNT_FIELDS.map((f) => [f, rupees(t[f])])),
      net_payout: rupees(parsed.computedNetPaise),
    },
    lines: parsed.lines.map((l) => ({
      row_number: l.row,
      txn_date: l.txn_date,
      order_id: l.order_id,
      sku: l.sku,
      description: l.description,
      line_type: l.line_type,
      amount: rupees(l.amountPaise),
    })),
  };
}
