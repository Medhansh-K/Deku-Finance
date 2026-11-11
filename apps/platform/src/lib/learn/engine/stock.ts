/**
 * Purchase bills (migration 24 + the stock trigger of migration 42), stock adjustments
 * (record_stock_adjustment), stock reports and warehouses.
 */
import type { PurchaseBill } from "@/lib/purchases/bills";
import type { DemoDataset, DemoPurchaseBillLine } from "../sample-data";
import { accountByCode, fail, newId, openPeriodFor, r2 } from "./books";
import { actor, ledgerUpdated, save, type Handler, type Req } from "./context";
import { addMovement, assertAvailable, defaultWarehouse, fifoMovements, stockLedger, stockSummary } from "./inventory";
import { insertDraft, postDraft } from "./journals";
import { assertRole, roleMay } from "./rbac";

const GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

/** stock_on_purchase_bill_linked: goods on the bill come in at the bill rate when it reaches the books. */
function stockIn(ds: DemoDataset, bill: PurchaseBill): DemoDataset {
  let next = ds;
  for (const l of ds.purchaseLines.filter((x) => x.bill_id === bill.id)) {
    const ci = ds.catalogue.find((c) => c.id === l.item_id);
    if (!ci?.track_inventory) continue;
    next = addMovement(next, {
      item_id: l.item_id,
      warehouse_id: defaultWarehouse(ds).id,
      movement_date: bill.bill_date,
      direction: "in",
      qty: l.quantity,
      unit_cost: l.rate,
      source_type: "purchase_bill",
      source_id: bill.id,
      narration: `Purchase bill ${bill.bill_number}`,
      reversal_of: null,
    }).ds;
  }
  return next;
}

export const stockHandler: Handler = (req: Req) => {
  const { sub, method, body, ctx, role, query } = req;
  let ds = req.ds;

  // ---- purchase bills ----
  if (sub === "/purchases") {
    if (method === "GET") {
      const from = query.get("from");
      const to = query.get("to");
      return { success: true, data: ds.purchases.filter((b) => (!from || b.bill_date >= from) && (!to || b.bill_date <= to)) };
    }
    if (method === "POST") {
      assertRole(ctx, "purchaseBill", "Recording a purchase bill");
      const gstin = String(body.supplier_gstin ?? "").trim().toUpperCase();
      const number = String(body.bill_number ?? "").trim() || fail("Enter the supplier's bill number");
      if (!String(body.supplier_name ?? "").trim()) fail("Enter the supplier name");
      if (gstin && !GSTIN.test(gstin)) fail("Supplier GSTIN is not valid");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(body.bill_date ?? "")) fail("Enter the bill date");
      if (ds.purchases.some((b) => b.supplier_gstin === gstin && b.bill_number === number)) fail(`Bill ${number} from ${gstin || "this supplier"} is already recorded`);
      if (body.itc_eligibility && body.itc_eligibility !== "eligible" && !String(body.blocked_reason ?? "").trim()) fail("Say why the ITC is blocked or ineligible");
      const amt = (k: string) => r2(Number(body[k] ?? 0));
      const total = r2(amt("taxable_amount") + amt("cgst") + amt("sgst") + amt("igst") + amt("cess"));
      if (Math.abs(total - amt("total_amount")) > 0.01) fail(`Bill total ${amt("total_amount")} doesn't equal taxable value plus taxes (${total})`);
      const id = newId(ds, "pb");
      const bill: PurchaseBill = {
        id,
        organisation_id: ds.org.id,
        party_id: body.party_id ?? null,
        supplier_name: String(body.supplier_name).trim(),
        supplier_gstin: gstin,
        bill_number: number,
        bill_date: body.bill_date,
        place_of_supply: body.place_of_supply ?? "",
        taxable_amount: amt("taxable_amount"),
        cgst: amt("cgst"),
        sgst: amt("sgst"),
        igst: amt("igst"),
        cess: amt("cess"),
        total_amount: total,
        itc_eligibility: body.itc_eligibility ?? "eligible",
        blocked_reason: body.itc_eligibility === "eligible" ? null : body.blocked_reason ?? null,
        journal_entry_id: null,
        created_at: new Date().toISOString(),
      };
      // Optional goods lines (purchase_bill_lines): item, quantity, rate. They move stock once the bill is in the books.
      const lines: DemoPurchaseBillLine[] = (Array.isArray(body.lines) ? body.lines : []).map((l: Record<string, unknown>) => {
        const q = Number(l.quantity), rate = Number(l.rate ?? l.unit_price);
        if (!ds.catalogue.some((c) => c.id === l.item_id)) fail("A bill line names an item that isn't in the catalogue");
        if (!(q > 0) || !(rate >= 0)) fail("Bill lines need a positive quantity and a rate");
        return { bill_id: id, item_id: String(l.item_id), quantity: q, rate };
      });
      ds = { ...ds, purchases: [bill, ...ds.purchases], purchaseLines: [...ds.purchaseLines, ...lines] };
      if (body.journal_entry_id) {
        if (!ds.journals.some((j) => j.id === body.journal_entry_id)) fail("Journal entry not found");
        const linked = { ...bill, journal_entry_id: String(body.journal_entry_id) };
        ds = stockIn({ ...ds, purchases: ds.purchases.map((b) => (b.id === id ? linked : b)) }, linked);
      }
      save(req, ds);
      ctx.record("purchase.created", `Recorded bill ${number} from ${bill.supplier_name}`, {
        purchaseId: id,
        number,
        total,
        itc: bill.itc_eligibility === "eligible" ? "eligible" : "blocked",
      });
      return { success: true, data: [ds.purchases.find((b) => b.id === id)] };
    }
  }

  const bill = sub.match(/^\/purchases\/([^/]+)$/);
  if (bill) {
    const b = ds.purchases.find((x) => x.id === bill[1]) ?? fail("Bill not found", 404);
    if (method === "PATCH") {
      assertRole(ctx, "purchaseBill", "Linking a bill to its voucher");
      const jeId = body.journal_entry_id;
      if (!jeId || Object.keys(body).some((k) => k !== "journal_entry_id")) fail("Only the bill's voucher link can be changed here");
      if (b.journal_entry_id) fail(`Bill ${b.bill_number} is already linked to a voucher`);
      if (!ds.journals.some((j) => j.id === jeId)) fail("Journal entry not found");
      const linked = { ...b, journal_entry_id: String(jeId) };
      ds = stockIn({ ...ds, purchases: ds.purchases.map((x) => (x.id === b.id ? linked : x)) }, linked);
      save(req, ds);
      ledgerUpdated({ purchaseId: b.id, act: "link" });
      return { success: true, data: [linked] };
    }
    if (method === "DELETE") {
      assertRole(ctx, "purchaseBill", "Deleting a purchase bill");
      // purchase_bills_delete: only bills not yet in the books.
      if (b.journal_entry_id) fail(`Bill ${b.bill_number} is in the books; reverse its voucher instead of deleting it`);
      save(req, { ...ds, purchases: ds.purchases.filter((x) => x.id !== b.id), purchaseLines: ds.purchaseLines.filter((l) => l.bill_id !== b.id) });
      return { success: true, data: [b] };
    }
  }

  // ---- inventory ----
  if (sub === "/inventory/summary" && method === "GET") return { success: true, data: stockSummary(ds, query.get("as_of")) };
  const ledger = sub.match(/^\/inventory\/items\/([^/]+)\/ledger$/);
  if (ledger && method === "GET") return { success: true, data: stockLedger(ds, ledger[1], query.get("from"), query.get("to")) };

  if (sub === "/inventory/adjustments" && method === "POST") {
    assertRole(ctx, "stockAdjust", "Recording a stock adjustment");
    const kind = body.kind, direction = body.direction;
    if (!["opening", "adjustment"].includes(kind) || !["in", "out"].includes(direction)) fail("kind must be opening or adjustment and direction in or out");
    if (kind === "opening" && direction !== "in") fail("Opening stock is always an inward movement");
    const qty = Math.round(Number(body.qty) * 1000) / 1000;
    if (!(qty > 0)) fail("Quantity must be positive");
    if (direction === "in" && !(body.unit_cost != null && Number(body.unit_cost) >= 0)) fail("A unit cost is required for inward stock");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date ?? "")) fail("A date is required");
    const item = ds.catalogue.find((c) => c.id === body.item_id) ?? fail("Item not found");
    if (!item.track_inventory) fail(`Turn on inventory tracking for ${item.name} first`);
    const wh = body.warehouse_id ? ds.warehouses.find((w) => w.id === body.warehouse_id) ?? fail("Warehouse not found") : defaultWarehouse(ds);
    if (!openPeriodFor(ds, body.date)) fail(`No open fiscal period covers ${body.date}`);
    const reason = String(body.reason ?? "").trim();
    const label = `${kind === "opening" ? "Opening" : "Adjustment"} stock ${kind === "adjustment" ? `${direction} ` : ""}${item.sku || item.name}${reason ? `: ${reason}` : ""}`;
    const mv = addMovement(ds, { item_id: item.id, warehouse_id: wh.id, movement_date: body.date, direction, qty, unit_cost: direction === "in" ? Number(body.unit_cost) : null, source_type: kind, source_id: null, narration: label, reversal_of: null });
    ds = mv.ds;
    if (direction === "out") assertAvailable(ds, [item.id], body.date);
    const value = fifoMovements(ds).find((r) => r.m.id === mv.movement.id)?.value ?? 0;
    let journalId: string | null = null;
    let status: string | null = null;
    if (value > 0) {
      const inv = accountByCode(ds, "1050") ?? fail("The chart of accounts is missing 1050 Inventory");
      const contra = accountByCode(ds, kind === "opening" ? "3030" : "5015") ?? fail("The chart of accounts is missing the stock contra account");
      const [dr, cr] = direction === "in" ? [inv, contra] : [contra, inv];
      const draft = insertDraft(ds, role, { entry_number: `STK-${mv.movement.id.slice(-12).toUpperCase()}`, entry_date: body.date, narration: label, reference: `stock:${mv.movement.id}` }, [
        { account_id: dr.id, party_id: null, description: label, debit: value, credit: 0 },
        { account_id: cr.id, party_id: null, description: label, debit: 0, credit: value },
      ]);
      ds = draft.ds;
      journalId = draft.entry.id;
      // Approvers post it at once; anyone else's adjustment waits for an approver.
      if (roleMay(role, "approveVoucher")) {
        ds = postDraft(ds, role, journalId, true).ds;
        status = "posted";
      } else {
        const who = actor(ds, role).id;
        ds = { ...ds, journals: ds.journals.map((j) => (j.id === journalId ? { ...j, submitted_at: new Date().toISOString(), submitted_by: who } : j)) };
        status = "pending_approval";
      }
    }
    save(req, ds);
    ctx.record("stock.adjusted", label, { itemId: item.id, warehouseId: wh.id, direction, quantity: qty, value });
    ledgerUpdated({ movementId: mv.movement.id, act: "stock" });
    return { success: true, data: { movement_id: mv.movement.id, value, journal_entry_id: journalId, journal_status: status } };
  }

  // ---- warehouses ----
  const whView = (w: DemoDataset["warehouses"][number]) => ({ id: w.id, name: w.name, code: w.code, is_default: w.is_default });
  if (sub === "/inventory/warehouses") {
    if (method === "GET") return { success: true, data: ds.warehouses.map(whView) };
    if (method === "POST") {
      assertRole(ctx, "warehouseWrite", "Adding a warehouse");
      const name = String(body.name ?? "").trim() || fail("Enter a warehouse name");
      const code = String(body.code ?? "").trim().toUpperCase() || fail("Enter a warehouse code");
      if (ds.warehouses.some((w) => w.code === code)) fail(`Warehouse code ${code} is already used`);
      const w = { id: newId(ds, "wh"), organisation_id: ds.org.id, name, code, is_default: !!body.is_default };
      const list = w.is_default ? ds.warehouses.map((x) => ({ ...x, is_default: false })) : ds.warehouses;
      save(req, { ...ds, warehouses: [...list, w] });
      return { success: true, data: [whView(w)] };
    }
  }
  const whOne = sub.match(/^\/inventory\/warehouses\/([^/]+)$/);
  if (whOne) {
    const w = ds.warehouses.find((x) => x.id === whOne[1]) ?? fail("Warehouse not found", 404);
    if (method === "PATCH") {
      assertRole(ctx, "warehouseWrite", "Changing a warehouse");
      if (w.is_default && body.is_default === false) fail("Make another warehouse the default instead of clearing the flag");
      const code = body.code != null ? String(body.code).trim().toUpperCase() : w.code;
      if (!code || ds.warehouses.some((x) => x.id !== w.id && x.code === code)) fail(`Warehouse code ${code} is already used`);
      const upd = { ...w, name: body.name != null ? String(body.name).trim() || w.name : w.name, code, is_default: body.is_default === true ? true : w.is_default };
      const list = ds.warehouses.map((x) => (x.id === w.id ? upd : upd.is_default && !w.is_default ? { ...x, is_default: false } : x));
      save(req, { ...ds, warehouses: list });
      return { success: true, data: [whView(upd)] };
    }
    if (method === "DELETE") {
      assertRole(ctx, "warehouseDelete", "Deleting a warehouse");
      if (w.is_default) fail("The default warehouse cannot be deleted; make another warehouse the default first");
      if (ds.stockMovements.some((m) => m.warehouse_id === w.id)) fail(`${w.name} has stock movements, so it can't be deleted`);
      save(req, { ...ds, warehouses: ds.warehouses.filter((x) => x.id !== w.id) });
      return { success: true, data: [whView(w)] };
    }
  }
  return undefined;
};
