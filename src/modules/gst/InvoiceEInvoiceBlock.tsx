"use client";

import React, { useEffect, useState } from "react";
import { FileBadge, Truck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
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
  return url ? <img src={url} alt="e-invoice signed QR code" className="h-28 w-28 rounded border border-line" /> : null;
}

/** IRN and e-way bill for an issued invoice. The IRN and its signed QR print with the invoice. */
export function InvoiceEInvoiceBlock({ orgId, invoiceId, issued }: { orgId: string; invoiceId: string; issued: boolean }) {
  const [status, setStatus] = useState<GspStatus | null>(null);
  const [irns, setIrns] = useState<EInvoice[]>([]);
  const [ewbs, setEwbs] = useState<EwayBill[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [ewbForm, setEwbForm] = useState({ open: false, vehicle_no: "", transporter_id: "", distance_km: "" });
  const [cancel, setCancel] = useState<{ what: "irn" | "eway"; code: number; remark: string } | null>(null);

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
      .catch((e) => setStatus({ configured: false, reason: integrationErrorText(e), provider: null, sandbox: false, connection: null }));
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

  return (
    <section aria-label="E-invoice and e-way bill" className="space-y-3 rounded-lg border border-line bg-surface p-4">
      {status?.sandbox && (irn || ewb || !blocker) && <SandboxBanner what="GSP" />}

      {irn && (
        <div className="flex flex-wrap items-start justify-between gap-4">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
            <dt className="text-ink-muted">IRN</dt>
            <dd className="break-all font-mono text-ink">{irn.irn}</dd>
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
          </dl>
          {irn.signed_qr && <SignedQr value={irn.signed_qr} />}
        </div>
      )}

      {ewb && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
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

      {issued && (
        <div className="space-y-2 print:hidden">
          <div className="flex flex-wrap gap-2">
            {!irn && (
              <Button size="sm" variant="secondary" disabled={!!blocker || busy} onClick={() => run(() => gspApi.generateIrn(orgId, invoiceId), "IRN generated.")}>
                <FileBadge className="h-3.5 w-3.5" aria-hidden /> Generate IRN
              </Button>
            )}
            {!ewb && (
              <Button size="sm" variant="secondary" disabled={!!blocker || busy} onClick={() => setEwbForm((f) => ({ ...f, open: !f.open }))}>
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
                Cancel e-way bill
              </Button>
            )}
          </div>
          {blocker && <p className="text-xs text-ink-muted">{blocker}</p>}

          {ewbForm.open && !blocker && (
            <form
              className="flex flex-wrap items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                run(
                  () =>
                    gspApi.generateEway(orgId, invoiceId, {
                      vehicle_no: ewbForm.vehicle_no.trim() || undefined,
                      transporter_id: ewbForm.transporter_id.trim() || undefined,
                      distance_km: distance,
                    }),
                  "E-way bill generated.",
                );
              }}
            >
              <div className="w-36">
                <Input label="Vehicle no." id="ewb-vehicle" value={ewbForm.vehicle_no} onChange={(e) => setEwbForm({ ...ewbForm, vehicle_no: e.target.value.toUpperCase() })} />
              </div>
              <div className="w-44">
                <Input label="Transporter ID" id="ewb-transporter" value={ewbForm.transporter_id} onChange={(e) => setEwbForm({ ...ewbForm, transporter_id: e.target.value.toUpperCase() })} />
              </div>
              <div className="w-28">
                <Input label="Distance (km)" id="ewb-distance" inputMode="numeric" value={ewbForm.distance_km} onChange={(e) => setEwbForm({ ...ewbForm, distance_km: e.target.value.replace(/\D/g, "") })} required />
              </div>
              <Button
                type="submit"
                size="sm"
                disabled={busy || ewbForm.distance_km === "" || distance > 4000 || (!ewbForm.vehicle_no.trim() && !ewbForm.transporter_id.trim())}
              >
                Generate
              </Button>
            </form>
          )}

          {cancel && (
            <form
              className="flex flex-wrap items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const act =
                  cancel.what === "irn"
                    ? () => gspApi.cancelIrn(orgId, invoiceId, cancel.code, cancel.remark.trim())
                    : () => gspApi.cancelEway(orgId, invoiceId, cancel.code, cancel.remark.trim());
                run(act, cancel.what === "irn" ? "IRN cancelled." : "E-way bill cancelled.");
              }}
            >
              <label className="flex flex-col gap-1 text-xs font-medium text-ink-soft">
                Reason
                <select
                  value={cancel.code}
                  onChange={(e) => setCancel({ ...cancel, code: Number(e.target.value) })}
                  className="h-9 rounded-md border border-line-strong bg-surface px-2 text-sm text-ink"
                >
                  {CANCEL_REASONS.map((r) => (
                    <option key={r.code} value={r.code}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="w-56">
                <Input label="Remark" id="cancel-remark" maxLength={100} value={cancel.remark} onChange={(e) => setCancel({ ...cancel, remark: e.target.value })} required />
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
        <p role="status" className={`text-xs print:hidden ${message.ok ? "text-emerald-800" : "text-rose-800"}`}>
          {message.text}
        </p>
      )}
    </section>
  );
}
