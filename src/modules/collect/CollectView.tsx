"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Download, MessageCircle, Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { accountingApi, invoicesApi, organisationsApi, partiesApi } from "@/api/endpoints";
import type { Account, JournalEntry, Party } from "@/types/accounting";
import { useAuth } from "@/context/AuthContext";
import { formatINR } from "@/lib/formatters/currency";
import { formatDateTally, toISODateString } from "@/lib/formatters/date";
import { downloadFile, toCsv } from "@/lib/download";
import { monthEnd, useReturnPeriod } from "@/lib/gst/period";
import {
  CollectInvoice,
  CollectRow,
  CollectTab,
  collectRows,
  collectStats,
  inTab,
  msmeFlag,
  OVERDUE_ALERT_DAYS,
} from "@/lib/collect/receivables";
import { checkIndianMobile, reminderMessage, whatsappUrl } from "@/lib/collect/whatsapp";

interface Books {
  companyName: string | null;
  invoices: CollectInvoice[];
  accounts: Account[];
  journals: JournalEntry[];
  parties: Party[];
  asOf: string;
}

const TABS: { id: CollectTab; label: string; empty: string }[] = [
  { id: "uncollected", label: "Uncollected", empty: "Nothing is waiting to be collected." },
  { id: "overdue", label: "Overdue", empty: "No unpaid invoice is past its due date." },
  { id: "due7", label: "Due in 7 days", empty: "No unpaid invoice falls due in the next 7 days." },
  { id: "partial", label: "Partially paid", empty: "No invoice is partly paid." },
  { id: "paid", label: "Paid", empty: "No invoice is fully settled in the ledger yet." },
];

const rupees = (p: number) => formatINR(p / 100);

function statusText(r: CollectRow) {
  if (r.openPaise === null) return "Not posted to the ledger";
  if (r.openPaise <= 0) return "Paid";
  const part = r.openPaise < r.amountPaise ? "Partly paid · " : "";
  if (r.daysPastDue === null) return `${part}No due date`;
  if (r.daysPastDue > 0) return `${part}Overdue ${r.daysPastDue} d`;
  return `${part}${r.daysPastDue === 0 ? "Due today" : `Due in ${-r.daysPastDue} d`}`;
}

export function CollectView() {
  const { organisation } = useAuth();
  const { month, setMonth, fy } = useReturnPeriod();
  const [orgId, setOrgId] = useState("");
  const [books, setBooks] = useState<Books | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<CollectTab>("uncollected");
  const [query, setQuery] = useState("");

  useEffect(() => {
    setOrgId(localStorage.getItem("deku_active_org_id") || "");
  }, []);

  useEffect(() => {
    if (!orgId) return;
    let stale = false;
    setError(null);
    Promise.all([
      invoicesApi.list(orgId),
      accountingApi.listAccounts(orgId),
      accountingApi.listJournals(orgId),
      partiesApi.list(orgId),
      organisationsApi.get(orgId),
    ])
      .then(([inv, acc, jr, pa, org]) => {
        if (stale) return;
        setBooks({
          companyName: org.data?.[0]?.name ?? null,
          invoices: (inv.data ?? []) as CollectInvoice[],
          accounts: acc.data ?? [],
          journals: jr.data ?? [],
          parties: pa.data ?? [],
          asOf: toISODateString(),
        });
      })
      .catch((e) => !stale && setError((e as Error).message || "Could not load invoices and ledgers"));
    return () => {
      stale = true;
    };
  }, [orgId]);

  const { rows, hasControlAccount } = useMemo(
    () =>
      books
        ? collectRows(books.invoices, books.accounts, books.journals, books.parties, books.asOf)
        : { rows: [], hasControlAccount: false },
    [books]
  );
  const stats = useMemo(() => collectStats(rows, month ? monthEnd(month) : ""), [rows, month]);
  const counts = useMemo(
    () => Object.fromEntries(TABS.map((t) => [t.id, rows.filter((r) => inTab(r, t.id)).length])),
    [rows]
  );
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter((r) => inTab(r, tab))
      .filter(
        (r) =>
          !q ||
          r.invoice.invoice_number.toLowerCase().includes(q) ||
          r.partyName.toLowerCase().includes(q) ||
          (r.invoice.parties?.gstin ?? "").toLowerCase().includes(q)
      )
      .sort((a, b) => (b.daysPastDue ?? -Infinity) - (a.daysPastDue ?? -Infinity));
  }, [rows, tab, query]);

  const exportCsv = () => {
    const money = (p: number | null) => (p === null ? "–" : (p / 100).toFixed(2));
    const csv = toCsv([
      ["Invoice", "Customer", "GSTIN", "Invoice date", "Due date", "Invoice amount", "Due now", "Status"],
      ...visible.map((r) => [
        r.invoice.invoice_number,
        r.partyName,
        r.invoice.parties?.gstin || "–",
        r.invoice.invoice_date,
        r.invoice.due_date || "–",
        money(r.amountPaise),
        money(r.openPaise),
        statusText(r),
      ]),
    ]);
    downloadFile(`collect_${tab}_${books?.asOf ?? ""}.csv`, csv, "text/csv;charset=utf-8");
  };

  if (!orgId) return <p className="text-sm text-ink-muted">Select a company to see what customers owe it.</p>;
  if (error)
    return (
      <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
        {error}. No figures are shown.
      </div>
    );
  if (!books) return <p className="text-sm text-ink-muted">Loading invoices and ledgers…</p>;
  if (!rows.length)
    return (
      <p className="rounded-xl border border-line bg-surface p-6 text-sm text-ink-muted shadow-card">
        No issued sales invoices yet, so there is nothing to collect. Issue one from{" "}
        <a className="font-medium text-brand-strong underline" href="/invoices">Invoices</a>.
      </p>
    );

  const upiId = organisation?.upi_vpa ?? null;

  return (
    <div className="space-y-5">
      {!hasControlAccount && (
        <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          The chart of accounts has no trade debtors ledger (code 1030, or named Trade debtors / Accounts
          receivable), so payments can&apos;t be matched to invoices and amounts due show &ldquo;–&rdquo;. Add one in{" "}
          <a className="font-semibold underline" href="/masters/chart-of-accounts">Chart of accounts</a>.
        </div>
      )}
      {hasControlAccount && stats.unposted > 0 && (
        <p className="text-xs text-ink-muted">
          {stats.unposted} issued invoice{stats.unposted === 1 ? " has" : "s have"} no posted journal entry, so
          {stats.unposted === 1 ? " its" : " their"} amount due is unknown (&ldquo;–&rdquo;) and left out of the totals.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total uncollected" value={rupees(stats.uncollectedPaise)} note="Open on the debtors ledger" />
        <Stat
          label={`Overdue more than ${OVERDUE_ALERT_DAYS} days`}
          value={rupees(stats.overdue15Paise)}
          note="Past the invoice due date"
        />
        <Stat label="Due in next 7 days" value={rupees(stats.due7Paise)} note="Not yet overdue" />
        {stats.gstAtRiskPaise !== null && month && (
          <Stat
            label="GST at risk"
            value={rupees(stats.gstAtRiskPaise)}
            note={`Output GST on unpaid invoices dated up to ${formatDateTally(monthEnd(month))}: payable with your return even if the buyer never pays`}
          />
        )}
      </div>

      <div className="rounded-xl border border-line bg-surface shadow-card">
        <div className="flex flex-col gap-3 border-b border-line p-3 lg:flex-row lg:items-end lg:justify-between">
          <div role="tablist" aria-label="Invoice status" className="flex flex-wrap gap-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                id={`collect-tab-${t.id}`}
                aria-selected={tab === t.id}
                aria-controls="collect-panel"
                onClick={() => setTab(t.id)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                  tab === t.id ? "bg-ink text-white" : "text-ink-muted hover:bg-canvas-sunken hover:text-ink"
                }`}
              >
                {t.label} <span className="font-mono text-xs">{counts[t.id]}</span>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="w-44">
              <Input
                label={fy ? `GST period (FY ${fy})` : "GST period"}
                id="collect-period"
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              />
            </div>
            <div className="w-56">
              <Input
                label="Search"
                id="collect-search"
                placeholder="Invoice, customer or GSTIN"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <Button variant="secondary" size="md" onClick={exportCsv} disabled={!visible.length}>
              <Download className="h-4 w-4" /> Export CSV
            </Button>
          </div>
        </div>

        <div id="collect-panel" role="tabpanel" aria-labelledby={`collect-tab-${tab}`} className="overflow-x-auto">
          {visible.length === 0 ? (
            <p className="p-6 text-sm text-ink-muted">
              {query.trim() ? `No invoice in this view matches "${query.trim()}".` : TABS.find((t) => t.id === tab)!.empty}
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-ink-muted">
                  <th scope="col" className="px-3 py-2 font-semibold">Invoice</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Customer</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Due date</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">Invoice amount</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">Due now</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Status</th>
                  <th scope="col" className="px-3 py-2 font-semibold"><span className="sr-only">Reminder</span></th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <Row key={r.invoice.id} r={r} companyName={books.companyName} upiId={upiId} />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4 shadow-card">
      <div className="text-xs font-medium text-ink-muted">{label}</div>
      <div className="mt-1 font-mono text-xl font-semibold text-ink">{value}</div>
      <div className="mt-1 text-[11px] text-ink-subtle">{note}</div>
    </div>
  );
}

function Row({ r, companyName, upiId }: { r: CollectRow; companyName: string | null; upiId: string | null }) {
  const msme = msmeFlag(r);
  const owed = (r.openPaise ?? 0) > 0;
  const phone = checkIndianMobile(r.phone);
  const reasonId = `wa-reason-${r.invoice.id}`;
  return (
    <tr className="border-b border-line align-top last:border-0">
      <td className="px-3 py-2">
        <div className="font-medium text-ink">{r.invoice.invoice_number}</div>
        <div className="text-xs text-ink-muted">{formatDateTally(r.invoice.invoice_date)}</div>
      </td>
      <td className="px-3 py-2">
        <div className="text-ink">{r.partyName}</div>
        {r.invoice.parties?.gstin && <div className="font-mono text-xs text-ink-muted">{r.invoice.parties.gstin}</div>}
        {msme && (
          <div className="mt-1 flex items-start gap-1 text-xs text-amber-800">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>
              Unpaid {r.invoiceAgeDays} days. If you are a Udyam-registered micro or small enterprise, Sec 43B(h):
              buyer can&apos;t deduct this expense until paid.
            </span>
          </div>
        )}
      </td>
      <td className="px-3 py-2 text-ink-soft">
        {r.invoice.due_date ? formatDateTally(r.invoice.due_date) : <span title="No due date on this invoice">–</span>}
      </td>
      <td className="px-3 py-2 text-right font-mono text-ink">{rupees(r.amountPaise)}</td>
      <td className="px-3 py-2 text-right font-mono text-ink">
        {r.openPaise === null ? <span title="Not posted to the ledger, so payments can't be matched">–</span> : rupees(r.openPaise)}
      </td>
      <td className="px-3 py-2">
        <Badge
          variant={
            r.openPaise === null ? "default" : !owed ? "success" : (r.daysPastDue ?? 0) > 0 ? "danger" : "outline"
          }
        >
          {statusText(r)}
        </Badge>
      </td>
      <td className="px-3 py-2 text-right">
        {owed &&
          (phone.ok ? (
            <a
              href={whatsappUrl(
                phone.waNumber,
                reminderMessage({
                  companyName,
                  customerName: r.partyName,
                  invoiceNumber: r.invoice.invoice_number,
                  amountDuePaise: r.openPaise!,
                  dueDate: r.invoice.due_date || null,
                  upiId,
                  msme45: msme,
                })
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-7 items-center gap-1.5 rounded-md border border-line-strong bg-surface px-2.5 text-xs font-medium text-ink shadow-card hover:bg-canvas"
            >
              <MessageCircle className="h-4 w-4" aria-hidden /> WhatsApp reminder
            </a>
          ) : (
            <span title={phone.reason} tabIndex={0} aria-describedby={reasonId} className="inline-block rounded-md">
              <Button variant="secondary" size="sm" disabled aria-describedby={reasonId}>
                <MessageCircle className="h-4 w-4" aria-hidden /> WhatsApp reminder
              </Button>
              <span id={reasonId} className="sr-only">{phone.reason}</span>
            </span>
          ))}
      </td>
    </tr>
  );
}
