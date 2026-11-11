"use client";

import React from "react";
import Link from "next/link";
import { FileText, Wallet } from "lucide-react";
import { formatINR } from "@/lib/formatters/currency";
import { formatDateTally } from "@/lib/formatters/date";
import type { ProfitLossRow, SalesInvoice } from "@/types/accounting";

/** A panel's data: undefined while loading, `error` when the API call failed. */
export type Slot<T> = { rows: T; error?: undefined } | { rows?: undefined; error: string } | undefined;

const rupees = (v: number) => formatINR(v, { minimumFractionDigits: 0 });

/* ------------------------------------------------------------------ */
/* Invoices in progress                                                */
/* ------------------------------------------------------------------ */

export type InvoiceState = "draft" | "awaiting" | "overdue" | "paid";

export const INVOICE_STATES: { key: InvoiceState; label: string; chip: string }[] = [
  { key: "draft", label: "Draft", chip: "bg-canvas-sunken text-ink-soft" },
  { key: "awaiting", label: "Awaiting payment", chip: "bg-brand-wash text-brand-strong" },
  { key: "overdue", label: "Overdue", chip: "bg-bad-wash text-bad" },
  { key: "paid", label: "Paid", chip: "bg-ok-wash text-ok" },
];

/** Cancelled invoices belong to no state. An issued invoice is overdue once its due date has passed. */
export function invoiceState(inv: Pick<SalesInvoice, "status" | "due_date">, today: string): InvoiceState | null {
  if (inv.status === "draft") return "draft";
  if (inv.status === "paid") return "paid";
  if (inv.status === "issued") return inv.due_date && inv.due_date.slice(0, 10) < today ? "overdue" : "awaiting";
  return null;
}

export function groupInvoices(list: SalesInvoice[], today: string) {
  const groups = Object.fromEntries(INVOICE_STATES.map((s) => [s.key, { count: 0, total: 0 }])) as Record<
    InvoiceState,
    { count: number; total: number }
  >;
  const open: (SalesInvoice & { state: InvoiceState })[] = [];
  for (const inv of list) {
    const state = invoiceState(inv, today);
    if (!state) continue;
    groups[state].count += 1;
    groups[state].total += Number(inv.total_amount || 0);
    if (state !== "paid") open.push({ ...inv, state });
  }
  // Overdue first, then whatever falls due soonest.
  const rank = { overdue: 0, awaiting: 1, draft: 2, paid: 3 };
  open.sort((a, b) => rank[a.state] - rank[b.state] || (a.due_date || "").localeCompare(b.due_date || ""));
  return { groups, open };
}

function PanelHead({ title, sub, href, linkText }: { title: string; sub: string; href: string; linkText: string }) {
  return (
    <div className="px-5 pt-4 flex items-start gap-3">
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold tracking-tight text-ink">{title}</h2>
        <p className="text-[13px] text-ink-muted mt-0.5">{sub}</p>
      </div>
      <Link
        href={href}
        className="ml-auto shrink-0 inline-flex items-center h-8 px-3 rounded-ctl border border-line-strong bg-surface text-[13px] font-medium text-ink hover:bg-canvas transition-colors"
      >
        {linkText}
      </Link>
    </div>
  );
}

function EmptyState({ icon, title, body, href, action }: { icon: React.ReactNode; title: string; body: string; href: string; action: string }) {
  return (
    <div className="m-5 rounded-[10px] border border-dashed border-line-strong bg-canvas px-5 py-8 text-center">
      <span className="mx-auto h-8 w-8 rounded-[8px] bg-canvas-sunken text-ink-soft grid place-items-center">{icon}</span>
      <p className="mt-3 text-[14px] font-[550] text-ink">{title}</p>
      <p className="mt-1 text-[12.5px] text-ink-muted max-w-sm mx-auto">{body}</p>
      <Link href={href} className="mt-3 inline-block text-[13px] font-medium text-brand-strong hover:underline">
        {action}
      </Link>
    </div>
  );
}

const Loading = () => <p className="px-5 py-8 text-[13px] text-ink-muted">Loading from the books…</p>;

export function InvoicesInProgress({ slot, today }: { slot: Slot<SalesInvoice[]>; today: string }) {
  const head = (
    <PanelHead title="Invoices in progress" sub="Sales invoices by status, from the invoice register" href="/gst" linkText="Open invoices" />
  );
  let body: React.ReactNode;
  if (!slot) body = <Loading />;
  else if (!slot.rows)
    body = (
      <EmptyState
        icon={<FileText className="h-4 w-4" />}
        title="Invoices could not be loaded"
        body={slot.error}
        href="/gst"
        action="Open Sales & GST invoices"
      />
    );
  else if (!slot.rows.some((i) => invoiceState(i, today)))
    body = (
      <EmptyState
        icon={<FileText className="h-4 w-4" />}
        title="No sales invoices yet"
        body="Drafts, invoices awaiting payment, overdue and paid invoices will show here with their totals."
        href="/vouchers/sales"
        action="Create a sales invoice (F8)"
      />
    );
  else {
    const { groups, open } = groupInvoices(slot.rows, today);
    const shown = open.slice(0, 5);
    body = (
      <div className="p-5 pt-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-px rounded-[10px] overflow-hidden border border-line bg-line">
          {INVOICE_STATES.map((s) => (
            <div key={s.key} className="bg-surface px-3.5 py-3">
              <div className="text-[13px] text-ink-muted">{s.label}</div>
              <div
                className={`text-[20px] font-semibold tracking-[-0.03em] tabular-nums ${
                  s.key === "overdue" && groups.overdue.count ? "text-bad" : "text-ink"
                }`}
              >
                {groups[s.key].count}
              </div>
              <div className="text-[12.5px] text-ink-muted tabular-nums">{rupees(groups[s.key].total)}</div>
            </div>
          ))}
        </div>

        {shown.length === 0 ? (
          <p className="mt-4 text-[13px] text-ink-muted">Nothing open. Every invoice is paid or cancelled.</p>
        ) : (
          <ul className="mt-3 -mx-2">
            {shown.map((inv) => {
              const st = INVOICE_STATES.find((s) => s.key === inv.state)!;
              return (
                <li key={inv.id}>
                  <Link href="/gst" className="flex items-center gap-3 px-2 py-2.5 rounded-[10px] hover:bg-brand-wash transition-colors">
                    <div className="min-w-0 flex-1">
                      <div className="font-mono text-[13px] text-ink truncate">{inv.invoice_number}</div>
                      <div className="text-[12.5px] text-ink-muted truncate">
                        {inv.parties?.legal_name || "Customer not on record"} · Due {formatDateTally(inv.due_date)}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[13.5px] font-medium text-ink tabular-nums">{rupees(Number(inv.total_amount || 0))}</div>
                      <span className={`mt-0.5 inline-flex items-center h-[22px] px-2 rounded-chip text-xs font-medium ${st.chip}`}>
                        {st.label}
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        {open.length > shown.length && (
          <p className="mt-2 text-[12.5px] text-ink-muted">
            {open.length - shown.length} more open in{" "}
            <Link href="/gst" className="text-brand-strong hover:underline">
              Sales & GST invoices
            </Link>
          </p>
        )}
      </div>
    );
  }
  return (
    <section className="rounded-panel border border-line bg-surface min-w-0">
      {head}
      {body}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Where the money goes                                                */
/* ------------------------------------------------------------------ */

/** Expense heads with a debit balance, largest first, each with its share of their total. */
export function expenseShares(rows: ProfitLossRow[]) {
  const heads = rows
    .filter((r) => r.account_type === "expense" && Number(r.net_amount) > 0)
    .map((r) => ({ id: r.account_id || r.account_code, name: r.account_name, amount: Number(r.net_amount) }))
    .sort((a, b) => b.amount - a.amount);
  const total = heads.reduce((s, h) => s + h.amount, 0);
  return { total, heads: heads.map((h) => ({ ...h, pct: total ? (h.amount / total) * 100 : 0 })) };
}

const pctText = (p: number) => (p > 0 && p < 0.1 ? "<0.1%" : `${Math.round(p * 10) / 10}%`);

export function WhereMoneyGoes({
  slot,
  payables,
}: {
  slot: Slot<ProfitLossRow[]>;
  /** Creditor ledger balance from the KPI snapshot; null when it couldn't be read. */
  payables: { amount: string; count: number } | null;
}) {
  const head = (
    <PanelHead
      title="Where the money goes"
      sub="Expense heads this financial year, from posted vouchers"
      href="/reports/operating-expenses"
      linkText="Expense report"
    />
  );
  let body: React.ReactNode;
  const empty = (title: string, text: string) => (
    <EmptyState icon={<Wallet className="h-4 w-4" />} title={title} body={text} href="/vouchers/payment" action="Record a payment (F5)" />
  );
  if (!slot) body = <Loading />;
  else if (!slot.rows) body = empty("Expenses could not be loaded", slot.error);
  else {
    const { total, heads } = expenseShares(slot.rows);
    if (!heads.length)
      body = empty(
        "No expenses posted this year",
        "Each expense head and its share of spending will show here once payments or purchase vouchers are posted."
      );
    else {
      // shortcut: heads past the sixth fold into one row; fine for a summary, the expense report has them all.
      const top = heads.slice(0, 6);
      const rest = heads.slice(6);
      const lines = rest.length
        ? [
            ...top,
            {
              id: "other",
              name: `${rest.length} other ${rest.length === 1 ? "head" : "heads"}`,
              amount: rest.reduce((s, h) => s + h.amount, 0),
              pct: rest.reduce((s, h) => s + h.pct, 0),
            },
          ]
        : top;
      body = (
        <div className="p-5 pt-4">
          <ul className="space-y-3.5">
            {lines.map((h) => (
              <li key={h.id}>
                <div className="flex items-baseline gap-3 text-[13.5px]">
                  <span className="min-w-0 flex-1 truncate text-ink">{h.name}</span>
                  <span className="tabular-nums text-ink">{rupees(h.amount)}</span>
                  <span className="w-14 text-right tabular-nums text-ink-muted">{pctText(h.pct)}</span>
                </div>
                <div className="mt-1.5 h-1.5 rounded-[3px] bg-canvas-sunken overflow-hidden">
                  <div className="h-full rounded-[3px] bg-brand-strong" style={{ width: `${h.pct}%` }} />
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-4 pt-3.5 border-t border-line flex items-baseline gap-3 text-[13.5px]">
            <span className="flex-1 text-ink-soft">Total spent</span>
            <span className="ledger-total font-semibold tabular-nums text-ink">{rupees(total)}</span>
          </div>
        </div>
      );
    }
  }
  return (
    <section className="rounded-panel border border-line bg-surface min-w-0 flex flex-col">
      {head}
      <div className="flex-1">{body}</div>
      <Link
        href="/reports/creditors"
        className="mx-5 mb-5 flex items-center gap-3 rounded-[10px] bg-canvas px-3.5 py-3 hover:bg-brand-wash transition-colors"
      >
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-[550] text-ink">Bills awaiting payment</div>
          <div className="text-[12.5px] text-ink-muted">
            {payables ? `${payables.count} ${payables.count === 1 ? "vendor" : "vendors"} owed, per the creditors ledger` : "Creditors ledger not read yet"}
          </div>
        </div>
        <span className="text-[15px] font-semibold tabular-nums text-ink">{payables?.amount ?? "–"}</span>
      </Link>
    </section>
  );
}
