import type { Account, JournalEntry, JournalStatus, Party } from "@/types/accounting";
import { bookEntries, inRange, isOperatingExpense, toPaise } from "./ledger";

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

/** Operating expenses (cost of sales excluded) booked between `from` and `to`, by entry and by expense head. */
export function operatingExpenses(
  journals: JournalEntry[],
  accounts: Account[],
  parties: Party[],
  from: string,
  to: string
) {
  const acc = new Map(accounts.map((a) => [a.id, a]));
  const partyName = new Map(parties.map((p) => [p.id, p.display_name || p.legal_name]));
  const heads = new Map<string, ExpenseHeadTotal>();
  const vouchers: ExpenseVoucher[] = [];

  for (const j of bookEntries(journals)) {
    if (!inRange(j.entry_date, from, to)) continue;
    const lines = j.journal_entry_lines ?? [];
    let amount = 0;
    const touched = new Set<string>();
    for (const l of lines) {
      const a = acc.get(l.account_id);
      if (!a || !isOperatingExpense(a)) continue;
      const net = toPaise(l.debit) - toPaise(l.credit);
      amount += net;
      const h = heads.get(a.id) ?? { accountId: a.id, code: a.code, name: a.name, amountPaise: 0, entries: 0 };
      h.amountPaise += net;
      if (!touched.has(a.id)) h.entries += 1;
      touched.add(a.id);
      heads.set(a.id, h);
    }
    if (!touched.size) continue;
    const party = lines.find((l) => l.party_id && partyName.has(l.party_id))?.party_id;
    vouchers.push({
      id: j.id,
      entryNumber: j.entry_number,
      date: j.entry_date,
      status: j.status,
      reference: j.reference ?? null,
      narration: j.narration,
      partyName: party ? partyName.get(party)! : null,
      amountPaise: amount,
      heads: [...touched].map((id) => acc.get(id)!.name),
      headIds: [...touched],
      sources: [
        ...new Set(
          lines
            .filter((l) => {
              const a = acc.get(l.account_id);
              return toPaise(l.credit) > 0 && !(a && isOperatingExpense(a));
            })
            .map((l) => acc.get(l.account_id)?.name ?? "Unknown account")
        ),
      ],
      lines: lines.map((l) => {
        const a = acc.get(l.account_id);
        return {
          accountName: a?.name ?? "Unknown account",
          accountCode: a?.code ?? "",
          group: a?.account_group ?? a?.type ?? "",
          debitPaise: toPaise(l.debit),
          creditPaise: toPaise(l.credit),
        };
      }),
    });
  }

  vouchers.sort((a, b) => b.date.localeCompare(a.date) || b.entryNumber.localeCompare(a.entryNumber));
  const byHead = [...heads.values()].filter((h) => h.amountPaise !== 0).sort((a, b) => b.amountPaise - a.amountPaise);
  const totalPaise = vouchers.reduce((s, v) => s + v.amountPaise, 0);
  return { vouchers, byHead, totalPaise };
}
