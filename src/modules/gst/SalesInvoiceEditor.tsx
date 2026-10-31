"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Plus, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { invoicesApi } from "@/api/endpoints";
import { useAuth } from "@/context/AuthContext";
import { CreateInvoiceRequest, Party } from "@/types/accounting";
import { formatINR } from "@/lib/formatters/currency";
import { toISODateString } from "@/lib/formatters/date";
import { numberToIndianWords } from "@/lib/builder/number-to-words";
import { isValidGstin } from "@/lib/vouchers/invoice-text-parser";
import {
  GST_STATES,
  computeTaxSummary,
  isInterState,
  placeOfSupplyLabel,
  stateCodeOf,
  toPaise,
} from "@/lib/invoices/tax-summary";
import {
  SALES_CHANNELS,
  SalesChannel,
  settlementErrors,
  settlementFromOrg,
} from "@/lib/invoices/settlement";
import { InvoiceSettlementBlock } from "./InvoiceSettlementBlock";
import { HsnCombobox } from "@/modules/hsn/HsnCombobox";
import { hsnCodeError } from "@/modules/hsn/hsn";

interface EditorLine {
  item_name: string;
  hsn_sac_code: string;
  quantity: string;
  unit_price: string;
  gst_rate: string;
}

const blankLine = (): EditorLine => ({ item_name: "", hsn_sac_code: "", quantity: "1", unit_price: "", gst_rate: "18" });
const GST_RATES = ["0", "0.25", "3", "5", "12", "18", "28"];
const rs = (paise: number) => formatINR(paise / 100);

const selectClass =
  "w-full h-9 rounded-md border border-line-strong bg-surface px-2.5 text-sm text-ink focus:border-brand focus:outline-none focus:ring-3 focus:ring-brand/20";
const cellClass =
  "w-full h-8 rounded border border-line-strong bg-surface px-2 text-xs text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20";

interface Props {
  orgId: string;
  customers: Party[];
  onCreated: (invoiceNumber: string) => void;
  onCancel: () => void;
}

export function SalesInvoiceEditor({ orgId, customers, onCreated, onCancel }: Props) {
  const { organisation } = useAuth();

  const [customerId, setCustomerId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(() => toISODateString());
  const [dueDate, setDueDate] = useState(() => toISODateString());
  const [posCode, setPosCode] = useState("");
  const [salesChannel, setSalesChannel] = useState<SalesChannel>("direct");
  const [roundToRupee, setRoundToRupee] = useState(true);
  const [lines, setLines] = useState<EditorLine[]>([blankLine()]);
  const [errors, setErrors] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const gridRef = useRef<HTMLTableSectionElement>(null);
  const focusNewLine = useRef(false);

  useEffect(() => {
    if (!focusNewLine.current) return;
    focusNewLine.current = false;
    const fields = gridRef.current?.querySelectorAll<HTMLElement>("[data-grid-field]");
    fields?.[fields.length - 5]?.focus();
  }, [lines.length]);

  const settlement = settlementFromOrg(organisation);
  const customer = customers.find((c) => c.id === customerId);
  const companyGstin = organisation?.gstin ?? "";
  const companyState = isValidGstin(companyGstin) ? stateCodeOf(companyGstin) : "";
  const interState = !!companyState && !!posCode && isInterState(companyState, posCode);
  const payee = settlement.beneficiaryName || organisation?.legal_name || organisation?.name || "";

  const summary = useMemo(
    () =>
      computeTaxSummary(
        lines.map((l) => ({ quantity: Number(l.quantity), unitPrice: Number(l.unit_price), gstRate: Number(l.gst_rate) })),
        { interState, roundToRupee }
      ),
    [lines, interState, roundToRupee]
  );

  const settlementErrs = settlementErrors(settlement);

  const updateLine = (index: number, field: keyof EditorLine, value: string) =>
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, [field]: value } : l)));

  const addLine = () => setLines((prev) => [...prev, blankLine()]);

  const chooseCustomer = (id: string) => {
    setCustomerId(id);
    const code = stateCodeOf(customers.find((c) => c.id === id)?.gstin);
    if (code) setPosCode(code);
  };

  const validate = (): string[] => {
    const msgs: string[] = [];
    if (!customer) msgs.push("Choose a customer.");
    else if (customer.gstin && !isValidGstin(customer.gstin))
      msgs.push(`Customer GSTIN ${customer.gstin} is not valid. Correct it in Parties, or clear it for a B2C sale.`);
    if (!invoiceNumber.trim()) msgs.push("Enter an invoice number.");
    if (!invoiceDate) msgs.push("Enter the invoice date.");
    if (!dueDate) msgs.push("Enter the due date.");
    else if (invoiceDate && dueDate < invoiceDate) msgs.push("Due date can't be before the invoice date.");
    if (!companyState)
      msgs.push("Your company has no valid GSTIN, so CGST/SGST or IGST can't be decided. Add it to the company first.");
    if (!posCode) msgs.push("Choose the place of supply.");
    lines.forEach((l, i) => {
      const n = i + 1;
      if (!l.item_name.trim()) msgs.push(`Line ${n}: enter the item or service.`);
      if (hsnCodeError(l.hsn_sac_code)) msgs.push(`Line ${n}: ${hsnCodeError(l.hsn_sac_code)}`);
      if (!(Number(l.quantity) > 0)) msgs.push(`Line ${n}: quantity must be more than zero.`);
      if (l.unit_price.trim() === "" || !(Number(l.unit_price) >= 0)) msgs.push(`Line ${n}: enter a rate.`);
    });
    Object.values(settlementErrs).forEach((m) => msgs.push(`Payment details: ${m}.`));
    return msgs;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const msgs = validate();
    setErrors(msgs);
    if (msgs.length > 0) return;

    const cgstRate = (rate: number) => (interState ? 0 : rate / 2);
    const payload: CreateInvoiceRequest = {
      customer_id: customerId,
      invoice_number: invoiceNumber.trim(),
      invoice_date: invoiceDate,
      due_date: dueDate,
      supply_type: interState ? "inter_state" : "intra_state",
      place_of_supply: placeOfSupplyLabel(posCode),
      sales_channel: salesChannel,
      taxable_amount: summary.taxable / 100,
      round_off: summary.roundOff / 100,
      total_amount: summary.grandTotal / 100,
      lines: lines.map((l, i) => {
        const t = summary.lines[i];
        const rate = Number(l.gst_rate);
        return {
          line_number: i + 1,
          item_name: l.item_name.trim(),
          hsn_sac_code: l.hsn_sac_code.trim() || null,
          unit_code: "OTH",
          quantity: Number(l.quantity),
          unit_price: toPaise(Number(l.unit_price)) / 100,
          discount_amount: 0,
          taxable_amount: t.taxable / 100,
          gst_rate: rate,
          cgst_rate: cgstRate(rate),
          cgst_amount: t.cgst / 100,
          sgst_rate: cgstRate(rate),
          sgst_amount: t.sgst / 100,
          igst_rate: interState ? rate : 0,
          igst_amount: t.igst / 100,
          cess_rate: 0,
          cess_amount: t.cess / 100,
          total_amount: t.total / 100,
        };
      }),
    };

    setIsSaving(true);
    try {
      await invoicesApi.create(orgId, payload);
      onCreated(payload.invoice_number);
    } catch (err) {
      setErrors([err instanceof Error ? err.message : "Couldn't save the invoice."]);
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (e.key !== "Enter") return;
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      e.currentTarget.requestSubmit();
      return;
    }
    const target = e.target as HTMLElement;
    if (target.tagName === "BUTTON" || target.tagName === "TEXTAREA") return;
    // Plain Enter never submits; in the line grid it moves to the next field like Tally.
    e.preventDefault();
    const fields = Array.from(gridRef.current?.querySelectorAll<HTMLElement>("[data-grid-field]") ?? []);
    const at = fields.indexOf(target);
    if (at === -1) return;
    if (at === fields.length - 1) {
      focusNewLine.current = true;
      addLine();
    } else {
      fields[at + 1].focus();
    }
  };

  const supplyNote = !companyState
    ? "Add your company GSTIN to decide CGST/SGST or IGST."
    : !posCode
      ? "Choose a place of supply."
      : interState
        ? `Inter-state supply to ${placeOfSupplyLabel(posCode)}: IGST`
        : `Intra-state supply within ${placeOfSupplyLabel(posCode)}: CGST + SGST`;

  return (
    <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} noValidate className="space-y-4" aria-label="New sales invoice">
      <div className="rounded-lg border border-line bg-surface p-5 shadow-card space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-line pb-3">
          <div>
            <h3 className="text-sm font-semibold text-ink">New sales invoice</h3>
            <p className="text-xs text-ink-muted">Saved as a draft. Issuing it posts the journal to your ledger.</p>
          </div>
          <p className="text-[11px] text-ink-muted" aria-label="Keyboard shortcuts">
            <kbd className="rounded border border-line-strong bg-canvas px-1 font-mono">Enter</kbd> next field ·{" "}
            <kbd className="rounded border border-line-strong bg-canvas px-1 font-mono">Ctrl</kbd>+
            <kbd className="rounded border border-line-strong bg-canvas px-1 font-mono">Enter</kbd> save draft
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <label htmlFor="inv-customer" className="block text-xs font-medium text-ink-soft">Customer</label>
            <select id="inv-customer" value={customerId} onChange={(e) => chooseCustomer(e.target.value)} className={selectClass}>
              <option value="">Select a customer</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.legal_name} {c.gstin ? `(${c.gstin})` : "(unregistered)"}
                </option>
              ))}
            </select>
            {customers.length === 0 && <p className="text-xs text-ink-muted">Add customers under Parties first.</p>}
          </div>
          <Input id="inv-number" label="Invoice number" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <Input id="inv-date" label="Invoice date" type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
            <Input id="inv-due" label="Due date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label htmlFor="inv-pos" className="block text-xs font-medium text-ink-soft">Place of supply</label>
            <select id="inv-pos" value={posCode} onChange={(e) => setPosCode(e.target.value)} className={selectClass}>
              <option value="">Select a state</option>
              {GST_STATES.map(([code, name]) => (
                <option key={code} value={code}>
                  {code} {name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="inv-channel" className="block text-xs font-medium text-ink-soft">Sales channel</label>
            <select
              id="inv-channel"
              value={salesChannel}
              onChange={(e) => setSalesChannel(e.target.value as SalesChannel)}
              className={selectClass}
            >
              {SALES_CHANNELS.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <span className="block text-xs font-medium text-ink-soft">Company GSTIN</span>
            <p className="h-9 flex items-center font-mono text-sm text-ink">{companyGstin || <span className="font-sans text-ink-muted">Not set</span>}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_300px]">
        <div className="space-y-4 min-w-0">
          <div className="rounded-lg border border-line bg-surface shadow-card overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <caption className="sr-only">Invoice lines</caption>
              <thead className="border-b border-line bg-canvas text-ink-muted">
                <tr>
                  <th scope="col" className="w-8 px-2 py-2 font-medium">#</th>
                  <th scope="col" className="px-2 py-2 font-medium">Item or service</th>
                  <th scope="col" className="w-24 px-2 py-2 font-medium">HSN/SAC</th>
                  <th scope="col" className="w-20 px-2 py-2 text-right font-medium">Qty</th>
                  <th scope="col" className="w-28 px-2 py-2 text-right font-medium">Rate (₹)</th>
                  <th scope="col" className="w-20 px-2 py-2 text-right font-medium">GST %</th>
                  <th scope="col" className="w-28 px-2 py-2 text-right font-medium">Taxable</th>
                  <th scope="col" className="w-28 px-2 py-2 text-right font-medium">Total</th>
                  <th scope="col" className="w-8 px-2 py-2"><span className="sr-only">Remove</span></th>
                </tr>
              </thead>
              <tbody ref={gridRef} className="divide-y divide-line">
                {lines.map((line, idx) => {
                  const n = idx + 1;
                  const t = summary.lines[idx];
                  return (
                    <tr key={idx}>
                      <td className="px-2 py-1.5 font-mono text-ink-muted">{n}</td>
                      <td className="px-2 py-1.5">
                        <input data-grid-field aria-label={`Line ${n} item or service`} value={line.item_name}
                          onChange={(e) => updateLine(idx, "item_name", e.target.value)} className={cellClass} />
                      </td>
                      <td className="px-2 py-1.5">
                        <HsnCombobox ariaLabel={`Line ${n} HSN or SAC`} value={line.hsn_sac_code}
                          onChange={(code) => updateLine(idx, "hsn_sac_code", code)} inputClassName={cellClass}
                          inputProps={{ "data-grid-field": true }} />
                      </td>
                      <td className="px-2 py-1.5">
                        <input data-grid-field aria-label={`Line ${n} quantity`} type="number" min="0" step="any" value={line.quantity}
                          onChange={(e) => updateLine(idx, "quantity", e.target.value)} className={`${cellClass} text-right font-mono`} />
                      </td>
                      <td className="px-2 py-1.5">
                        <input data-grid-field aria-label={`Line ${n} rate in rupees`} type="number" min="0" step="0.01" value={line.unit_price}
                          onChange={(e) => updateLine(idx, "unit_price", e.target.value)} className={`${cellClass} text-right font-mono`} />
                      </td>
                      <td className="px-2 py-1.5">
                        <select data-grid-field aria-label={`Line ${n} GST rate`} value={line.gst_rate}
                          onChange={(e) => updateLine(idx, "gst_rate", e.target.value)} className={`${cellClass} text-right font-mono`}>
                          {GST_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono text-ink-soft">{rs(t.taxable)}</td>
                      <td className="px-2 py-1.5 text-right font-mono font-semibold text-ink">{rs(t.total)}</td>
                      <td className="px-2 py-1.5 text-center">
                        <button type="button" onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}
                          disabled={lines.length === 1} aria-label={`Remove line ${n}`}
                          className="rounded p-1 text-ink-subtle hover:text-rose-600 disabled:opacity-30">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="border-t border-line p-2">
              <Button type="button" variant="ghost" size="sm" onClick={addLine} className="gap-1">
                <Plus className="h-3.5 w-3.5" /> Add line
              </Button>
            </div>
          </div>

          <fieldset className="rounded-lg border border-line bg-surface p-4 shadow-card space-y-3">
            <legend className="px-1 text-sm font-semibold text-ink">Bank and UPI details</legend>
            <p className="text-xs text-ink-muted">
              Printed on the invoice from the company profile. Change them in{" "}
              <Link href="/settings" className="font-medium text-brand underline">Settings</Link>.
            </p>
            <InvoiceSettlementBlock settlement={settlement} payee={payee} amountPaise={summary.grandTotal}
              invoiceNumber={invoiceNumber.trim()} />
          </fieldset>
        </div>

        <aside aria-label="Tax summary" className="h-fit rounded-lg border border-line bg-surface p-4 shadow-card space-y-3 lg:sticky lg:top-4">
          <div>
            <h3 className="text-sm font-semibold text-ink">Tax summary</h3>
            <p className="text-xs text-ink-muted">{supplyNote}</p>
          </div>
          <dl className="space-y-1.5 text-xs" aria-live="polite">
            <SummaryRow label="Taxable value" paise={summary.taxable} />
            {interState ? (
              <SummaryRow label="IGST" paise={summary.igst} />
            ) : (
              <>
                <SummaryRow label="CGST" paise={summary.cgst} />
                <SummaryRow label="SGST" paise={summary.sgst} />
              </>
            )}
            <SummaryRow label="Cess" paise={summary.cess} />
            <SummaryRow label="Round off" paise={summary.roundOff} />
            <div className="flex items-baseline justify-between border-t border-line pt-2">
              <dt className="text-sm font-semibold text-ink">Grand total</dt>
              <dd className="font-mono text-base font-semibold text-ink">{rs(summary.grandTotal)}</dd>
            </div>
          </dl>
          <p className="text-xs text-ink-soft">{numberToIndianWords(summary.grandTotal / 100)}</p>
          <label className="flex items-center gap-2 text-xs text-ink-soft">
            <input type="checkbox" checked={roundToRupee} onChange={(e) => setRoundToRupee(e.target.checked)} className="accent-brand" />
            Round off to the nearest rupee
          </label>
        </aside>
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
        <Button type="submit" variant="primary" size="sm" isLoading={isSaving}>Save draft invoice</Button>
      </div>
    </form>
  );
}

function SummaryRow({ label, paise }: { label: string; paise: number }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="font-mono text-ink">{rs(paise)}</dd>
    </div>
  );
}
