/** Operating-expense report: computed by get_expense_breakdown (GET /reports/expenses), mapped to paise here. */
import type { JournalStatus } from "@/types/accounting";
import { toPaise } from "./ledger";

type Money = number | string;

export interface ExpenseBreakdown {
  total: Money;
  revenue: Money;
  by_head: { account_id: string; code: string; name: string; amount: Money; entries: number }[];
  vouchers: {
    id: string;
    entry_number: string;
    date: string;
    status: JournalStatus;
    reference: string | null;
    narration: string;
    party_name: string | null;
    amount: Money;
    heads: string[];
    head_ids: string[];
    sources: string[];
    lines: { account_name: string; account_code: string; group: string; debit: Money; credit: Money }[];
  }[];
}

export interface ExpenseLine {
  accountName: string;
  accountCode: string;
  group: string;
  debitPaise: number;
  creditPaise: number;
}

export interface ExpenseVoucher {
  id: string;
  entryNumber: string;
  date: string;
  status: JournalStatus;
  reference: string | null;
  narration: string;
  partyName: string | null;
  /** Net operating expense on this entry (debits − credits on expense heads). */
  amountPaise: number;
  heads: string[];
  headIds: string[];
  /** Accounts credited on the other side (bank, cash, creditors). */
  sources: string[];
  lines: ExpenseLine[];
}

export interface ExpenseHeadTotal {
  accountId: string;
  code: string;
  name: string;
  amountPaise: number;
  entries: number;
}

export const toExpenseReport = (r: ExpenseBreakdown) => ({
  totalPaise: toPaise(r.total),
  revenuePaise: toPaise(r.revenue),
  byHead: r.by_head.map(
    (h): ExpenseHeadTotal => ({ accountId: h.account_id, code: h.code, name: h.name, amountPaise: toPaise(h.amount), entries: h.entries })
  ),
  vouchers: r.vouchers.map(
    (v): ExpenseVoucher => ({
      id: v.id,
      entryNumber: v.entry_number,
      date: v.date,
      status: v.status,
      reference: v.reference,
      narration: v.narration,
      partyName: v.party_name,
      amountPaise: toPaise(v.amount),
      heads: v.heads,
      headIds: v.head_ids,
      sources: v.sources,
      lines: v.lines.map((l) => ({
        accountName: l.account_name,
        accountCode: l.account_code,
        group: l.group,
        debitPaise: toPaise(l.debit),
        creditPaise: toPaise(l.credit),
      })),
    })
  ),
});
