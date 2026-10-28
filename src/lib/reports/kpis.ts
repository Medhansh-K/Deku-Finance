import type { Account, JournalEntry, SalesInvoice } from "@/types/accounting";
import { operatingExpenses } from "./expenses";
import {
  accountBalances,
  bookEntries,
  byGroup,
  daysOutstanding,
  findControlAccount,
  isCashOrBank,
  isInputGst,
  isOutputGst,
  partyBalances,
  sumWhere,
  toPaise,
} from "./ledger";

/** Ledger KPIs in paise. Null means the books don't hold what's needed to compute it. */
export interface LedgerKpis {
  hasEntries: boolean;
  lastEntryDate: string | null;
  turnoverPaise: number | null;
  profitPaise: number | null;
  billedPaise: number | null;
  liquidPaise: number | null;
  liquidAccounts: string[];
  debtorsPaise: number | null;
  debtorsCount: number;
  debtorsOver45Count: number;
  dsoDays: number | null;
  creditorsPaise: number | null;
  creditorsCount: number;
  dpoDays: number | null;
  expensesPaise: number | null;
  expenseHeads: string[];
  gstOutputPaise: number | null;
  gstInputPaise: number | null;
  assetsPaise: number | null;
  liabilitiesPaise: number | null;
  /** Equity including profit not yet closed to retained earnings. */
  equityPaise: number | null;
  balanced: boolean | null;
}

export function computeKpis(input: {
  accounts: Account[];
  journals: JournalEntry[];
  invoices: SalesInvoice[];
  from: string;
  asOf: string;
}): LedgerKpis {
  const { accounts, journals, invoices, from, asOf } = input;
  const booked = bookEntries(journals).filter((j) => j.entry_date <= asOf);
  const has = booked.length > 0;
  const orNull = (v: number) => (has ? v : null);

  const all = accountBalances(accounts, booked, "", asOf);
  const period = accountBalances(accounts, booked, from, asOf);
  const revenue = sumWhere(accounts, period, byGroup("revenue"));
  const expense = sumWhere(accounts, period, byGroup("expense"));
  const opex = operatingExpenses(booked, accounts, [], from, asOf);

  const ledger = (kind: "receivable" | "payable") => {
    const acc = findControlAccount(accounts, kind);
    if (!acc) return { balance: null, parties: [], days: null };
    const parties = partyBalances(booked, acc.id, kind, asOf);
    const balance = all.get(acc.id) ?? 0;
    return { balance: orNull(balance), parties, days: daysOutstanding(booked, acc.id, kind, balance, asOf) };
  };
  const ar = ledger("receivable");
  const ap = ledger("payable");

  const lifetimeProfit =
    sumWhere(accounts, all, byGroup("revenue")) - sumWhere(accounts, all, byGroup("expense"));
  let dr = 0;
  let cr = 0;
  for (const j of booked)
    for (const l of j.journal_entry_lines ?? []) {
      dr += toPaise(l.debit);
      cr += toPaise(l.credit);
    }

  const billed = invoices.filter(
    (i) => (i.status === "issued" || i.status === "paid") && i.invoice_date >= from && i.invoice_date <= asOf
  );

  return {
    hasEntries: has,
    lastEntryDate: has ? booked.reduce((m, j) => (j.entry_date > m ? j.entry_date : m), "") : null,
    turnoverPaise: orNull(revenue),
    profitPaise: orNull(revenue - expense),
    billedPaise: billed.length ? billed.reduce((s, i) => s + toPaise(i.total_amount), 0) : null,
    liquidPaise: accounts.some(isCashOrBank) ? orNull(sumWhere(accounts, all, isCashOrBank)) : null,
    liquidAccounts: accounts.filter((a) => isCashOrBank(a) && (all.get(a.id) ?? 0) !== 0).map((a) => a.name),
    debtorsPaise: ar.balance,
    debtorsCount: ar.parties.filter((p) => p.balancePaise > 0).length,
    debtorsOver45Count: ar.parties.filter((p) => (p.oldestAgeDays ?? 0) > 45).length,
    dsoDays: ar.days,
    creditorsPaise: ap.balance,
    creditorsCount: ap.parties.filter((p) => p.balancePaise > 0).length,
    dpoDays: ap.days,
    expensesPaise: orNull(opex.totalPaise),
    expenseHeads: opex.byHead.slice(0, 2).map((h) => h.name),
    gstOutputPaise: accounts.some(isOutputGst) ? orNull(sumWhere(accounts, all, isOutputGst)) : null,
    gstInputPaise: accounts.some(isInputGst) ? orNull(sumWhere(accounts, all, isInputGst)) : null,
    assetsPaise: orNull(sumWhere(accounts, all, byGroup("asset"))),
    liabilitiesPaise: orNull(sumWhere(accounts, all, byGroup("liability"))),
    equityPaise: orNull(sumWhere(accounts, all, byGroup("equity")) + lifetimeProfit),
    balanced: has ? dr === cr : null,
  };
}

