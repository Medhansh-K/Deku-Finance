/**
 * Import rows shared by the Tally and CSV readers, and the checks run before anything is sent.
 * Runs in the browser; apply_import_job (migration 43) re-checks every rule on the server.
 * Money is in paise.
 */
import { isValidGstin } from "@/lib/vouchers/invoice-text-parser";

export type ImportKind = "chart_of_accounts" | "parties" | "items" | "opening_balances" | "vouchers";
export const IMPORT_ORDER: ImportKind[] = ["chart_of_accounts", "parties", "items", "opening_balances", "vouchers"];
export const KIND_LABELS: Record<ImportKind, string> = {
  chart_of_accounts: "Chart of accounts",
  parties: "Parties",
  items: "Items",
  opening_balances: "Opening balances",
  vouchers: "Vouchers",
};

export type AlerxGroup = "asset" | "liability" | "equity" | "revenue" | "expense";
export const ALERX_GROUPS: AlerxGroup[] = ["asset", "liability", "equity", "revenue", "expense"];

/** Where a ledger group lands in Deku: an account under an ALERX group, or a party (control account + party). */
export type GroupTarget =
  | { kind: "account"; account_group: AlerxGroup; ledger: string; sub_ledger: string }
  | { kind: "party"; party_type: "customer" | "vendor" }
  | { kind: "skip" };

export interface RowError {
  kind?: ImportKind;
  row: number;
  message: string;
}

export interface AccountRow {
  row: number;
  code?: string;
  name: string;
  account_group: AlerxGroup;
  ledger?: string;
  sub_ledger?: string;
}
export interface PartyRow {
  row: number;
  name: string;
  type: "customer" | "vendor" | "both" | "other";
  gstin?: string;
  pan?: string;
  email?: string;
  phone?: string;
  state?: string;
}
export interface ItemRow {
  row: number;
  name: string;
  type: "goods" | "services";
  sku?: string;
  hsn_sac_code?: string;
  unit_code?: string;
  gst_rate?: number;
  price_paise?: number;
}
/** A ledger as written in the file (name or code), resolved to an account and party during validation. */
export interface LineRef {
  ledger: string;
  party?: string;
  debit_paise: number;
  credit_paise: number;
}
export interface OpeningRow extends LineRef {
  row: number;
}
export interface VoucherRow {
  row: number;
  date: string | null;
  number: string;
  voucher_type: string;
  narration: string;
  lines: LineRef[];
}

export interface ImportBatch {
  source: "tally_xml" | "csv";
  filename: string;
  accounts: AccountRow[];
  parties: PartyRow[];
  items: ItemRow[];
  openings: OpeningRow[];
  vouchers: VoucherRow[];
  /** Rows the reader could not turn into import rows at all. */
  errors: RowError[];
}

export const emptyBatch = (source: ImportBatch["source"], filename: string): ImportBatch => ({
  source,
  filename,
  accounts: [],
  parties: [],
  items: [],
  openings: [],
  vouchers: [],
  errors: [],
});

/** What already exists in the company, fetched from the API. */
export interface Masters {
  accounts: { code: string; name: string; is_postable?: boolean; is_active?: boolean }[];
  parties: { legal_name: string; type: string; gstin?: string | null }[];
  items: { name: string; sku?: string | null }[];
}

export interface ValidationResult {
  errors: RowError[];
  /** Rows exactly as apply_import_job takes them, per kind. */
  payload: Partial<Record<ImportKind, unknown[]>>;
  /** Opening debits minus credits; non-zero needs the user's confirmation. */
  openingDiffPaise: number;
}

// Default chart control accounts (migration 5) that carry party balances.
export const DEBTORS_CODE = "1030";
export const CREDITORS_CODE = "2010";

const key = (s: string) => s.trim().toLowerCase();
const PAN = /^[A-Z]{5}\d{4}[A-Z]$/;

type Resolved = { account_code?: string; account_name?: string; party_name?: string };

function resolver(batch: ImportBatch, masters: Masters, selected: Set<ImportKind>) {
  const partyType = new Map<string, string>();
  for (const p of masters.parties) partyType.set(key(p.legal_name), p.type);
  if (selected.has("parties")) for (const p of batch.parties) partyType.set(key(p.name), p.type);
  const byCode = new Map(masters.accounts.filter((a) => a.is_active !== false).map((a) => [a.code.trim(), a]));
  const byName = new Map<string, typeof masters.accounts>();
  for (const a of masters.accounts) {
    if (a.is_active === false) continue;
    byName.set(key(a.name), [...(byName.get(key(a.name)) ?? []), a]);
  }
  const newAccounts = new Set(selected.has("chart_of_accounts") ? batch.accounts.map((a) => key(a.name)) : []);
  const hasControl = (code: string) => byCode.get(code)?.is_postable !== false && byCode.has(code);

  return (ledger: string, party?: string): Resolved | string => {
    const name = ledger.trim();
    // A Tally party ledger is a party on Deku's debtors/creditors control account.
    const asParty = party ? undefined : partyType.get(key(name));
    const partyName = party?.trim() || (asParty ? name : undefined);
    if (asParty) {
      const code = asParty === "vendor" ? CREDITORS_CODE : DEBTORS_CODE;
      return hasControl(code) ? { account_code: code, party_name: name } : `Control account ${code} is missing from the chart of accounts`;
    }
    if (partyName && !partyType.has(key(partyName))) return `Party "${partyName}" is not in Deku or this import`;
    const hit = byCode.get(name);
    if (hit) return hit.is_postable === false ? `Account ${name} is a group, not a postable ledger` : { account_code: hit.code, party_name: partyName };
    const named = byName.get(key(name)) ?? [];
    if (named.length > 1) return `More than one account is named "${name}"; use its code`;
    if (named.length === 1) {
      return named[0].is_postable === false
        ? `Account "${name}" is a group, not a postable ledger`
        : { account_code: named[0].code, party_name: partyName };
    }
    if (newAccounts.has(key(name))) return { account_name: name, party_name: partyName };
    return `Ledger "${name}" is not in the chart of accounts or this import`;
  };
}

function lineErrors(lines: LineRef[]) {
  const errs: string[] = [];
  let dr = 0;
  let cr = 0;
  lines.forEach((l, i) => {
    if (l.debit_paise < 0 || l.credit_paise < 0 || (l.debit_paise > 0) === (l.credit_paise > 0)) {
      errs.push(`line ${i + 1} (${l.ledger}) needs either a debit or a credit`);
    }
    dr += l.debit_paise;
    cr += l.credit_paise;
  });
  return { errs, dr, cr };
}

/** Every rule from the brief, with the row each error belongs to. Only selected kinds are checked and sent. */
export function validateBatch(
  batch: ImportBatch,
  masters: Masters,
  selected: Set<ImportKind>,
  confirmOpeningDifference = false
): ValidationResult {
  const errors: RowError[] = batch.errors.filter((e) => !e.kind || selected.has(e.kind));
  const payload: ValidationResult["payload"] = {};
  const resolve = resolver(batch, masters, selected);
  const err = (kind: ImportKind, row: number, message: string) => errors.push({ kind, row, message });

  if (selected.has("chart_of_accounts")) {
    const names = new Set(masters.accounts.map((a) => key(a.name)));
    const codes = new Set(masters.accounts.map((a) => a.code.trim()));
    const seenNames = new Set<string>();
    const seenCodes = new Set<string>();
    for (const a of batch.accounts) {
      if (!a.name.trim()) err("chart_of_accounts", a.row, "Account name is empty");
      else if (names.has(key(a.name))) err("chart_of_accounts", a.row, `An account named "${a.name}" already exists in Deku`);
      else if (seenNames.has(key(a.name))) err("chart_of_accounts", a.row, `"${a.name}" appears more than once in the file`);
      seenNames.add(key(a.name));
      if (!ALERX_GROUPS.includes(a.account_group)) err("chart_of_accounts", a.row, `Unknown account group "${a.account_group}"`);
      const code = a.code?.trim();
      if (code) {
        if (codes.has(code)) err("chart_of_accounts", a.row, `Account code ${code} already exists in Deku`);
        else if (seenCodes.has(code)) err("chart_of_accounts", a.row, `Code ${code} appears more than once in the file`);
        seenCodes.add(code);
      }
    }
    payload.chart_of_accounts = batch.accounts;
  }

  if (selected.has("parties")) {
    const names = new Set(masters.parties.map((p) => key(p.legal_name)));
    const gstins = new Set(masters.parties.map((p) => p.gstin?.toUpperCase()).filter(Boolean));
    const seen = new Set<string>();
    const seenGstin = new Set<string>();
    for (const p of batch.parties) {
      if (!p.name.trim()) err("parties", p.row, "Party name is empty");
      else if (names.has(key(p.name))) err("parties", p.row, `A party named "${p.name}" already exists in Deku`);
      else if (seen.has(key(p.name))) err("parties", p.row, `"${p.name}" appears more than once in the file`);
      seen.add(key(p.name));
      const g = p.gstin?.trim().toUpperCase();
      if (g) {
        if (!isValidGstin(g)) err("parties", p.row, `GSTIN ${g} is not valid (format or check digit)`);
        else if (gstins.has(g)) err("parties", p.row, `A party with GSTIN ${g} already exists in Deku`);
        else if (seenGstin.has(g)) err("parties", p.row, `GSTIN ${g} appears more than once in the file`);
        seenGstin.add(g);
      }
      if (p.pan && !PAN.test(p.pan.trim().toUpperCase())) err("parties", p.row, `PAN ${p.pan} is not valid`);
    }
    payload.parties = batch.parties.map((p) => ({ ...p, gstin: p.gstin?.trim().toUpperCase() || undefined }));
  }

  if (selected.has("items")) {
    const names = new Set(masters.items.map((i) => key(i.name)));
    const skus = new Set(masters.items.map((i) => i.sku?.trim()).filter(Boolean));
    const seen = new Set<string>();
    const seenSku = new Set<string>();
    for (const it of batch.items) {
      if (!it.name.trim()) err("items", it.row, "Item name is empty");
      else if (names.has(key(it.name))) err("items", it.row, `An item named "${it.name}" already exists in Deku`);
      else if (seen.has(key(it.name))) err("items", it.row, `"${it.name}" appears more than once in the file`);
      seen.add(key(it.name));
      const sku = it.sku?.trim();
      if (sku) {
        if (skus.has(sku)) err("items", it.row, `SKU ${sku} already exists in Deku`);
        else if (seenSku.has(sku)) err("items", it.row, `SKU ${sku} appears more than once in the file`);
        seenSku.add(sku);
      }
      if (it.hsn_sac_code && !/^\d{4,8}$/.test(it.hsn_sac_code)) err("items", it.row, `HSN/SAC ${it.hsn_sac_code} should be 4 to 8 digits`);
      if (it.gst_rate !== undefined && !(it.gst_rate >= 0 && it.gst_rate <= 100)) err("items", it.row, `GST rate ${it.gst_rate} is out of range`);
    }
    payload.items = batch.items;
  }

  let openingDiffPaise = 0;
  if (selected.has("opening_balances")) {
    const rows: unknown[] = [];
    for (const o of batch.openings) {
      if (lineErrors([o]).errs.length) err("opening_balances", o.row, `${o.ledger}: give either a debit or a credit balance`);
      const r = resolve(o.ledger, o.party);
      if (typeof r === "string") err("opening_balances", o.row, r);
      else rows.push({ row: o.row, ...r, debit_paise: o.debit_paise, credit_paise: o.credit_paise });
      openingDiffPaise += o.debit_paise - o.credit_paise;
    }
    if (batch.openings.length > 0 && openingDiffPaise !== 0 && !confirmOpeningDifference) {
      err(
        "opening_balances",
        0,
        `Opening debits and credits differ by ${(Math.abs(openingDiffPaise) / 100).toFixed(2)}; confirm to post the difference to "Opening Balance Difference"`
      );
    }
    payload.opening_balances = rows;
  }

  if (selected.has("vouchers")) {
    const seen = new Set<string>();
    const rows: unknown[] = [];
    for (const v of batch.vouchers) {
      if (!v.date) err("vouchers", v.row, "Voucher date is missing or not a date");
      if (v.number) {
        const id = `${key(v.voucher_type)}/${key(v.number)}`;
        if (seen.has(id)) err("vouchers", v.row, `${v.voucher_type} ${v.number} appears more than once in the file`);
        seen.add(id);
      }
      if (v.lines.length < 2) err("vouchers", v.row, "A voucher needs at least two lines");
      const { errs, dr, cr } = lineErrors(v.lines);
      errs.forEach((e) => err("vouchers", v.row, e));
      if (dr !== cr || dr === 0) {
        err("vouchers", v.row, `Voucher ${v.number || ""} does not balance: debits ${(dr / 100).toFixed(2)} vs credits ${(cr / 100).toFixed(2)}`);
      }
      const lines: Resolved[] = [];
      for (const l of v.lines) {
        const r = resolve(l.ledger, l.party);
        if (typeof r === "string") err("vouchers", v.row, r);
        else lines.push({ ...r, debit_paise: l.debit_paise, credit_paise: l.credit_paise } as Resolved);
      }
      rows.push({ row: v.row, date: v.date, number: v.number, voucher_type: v.voucher_type, narration: v.narration, lines });
    }
    payload.vouchers = rows;
  }

  return { errors, payload, openingDiffPaise };
}
