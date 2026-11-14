/**
 * Company settings, masters (parties, catalogue, chart of accounts, fiscal periods), business
 * documents, marketplace settlements, document attachments, the activity log and notifications.
 */
import type { BusinessDocument } from "@/lib/builder/business-documents";
import type { Account, CatalogueItem, Party, SalesInvoice, SalesInvoiceLine } from "@/types/accounting";
import type { MarketplaceSettlement } from "@/api/endpoints";
import { buildDemoSubscription, getDemoPlanConfig } from "../demo-plans";
import type { DemoDataset } from "../sample-data";
import { accountByCode, booksToday, fail, newId, notInDemo, openPeriodFor, r2 } from "./books";
import { actor, ledgerUpdated, save, withAudit, type Body, type Handler, type Req } from "./context";
import { insertDraft, postDraft, submitDraft } from "./journals";
import { assertRole, roleMay } from "./rbac";

const GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

/** settings_body (backend/src/routes/organisations.rs): only these fields, each validated; blank text clears. */
const TEXT_FIELDS: [string, RegExp | null, boolean][] = [
  ["gstin", GSTIN, true],
  ["state_code", /^\d{2}$/, false],
  ["upi_vpa", /^[A-Za-z0-9._-]{2,256}@[A-Za-z]{2,64}$/, false],
  ["bank_account_number", /^\d{9,18}$/, false],
  ["bank_ifsc", /^[A-Z]{4}0[A-Z0-9]{6}$/, true],
  ["bank_beneficiary", /^.{1,200}$/, false],
  ["bank_name", /^.{1,200}$/, false],
  ["udyam_number", /^UDYAM-[A-Z]{2}-\d{2}-\d{7}$/, true],
];

function settingsPatch(body: Body) {
  const patch: Record<string, unknown> = {};
  const bad: string[] = [];
  for (const [k, re, upper] of TEXT_FIELDS) {
    if (!(k in body) || body[k] == null) continue;
    let v = String(body[k]).trim();
    if (k === "bank_account_number") v = v.replace(/ /g, "");
    if (upper) v = v.toUpperCase();
    if (!v) patch[k] = null;
    else if (!re || re.test(v)) patch[k] = v;
    else bad.push(k);
  }
  if (body.operating_mode != null) {
    if (["gst", "pure"].includes(String(body.operating_mode).trim())) patch.operating_mode = String(body.operating_mode).trim();
    else bad.push("operating_mode");
  }
  if (body.registered_address != null) {
    if (typeof body.registered_address === "object") patch.registered_address = body.registered_address;
    else bad.push("registered_address");
  }
  if (body.composition_scheme != null) {
    if (body.composition_scheme && patch.operating_mode === "pure") bad.push("composition_scheme");
    else patch.composition_scheme = !!body.composition_scheme;
  }
  if (body.require_journal_approval != null) patch.require_journal_approval = !!body.require_journal_approval;
  if (body.allow_negative_stock != null) patch.allow_negative_stock = !!body.allow_negative_stock;
  if (body.frozen_accounting_date !== undefined) patch.frozen_accounting_date = body.frozen_accounting_date ? String(body.frozen_accounting_date) : null;
  if (body.onboarded === true) patch.onboarded_at = new Date().toISOString();
  if (bad.length) fail(`Invalid fields: ${bad.join(", ")}`);
  if (!Object.keys(patch).length) fail("Nothing to update");
  return patch;
}

/** Notifications the database would generate (generate_notifications, migration 34) from the books. */
function notifications(ds: DemoDataset, role: string) {
  const today = booksToday(ds);
  const items: { id: string; kind: string; title: string; body: string; link: string; created_at: string }[] = [];
  if (roleMay(role as never, "approveVoucher"))
    for (const j of ds.journals.filter((x) => x.status === "draft" && x.submitted_at))
      items.push({ id: `approval-${j.id}`, kind: "approval_waiting", title: `Voucher ${j.entry_number} is waiting for approval`, body: j.narration, link: "/approvals", created_at: j.submitted_at! });
  for (const inv of ds.invoices.filter((i) => i.status === "issued" && i.due_date < today)) {
    const paid = ds.journals.some((j) => j.status === "posted" && j.journal_entry_lines.some((l) => l.party_id === inv.customer_id && l.credit > 0 && j.entry_date >= inv.invoice_date));
    if (!paid) items.push({ id: `overdue-${inv.id}`, kind: "invoice_overdue", title: `${inv.invoice_number} is overdue`, body: `Due ${inv.due_date} from ${inv.parties?.legal_name ?? "the customer"}`, link: "/collect", created_at: `${inv.due_date}T09:00:00.000Z` });
  }
  return items.map((n) => ({ ...n, payload: {}, read_at: ds.readNotifications.includes(n.id) ? n.created_at : null })).sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/** save_business_document: totals from the lines, header fields from the payload. */
function docFromPayload(ds: DemoDataset, body: Body, base?: BusinessDocument): BusinessDocument {
  const doc = body.doc ?? {};
  const lines = (Array.isArray(body.lines) ? body.lines : []) as Body[];
  if (!lines.length) fail("Add at least one line");
  const s = (k: string) => r2(lines.reduce((t, l) => t + Number(l[k] ?? 0), 0));
  const tax = r2(s("cgst_amount") + s("sgst_amount") + s("igst_amount") + s("cess_amount"));
  const number = String(doc.doc_number ?? "").trim() || fail("Enter a document number");
  if (ds.businessDocuments.some((d) => d.id !== base?.id && d.doc_type === doc.doc_type && d.doc_number === number)) fail(`${number} is already used`);
  const party = ds.parties.find((p) => p.id === doc.party_id);
  return {
    ...(base ?? { id: newId(ds, "doc"), organisation_id: ds.org.id, status: "draft", converted_to_type: null, converted_to_id: null, linked_invoice_id: null, created_at: new Date().toISOString() }),
    doc_type: doc.doc_type,
    doc_number: number,
    doc_date: doc.doc_date,
    valid_until: doc.valid_until ?? null,
    due_date: doc.due_date ?? null,
    party_id: doc.party_id ?? null,
    party_snapshot: doc.party_snapshot ?? {},
    place_of_supply: doc.place_of_supply ?? null,
    supply_type: doc.supply_type ?? "intra_state",
    taxable_amount: s("taxable_amount"),
    cgst_amount: s("cgst_amount"),
    sgst_amount: s("sgst_amount"),
    igst_amount: s("igst_amount"),
    cess_amount: s("cess_amount"),
    total_tax: tax,
    round_off: Number(doc.round_off ?? 0),
    total_amount: r2(s("taxable_amount") + tax + Number(doc.round_off ?? 0)),
    notes: doc.notes ?? null,
    terms: doc.terms ?? null,
    details: doc.details ?? {},
    parties: party ? { legal_name: party.legal_name, gstin: party.gstin ?? null } : null,
    business_document_lines: lines as never,
  } as BusinessDocument;
}

const DOC_FLOW: Record<string, string[]> = { draft: ["sent", "cancelled", "converted"], sent: ["accepted", "rejected", "cancelled", "converted"], accepted: ["cancelled", "converted"] };

export const adminHandler: Handler = (req: Req) => {
  const { sub, method, body, ctx, role, query, plan } = req;
  let ds = req.ds;

  if (sub === "" && method === "GET") return { success: true, data: [ds.org] };
  if (sub === "/settings" && method === "PATCH") {
    assertRole(ctx, "settings", "Changing company settings");
    const patch = settingsPatch(body);
    if (patch.gstin && (patch.state_code ?? ds.org.state_code) && String(patch.gstin).slice(0, 2) !== String(patch.state_code ?? ds.org.state_code))
      fail("The GSTIN's first two digits must match the company's state code");
    const org = { ...ds.org, ...patch };
    save(req, withAudit({ ...ds, org }, role, "SETTING", "Company Settings Updated", `Updated ${Object.keys(patch).join(", ")}`, "organisation", ds.org.id, patch));
    ctx.record("settings.updated", `Updated company settings`, { fields: Object.keys(patch).join(",") });
    return { success: true, data: [org] };
  }
  if (sub === "/subscription" && method === "GET") {
    const month = new Date().toISOString().slice(0, 7);
    const now = new Date().toISOString();
    return {
      success: true,
      data: buildDemoSubscription(plan, {
        invoices_this_month: ds.invoices.filter((i) => ((i as { issued_at?: string }).issued_at ?? "").startsWith(month)).length,
        seats_used: ds.members.length + ds.invitations.filter((i) => i.status === "pending" && i.expires_at > now).length,
      }),
    };
  }

  // ---- fiscal periods ----
  if (sub === "/fiscal-periods") {
    if (method === "GET") return { success: true, data: [...ds.fiscalPeriods].sort((a, b) => b.start_date.localeCompare(a.start_date)) };
    if (method === "POST") {
      assertRole(ctx, "createDraft", "Adding a fiscal period");
      const { name, start_date, end_date } = body;
      if (!name || !/^\d{4}-\d{2}-\d{2}$/.test(start_date ?? "") || !/^\d{4}-\d{2}-\d{2}$/.test(end_date ?? "") || end_date < start_date) fail("Enter a name and a valid start and end date");
      if (ds.fiscalPeriods.some((p) => p.start_date <= end_date && start_date <= p.end_date)) fail("This fiscal period overlaps an existing one");
      const fp = { id: newId(ds, "fp"), organisation_id: ds.org.id, name, start_date, end_date, status: "open" as const };
      save(req, { ...ds, fiscalPeriods: [...ds.fiscalPeriods, fp] });
      ctx.record("settings.updated", `Added fiscal period ${name}`, { fields: "fiscal_period" });
      return { success: true, data: [fp] };
    }
  }

  // ---- parties ----
  if (sub === "/parties") {
    if (method === "GET") return { success: true, data: ds.parties };
    if (method === "POST") {
      assertRole(ctx, "masters", "Adding a party");
      const legal = String(body.legal_name ?? "").trim() || fail("Enter the party's legal name");
      const gstin = body.gstin ? String(body.gstin).trim().toUpperCase() : null;
      if (gstin && !GSTIN.test(gstin)) fail("That GSTIN is not valid");
      const type = ["customer", "vendor", "both"].includes(body.type) ? body.type : "customer";
      const p: Party = { id: newId(ds, "party"), organisation_id: ds.org.id, type, legal_name: legal, display_name: String(body.display_name || legal), gstin, email: body.email ?? null, phone: body.phone ?? null, billing_address: body.billing_address ?? null, is_active: true };
      save(req, { ...ds, parties: [p, ...ds.parties] });
      ctx.record("party.created", `Added ${type} ${legal}`, { partyId: p.id, name: legal, kind: type === "vendor" ? "vendor" : "customer" });
      return { success: true, data: [p] };
    }
  }
  const party = sub.match(/^\/parties\/([^/]+)$/);
  if (party && method === "GET") return { success: true, data: ds.parties.filter((p) => p.id === party[1]) };

  // ---- catalogue ----
  if (sub === "/catalogue") {
    if (method === "GET") return { success: true, data: ds.catalogue };
    if (method === "POST") {
      assertRole(ctx, "masters", "Adding a catalogue item");
      const limit = getDemoPlanConfig(plan).catalogueItemsLimit;
      if (limit !== null && ds.catalogue.length >= limit) {
        const msg = `The GO plan limits the catalogue to ${limit} items. Switch to PRO in the demo bar for unlimited items.`;
        ctx.notifyAction("GO plan limit", msg, "warning");
        fail(msg, 402, "plan_limit");
      }
      const name = String(body.name ?? "").trim() || fail("Enter the item name");
      const type = body.type === "services" ? "services" : "goods";
      if (body.track_inventory && type !== "goods") fail("Only goods can track inventory");
      const item: CatalogueItem = {
        id: newId(ds, "item"),
        organisation_id: ds.org.id,
        type,
        name,
        sku: body.sku || null,
        description: body.description ?? null,
        hsn_sac_code: body.hsn_sac_code ?? null,
        unit_code: body.unit_code || "NOS",
        default_unit_price: Number(body.default_unit_price ?? 0),
        default_gst_rate: Number(body.default_gst_rate ?? 0),
        is_taxable: body.is_taxable ?? true,
        track_inventory: !!body.track_inventory,
        is_active: true,
      } as CatalogueItem;
      save(req, { ...ds, catalogue: [item, ...ds.catalogue] });
      ctx.record("item.created", `Added ${name}`, { itemId: item.id, name });
      return { success: true, data: [item] };
    }
  }
  const cat = sub.match(/^\/catalogue\/([^/]+)$/);
  if (cat && method === "PATCH") {
    assertRole(ctx, "masters", "Changing a catalogue item");
    const item = ds.catalogue.find((c) => c.id === cat[1]) ?? fail("Item not found", 404);
    if (Object.keys(body).some((k) => k !== "track_inventory")) fail("Only inventory tracking can be changed from this screen");
    if (body.track_inventory && item.type !== "goods") fail("Only goods can track inventory");
    const upd = { ...item, track_inventory: !!body.track_inventory };
    save(req, { ...ds, catalogue: ds.catalogue.map((c) => (c.id === item.id ? upd : c)) });
    return { success: true, data: [upd] };
  }

  // ---- chart of accounts ----
  if (sub === "/accounts") {
    if (method === "GET") return { success: true, data: [...ds.accounts].sort((a, b) => a.code.localeCompare(b.code)) };
    if (method === "POST") {
      assertRole(ctx, "accounts", "Adding an account");
      const grp = String(body.account_group ?? "").trim().toLowerCase();
      const type = ({ revenue: "income", income: "income", asset: "asset", liability: "liability", equity: "equity", expense: "expense" } as Record<string, Account["type"]>)[grp];
      if (!type) fail("Invalid account group. Must be asset, liability, equity, revenue, or expense");
      const code = String(body.code ?? "").trim() || fail("Enter an account code");
      if (accountByCode(ds, code)) fail(`Account code ${code} is already used`);
      const name = String(body.name ?? "").trim() || fail("Enter an account name");
      const acc: Account = {
        id: newId(ds, "acc"),
        organisation_id: ds.org.id,
        code,
        name,
        type,
        account_group: (grp === "income" ? "revenue" : grp) as Account["account_group"],
        ledger: String(body.ledger || "").trim() || "General Ledger",
        sub_ledger: String(body.sub_ledger || "").trim() || "General Sub-Ledger",
        label: String(body.label || "").trim() || name,
        is_postable: body.is_postable ?? true,
        is_active: true,
        is_system: false,
      };
      save(req, { ...ds, accounts: [...ds.accounts, acc] });
      ctx.record("account.created", `Added account ${code} ${name}`, { accountId: acc.id, code, name });
      return { success: true, data: [acc] };
    }
  }
  if (sub === "/accounts/seed" && method === "POST") {
    assertRole(ctx, "accounts", "Seeding the chart of accounts");
    return { success: true, message: "The default chart of accounts is already in place; nothing changed" };
  }
  const acc = sub.match(/^\/accounts\/([^/]+)$/);
  if (acc && (method === "PATCH" || method === "DELETE")) {
    assertRole(ctx, "accounts", method === "PATCH" ? "Changing an account" : "Deleting an account");
    const a = ds.accounts.find((x) => x.id === acc[1]) ?? fail("Account not found", 404);
    if (method === "PATCH") {
      const allowed = ["is_active", "name", "label", "description"];
      if (Object.keys(body).some((k) => !allowed.includes(k))) fail("Only the name, label, description and active flag can be changed");
      const upd = { ...a, ...body };
      save(req, { ...ds, accounts: ds.accounts.map((x) => (x.id === a.id ? upd : x)) });
      return { success: true, data: [upd] };
    }
    if (a.is_system) fail("System accounts cannot be removed or deleted.");
    if (ds.journals.some((j) => j.journal_entry_lines.some((l) => l.account_id === a.id)))
      fail("Cannot delete account because it has recorded journal transactions. Deactivate the account instead to retain audit history.");
    save(req, { ...ds, accounts: ds.accounts.filter((x) => x.id !== a.id) });
    return { success: true, message: "Account removed successfully", data: [a] };
  }

  // ---- business documents (migration 44) ----
  if (sub === "/business-documents") {
    if (method === "GET") {
      const t = query.get("doc_type"), st = query.get("status");
      return { success: true, data: ds.businessDocuments.filter((d) => (!t || d.doc_type === t) && (!st || d.status === st)) };
    }
    if (method === "POST") {
      assertRole(ctx, "businessDocs", "Saving a business document");
      const doc = docFromPayload(ds, body);
      save(req, { ...ds, businessDocuments: [doc, ...ds.businessDocuments] });
      return { success: true, data: doc };
    }
  }
  const bd = sub.match(/^\/business-documents\/([^/]+)(\/status|\/convert)?$/);
  if (bd) {
    const d = ds.businessDocuments.find((x) => x.id === bd[1]) ?? fail("Document not found", 404);
    if (!bd[2] && method === "GET") return { success: true, data: [d] };
    if (!bd[2] && method === "PUT") {
      assertRole(ctx, "businessDocs", "Editing a business document");
      if (["converted", "cancelled"].includes(d.status)) fail(`A ${d.status} document can't be edited`);
      const upd = docFromPayload(ds, body, d);
      save(req, { ...ds, businessDocuments: ds.businessDocuments.map((x) => (x.id === d.id ? upd : x)) });
      return { success: true, data: upd };
    }
    if (!bd[2] && method === "DELETE") {
      assertRole(ctx, "businessDocsDelete", "Deleting a business document");
      if (d.status !== "draft") fail("Only draft documents can be deleted; cancel it instead");
      save(req, { ...ds, businessDocuments: ds.businessDocuments.filter((x) => x.id !== d.id) });
      return { success: true, data: [d] };
    }
    if (bd[2] === "/status" && method === "POST") {
      assertRole(ctx, "businessDocs", "Changing a document's status");
      if (body.status === "converted" || !(DOC_FLOW[d.status] ?? []).includes(body.status)) fail(`A ${d.status} document can't become ${body.status}`);
      const upd = { ...d, status: body.status };
      save(req, { ...ds, businessDocuments: ds.businessDocuments.map((x) => (x.id === d.id ? upd : x)) });
      return { success: true, data: [upd] };
    }
    if (bd[2] === "/convert" && method === "POST") {
      assertRole(ctx, "createInvoice", "Converting a document to an invoice");
      if (d.status === "converted") fail(`Document ${d.doc_number} is already converted`);
      if (["rejected", "cancelled"].includes(d.status)) fail(`A ${d.status} document cannot be converted`);
      if (d.doc_type === "delivery_challan") fail("Delivery challans are dispatch records and do not convert; link the invoice to the challan instead");
      if (d.doc_type === "purchase_order") fail("Purchase orders do not convert: record the supplier's bill in Purchases when it arrives");
      const customer = ds.parties.find((p) => p.id === d.party_id) ?? fail(`Choose a customer from Parties before converting ${d.doc_number}`);
      if (!d.place_of_supply) fail(`Set the place of supply before converting ${d.doc_number}`);
      const number = String(body.invoice_number ?? "").trim() || fail("Enter the invoice number to use");
      if (ds.invoices.some((i) => i.invoice_number === number)) fail(`Invoice number ${number} is already used`);
      const lines = (d.business_document_lines ?? []) as unknown as SalesInvoiceLine[];
      if (!lines.length) fail(`Document ${d.doc_number} has no lines`);
      const id = newId(ds, "inv");
      const today = booksToday(ds);
      const inv: SalesInvoice = {
        id, organisation_id: ds.org.id, customer_id: customer.id, invoice_number: number, invoice_date: today, due_date: d.due_date ?? today, status: "draft",
        supply_type: d.supply_type, place_of_supply: d.place_of_supply, sales_channel: "direct", invoice_type: "tax_invoice",
        taxable_amount: d.taxable_amount, cgst_amount: d.cgst_amount, sgst_amount: d.sgst_amount, igst_amount: d.igst_amount, cess_amount: d.cess_amount,
        round_off: d.round_off, total_amount: d.total_amount, journal_entry_id: null, created_at: new Date().toISOString(),
        parties: { legal_name: customer.legal_name, gstin: customer.gstin }, sales_invoice_lines: lines.map((l, i) => ({ ...l, invoice_id: id, line_number: i + 1 })),
      };
      const upd = { ...d, status: "converted" as const, converted_to_type: "sales_invoice" as const, converted_to_id: id };
      save(req, { ...ds, invoices: [inv, ...ds.invoices], businessDocuments: ds.businessDocuments.map((x) => (x.id === d.id ? upd : x)) });
      ctx.record("invoice.created", `Converted ${d.doc_number} into draft invoice ${number}`, { invoiceId: id, number, total: inv.total_amount });
      return { success: true, data: upd };
    }
  }

  // ---- marketplace settlements (migration 35) ----
  if (sub === "/marketplace/settlements") {
    if (method === "GET")
      return {
        success: true,
        data: ds.marketplaceSettlements.map((m) => {
          const j = ds.journals.find((x) => x.id === m.journal_entry_id);
          return { ...m, journal_entries: j ? { entry_number: j.entry_number, status: j.status, submitted_at: j.submitted_at ?? null } : null };
        }),
      };
    if (method === "POST") {
      assertRole(ctx, "purchaseBill", "Importing a marketplace settlement");
      const s = body.settlement ?? {};
      const lines = (Array.isArray(body.lines) ? body.lines : []) as Body[];
      if (!lines.length) fail("A settlement needs at least one line");
      const keys = ["gross_sales", "refunds", "commission", "other_fees", "gst_on_fees", "tcs_amount", "tds_amount"] as const;
      const bad = keys
        .map((k) => [k, r2(lines.filter((l) => l.line_type === k).reduce((t, l) => t + Number(l.amount || 0), 0)), r2(Number(s[k] ?? 0))] as const)
        .filter(([, l, h]) => l !== h);
      if (bad.length) fail(`Settlement lines do not add up to the totals: ${bad.map(([k, l, h]) => `${k} lines ${l} vs header ${h}`).join("; ")}`);
      const ref = String(s.settlement_ref ?? "").trim() || fail("The settlement needs a reference");
      if (ds.marketplaceSettlements.some((m) => m.channel === s.channel && m.settlement_ref === ref)) fail(`Settlement ${ref} is already imported`);
      const row: MarketplaceSettlement = {
        id: newId(ds, "ms"), channel: s.channel, settlement_ref: ref, period_from: s.period_from, period_to: s.period_to,
        ...Object.fromEntries(keys.map((k) => [k, r2(Number(s[k] ?? 0))])), fee_gst_split: s.fee_gst_split ?? "igst",
        net_payout: r2(Number(s.net_payout ?? 0)), journal_entry_id: null, source_filename: s.source_filename ?? null, created_at: new Date().toISOString(),
      } as MarketplaceSettlement;
      save(req, { ...ds, marketplaceSettlements: [row, ...ds.marketplaceSettlements] });
      return { success: true, data: row };
    }
  }
  const ms = sub.match(/^\/marketplace\/settlements\/([^/]+)(\/post)?$/);
  if (ms) {
    const m = ds.marketplaceSettlements.find((x) => x.id === ms[1]) ?? fail("Settlement not found", 404);
    if (ms[2] && method === "POST") {
      assertRole(ctx, "purchaseBill", "Posting a marketplace settlement");
      if (m.journal_entry_id) fail(`Settlement ${m.settlement_ref} already has a voucher`);
      if (!openPeriodFor(ds, m.period_to)) fail(`No open fiscal period covers the settlement date ${m.period_to}`);
      const need = (code: string) => accountByCode(ds, code)?.id ?? fail(`Missing accounts for marketplace settlement: ${code}. Add it to the chart of accounts.`);
      const bank = body.bank_account_id ? ds.accounts.find((a) => a.id === body.bank_account_id && a.account_group === "asset" && a.is_postable)?.id ?? fail("The chosen bank account is not a postable asset account of this company") : need("1020");
      const half = r2(m.gst_on_fees / 2);
      const raw: [string, string, number][] = [
        [bank, "Net payout", m.net_payout],
        [need("5091"), "Marketplace commission", m.commission],
        [need("5091"), "Marketplace fees", m.other_fees],
        [need("1083"), "IGST on marketplace fees", m.fee_gst_split === "igst" ? m.gst_on_fees : 0],
        [need("1081"), "CGST on marketplace fees", m.fee_gst_split === "cgst_sgst" ? half : 0],
        [need("1082"), "SGST on marketplace fees", m.fee_gst_split === "cgst_sgst" ? r2(m.gst_on_fees - half) : 0],
        [need("1084"), "GST TCS u/s 52", m.tcs_amount],
        [need("1085"), "TDS u/s 194-O", m.tds_amount],
        [need("1040"), "Sales less refunds", -r2(m.gross_sales - m.refunds)],
      ];
      const draft = insertDraft(ds, role, { entry_number: `MKT-${m.channel.toUpperCase()}-${m.settlement_ref}`, entry_date: m.period_to, narration: `${m.channel[0].toUpperCase()}${m.channel.slice(1)} settlement ${m.settlement_ref} (${m.period_from} to ${m.period_to})`, reference: m.settlement_ref },
        raw.filter(([, , v]) => v !== 0).map(([account_id, description, v]) => ({ account_id, party_id: null, description, debit: Math.max(v, 0), credit: Math.max(-v, 0) })));
      ds = { ...draft.ds, marketplaceSettlements: draft.ds.marketplaceSettlements.map((x) => (x.id === m.id ? { ...x, journal_entry_id: draft.entry.id } : x)) };
      let entry = draft.entry;
      if (ds.org.require_journal_approval) ({ ds, entry } = submitDraft(ds, role, entry.id));
      else if (roleMay(role, "approveVoucher")) ({ ds, entry } = postDraft(ds, role, entry.id, true));
      save(req, ds);
      ctx.record("marketplace.settlement_posted", `Booked settlement ${m.settlement_ref} as ${entry.entry_number}`, { settlementId: m.id, journalId: entry.id });
      ledgerUpdated({ settlementId: m.id, act: "post" });
      return { success: true, entry };
    }
    if (!ms[2] && method === "DELETE") {
      assertRole(ctx, "purchaseBill", "Deleting a marketplace settlement");
      if (m.journal_entry_id) fail(`Settlement ${m.settlement_ref} is in the books; reverse its voucher instead`);
      save(req, { ...ds, marketplaceSettlements: ds.marketplaceSettlements.filter((x) => x.id !== m.id) });
      return { success: true, data: [m] };
    }
  }
  if (sub === "/marketplace/column-maps" && method === "GET") return { success: true, data: ds.marketplaceColumnMaps };
  const cm = sub.match(/^\/marketplace\/column-maps\/([^/]+)$/);
  if (cm && method === "PUT") {
    assertRole(ctx, "purchaseBill", "Saving a column map");
    const row = { channel: cm[1], mapping: body.mapping, deductions_negative: !!body.deductions_negative };
    save(req, { ...ds, marketplaceColumnMaps: [...ds.marketplaceColumnMaps.filter((x) => x.channel !== cm[1]), row] });
    return { success: true, data: [row] };
  }

  // ---- attachments: only the name, size and link are kept; the file stays on the visitor's device ----
  if (sub === "/files") {
    if (method === "GET") return { success: true, data: ds.files };
    if (method === "POST") {
      assertRole(ctx, "files", "Attaching a document");
      const filename = query.get("filename") || "document";
      const jeId = query.get("journal_entry_id");
      if (jeId && !ds.journals.some((j) => j.id === jeId)) fail("Journal entry not found");
      const blob = req.raw as { size?: number; type?: string } | null;
      if ((blob?.size ?? 0) > 10 * 1024 * 1024) fail("That file is over the 10 MB limit");
      const file = { id: newId(ds, "file"), journal_entry_id: jeId, filename, content_type: blob?.type || "application/octet-stream", byte_size: blob?.size ?? 0, category: query.get("category"), reference: query.get("reference"), created_at: new Date().toISOString() };
      save(req, withAudit({ ...ds, files: [file, ...ds.files] }, role, "DOCUMENT", "Document Attached", `Attached ${filename}`, "document_file", file.id, { journal_entry_id: jeId, byte_size: file.byte_size }));
      ctx.record("document.attached", `Attached ${filename}`, { journalId: jeId ?? "", fileName: filename });
      return { success: true, simulated: true, message: "Only the file's name and size are kept in this demo; the file itself was not uploaded anywhere.", data: file };
    }
  }

  // ---- activity log ----
  if (sub === "/audit-events") {
    if (method === "GET") return { success: true, data: ds.auditEvents.slice(0, Number(query.get("limit") || 100)) };
    if (method === "POST") {
      const cat = ["VOUCHER", "MASTER", "DOCUMENT", "DEPARTMENT", "REPORT", "SETTING", "SECURITY"].includes(body.category) ? body.category : "MASTER";
      const who = actor(ds, role);
      const next = withAudit(ds, role, cat, String(body.action ?? "Activity"), String(body.description ?? ""), body.entity_type || "general", body.entity_id || "-", { ...(body.metadata ?? {}), actor_name: body.actor_name ?? who.name }, body.status ?? "success");
      save(req, next);
      return { success: true, data: [next.auditEvents[0]] };
    }
  }
  if (sub === "/audit-events/export" && method === "GET") {
    const rows = ds.auditEvents;
    if (query.get("format") === "csv") {
      const cols = ["created_at", "actor_name", "actor_role", "category", "action", "description", "entity_type", "entity_id", "status"] as const;
      const q = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      return [cols.join(","), ...rows.map((r) => cols.map((c) => q(r[c])).join(","))].join("\n");
    }
    return rows;
  }

  // ---- notifications ----
  if (sub === "/notifications" && method === "GET") return { success: true, data: notifications(ds, role) };
  if (sub === "/notifications/read" && method === "POST") {
    const ids = (Array.isArray(body.ids) ? body.ids : []).map(String);
    save(req, { ...ds, readNotifications: [...new Set([...ds.readNotifications, ...ids])] });
    return { success: true, data: { marked: ids.length } };
  }

  if (sub === "/imports" && method === "GET") return { success: true, data: [] };
  if (sub.startsWith("/imports")) notInDemo("Importing Tally or CSV files", "the demo books start from fixed sample data; try the import on your own company");
  if (sub.startsWith("/documents") && method !== "GET") notInDemo("Document extraction and proposals", "no screen in the demo uses them");
  return undefined;
};
