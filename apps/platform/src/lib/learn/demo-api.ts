import { ApiError, type RequestOptions } from "@/api/client";
import { buildGstr1, buildGstr3b } from "@/lib/gst/returns";
import type { OrgRole } from "@/modules/departments-members/team";
import type {
  Account,
  AccountBalanceRow,
  BalanceSheetRow,
  GeneralLedgerRow,
  JournalEntry,
  Party,
  ProfitLossRow,
  SalesInvoiceLine,
} from "@/types/accounting";
import type { PartyAgeingRow } from "@/lib/reports/ledger";
import { buildDemoSubscription, getDemoPlanConfig, type DemoPlanId } from "./demo-plans";
import { canDemoRolePerform, getDemoRoleConfig } from "./demo-roles";
import type { DemoDataset } from "./sample-data";

export interface DemoApiRuntimeContext {
  getDataset: () => DemoDataset;
  updateDataset: (updater: (prev: DemoDataset) => DemoDataset) => void;
  getRole: () => OrgRole;
  getPlan: () => DemoPlanId;
  notifyAction: (title: string, body: string, tone?: "info" | "warning" | "blocked") => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DemoJsonPayload = Record<string, any>;

function parseBody(options?: RequestOptions): DemoJsonPayload {
  if (!options?.body || typeof options.body !== "string") return {};
  try {
    return JSON.parse(options.body) as DemoJsonPayload;
  } catch {
    return {};
  }
}

function computeBalances(dataset: DemoDataset): Map<string, { debit: number; credit: number }> {
  const map = new Map<string, { debit: number; credit: number }>();
  for (const a of dataset.accounts) map.set(a.id, { debit: 0, credit: 0 });
  for (const j of dataset.journals) {
    if (j.status !== "posted") continue;
    for (const l of j.journal_entry_lines) {
      const cur = map.get(l.account_id) ?? { debit: 0, credit: 0 };
      cur.debit += Number(l.debit || 0);
      cur.credit += Number(l.credit || 0);
      map.set(l.account_id, cur);
    }
  }
  return map;
}

function buildAccountBalanceRows(dataset: DemoDataset): AccountBalanceRow[] {
  const bal = computeBalances(dataset);
  return dataset.accounts.map((a) => {
    const b = bal.get(a.id) ?? { debit: 0, credit: 0 };
    const debitSide = a.type === "asset" || a.type === "expense";
    const natural = debitSide ? b.debit - b.credit : b.credit - b.debit;
    return {
      organisation_id: dataset.org.id,
      account_id: a.id,
      account_code: a.code,
      account_name: a.name,
      account_type: a.type,
      account_group: a.account_group,
      ledger: a.ledger,
      sub_ledger: a.sub_ledger,
      label: a.label,
      is_active: a.is_active,
      total_debit: b.debit,
      total_credit: b.credit,
      natural_balance: natural,
    };
  });
}

function buildPartyAgeing(dataset: DemoDataset, side: "receivable" | "payable"): PartyAgeingRow[] {
  const controlCode = side === "receivable" ? "1030" : "2010";
  const controlAcc = dataset.accounts.find((a) => a.code === controlCode);
  if (!controlAcc) return [];
  const partyType = side === "receivable" ? "customer" : "vendor";
  const relevantParties = dataset.parties.filter((p) => p.type === partyType);

  return relevantParties
    .map((party: Party): PartyAgeingRow | null => {
      let totalDebit = 0;
      let totalCredit = 0;
      const openItems: PartyAgeingRow["open_items"] = [];
      for (const j of dataset.journals) {
        if (j.status !== "posted") continue;
        for (const l of j.journal_entry_lines) {
          if (l.account_id !== controlAcc.id || l.party_id !== party.id) continue;
          totalDebit += Number(l.debit || 0);
          totalCredit += Number(l.credit || 0);
          const isDebitDoc = side === "receivable" ? l.debit > 0 : l.credit > 0;
          if (isDebitDoc) {
            const amt = side === "receivable" ? l.debit : l.credit;
            const invMatch = dataset.invoices.find((inv) => inv.customer_id === party.id && inv.status !== "paid");
            openItems.push({
              entry_id: j.id,
              entry_number: j.entry_number,
              reference: j.reference ?? null,
              date: j.entry_date,
              amount: amt,
              open: Math.max(0, side === "receivable" ? totalDebit - totalCredit : totalCredit - totalDebit),
              age_days: 49,
              invoice_id: invMatch?.id ?? null,
              invoice_number: invMatch?.invoice_number ?? null,
              due_date: invMatch?.due_date ?? null,
            });
          }
        }
      }
      const net = side === "receivable" ? totalDebit - totalCredit : totalCredit - totalDebit;
      const positiveBal = Math.max(0, net);
      const advance = net < 0 ? Math.abs(net) : 0;
      if (positiveBal === 0 && advance === 0) return null;
      return {
        party_id: party.id,
        party_name: party.legal_name,
        gstin: party.gstin ?? null,
        billing_address: party.billing_address ?? null,
        balance: positiveBal,
        advance,
        oldest_age_days: positiveBal > 0 ? 49 : null,
        d0_30: 0,
        d31_60: positiveBal,
        d61_90: 0,
        d90_plus: 0,
        open_items: positiveBal > 0 ? openItems : [],
      } satisfies PartyAgeingRow;
    })
    .filter((r): r is PartyAgeingRow => r !== null);
}

function assertRoleAllowed(ctx: DemoApiRuntimeContext, action: Parameters<typeof canDemoRolePerform>[1], label: string) {
  const res = canDemoRolePerform(ctx.getRole(), action);
  if (!res.allowed) {
    ctx.notifyAction(`Blocked in ${getDemoRoleConfig(ctx.getRole()).label} Role`, res.reason, "blocked");
    throw new ApiError(res.reason, 403, { code: "permission_denied", action, label });
  }
}

export async function dispatchDemoApi(
  ctx: DemoApiRuntimeContext,
  rawPath: string,
  options: RequestOptions = {}
): Promise<unknown> {
  const method = (options.method || "GET").toUpperCase();
  const [pathname, queryStr = ""] = rawPath.split("?");
  const query = new URLSearchParams(queryStr);
  const dataset = ctx.getDataset();
  const orgId = dataset.org.id;
  const planId = ctx.getPlan();
  const plan = getDemoPlanConfig(planId);
  const role = ctx.getRole();
  const roleCfg = getDemoRoleConfig(role);

  if (pathname === "/health") {
    return { engine: "deku-demo-runtime", service: "learn-demo", status: "ok", version: "learn-public" };
  }

  if (pathname === "/api/v1/hsn") {
    const q = (query.get("q") || "").toLowerCase();
    const list = [
      { code: "853620", description: "Electrical apparatus / circuit breakers", gst_rate: 18, type: "goods" },
      { code: "854460", description: "Insulated electric conductors & cables", gst_rate: 18, type: "goods" },
      { code: "998313", description: "IT consulting & cloud support services", gst_rate: 18, type: "services" },
      { code: "998314", description: "IT design & compliance advisory services", gst_rate: 18, type: "services" },
      { code: "691200", description: "Ceramic tableware & kitchenware", gst_rate: 12, type: "goods" },
      { code: "150910", description: "Olive oil & edible specialty oils", gst_rate: 18, type: "goods" },
    ].filter((h) => !q || h.code.includes(q) || h.description.toLowerCase().includes(q));
    return { success: true, data: list, loaded: true };
  }

  if (pathname === "/api/v1/organisations") {
    return { success: true, data: [dataset.org] };
  }

  // Accept any orgId matching active dataset or fallback cleanly
  const subPathMatch = pathname.match(/^\/api\/v1\/organisations\/([^/]+)(\/.*)?$/);
  if (!subPathMatch) {
    return { success: true, data: [] };
  }
  const sub = subPathMatch[2] || "";

  if (sub === "") {
    return { success: true, data: [dataset.org] };
  }

  if (sub === "/settings" && method === "PATCH") {
    assertRoleAllowed(ctx, "edit_settings", "Company Settings");
    const patch = parseBody(options);
    ctx.updateDataset((prev) => ({
      ...prev,
      org: { ...prev.org, ...patch },
    }));
    ctx.notifyAction("Settings updated in demo tab", "Changes stay in your browser preview and reset cleanly anytime.", "info");
    return { success: true, data: [ctx.getDataset().org] };
  }

  if (sub === "/subscription") {
    return {
      success: true,
      data: buildDemoSubscription(planId, {
        invoices_this_month: dataset.invoices.length + 14,
        seats_used: dataset.members.length + dataset.invitations.length,
      }),
    };
  }

  if (sub === "/fiscal-periods") {
    return { success: true, data: dataset.fiscalPeriods };
  }

  if (sub === "/accounts") {
    if (method === "GET") {
      const bal = computeBalances(dataset);
      const enriched = dataset.accounts.map((a) => ({
        ...a,
        total_debit: bal.get(a.id)?.debit ?? 0,
        total_credit: bal.get(a.id)?.credit ?? 0,
      }));
      return { success: true, data: enriched };
    }
    if (method === "POST") {
      assertRoleAllowed(ctx, "post_voucher", "Add Account");
      const body = parseBody(options);
      const nextAcc: Account = {
        id: `${orgId}-acc-${Date.now()}`,
        organisation_id: orgId,
        code: String(body.code || "5090"),
        name: String(body.name || "Demo Expense Ledger"),
        type: body.account_group === "revenue" ? "income" : (body.account_group || "expense"),
        account_group: body.account_group || "expense",
        ledger: body.ledger || "Custom Demo Group",
        sub_ledger: body.sub_ledger || body.name || "Custom",
        label: `${body.code || "5090"} · ${body.name || "Demo Expense Ledger"}`,
        is_postable: body.is_postable ?? true,
        is_active: true,
        is_system: false,
      };
      ctx.updateDataset((prev) => ({ ...prev, accounts: [...prev.accounts, nextAcc] }));
      return { success: true, data: [nextAcc] };
    }
  }

  if (sub === "/parties") {
    if (method === "GET") return { success: true, data: dataset.parties };
    if (method === "POST") {
      assertRoleAllowed(ctx, "create_draft", "Add Counterparty");
      const body = parseBody(options);
      const p: Party = {
        id: `${orgId}-party-${Date.now()}`,
        organisation_id: orgId,
        type: body.type || "customer",
        legal_name: body.legal_name || "Sample Party",
        display_name: body.display_name || body.legal_name,
        gstin: body.gstin || null,
        email: body.email || null,
        phone: body.phone || null,
        billing_address: body.billing_address || null,
        is_active: true,
      };
      ctx.updateDataset((prev) => ({ ...prev, parties: [p, ...prev.parties] }));
      return { success: true, data: [p] };
    }
  }

  if (sub === "/catalogue") {
    if (method === "GET") return { success: true, data: dataset.catalogue };
    if (method === "POST") {
      assertRoleAllowed(ctx, "create_draft", "Add Catalogue Item");
      if (plan.catalogueItemsLimit !== null && dataset.catalogue.length >= plan.catalogueItemsLimit) {
        const msg = `GO Plan limits the catalogue to ${plan.catalogueItemsLimit} items. Switch to PRO in the Demo Control Bar for unlimited items.`;
        ctx.notifyAction("GO Plan Limit", msg, "warning");
        throw new ApiError(msg, 402, { limit: "catalogue_items" });
      }
      const body = parseBody(options);
      const item = {
        id: `${orgId}-item-${Date.now()}`,
        organisation_id: orgId,
        type: body.type || "goods",
        name: body.name || "New Demo SKU",
        sku: body.sku || `SKU-${dataset.catalogue.length + 1}`,
        hsn_sac_code: body.hsn_sac_code || "853620",
        unit_code: body.unit_code || "NOS",
        default_unit_price: Number(body.default_unit_price || 1000),
        default_gst_rate: Number(body.default_gst_rate || 18),
        is_taxable: body.is_taxable ?? true,
        track_inventory: body.track_inventory ?? false,
        is_active: true,
      };
      ctx.updateDataset((prev) => ({ ...prev, catalogue: [item, ...prev.catalogue] }));
      return { success: true, data: [item] };
    }
  }

  if (sub === "/journals/next-number") {
    const prefix = query.get("prefix") || "JV";
    return { success: true, data: `${prefix}-2627-${String(dataset.journals.length + 1).padStart(4, "0")}` };
  }

  if (sub === "/journals") {
    if (method === "GET") return { success: true, data: dataset.journals };
    if (method === "POST") {
      assertRoleAllowed(ctx, "create_draft", "Create Voucher");
      const body = parseBody(options);
      const je: JournalEntry = {
        id: `${orgId}-je-${Date.now()}`,
        organisation_id: orgId,
        fiscal_period_id: body.fiscal_period_id || dataset.fiscalPeriods[0]?.id,
        entry_number: body.entry_number || `JV-2627-${String(dataset.journals.length + 1).padStart(4, "0")}`,
        entry_date: body.entry_date || "2026-11-10",
        status: "draft",
        narration: body.narration || "Demo voucher draft",
        reference: body.reference || null,
        journal_entry_lines: (body.lines || []).map((l: Record<string, unknown>, idx: number) => ({
          line_number: Number(l.line_number ?? idx + 1),
          account_id: String(l.account_id || ""),
          party_id: (l.party_id as string | null) ?? null,
          description: (l.description as string | null) ?? null,
          debit: Number(l.debit || 0),
          credit: Number(l.credit || 0),
        })),
      };
      ctx.updateDataset((prev) => ({ ...prev, journals: [je, ...prev.journals] }));
      return { success: true, entry: je, lines: je.journal_entry_lines };
    }
  }

  const jeActionMatch = sub.match(/^\/journals\/([^/]+)\/(post|submit|reject|reverse)$/);
  if (jeActionMatch && method === "POST") {
    const [, jeId, act] = jeActionMatch;
    if (act === "post") assertRoleAllowed(ctx, "approve_voucher", "Post Voucher");
    if (act === "submit") assertRoleAllowed(ctx, "create_draft", "Submit Voucher");
    if (act === "reject") assertRoleAllowed(ctx, "approve_voucher", "Reject Voucher");
    if (act === "reverse") assertRoleAllowed(ctx, "reverse_voucher", "Reverse Voucher");

    if ((act === "submit" || act === "post") && !plan.makerCheckerEnabled && role === "accountant" && act === "post") {
      ctx.notifyAction("Restricted for Accountant", "Switch to Owner, CFO, or Admin to approve & post vouchers.", "blocked");
    }

    let updatedEntry: JournalEntry | undefined;
    ctx.updateDataset((prev) => {
      const next = prev.journals.map((j) => {
        if (j.id !== jeId) return j;
        if (act === "post") {
          updatedEntry = { ...j, status: "posted", posted_at: new Date().toISOString() };
        } else if (act === "submit") {
          updatedEntry = { ...j, status: "draft", submitted_at: new Date().toISOString() };
        } else if (act === "reject") {
          const body = parseBody(options);
          updatedEntry = { ...j, status: "draft", rejected_at: new Date().toISOString(), rejection_reason: body.reason || "Sent back for clarification" };
        } else {
          updatedEntry = { ...j, status: "reversed" };
        }
        return updatedEntry;
      });
      return { ...prev, journals: next };
    });
    return { success: true, message: `Voucher ${act} completed in demo tab.`, entry: updatedEntry };
  }

  // Reports derived dynamically from posted journals
  if (sub === "/reports/account-balances" || sub === "/reports/trial-balance") {
    return { success: true, data: buildAccountBalanceRows(dataset) };
  }

  if (sub === "/reports/general-ledger") {
    const accountIdFilter = query.get("account_id");
    const accMap = new Map(dataset.accounts.map((a) => [a.id, a]));
    const partyMap = new Map(dataset.parties.map((p) => [p.id, p.legal_name]));
    const rows: GeneralLedgerRow[] = [];
    for (const j of dataset.journals) {
      if (j.status !== "posted") continue;
      for (const l of j.journal_entry_lines) {
        if (accountIdFilter && l.account_id !== accountIdFilter) continue;
        const acc = accMap.get(l.account_id);
        rows.push({
          line_id: `${j.id}-${l.line_number}`,
          organisation_id: orgId,
          journal_entry_id: j.id,
          entry_number: j.entry_number,
          entry_date: j.entry_date,
          reference: j.reference ?? null,
          status: j.status,
          line_number: l.line_number,
          account_id: l.account_id,
          account_code: acc?.code || "0000",
          account_name: acc?.name || "Unknown",
          account_type: acc?.type || "expense",
          party_id: l.party_id ?? null,
          party_name: l.party_id ? partyMap.get(l.party_id) ?? null : null,
          description: l.description ?? null,
          narration: j.narration,
          debit: Number(l.debit || 0),
          credit: Number(l.credit || 0),
          fiscal_period_id: j.fiscal_period_id,
          fiscal_period_name: dataset.fiscalPeriods[0]?.name || "FY 2026-27",
        });
      }
    }
    return { success: true, data: rows };
  }

  if (sub === "/reports/profit-and-loss") {
    const rows: ProfitLossRow[] = buildAccountBalanceRows(dataset)
      .filter((r) => r.account_type === "income" || r.account_type === "expense")
      .map((r) => ({
        organisation_id: orgId,
        fiscal_period_id: dataset.fiscalPeriods[0]?.id,
        fiscal_period_name: dataset.fiscalPeriods[0]?.name,
        account_id: r.account_id,
        account_code: r.account_code,
        account_name: r.account_name,
        account_type: r.account_type,
        total_debit: r.total_debit,
        total_credit: r.total_credit,
        net_amount: r.natural_balance,
      }));
    return { success: true, data: rows };
  }

  if (sub === "/reports/balance-sheet") {
    const all = buildAccountBalanceRows(dataset);
    const incomeTotal = all.filter((r) => r.account_type === "income").reduce((s, r) => s + r.natural_balance, 0);
    const expenseTotal = all.filter((r) => r.account_type === "expense").reduce((s, r) => s + r.natural_balance, 0);
    const retainedProfit = incomeTotal - expenseTotal;
    const rows: BalanceSheetRow[] = [
      ...all
        .filter((r) => r.account_type === "asset" || r.account_type === "liability" || r.account_type === "equity")
        .map((r) => ({
          organisation_id: orgId,
          account_id: r.account_id,
          account_code: r.account_code,
          account_name: r.account_name,
          account_type: r.account_type,
          total_debit: r.total_debit,
          total_credit: r.total_credit,
          balance: r.natural_balance,
        })),
      {
        organisation_id: orgId,
        account_id: null,
        account_code: null,
        account_name: "Current Period Net Surplus / Retained Profit",
        account_type: "equity",
        total_debit: expenseTotal,
        total_credit: incomeTotal,
        balance: retainedProfit,
      },
    ];
    return { success: true, data: rows };
  }

  if (sub === "/reports/party-ageing") {
    const side = query.get("side") === "payable" ? "payable" : "receivable";
    return { success: true, data: buildPartyAgeing(dataset, side) };
  }

  if (sub === "/reports/kpis") {
    const all = buildAccountBalanceRows(dataset);
    const findBal = (code: string) => all.find((r) => r.account_code === code)?.natural_balance ?? 0;
    const revenue = all.filter((r) => r.account_type === "income").reduce((s, r) => s + r.natural_balance, 0);
    const expenses = all.filter((r) => r.account_type === "expense").reduce((s, r) => s + r.natural_balance, 0);
    return {
      success: true,
      data: {
        revenue,
        expenses,
        net_profit: revenue - expenses,
        cash_balance: findBal("1010") + findBal("1020"),
        receivables: Math.max(0, findBal("1030")),
        payables: Math.max(0, findBal("2010")),
        invoice_count: dataset.invoices.length,
        voucher_count: dataset.journals.filter((j) => j.status === "posted").length,
      },
    };
  }

  if (sub === "/reports/expenses") {
    const all = buildAccountBalanceRows(dataset).filter((r) => r.account_type === "expense");
    return {
      success: true,
      data: {
        total: all.reduce((s, r) => s + r.natural_balance, 0),
        categories: all.map((r) => ({ account_id: r.account_id, name: r.account_name, amount: r.natural_balance })),
      },
    };
  }

  if (sub === "/reports/cash-flow") {
    const all = buildAccountBalanceRows(dataset);
    const cash = (all.find((r) => r.account_code === "1010")?.natural_balance ?? 0) + (all.find((r) => r.account_code === "1020")?.natural_balance ?? 0);
    const rev = all.filter((r) => r.account_type === "income").reduce((s, r) => s + r.natural_balance, 0);
    const exp = all.filter((r) => r.account_type === "expense").reduce((s, r) => s + r.natural_balance, 0);
    return {
      success: true,
      data: {
        operating_inflow: rev,
        operating_outflow: exp,
        net_operating: rev - exp,
        financing_inflow: all.find((r) => r.account_code === "3010")?.natural_balance ?? 0,
        closing_cash: cash,
      },
    };
  }

  if (sub === "/reports/fpa-metrics" || sub === "/reports/ar-ap-aging" || sub === "/reports/budget-variance") {
    const all = buildAccountBalanceRows(dataset);
    const rev = all.filter((r) => r.account_type === "income").reduce((s, r) => s + r.natural_balance, 0);
    const exp = all.filter((r) => r.account_type === "expense").reduce((s, r) => s + r.natural_balance, 0);
    if (sub === "/reports/budget-variance") {
      return {
        success: true,
        data: dataset.departments.map((d) => ({
          department: d.name,
          code: d.code,
          budget: d.budget_allocated ?? 0,
          actual: d.budget_utilized ?? 0,
          variance: (d.budget_allocated ?? 0) - (d.budget_utilized ?? 0),
        })),
      };
    }
    return {
      success: true,
      data: {
        revenue: rev,
        expenses: exp,
        ebitda: rev - exp,
        margin_pct: rev > 0 ? Math.round(((rev - exp) / rev) * 1000) / 10 : 0,
        dso_days: 34,
        dpo_days: 28,
        runway_months: 18,
      },
    };
  }

  if (sub === "/invoices") {
    if (method === "GET") return { success: true, data: dataset.invoices };
    if (method === "POST") {
      assertRoleAllowed(ctx, "create_draft", "Create Sales Invoice");
      const body = parseBody(options);
      const party = dataset.parties.find((p) => p.id === body.customer_id);
      const lines = (body.lines || []) as SalesInvoiceLine[];
      const taxable = lines.reduce((s: number, l) => s + Number(l.taxable_amount || Number(l.quantity || 0) * Number(l.unit_price || 0) || 0), 0);
      const cgst = lines.reduce((s: number, l) => s + Number(l.cgst_amount || 0), 0);
      const sgst = lines.reduce((s: number, l) => s + Number(l.sgst_amount || 0), 0);
      const igst = lines.reduce((s: number, l) => s + Number(l.igst_amount || 0), 0);
      const inv = {
        id: `${orgId}-inv-${Date.now()}`,
        organisation_id: orgId,
        customer_id: body.customer_id,
        invoice_number: body.invoice_number || `INV-2627-${String(dataset.invoices.length + 101)}`,
        invoice_date: body.invoice_date || "2026-11-10",
        due_date: body.due_date || "2026-11-25",
        status: "draft" as const,
        supply_type: body.supply_type || "intra_state",
        place_of_supply: body.place_of_supply || `${dataset.org.state_code}-State`,
        taxable_amount: taxable,
        cgst_amount: cgst,
        sgst_amount: sgst,
        igst_amount: igst,
        total_amount: taxable + cgst + sgst + igst,
        parties: party ? { legal_name: party.legal_name, gstin: party.gstin } : undefined,
        sales_invoice_lines: lines,
      };
      ctx.updateDataset((prev) => ({ ...prev, invoices: [inv, ...prev.invoices] }));
      return { success: true, invoice: inv, lines };
    }
  }

  const invAction = sub.match(/^\/invoices\/([^/]+)\/(issue|cancel)$/);
  if (invAction && method === "POST") {
    const [, invId, action] = invAction;
    assertRoleAllowed(ctx, "issue_invoice", action === "issue" ? "Issue Invoice" : "Cancel Invoice");
    let targetInv = dataset.invoices.find((i) => i.id === invId);
    ctx.updateDataset((prev) => ({
      ...prev,
      invoices: prev.invoices.map((i) => {
        if (i.id !== invId) return i;
        targetInv = { ...i, status: action === "issue" ? "issued" : "cancelled" };
        return targetInv;
      }),
    }));
    return { success: true, message: `Invoice ${action}d in demo workspace.`, invoice: targetInv };
  }

  if (sub === "/notes") {
    return { success: true, data: dataset.notes };
  }

  if (sub === "/purchases") {
    if (method === "GET") return { success: true, data: dataset.purchases };
    if (method === "POST") {
      assertRoleAllowed(ctx, "create_draft", "Record Purchase Bill");
      const body = parseBody(options);
      const bill = {
        id: `${orgId}-pb-${Date.now()}`,
        organisation_id: orgId,
        ...body,
      } as unknown as DemoDataset["purchases"][number];
      ctx.updateDataset((prev) => ({ ...prev, purchases: [bill, ...prev.purchases] }));
      return { success: true, data: [bill] };
    }
  }

  if (sub === "/business-documents") {
    if (method === "GET") return { success: true, data: dataset.businessDocuments };
    if (method === "POST") {
      assertRoleAllowed(ctx, "create_draft", "Save Document");
      const body = parseBody(options);
      const doc = {
        id: `${orgId}-doc-${Date.now()}`,
        organisation_id: orgId,
        status: "draft",
        ...body,
      } as unknown as DemoDataset["businessDocuments"][number];
      ctx.updateDataset((prev) => ({ ...prev, businessDocuments: [doc, ...prev.businessDocuments] }));
      return { success: true, data: doc };
    }
  }

  if (sub === "/inventory/warehouses") {
    return { success: true, data: dataset.warehouses };
  }

  if (sub === "/inventory/summary") {
    return { success: true, data: dataset.stockSummary };
  }

  if (sub.startsWith("/inventory/items/")) {
    return { success: true, data: [] };
  }

  if (sub === "/banking/reconciliations") {
    return { success: true, data: dataset.reconciliations };
  }

  if (sub === "/banking/statements/position") {
    const bankAcc = dataset.accounts.find((a) => a.code === "1020");
    const bal = computeBalances(dataset).get(bankAcc?.id || "");
    return {
      success: true,
      data: {
        book_balance: (bal?.debit ?? 0) - (bal?.credit ?? 0),
        as_of: query.get("as_of") || "2026-11-10",
      },
    };
  }

  if (sub === "/banking/statements") {
    return { success: true, data: [] };
  }

  if (sub === "/marketplace/settlements") {
    return { success: true, data: dataset.marketplaceSettlements };
  }

  if (sub === "/marketplace/column-maps") {
    return { success: true, data: [] };
  }

  if (sub === "/departments") {
    return { success: true, data: dataset.departments };
  }

  if (sub === "/members" || sub === "/workbench-members") {
    const maskedMembers = dataset.members.map((m) => ({
      ...m,
      compensation: roleCfg.salaryMasked ? null : { ctc_annual: 1400000, masked: false },
      salary_masked: roleCfg.salaryMasked,
    }));
    return { success: true, data: maskedMembers };
  }

  if (sub === "/invitations") {
    return { success: true, data: dataset.invitations };
  }

  if (sub === "/payroll/runs") {
    const runs = dataset.payrollRuns.map((r) =>
      roleCfg.salaryMasked ? { ...r, masked_individual_salaries: true } : r
    );
    return { success: true, data: runs };
  }

  if (sub === "/payroll/run" && method === "POST") {
    assertRoleAllowed(ctx, "run_payroll", "Run Payroll");
    return {
      success: true,
      data: {
        success: true,
        payroll_run_id: `${orgId}-pr-sim`,
        period: "2026-11",
        headcount: dataset.members.length,
        total_net_disbursed: 240000,
        total_tds: 20000,
        total_epf: 12000,
      },
    };
  }

  if (sub === "/audit-events") {
    return { success: true, data: dataset.auditEvents };
  }

  const gstMatch = sub.match(/^\/gst\/([^/]+)\/(gstr1|gstr3b)$/);
  if (gstMatch) {
    const [, period, returnType] = gstMatch;
    if (!plan.gstnJsonEnabled) {
      ctx.notifyAction(
        "PRO Plan Required for Offline JSON",
        "GO Plan shows GST tax summaries only. Switch to PRO or Enterprise in the Demo Control Bar to preview GSTR-1 & GSTR-3B offline JSON exports.",
        "warning"
      );
    }
    const commonInvoices = dataset.invoices.map((inv) => ({
      ...inv,
      supply_type: inv.supply_type as "intra_state" | "inter_state" | "export",
      cgst_amount: inv.cgst_amount ?? 0,
      sgst_amount: inv.sgst_amount ?? 0,
      igst_amount: inv.igst_amount ?? 0,
      cess_amount: inv.cess_amount ?? 0,
    }));
    const result =
      returnType === "gstr1"
        ? buildGstr1({ gstin: dataset.org.gstin, retPeriod: period, invoices: commonInvoices })
        : buildGstr3b({
          gstin: dataset.org.gstin,
          retPeriod: period,
          invoices: commonInvoices,
          accounts: dataset.accounts,
          journals: dataset.journals,
        });
    return { success: true, data: result };
  }

  if (sub === "/consultant/context") {
    const all = buildAccountBalanceRows(dataset);
    const rev = all.filter((r) => r.account_type === "income").reduce((s, r) => s + r.natural_balance, 0);
    const exp = all.filter((r) => r.account_type === "expense").reduce((s, r) => s + r.natural_balance, 0);
    return {
      success: true,
      context: {
        company: dataset.org.name,
        mode: plan.aiCfoWorkflowsEnabled ? "Enterprise AI CFO Preview (Simulated)" : "Upgrade to Enterprise for 10-Department AI CFO",
        revenue: rev,
        expenses: exp,
        net_profit: rev - exp,
      },
    };
  }

  if (sub === "/consultant/chat") {
    const all = buildAccountBalanceRows(dataset);
    const rev = all.filter((r) => r.account_type === "income").reduce((s, r) => s + r.natural_balance, 0);
    const exp = all.filter((r) => r.account_type === "expense").reduce((s, r) => s + r.natural_balance, 0);
    return {
      success: true,
      reply: `[Simulated Demo Assistant — deterministic company ledger summary for ${dataset.org.name}] Revenue: ₹${rev.toLocaleString("en-IN")}, Expenses: ₹${exp.toLocaleString("en-IN")}, Net Surplus: ₹${(rev - exp).toLocaleString("en-IN")}. External LLM and live server actions are disabled in public demo mode.`,
    };
  }

  if (sub.startsWith("/gsp/")) {
    if (method === "POST") {
      ctx.notifyAction(
        "Simulated GSP Action",
        "NIC IRP E-Invoicing, E-Way Bill, and GSP Portal calls require an external GSP provider credential in production and stay simulated in Public Demo.",
        "info"
      );
    }
    return {
      success: true,
      data: {
        connected: false,
        mode: "demo_simulated",
        message: "Requires external GSP provider in production; IRN/EWB actions are simulated.",
        e_invoices: [],
        eway_bills: [],
      },
    };
  }

  if (sub.startsWith("/kyc/")) {
    return { success: true, data: { pan_verified: false, gstin_verified: false, mode: "demo_simulated" } };
  }

  if (sub.startsWith("/payments/")) {
    return { success: true, data: { razorpay_connected: false, mode: "demo_simulated", links: [] } };
  }

  return { success: true, data: [] };
}

