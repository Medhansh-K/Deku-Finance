"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Inbox, RotateCcw, ShieldCheck, XCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { accountingApi, organisationsApi } from "@/api/endpoints";
import { Account, JournalEntry } from "@/types/accounting";
import { formatINR } from "@/lib/formatters/currency";
import { formatDateTally } from "@/lib/formatters/date";
import { approvalQueues, canApprove, entryTotal } from "@/lib/vouchers/approvals";
import { useAuth } from "@/context/AuthContext";

export function ApprovalsView() {
  const { user } = useAuth();
  const [orgId, setOrgId] = useState("");
  const [requireApproval, setRequireApproval] = useState<boolean | null>(null);
  const [journals, setJournals] = useState<JournalEntry[]>([]);
  const [accounts, setAccounts] = useState<Record<string, Account>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  useEffect(() => {
    setOrgId(localStorage.getItem("deku_active_org_id") || "");
  }, []);

  const load = useCallback(async () => {
    if (!orgId) return;
    setError(null);
    try {
      const [j, a, o] = await Promise.all([
        accountingApi.listJournals(orgId),
        accountingApi.listAccounts(orgId),
        organisationsApi.get(orgId),
      ]);
      setJournals(j.data || []);
      setAccounts(Object.fromEntries((a.data || []).map((acc) => [acc.id, acc])));
      setRequireApproval(o.data?.[0]?.require_journal_approval ?? false);
    } catch (e) {
      setError((e as Error).message || "Could not load vouchers");
    }
  }, [orgId]);

  useEffect(() => {
    load();
  }, [load]);

  const queues = useMemo(() => approvalQueues(journals), [journals]);
  const selected = journals.find((j) => j.id === selectedId) ?? queues.awaiting[0] ?? null;

  const act = async (fn: () => Promise<unknown>, done: string) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      setNotice(done);
      setSelectedId(null);
      await load();
    } catch (e) {
      // The database is the authority (roles, maker-checker, balance, period): show its reason.
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const approve = (e: JournalEntry) =>
    act(() => accountingApi.postJournal(orgId, e.id), `Voucher ${e.entry_number} approved and posted.`);

  const reject = (e: JournalEntry) =>
    act(async () => {
      await accountingApi.rejectJournal(orgId, e.id, reason.trim());
      setRejecting(false);
      setReason("");
    }, `Voucher ${e.entry_number} sent back to its maker.`);

  if (!orgId) {
    return <p className="text-sm text-ink-muted">Select a company to see its approval queue.</p>;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_1fr]">
      <section aria-label="Approval queue" className="space-y-4">
        {requireApproval === false && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
            Approvals are off for this company, so vouchers post directly. An owner or admin can turn on
            maker-checker in <a className="font-semibold underline" href="/settings">Settings</a>.
          </div>
        )}

        <QueueList
          title="Awaiting approval"
          icon={<Inbox className="h-4 w-4" />}
          entries={queues.awaiting}
          selectedId={selected?.id}
          onSelect={setSelectedId}
          empty="Nothing is waiting for approval."
        />
        <QueueList
          title="Sent back"
          icon={<RotateCcw className="h-4 w-4" />}
          entries={queues.returned}
          selectedId={selected?.id}
          onSelect={setSelectedId}
          empty="No vouchers were sent back."
        />
      </section>

      <section aria-label="Voucher detail" className="rounded-xl border border-line bg-surface p-4 shadow-sm">
        {notice && (
          <div role="status" className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-xs text-emerald-900">
            {notice}
          </div>
        )}
        {error && (
          <div role="alert" className="mb-3 rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-800">
            {error}
          </div>
        )}

        {!selected ? (
          <div className="py-16 text-center text-sm text-ink-muted">
            <ShieldCheck className="mx-auto mb-2 h-8 w-8 text-slate-300" />
            Select a voucher to review it.
          </div>
        ) : (
          <div className="space-y-4">
            <header className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-ink">{selected.entry_number}</h2>
                <p className="text-xs text-ink-muted">
                  {formatDateTally(selected.entry_date)}
                  {selected.reference ? ` · Ref ${selected.reference}` : ""}
                </p>
                <p className="mt-1 text-sm text-ink-soft">{selected.narration}</p>
              </div>
              <div className="text-right">
                <div className="text-xs uppercase tracking-wider text-ink-muted">Voucher total</div>
                <div className="font-mono text-xl font-bold text-ink">{formatINR(entryTotal(selected))}</div>
              </div>
            </header>

            {selected.rejection_reason && !selected.submitted_at && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-800">
                <span className="font-semibold">Sent back:</span> {selected.rejection_reason}
              </div>
            )}

            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-ink-muted">
                  <th className="py-2 font-semibold">Account</th>
                  <th className="py-2 font-semibold">Description</th>
                  <th className="py-2 text-right font-semibold">Debit</th>
                  <th className="py-2 text-right font-semibold">Credit</th>
                </tr>
              </thead>
              <tbody>
                {selected.journal_entry_lines
                  .slice()
                  .sort((a, b) => a.line_number - b.line_number)
                  .map((l) => (
                    <tr key={l.id ?? l.line_number} className="border-b border-line">
                      <td className="py-2 font-medium text-ink">
                        {accounts[l.account_id]?.name ?? "Unknown account"}
                        <span className="ml-1 font-mono text-xs text-ink-subtle">{accounts[l.account_id]?.code}</span>
                      </td>
                      <td className="py-2 text-ink-soft">{l.description || "–"}</td>
                      <td className="py-2 text-right font-mono">{Number(l.debit) ? formatINR(Number(l.debit)) : "–"}</td>
                      <td className="py-2 text-right font-mono">{Number(l.credit) ? formatINR(Number(l.credit)) : "–"}</td>
                    </tr>
                  ))}
              </tbody>
            </table>

            {selected.submitted_at && (
              <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
                <p className="text-xs text-ink-muted">
                  {canApprove(selected, user?.id)
                    ? "Approving posts this voucher to the ledger. Posted vouchers can only be reversed, not edited."
                    : "You made or submitted this voucher, so another approver must review it."}
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={busy} onClick={() => setRejecting(true)}>
                    <XCircle className="h-4 w-4" /> Send back
                  </Button>
                  <Button size="sm" disabled={busy || !canApprove(selected, user?.id)} onClick={() => approve(selected)}>
                    <CheckCircle2 className="h-4 w-4" /> Approve &amp; post
                  </Button>
                </div>
              </footer>
            )}

            <Modal
              isOpen={rejecting}
              onClose={() => setRejecting(false)}
              title={`Send back ${selected.entry_number}`}
              description="The maker sees this reason and can fix and resubmit the voucher."
            >
              <label className="block text-xs font-semibold text-ink-soft" htmlFor="reject-reason">
                Reason
              </label>
              <textarea
                id="reject-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-md border border-line-strong p-2 text-sm"
                placeholder="e.g. GST should be IGST, the supplier is in Karnataka"
              />
              <div className="mt-3 flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setRejecting(false)}>
                  Cancel
                </Button>
                <Button variant="danger" size="sm" disabled={busy || !reason.trim()} onClick={() => reject(selected)}>
                  Send back
                </Button>
              </div>
            </Modal>
          </div>
        )}
      </section>
    </div>
  );
}

function QueueList({
  title,
  icon,
  entries,
  selectedId,
  onSelect,
  empty,
}: {
  title: string;
  icon: React.ReactNode;
  entries: JournalEntry[];
  selectedId?: string;
  onSelect: (id: string) => void;
  empty: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface shadow-sm">
      <h2 className="flex items-center gap-2 border-b border-line px-3 py-2 text-sm font-semibold text-ink">
        {icon} {title}
        <Badge variant={entries.length ? "warning" : "default"} className="ml-auto">
          {entries.length}
        </Badge>
      </h2>
      {entries.length === 0 ? (
        <p className="px-3 py-4 text-xs text-ink-muted">{empty}</p>
      ) : (
        <ul>
          {entries.map((e) => (
            <li key={e.id}>
              <button
                onClick={() => onSelect(e.id)}
                aria-current={e.id === selectedId}
                className={`flex w-full items-center justify-between gap-2 border-b border-line px-3 py-2 text-left text-sm last:border-0 hover:bg-canvas ${
                  e.id === selectedId ? "bg-canvas-sunken" : ""
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-ink">{e.entry_number}</span>
                  <span className="block truncate text-xs text-ink-muted">{e.narration}</span>
                </span>
                <span className="shrink-0 font-mono text-xs text-ink-soft">{formatINR(entryTotal(e))}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
