"use client";

import React, { useState } from "react";
import { Reveal } from "@/components/marketing/Reveal";

type ScenarioId = "intra" | "inter" | "exempt";

/** Worked example: ₹1,00,000 taxable at 18%. Plain arithmetic, not data from any company. */
const SCENARIOS: Record<
  ScenarioId,
  { label: string; route: string; doc: string; lines: { name: string; amount: string }[]; total: string; note: string }
> = {
  intra: {
    label: "Same state",
    route: "27 Maharashtra to 27 Maharashtra",
    doc: "Tax invoice, SAC 9983 at 18%",
    lines: [
      { name: "Taxable value", amount: "₹1,00,000" },
      { name: "CGST at 9% (central tax)", amount: "₹9,000" },
      { name: "SGST at 9% (state tax)", amount: "₹9,000" },
    ],
    total: "₹1,18,000",
    note: "The customer's debtors account is debited ₹1,18,000.",
  },
  inter: {
    label: "Other state",
    route: "27 Maharashtra to 29 Karnataka",
    doc: "Tax invoice, SAC 9983 at 18%",
    lines: [
      { name: "Taxable value", amount: "₹1,00,000" },
      { name: "IGST at 18% (integrated tax)", amount: "₹18,000" },
    ],
    total: "₹1,18,000",
    note: "The customer's debtors account is debited ₹1,18,000.",
  },
  exempt: {
    label: "Unregistered",
    route: "Pure accounting mode, section 22",
    doc: "Bill of supply",
    lines: [
      { name: "Value of supply", amount: "₹1,00,000" },
      { name: "GST", amount: "₹0" },
    ],
    total: "₹1,00,000",
    note: "No GST lines are created.",
  },
};

const ORDER: ScenarioId[] = ["intra", "inter", "exempt"];

export function TaxSplit() {
  const [active, setActive] = useState<ScenarioId>("intra");
  const s = SCENARIOS[active];

  return (
    <figure className="rounded-panel border border-line bg-surface">
      <div className="border-b border-line p-5 sm:p-6">
        <figcaption className="text-[15px] font-semibold tracking-[-0.01em] text-ink">
          Worked example: ₹1,00,000 at 18%
        </figcaption>
        <div role="group" aria-label="Choose a supply" className="mt-4 grid grid-cols-3 gap-1 rounded-ctl bg-canvas-sunken p-1">
          {ORDER.map((id) => {
            const on = id === active;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={on}
                onClick={() => setActive(id)}
                className={`h-9 rounded-[7px] px-2 text-[13.5px] transition-[background-color,color,box-shadow] duration-200 active:translate-y-px motion-reduce:transform-none ${
                  on ? "bg-surface font-medium text-ink shadow-[0_1px_2px_rgb(14_27_25/0.08)]" : "text-ink-muted hover:text-ink"
                }`}
              >
                {SCENARIOS[id].label}
              </button>
            );
          })}
        </div>
      </div>

      <Reveal key={active}>
        <div className="min-h-[276px] p-5 sm:p-6" aria-live="polite">
          <p className="text-[14px] text-ink-muted">
            {s.route} · {s.doc}
          </p>
          <table className="mt-4 w-full text-[15px]">
            <tbody>
              {s.lines.map((l) => (
                <tr key={l.name} className="border-b border-line">
                  <th scope="row" className="py-3 pr-4 text-left font-normal text-ink-soft">
                    {l.name}
                  </th>
                  <td className="py-3 text-right text-ink">{l.amount}</td>
                </tr>
              ))}
              <tr>
                <th scope="row" className="pb-1 pr-4 pt-4 text-left font-semibold text-ink">
                  Invoice total
                </th>
                <td className="pb-1 pt-4 text-right font-semibold text-ink">
                  <span className="ledger-total">{s.total}</span>
                </td>
              </tr>
            </tbody>
          </table>
          <p className="mt-5 text-[13.5px] text-ink-muted">{s.note}</p>
        </div>
      </Reveal>
    </figure>
  );
}
