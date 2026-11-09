/**
 * Tally ERP 9 / TallyPrime XML export reader (runs in the browser; the file never leaves the device).
 * Reads ENVELOPE/BODY/IMPORTDATA/REQUESTDATA/TALLYMESSAGE with GROUP, LEDGER, STOCKITEM and VOUCHER.
 * Built from Tally's documented export shape, not from a real company's file: details marked
 * "verify against a real Tally export" are our best understanding.
 */
import { parseMoneyPaise } from "@/lib/bank/statement-parser";
import { emptyBatch, GroupTarget, ImportBatch, LineRef, RowError } from "./validate";

export interface TallyLedger {
  row: number;
  name: string;
  parent: string;
  /** Deku sign: positive = debit balance. */
  openingPaise: number;
  gstin?: string;
  gstRegistrationType?: string;
  state?: string;
  pan?: string;
}
export interface TallyStockItem {
  row: number;
  name: string;
  baseUnits?: string;
  hsn?: string;
}
export interface TallyVoucher {
  row: number;
  date: string | null;
  voucherType: string;
  number: string;
  narration: string;
  /** Deku sign: debit_paise / credit_paise, both non-negative. */
  lines: LineRef[];
}
export interface TallyFile {
  groups: { name: string; parent: string }[];
  ledgers: TallyLedger[];
  stockItems: TallyStockItem[];
  vouchers: TallyVoucher[];
  errors: RowError[];
}

const acct = (account_group: "asset" | "liability" | "equity" | "revenue" | "expense", ledger: string, sub_ledger: string): GroupTarget => ({
  kind: "account",
  account_group,
  ledger,
  sub_ledger,
});

/**
 * Tally's predefined groups -> Deku's ALERX group, ledger and sub-ledger (labels follow migration 11).
 * Suspense A/c and Branch / Divisions are deliberately absent: they need the user's choice.
 */
export const TALLY_GROUPS: Record<string, GroupTarget> = {
  "sundry debtors": { kind: "party", party_type: "customer" },
  "sundry creditors": { kind: "party", party_type: "vendor" },
  "bank accounts": acct("asset", "Cash & Liquid Capital", "Operating Bank Accounts"),
  "cash-in-hand": acct("asset", "Cash & Liquid Capital", "Cash In-Hand"),
  "bank od a/c": acct("liability", "Current Liabilities & Payables", "Bank Overdraft"),
  "bank occ a/c": acct("liability", "Current Liabilities & Payables", "Bank Overdraft"),
  "duties & taxes": acct("liability", "Statutory & Tax Liabilities", "Duties & Taxes"),
  "sales accounts": acct("revenue", "Operating Revenue / Sales", "Sales Accounts"),
  "direct incomes": acct("revenue", "Operating Revenue / Sales", "Direct Incomes"),
  "income (direct)": acct("revenue", "Operating Revenue / Sales", "Direct Incomes"),
  "indirect incomes": acct("revenue", "Other Income & Receipts", "Indirect Incomes"),
  "income (indirect)": acct("revenue", "Other Income & Receipts", "Indirect Incomes"),
  "purchase accounts": acct("expense", "Cost of Sales / Direct Delivery", "Purchase Accounts"),
  "direct expenses": acct("expense", "Cost of Sales / Direct Delivery", "Direct Expenses"),
  "expenses (direct)": acct("expense", "Cost of Sales / Direct Delivery", "Direct Expenses"),
  "indirect expenses": acct("expense", "Operating Overheads & Administration", "Indirect Expenses"),
  "expenses (indirect)": acct("expense", "Operating Overheads & Administration", "Indirect Expenses"),
  "capital account": acct("equity", "Owner / Contributed Capital", "Capital Account"),
  "reserves & surplus": acct("equity", "Reserves & Retained Earnings", "Reserves & Surplus"),
  "retained earnings": acct("equity", "Reserves & Retained Earnings", "Reserves & Surplus"),
  "fixed assets": acct("asset", "Fixed Assets", "Fixed Assets"),
  investments: acct("asset", "Investments", "Investments"),
  "current assets": acct("asset", "Current Assets & Receivables", "Current Assets"),
  "deposits (asset)": acct("asset", "Current Assets & Receivables", "Deposits"),
  "loans & advances (asset)": acct("asset", "Current Assets & Receivables", "Loans & Advances"),
  "stock-in-hand": acct("asset", "Current Assets & Receivables", "Stock-in-Hand"),
  "misc. expenses (asset)": acct("asset", "Current Assets & Receivables", "Misc. Expenses (Asset)"),
  "current liabilities": acct("liability", "Current Liabilities & Payables", "Current Liabilities"),
  provisions: acct("liability", "Current Liabilities & Payables", "Provisions"),
  "loans (liability)": acct("liability", "Loans (Liability)", "Loans"),
  "secured loans": acct("liability", "Loans (Liability)", "Secured Loans"),
  "unsecured loans": acct("liability", "Loans (Liability)", "Unsecured Loans"),
};

const gkey = (s: string) => s.trim().toLowerCase();

/**
 * The target for a group: the user's mapping on the group or its nearest ancestor, else the predefined
 * group it descends from (following PARENT through the file's GROUP masters). null = ask the user.
 */
export function resolveGroup(
  group: string,
  parents: Map<string, string>,
  userMap: Record<string, GroupTarget> = {}
): GroupTarget | null {
  const user = new Map(Object.entries(userMap).map(([k, v]) => [gkey(k), v]));
  let g = gkey(group);
  for (let depth = 0; depth < 32 && g && g !== "primary"; depth++) {
    const t = user.get(g) ?? TALLY_GROUPS[g];
    if (t) return t;
    g = gkey(parents.get(g) ?? "");
  }
  return null;
}

// Tally writes control characters as numeric references (e.g. "&#4; Primary"), which XML 1.0 rejects.
// verify against a real Tally export: other invalid references may appear.
const stripControlRefs = (xml: string) => xml.replace(/&#(x0*[0-8bcef]|x0*1[0-9a-f]|0*[0-8]|0*1[1-2]|0*1[4-9]|0*2[0-9]|0*3[01]);/gi, "");

/** Tally often exports UTF-16 LE with a BOM. verify against a real Tally export. */
export function decodeTallyBytes(buf: ArrayBuffer): string {
  const b = new Uint8Array(buf);
  if (b[0] === 0xff && b[1] === 0xfe) return new TextDecoder("utf-16le").decode(buf);
  if (b[0] === 0xfe && b[1] === 0xff) return new TextDecoder("utf-16be").decode(buf);
  return new TextDecoder("utf-8").decode(buf);
}

const child = (el: Element, tag: string) => {
  for (const c of Array.from(el.children)) if (c.tagName === tag) return c.textContent?.trim() ?? "";
  return "";
};
// The master's name is the NAME attribute, or NAME.LIST/NAME. verify against a real Tally export.
const masterName = (el: Element) =>
  el.getAttribute("NAME")?.trim() || el.getElementsByTagName("NAME.LIST")[0]?.getElementsByTagName("NAME")[0]?.textContent?.trim() || "";

/** Tally amount: "-1,180.00" (negative = debit). Returns Deku-signed paise (positive = debit), NaN when unreadable. */
export function tallyAmountPaise(raw: string): number {
  // Foreign-currency amounts look like "-100.00 USD @ ..."; only the leading number is the base amount.
  // verify against a real Tally export.
  const lead = raw.trim().match(/^-?[\d,]+(?:\.\d+)?/)?.[0] ?? "";
  if (!lead) return raw.trim() === "" ? 0 : NaN;
  const p = parseMoneyPaise(lead);
  return p === null ? 0 : -p;
}

/** DATE is yyyymmdd. */
export function tallyDate(raw: string): string | null {
  const m = raw.trim().match(/^(\d{4})(\d{2})(\d{2})$/);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

export function parseTallyXml(xml: string): TallyFile {
  const out: TallyFile = { groups: [], ledgers: [], stockItems: [], vouchers: [], errors: [] };
  const doc = new DOMParser().parseFromString(stripControlRefs(xml), "application/xml");
  if (doc.getElementsByTagName("parsererror").length) {
    out.errors.push({ row: 0, message: "The file is not well-formed XML" });
    return out;
  }
  if (doc.documentElement.tagName !== "ENVELOPE") {
    out.errors.push({ row: 0, message: "Not a Tally XML export (no ENVELOPE)" });
    return out;
  }
  // Masters sit directly under TALLYMESSAGE; nested tags with the same names are not masters.
  const messages = Array.from(doc.getElementsByTagName("TALLYMESSAGE"));
  const items = messages.flatMap((m) => Array.from(m.children));

  for (const el of items) {
    if (el.tagName === "GROUP") {
      out.groups.push({ name: masterName(el), parent: child(el, "PARENT") });
    } else if (el.tagName === "LEDGER") {
      const row = out.ledgers.length + 1;
      const name = masterName(el);
      const opening = tallyAmountPaise(child(el, "OPENINGBALANCE"));
      if (!name) out.errors.push({ row, message: `Ledger ${row} has no name` });
      else if (Number.isNaN(opening)) out.errors.push({ row, message: `Ledger "${name}": opening balance is not a number` });
      else
        out.ledgers.push({
          row,
          name,
          parent: child(el, "PARENT"),
          openingPaise: opening,
          // GST fields sit on the ledger in Tally ERP 9; TallyPrime may nest them. verify against a real Tally export.
          gstin: child(el, "PARTYGSTIN") || undefined,
          gstRegistrationType: child(el, "GSTREGISTRATIONTYPE") || undefined,
          state: child(el, "LEDSTATENAME") || child(el, "STATENAME") || undefined,
          pan: child(el, "INCOMETAXNUMBER") || undefined,
        });
    } else if (el.tagName === "STOCKITEM") {
      // HSN may be direct or under GSTDETAILS.LIST. verify against a real Tally export.
      const hsn = el.getElementsByTagName("HSNCODE")[0]?.textContent?.trim() || child(el, "HSN") || undefined;
      out.stockItems.push({ row: out.stockItems.length + 1, name: masterName(el), baseUnits: child(el, "BASEUNITS") || undefined, hsn });
    } else if (el.tagName === "VOUCHER") {
      const row = out.vouchers.length + 1;
      const lines: LineRef[] = [];
      const entries = (tag: string) => Array.from(el.getElementsByTagName(tag)).filter((e) => child(e, "LEDGERNAME"));
      // Voucher mode lists every ledger in ALLLEDGERENTRIES.LIST. Invoice mode uses LEDGERENTRIES.LIST and
      // carries the sales/purchase ledger in inventory entries' ACCOUNTINGALLOCATIONS.LIST. Never both,
      // since doubled entries would still balance. verify against a real Tally export.
      const all = entries("ALLLEDGERENTRIES.LIST");
      const used = all.length ? all : [...entries("LEDGERENTRIES.LIST"), ...entries("ACCOUNTINGALLOCATIONS.LIST")];
      for (const e of used) {
        const ledger = child(e, "LEDGERNAME");
        const amt = tallyAmountPaise(child(e, "AMOUNT"));
        if (amt === 0) continue;
        if (Number.isNaN(amt)) {
          out.errors.push({ kind: "vouchers", row, message: `Voucher ${row}: amount for ${ledger} is not a number` });
          continue;
        }
        lines.push({ ledger, debit_paise: Math.max(amt, 0), credit_paise: Math.max(-amt, 0) });
      }
      const voucherType = child(el, "VOUCHERTYPENAME") || el.getAttribute("VCHTYPE") || "Journal";
      out.vouchers.push({
        row,
        date: tallyDate(child(el, "DATE")),
        voucherType,
        number: child(el, "VOUCHERNUMBER"),
        narration: child(el, "NARRATION"),
        lines,
      });
    }
  }
  return out;
}

/** Ledger groups that no predefined group or user mapping covers. */
export function unmappedGroups(file: TallyFile, userMap: Record<string, GroupTarget>): string[] {
  const parents = new Map(file.groups.map((g) => [gkey(g.name), g.parent]));
  const out = new Set<string>();
  for (const l of file.ledgers) if (!resolveGroup(l.parent, parents, userMap)) out.add(l.parent || "(no group)");
  return [...out];
}

// Tally unit symbols -> GST UQC; anything else is OTH (others). verify against a real Tally export.
const UQC: Record<string, string> = {
  nos: "NOS", no: "NOS", pcs: "PCS", pc: "PCS", kg: "KGS", kgs: "KGS", g: "GMS", gm: "GMS", gms: "GMS",
  ltr: "LTR", l: "LTR", mtr: "MTR", m: "MTR", box: "BOX", set: "SET", pair: "PRS", doz: "DOZ", bag: "BAG",
};

/** Turns a parsed file into import rows. Ledgers whose group is unmapped or skipped are left out. */
export function tallyToBatch(file: TallyFile, filename: string, userMap: Record<string, GroupTarget>): ImportBatch {
  const batch = emptyBatch("tally_xml", filename);
  batch.errors.push(...file.errors);
  const parents = new Map(file.groups.map((g) => [gkey(g.name), g.parent]));
  for (const l of file.ledgers) {
    const t = resolveGroup(l.parent, parents, userMap);
    if (!t || t.kind === "skip") continue;
    if (t.kind === "party") {
      batch.parties.push({ row: l.row, name: l.name, type: t.party_type, gstin: l.gstin, pan: l.pan, state: l.state });
    } else {
      batch.accounts.push({ row: l.row, name: l.name, account_group: t.account_group, ledger: t.ledger, sub_ledger: t.sub_ledger });
    }
    if (l.openingPaise !== 0) {
      batch.openings.push({ row: l.row, ledger: l.name, debit_paise: Math.max(l.openingPaise, 0), credit_paise: Math.max(-l.openingPaise, 0) });
    }
  }
  batch.items = file.stockItems.map((s) => ({
    row: s.row,
    name: s.name,
    type: "goods" as const,
    hsn_sac_code: s.hsn,
    unit_code: UQC[gkey(s.baseUnits ?? "")] ?? "OTH",
  }));
  batch.vouchers = file.vouchers.map((v) => ({
    row: v.row,
    date: v.date,
    number: v.number,
    voucher_type: v.voucherType,
    narration: v.narration,
    lines: v.lines,
  }));
  return batch;
}
