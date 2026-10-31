"use client";

import React, { useEffect, useState } from "react";
import { CreditCard } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { isConnected, paymentsApi, PaymentsStatus, SHARED_WITH_RAZORPAY } from "@/api/payments";
import { formatDateTally } from "@/lib/formatters/date";

const RESULT_TEXT: Record<string, { ok: boolean; text: string }> = {
  connected: { ok: true, text: "Razorpay account connected." },
  error: { ok: false, text: "Razorpay connection did not complete. Try again; nothing was saved." },
};

/** Connect the company's own Razorpay account for invoice payment links. */
export function PaymentsCard({ orgId }: { orgId: string }) {
  const [status, setStatus] = useState<PaymentsStatus | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [testMode, setTestMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const load = () =>
    paymentsApi
      .status(orgId)
      .then((res) => setStatus(res.data))
      .catch((e) => setMessage({ ok: false, text: (e as Error).message }));

  useEffect(() => {
    const result = new URLSearchParams(window.location.search).get("payments");
    if (result && RESULT_TEXT[result]) setMessage(RESULT_TEXT[result]);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  const connect = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await paymentsApi.connect(orgId, testMode ? "test" : "live");
      const url = res.data.authorize_url;
      if (!url.startsWith("https://auth.razorpay.com/")) throw new Error("Unexpected authorisation address");
      window.location.assign(url);
    } catch (e) {
      setMessage({ ok: false, text: (e as Error).message });
      setBusy(false);
    }
  };

  const disconnect = async () => {
    if (!confirm("Disconnect Razorpay? Existing payment links stop being recorded in Deku.")) return;
    setBusy(true);
    setMessage(null);
    try {
      await paymentsApi.disconnect(orgId);
      setMessage({ ok: true, text: "Razorpay disconnected." });
      await load();
    } catch (e) {
      setMessage({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const connected = isConnected(status);
  const conn = status?.connection;

  return (
    <section aria-labelledby="payments-card-title" className="bg-surface border border-line-strong rounded-lg p-5 shadow-xs space-y-3">
      <div className="flex items-center justify-between gap-2 border-b border-line pb-3">
        <div className="flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-ink-soft" aria-hidden />
          <h3 id="payments-card-title" className="text-sm font-bold uppercase text-ink font-mono">Payments (Razorpay)</h3>
        </div>
        {status && (
          <Badge variant={connected ? "success" : "default"}>
            {!status.configured ? "Not available" : connected ? `Connected · ${conn!.mode}` : "Not connected"}
          </Badge>
        )}
      </div>

      {status && !status.configured && <p className="text-ink-muted">{status.reason}</p>}

      <div className="rounded border border-line bg-canvas p-3 text-ink-soft">
        <p className="font-semibold text-ink">What is shared with Razorpay</p>
        <p className="mt-1">When you create a payment link for an invoice, Deku sends your own Razorpay account:</p>
        <ul className="mt-1 list-disc pl-5">
          {SHARED_WITH_RAZORPAY.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
        <p className="mt-1">
          Nothing else is sent: no ledgers, other invoices, GSTINs or bank details. Razorpay reports the payment back,
          and Deku books the receipt in your books.
        </p>
      </div>

      {connected && conn ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-ink-soft">
            Account <span className="font-mono text-ink">{conn.razorpay_account_id}</span>, connected{" "}
            {formatDateTally(conn.created_at.slice(0, 10))}.
          </p>
          <Button variant="danger" size="sm" onClick={disconnect} isLoading={busy}>
            Disconnect
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={agreed}
              disabled={!status?.configured}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-brand"
            />
            <span>I agree to share the fields above with Razorpay for invoices I create payment links for.</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={testMode}
              disabled={!status?.configured}
              onChange={(e) => setTestMode(e.target.checked)}
              className="h-4 w-4 accent-brand"
            />
            <span>Razorpay test mode (no real money)</span>
          </label>
          <Button
            variant="tally"
            size="sm"
            onClick={connect}
            isLoading={busy}
            disabled={!status?.configured || !agreed}
            title={!status?.configured ? status?.reason : !agreed ? "Agree to the data sharing first" : undefined}
          >
            Connect Razorpay
          </Button>
          <p className="text-[11px] text-ink-muted">Only the owner or an admin can connect or disconnect.</p>
        </div>
      )}

      {message && (
        <p role={message.ok ? "status" : "alert"} className={message.ok ? "text-emerald-700" : "text-rose-700"}>
          {message.text}
        </p>
      )}
    </section>
  );
}
