import { describe, expect, it } from "vitest";
import { ApiError } from "@/api/errors";
import { stockValue } from "@/lib/learn/engine/inventory";
import { demo } from "./fixtures/learn-engine-ctx";

const p = (n: number | string) => Math.round(Number(n) * 100);

async function rejects(promise: Promise<unknown>, status: number, message?: RegExp) {
  const err = await promise.then(
    () => null,
    (e) => e
  );
  expect(err, "expected the engine to refuse").toBeInstanceOf(ApiError);
  expect((err as ApiError).status).toBe(status);
  if (message) expect((err as ApiError).message).toMatch(message);
}

function balanced(lines: { debit: number; credit: number }[]) {
  return lines.reduce((s, l) => s + p(l.debit), 0) === lines.reduce((s, l) => s + p(l.credit), 0);
}

/** A draft invoice for 5 MCB panels (₹12,000 each, CGST+SGST 9%) to Kaveri Infra. */
async function draftInvoice(d: ReturnType<typeof demo>, number = "AST/26-27/101", qty = 5) {
  const item = d.ds.catalogue.find((c) => c.sku === "AST-MCB-63A")!;
  const taxable = qty * 12000;
  const half = taxable * 0.09;
  await d.post("/invoices", {
    customer_id: `${d.ds.org.id}-p-c2`,
    invoice_number: number,
    invoice_date: "2026-11-10",
    due_date: "2026-11-25",
    supply_type: "intra_state",
    place_of_supply: "27-Maharashtra",
    taxable_amount: taxable,
    total_amount: taxable + 2 * half,
    lines: [{ line_number: 1, item_id: item.id, item_name: item.name, hsn_sac_code: "853620", unit_code: "NOS", quantity: qty, unit_price: 12000, taxable_amount: taxable, gst_rate: 18, cgst_rate: 9, cgst_amount: half, sgst_rate: 9, sgst_amount: half, igst_rate: 0, igst_amount: 0, cess_amount: 0, total_amount: taxable + 2 * half }],
  });
  return d.ds.invoices.find((i) => i.invoice_number === number)!;
}

describe("sales invoices", () => {
  it("issuing posts a balanced journal with the GST split, raises the receivable and moves stock out at FIFO cost", async () => {
    const d = demo("aster-trading", "accountant");
    const inv = await draftInvoice(d);
    expect(d.last()?.type).toBe("invoice.created");
    const arBefore = await d.bal("1030");
    const stockBefore = stockValue(d.ds);
    d.as("admin");
    const res = await d.post(`/invoices/${inv.id}/issue`, { create_journal: true });
    const issued = d.ds.invoices.find((i) => i.id === inv.id)!;
    expect(issued.status).toBe("issued");
    const je = d.ds.journals.find((j) => j.id === issued.journal_entry_id)!;
    expect(je.status).toBe("posted");
    expect(je.entry_number).toBe("JRN-AST/26-27/101");
    expect(balanced(je.journal_entry_lines)).toBe(true);
    const line = (code: string) => je.journal_entry_lines.find((l) => l.account_id === d.acc(code));
    expect(line("1030")?.debit).toBe(70800);
    expect(line("4010")?.credit).toBe(60000);
    expect(line("2081")?.credit).toBe(5400);
    expect(line("2082")?.credit).toBe(5400);
    expect(line("2083")).toBeUndefined();
    expect(await d.bal("1030")).toBe(arBefore + 70800);
    // The 35 panels on hand were bought at ₹7,000: five leave at ₹35,000.
    expect(res.cost_of_goods_fifo).toBe(35000);
    expect(p(stockValue(d.ds))).toBe(p(stockBefore - 35000));
    expect(d.last()).toMatchObject({ type: "invoice.issued", role: "admin", refs: { invoiceId: inv.id, journalId: je.id, total: 70800 } });
    expect(d.ds.auditEvents[0]).toMatchObject({ category: "VOUCHER", entity_id: je.id });
  });

  it("follows the database's roles: CFO and accountant can't issue (the issue posts a journal), viewer can't create", async () => {
    const d = demo("aster-trading", "accountant");
    const inv = await draftInvoice(d);
    await rejects(d.post(`/invoices/${inv.id}/issue`), 403);
    await rejects(d.as("cfo").post(`/invoices/${inv.id}/issue`), 403);
    expect(d.ds.invoices.find((i) => i.id === inv.id)!.status).toBe("draft");
    await rejects(draftInvoice(d.as("viewer"), "AST/26-27/102"), 403);
    await rejects(draftInvoice(d.as("cfo"), "AST/26-27/103"), 403);
  });

  it("refuses a sale that would take stock below zero, and tax that breaks the supply rules", async () => {
    const d = demo("aster-trading");
    const big = await draftInvoice(d, "AST/26-27/110", 36);
    await rejects(d.post(`/invoices/${big.id}/issue`), 409, /Not enough stock/);
    expect(d.ds.invoices.find((i) => i.id === big.id)!.status).toBe("draft");
    expect(d.ds.journals.some((j) => j.entry_number === "JRN-AST/26-27/110")).toBe(false);
    const bad = await draftInvoice(d, "AST/26-27/111");
    d.state.ds = { ...d.ds, invoices: d.ds.invoices.map((i) => (i.id === bad.id ? { ...i, sales_invoice_lines: i.sales_invoice_lines!.map((l) => ({ ...l, igst_amount: 100 })) } : i)) };
    await rejects(d.post(`/invoices/${bad.id}/issue`), 400, /Intra-state line 1 cannot have IGST/);
  });

  it("cancelling reverses the journal with a posted contra entry and brings the stock back", async () => {
    const d = demo("aster-trading");
    const inv = await draftInvoice(d);
    await d.post(`/invoices/${inv.id}/issue`);
    const stock = stockValue(d.ds);
    const ar = await d.bal("1030");
    await d.post(`/invoices/${inv.id}/cancel`, { reason: "Raised in error" });
    const cancelled = d.ds.invoices.find((i) => i.id === inv.id)!;
    expect(cancelled.status).toBe("cancelled");
    const orig = d.ds.journals.find((j) => j.id === cancelled.journal_entry_id)!;
    const rev = d.ds.journals.find((j) => j.reversal_of_id === orig.id)!;
    expect(orig.status).toBe("reversed");
    expect(rev).toMatchObject({ status: "posted", entry_number: "REV-JRN-AST/26-27/101" });
    expect(rev.journal_entry_lines.find((l) => l.account_id === d.acc("1030"))?.credit).toBe(70800);
    expect(await d.bal("1030")).toBe(ar - 70800);
    expect(p(stockValue(d.ds))).toBe(p(stock + 35000));
    expect(d.last()).toMatchObject({ type: "invoice.cancelled", refs: { reversalJournalId: rev.id } });
  });

  it("a credit note posts Dr sales and output tax, Cr the customer, capped at the invoice", async () => {
    const d = demo("aster-trading");
    const inv = d.ds.invoices.find((i) => i.invoice_number === "AST/26-27/002")!;
    const line = { line_number: 1, item_name: "Cable", unit_code: "COIL", quantity: 1, unit_price: 20000, taxable_amount: 20000, gst_rate: 18, cgst_amount: 1800, sgst_amount: 1800, igst_amount: 0, cess_amount: 0, total_amount: 23600 };
    await d.post("/notes", { original_invoice_id: inv.id, note_type: "credit", note_number: "CN/26-27/001", note_date: "2026-11-10", reason_code: "discount", lines: [line] });
    const note = d.ds.notes.find((n) => n.note_number === "CN/26-27/001")!;
    const ar = await d.bal("1030");
    await d.post(`/notes/${note.id}/issue`);
    const je = d.ds.journals.find((j) => j.id === d.ds.notes.find((n) => n.id === note.id)!.journal_entry_id)!;
    expect(balanced(je.journal_entry_lines)).toBe(true);
    expect(je.journal_entry_lines.find((l) => l.account_id === d.acc("4010"))?.debit).toBe(20000);
    expect(await d.bal("1030")).toBe(ar - 23600);
    expect(d.last()).toMatchObject({ type: "note.issued", refs: { total: 23600 } });
    await d.post("/notes", { original_invoice_id: inv.id, note_type: "credit", note_number: "CN/26-27/002", note_date: "2026-11-10", reason_code: "discount", lines: [{ ...line, quantity: 20, taxable_amount: 400000, cgst_amount: 36000, sgst_amount: 36000, total_amount: 472000 }] });
    await rejects(d.post(`/notes/${d.ds.notes.find((n) => n.note_number === "CN/26-27/002")!.id}/issue`), 400, /exceed its taxable value/);
  });
});

describe("vouchers", () => {
  const voucher = (d: ReturnType<typeof demo>, number: string, lines: [string, number, number, string?][], date = "2026-11-10") =>
    d.post("/journals", {
      fiscal_period_id: d.ds.fiscalPeriods[0].id,
      entry_number: number,
      entry_date: date,
      narration: `[TEST] ${number}`,
      lines: lines.map(([code, debit, credit, party], i) => ({ line_number: i + 1, account_id: d.acc(code), party_id: party, debit, credit })),
    });

  it("a receipt and a payment follow maker-checker and move the party balances", async () => {
    const d = demo("aster-trading", "accountant");
    const kaveri = `${d.ds.org.id}-p-c2`;
    const deccan = `${d.ds.org.id}-p-v1`;
    const r = await voucher(d, "RCT-2026-0002", [["1020", 100000, 0], ["1030", 0, 100000, kaveri]]);
    const id = r.entry[0].id;
    expect(d.last()).toMatchObject({ type: "journal.created", refs: { voucherType: "receipt", status: "draft", total: 100000 } });
    await rejects(d.post(`/journals/${id}/post`), 403);
    await rejects(d.as("owner").post(`/journals/${id}/post`), 400, /Approval required/);
    await d.as("accountant").post(`/journals/${id}/submit`);
    const debtorsBefore = (await d.get("/reports/party-ageing?side=receivable")).data.find((x: { party_id: string }) => x.party_id === kaveri).balance;
    await d.as("cfo").post(`/journals/${id}/post`);
    expect(d.ds.journals.find((j) => j.id === id)).toMatchObject({ status: "posted", posted_by: "u-cfo", created_by: "u-acc" });
    const after = (await d.get("/reports/party-ageing?side=receivable")).data.find((x: { party_id: string }) => x.party_id === kaveri);
    expect(after.balance).toBe(debtorsBefore - 100000);
    expect(d.last()).toMatchObject({ type: "journal.posted", role: "cfo", refs: { journalId: id, total: 100000 } });

    // The maker can't approve their own voucher, even as an approver role.
    const pay = await voucher(d.as("owner"), "PAY-2026-0004", [["2010", 200000, 0, deccan], ["1020", 0, 200000]]);
    await d.post(`/journals/${pay.entry[0].id}/submit`);
    await rejects(d.post(`/journals/${pay.entry[0].id}/post`), 400, /Maker-checker/);
    const ap = await d.bal("2010");
    await d.as("admin").post(`/journals/${pay.entry[0].id}/post`);
    expect(await d.bal("2010")).toBe(ap - 200000);
  });

  it("an unbalanced voucher saves as a draft (as in the database) but can't be submitted or posted", async () => {
    const d = demo("aster-trading", "accountant");
    const r = await voucher(d, "JRN-2026-0010", [["5040", 1000, 0], ["1020", 0, 900]]);
    await rejects(d.post(`/journals/${r.entry[0].id}/submit`), 400, /balance/);
    await rejects(d.as("owner").post(`/journals/${r.entry[0].id}/post`), 400);
    await rejects(voucher(d.as("accountant"), "JRN-2026-0011", [["5040", 100, 100], ["1020", 0, 100]]), 400, /either a debit or a credit/);
    await rejects(voucher(d, "JRN-2026-0012", [["1000", 100, 0], ["1020", 0, 100]]), 400, /not postable/);
    expect(d.ds.journals.find((j) => j.id === r.entry[0].id)!.status).toBe("draft");
  });

  it("refuses to post outside an open fiscal period", async () => {
    const d = demo("aster-trading", "accountant");
    const r = await voucher(d, "JRN-2026-0013", [["5040", 1000, 0], ["1020", 0, 1000]], "2027-05-01");
    await d.post(`/journals/${r.entry[0].id}/submit`);
    await rejects(d.as("cfo").post(`/journals/${r.entry[0].id}/post`), 400, /outside fiscal period/);
  });

  it("editing a draft replaces its lines; reversing a posted voucher posts the contra entry", async () => {
    const d = demo("aster-trading", "accountant");
    const r = await voucher(d, "JRN-2026-0014", [["5040", 1000, 0], ["1020", 0, 1000]]);
    const id = r.entry[0].id;
    await d.put(`/journals/${id}`, { entry_date: "2026-11-10", narration: "Courier charges", lines: [{ account_id: d.acc("5090"), debit: 1500, credit: 0 }, { account_id: d.acc("1020"), debit: 0, credit: 1500 }] });
    expect(d.ds.journals.find((j) => j.id === id)!.journal_entry_lines.map((l) => l.debit + l.credit)).toEqual([1500, 1500]);
    expect(d.last()?.type).toBe("journal.updated");
    await d.post(`/journals/${id}/submit`);
    await rejects(d.put(`/journals/${id}`, { entry_date: "2026-11-10", narration: "x", lines: [] }), 400, /awaiting approval/);
    await d.as("cfo").post(`/journals/${id}/post`);
    const bank = await d.bal("1020");
    await rejects(d.post(`/journals/${id}/reverse`, { reversal_date: "2026-11-10" }), 403);
    const res = await d.as("owner").post(`/journals/${id}/reverse`, { reversal_date: "2026-11-10" });
    const rev = d.ds.journals.find((j) => j.id === res.reversal_entry_id)!;
    expect(rev).toMatchObject({ status: "posted", reversal_of_id: id, entry_number: "REV-JRN-2026-0014" });
    expect(rev.journal_entry_lines.find((l) => l.account_id === d.acc("1020"))?.debit).toBe(1500);
    expect(d.ds.journals.find((j) => j.id === id)!.status).toBe("reversed");
    expect(await d.bal("1020")).toBe(bank + 1500);
    expect(d.last()).toMatchObject({ type: "journal.reversed", refs: { journalId: id, reversalJournalId: rev.id } });
  });
});

describe("purchases and stock", () => {
  it("a bill with goods lines raises the payable, books ITC and brings stock in once linked", async () => {
    const d = demo("aster-trading", "accountant");
    const panel = d.ds.catalogue.find((c) => c.sku === "AST-MCB-63A")!;
    const deccan = d.ds.parties.find((x) => x.type === "vendor")!;
    const res = await d.post("/purchases", {
      party_id: deccan.id, supplier_name: deccan.legal_name, supplier_gstin: deccan.gstin, bill_number: "DC-INV-950", bill_date: "2026-11-10", place_of_supply: "27",
      taxable_amount: 75000, cgst: 0, sgst: 0, igst: 13500, cess: 0, total_amount: 88500, itc_eligibility: "eligible", blocked_reason: null, journal_entry_id: null,
      lines: [{ item_id: panel.id, quantity: 10, rate: 7500 }],
    });
    const bill = res.data[0];
    expect(d.last()).toMatchObject({ type: "purchase.created", refs: { total: 88500, itc: "eligible" } });
    const je = await d.post("/journals", { fiscal_period_id: d.ds.fiscalPeriods[0].id, entry_number: `PUR-${deccan.gstin}-DC-INV-950`, entry_date: "2026-11-10", narration: "[PURCHASE] Bill DC-INV-950", lines: [
      { line_number: 1, account_id: d.acc("1050"), debit: 75000, credit: 0 },
      { line_number: 2, account_id: d.acc("1083"), debit: 13500, credit: 0 },
      { line_number: 3, account_id: d.acc("2010"), party_id: deccan.id, debit: 0, credit: 88500 },
    ] });
    await d.post(`/journals/${je.entry[0].id}/submit`);
    await d.as("cfo").post(`/journals/${je.entry[0].id}/post`);
    const [ap, itc, before] = [await d.bal("2010"), await d.bal("1083"), stockValue(d.ds)];
    await d.as("accountant").patch(`/purchases/${bill.id}`, { journal_entry_id: je.entry[0].id });
    expect(p(stockValue(d.ds))).toBe(p(before + 75000));
    expect(p(stockValue(d.ds))).toBe(p(await d.bal("1050")));
    expect(ap).toBe(503600 + 88500);
    expect(itc).toBe(183600 + 13500);
    await rejects(d.del(`/purchases/${bill.id}`), 400, /in the books/);
  });

  it("a stock adjustment moves stock at FIFO value and posts (or queues) its journal", async () => {
    const d = demo("meridian-retail", "accountant");
    const oil = d.ds.catalogue.find((c) => c.sku === "MR-OIL-1L")!;
    const res = await d.post("/inventory/adjustments", { item_id: oil.id, kind: "adjustment", direction: "out", qty: 10, unit_cost: null, date: "2026-11-10", warehouse_id: null, reason: "Dented tins" });
    expect(res.data).toMatchObject({ value: 5000, journal_status: "pending_approval" });
    expect(d.last()).toMatchObject({ type: "stock.adjusted", refs: { direction: "out", quantity: 10, value: 5000 } });
    const je = d.ds.journals.find((j) => j.id === res.data.journal_entry_id)!;
    expect(je.journal_entry_lines.find((l) => l.account_id === d.acc("5015"))?.debit).toBe(5000);
    const ledger = (await d.get(`/inventory/items/${oil.id}/ledger`)).data;
    expect(ledger.at(-1)).toMatchObject({ direction: "out", value: 5000, balance_qty: 290 });
    await d.as("cfo").post(`/journals/${je.id}/post`);
    expect(p(stockValue(d.ds))).toBe(p(await d.bal("1050")));
    const owner = await d.as("owner").post("/inventory/adjustments", { item_id: oil.id, kind: "adjustment", direction: "in", qty: 4, unit_cost: 520, date: "2026-11-10", warehouse_id: null, reason: "Found in recount" });
    expect(owner.data).toMatchObject({ value: 2080, journal_status: "posted" });
    expect(p(stockValue(d.ds))).toBe(p(await d.bal("1050")));
    await rejects(d.post("/inventory/adjustments", { item_id: oil.id, kind: "adjustment", direction: "out", qty: 9999, unit_cost: null, date: "2026-11-10", warehouse_id: null, reason: null }), 409, /Not enough stock/);
    await rejects(d.as("analyst").post("/inventory/adjustments", { item_id: oil.id, kind: "opening", direction: "in", qty: 1, unit_cost: 1, date: "2026-11-10" }), 403);
  });
});

describe("bank reconciliation", () => {
  it("matching a supplied line records the import and the match; completing needs unexplained differences accepted", async () => {
    const d = demo("aster-trading", "accountant");
    const bank = d.acc("1020");
    const st = d.ds.bankStatements[0];
    const rent = d.ds.journals.find((j) => j.entry_number === "PAY-2026-0002")!;
    const rentLine = rent.journal_entry_lines.find((l) => l.account_id === bank)!;
    const sl = st.lines.find((l) => l.date === "2026-11-05")!;
    await d.post("/banking/reconciliations", { bank_account_id: bank, statement_date: sl.date, statement_amount: sl.amount, statement_reference: sl.reference, statement_narration: sl.narration, journal_entry_line_id: rentLine.id });
    const acts = d.ds.activity.map((a) => a.type);
    expect(acts.slice(-2)).toEqual(["bank.statement_imported", "bank.matched"]);
    expect(d.last()?.refs).toMatchObject({ statementId: st.id, lineId: sl.id, journalId: rent.id });
    await rejects(d.post("/banking/reconciliations", { bank_account_id: bank, statement_date: sl.date, statement_amount: 1, journal_entry_line_id: rentLine.id }), 400, /Reconciliation Violation/);

    // Book the bank charge the statement showed, then complete to 10 Nov with the unidentified credit open.
    const pos = (await d.get(`/banking/statements/position?bank_account_id=${bank}&as_of=2026-11-10`)).data;
    expect(pos.matched_amount).toBe(2508000 - 135000);
    const closing = st.closing_balance;
    const open = st.lines.filter((l) => l.date > "2026-10-31" && l.id !== sl.id).reduce((s, l) => s + l.amount, 0);
    await rejects(d.post("/banking/statements", { bank_account_id: bank, statement_date: "2026-11-10", closing_balance: closing, statement_only_amount: 0, accepted_difference: null }), 400, /difference_not_accepted/);
    const done = await d.post("/banking/statements", { bank_account_id: bank, statement_date: "2026-11-10", closing_balance: closing, statement_only_amount: open, accepted_difference: null });
    expect(done.data[0]).toMatchObject({ unexplained_difference: 0, book_balance: 2373000, difference: closing - 2373000 });
    expect(d.last()).toMatchObject({ type: "bank.reconciled", refs: { reconciliationId: done.data[0].id } });
    const match = d.ds.bankMatches.at(-1)!;
    await d.del(`/banking/reconciliations/${match.id}`);
    expect(d.last()?.type).toBe("bank.unmatched");
  });
});

describe("reports are computed from the books", () => {
  it("ageing, DSO and DPO move with the data", async () => {
    const d = demo("aster-trading");
    const before = (await d.get("/reports/kpis?from=2026-04-01&to=2026-11-10")).data;
    expect(before.dso_days).toBe(Math.floor((472000 / 1180000) * 41 + 0.5));
    const debtors = (await d.get("/reports/party-ageing?side=receivable&as_of=2026-12-20")).data;
    const kaveri = debtors.find((r: { party_name: string }) => r.party_name === "Kaveri Infra");
    expect(kaveri).toMatchObject({ balance: 472000, d31_60: 472000, d0_30: 0, oldest_age_days: 48 });
    expect(kaveri.open_items[0]).toMatchObject({ invoice_number: "AST/26-27/002", due_date: "2026-11-17" });
    const inv = await draftInvoice(d);
    await d.post(`/invoices/${inv.id}/issue`);
    const after = (await d.get("/reports/kpis?from=2026-04-01&to=2026-11-10")).data;
    expect(after.debtors).toBe(before.debtors + 70800);
    expect(after.dso_days).not.toBe(before.dso_days);
    const fpa = (await d.get("/reports/fpa-metrics")).data;
    expect(fpa.profitability.total_revenue).toBe(1060000);
    expect(fpa.profitability.cogs).toBe(595000);
  });

  it("records report.viewed once per visit, not twice in a row", async () => {
    const d = demo("aster-trading", "analyst");
    await d.get("/reports/trial-balance");
    await d.get("/reports/trial-balance?to=2026-11-10");
    await d.get("/reports/profit-and-loss?from=2026-04-01&to=2026-11-10");
    await d.get("/reports/trial-balance");
    expect(d.ds.activity.map((a) => a.refs?.report)).toEqual(["trial-balance", "profit-loss", "trial-balance"]);
  });
});
