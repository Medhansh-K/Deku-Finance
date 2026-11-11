/**
 * Reports computed from the demo books, one function per SQL report the screens call
 * (views and functions in migrations 21, 29, 45, 46, 54). Same rows, same rules: posted and
 * reversed entries count, account groups come from the chart's ledger/sub_ledger columns, and
 * "as of" defaults to the books' date.
 */
import type { PartyAgeingRow } from "@/lib/reports/ledger";
import type { GeneralLedgerRow } from "@/types/accounting";
import type { DemoDataset } from "../sample-data";
import { accountTotals, bookedJournals, booksToday, debitNatured, r2 } from "./books";

type Range = { from?: string | null; to?: string | null };

const days = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);

/** view_account_balances / ChartOfAccountsView. */
export function accountBalances(ds: DemoDataset, range: Range = {}) {
  const t = accountTotals(ds, range);
  const counts = new Map<string, number>();
  for (const j of bookedJournals(ds, range)) for (const l of j.journal_entry_lines) counts.set(l.account_id, (counts.get(l.account_id) ?? 0) + 1);
  return ds.accounts.map((a) => {
    const b = t.get(a.id) ?? { debit: 0, credit: 0 };
    const natural = r2(debitNatured(a) ? b.debit - b.credit : b.credit - b.debit);
    return {
      organisation_id: ds.org.id,
      account_id: a.id,
      account_code: a.code,
      account_name: a.name,
      account_type: a.type,
      account_group: a.account_group,
      ledger: a.ledger,
      sub_ledger: a.sub_ledger,
      label: a.label,
      is_active: a.is_active,
      units: counts.get(a.id) ?? 0,
      state_changes: counts.get(a.id) ?? 0,
      total_debit: b.debit,
      total_credit: b.credit,
      value: natural,
      natural_balance: natural,
    };
  });
}

/** get_trial_balance_range / view_trial_balance: every account, closing debit or credit. */
export function trialBalance(ds: DemoDataset, range: Range = {}) {
  return accountBalances(ds, range).map((r) => {
    const net = r2(r.total_debit - r.total_credit);
    const debitSide = r.account_type === "asset" || r.account_type === "expense";
    return {
      organisation_id: r.organisation_id,
      account_id: r.account_id,
      account_code: r.account_code,
      account_name: r.account_name,
      account_type: r.account_type,
      sub_ledger: r.sub_ledger,
      total_debit: r.total_debit,
      total_credit: r.total_credit,
      closing_debit: debitSide ? Math.max(0, net) : 0,
      closing_credit: debitSide ? 0 : Math.max(0, -net),
    };
  });
}

/** get_profit_and_loss_range: income and expense accounts that moved in the range. */
export function profitAndLoss(ds: DemoDataset, range: Range = {}) {
  const fp = ds.fiscalPeriods[0];
  return accountBalances(ds, range)
    .filter((r) => (r.account_type === "income" || r.account_type === "expense") && r.units > 0)
    .map((r) => ({
      organisation_id: r.organisation_id,
      fiscal_period_id: fp?.id,
      fiscal_period_name: fp?.name,
      account_id: r.account_id,
      account_code: r.account_code,
      account_name: r.account_name,
      account_type: r.account_type,
      total_debit: r.total_debit,
      total_credit: r.total_credit,
      net_amount: r.natural_balance,
    }));
}

/** get_balance_sheet_as_of: asset/liability/equity accounts with entries, plus accumulated profit. */
export function balanceSheet(ds: DemoDataset, asOf?: string | null) {
  const rows = accountBalances(ds, { to: asOf });
  const out = rows
    .filter((r) => (r.account_type === "asset" || r.account_type === "liability" || r.account_type === "equity") && r.units > 0)
    .map((r) => ({
      organisation_id: r.organisation_id,
      account_id: r.account_id as string | null,
      account_code: r.account_code as string | null,
      account_name: r.account_name,
      account_type: r.account_type,
      total_debit: r.total_debit,
      total_credit: r.total_credit,
      balance: r.natural_balance,
    }));
  const pl = rows.filter((r) => (r.account_type === "income" || r.account_type === "expense") && r.units > 0);
  if (pl.length) {
    const dr = r2(pl.reduce((s, r) => s + r.total_debit, 0));
    const cr = r2(pl.reduce((s, r) => s + r.total_credit, 0));
    out.push({
      organisation_id: ds.org.id,
      account_id: null,
      account_code: null,
      account_name: "Accumulated profit / (loss)",
      account_type: "equity",
      total_debit: dr,
      total_credit: cr,
      balance: r2(cr - dr),
    });
  }
  return out;
}

/** view_general_ledger. */
export function generalLedger(ds: DemoDataset, accountId?: string | null): GeneralLedgerRow[] {
  const acc = new Map(ds.accounts.map((a) => [a.id, a]));
  const party = new Map(ds.parties.map((p) => [p.id, p.legal_name]));
  const fp = new Map(ds.fiscalPeriods.map((p) => [p.id, p.name]));
  const rows: GeneralLedgerRow[] = [];
  for (const j of bookedJournals(ds)) {
    for (const l of j.journal_entry_lines) {
      if (accountId && l.account_id !== accountId) continue;
      const a = acc.get(l.account_id);
      rows.push({
        line_id: l.id ?? `${j.id}-l${l.line_number}`,
        organisation_id: ds.org.id,
        journal_entry_id: j.id,
        entry_number: j.entry_number,
        entry_date: j.entry_date,
        reference: j.reference ?? null,
        status: j.status,
        line_number: l.line_number,
        account_id: l.account_id,
        account_code: a?.code ?? "",
        account_name: a?.name ?? "Unknown",
        account_type: a?.type ?? "expense",
        party_id: l.party_id ?? null,
        party_name: l.party_id ? party.get(l.party_id) ?? null : null,
        description: l.description ?? null,
        narration: j.narration,
        debit: Number(l.debit || 0),
        credit: Number(l.credit || 0),
        fiscal_period_id: j.fiscal_period_id,
        fiscal_period_name: fp.get(j.fiscal_period_id) ?? "",
      });
    }
  }
  return rows.sort((a, b) => a.entry_date.localeCompare(b.entry_date) || a.entry_number.localeCompare(b.entry_number) || a.line_number - b.line_number);
}

/** get_cash_flow_statement (direct method; cash = 'Cash & Liquid Capital' accounts, migration 46). */
export function cashFlow(ds: DemoDataset, start = "2026-04-01", end = booksToday(ds)) {
  let opening = 0;
  let receipts = 0;
  let payments = 0;
  let investing = 0;
  let financing = 0;
  let closing = 0;
  for (const j of bookedJournals(ds, { to: end })) {
    const lines = j.journal_entry_lines.map((l) => ({ l, a: ds.accounts.find((a) => a.id === l.account_id) }));
    const delta = r2(lines.filter((x) => x.a?.ledger === "Cash & Liquid Capital").reduce((s, x) => s + x.l.debit - x.l.credit, 0));
    const other = lines.filter((x) => x.a?.ledger !== "Cash & Liquid Capital").sort((p, q) => Math.max(q.l.debit, q.l.credit) - Math.max(p.l.debit, p.l.credit))[0];
    const label = other ? `${other.a?.ledger ?? ""} ${other.a?.sub_ledger ?? ""} ${other.a?.label ?? ""}`.toLowerCase() : "";
    const activity = !other
      ? null
      : other.a?.type === "equity" || label.includes("loan") || /long.*term/.test(label)
        ? "financing"
        : other.a?.type === "asset" && label.includes("fixed")
          ? "investing"
          : "operating";
    closing += delta;
    if (j.entry_date < start) opening += delta;
    else if (activity === "operating" && delta > 0) receipts += delta;
    else if (activity === "operating" && delta < 0) payments -= delta;
    else if (activity === "investing") investing += delta;
    else if (activity === "financing") financing += delta;
  }
  return {
    organisation_id: ds.org.id,
    period_start: start,
    period_end: end,
    opening_cash_equivalents: r2(opening),
    operating_activities: {
      cash_receipts_from_sales: r2(receipts),
      cash_paid_for_operations: r2(payments),
      net_cash_from_operating_activities: r2(receipts - payments),
    },
    investing_activities: { capital_expenditures_and_fixed_assets: r2(investing), net_cash_used_in_investing: r2(investing) },
    financing_activities: { equity_and_debt_financing: r2(financing), net_cash_from_financing: r2(financing) },
    net_change_in_cash: r2(closing - opening),
    closing_cash_equivalents: r2(closing),
  };
}

/** _ledger_control_account. */
export function controlAccount(ds: DemoDataset, side: "receivable" | "payable") {
  const code = side === "receivable" ? "1030" : "2010";
  return ds.accounts.find((a) => a.code === code) ?? null;
}

/** _ledger_live_entries: booked entries up to a date, minus reversal pairs (both halves). */
function liveEntries(ds: DemoDataset, asOf: string) {
  const booked = bookedJournals(ds, { to: asOf });
  const ids = new Set(booked.map((j) => j.id));
  const paired = new Set<string>();
  for (const j of booked) if (j.reversal_of_id && ids.has(j.reversal_of_id)) paired.add(j.id).add(j.reversal_of_id);
  return booked.filter((j) => !paired.has(j.id));
}

/** get_party_ledger_ageing: bill-by-bill FIFO settlement per party, aged from the voucher date. */
export function partyAgeing(ds: DemoDataset, side: "receivable" | "payable", asOf = booksToday(ds)): PartyAgeingRow[] {
  const acc = controlAccount(ds, side);
  if (!acc) return [];
  const sign = side === "receivable" ? 1 : -1;
  type Move = { id: string; date: string; number: string; reference: string | null; pid: string | null; amt: number };
  const moves: Move[] = [];
  for (const j of liveEntries(ds, asOf)) {
    const byParty = new Map<string | null, number>();
    for (const l of j.journal_entry_lines.filter((x) => x.account_id === acc.id))
      byParty.set(l.party_id ?? null, r2((byParty.get(l.party_id ?? null) ?? 0) + l.debit - l.credit));
    for (const [pid, net] of byParty) if (net !== 0) moves.push({ id: j.id, date: j.entry_date, number: j.entry_number, reference: j.reference ?? null, pid, amt: r2(sign * net) });
  }
  const parties = [...new Set(moves.map((m) => m.pid))];
  const rows = parties.map((pid) => {
    const mine = moves.filter((m) => m.pid === pid).sort((a, b) => a.date.localeCompare(b.date) || a.number.localeCompare(b.number) || a.id.localeCompare(b.id));
    const dr = r2(mine.filter((m) => m.amt > 0).reduce((s, m) => s + m.amt, 0));
    const cr = r2(-mine.filter((m) => m.amt < 0).reduce((s, m) => s + m.amt, 0));
    let running = 0;
    const open: PartyAgeingRow["open_items"] = [];
    // Debits settle first-in-first-out against the party's total credits (the SQL window runs over debits only).
    for (const m of mine) {
      if (m.amt <= 0) continue;
      running = r2(running + m.amt);
      const openAmt = r2(Math.min(m.amt, Math.max(0, running - cr)));
      if (openAmt <= 0) continue;
      const inv = ds.invoices.find((i) => i.journal_entry_id === m.id);
      open.push({
        entry_id: m.id,
        entry_number: m.number,
        reference: m.reference,
        date: m.date,
        amount: m.amt,
        open: openAmt,
        age_days: Math.max(0, days(m.date, asOf)),
        invoice_id: inv?.id ?? null,
        invoice_number: inv?.invoice_number ?? null,
        due_date: inv?.due_date ?? null,
      });
    }
    const bucket = (lo: number, hi: number) => r2(open.filter((o) => o.age_days > lo && o.age_days <= hi).reduce((s, o) => s + Number(o.open), 0));
    const p = ds.parties.find((x) => x.id === pid);
    return {
      party_id: pid ?? "",
      party_name: p ? p.display_name || p.legal_name : "No party",
      gstin: p?.gstin ?? null,
      billing_address: (p?.billing_address as PartyAgeingRow["billing_address"]) ?? null,
      balance: r2(dr - cr),
      advance: r2(Math.max(0, cr - dr)),
      oldest_age_days: open.length ? Math.max(...open.map((o) => o.age_days)) : null,
      d0_30: r2(open.filter((o) => o.age_days <= 30).reduce((s, o) => s + Number(o.open), 0)),
      d31_60: bucket(30, 60),
      d61_90: bucket(60, 90),
      d90_plus: bucket(90, Infinity),
      open_items: open,
      _first: mine[0]?.date ?? "",
      _keep: dr !== cr || open.length > 0,
    };
  });
  return rows
    .filter((r) => r._keep)
    .sort((a, b) => b.balance - a.balance || a._first.localeCompare(b._first))
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    .map(({ _first, _keep, ...r }) => r as PartyAgeingRow);
}

/** _ledger_days_outstanding: balance ÷ flow into the control account over the window, × window days. */
function daysOutstanding(ds: DemoDataset, side: "receivable" | "payable", balance: number, asOf: string): number | null {
  const acc = controlAccount(ds, side);
  const live = liveEntries(ds, asOf);
  if (!acc || !live.length) return null;
  const first = live.reduce((m, j) => (j.entry_date < m ? j.entry_date : m), live[0].entry_date);
  const win = Math.min(365, days(first, asOf) + 1);
  const since = new Date(Date.parse(asOf) - (win - 1) * 86_400_000).toISOString().slice(0, 10);
  const flow = live
    .filter((j) => j.entry_date >= since)
    .flatMap((j) => j.journal_entry_lines.filter((l) => l.account_id === acc.id))
    .reduce((s, l) => s + (side === "receivable" ? l.debit : l.credit), 0);
  return flow > 0 ? Math.floor((balance / flow) * win + 0.5) : null;
}

const isCashBank = (t: string) => /\b(cash|bank)\b/i.test(t);
const accText = (a: DemoDataset["accounts"][number]) => `${a.name} ${a.ledger ?? ""} ${a.sub_ledger ?? ""}`;

/** get_expense_breakdown: operating expense heads (not COGS) and the vouchers behind them. */
export function expenseBreakdown(ds: DemoDataset, from: string, to: string) {
  const isOpex = (a: DemoDataset["accounts"][number]) => a.account_group === "expense" && !/cost of (goods|sales)|\bcogs\b/i.test(accText(a));
  const acc = new Map(ds.accounts.map((a) => [a.id, a]));
  const ents = bookedJournals(ds, { from, to });
  const heads = new Map<string, { account_id: string; code: string; name: string; amount: number; entries: number; first: string }>();
  const vouchers = [];
  let revenue = 0;
  for (const j of ents) {
    const ln = j.journal_entry_lines.map((l) => ({ l, a: acc.get(l.account_id)! })).filter((x) => x.a);
    revenue += ln.filter((x) => x.a.account_group === "revenue").reduce((s, x) => s + x.l.credit - x.l.debit, 0);
    const mine = new Map<string, { a: DemoDataset["accounts"][number]; net: number; first: number }>();
    for (const x of ln.filter((y) => isOpex(y.a))) {
      const cur = mine.get(x.a.id) ?? { a: x.a, net: 0, first: x.l.line_number };
      cur.net = r2(cur.net + x.l.debit - x.l.credit);
      mine.set(x.a.id, cur);
    }
    if (!mine.size) continue;
    for (const h of mine.values()) {
      const cur = heads.get(h.a.id) ?? { account_id: h.a.id, code: h.a.code, name: h.a.name, amount: 0, entries: 0, first: j.entry_date };
      cur.amount = r2(cur.amount + h.net);
      cur.entries += 1;
      if (j.entry_date < cur.first) cur.first = j.entry_date;
      heads.set(h.a.id, cur);
    }
    const hs = [...mine.values()].sort((a, b) => a.first - b.first);
    const partyLine = ln.find((x) => x.l.party_id);
    const p = partyLine ? ds.parties.find((x) => x.id === partyLine.l.party_id) : undefined;
    vouchers.push({
      id: j.id,
      entry_number: j.entry_number,
      date: j.entry_date,
      status: j.status,
      reference: j.reference ?? null,
      narration: j.narration,
      party_name: p ? p.display_name || p.legal_name : null,
      amount: r2(hs.reduce((s, h) => s + h.net, 0)),
      heads: hs.map((h) => h.a.name),
      head_ids: hs.map((h) => h.a.id),
      sources: [...new Set(ln.filter((x) => x.l.credit > 0 && !isOpex(x.a)).map((x) => x.a.name))],
      lines: ln.map((x) => ({ account_name: x.a.name, account_code: x.a.code, group: x.a.account_group, debit: x.l.debit, credit: x.l.credit })),
    });
  }
  const byHead = [...heads.values()].filter((h) => h.amount !== 0).sort((a, b) => b.amount - a.amount || a.first.localeCompare(b.first) || a.code.localeCompare(b.code));
  return {
    total: r2(vouchers.reduce((s, v) => s + v.amount, 0)),
    revenue: r2(revenue),
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    by_head: byHead.map(({ first, ...h }) => h),
    vouchers: vouchers.sort((a, b) => b.date.localeCompare(a.date) || b.entry_number.localeCompare(a.entry_number)),
  };
}

/** get_kpi_snapshot. */
export function kpis(ds: DemoDataset, from: string, to: string) {
  const booked = bookedJournals(ds, { to });
  const has = booked.length > 0;
  const last = booked.reduce<string | null>((m, j) => (!m || j.entry_date > m ? j.entry_date : m), null);
  const lines = booked.flatMap((j) => j.journal_entry_lines);
  const balanced = Math.round(lines.reduce((s, l) => s + l.debit * 100, 0)) === Math.round(lines.reduce((s, l) => s + l.credit * 100, 0));
  const total = accountTotals(ds, { to });
  const period = accountTotals(ds, { from, to });
  const nat = (a: DemoDataset["accounts"][number], m: typeof total) => {
    const b = m.get(a.id) ?? { debit: 0, credit: 0 };
    return a.account_group === "asset" || a.account_group === "expense" ? b.debit - b.credit : b.credit - b.debit;
  };
  const sum = (pred: (a: DemoDataset["accounts"][number]) => boolean, m: typeof total) => r2(ds.accounts.filter(pred).reduce((s, a) => s + nat(a, m), 0));
  const grp = (g: string) => (a: DemoDataset["accounts"][number]) => a.account_group === g;
  const cashBank = (a: DemoDataset["accounts"][number]) => a.account_group === "asset" && isCashBank(accText(a));
  const outGst = (a: DemoDataset["accounts"][number]) => a.account_group === "liability" && /output.*gst/i.test(accText(a));
  const inGst = (a: DemoDataset["accounts"][number]) => a.account_group === "asset" && /input.*gst/i.test(accText(a));
  const turnover = sum(grp("revenue"), period);
  const profit = r2(turnover - sum(grp("expense"), period));
  const lifetime = r2(sum(grp("revenue"), total) - sum(grp("expense"), total));
  const ar = controlAccount(ds, "receivable");
  const ap = controlAccount(ds, "payable");
  const arBal = ar ? r2(nat(ar, total)) : 0;
  const apBal = ap ? r2(nat(ap, total)) : 0;
  const arAgeing = ar ? partyAgeing(ds, "receivable", to) : [];
  const apAgeing = ap ? partyAgeing(ds, "payable", to) : [];
  const opex = expenseBreakdown(ds, from, to);
  const anyOut = ds.accounts.some(outGst);
  const anyIn = ds.accounts.some(inGst);
  const billed = ds.invoices.filter((i) => (i.status === "issued" || i.status === "paid") && i.invoice_date >= from && i.invoice_date <= to);
  return {
    has_entries: has,
    last_entry_date: last,
    turnover: has ? turnover : null,
    profit: has ? profit : null,
    margin_pct: has && turnover ? Math.round((profit / turnover) * 1000) / 10 : null,
    billed: billed.length ? r2(billed.reduce((s, i) => s + Number(i.total_amount), 0)) : null,
    liquid: has && ds.accounts.some(cashBank) ? sum(cashBank, total) : null,
    liquid_accounts: ds.accounts.filter((a) => cashBank(a) && nat(a, total) !== 0).sort((a, b) => a.code.localeCompare(b.code)).map((a) => a.name),
    debtors_account: ar ? { id: ar.id, code: ar.code, name: ar.name } : null,
    debtors: has ? arBal : null,
    debtors_count: arAgeing.filter((g) => Number(g.balance) > 0).length,
    debtors_over_45_count: arAgeing.filter((g) => (g.oldest_age_days ?? 0) > 45).length,
    dso_days: ar ? daysOutstanding(ds, "receivable", arBal, to) : null,
    creditors_account: ap ? { id: ap.id, code: ap.code, name: ap.name } : null,
    creditors: has ? apBal : null,
    creditors_count: apAgeing.filter((g) => Number(g.balance) > 0).length,
    dpo_days: ap ? daysOutstanding(ds, "payable", apBal, to) : null,
    expenses: has ? opex.total : null,
    expense_heads: opex.by_head.slice(0, 2).map((h) => h.name),
    gst_output: has && anyOut ? sum(outGst, total) : null,
    gst_input: has && anyIn ? sum(inGst, total) : null,
    gst_net: has && (anyOut || anyIn) ? r2((anyOut ? sum(outGst, total) : 0) - (anyIn ? sum(inGst, total) : 0)) : null,
    assets: has ? sum(grp("asset"), total) : null,
    liabilities: has ? sum(grp("liability"), total) : null,
    equity: has ? r2(sum(grp("equity"), total) + lifetime) : null,
    balanced: has ? balanced : null,
  };
}

/** get_fpa_corporate_metrics (migration 46 columns). */
export function fpaMetrics(ds: DemoDataset, start: string | null, end = booksToday(ds)) {
  const sixMonthsAgo = new Date(Date.parse(end));
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const after6 = sixMonthsAgo.toISOString().slice(0, 10);
  let revenue = 0, cogs = 0, opex = 0, opex6 = 0, ca = 0, cl = 0, cash = 0, debtors = 0;
  for (const j of bookedJournals(ds, { to: end })) {
    const inPeriod = !start || j.entry_date >= start;
    for (const l of j.journal_entry_lines) {
      const a = ds.accounts.find((x) => x.id === l.account_id);
      if (!a) continue;
      const dr = l.debit - l.credit;
      const isCogs = a.ledger === "Cost of Sales / Direct Delivery";
      if (a.type === "income" && inPeriod) revenue -= dr;
      if (isCogs && inPeriod) cogs += dr;
      if (a.type === "expense" && !isCogs && inPeriod) opex += dr;
      if (a.type === "expense" && !isCogs && j.entry_date > after6) opex6 += dr;
      if (a.type === "asset" && ["Cash & Liquid Capital", "Current Assets & Receivables", "Tax Assets & Input Credits"].includes(a.ledger ?? "")) ca += dr;
      if (a.type === "liability" && ["Current Liabilities & Payables", "Statutory & Tax Liabilities"].includes(a.ledger ?? "")) cl -= dr;
      if (a.ledger === "Cash & Liquid Capital") cash += dr;
      if (a.sub_ledger === "Trade Debtors") debtors += dr;
    }
  }
  const burn = opex6 > 0 ? r2(opex6 / 6) : null;
  const pct = (n: number) => (revenue > 0 ? Math.round((n / revenue) * 10000) / 100 : null);
  return {
    organisation_id: ds.org.id,
    period: { start_date: start, end_date: end },
    profitability: {
      total_revenue: r2(revenue),
      cogs: r2(cogs),
      gross_profit: r2(revenue - cogs),
      gross_margin_pct: pct(revenue - cogs),
      opex: r2(opex),
      net_profit: r2(revenue - cogs - opex),
      net_margin_pct: pct(revenue - cogs - opex),
    },
    liquidity_and_balance_sheet: {
      current_assets: r2(ca),
      current_liabilities: r2(cl),
      working_capital: r2(ca - cl),
      current_ratio: cl > 0 ? Math.round((ca / cl) * 100) / 100 : null,
      quick_ratio: cl > 0 ? Math.round(((cash + debtors) / cl) * 100) / 100 : null,
    },
    treasury_and_runway: {
      cash_and_bank_reserves: r2(cash),
      estimated_monthly_burn: burn,
      cash_runway_months: burn ? Math.round((cash / burn) * 10) / 10 : null,
    },
  };
}

/** get_ar_ap_aging_analysis: totals and DSO/DPO over the last 365 days of credit movements. */
export function arApAgeing(ds: DemoDataset, today = booksToday(ds)) {
  const since = new Date(Date.parse(today) - 365 * 86_400_000).toISOString().slice(0, 10);
  let ar = 0, ap = 0, creditSales = 0, creditPurchases = 0;
  for (const j of bookedJournals(ds)) {
    for (const l of j.journal_entry_lines) {
      const a = ds.accounts.find((x) => x.id === l.account_id);
      if (a?.sub_ledger === "Trade Debtors") {
        ar += l.debit - l.credit;
        if (j.entry_date > since) creditSales += l.debit;
      }
      if (a?.sub_ledger === "Trade Creditors") {
        ap += l.credit - l.debit;
        if (j.entry_date > since) creditPurchases += l.credit;
      }
    }
  }
  const buckets = { current_0_30_days: null, aging_31_60_days: null, aging_61_90_days: null, over_90_days_overdue: null };
  return {
    organisation_id: ds.org.id,
    accounts_receivable: { total_receivable: r2(ar), dso_days: creditSales > 0 ? Math.round((ar / creditSales) * 3650) / 10 : null, buckets },
    accounts_payable: { total_payable: r2(ap), dpo_days: creditPurchases > 0 ? Math.round((ap / creditPurchases) * 3650) / 10 : null, buckets },
    working_capital_gap: r2(ar - ap),
  };
}

/** get_departmental_budget_variance. */
export function budgetVariance(ds: DemoDataset) {
  const alloc = r2(ds.departments.reduce((s, d) => s + Number(d.budget_allocated ?? 0), 0));
  const used = r2(ds.departments.reduce((s, d) => s + Number(d.budget_utilized ?? 0), 0));
  return {
    organisation_id: ds.org.id,
    total_budget_allocated: alloc,
    total_budget_utilized: used,
    total_budget_remaining: r2(alloc - used),
    overall_burn_pct: alloc > 0 ? Math.round((used / alloc) * 1000) / 10 : 0,
    departments: ds.departments.map((d) => {
      const a = Number(d.budget_allocated ?? 0);
      const u = Number(d.budget_utilized ?? 0);
      return {
        id: d.id,
        name: d.name,
        code: d.code,
        budget_allocated: a,
        budget_utilized: u,
        budget_remaining: r2(a - u),
        burn_percentage: a > 0 ? Math.round((u / a) * 1000) / 10 : 0,
        headcount: ds.employees.filter((e) => e.department_id === d.id && e.status === "active").length,
      };
    }),
  };
}
