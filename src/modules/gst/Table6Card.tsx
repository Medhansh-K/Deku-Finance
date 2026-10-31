import React from "react";
import { formatINR } from "@/lib/formatters/currency";
import type { Table6, TaxAmounts } from "@/lib/gst/returns";

const ROWS: [keyof Table6, string][] = [
  ["liability", "Tax payable (3.1)"],
  ["itc", "ITC of this period (4(C))"],
  ["paid_by_igst_credit", "Paid from IGST credit"],
  ["paid_by_cgst_credit", "Paid from CGST credit"],
  ["paid_by_sgst_credit", "Paid from SGST credit"],
  ["paid_by_cess_credit", "Paid from cess credit"],
  ["cash", "Payable in cash"],
  ["credit_carried_forward", "Credit left over"],
];
const COLS: [keyof TaxAmounts, string][] = [
  ["iamt", "IGST"],
  ["camt", "CGST"],
  ["samt", "SGST"],
  ["csamt", "Cess"],
];

/** GSTR-3B Table 6: how this period's ITC sets off the tax, and the cash still due. */
export function Table6Card({ table6 }: { table6: Table6 | null | undefined }) {
  return (
    <div className="bg-surface rounded-xl p-5 border border-line shadow-card space-y-3">
      <h2 className="text-sm font-semibold text-ink border-b border-line pb-3">GSTR-3B Table 6: tax payment</h2>
      {!table6 ? (
        <p className="text-xs text-ink-muted">Not computed until GSTR-3B has no blocking issues.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-ink-muted text-left">
                  <th scope="col" className="font-semibold py-1">Rupees</th>
                  {COLS.map(([, h]) => (
                    <th scope="col" key={h} className="font-semibold py-1 text-right">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS.map(([key, label]) => (
                  <tr key={key} className={`border-t border-line ${key === "cash" ? "font-semibold" : ""}`}>
                    <td className="py-1.5 text-ink-soft">{label}</td>
                    {COLS.map(([c]) => (
                      <td key={c} className="py-1.5 text-right font-mono text-ink">
                        {formatINR(table6[key][c], { showCurrencySymbol: false })}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-ink-muted">
            Set-off follows Rule 88A: IGST credit first (IGST, then CGST and SGST), then CGST and SGST credit on their own
            head and IGST. Only this period&apos;s ITC is used; check your electronic credit and cash ledgers on the portal
            before paying.
          </p>
        </>
      )}
    </div>
  );
}
