"use client";

import React, { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { accountingApi } from "@/api/endpoints";
import { formatINR } from "@/lib/formatters/currency";
import type { VoucherItem } from "@/lib/reports/vouchers";
import { blankDraftLine, draftBalance, draftErrors, draftPayload, DraftLine, toDraftLine } from "@/lib/vouchers/edit-draft";
import type { Account } from "@/types/accounting";

const cellClass = "w-full h-8 rounded border border-slate-300 bg-white px-2 text-xs text-slate-900 focus:border-brand focus:outline-none";

interface Props {
  orgId: string;
  voucher: VoucherItem;
  accounts: Account[];
  onClose: () => void;
  onSaved: () => void;
}

export function EditDraftModal({ orgId, voucher, accounts, onClose, onSaved }: Props) {
  const [entryDate, setEntryDate] = useState(voucher.entry_date);
  const [narration, setNarration] = useState(voucher.narration);
  // A day book row shows the voucher number when there is no reference; don't save that as one.
  const [reference, setReference] = useState(voucher.reference === voucher.entry_number ? "" : voucher.reference);
  const [lines, setLines] = useState<DraftLine[]>(() =>
    voucher.lines.length ? voucher.lines.map(toDraftLine) : [blankDraftLine("Dr"), blankDraftLine("Cr")]
  );
  const [errors, setErrors] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const balance = draftBalance(lines);
  const setLine = (index: number, change: Partial<DraftLine>) =>
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...change } : l)));

  const save = async () => {
    const problems = draftErrors(entryDate, narration, lines);
    setErrors(problems);
    if (problems.length > 0) return;
    setIsSaving(true);
    try {
      await accountingApi.updateJournal(orgId, voucher.id, draftPayload(entryDate, narration, reference, lines));
      onSaved();
    } catch (err) {
      // The database is the authority (roles, period, approval state): show its reason.
      setErrors([err instanceof Error ? err.message : "Couldn't save the voucher."]);
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={`Edit draft ${voucher.entry_number}`} description="Saving replaces this draft's details and lines." maxWidth="2xl">
      <div className="space-y-3 font-sans text-xs">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label="Date" type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
          <Input label="Reference" value={reference} onChange={(e) => setReference(e.target.value)} />
        </div>
        <Input label="Narration" value={narration} onChange={(e) => setNarration(e.target.value)} />

        <div className="overflow-x-auto rounded border border-slate-300">
          <table className="w-full border-collapse text-left">
            <thead className="border-b border-slate-200 bg-slate-100 font-mono text-[11px] text-slate-700">
              <tr>
                <th scope="col" className="w-20 px-2 py-1.5">Dr / Cr</th>
                <th scope="col" className="px-2 py-1.5">Account</th>
                <th scope="col" className="w-32 px-2 py-1.5 text-right">Amount (₹)</th>
                <th scope="col" className="w-8 px-2 py-1.5"><span className="sr-only">Remove</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lines.map((line, idx) => (
                <tr key={idx}>
                  <td className="px-2 py-1.5">
                    <select aria-label={`Line ${idx + 1} debit or credit`} value={line.dr_cr} className={cellClass}
                      onChange={(e) => setLine(idx, { dr_cr: e.target.value as DraftLine["dr_cr"] })}>
                      <option value="Dr">Dr</option>
                      <option value="Cr">Cr</option>
                    </select>
                  </td>
                  <td className="px-2 py-1.5">
                    <select aria-label={`Line ${idx + 1} account`} value={line.account_id} className={cellClass}
                      onChange={(e) => setLine(idx, { account_id: e.target.value })}>
                      <option value="">Select an account</option>
                      {accounts
                        .filter((a) => a.id === line.account_id || (a.is_postable && a.is_active !== false))
                        .map((a) => (
                          <option key={a.id} value={a.id}>{a.code} {a.name}</option>
                        ))}
                    </select>
                  </td>
                  <td className="px-2 py-1.5">
                    <input aria-label={`Line ${idx + 1} amount in rupees`} type="number" min="0" step="0.01" value={line.amount}
                      onChange={(e) => setLine(idx, { amount: e.target.value })} className={`${cellClass} text-right font-mono`} />
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <button type="button" onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))} disabled={lines.length <= 2}
                      aria-label={`Remove line ${idx + 1}`} className="rounded p-1 text-slate-400 hover:text-rose-600 disabled:opacity-30">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-slate-200 p-1.5">
            <Button type="button" variant="ghost" size="sm" className="gap-1"
              onClick={() => setLines((prev) => [...prev, blankDraftLine(balance.debitPaise > balance.creditPaise ? "Cr" : "Dr")])}>
              <Plus className="h-3.5 w-3.5" /> Add line
            </Button>
          </div>
        </div>

        <div role="status" className={`flex flex-wrap items-center justify-between gap-2 rounded border p-2 font-mono ${
          balance.balanced ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-300 bg-amber-50 text-amber-900"}`}>
          <span>Debit {formatINR(balance.debitPaise / 100)} · Credit {formatINR(balance.creditPaise / 100)}</span>
          <span className="font-bold">
            {balance.balanced
              ? "Balanced"
              : `Out of balance by ${formatINR(balance.differencePaise / 100)}: it can be saved, but must balance before posting`}
          </span>
        </div>

        {errors.length > 0 && (
          <ul role="alert" className="list-disc space-y-0.5 rounded border border-rose-200 bg-rose-50 p-2 pl-6 text-rose-700">
            {errors.map((m) => <li key={m}>{m}</li>)}
          </ul>
        )}

        <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button type="button" variant="tally" size="sm" onClick={save} isLoading={isSaving}>Save changes</Button>
        </div>
      </div>
    </Modal>
  );
}
