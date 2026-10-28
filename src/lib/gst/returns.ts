/**
 * GSTR-1 and GSTR-3B JSON built from the company's own books. Pure functions, no I/O.
 * Rule: never invent a value. Anything missing or inconsistent becomes an error and `json` is null.
 *
 * Field names follow the GSTN offline-tool JSON:
 * - GSTR-1: returns offline tool schema with Table 12 split into hsn_b2b / hsn_b2c (Phase-III,
 *   periods from April 2025). The tool's own "version"/"hash" stamps are not emitted.
 * - GSTR-3B: returns offline utility schema (sup_details, inter_sup, itc_elg).
 * Amounts are summed in paise (integers) and converted to rupees only when the JSON is written.
 */
import type { Account, JournalEntry, SalesInvoice, SalesInvoiceLine } from "@/types/accounting";
import { isValidGstin } from "@/lib/vouchers/invoice-text-parser";
import { billToDraft, itcTotals, validateBill, type PurchaseBill } from "@/lib/purchases/bills";

/** A sales invoice as stored (migration 007): header tax columns plus its lines. */
export type ReturnInvoice = Omit<SalesInvoice, "supply_type"> & {
  supply_type: "intra_state" | "inter_state" | "export" | "exempt";
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  cess_amount: number;
  sales_invoice_lines?: SalesInvoiceLine[];
};

export interface Gstr1Input {
  gstin: string | null | undefined;
  retPeriod: string; // MMYYYY
  invoices: ReturnInvoice[];
}

export interface Gstr3bInput extends Gstr1Input {
  accounts: Account[];
  journals: JournalEntry[];
  /** The purchase register; when it has bills for the period, Table 4 comes from them. */
  purchaseBills?: PurchaseBill[];
}

export interface Amounts {
  txval: number;
  iamt: number;
  camt: number;
  samt: number;
  csamt: number;
}

/** One summary line in rupees; `amounts` null means "not computed". */
export interface SummaryRow {
  section: string;
  amounts: Amounts | null;
}

export interface ReturnResult {
  json: Record<string, unknown> | null;
  errors: string[];
  summary: SummaryRow[];
}

export const GSTR1_NOT_COVERED = [
  "B2CL (inter-state invoices above ₹1 lakh to unregistered buyers): such invoices block the export",
  "Exports (Table 6A): export invoices block the export",
  "Credit/debit notes (CDNR/CDNUR), amendments, advances (11A/11B), e-commerce supplies",
  "SEZ and deemed exports: every B2B invoice is reported as Regular (inv_typ R)",
  "Table 8: invoices marked exempt are reported as exempt, not nil-rated or non-GST",
];

export const GSTR3B_NOT_COVERED = [
  "3.1(d) inward supplies on reverse charge and 3.1(e) non-GST outward supplies",
  "3.2 supplies to composition taxpayers and UIN holders (only unregistered persons are filled)",
  "Table 4: with purchase bills, eligible ITC is 4(A)(5) and blocked ITC 4(D); without them, Input GST ledger debits are reported as 4(A)(5). Imports, RCM, ISD and 4(B) reversals are not split out, and nothing is matched against GSTR-2B",
  "Table 5 (inward exempt supplies), 6.1 tax payment, interest and late fee",
];

const ZERO = (): Amounts => ({ txval: 0, iamt: 0, camt: 0, samt: 0, csamt: 0 });
const paise = (v: number | string | null | undefined) => Math.round(Number(v ?? 0) * 100);
const rupees = (a: Amounts): Amounts => ({
  txval: a.txval / 100,
  iamt: a.iamt / 100,
  camt: a.camt / 100,
  samt: a.samt / 100,
  csamt: a.csamt / 100,
});
const addInto = (to: Amounts, from: Amounts) => {
  to.txval += from.txval;
  to.iamt += from.iamt;
  to.camt += from.camt;
  to.samt += from.samt;
  to.csamt += from.csamt;
};
const lineAmounts = (l: SalesInvoiceLine): Amounts => ({
  txval: paise(l.taxable_amount),
  iamt: paise(l.igst_amount),
  camt: paise(l.cgst_amount),
  samt: paise(l.sgst_amount),
  csamt: paise(l.cess_amount),
});
const inr = (p: number) => `₹${(p / 100).toFixed(2)}`;
function bucket<K>(map: Map<K, Amounts>, key: K): Amounts {
  if (!map.has(key)) map.set(key, ZERO());
  return map.get(key)!;
}

export function isRetPeriod(retPeriod: string): boolean {
  return /^(0[1-9]|1[0-2])\d{4}$/.test(retPeriod);
}

/** True when an ISO yyyy-mm-dd date falls in the MMYYYY return period. */
export function inPeriod(isoDate: string, retPeriod: string): boolean {
  return isoDate.slice(0, 7) === `${retPeriod.slice(2)}-${retPeriod.slice(0, 2)}`;
}

/** Issued (not draft or cancelled) invoices dated inside the period. */
export function periodInvoices<T extends { status: string; invoice_date: string }>(
  invoices: T[],
  retPeriod: string
): T[] {
  return invoices.filter(
    (i) => i.status !== "draft" && i.status !== "cancelled" && inPeriod(i.invoice_date, retPeriod)
  );
}

// 01-38 are states/UTs, 97 is "Other Territory".
const isStateCode = (c: string) => (Number(c) >= 1 && Number(c) <= 38) || c === "97";

interface Checked {
  inv: ReturnInvoice;
  ctin: string | null;
  pos: string;
  total: Amounts;
}

/** Validations shared by both returns. */
function check(input: Gstr1Input) {
  const errors: string[] = [];
  if (!isRetPeriod(input.retPeriod)) errors.push("Choose a return period (month).");
  const gstin = input.gstin?.trim().toUpperCase() || "";
  if (!gstin) errors.push("Company GSTIN is missing. Add it to the company profile before exporting a return.");
  else if (!isValidGstin(gstin)) errors.push(`Company GSTIN ${gstin} is not valid (check digit or format).`);
  const ownState = gstin.slice(0, 2);

  const checked: Checked[] = [];
  if (!isRetPeriod(input.retPeriod)) return { errors, gstin, checked };

  for (const inv of periodInvoices(input.invoices, input.retPeriod)) {
    const errs: string[] = [];
    const pos = (inv.place_of_supply || "").trim().match(/^(\d{2})(?!\d)/)?.[1] ?? "";
    if (!isStateCode(pos)) errs.push("place of supply is missing or has no valid state code");

    const ctinRaw = inv.parties?.gstin?.trim().toUpperCase() || null;
    if (ctinRaw && !isValidGstin(ctinRaw)) errs.push(`customer GSTIN ${ctinRaw} is not valid`);

    const lines = inv.sales_invoice_lines ?? [];
    if (lines.length === 0) errs.push("has no line items");
    const total = ZERO();
    for (const l of lines) {
      const a = lineAmounts(l);
      addInto(total, a);
      if (!/^\d{4,8}$/.test((l.hsn_sac_code || "").trim()))
        errs.push(`line ${l.line_number} has no valid HSN/SAC code`);
      const expected = Math.round((a.txval * Number(l.gst_rate)) / 100);
      // GSTN tolerates up to ₹1 difference between tax and taxable value x rate.
      if (Math.abs(a.iamt + a.camt + a.samt - expected) > 100)
        errs.push(`line ${l.line_number} tax does not match ${l.gst_rate}% of the taxable value`);
    }

    const header: [keyof Amounts, number, string][] = [
      ["txval", paise(inv.taxable_amount), "taxable value"],
      ["camt", paise(inv.cgst_amount), "CGST"],
      ["samt", paise(inv.sgst_amount), "SGST"],
      ["iamt", paise(inv.igst_amount), "IGST"],
      ["csamt", paise(inv.cess_amount), "cess"],
    ];
    for (const [k, h, label] of header)
      if (lines.length && h !== total[k])
        errs.push(`${label} ${inr(h)} does not equal the sum of its lines ${inr(total[k])}`);

    if (inv.supply_type === "intra_state") {
      if (total.iamt !== 0) errs.push("is intra-state but carries IGST");
      if (total.camt !== total.samt) errs.push("is intra-state but CGST and SGST differ");
      if (ownState && pos && pos !== ownState)
        errs.push(`is intra-state but place of supply ${pos} differs from the company's state ${ownState}`);
    } else if (inv.supply_type === "inter_state") {
      if (total.camt !== 0 || total.samt !== 0) errs.push("is inter-state but carries CGST/SGST");
      if (ownState && pos === ownState)
        errs.push(`is inter-state but place of supply ${pos} is the company's own state`);
    } else if (inv.supply_type === "export" || inv.supply_type === "exempt") {
      if (total.iamt || total.camt || total.samt) errs.push(`is ${inv.supply_type} but carries tax`);
    } else {
      errs.push(`has unknown supply type "${inv.supply_type}"`);
    }

    if (errs.length) errors.push(...errs.map((e) => `Invoice ${inv.invoice_number}: ${e}.`));
    else checked.push({ inv, ctin: ctinRaw, pos, total });
  }
  return { errors, gstin, checked };
}

const isoToGstDate = (iso: string) => `${iso.slice(8, 10)}-${iso.slice(5, 7)}-${iso.slice(0, 4)}`;
// The offline tool numbers items as rate x 100 + 1 (18% -> 1801).
const itemNum = (rt: number) => Math.round(rt * 100) + 1;
// shortcut: B2CL threshold is the post-Aug-2024 ₹1 lakh limit; earlier periods (₹2.5 lakh) block more than needed.
const B2CL_LIMIT = 100_000_00;

export function buildGstr1(input: Gstr1Input): ReturnResult {
  const { errors, gstin, checked } = check(input);

  const b2b = new Map<string, Record<string, unknown>[]>();
  const b2cs = new Map<string, Amounts>();
  const nil = new Map<string, number>();
  const hsn = new Map<string, Amounts & { qty: number }>();
  const sum = { b2b: ZERO(), b2cs: ZERO(), nil: ZERO() };

  for (const { inv, ctin, pos, total } of checked) {
    const lines = inv.sales_invoice_lines ?? [];
    if (inv.supply_type === "export") {
      errors.push(`Invoice ${inv.invoice_number}: export invoices (Table 6A) are not supported yet.`);
      continue;
    }
    if (!ctin && inv.supply_type === "inter_state" && paise(inv.total_amount) > B2CL_LIMIT) {
      errors.push(`Invoice ${inv.invoice_number}: inter-state B2C invoice above ₹1 lakh (B2CL) is not supported yet.`);
      continue;
    }

    for (const l of lines) {
      const a = lineAmounts(l);
      const code = l.hsn_sac_code!.trim();
      const service = code.startsWith("99");
      // Services have no quantity: GSTN wants UQC "NA" and qty 0.
      const uqc = service ? "NA" : l.unit_code;
      const key = `${ctin ? "b2b" : "b2c"}|${code}|${uqc}|${Number(l.gst_rate)}`;
      const h = hsn.get(key) ?? { ...ZERO(), qty: 0 };
      addInto(h, a);
      if (!service) h.qty += Math.round(Number(l.quantity) * 10000);
      hsn.set(key, h);
    }

    const inter = inv.supply_type === "inter_state" || pos !== gstin.slice(0, 2);
    if (inv.supply_type === "exempt") {
      const key = `${inter ? "INTR" : "INTRA"}${ctin ? "B2B" : "B2C"}`;
      nil.set(key, (nil.get(key) ?? 0) + total.txval);
      addInto(sum.nil, total);
      continue;
    }

    const byRate = new Map<number, Amounts>();
    for (const l of lines) addInto(bucket(byRate, Number(l.gst_rate)), lineAmounts(l));

    if (ctin) {
      const list = b2b.get(ctin) ?? [];
      list.push({
        inum: inv.invoice_number,
        idt: isoToGstDate(inv.invoice_date),
        val: paise(inv.total_amount) / 100,
        pos,
        rchrg: "N",
        inv_typ: "R",
        itms: [...byRate].map(([rt, a]) => ({ num: itemNum(rt), itm_det: { rt, ...rupees(a) } })),
      });
      b2b.set(ctin, list);
      addInto(sum.b2b, total);
    } else {
      for (const [rt, a] of byRate)
        addInto(bucket(b2cs, `${inter ? "INTER" : "INTRA"}|${pos}|${rt}`), a);
      addInto(sum.b2cs, total);
    }
  }

  // Document series = invoice number without its trailing digits (INV-0001 -> INV-).
  const docs = new Map<string, string[]>();
  const cancelled = new Set<string>();
  if (isRetPeriod(input.retPeriod)) {
    for (const i of input.invoices) {
      if (i.status === "draft" || !inPeriod(i.invoice_date, input.retPeriod)) continue;
      const series = i.invoice_number.replace(/\d+$/, "");
      docs.set(series, [...(docs.get(series) ?? []), i.invoice_number]);
      if (i.status === "cancelled") cancelled.add(i.invoice_number);
    }
  }

  const summary: SummaryRow[] = [
    { section: "B2B (4A)", amounts: rupees(sum.b2b) },
    { section: "B2C small (7)", amounts: rupees(sum.b2cs) },
    { section: "Nil / exempt (8)", amounts: rupees(sum.nil) },
  ];
  if (errors.length) return { json: null, errors, summary };

  const hsnRows = (kind: string) =>
    [...hsn]
      .filter(([k]) => k.startsWith(kind))
      .map(([k, h], idx) => {
        const [, hsn_sc, uqc, rt] = k.split("|");
        return { num: idx + 1, hsn_sc, uqc, qty: h.qty / 10000, rt: Number(rt), ...rupees(h) };
      });

  const json = {
    gstin,
    fp: input.retPeriod,
    b2b: [...b2b].map(([ctin, inv]) => ({ ctin, inv })),
    b2cs: [...b2cs].map(([k, a]) => {
      const [sply_ty, pos, rt] = k.split("|");
      return { sply_ty, pos, typ: "OE", rt: Number(rt), ...rupees(a) };
    }),
    nil: {
      // The books only know "exempt"; there is no nil-rated or non-GST category to report.
      inv: [...nil].map(([sply_ty, p]) => ({ sply_ty, expt_amt: p / 100, nil_amt: 0, ngsup_amt: 0 })),
    },
    hsn: { hsn_b2b: hsnRows("b2b|"), hsn_b2c: hsnRows("b2c|") },
    doc_issue: {
      doc_det: [
        {
          doc_num: 1, // Invoices for outward supply
          docs: [...docs].map(([, nums], idx) => {
            const sorted = [...nums].sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
            const cancel = nums.filter((n) => cancelled.has(n)).length;
            return {
              num: idx + 1,
              from: sorted[0],
              to: sorted[sorted.length - 1],
              totnum: nums.length,
              cancel,
              net_issue: nums.length - cancel,
            };
          }),
        },
      ],
    },
  };
  return { json, errors, summary };
}

export const ITC_HEADS: [RegExp, "camt" | "samt" | "iamt" | "csamt"][] = [
  [/^input\s+cgst\b/i, "camt"],
  [/^input\s+(sgst|utgst)\b/i, "samt"],
  [/^input\s+igst\b/i, "iamt"],
  [/^input\s+cess\b/i, "csamt"],
];

/** Period ITC from the Input GST ledgers, or errors explaining why it can't be derived. */
function computeItc(retPeriod: string, accounts: Account[], journals: JournalEntry[]) {
  const errors: string[] = [];
  const head = new Map<string, keyof Amounts>();
  const names = new Map(accounts.map((a) => [a.id, a.name]));
  for (const a of accounts) {
    const h = ITC_HEADS.find(([re]) => re.test(a.name));
    if (h) head.set(a.id, h[1]);
  }
  const heads = new Set(head.values());
  for (const [k, label] of [["camt", "CGST"], ["samt", "SGST"], ["iamt", "IGST"]] as const)
    if (!heads.has(k)) errors.push(`ITC not computed: the chart of accounts has no "Input ${label}" ledger.`);

  // Reversed entries were posted before being reversed, so they still belong to their period.
  const live = journals.filter(
    (j) => (j.status === "posted" || j.status === "reversed") && inPeriod(j.entry_date, retPeriod)
  );
  const ids = new Set(live.map((j) => j.id));
  const voided = new Set<string>();
  for (const j of live)
    if (j.reversal_of_id && ids.has(j.reversal_of_id)) voided.add(j.id).add(j.reversal_of_id);

  const itc = ZERO();
  for (const j of live) {
    if (voided.has(j.id)) continue;
    for (const l of j.journal_entry_lines ?? []) {
      const k = head.get(l.account_id);
      if (!k) continue;
      // Credits (set-off, ITC reversal) and reversals of other periods' entries can't be placed
      // in Table 4(B) or utilisation from the ledger alone.
      if (j.reversal_of_id || paise(l.credit) !== 0) {
        errors.push(
          `ITC not computed: entry ${j.entry_number} ${j.reversal_of_id ? "reverses an entry from another period on" : "credits"} ${names.get(l.account_id)}; Table 4 reversals and set-offs are not supported yet.`
        );
        continue;
      }
      itc[k] += paise(l.debit);
    }
  }
  return { itc, errors };
}

/** Table 4 from the purchase register: eligible -> 4(A)(5), 17(5) -> 4(D)(1), other ineligible -> 4(D)(2). */
function itcFromBills(retPeriod: string, bills: PurchaseBill[]) {
  const errors: string[] = [];
  for (const b of bills)
    for (const e of validateBill(billToDraft(b)))
      errors.push(`Purchase bill ${b.bill_number} (${b.supplier_gstin}): ${e}.`);
  const t = itcTotals(bills, `${retPeriod.slice(2)}-${retPeriod.slice(0, 2)}`);
  return { itc: t.eligible, blocked: t.blocked, ineligible: t.ineligible, errors };
}

export function buildGstr3b(input: Gstr3bInput): ReturnResult {
  const { errors, gstin, checked } = check(input);

  const osup = ZERO();
  const zero = ZERO();
  const nilExempt = ZERO();
  const unreg = new Map<string, Amounts>();
  for (const { inv, ctin, pos, total } of checked) {
    if (inv.supply_type === "export") addInto(zero, total);
    else if (inv.supply_type === "exempt") addInto(nilExempt, total);
    else {
      addInto(osup, total);
      if (inv.supply_type === "inter_state" && !ctin) addInto(bucket(unreg, pos), total);
    }
  }

  const bills = isRetPeriod(input.retPeriod)
    ? (input.purchaseBills ?? []).filter((b) => inPeriod(b.bill_date, input.retPeriod))
    : [];
  const itc = !isRetPeriod(input.retPeriod)
    ? { itc: ZERO(), blocked: null, ineligible: null, errors: [] }
    : bills.length
      ? itcFromBills(input.retPeriod, bills)
      : { ...computeItc(input.retPeriod, input.accounts, input.journals), blocked: null, ineligible: null };
  errors.push(...itc.errors);

  const summary: SummaryRow[] = [
    { section: "3.1(a) Outward taxable", amounts: rupees(osup) },
    { section: "3.1(b) Zero rated (exports)", amounts: rupees(zero) },
    { section: "3.1(c) Nil rated / exempt", amounts: rupees(nilExempt) },
    {
      section: bills.length ? "4(A)(5) Eligible ITC (purchase bills)" : "4 Eligible ITC (Input GST ledgers)",
      amounts: itc.errors.length ? null : rupees(itc.itc),
    },
  ];
  if (itc.blocked && itc.ineligible)
    summary.push(
      { section: "4(D)(1) Blocked u/s 17(5)", amounts: itc.errors.length ? null : rupees(itc.blocked) },
      { section: "4(D)(2) Other ineligible", amounts: itc.errors.length ? null : rupees(itc.ineligible) }
    );
  if (errors.length) return { json: null, errors, summary };

  const taxOnly = (a: Amounts) => {
    const { iamt, camt, samt, csamt } = rupees(a);
    return { iamt, camt, samt, csamt };
  };
  const itcTax = taxOnly(itc.itc);
  const z = rupees(zero);
  const json = {
    gstin,
    ret_period: input.retPeriod,
    sup_details: {
      osup_det: rupees(osup),
      osup_zero: { txval: z.txval, iamt: z.iamt, csamt: z.csamt },
      osup_nil_exmp: { txval: rupees(nilExempt).txval },
    },
    inter_sup: {
      unreg_details: [...unreg].map(([pos, a]) => ({ pos, txval: a.txval / 100, iamt: a.iamt / 100 })),
    },
    itc_elg: {
      itc_avl: [{ ty: "OTH", ...itcTax }],
      itc_net: itcTax,
      ...(itc.blocked &&
        itc.ineligible && {
          itc_inelg: [
            { ty: "RUL", ...taxOnly(itc.blocked) },
            { ty: "OTH", ...taxOnly(itc.ineligible) },
          ],
        }),
    },
  };
  return { json, errors, summary };
}
