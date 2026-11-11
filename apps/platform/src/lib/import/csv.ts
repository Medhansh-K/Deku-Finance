/**
 * Spreadsheet (CSV) import: the user maps the file's columns to Deku's fields once per file, like the
 * marketplace import. Runs in the browser; the file never leaves the device.
 */
import { parseMoneyPaise, parseStatementDate } from "@/lib/bank/statement-parser";
import { readHeader } from "@/lib/marketplace/parsers";
import { TALLY_GROUPS } from "./tally";
import { AlerxGroup, emptyBatch, GroupTarget, ImportBatch, ImportKind, LineRef } from "./validate";

interface Field {
  key: string;
  label: string;
  required?: boolean;
  aliases: string[];
}

const LEDGER_FIELDS: Field[] = [
  { key: "ledger", label: "Account (name or code)", required: true, aliases: ["account", "ledger", "ledger name", "account name", "particulars"] },
  { key: "party", label: "Party", aliases: ["party", "party name", "customer", "vendor"] },
  { key: "debit", label: "Debit", aliases: ["debit", "dr", "debit amount"] },
  { key: "credit", label: "Credit", aliases: ["credit", "cr", "credit amount"] },
  { key: "amount", label: "Amount (positive = debit, or 500 Dr / 500 Cr)", aliases: ["amount", "balance", "opening balance"] },
];

export const CSV_FIELDS: Record<ImportKind, Field[]> = {
  chart_of_accounts: [
    { key: "code", label: "Code", aliases: ["code", "account code"] },
    { key: "name", label: "Account name", required: true, aliases: ["name", "account", "account name", "ledger", "ledger name"] },
    { key: "group", label: "Group (Asset, Liability, ... or a Tally group)", required: true, aliases: ["group", "type", "account group", "under", "parent"] },
    { key: "ledger", label: "Ledger", aliases: ["ledger group"] },
    { key: "sub_ledger", label: "Sub-ledger", aliases: ["sub ledger", "sub-ledger", "subledger"] },
  ],
  parties: [
    { key: "name", label: "Name", required: true, aliases: ["name", "party", "party name", "legal name", "customer", "vendor"] },
    { key: "type", label: "Type (customer / vendor / both)", aliases: ["type", "party type"] },
    { key: "gstin", label: "GSTIN", aliases: ["gstin", "gst no", "gst number", "gstin/uin"] },
    { key: "pan", label: "PAN", aliases: ["pan", "pan no"] },
    { key: "email", label: "Email", aliases: ["email", "e-mail"] },
    { key: "phone", label: "Phone", aliases: ["phone", "mobile", "contact"] },
    { key: "state", label: "State", aliases: ["state", "state name"] },
  ],
  items: [
    { key: "name", label: "Item name", required: true, aliases: ["name", "item", "item name", "product"] },
    { key: "type", label: "Type (goods / services)", aliases: ["type", "item type"] },
    { key: "sku", label: "SKU", aliases: ["sku", "item code", "code"] },
    { key: "hsn", label: "HSN/SAC", aliases: ["hsn", "sac", "hsn/sac", "hsn code"] },
    { key: "unit", label: "Unit (UQC)", aliases: ["unit", "uom", "uqc", "units"] },
    { key: "gst_rate", label: "GST rate %", aliases: ["gst rate", "gst", "tax rate", "gst %"] },
    { key: "price", label: "Price", aliases: ["price", "rate", "selling price", "unit price"] },
  ],
  opening_balances: LEDGER_FIELDS,
  vouchers: [
    { key: "date", label: "Date", required: true, aliases: ["date", "voucher date"] },
    { key: "number", label: "Voucher number", aliases: ["number", "voucher no", "voucher number", "vch no", "vch no."] },
    { key: "voucher_type", label: "Voucher type", aliases: ["type", "voucher type", "vch type"] },
    { key: "narration", label: "Narration", aliases: ["narration", "description", "remarks"] },
    ...LEDGER_FIELDS,
  ],
};

/** Field key -> header text in the file. */
export type CsvMapping = Record<string, string | undefined>;

const norm = (s: string) => s.trim().toLowerCase();

/** Pre-fills the mapping where a header matches a field's name. */
export function suggestMapping(kind: ImportKind, headers: string[]): CsvMapping {
  const out: CsvMapping = {};
  const used = new Set<string>();
  for (const f of CSV_FIELDS[kind]) {
    const h = headers.find((x) => !used.has(x) && f.aliases.includes(norm(x)));
    if (h) {
      out[f.key] = h;
      used.add(h);
    }
  }
  return out;
}

export const csvHeaders = (text: string) => readHeader(text).headers;

const ALERX_WORDS: Record<string, AlerxGroup> = {
  asset: "asset", assets: "asset", liability: "liability", liabilities: "liability", equity: "equity",
  capital: "equity", revenue: "revenue", income: "revenue", incomes: "revenue", expense: "expense", expenses: "expense",
};

/** A group cell: an ALERX word, a Tally group, or the user's mapping for that value. null = ask the user. */
export function csvGroup(value: string, userMap: Record<string, GroupTarget>): GroupTarget | null {
  const v = norm(value);
  const user = Object.entries(userMap).find(([k]) => norm(k) === v)?.[1];
  if (user) return user;
  const w = ALERX_WORDS[v];
  if (w) return { kind: "account", account_group: w, ledger: "", sub_ledger: "" };
  return TALLY_GROUPS[v] ?? null;
}

/** Debit/credit columns, or one amount column (positive or "Dr" = debit, negative or "Cr" = credit). */
export function csvLineAmount(debit: string, credit: string, amount: string): { debit_paise: number; credit_paise: number } | string {
  const d = parseMoneyPaise(debit);
  const c = parseMoneyPaise(credit);
  if (d !== null || c !== null) {
    if (Number.isNaN(d) || Number.isNaN(c)) return "Debit or credit is not a number";
    return { debit_paise: Math.abs(d ?? 0), credit_paise: Math.abs(c ?? 0) };
  }
  const a = parseMoneyPaise(amount);
  if (a === null) return { debit_paise: 0, credit_paise: 0 };
  if (Number.isNaN(a)) return "Amount is not a number";
  // parseMoneyPaise makes "Dr" negative (bank-statement convention); here Dr means debit.
  const suffix = amount.trim().match(/(dr|cr)$/i)?.[1].toLowerCase();
  const isDebit = suffix ? suffix === "dr" : a > 0;
  return isDebit ? { debit_paise: Math.abs(a), credit_paise: 0 } : { debit_paise: 0, credit_paise: Math.abs(a) };
}

/** Group values in a chart-of-accounts CSV that need the user's mapping. */
export function csvUnmappedGroups(text: string, mapping: CsvMapping, userMap: Record<string, GroupTarget>): string[] {
  const { rows, headerIndex } = readHeader(text, mapping as Record<string, string>);
  const col = headerIndex === -1 || !mapping.group ? -1 : rows[headerIndex].cells.map((c) => c.trim()).indexOf(mapping.group);
  if (col === -1) return [];
  const out = new Set<string>();
  for (const r of rows.slice(headerIndex + 1)) {
    const v = r.cells[col]?.trim();
    if (v && !csvGroup(v, userMap)) out.add(v);
  }
  return [...out];
}

export function parseCsv(
  text: string,
  filename: string,
  kind: ImportKind,
  mapping: CsvMapping,
  userMap: Record<string, GroupTarget> = {}
): ImportBatch {
  const batch = emptyBatch("csv", filename);
  const { rows, headerIndex } = readHeader(text, mapping as Record<string, string>);
  const missing = CSV_FIELDS[kind].filter((f) => f.required && !mapping[f.key]);
  if (headerIndex === -1 || missing.length) {
    batch.errors.push({ kind, row: 0, message: missing.length ? `Map the column for: ${missing.map((f) => f.label).join(", ")}` : "No header row found" });
    return batch;
  }
  const header = rows[headerIndex].cells.map((c) => c.trim());
  const idx = Object.fromEntries(Object.entries(mapping).map(([k, h]) => [k, h ? header.indexOf(h) : -1]));
  const err = (row: number, message: string) => batch.errors.push({ kind, row, message });

  let current: (typeof batch.vouchers)[number] | null = null;
  for (const r of rows.slice(headerIndex + 1)) {
    if (r.cells.every((c) => c.trim() === "")) continue;
    const get = (k: string) => (idx[k] !== undefined && idx[k] >= 0 ? (r.cells[idx[k]] ?? "").trim() : "");
    const row = r.row;

    if (kind === "chart_of_accounts") {
      const t = csvGroup(get("group"), userMap);
      if (!t) err(row, `Group "${get("group")}" needs mapping`);
      else if (t.kind === "party") err(row, `"${get("group")}" is a party group; import these rows as parties`);
      else if (t.kind === "account")
        batch.accounts.push({
          row,
          code: get("code") || undefined,
          name: get("name"),
          account_group: t.account_group,
          ledger: get("ledger") || t.ledger || undefined,
          sub_ledger: get("sub_ledger") || t.sub_ledger || undefined,
        });
    } else if (kind === "parties") {
      const type = norm(get("type") || "customer");
      const mapped = ({ customer: "customer", debtor: "customer", vendor: "vendor", supplier: "vendor", creditor: "vendor", both: "both", other: "other" } as const)[type as "customer"];
      if (!mapped) err(row, `Party type "${get("type")}" should be customer, vendor or both`);
      else
        batch.parties.push({
          row,
          name: get("name"),
          type: mapped,
          gstin: get("gstin") || undefined,
          pan: get("pan").toUpperCase() || undefined,
          email: get("email") || undefined,
          phone: get("phone") || undefined,
          state: get("state") || undefined,
        });
    } else if (kind === "items") {
      const type = norm(get("type") || "goods");
      const rate = get("gst_rate").replace("%", "");
      const price = parseMoneyPaise(get("price"));
      if (type !== "goods" && type !== "services" && type !== "service") err(row, `Item type "${get("type")}" should be goods or services`);
      else if (Number.isNaN(price) || (price ?? 0) < 0) err(row, "Price is not a number");
      else if (rate && !Number.isFinite(Number(rate))) err(row, "GST rate is not a number");
      else
        batch.items.push({
          row,
          name: get("name"),
          type: type === "goods" ? "goods" : "services",
          sku: get("sku") || undefined,
          hsn_sac_code: get("hsn") || undefined,
          unit_code: get("unit").toUpperCase() || undefined,
          gst_rate: rate ? Number(rate) : undefined,
          price_paise: price ?? undefined,
        });
    } else {
      const amt = csvLineAmount(get("debit"), get("credit"), get("amount"));
      if (typeof amt === "string") {
        err(row, amt);
        continue;
      }
      const line: LineRef = { ledger: get("ledger"), party: get("party") || undefined, ...amt };
      if (!line.ledger) {
        err(row, "Account is empty");
        continue;
      }
      if (kind === "opening_balances") {
        if (amt.debit_paise || amt.credit_paise) batch.openings.push({ row, ...line });
        continue;
      }
      // A row with a date or number different from the current voucher starts a new one;
      // rows with both blank continue it (the usual "one line per row" day-book layout).
      const date = get("date");
      const number = get("number");
      const type = get("voucher_type");
      const startsNew =
        !current ||
        ((date || number) &&
          (number !== current.number || (date && parseStatementDate(date) !== current.date) || (type && type !== current.voucher_type)));
      if (startsNew) {
        if (!date) err(row, "Date is missing");
        current = { row, date: date ? parseStatementDate(date) : null, number, voucher_type: type || "Journal", narration: get("narration"), lines: [] };
        batch.vouchers.push(current);
      }
      current!.lines.push(line);
    }
  }
  return batch;
}
