"use client";

import React, { useEffect, useState } from "react";
import { Settlement, buildUpiPayload, settlementErrors } from "@/lib/invoices/settlement";
import { formatINR } from "@/lib/formatters/currency";

interface Props {
  settlement: Settlement;
  payee: string;
  amountPaise: number;
  invoiceNumber: string;
}

/** The bank and UPI block printed on an invoice. Only valid, filled-in details are shown. */
export function InvoiceSettlementBlock({ settlement, payee, amountPaise, invoiceNumber }: Props) {
  const errors = settlementErrors(settlement);
  const showUpi = !!settlement.upiId && !errors.upiId;
  const showBank = !!settlement.accountNumber && !errors.accountNumber && !errors.ifsc && !errors.bankName;
  const payload =
    showUpi && amountPaise > 0
      ? buildUpiPayload({ vpa: settlement.upiId, payee, amountPaise, invoiceNumber })
      : "";

  const [rendered, setRendered] = useState({ payload: "", url: "" });
  const qr = payload && rendered.payload === payload ? rendered.url : "";
  useEffect(() => {
    if (!payload) return;
    let live = true;
    // Loaded on demand so the QR encoder stays out of the server bundle.
    import("qrcode")
      .then((m) => m.toDataURL(payload, { margin: 1, width: 160, errorCorrectionLevel: "M" }))
      .then((url) => live && setRendered({ payload, url }))
      .catch(() => live && setRendered({ payload, url: "" }));
    return () => {
      live = false;
    };
  }, [payload]);

  if (!showUpi && !showBank) return null;

  const rows: [string, string][] = [
    ...(showUpi ? [["UPI ID", settlement.upiId] as [string, string]] : []),
    ...(showBank
      ? ([
          ["Bank", settlement.bankName],
          ["Account number", settlement.accountNumber],
          ["IFSC", settlement.ifsc],
          ...(settlement.beneficiaryName ? [["Beneficiary", settlement.beneficiaryName]] : []),
        ] as [string, string][])
      : []),
  ];

  return (
    <section
      aria-label="Payment details"
      className="flex flex-wrap items-start justify-between gap-4 rounded-lg border border-line bg-surface p-4"
    >
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-ink">Payment details</h4>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
          {rows.map(([label, value]) => (
            <React.Fragment key={label}>
              <dt className="text-ink-muted">{label}</dt>
              <dd className={`text-ink ${label === "Bank" || label === "Beneficiary" ? "" : "font-mono"}`}>{value}</dd>
            </React.Fragment>
          ))}
        </dl>
      </div>
      {qr && (
        <figure className="flex flex-col items-center gap-1">
          {/* eslint-disable-next-line @next/next/no-img-element -- data URL, nothing for next/image to optimise */}
          <img src={qr} alt={`UPI QR code to pay ${formatINR(amountPaise / 100)} to ${settlement.upiId}`} className="h-32 w-32" />
          <figcaption className="text-[11px] text-ink-muted">
            Scan with any UPI app to pay <span className="font-mono">{formatINR(amountPaise / 100)}</span>
          </figcaption>
        </figure>
      )}
    </section>
  );
}
