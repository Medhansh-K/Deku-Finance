/**
 * Sales invoices and credit/debit notes. Mirrors create_invoice (Rust), issue_sales_invoice
 * (migration 41), cancel_sales_invoice (migration 7), the stock triggers of migration 42 and
 * issue_sales_note / cancel_sales_note (migration 31).
 */
import type { NoteType, SalesInvoice, SalesInvoiceLine, SalesNote } from "@/types/accounting";
import type { DemoDataset } from "../sample-data";
import { accountByCode, booksToday, fail, newId, openPeriodFor, r2 } from "./books";
import { actor, ledgerUpdated, save, type Body, type Handler, type Req } from "./context";
import { addMovement, assertAvailable, defaultWarehouse, fifoMovements, issueUnitCost, reverseDocument } from "./inventory";
import { insertDraft, postDraft, reversePosted } from "./journals";
import { assertRole } from "./rbac";
import { getDemoPlanConfig } from "../demo-plans";

const UNTAXED = ["bill_of_supply", "export_without_payment", "sez_without_payment"];

/** The tax-split checks issue_sales_invoice and issue_sales_note run on every line. */
function checkTaxLines(supply: string, type: string, lines: SalesInvoiceLine[]) {
  for (const l of lines) {
    const c = Number(l.cgst_amount ?? 0), s = Number(l.sgst_amount ?? 0), i = Number(l.igst_amount ?? 0), cess = Number(l.cess_amount ?? 0);
    const n = l.line_number;
    if (supply === "intra_state") {
      if (i !== 0 || Number(l.igst_rate ?? 0) !== 0) fail(`Tax Rule Violation: Intra-state line ${n} cannot have IGST`);
      if (Math.abs(c - s) > 0.02) fail(`Tax Rule Violation: CGST and SGST amounts must be equal for line ${n}`);
    } else if (supply === "inter_state") {
      if (c !== 0 || s !== 0) fail(`Tax Rule Violation: Inter-state line ${n} cannot have CGST or SGST`);
    } else if (supply === "export" && type === "export_with_payment") {
      if (c !== 0 || s !== 0) fail(`Tax Rule Violation: Export line ${n} is taxed as IGST, not CGST/SGST`);
    } else if (supply === "export" || supply === "exempt") {
      if (c || s || i) fail(`Tax Rule Violation: Exempt/Export line ${n} cannot have tax`);
    }
    if (UNTAXED.includes(type) && (c || s || i || cess)) fail(`Tax Rule Violation: line ${n} cannot carry tax on a ${type} invoice`);
  }
}

const sums = (lines: SalesInvoiceLine[]) => {
  const s = (k: keyof SalesInvoiceLine) => r2(lines.reduce((t, l) => t + Number(l[k] ?? 0), 0));
  return { taxable: s("taxable_amount"), cgst: s("cgst_amount"), sgst: s("sgst_amount"), igst: s("igst_amount"), cess: s("cess_amount") };
};

const normLines = (lines: unknown, parentKey: "invoice_id" | "note_id", parentId: string): SalesInvoiceLine[] =>
  (Array.isArray(lines) ? lines : []).map((l: Body, i: number) => ({
    ...l,
    [parentKey]: parentId,
    id: `${parentId}-line-${i + 1}`,
    line_number: Number(l.line_number ?? i + 1),
    quantity: Number(l.quantity || 0),
    unit_price: Number(l.unit_price || 0),
    taxable_amount: Number(l.taxable_amount || 0),
    gst_rate: Number(l.gst_rate || 0),
    cgst_amount: Number(l.cgst_amount || 0),
    sgst_amount: Number(l.sgst_amount || 0),
    igst_amount: Number(l.igst_amount || 0),
    cess_amount: Number(l.cess_amount || 0),
    total_amount: Number(l.total_amount || 0),
  })) as SalesInvoiceLine[];

/** Journal lines for a document: Dr debtors (or marketplace clearing), Cr revenue and output tax; `flip` for credit notes. */
function documentLines(ds: DemoDataset, number: string, partyId: string, arCode: string, t: ReturnType<typeof sums>, total: number, roundOff: number, flip = false) {
  const id = (code: string) => accountByCode(ds, code)?.id ?? fail(`The chart of accounts is missing account ${code}`);
  const raw: { account_id: string; party_id: string | null; description: string; dr: number }[] = [
    { account_id: id(arCode), party_id: partyId, description: `Sales Invoice ${number}`, dr: total },
    { account_id: id("4010"), party_id: null, description: `Taxable Revenue ${number}`, dr: -t.taxable },
  ];
  if (t.cgst > 0) raw.push({ account_id: id("2081"), party_id: null, description: `Output CGST ${number}`, dr: -t.cgst });
  if (t.sgst > 0) raw.push({ account_id: id("2082"), party_id: null, description: `Output SGST ${number}`, dr: -t.sgst });
  if (t.igst > 0) raw.push({ account_id: id("2083"), party_id: null, description: `Output IGST ${number}`, dr: -t.igst });
  if (roundOff) raw.push({ account_id: id("4090"), party_id: null, description: `Round off ${number}`, dr: -roundOff });
  return raw.map(({ dr, ...l }) => {
    const v = flip ? -dr : dr;
    return { ...l, debit: Math.max(v, 0), credit: Math.max(-v, 0) };
  });
}

/** Stock out per tracked goods item, at the default warehouse (stock_on_sales_invoice_status). */
function stockOut(ds: DemoDataset, inv: SalesInvoice) {
  const qty = new Map<string, number>();
  for (const l of inv.sales_invoice_lines ?? []) {
    const ci = ds.catalogue.find((c) => c.id === l.item_id);
    if (ci?.track_inventory) qty.set(ci.id, Math.round(((qty.get(ci.id) ?? 0) + Number(l.quantity)) * 1000) / 1000);
  }
  if (!qty.size) return { ds, cost: 0, moved: [] as { item_id: string; qty: number; fifo_cost: number }[] };
  const wh = defaultWarehouse(ds);
  let next = ds;
  const ids: { item: string; id: string; qty: number }[] = [];
  for (const [item, q] of qty) {
    if (q <= 0) continue;
    const r = addMovement(next, { item_id: item, warehouse_id: wh.id, movement_date: inv.invoice_date, direction: "out", qty: q, unit_cost: null, source_type: "sales_invoice", source_id: inv.id, narration: `Sales invoice ${inv.invoice_number}`, reversal_of: null });
    next = r.ds;
    ids.push({ item, id: r.movement.id, qty: q });
  }
  assertAvailable(next, ids.map((x) => x.item), inv.invoice_date);
  const f = fifoMovements(next);
  const moved = ids.map((x) => ({ item_id: x.item, qty: x.qty, fifo_cost: f.find((r) => r.m.id === x.id)?.value ?? 0 }));
  return { ds: next, cost: r2(moved.reduce((s, m) => s + m.fifo_cost, 0)), moved };
}

const monthOf = (iso?: string | null) => (iso ?? "").slice(0, 7);

export const salesHandler: Handler = (req: Req) => {
  const { sub, method, body, ctx, role } = req;
  let ds = req.ds;

  if (sub === "/invoices") {
    if (method === "GET") return { success: true, data: ds.invoices };
    if (method === "POST") {
      assertRole(ctx, "createInvoice", "Creating a sales invoice");
      const party = ds.parties.find((p) => p.id === body.customer_id) ?? fail("Choose a customer from Parties");
      const number = String(body.invoice_number ?? "").trim() || fail("Enter an invoice number");
      if (ds.invoices.some((i) => i.invoice_number === number)) fail(`Invoice number ${number} is already used`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(body.invoice_date ?? "")) fail("Enter the invoice date");
      const id = newId(ds, "inv");
      const lines = normLines(body.lines, "invoice_id", id);
      const t = sums(lines);
      const inv: SalesInvoice = {
        id,
        organisation_id: ds.org.id,
        customer_id: party.id,
        invoice_number: number,
        invoice_date: body.invoice_date,
        due_date: body.due_date || body.invoice_date,
        status: "draft",
        supply_type: body.supply_type ?? "intra_state",
        place_of_supply: body.place_of_supply ?? "",
        sales_channel: body.sales_channel || "direct",
        invoice_type: body.invoice_type || "tax_invoice",
        shipping_bill_number: body.shipping_bill_number ?? null,
        shipping_bill_date: body.shipping_bill_date ?? null,
        port_code: body.port_code ?? null,
        taxable_amount: Number(body.taxable_amount ?? t.taxable),
        cgst_amount: t.cgst,
        sgst_amount: t.sgst,
        igst_amount: t.igst,
        cess_amount: t.cess,
        round_off: Number(body.round_off ?? 0),
        total_amount: Number(body.total_amount ?? 0),
        notes: body.notes ?? null,
        terms: body.terms ?? null,
        journal_entry_id: null,
        created_at: new Date().toISOString(),
        parties: { legal_name: party.legal_name, gstin: party.gstin },
        sales_invoice_lines: lines,
      };
      save(req, { ...ds, invoices: [inv, ...ds.invoices] });
      ctx.record("invoice.created", `Saved draft invoice ${number}`, { invoiceId: id, number, total: inv.total_amount });
      return { success: true, invoice: [inv], lines };
    }
  }

  const getInv = sub.match(/^\/invoices\/([^/]+)$/);
  if (getInv && method === "GET") return { success: true, data: ds.invoices.filter((i) => i.id === getInv[1]) };

  const invAct = sub.match(/^\/invoices\/([^/]+)\/(issue|cancel)$/);
  if (invAct && method === "POST") {
    const [, id, action] = invAct;
    const inv = ds.invoices.find((i) => i.id === id) ?? fail("Invoice not found", 404);
    const who = actor(ds, role);

    if (action === "issue") {
      assertRole(ctx, "issueInvoice", "Issuing an invoice (it posts the invoice's journal)");
      if (inv.status !== "draft") fail(`Only draft invoices can be issued (Status: ${inv.status})`);
      const type = inv.invoice_type ?? "tax_invoice";
      if (inv.supply_type === "export" && !["export_with_payment", "export_without_payment"].includes(type))
        fail("An export invoice needs the invoice type export with or without payment of IGST");
      const lines = inv.sales_invoice_lines ?? [];
      checkTaxLines(inv.supply_type, type, lines);
      if (!lines.length) fail("Invoice must have at least one line item");
      const max = getDemoPlanConfig(req.plan).entitlements.max_monthly_invoices;
      const thisMonth = monthOf(new Date().toISOString());
      const used = ds.invoices.filter((i) => i.status !== "draft" && monthOf((i as { issued_at?: string }).issued_at) === thisMonth).length;
      if (max != null && used >= max) fail(`plan_limit:max_monthly_invoices: ${used} of ${max} invoices issued this month. Switch plan in the demo bar to issue more.`, 402, "plan_limit");
      const t = sums(lines);
      const tax = r2(t.cgst + t.sgst + t.igst + t.cess);
      const total = r2(t.taxable + tax + Number(inv.round_off ?? 0));
      let journalId: string | null = null;
      // create_journal defaults to true from the screen; with no open period the SQL issues without a journal.
      if (body.create_journal !== false && openPeriodFor(ds, inv.invoice_date)) {
        const arCode = (inv.sales_channel ?? "direct") !== "direct" ? "1040" : "1030";
        const draft = insertDraft(ds, role, { entry_number: `JRN-${inv.invoice_number}`, entry_date: inv.invoice_date, narration: `Sales Invoice ${inv.invoice_number}`, reference: inv.invoice_number }, documentLines(ds, inv.invoice_number, inv.customer_id, arCode, t, total, Number(inv.round_off ?? 0)));
        ds = postDraft(draft.ds, role, draft.entry.id, true).ds;
        journalId = draft.entry.id;
      }
      const issued = { ...inv, taxable_amount: t.taxable, cgst_amount: t.cgst, sgst_amount: t.sgst, igst_amount: t.igst, cess_amount: t.cess, total_amount: total, status: "issued" as const, journal_entry_id: journalId, issued_at: new Date().toISOString(), issued_by: who.id };
      const stock = stockOut(ds, issued);
      ds = { ...stock.ds, invoices: stock.ds.invoices.map((i) => (i.id === id ? issued : i)) };
      save(req, ds);
      ctx.record("invoice.issued", `Issued ${inv.invoice_number}`, { invoiceId: id, number: inv.invoice_number, journalId: journalId ?? "", total });
      ledgerUpdated({ invoiceId: id, action });
      return { success: true, message: `Invoice ${inv.invoice_number} issued`, invoice: issued, stock_out: stock.moved, cost_of_goods_fifo: stock.cost };
    }

    assertRole(ctx, "cancelInvoice", "Cancelling an invoice (it reverses the invoice's journal)");
    if (inv.status !== "issued") fail(`Only issued invoices can be cancelled (Current status: ${inv.status})`);
    const reason = String(body.reason ?? "").trim();
    const date = booksToday(ds);
    let reversalId = "";
    if (inv.journal_entry_id) {
      const r = reversePosted(ds, role, inv.journal_entry_id, date, `Reversal due to cancellation of Invoice ${inv.invoice_number}: ${reason}`);
      ds = r.ds;
      reversalId = r.reversal.id;
    }
    ds = reverseDocument(ds, "sales_invoice", inv.id, date, `Cancelled sales invoice ${inv.invoice_number}`);
    const cancelled = { ...inv, status: "cancelled" as const, cancelled_at: new Date().toISOString(), cancelled_by: who.id, cancellation_reason: reason };
    ds = { ...ds, invoices: ds.invoices.map((i) => (i.id === id ? cancelled : i)) };
    save(req, ds);
    ctx.record("invoice.cancelled", `Cancelled ${inv.invoice_number}`, { invoiceId: id, number: inv.invoice_number, reversalJournalId: reversalId });
    ledgerUpdated({ invoiceId: id, action });
    return { success: true, message: `Invoice ${inv.invoice_number} cancelled`, invoice: cancelled };
  }

  // ---- credit / debit notes ----
  if (sub === "/notes") {
    if (method === "GET")
      return {
        success: true,
        data: ds.notes.map((n) => ({ ...n, sales_invoices: { invoice_number: ds.invoices.find((i) => i.id === n.original_invoice_id)?.invoice_number ?? "" } })),
      };
    if (method === "POST") {
      assertRole(ctx, "createNote", "Creating a credit or debit note");
      const inv = ds.invoices.find((i) => i.id === body.original_invoice_id) ?? fail("Choose the invoice the note adjusts");
      const number = String(body.note_number ?? "").trim() || fail("Enter a note number");
      if (ds.notes.some((n) => n.note_number === number)) fail(`Note number ${number} is already used`);
      const type: NoteType = body.note_type === "debit" ? "debit" : "credit";
      const id = newId(ds, "note");
      const lines = normLines(body.lines, "note_id", id);
      const t = sums(lines);
      const tax = r2(t.cgst + t.sgst + t.igst + t.cess);
      const note: SalesNote & { sales_note_lines: SalesInvoiceLine[] } = {
        id,
        organisation_id: ds.org.id,
        note_type: type,
        original_invoice_id: inv.id,
        customer_id: inv.customer_id,
        note_number: number,
        note_date: body.note_date,
        reason_code: body.reason_code ?? "other",
        reason: body.reason ?? null,
        status: "draft",
        supply_type: inv.supply_type,
        place_of_supply: inv.place_of_supply,
        taxable_amount: t.taxable,
        total_tax: tax,
        total_amount: r2(t.taxable + tax),
        journal_entry_id: null,
        parties: inv.parties,
        sales_note_lines: lines,
      };
      save(req, { ...ds, notes: [note, ...ds.notes] });
      ctx.record("note.created", `Saved draft ${type} note ${number}`, { noteId: id, number, noteType: `${type}_note` });
      return { success: true, note: [note], lines };
    }
  }

  const noteAct = sub.match(/^\/notes\/([^/]+)\/(issue|cancel)$/);
  if (noteAct && method === "POST") {
    const [, id, action] = noteAct;
    const note = (ds.notes.find((n) => n.id === id) ?? fail("Note not found", 404)) as SalesNote & { sales_note_lines?: SalesInvoiceLine[] };
    if (action === "issue") {
      assertRole(ctx, "issueNote", "Issuing a note (it posts the note's journal)");
      if (note.status !== "draft") fail(`Only draft notes can be issued (Status: ${note.status})`);
      const inv = ds.invoices.find((i) => i.id === note.original_invoice_id) ?? fail("Original invoice not found");
      if (inv.status !== "issued") fail(`The original invoice ${inv.invoice_number} is ${inv.status}; notes need an issued invoice`);
      if (note.note_date < inv.invoice_date) fail(`Note date ${note.note_date} is before the invoice date ${inv.invoice_date}`);
      const lines = note.sales_note_lines ?? [];
      checkTaxLines(inv.supply_type, inv.invoice_type ?? "tax_invoice", lines);
      if (!lines.length) fail("Note must have at least one line item");
      const t = sums(lines);
      const tax = r2(t.cgst + t.sgst + t.igst);
      if (t.taxable + tax <= 0) fail("Note must have a value");
      if (t.cess) fail("Notes with cess are not supported yet");
      const credit = note.note_type === "credit";
      if (credit) {
        const prior = ds.notes.filter((n) => n.original_invoice_id === inv.id && n.note_type === "credit" && n.status === "issued" && n.id !== id);
        const done = r2(prior.reduce((s, n) => s + Number(n.taxable_amount), 0));
        if (done + t.taxable > Number(inv.taxable_amount) + 0.001)
          fail(`Credit notes against ${inv.invoice_number} would exceed its taxable value (${done} already credited of ${inv.taxable_amount})`);
        const doneTax = r2(prior.reduce((s, n) => s + Number(n.total_tax), 0));
        const invTax = r2(Number(inv.cgst_amount ?? 0) + Number(inv.sgst_amount ?? 0) + Number(inv.igst_amount ?? 0));
        if (doneTax + tax > invTax + 0.001) fail(`Credit notes against ${inv.invoice_number} would exceed the tax charged on it`);
      }
      if (!openPeriodFor(ds, note.note_date)) fail(`No open fiscal period covers the note date ${note.note_date}`);
      const total = r2(t.taxable + tax);
      const label = `${credit ? "Credit Note" : "Debit Note"} ${note.note_number}`;
      const draft = insertDraft(ds, role, { entry_number: `JRN-${credit ? "CN" : "DN"}-${note.note_number}`, entry_date: note.note_date, narration: label, reference: note.note_number },
        documentLines(ds, note.note_number, note.customer_id, "1030", t, total, 0, credit).map((l) => ({ ...l, description: l.description.replace(`Sales Invoice ${note.note_number}`, label) })));
      ds = postDraft(draft.ds, role, draft.entry.id, true).ds;
      // Sales returns bring goods back at the cost they left at (stock_on_sales_note_status).
      if (credit && note.reason_code === "sales_return") {
        for (const l of lines) {
          const ci = ds.catalogue.find((c) => c.id === l.item_id);
          if (!ci?.track_inventory || Number(l.quantity) <= 0) continue;
          const outs = ds.stockMovements.filter((m) => m.source_type === "sales_invoice" && m.source_id === inv.id && m.item_id === ci.id && m.direction === "out" && !m.reversal_of);
          if (!outs.length) continue;
          ds = addMovement(ds, { item_id: ci.id, warehouse_id: outs[0].warehouse_id, movement_date: note.note_date, direction: "in", qty: Number(l.quantity), unit_cost: issueUnitCost(ds, outs.map((m) => m.id)), source_type: "sales_note", source_id: note.id, narration: `Sales return ${note.note_number}`, reversal_of: null }).ds;
        }
      }
      const issued = { ...note, status: "issued" as const, journal_entry_id: draft.entry.id, taxable_amount: t.taxable, total_tax: tax, total_amount: total };
      ds = { ...ds, notes: ds.notes.map((n) => (n.id === id ? issued : n)) };
      save(req, ds);
      ctx.record("note.issued", `Issued ${label}`, { noteId: id, number: note.note_number, journalId: draft.entry.id, total });
      ledgerUpdated({ noteId: id, action });
      return { success: true, message: `${label} issued`, note: issued };
    }
    assertRole(ctx, "issueNote", "Cancelling a note (it reverses the note's journal)");
    if (note.status !== "issued") fail(`Only issued notes can be cancelled (Current status: ${note.status})`);
    const date = booksToday(ds);
    const reason = String(body.reason ?? "").trim();
    let reversal = "";
    if (note.journal_entry_id) {
      const r = reversePosted(ds, role, note.journal_entry_id, date, `Reversal due to cancellation of ${note.note_number}: ${reason}`);
      ds = r.ds;
      reversal = r.reversal.id;
    }
    ds = reverseDocument(ds, "sales_note", note.id, date, `Cancelled sales return ${note.note_number}`);
    const cancelled = { ...note, status: "cancelled" as const };
    ds = { ...ds, notes: ds.notes.map((n) => (n.id === id ? cancelled : n)) };
    save(req, ds);
    if (note.journal_entry_id) ctx.record("journal.reversed", `Cancelled note ${note.note_number}; its journal was reversed`, { journalId: note.journal_entry_id, number: `JRN-${note.note_type === "credit" ? "CN" : "DN"}-${note.note_number}`, reversalJournalId: reversal });
    ledgerUpdated({ noteId: id, action });
    return { success: true, message: `Note ${note.note_number} cancelled`, note: cancelled };
  }
  return undefined;
};
