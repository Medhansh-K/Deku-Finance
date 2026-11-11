/* eslint-disable @typescript-eslint/no-explicit-any -- reads the engine's untyped JSON responses, as the screens do */
/**
 * Plays every Learn Centre workflow (WF-01 to WF-18) end to end against the in-browser engine:
 * fresh books for the workflow's company and plan, the coach's own rules for role switches and
 * screen visits (WorkflowCoach / LearnDemoContext), the API calls the screen at each step makes
 * for its action (same bodies, same order, built with the screens' own helpers where they exist),
 * and the runner's own check before every Next. Each action step must be unsatisfied before the
 * action and satisfied after it, so no step completes on earlier activity or without the write.
 */
import { describe, expect, it } from "vitest";
import { parseStatement, type StatementLine } from "@/lib/bank/statement-parser";
import { matchStatement, type CandidateLine } from "@/lib/bank/matcher";
import { summariseStatement } from "@/lib/bank/reconciliation";
import { adjustmentPayload } from "@/lib/inventory/stock";
import { formFromOrg, settingsFromForm } from "@/lib/organisation/profile";
import { billPayload, purchaseVoucherLines, type BillDraft } from "@/lib/purchases/bills";
import { demoStatementCsv } from "@/lib/learn/sample-data";
import { EMPTY_WORKFLOW_STATE, checkStep, isWorkflowComplete, nextStep, roleSwitchFor, startWorkflow, stepExpectation, type CompanyWorkflowState } from "@/lib/learn/workflows/runner";
import { LEARN_WORKFLOWS, getLearnWorkflow } from "@/lib/learn/workflows/catalogue";
import type { LearnWorkflow } from "@/lib/learn/workflows/types";
import type { OrgRole } from "@/modules/departments-members/team";
import { demo } from "./fixtures/learn-engine-ctx";

type Demo = ReturnType<typeof demo>;
type Mem = Record<string, any>;
interface Run {
  d: Demo;
  mem: Mem;
  navigateTo(route: string): void;
  switchRole(role: OrgRole): void;
}

const DATE = "2026-11-10"; // inside the open FY 2026-27, after every seeded voucher
const p = (n: number) => Math.round(n * 100);

// ---------------------------------------------------------------- the screens' calls

/** VoucherWorkspace.handleSaveAndPost: next number, POST /journals, optional /files, then submit. */
async function voucher(
  d: Demo,
  mode: "receipt" | "payment" | "contra" | "journal",
  narration: string,
  lines: { code: string; debit?: number; credit?: number; party?: string | null; description?: string }[],
  opts: { submit: boolean; proofFile?: string; reference?: string }
) {
  const prefix = { receipt: "RCT", payment: "PAY", contra: "CNT", journal: "JRN" }[mode];
  const number = (await d.get(`/journals/next-number?prefix=${prefix}-2026`)).data as string;
  const fp = d.ds.fiscalPeriods.find((f) => f.start_date <= DATE && DATE <= f.end_date && f.status === "open")!;
  const res = await d.post("/journals", {
    fiscal_period_id: fp.id,
    entry_number: number,
    entry_date: DATE,
    narration: `[${mode.toUpperCase()}] ${narration}`,
    reference: opts.reference,
    lines: lines.map((l, i) => ({ line_number: i + 1, account_id: d.acc(l.code), party_id: l.party ?? undefined, description: l.description ?? narration, debit: l.debit ?? 0, credit: l.credit ?? 0 })),
  });
  const id = res.entry[0].id as string;
  if (opts.proofFile) await d.post(`/files?filename=${encodeURIComponent(opts.proofFile)}&journal_entry_id=${id}&category=Proof&reference=${encodeURIComponent(number)}`);
  if (opts.submit) await d.post(`/journals/${id}/submit`);
  return { id, number };
}

/** ApprovalsView "Approve & post". */
const approve = (d: Demo, id: string) => d.post(`/journals/${id}/post`);

/** SalesInvoiceEditor "Save draft invoice": one catalogue line, intra-state (both parties in Maharashtra). */
async function saveInvoice(d: Demo, customerId: string, number: string, sku: string, qty: number) {
  const item = d.ds.catalogue.find((c) => c.sku === sku)!;
  const taxable = qty * Number(item.default_unit_price);
  const half = (taxable * Number(item.default_gst_rate)) / 200;
  const total = taxable + 2 * half;
  const res = await d.post("/invoices", {
    customer_id: customerId,
    invoice_number: number,
    invoice_date: DATE,
    due_date: "2026-11-25",
    supply_type: "intra_state",
    place_of_supply: "27-Maharashtra",
    sales_channel: "direct",
    invoice_type: "tax_invoice",
    taxable_amount: taxable,
    round_off: 0,
    total_amount: total,
    lines: [
      { line_number: 1, item_id: item.id, item_name: item.name, hsn_sac_code: item.hsn_sac_code, unit_code: item.unit_code, quantity: qty, unit_price: Number(item.default_unit_price), discount_amount: 0, taxable_amount: taxable, gst_rate: Number(item.default_gst_rate), cgst_rate: Number(item.default_gst_rate) / 2, cgst_amount: half, sgst_rate: Number(item.default_gst_rate) / 2, sgst_amount: half, igst_rate: 0, igst_amount: 0, cess_rate: 0, cess_amount: 0, total_amount: total },
    ],
  });
  return res.invoice[0] as { id: string; invoice_number: string; total_amount: number };
}

/** GstTaxHubView "Issue & post double entry" (after the confirm). */
const issueInvoice = (d: Demo, id: string) => d.post(`/invoices/${id}/issue`, { create_journal: true });

/** VoucherWorkspace "Settle an open sales invoice" on a receipt, then Submit for approval. */
async function settleInvoice(d: Demo, invoiceNumber: string) {
  const open = ((await d.get("/invoices")).data as any[]).filter((i) => i.status === "issued");
  const inv = open.find((i) => i.invoice_number === invoiceNumber);
  expect(inv, `${invoiceNumber} is offered under Settle an open sales invoice`).toBeTruthy();
  const name = inv.parties?.legal_name ?? "";
  return voucher(
    d,
    "receipt",
    `Customer settlement received against Sales Invoice #${inv.invoice_number} (${name})`,
    [
      { code: "1020", debit: inv.total_amount, description: `Bank collection for Inv #${inv.invoice_number}` },
      { code: "1030", credit: inv.total_amount, party: inv.customer_id, description: `Customer settlement for Inv #${inv.invoice_number}` },
    ],
    // The settle select sets the proof type receipt_bill_matching without a file.
    { submit: true, reference: `RCP-${inv.invoice_number}` }
  );
}

/** CompanyProfileCard "Save profile": the whole form, from the org, with one field filled in. */
const saveProfile = (d: Demo) => d.patch("/settings", settingsFromForm({ ...formFromOrg(d.ds.org as never), udyamNumber: "UDYAM-MH-18-0012345" }));

/** PartiesView "Save counterparty". */
const addCustomer = (d: Demo, legal: string, gstin: string) =>
  d.post("/parties", { type: "customer", legal_name: legal, display_name: legal, gstin, pan: gstin.slice(2, 12), email: null, phone: null, billing_address: { city: "", state: "Maharashtra", country: "India" } });

const receivable = async (d: Demo, partyId: string) =>
  (((await d.get("/reports/party-ageing?side=receivable")).data as any[]).find((r) => r.party_id === partyId)?.balance as number | undefined) ?? 0;
const payable = async (d: Demo, partyId: string) =>
  (((await d.get("/reports/party-ageing?side=payable")).data as any[]).find((r) => r.party_id === partyId)?.balance as number | undefined) ?? 0;

async function tbBalanced(d: Demo) {
  const tb = (await d.get("/reports/trial-balance")).data as { total_debit: number; total_credit: number }[];
  expect(p(tb.reduce((s, r) => s + r.total_debit, 0))).toBe(p(tb.reduce((s, r) => s + r.total_credit, 0)));
}

const party = (d: Demo, key: string) => `${d.ds.org.id}-p-${key}`;
const KAVERI = "c2";
const DECCAN = "v1";

// ---------------------------------------------------------------- what the visitor does at each action step

type Action = (r: Run) => Promise<void>;

const ACTIONS: Record<string, Record<string, Action>> = {
  "WF-01": {
    "save-draft": async ({ d, mem }) => {
      mem.arBefore = await d.bal("1030");
      mem.inv = await saveInvoice(d, party(d, KAVERI), "AST/26-27/101", "AST-MCB-63A", 5);
    },
    issue: async ({ d, mem }) => {
      await issueInvoice(d, mem.inv.id);
    },
  },
  "WF-02": {
    "save-bill": async ({ d, mem }) => {
      const v = d.ds.parties.find((x) => x.id === party(d, DECCAN))!;
      const draft: BillDraft = { party_id: v.id, supplier_name: v.legal_name, supplier_gstin: v.gstin!, bill_number: "DC-INV-951", bill_date: DATE, place_of_supply: "27", taxable: 10000000, cgst: 0, sgst: 0, igst: 1800000, cess: 0, itc_eligibility: "eligible", blocked_reason: "" };
      mem.apBefore = await payable(d, v.id);
      mem.itcBefore = await d.bal("1083");
      // PurchasesView.save: bill first (no item lines), then the voucher, submit, link.
      const bill = (await d.post("/purchases", billPayload(draft))).data[0];
      const { lines, errors } = purchaseVoucherLines(draft, { expense: d.acc("1050"), payable: d.acc("2010"), input: { iamt: d.acc("1083") } });
      expect(errors).toEqual([]);
      const fp = d.ds.fiscalPeriods.find((f) => f.start_date <= DATE && DATE <= f.end_date)!;
      const je = (await d.post("/journals", { fiscal_period_id: fp.id, entry_number: `PUR-${draft.supplier_gstin}-${draft.bill_number}`, entry_date: DATE, narration: `[PURCHASE] Bill ${draft.bill_number} from ${draft.supplier_name}`, reference: draft.bill_number, lines })).entry[0];
      await d.post(`/journals/${je.id}/submit`);
      await d.patch(`/purchases/${bill.id}`, { journal_entry_id: je.id });
      mem.bill = bill;
      mem.billJe = je.id;
      mem.stockBefore = JSON.stringify((await d.get("/inventory/summary")).data);
    },
    "approve-bill": async ({ d, mem }) => {
      await approve(d, mem.billJe);
    },
  },
  "WF-03": {
    "settle-invoice": async ({ d, mem }) => {
      mem.arBefore = await receivable(d, party(d, KAVERI));
      mem.receipt = await settleInvoice(d, "AST/26-27/002");
    },
    "approve-receipt": async ({ d, mem }) => {
      await approve(d, mem.receipt.id);
    },
    payment: async ({ d, mem }) => {
      mem.apBefore = await payable(d, party(d, DECCAN));
      mem.payment = await voucher(d, "payment", "Balance of DC-INV-908", [
        { code: "2010", debit: 503600, party: party(d, DECCAN) },
        { code: "1020", credit: 503600 },
      ], { submit: true, proofFile: "bank-advice.pdf" });
    },
    "approve-payment": async ({ d, mem }) => {
      await approve(d, mem.payment.id);
    },
  },
  "WF-04": {
    contra: async ({ d, mem }) => {
      mem.cashBefore = await d.bal("1010");
      mem.contra = await voucher(d, "contra", "Petty cash withdrawal", [{ code: "1010", debit: 15000 }, { code: "1020", credit: 15000 }], { submit: true, proofFile: "withdrawal-slip.jpg" });
    },
    journal: async ({ d, mem }) => {
      mem.journal = await voucher(d, "journal", "Software bill due, not yet paid", [{ code: "5030", debit: 12000 }, { code: "2010", credit: 12000 }], { submit: false });
    },
    "approve-contra": async ({ d, mem }) => {
      await approve(d, mem.contra.id);
    },
  },
  "WF-05": {
    adjust: async ({ d, mem }) => {
      const item = d.ds.catalogue.find((c) => c.sku === "AST-MCB-63A")!;
      const wh = d.ds.warehouses.find((w) => w.name === "Bhiwandi Main Hub")!;
      mem.item = item;
      mem.qtyBefore = ((await d.get("/inventory/summary")).data as any[]).filter((r) => r.item_id === item.id).reduce((s, r) => s + Number(r.qty_on_hand), 0);
      mem.invBefore = await d.bal("1050");
      const out = adjustmentPayload({ item_id: item.id, kind: "adjustment", direction: "out", qty: "2", unit_cost: "", date: DATE, warehouse_id: wh.id, reason: "damaged in physical count" });
      if (!("payload" in out)) throw new Error(out.error);
      mem.adj = (await d.post("/inventory/adjustments", out.payload)).data;
      expect(mem.adj.journal_status).toBe("pending_approval");
    },
    "approve-adjustment": async ({ d, mem }) => {
      await approve(d, mem.adj.journal_entry_id);
    },
  },
  "WF-06": {
    "load-and-match": async ({ d, mem }) => {
      const bankId = d.acc("1020");
      // Download demo statement → choose it: parsed in the browser, as ReconciliationView.handleFile does.
      const parsed = parseStatement(demoStatementCsv(d.ds.bankStatements[0]));
      expect(parsed.errors ?? []).toEqual([]);
      mem.statement = parsed;
      mem.bankId = bankId;
      const results = await reconResults(d, bankId, parsed.lines);
      const s = results.find((r) => r.status === "suggested")! as Extract<(typeof results)[number], { status: "suggested" }>;
      expect(s, "the demo statement has a suggested match").toBeTruthy();
      const l = s.line;
      await d.post("/banking/reconciliations", { bank_account_id: bankId, statement_date: l.date, statement_amount: (l.direction === "in" ? l.amountPaise : -l.amountPaise) / 100, statement_reference: l.reference, statement_narration: l.narration, journal_entry_line_id: s.best.candidate.id });
    },
    unmatched: async ({ d, mem }) => {
      const results = await reconResults(d, mem.bankId, mem.statement.lines);
      const charge = results.find((r) => r.status === "unmatched" && r.line.direction === "out")!;
      expect(charge, "a bank charge is unmatched").toBeTruthy();
      // Create payment voucher opens Payment (F5); the visitor debits 5090 and attaches the statement.
      const amt = charge.line.amountPaise / 100;
      mem.charge = await voucher(d, "payment", charge.line.narration, [{ code: "5090", debit: amt }, { code: "1020", credit: amt }], { submit: true, proofFile: "statement.pdf", reference: charge.line.reference });
    },
    complete: async ({ d, mem }) => {
      const lines: StatementLine[] = mem.statement.lines;
      const date = lines.map((l) => l.date).sort().at(-1)!;
      const closingPaise = lines.reduce((s, l) => s + (l.direction === "in" ? l.amountPaise : -l.amountPaise), 0);
      const position = (await d.get(`/banking/statements/position?bank_account_id=${mem.bankId}&as_of=${date}`)).data;
      const open = (await reconResults(d, mem.bankId, lines)).map((r) => r.line);
      const summary = summariseStatement(position, closingPaise, open, date);
      mem.summary = summary;
      mem.reconDate = date;
      await d.post("/banking/statements", { bank_account_id: mem.bankId, statement_date: date, closing_balance: closingPaise / 100, statement_only_amount: summary.statementOnlyPaise / 100, accepted_difference: summary.unexplainedPaise === 0 ? null : summary.unexplainedPaise / 100 });
    },
  },
  "WF-07": {
    gst: async ({ d }) => {
      await saveProfile(d);
    },
    ledger: async ({ d, mem }) => {
      const top = Math.max(...d.ds.accounts.map((a) => Number(a.code)).filter((c) => c >= 5000 && c < 6000));
      mem.code = String(top + 10);
      await d.post("/accounts", { code: mem.code, name: "Repairs & maintenance", account_group: "expense", label: "Repairs & maintenance", is_postable: true });
    },
    party: async ({ d }) => {
      await addCustomer(d, "Sahyadri Power Systems LLP", "27AAQFS4321K1ZT");
    },
    item: async ({ d }) => {
      await d.post("/catalogue", { type: "goods", name: "Surge Protector 40kA", sku: "AST-SPD-40", description: null, hsn_sac_code: "853620", unit_code: "NOS", default_unit_price: 3500, default_gst_rate: 18, is_taxable: true, track_inventory: true });
    },
  },
  "WF-08": {
    invite: async ({ d }) => {
      await d.post("/invitations", { email: "analyst2@aster-trading.example", role: "analyst", designation: "Financial analyst" });
    },
    preview: async (r) => r.switchRole("analyst"),
    "back-to-admin": async (r) => r.switchRole("admin"),
  },
  "WF-11": {
    "add-department": async ({ d }) => {
      await d.post("/departments", { name: "Marketing", code: "MKT", budget_allocated: 500000 });
    },
  },
  "WF-15": {
    ask: async ({ d, mem }) => {
      mem.answer = await d.post("/consultant/chat", { message: "What are my revenue, expenses and net profit?", history: [] });
    },
  },
  "WF-18": {
    company: async ({ d }) => {
      await saveProfile(d);
    },
    customer: async ({ d, mem }) => {
      mem.customer = (await addCustomer(d, "Godavari Automation Pvt Ltd", "27AAGCG9876M1ZN")).data[0];
    },
    invoice: async ({ d, mem }) => {
      mem.arBefore = await d.bal("1030");
      mem.inv = await saveInvoice(d, mem.customer.id, "AST/26-27/118", "AST-MCB-63A", 2);
    },
    issue: async ({ d, mem }) => {
      await issueInvoice(d, mem.inv.id);
    },
    receipt: async ({ d, mem }) => {
      mem.receipt = await settleInvoice(d, "AST/26-27/118");
    },
    approve: async ({ d, mem }) => {
      await approve(d, mem.receipt.id);
    },
  },
};

/** ReconciliationView's Matched / Suggested / Unmatched split for the loaded statement. */
async function reconResults(d: Demo, bankId: string, lines: StatementLine[]) {
  const journals = (await d.get("/journals")).data as any[];
  const recs = (await d.get(`/banking/reconciliations?bank_account_id=${bankId}`)).data as any[];
  const key = (date: string, paise: number, ref: string, narr: string) => `${date}|${paise}|${ref}|${narr}`;
  const pool = new Map<string, number>();
  for (const r of recs) {
    const k = key(r.statement_date, p(r.statement_amount), r.statement_reference || "", r.statement_narration || "");
    pool.set(k, (pool.get(k) ?? 0) + 1);
  }
  const open = lines.filter((l) => {
    const k = key(l.date, l.direction === "in" ? l.amountPaise : -l.amountPaise, l.reference, l.narration);
    if (!pool.get(k)) return true;
    pool.set(k, pool.get(k)! - 1);
    return false;
  });
  const done = new Set(recs.map((r) => r.journal_entry_line_id));
  const candidates: CandidateLine[] = journals
    .filter((e) => e.status === "posted")
    .flatMap((e) =>
      e.journal_entry_lines
        .filter((l: any) => l.account_id === bankId && !done.has(l.id))
        .map((l: any) => ({ id: l.id, date: e.entry_date, amountPaise: p(l.debit > 0 ? l.debit : l.credit), direction: l.debit > 0 ? "in" : "out", entryNumber: e.entry_number, reference: e.reference, narration: e.narration }))
    );
  return matchStatement(open, candidates);
}

// ---------------------------------------------------------------- the accounting each workflow claims

const OUTCOMES: Record<string, (r: Run) => Promise<void>> = {
  "WF-01": async ({ d, mem }) => {
    const inv = d.ds.invoices.find((i) => i.id === mem.inv.id)!;
    expect(inv.status).toBe("issued");
    expect(inv.total_amount).toBe(70800);
    const je = d.ds.journals.find((j) => j.id === inv.journal_entry_id)!;
    expect(je.status).toBe("posted");
    await tbBalanced(d);
    expect(p(await d.bal("1030"))).toBe(p(mem.arBefore + 70800));
    expect(await d.bal("4010")).toBeGreaterThanOrEqual(60000);
    // Reopen: the Day Book drawer links the voucher back to this invoice.
    expect((await d.get("/invoices")).data.find((i: any) => i.journal_entry_id === je.id)?.id).toBe(inv.id);
  },
  "WF-02": async ({ d, mem }) => {
    const bill = d.ds.purchases.find((b) => b.id === mem.bill.id)!;
    expect(bill.journal_entry_id).toBe(mem.billJe);
    expect(d.ds.journals.find((j) => j.id === mem.billJe)!.status).toBe("posted");
    expect(p(await payable(d, party(d, DECCAN)))).toBe(p(mem.apBefore + 118000));
    expect(p(await d.bal("1083"))).toBe(p(mem.itcBefore + 18000));
    await tbBalanced(d);
    // The screen sends no item lines, so item quantities don't move (the step says so and points to WF-05).
    expect(JSON.stringify((await d.get("/inventory/summary")).data)).toBe(mem.stockBefore);
  },
  "WF-03": async ({ d, mem }) => {
    expect(p(await receivable(d, party(d, KAVERI)))).toBe(p(mem.arBefore - 472000));
    expect(p(await payable(d, party(d, DECCAN)))).toBe(p(mem.apBefore - 503600));
    const gl = (await d.get(`/reports/general-ledger?account_id=${d.acc("1020")}`)).data as any[];
    const numbers = JSON.stringify(gl);
    expect(numbers).toContain(mem.receipt.number);
    expect(numbers).toContain(mem.payment.number);
    await tbBalanced(d);
  },
  "WF-04": async ({ d, mem }) => {
    const js = (await d.get("/journals")).data as any[];
    expect(js.find((j) => j.id === mem.contra.id).status).toBe("posted");
    expect(js.find((j) => j.id === mem.journal.id).status).toBe("draft");
    expect(p(await d.bal("1010"))).toBe(p(mem.cashBefore + 15000));
    const cashGl = JSON.stringify((await d.get(`/reports/general-ledger?account_id=${d.acc("1010")}`)).data);
    expect(cashGl).toContain(mem.contra.number);
    expect(cashGl).not.toContain(mem.journal.number);
    await tbBalanced(d);
  },
  "WF-05": async ({ d, mem }) => {
    const qty = ((await d.get("/inventory/summary")).data as any[]).filter((r) => r.item_id === mem.item.id).reduce((s, r) => s + Number(r.qty_on_hand), 0);
    expect(qty).toBe(mem.qtyBefore - 2);
    expect(mem.adj.value).toBeGreaterThan(0);
    expect(p(await d.bal("1050"))).toBe(p(mem.invBefore - mem.adj.value));
    expect(d.ds.journals.find((j) => j.id === mem.adj.journal_entry_id)!.status).toBe("posted");
    const ledger = (await d.get(`/inventory/items/${mem.item.id}/ledger`)).data;
    expect(JSON.stringify(ledger)).toContain("damaged in physical count");
    await tbBalanced(d);
  },
  "WF-06": async ({ d, mem }) => {
    const rows = (await d.get("/banking/statements")).data as any[];
    const done = rows.find((s) => s.statement_date === mem.reconDate && s.bank_account_id === mem.bankId);
    expect(done, "a completed reconciliation for the statement date").toBeTruthy();
    expect(p(done.unexplained_difference)).toBe(mem.summary.unexplainedPaise);
    expect(d.ds.bankStatements[0].imported_at).toBeTruthy();
    expect(d.ds.activity.some((a) => a.type === "bank.statement_imported")).toBe(true);
    // The bank-charge voucher waits for approval; nothing reached the ledger without a checker.
    expect(d.ds.journals.find((j) => j.id === mem.charge.id)!.status).toBe("draft");
  },
  "WF-07": async ({ d, mem }) => {
    expect(d.ds.org.udyam_number).toBe("UDYAM-MH-18-0012345");
    expect(d.ds.accounts.some((a) => a.code === mem.code)).toBe(true);
    expect(d.ds.parties.some((x) => x.legal_name === "Sahyadri Power Systems LLP")).toBe(true);
    expect(d.ds.catalogue.some((c) => c.sku === "AST-SPD-40")).toBe(true);
  },
  "WF-08": async ({ d }) => {
    expect(d.ds.invitations.find((i) => i.email === "analyst2@aster-trading.example")).toMatchObject({ role: "analyst", status: "pending" });
  },
  "WF-11": async ({ d }) => {
    expect(d.ds.departments.find((x) => x.code === "MKT")).toMatchObject({ budget_allocated: 500000, budget_utilized: 0 });
  },
  "WF-15": async ({ mem }) => {
    expect(String(mem.answer.response)).toMatch(/revenue/i);
  },
  "WF-16": async ({ d }) => {
    const inv = ((await d.get("/invoices")).data as any[]).find((i) => i.invoice_number === "AST/26-27/002");
    expect(inv.journal_entry_id).toBeTruthy();
    const dayBook = (await d.get("/journals")).data as any[];
    expect(dayBook.find((j) => j.id === inv.journal_entry_id)).toMatchObject({ status: "posted", reference: "AST/26-27/002" });
  },
  "WF-18": async ({ d, mem }) => {
    const inv = d.ds.invoices.find((i) => i.id === mem.inv.id)!;
    expect(inv.status).toBe("issued");
    expect(inv.customer_id).toBe(mem.customer.id);
    expect(await receivable(d, mem.customer.id)).toBe(0);
    expect(p(await d.bal("1030"))).toBe(p(mem.arBefore));
    await tbBalanced(d);
  },
};

// ---------------------------------------------------------------- the coach

/** Runs a workflow the way WorkflowCoach does, on the given books (fresh unless passed in). */
async function playThrough(wf: LearnWorkflow, d: Demo = demo(wf.recommendedCompany, wf.primaryRole, wf.minPlan), mem: Mem = {}) {
  const r: Run = {
    d,
    mem,
    navigateTo(route) {
      r.mem.route = route;
      d.ctx.record("route.visited", `Opened ${route.split("?")[0]}`, { path: route });
    },
    switchRole(role) {
      d.as(role);
      d.ctx.record("role.switched", `Switched to ${role}`, { role });
    },
  };
  let state: CompanyWorkflowState = startWorkflow(EMPTY_WORKFLOW_STATE, wf, d.ds.activity);
  const base = (x: string) => x.split("?")[0];
  for (const step of wf.steps) {
    const at = `${wf.code}/${step.id}`;
    // The coach: switch to the step's role first, then open its screen if not already there.
    const need = roleSwitchFor(step, d.state.role);
    if (need) r.switchRole(need);
    if (base(r.mem.route ?? "") !== base(step.route)) r.navigateTo(step.route);
    const expectation = stepExpectation(step);
    const progress = () => state.progress[wf.id];
    const action = ACTIONS[wf.code]?.[step.id];
    if (expectation.kind === "event") {
      expect(action, `${at} has a scripted action`).toBeTypeOf("function");
      expect(checkStep(wf, progress(), d.ds.activity, r.mem.route).satisfied, `${at} is not done before its action`).toBe(false);
      await action!(r);
    } else if (expectation.route !== base(step.route)) {
      // e.g. "Open invoice" in the Day Book drawer leads to /gst.
      expect(checkStep(wf, progress(), d.ds.activity, r.mem.route).satisfied, `${at} is not done before leaving`).toBe(false);
      r.navigateTo(expectation.route);
    }
    const check = checkStep(wf, progress(), d.ds.activity, r.mem.route);
    expect(check.satisfied, `${at} satisfied`).toBe(true);
    if (step.expect?.kind === "event" && step.expect.role) expect(check.by?.role, `${at} done as ${step.expect.role}`).toBe(step.expect.role);
    const res = nextStep(state, wf, d.ds.activity, r.mem.route);
    expect(res.ok, `${at}: ${res.reason}`).toBe(true);
    state = res.state;
  }
  const p = state.progress[wf.id];
  expect(p.finishedAt, `${wf.code} finished`).toBeTruthy();
  expect(isWorkflowComplete(wf, p)).toBe(true);
  expect(p.completedSteps).toEqual(wf.steps.map((s) => s.id));
  expect(p.skippedSteps).toEqual([]);
  await OUTCOMES[wf.code]?.(r);
  return r;
}

describe("Learn workflows play through on the demo engine", () => {
  for (const wf of LEARN_WORKFLOWS) {
    it(`${wf.code} ${wf.name}: every step completes as written on ${wf.recommendedCompany} (${wf.minPlan})`, async () => {
      await playThrough(wf);
    });
  }

  it("every action step names the role it is done as, so the coach switches to it", () => {
    for (const wf of LEARN_WORKFLOWS)
      for (const s of wf.steps)
        if (s.expect?.kind === "event" && !s.expect.type.startsWith("role.")) expect(s.role, `${wf.code}/${s.id}`).toBeTruthy();
  });

  it("connects across workflows: the WF-01 invoice is the one settled in WF-03 and traced in WF-16", async () => {
    const d = demo("aster-trading", "accountant", "pro");
    const r1 = await playThrough(getLearnWorkflow("WF-01")!, d);
    const inv = r1.mem.inv;
    const before = await receivable(d, party(d, KAVERI));
    // WF-03's receipt settles the WF-01 invoice instead of the seeded one.
    const receipt = await settleInvoice(d.as("accountant"), inv.invoice_number);
    await approve(d.as("cfo"), receipt.id);
    expect(p(await receivable(d, party(d, KAVERI)))).toBe(p(before - 70800));
    const traced = d.ds.invoices.find((i) => i.id === inv.id)!;
    expect((await d.get("/journals")).data.some((j: any) => j.id === traced.journal_entry_id && j.status === "posted")).toBe(true);
    await tbBalanced(d);
  });
});
