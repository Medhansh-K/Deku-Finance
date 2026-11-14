"use client";

import React, { useEffect, useState } from "react";
import { FileBadge, Truck, Info, ShieldCheck, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { formatINR } from "@/lib/formatters/currency";
import { gspApi, integrationErrorText, type EInvoice, type EwayBill, type GspStatus } from "@/api/integrations";
import { directFilingBlocker } from "@/modules/integrations/DirectFiling";
import { SandboxBanner } from "@/modules/integrations/SandboxBanner";

const CANCEL_REASONS = [
  { code: 1, label: "Duplicate" },
  { code: 2, label: "Data entry mistake" },
  { code: 3, label: "Order cancelled" },
  { code: 4, label: "Other" },
];

function SignedQr({ value }: { value: string }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let live = true;
    import("qrcode")
      .then((m) => m.toDataURL(value, { margin: 1, width: 180, errorCorrectionLevel: "M" }))
      .then((u) => live && setUrl(u))
      .catch(() => live && setUrl(""));
    return () => {
      live = false;
    };
  }, [value]);
  // eslint-disable-next-line @next/next/no-img-element
  return url ? <img src={url} alt="e-invoice signed QR code" className="h-28 w-28 rounded-ctl border border-line" /> : null;
}

/**
 * IRN and e-way bill for an issued invoice via Sandbox.co.in Fintech API Hub.
 * Features an explicit user toggle with statutory threshold detection (minimum ₹50,000+).
 */
export function InvoiceEInvoiceBlock({
  orgId,
  invoiceId,
  issued,
  totalAmount = 0,
  customerGstin,
  invoiceNumber,
}: {
  orgId: string;
  invoiceId: string;
  issued: boolean;
  totalAmount?: number;
  customerGstin?: string;
  invoiceNumber?: string;
}) {
  const [status, setStatus] = useState<GspStatus | null>(null);
  const [irns, setIrns] = useState<EInvoice[]>([]);
  const [ewbs, setEwbs] = useState<EwayBill[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [ewbForm, setEwbForm] = useState({ open: false, vehicle_no: "", transporter_id: "", distance_km: "" });
  const [cancel, setCancel] = useState<{ what: "irn" | "eway"; code: number; remark: string } | null>(null);

  const isThresholdMet = (totalAmount ?? 0) >= 50000;
  // User decision toggle: enabled by default for view, but user can freely toggle off to skip
  const [eInvoiceOptIn, setEInvoiceOptIn] = useState<boolean>(true);

  const load = () =>
    gspApi
      .invoiceDocuments(orgId, invoiceId)
      .then((r) => {
        setIrns(r.data.e_invoices ?? []);
        setEwbs(r.data.eway_bills ?? []);
      })
      .catch(() => undefined);

  useEffect(() => {
    if (!orgId || !invoiceId) return;
    gspApi
      .status(orgId)
      .then((r) => setStatus(r.data))
      .catch((e) =>
        setStatus({
          configured: false,
          reason: integrationErrorText(e),
          provider: null,
          sandbox: false,
          connection: null,
        })
      );
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, invoiceId]);

  const run = async (action: () => Promise<unknown>, done: string) => {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      setMessage({ ok: true, text: done });
      setCancel(null);
      setEwbForm((f) => ({ ...f, open: false }));
      await load();
    } catch (e) {
      setMessage({ ok: false, text: integrationErrorText(e) });
    } finally {
      setBusy(false);
    }
  };

  const irn = irns.find((r) => r.status === "generated") ?? null;
  const ewb = ewbs.find((r) => r.status === "active") ?? null;
  const blocker = !issued ? "Issue the invoice first." : directFilingBlocker(status);
  const distance = Number(ewbForm.distance_km);

  if (!irn && !ewb && !issued) return null;

  // If an IRN was already generated, keep E-Invoicing actively displayed
  const isEInvoiceActive = !!irn || eInvoiceOptIn;

  return (
    <section aria-label="E-invoice and e-way bill" className="space-y-4 rounded-panel border border-line bg-surface p-4">
      {status?.sandbox && (irn || ewb || !blocker) && <SandboxBanner what="GSP & E-Invoice (Sandbox.co.in)" />}

      {/* Header and User Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <FileBadge className="h-4 w-4 text-brand" />
            <h4 className="text-[13.5px] font-semibold text-ink">
              Government E-Invoice & E-Way Bill (IRN)
            </h4>
            <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-medium text-brand">
              Sandbox.co.in Gateway
            </span>
          </div>
          <p className="text-[12px] text-ink-muted">
            Direct integration with Sandbox.co.in Fintech API Hub for IRP registration and signed QR code.
          </p>
        </div>

        {/* User Decision Toggle (Only switchable if not already generated) */}
        {!irn ? (
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <span className="text-[12.5px] font-medium text-ink">
              {eInvoiceOptIn ? "E-Invoicing Enabled" : "E-Invoicing Disabled"}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={eInvoiceOptIn}
              onClick={() => setEInvoiceOptIn(!eInvoiceOptIn)}
              className={`relative inline-flex h-5 w-10 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand/30 ${
                eInvoiceOptIn ? "bg-brand" : "bg-line-strong"
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-surface shadow-sm transition-transform ${
                  eInvoiceOptIn ? "translate-x-5" : "translate-x-1"
                }`}
              />
            </button>
          </label>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11.5px] font-medium bg-ok-wash text-ok border border-ok/20">
            <CheckCircle2 className="h-3.5 w-3.5" /> IRN Active
          </span>
        )}
      </div>

      {/* Statutory ₹50,000 Threshold Advisory Strip */}
      <div
        className={`flex items-start gap-2.5 rounded-ctl p-3 text-[12.5px] border ${
          isThresholdMet
            ? "bg-brand/5 border-brand/20 text-ink"
            : "bg-canvas border-line text-ink-soft"
        }`}
      >
        <Info className={`h-4 w-4 shrink-0 mt-0.5 ${isThresholdMet ? "text-brand" : "text-ink-muted"}`} />
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-ink">
              Invoice Amount: {formatINR(totalAmount)}
            </span>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${
                isThresholdMet
                  ? "bg-ok-wash text-ok border border-ok/20"
                  : "bg-surface text-ink-muted border border-line"
              }`}
            >
              {isThresholdMet ? "≥ ₹50,000 Statutory Threshold Met" : "Below ₹50,000 Threshold (Optional)"}
            </span>
          </div>
          <p className="text-ink-muted text-[11.5px] leading-relaxed">
            {isThresholdMet
              ? "This invoice value is ₹50,000 or above. Under Indian GST guidelines, high-value B2B supplies require E-Way Bills and registered IRNs. You may generate the official IRN via Sandbox.co.in."
              : "Not every digital invoice requires government registration. E-Invoicing (IRN) is typically statutory for B2B supplies with total value of ₹50,000+ or turnover-mandated taxpayers. You can choose whether to generate an IRN for this invoice."}
          </p>
        </div>
      </div>

      {/* Render IRN Details if Generated */}
      {irn && (
        <div className="flex flex-wrap items-start justify-between gap-4 bg-canvas/40 p-3 rounded-ctl border border-line">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[13px]">
            <dt className="text-ink-muted">IRN (64-char)</dt>
            <dd className="break-all font-mono font-medium text-ink">{irn.irn}</dd>
            {irn.ack_no && (
              <>
                <dt className="text-ink-muted">Ack no.</dt>
                <dd className="font-mono text-ink">{irn.ack_no}</dd>
              </>
            )}
            {irn.ack_date && (
              <>
                <dt className="text-ink-muted">Ack date</dt>
                <dd className="text-ink">{new Date(irn.ack_date).toLocaleString("en-IN")}</dd>
              </>
            )}
            <dt className="text-ink-muted">Gateway</dt>
            <dd className="text-brand font-medium">Sandbox.co.in (Fintech API)</dd>
          </dl>
          {irn.signed_qr && <SignedQr value={irn.signed_qr} />}
        </div>
      )}

      {/* Render E-Way Bill Details if Active */}
      {ewb && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[13px] bg-canvas/40 p-3 rounded-ctl border border-line">
          <dt className="text-ink-muted">E-way bill</dt>
          <dd className="font-mono text-ink">{ewb.ewb_no}</dd>
          {ewb.valid_upto && (
            <>
              <dt className="text-ink-muted">Valid until</dt>
              <dd className="text-ink">{new Date(ewb.valid_upto).toLocaleString("en-IN")}</dd>
            </>
          )}
          {ewb.vehicle_no && (
            <>
              <dt className="text-ink-muted">Vehicle</dt>
              <dd className="font-mono text-ink">{ewb.vehicle_no}</dd>
            </>
          )}
        </dl>
      )}

      {/* Actions Strip */}
      {issued && (
        <div className="space-y-3 print:hidden">
          {!isEInvoiceActive && !irn ? (
            <div className="flex items-center justify-between rounded-ctl border border-dashed border-line bg-surface p-3 text-[12.5px] text-ink-muted">
              <span>
                Standard digital invoice mode active. Government IRN generation is skipped for this document.
              </span>
              <Button size="sm" variant="outline" onClick={() => setEInvoiceOptIn(true)}>
                Enable E-Invoice
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                {!irn && (
                  <Button
                    size="sm"
                    variant="tally"
                    disabled={!!blocker || busy}
                    onClick={() => run(() => gspApi.generateIrn(orgId, invoiceId), "IRN generated via Sandbox.co.in.")}
                    className="gap-1.5"
                  >
                    <FileBadge className="h-3.5 w-3.5" aria-hidden /> Generate IRN (Sandbox.co.in)
                  </Button>
                )}
                {!ewb && (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={!!blocker || busy}
                    onClick={() => setEwbForm((f) => ({ ...f, open: !f.open }))}
                    className="gap-1.5"
                  >
                    <Truck className="h-3.5 w-3.5" aria-hidden /> Generate e-way bill
                  </Button>
                )}
                {irn && !blocker && (
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => setCancel({ what: "irn", code: 2, remark: "" })}>
                    Cancel IRN
                  </Button>
                )}
                {ewb && !blocker && (
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => setCancel({ what: "eway", code: 2, remark: "" })}>
                    Cancel E-Way Bill
                  </Button>
                )}
              </div>

              {blocker && <p className="text-[12.5px] text-ink-muted">{blocker}</p>}
            </div>
          )}

          {ewbForm.open && !blocker && (
            <form
              className="flex flex-wrap items-end gap-2 border-t border-line pt-3"
              onSubmit={(e) => {
                e.preventDefault();
                run(
                  () =>
                    gspApi.generateEway(orgId, invoiceId, {
                      vehicle_no: ewbForm.vehicle_no.trim() || undefined,
                      transporter_id: ewbForm.transporter_id.trim() || undefined,
                      distance_km: distance,
                    }),
                  "E-way bill generated via Sandbox.co.in.",
                );
              }}
            >
              <div className="w-36">
                <Input
                  label="Vehicle no."
                  id="ewb-vehicle"
                  value={ewbForm.vehicle_no}
                  onChange={(e) => setEwbForm({ ...ewbForm, vehicle_no: e.target.value.toUpperCase() })}
                />
              </div>
              <div className="w-44">
                <Input
                  label="Transporter ID"
                  id="ewb-transporter"
                  value={ewbForm.transporter_id}
                  onChange={(e) => setEwbForm({ ...ewbForm, transporter_id: e.target.value.toUpperCase() })}
                />
              </div>
              <div className="w-28">
                <Input
                  label="Distance (km)"
                  id="ewb-distance"
                  inputMode="numeric"
                  value={ewbForm.distance_km}
                  onChange={(e) => setEwbForm({ ...ewbForm, distance_km: e.target.value.replace(/\D/g, "") })}
                  required
                />
              </div>
              <Button
                type="submit"
                size="sm"
                disabled={busy || ewbForm.distance_km === "" || distance > 4000 || (!ewbForm.vehicle_no.trim() && !ewbForm.transporter_id.trim())}
              >
                Generate via Sandbox.co.in
              </Button>
            </form>
          )}

          {cancel && (
            <form
              className="flex flex-wrap items-end gap-2 border-t border-line pt-3"
              onSubmit={(e) => {
                e.preventDefault();
                const act =
                  cancel.what === "irn"
                    ? () => gspApi.cancelIrn(orgId, invoiceId, cancel.code, cancel.remark.trim())
                    : () => gspApi.cancelEway(orgId, invoiceId, cancel.code, cancel.remark.trim());
                run(act, cancel.what === "irn" ? "IRN cancelled." : "E-way bill cancelled.");
              }}
            >
              <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink-soft">
                Reason
                <select
                  value={cancel.code}
                  onChange={(e) => setCancel({ ...cancel, code: Number(e.target.value) })}
                  className="h-9 rounded-ctl border border-line-strong bg-surface px-2 text-[13.5px] text-ink"
                >
                  {CANCEL_REASONS.map((r) => (
                    <option key={r.code} value={r.code}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="w-56">
                <Input
                  label="Remark"
                  id="cancel-remark"
                  maxLength={100}
                  value={cancel.remark}
                  onChange={(e) => setCancel({ ...cancel, remark: e.target.value })}
                  required
                />
              </div>
              <Button type="submit" size="sm" variant="danger" disabled={busy || !cancel.remark.trim()}>
                Confirm cancellation
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setCancel(null)}>
                Keep
              </Button>
            </form>
          )}
        </div>
      )}

      {message && (
        <p role="status" className={`text-[13px] print:hidden ${message.ok ? "text-ok font-medium" : "text-bad"}`}>
          {message.text}
        </p>
      )}
    </section>
  );
}
