"use client";

import React, { useEffect, useState } from "react";
import { Copy, Link2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { isConnected, linkForInvoice, paymentsApi, PaymentLink, PaymentsStatus } from "@/api/payments";

/** Razorpay payment link on the invoice preview. The link itself prints; the controls don't. */
export function InvoicePaymentLink({ orgId, invoiceId, issued }: { orgId: string; invoiceId: string; issued: boolean }) {
  const [status, setStatus] = useState<PaymentsStatus | null>(null);
  const [link, setLink] = useState<PaymentLink | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (!orgId) return;
    let stale = false;
    setLink(null);
    setNote(null);
    paymentsApi
      .status(orgId)
      .then(async (s) => {
        if (stale) return;
        setStatus(s.data);
        if (!s.data.configured) return;
        const links = await paymentsApi.links(orgId, invoiceId);
        if (!stale) setLink(linkForInvoice(links.data ?? [], invoiceId));
      })
      .catch((e) => !stale && setNote((e as Error).message));
    return () => {
      stale = true;
    };
  }, [orgId, invoiceId]);

  const create = async () => {
    setBusy(true);
    setNote(null);
    try {
      const res = await paymentsApi.createLink(orgId, invoiceId);
      setLink(res.data);
    } catch (e) {
      setNote((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.short_url);
      setNote("Link copied.");
    } catch {
      setNote("Copy failed; select the link and copy it.");
    }
  };

  if (!status) return note ? <p className="text-xs text-rose-700 print:hidden">{note}</p> : null;

  let reason: string | null = null;
  if (!status.configured) reason = status.reason ?? "Online payment links are switched off.";
  else if (!link && !isConnected(status)) reason = "Connect your Razorpay account in Settings to create payment links.";
  else if (!link && !issued) reason = "Issue the invoice to create a payment link.";

  return (
    <div className={`rounded border border-line p-3 text-xs space-y-1 ${link ? "" : "print:hidden"}`}>
      {link ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-ink">
            {link.status === "paid" ? "Paid online through: " : "Pay online: "}
            <a href={link.short_url} target="_blank" rel="noopener noreferrer" className="font-mono text-brand-strong underline">
              {link.short_url}
            </a>
          </p>
          {link.status === "created" && (
            <Button variant="outline" size="sm" onClick={copy} className="gap-1.5 print:hidden">
              <Copy className="h-3.5 w-3.5" aria-hidden /> Copy link
            </Button>
          )}
        </div>
      ) : reason ? (
        <p className="text-ink-muted print:hidden">{reason}</p>
      ) : (
        <Button variant="outline" size="sm" onClick={create} isLoading={busy} className="gap-1.5 print:hidden">
          <Link2 className="h-3.5 w-3.5" aria-hidden /> Create payment link
        </Button>
      )}
      {note && (
        <p role="status" className="text-ink-muted print:hidden">
          {note}
        </p>
      )}
    </div>
  );
}
