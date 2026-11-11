import { describe, expect, it } from "vitest";
import { DEMO_COMPANIES } from "@/lib/learn/companies";
import { parseStatement } from "@/lib/bank/statement-parser";
import { demoStatementCsv } from "@/lib/learn/sample-data";
import { stockValue } from "@/lib/learn/engine/inventory";
import { demo } from "./fixtures/learn-engine-ctx";

const p = (n: number | string) => Math.round(Number(n) * 100);

describe.each(DEMO_COMPANIES.map((c) => c.slug))("seed books reconcile: %s", (slug) => {
  it("every journal balances, the trial balance balances and the balance sheet equation holds", async () => {
    const d = demo(slug);
    for (const j of d.ds.journals) {
      const dr = j.journal_entry_lines.reduce((s, l) => s + p(l.debit), 0);
      const cr = j.journal_entry_lines.reduce((s, l) => s + p(l.credit), 0);
      expect(dr, j.entry_number).toBe(cr);
      expect(dr).toBeGreaterThan(0);
      for (const l of j.journal_entry_lines) expect((l.debit > 0) !== (l.credit > 0), `${j.entry_number} line ${l.line_number}`).toBe(true);
    }
    const tb = (await d.get("/reports/trial-balance")).data as { total_debit: number; total_credit: number; closing_debit: number; closing_credit: number }[];
    expect(tb.reduce((s, r) => s + p(r.total_debit), 0)).toBe(tb.reduce((s, r) => s + p(r.total_credit), 0));
    expect(tb.reduce((s, r) => s + p(r.closing_debit), 0)).toBe(tb.reduce((s, r) => s + p(r.closing_credit), 0));

    const bs = (await d.get("/reports/balance-sheet?as_of=2026-11-10")).data as { account_type: string; balance: number }[];
    const sum = (t: string) => bs.filter((r) => r.account_type === t).reduce((s, r) => s + p(r.balance), 0);
    expect(sum("asset")).toBe(sum("liability") + sum("equity"));
    const k = (await d.get("/reports/kpis?from=2026-04-01&to=2026-11-10")).data;
    expect(k.balanced).toBe(true);
    expect(p(k.assets)).toBe(p(k.liabilities) + p(k.equity));
  });

  it("FIFO stock value equals the inventory ledger (1050)", async () => {
    const d = demo(slug);
    expect(p(stockValue(d.ds))).toBe(p(await d.bal("1050")));
    for (const row of (await d.get("/inventory/summary")).data) expect(Number(row.qty_on_hand)).toBeGreaterThanOrEqual(0);
  });

  it("each invoice, note and bill equals its journal", () => {
    const { ds } = demo(slug);
    for (const inv of ds.invoices) {
      const j = ds.journals.find((x) => x.id === inv.journal_entry_id)!;
      const lines = inv.sales_invoice_lines!;
      expect(p(inv.total_amount)).toBe(lines.reduce((s, l) => s + p(l.total_amount), 0));
      expect(j.journal_entry_lines[0].debit, inv.invoice_number).toBe(inv.total_amount);
      expect(j.journal_entry_lines.filter((l) => l.credit > 0).reduce((s, l) => s + p(l.credit), 0)).toBe(p(inv.total_amount));
      expect(inv.status).toBe("issued");
    }
    for (const b of ds.purchases) {
      const j = ds.journals.find((x) => x.id === b.journal_entry_id)!;
      expect(j.journal_entry_lines.find((l) => l.credit > 0)!.credit).toBe(Number(b.total_amount));
    }
    for (const n of ds.notes) {
      const j = ds.journals.find((x) => x.id === n.journal_entry_id)!;
      expect(j.journal_entry_lines.find((l) => l.credit > 0)!.credit).toBe(Number(n.total_amount));
    }
  });

  it("has what the workflows need", async () => {
    const d = demo(slug);
    const { ds } = d;
    expect(ds.parties.some((x) => x.type === "customer")).toBe(true);
    expect(ds.parties.some((x) => x.type === "vendor")).toBe(true);
    expect(new Set(ds.members.map((m) => m.role))).toEqual(new Set(["owner", "cfo", "admin", "accountant", "analyst", "auditor", "viewer"]));
    for (const m of ds.members) expect(m.profiles?.email).toMatch(/\.example$/);
    expect(ds.departments.every((x) => Number(x.budget_allocated) > 0)).toBe(true);
    const debtors = (await d.get("/reports/party-ageing?side=receivable")).data;
    const creditors = (await d.get("/reports/party-ageing?side=payable")).data;
    expect(debtors.some((r: { balance: number }) => r.balance > 0)).toBe(true);
    expect(creditors.some((r: { balance: number }) => r.balance > 0)).toBe(true);
    if (ds.catalogue.some((c) => c.track_inventory)) expect(stockValue(ds)).toBeGreaterThan(0);
  });

  it("the supplied bank statement parses, matches the books where it should, and the completed reconciliation agrees", async () => {
    const d = demo(slug);
    const st = d.ds.bankStatements[0];
    const parsed = parseStatement(demoStatementCsv(st));
    expect(parsed.errors).toEqual([]);
    expect(parsed.lines).toHaveLength(st.lines.length);
    expect(parsed.lines.some((l) => l.balanceMismatch)).toBe(false);
    const bank = d.acc("1020");
    const bookLines = d.ds.journals.filter((j) => j.status === "posted").flatMap((j) => j.journal_entry_lines.filter((l) => l.account_id === bank));
    const unbooked = st.lines.filter((s) => !bookLines.some((l) => p(l.debit - l.credit) === p(s.amount)));
    expect(unbooked).toHaveLength(2);
    expect(p(st.closing_balance)).toBe(p(await d.bal("1020")) + unbooked.reduce((s, l) => s + p(l.amount), 0));
    const snap = d.ds.reconciliationStatements[0];
    const pos = (await d.get(`/banking/statements/position?bank_account_id=${bank}&as_of=${snap.statement_date}`)).data;
    expect(pos.book_balance).toBe(snap.book_balance);
    expect(pos.matched_amount).toBe(snap.matched_amount);
    expect(snap.unexplained_difference).toBe(0);
  });
});
