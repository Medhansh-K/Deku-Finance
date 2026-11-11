"use client";

import React, { useState } from "react";
import { Reveal } from "@/components/marketing/Reveal";

type Choice = "eligible" | "blocked" | "ineligible";

/**
 * A purchase bill's ITC choice and where its tax ends up (lib/purchases/bills.ts, lib/gst/returns.ts).
 * Worked example: ₹1,00,000 same-state purchase with ₹18,000 GST.
 */
const CHOICES: Record<Choice, { label: string; body: string; rows: { name: string; value: string }[]; credit: string }> = {
  eligible: {
    label: "Eligible",
    body: "The tax goes to the input GST ledgers and is reported as eligible credit in GSTR-3B.",
    rows: [
      { name: "Input CGST and SGST ledgers", value: "₹18,000" },
      { name: "GSTR-3B 4(A)(5), credit available", value: "₹18,000" },
    ],
    credit: "₹18,000",
  },
  blocked: {
    label: "Blocked u/s 17(5)",
    body: "Needs a reason, and the tax is added to the cost. GSTR-3B reports it in 4(A)(5) and reverses it in 4(B)(1), so it never reduces what you pay.",
    rows: [
      { name: "Added to the purchase cost", value: "₹18,000" },
      { name: "GSTR-3B 4(A)(5), credit available", value: "₹18,000" },
      { name: "GSTR-3B 4(B)(1), reversed", value: "₹18,000" },
    ],
    credit: "₹0",
  },
  ineligible: {
    label: "Ineligible (other)",
    body: "For other reasons, such as a late claim. It also needs a reason, the tax is added to the cost, and it is reported in 4(D)(2).",
    rows: [
      { name: "Added to the purchase cost", value: "₹18,000" },
      { name: "GSTR-3B 4(D)(2), ineligible", value: "₹18,000" },
    ],
    credit: "₹0",
  },
};

const ORDER: Choice[] = ["eligible", "blocked", "ineligible"];

export function ItcClassifier() {
  const [active, setActive] = useState<Choice>("eligible");
  const c = CHOICES[active];
  return (
    <div className="rounded-panel border border-line bg-surface shadow-pop">
      <div className="border-b border-line p-5 sm:p-6">
        <p className="text-[15px] font-semibold tracking-[-0.01em]">Purchase bill: ITC eligibility</p>
        <p className="mt-1 text-[13px] text-ink-muted">Example: ₹1,00,000 same-state purchase, ₹18,000 GST</p>
        <div role="group" aria-label="ITC eligibility" className="mt-4 grid grid-cols-3 gap-1 rounded-ctl bg-canvas-sunken p-1">
          {ORDER.map((id) => {
            const on = id === active;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={on}
                onClick={() => setActive(id)}
                className={`min-h-9 rounded-[7px] px-2 py-1.5 text-[13px] leading-tight transition-[background-color,color,box-shadow] duration-200 active:translate-y-px motion-reduce:transform-none ${
                  on ? "bg-surface font-medium text-ink shadow-[0_1px_2px_rgb(14_27_25/0.08)]" : "text-ink-muted hover:text-ink"
                }`}
              >
                {CHOICES[id].label}
              </button>
            );
          })}
        </div>
      </div>
      <Reveal key={active}>
        <div className="min-h-[264px] p-5 sm:p-6" aria-live="polite">
          <p className="text-[14.5px] leading-[1.55] text-ink-soft">{c.body}</p>
          <table className="mt-4 w-full text-[14.5px]">
            <tbody>
              {c.rows.map((r) => (
                <tr key={r.name} className="border-t border-line">
                  <th scope="row" className="py-2.5 pr-4 text-left font-normal text-ink-soft">{r.name}</th>
                  <td className="py-2.5 text-right text-ink">{r.value}</td>
                </tr>
              ))}
              <tr className="border-t border-line-strong">
                <th scope="row" className="pt-3 text-left font-semibold text-ink">Reduces the tax you pay by</th>
                <td className="pt-3 text-right font-semibold text-ink">
                  <span className="ledger-total">{c.credit}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Reveal>
    </div>
  );
}
