"use client";

import React, { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { notesApi } from "@/api/endpoints";
import { NoteType, SalesInvoice } from "@/types/accounting";
import { formatINR } from "@/lib/formatters/currency";
import { formatDateTally, toISODateString } from "@/lib/formatters/date";
import { NOTE_REASONS, noteLines } from "@/lib/invoices/notes";

const selectClass =
  "w-full h-9 rounded-md border border-line-strong bg-surface px-2.5 text-sm text-ink focus:border-brand focus:outline-none focus:ring-3 focus:ring-brand/20";
const cellClass =
  "w-24 h-8 rounded border border-line-strong bg-surface px-2 text-right font-mono text-xs text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20";

interface Props {
  orgId: string;
  /** An issued invoice with its lines. */
  invoice: SalesInvoice;
  noteType: NoteType;
  onCreated: () => void;
  onCancel: () => void;
}

/** Credit or debit note pre-filled from the invoice; the database enforces the cap and tax split on issue. */
export function SalesNoteEditor({ orgId, invoice, noteType, onCreated, onCancel }: Props) {
  const origLines = invoice.sales_invoice_lines ?? [];
  const [noteNumber, setNoteNumber] = useState("");
  const [noteDate, setNoteDate] = useState(() => toISODateString());
  const [reasonCode, setReasonCode] = useState("");
  const [reason, setReason] = useState("");
  const [quantities, setQuantities] = useState<string[]>(() => origLines.map((l) => String(l.quantity)));
  const [errors, setErrors] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const title = noteType === "credit" ? "Credit note" : "Debit note";
  const lines = useMemo(() => noteLines(origLines, quantities.map(Number)), [origLines, quantities]);
  const totalPaise = lines.reduce((s, l) => s + Math.round(l.total_amount * 100), 0);
  const taxablePaise = lines.reduce((s, l) => s + Math.round(l.taxable_amount * 100), 0);

  const validate = (): string[] => {
    const msgs: string[] = [];
    if (!noteNumber.trim()) msgs.push("Enter a note number.");
    if (!noteDate) msgs.push("Enter the note date.");
    else if (noteDate < invoice.invoice_date) msgs.push("The note can't be dated before the invoice.");
    if (!reasonCode) msgs.push("Choose a reason.");
    if (reasonCode === "others" && !reason.trim()) msgs.push("Describe the reason.");
    quantities.forEach((q, i) => {
      const n = Number(q);
      if (q.trim() !== "" && !(n >= 0)) msgs.push(`Line ${i + 1}: quantity can't be negative.`);
      if (noteType === "credit" && n > Number(origLines[i].quantity))
        msgs.push(`Line ${i + 1}: a credit note can't return more than the ${origLines[i].quantity} invoiced.`);
    });
    if (lines.length === 0) msgs.push("Give at least one line a quantity.");
    return msgs;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const msgs = validate();
    setErrors(msgs);
    if (msgs.length > 0) return;
    setIsSaving(true);
    try {
      await notesApi.create(orgId, {
        original_invoice_id: invoice.id,
        note_type: noteType,
        note_number: noteNumber.trim(),
        note_date: noteDate,
        reason_code: reasonCode,
        reason: reason.trim() || undefined,
        lines,
      });
      onCreated();
    } catch (err) {
      setErrors([err instanceof Error ? err.message : `Couldn't save the ${title.toLowerCase()}.`]);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4" aria-label={`New ${title.toLowerCase()}`}>
      <div className="rounded-lg border border-line bg-surface p-5 shadow-card space-y-4">
        <div className="border-b border-line pb-3">
          <h3 className="text-sm font-semibold text-ink">
            {title} against {invoice.invoice_number}
          </h3>
          <p className="text-xs text-ink-muted">
            {invoice.parties?.legal_name ?? "Customer"} · invoice dated {formatDateTally(invoice.invoice_date)} · place of
            supply {invoice.place_of_supply}. Saved as a draft; issuing it posts the journal.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Input id="note-number" label="Note number" value={noteNumber} onChange={(e) => setNoteNumber(e.target.value)} />
          <Input id="note-date" label="Note date" type="date" min={invoice.invoice_date} value={noteDate}
            onChange={(e) => setNoteDate(e.target.value)} />
          <div className="space-y-1">
            <label htmlFor="note-reason" className="block text-xs font-medium text-ink-soft">Reason</label>
            <select id="note-reason" value={reasonCode} onChange={(e) => setReasonCode(e.target.value)} className={selectClass} required>
              <option value="">Select a reason</option>
              {NOTE_REASONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-3">
            <Input id="note-reason-text" label="Details (optional unless the reason is Others)" value={reason}
              onChange={(e) => setReason(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-line bg-surface shadow-card overflow-x-auto">
        <table className="w-full border-collapse text-left text-xs">
          <caption className="sr-only">Note lines</caption>
          <thead className="border-b border-line bg-canvas text-ink-muted">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">Item</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Invoiced qty</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Note qty</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Taxable</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {origLines.map((l, i) => {
              const n = noteLines([l], [Number(quantities[i])])[0];
              return (
                <tr key={i}>
                  <td className="px-3 py-1.5 text-ink">{l.item_name}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-ink-soft">{l.quantity}</td>
                  <td className="px-3 py-1.5 text-right">
                    <input aria-label={`Line ${i + 1} note quantity`} type="number" min="0" step="any" value={quantities[i]}
                      onChange={(e) => setQuantities((prev) => prev.map((q, j) => (j === i ? e.target.value : q)))}
                      className={cellClass} />
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono text-ink-soft">{n ? formatINR(n.taxable_amount) : "–"}</td>
                  <td className="px-3 py-1.5 text-right font-mono font-semibold text-ink">{n ? formatINR(n.total_amount) : "–"}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="border-t border-line">
            <tr>
              <td colSpan={3} className="px-3 py-2 text-right font-medium text-ink-soft">Note total</td>
              <td className="px-3 py-2 text-right font-mono text-ink-soft">{formatINR(taxablePaise / 100)}</td>
              <td className="px-3 py-2 text-right font-mono font-semibold text-ink">{formatINR(totalPaise / 100)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {errors.length > 0 && (
        <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
          <p className="mb-1 flex items-center gap-1.5 font-semibold">
            <AlertTriangle className="h-3.5 w-3.5" /> Fix these before saving
          </p>
          <ul className="list-disc space-y-0.5 pl-5">
            {errors.map((m) => <li key={m}>{m}</li>)}
          </ul>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="primary" size="sm" isLoading={isSaving}>Save draft {title.toLowerCase()}</Button>
      </div>
    </form>
  );
}
