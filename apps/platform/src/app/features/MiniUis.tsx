"use client";

/**
 * Small, faithful reproductions of Deku screens for the features page. Account codes and names come
 * from the default chart; amounts are round worked examples, labelled as such, not anyone's data.
 */
import React, { useState } from "react";
import { Check } from "lucide-react";
import { Reveal } from "@/components/marketing/Reveal";
import { chip } from "@/components/marketing/styles";

const keycap =
  "inline-flex items-center justify-center rounded-[5px] border border-b-2 border-line-strong bg-surface px-1.5 pb-[2px] pt-[3px] font-mono text-[11px] leading-none text-ink-muted";

/** Totals block of an invoice in each operating mode. */
export function ModeInvoice({ mode }: { mode: "pure" | "gst" }) {
  const lines =
    mode === "pure"
      ? [{ name: "Value of supply", amount: "₹1,00,000" }]
      : [
          { name: "Taxable value", amount: "₹1,00,000" },
          { name: "CGST at 9%", amount: "₹9,000" },
          { name: "SGST at 9%", amount: "₹9,000" },
        ];
  return (
    <div className="rounded-[10px] border border-line bg-canvas/60 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] font-medium text-ink">{mode === "pure" ? "Bill of supply" : "Tax invoice"}</p>
        <p className="text-[12.5px] text-ink-muted">Example</p>
      </div>
      <table className="mt-3 w-full text-[13.5px]">
        <tbody>
          {lines.map((l) => (
            <tr key={l.name} className="border-t border-line">
              <th scope="row" className="py-2 text-left font-normal text-ink-soft">{l.name}</th>
              <td className="py-2 text-right text-ink">{l.amount}</td>
            </tr>
          ))}
          <tr className="border-t border-line">
            <th scope="row" className="pt-2.5 text-left font-semibold text-ink">Total</th>
            <td className="pt-2.5 text-right font-semibold text-ink">
              <span className="ledger-total">{mode === "pure" ? "₹1,00,000" : "₹1,18,000"}</span>
            </td>
          </tr>
        </tbody>
      </table>
      {mode === "pure" && (
        <div className="mt-4 flex items-center gap-3 border-t border-line pt-3">
          {/* A stylised QR mark, not a scannable code. */}
          <span aria-hidden className="grid h-10 w-10 shrink-0 grid-cols-3 gap-[3px] rounded-[6px] border border-line bg-surface p-1.5">
            {[1, 0, 1, 0, 1, 1, 1, 0, 1].map((on, i) => (
              <span key={i} className={on ? "rounded-[1px] bg-ink" : ""} />
            ))}
          </span>
          <p className="text-[12.5px] leading-[1.45] text-ink-muted">UPI QR printed on the invoice for the customer to pay.</p>
        </div>
      )}
    </div>
  );
}

type VKey = "F4" | "F5" | "F6" | "F7" | "F8" | "F9";
const VOUCHERS: { key: VKey; name: string; body: string; example: string; lines: { side: "Dr" | "Cr"; code: string; account: string; amount: string }[]; total: string }[] = [
  {
    key: "F4",
    name: "Contra",
    body: "Cash deposits, withdrawals and transfers between your own bank and cash accounts. No effect on income.",
    example: "Cash withdrawn from the bank",
    lines: [
      { side: "Dr", code: "1010", account: "Cash on hand", amount: "₹20,000" },
      { side: "Cr", code: "1020", account: "Operating bank account", amount: "₹20,000" },
    ],
    total: "₹20,000",
  },
  {
    key: "F5",
    name: "Payment",
    body: "Supplier payments, expenses, contractor fees and rent.",
    example: "Supplier bill paid from the bank",
    lines: [
      { side: "Dr", code: "2010", account: "Accounts payable", amount: "₹1,18,000" },
      { side: "Cr", code: "1020", account: "Operating bank account", amount: "₹1,18,000" },
    ],
    total: "₹1,18,000",
  },
  {
    key: "F6",
    name: "Receipt",
    body: "Customer settlements, UPI collections and other money received.",
    example: "Customer pays an invoice",
    lines: [
      { side: "Dr", code: "1020", account: "Operating bank account", amount: "₹4,72,000" },
      { side: "Cr", code: "1030", account: "Accounts receivable", amount: "₹4,72,000" },
    ],
    total: "₹4,72,000",
  },
  {
    key: "F7",
    name: "Journal",
    body: "Non-cash adjustments: provisions, depreciation and period-end accruals.",
    example: "Month-end rent accrual",
    lines: [
      { side: "Dr", code: "5040", account: "Office & operational rent", amount: "₹45,000" },
      { side: "Cr", code: "2010", account: "Accounts payable", amount: "₹45,000" },
    ],
    total: "₹45,000",
  },
  {
    key: "F8",
    name: "Sales",
    body: "Tax invoices and bills of supply, posted to the customer's debtors account.",
    example: "Same-state sale at 18%",
    lines: [
      { side: "Dr", code: "1030", account: "Accounts receivable", amount: "₹1,18,000" },
      { side: "Cr", code: "4010", account: "Sales revenue, products", amount: "₹1,00,000" },
      { side: "Cr", code: "2081", account: "Output CGST payable", amount: "₹9,000" },
      { side: "Cr", code: "2082", account: "Output SGST payable", amount: "₹9,000" },
    ],
    total: "₹1,18,000",
  },
  {
    key: "F9",
    name: "Purchase",
    body: "Supplier bills with their input tax credit, posted to the creditors account.",
    example: "Same-state stock purchase at 18%",
    lines: [
      { side: "Dr", code: "1050", account: "Inventory (stock-in-trade)", amount: "₹1,00,000" },
      { side: "Dr", code: "1081", account: "Input CGST", amount: "₹9,000" },
      { side: "Dr", code: "1082", account: "Input SGST", amount: "₹9,000" },
      { side: "Cr", code: "2010", account: "Accounts payable", amount: "₹1,18,000" },
    ],
    total: "₹1,18,000",
  },
];

/** The six voucher keys; picking one shows the entry it would post. */
export function VoucherExplorer({ cardClass }: { cardClass: string }) {
  const [active, setActive] = useState<VKey>("F8");
  const v = VOUCHERS.find((x) => x.key === active)!;
  return (
    <div className="mt-12 grid gap-8 lg:grid-cols-[7fr_5fr] lg:gap-10">
      <ul className="grid gap-4 sm:grid-cols-2">
        {VOUCHERS.map((x) => {
          const on = x.key === active;
          return (
            <li key={x.key}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => setActive(x.key)}
                className={`${cardClass} group flex h-full w-full flex-col items-start p-5 text-left ${on ? "!border-brand/50 bg-brand-wash/40" : ""}`}
              >
                <kbd
                  className={`inline-flex h-10 min-w-[48px] items-center justify-center rounded-[9px] border border-line-strong bg-surface px-3 font-mono text-[14px] text-ink transition-[transform,border-width] duration-150 motion-reduce:transition-none ${
                    on ? "translate-y-px border-b" : "border-b-[3px] group-hover:translate-y-px"
                  }`}
                >
                  {x.key}
                </kbd>
                <span className="mt-4 block text-[16px] font-semibold tracking-[-0.01em] text-ink">{x.name}</span>
                <span className="mt-1 block text-[14.5px] leading-[1.5] text-ink-soft">{x.body}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="lg:sticky lg:top-36 lg:self-start">
        <div className="rounded-panel border border-line bg-surface shadow-pop">
          <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
            <div>
              <p className="text-[15px] font-semibold tracking-[-0.01em]">
                {v.name} voucher <span className={`ml-1 ${keycap}`}>{v.key}</span>
              </p>
              <p className="mt-0.5 text-[13px] text-ink-muted">Example: {v.example}</p>
            </div>
            <span className={`${chip} bg-ok-wash text-ok`}>Balanced</span>
          </div>
          <Reveal key={active}>
            <div className="min-h-[248px] px-5 pb-5 pt-2">
              <table className="w-full text-[13.5px]">
                <thead>
                  <tr className="text-[12.5px] text-ink-muted">
                    <th scope="col" className="py-2 text-left font-medium">Account</th>
                    <th scope="col" className="py-2 text-right font-medium">Debit</th>
                    <th scope="col" className="py-2 text-right font-medium">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {v.lines.map((l) => (
                    <tr key={l.code + l.side} className="border-t border-line">
                      <td className="py-2.5 pr-3 text-ink">
                        <span className="mr-2 font-mono text-[12px] text-ink-muted">{l.code}</span>
                        {l.account}
                      </td>
                      <td className="py-2.5 text-right text-ink">{l.side === "Dr" ? l.amount : ""}</td>
                      <td className="py-2.5 pl-3 text-right text-ink">{l.side === "Cr" ? l.amount : ""}</td>
                    </tr>
                  ))}
                  <tr className="border-t border-line-strong">
                    <th scope="row" className="pt-3 text-left font-semibold text-ink">Total</th>
                    <td className="pt-3 text-right font-semibold"><span className="ledger-total">{v.total}</span></td>
                    <td className="pt-3 pl-3 text-right font-semibold"><span className="ledger-total">{v.total}</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Reveal>
        </div>
        <p className="mt-3 text-[13px] text-ink-muted">Pick a voucher to see the entry it posts.</p>
      </div>
    </div>
  );
}

/** One statement line with the match Deku proposes and why; confirming it marks it matched. */
export function ReconMatch() {
  const [done, setDone] = useState(false);
  const reasons = ["amount and direction match", "reference 4471902 found", "2 days apart", 'party name "KAVERI" in narration'];
  return (
    <div className="rounded-panel border border-line bg-surface shadow-pop">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <p className="text-[15px] font-semibold tracking-[-0.01em]">Statement line</p>
        <span
          className={`${chip} transition-colors duration-300 ${done ? "bg-ok-wash text-ok" : "bg-brand-wash text-brand-strong"}`}
          aria-live="polite"
        >
          {done ? "Matched" : "Proposed match"}
        </span>
      </div>
      <div className="grid gap-4 p-5 sm:grid-cols-2">
        <div className="rounded-[10px] border border-line p-4">
          <p className="text-[12.5px] text-ink-muted">From the bank, 11 Nov 2026</p>
          <p className="mt-1 break-words font-mono text-[12.5px] text-ink">NEFT CR KAVERI INFRA 4471902</p>
          <p className="mt-2 text-[15px] font-semibold">₹4,72,000 in</p>
        </div>
        <div
          className={`rounded-[10px] border p-4 transition-colors duration-300 ${done ? "border-ok/40 bg-ok-wash/50" : "border-brand/40 bg-brand-wash/40"}`}
        >
          <p className="text-[12.5px] text-ink-muted">In the books, 9 Nov 2026</p>
          <p className="mt-1 text-[13.5px] text-ink">Receipt from Kaveri Infra, ref 4471902</p>
          <p className="mt-2 text-[15px] font-semibold">₹4,72,000 debit, 1020</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-4">
        <ul className="flex flex-wrap gap-1.5">
          {reasons.map((r) => (
            <li key={r} className={`${chip} bg-canvas-sunken text-ink-soft`}>{r}</li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => setDone((d) => !d)}
          className={`inline-flex h-9 items-center gap-1.5 rounded-ctl px-3.5 text-[13.5px] font-medium transition-[background-color,color,transform] duration-150 active:translate-y-px motion-reduce:transform-none ${
            done ? "border border-line-strong bg-surface text-ink hover:bg-canvas" : "bg-ink text-white hover:bg-panel-raised"
          }`}
        >
          {done ? "Undo" : (<><Check className="h-3.5 w-3.5" aria-hidden /> Confirm match</>)}
        </button>
      </div>
      <p className="border-t border-line px-5 py-3 text-[12.5px] text-ink-muted">Example line. Nothing is matched until you confirm it.</p>
    </div>
  );
}

const IMPORT_STEPS = ["Upload", "Detect", "Map", "Validate", "Review", "Apply"];

/** The import wizard's six steps. */
export function ImportSteps() {
  return (
    <div className="flex aspect-[16/10] flex-col justify-center rounded-[10px] border border-line bg-surface p-5">
      <p className="text-[13px] font-medium text-ink">Import from a Tally XML export or CSV</p>
      <ol className="mt-4 grid grid-cols-3 gap-2">
        {IMPORT_STEPS.map((s, i) => (
          <li
            key={s}
            className={`flex items-center gap-2 rounded-[8px] border px-2.5 py-2 text-[12.5px] ${
              i === 4 ? "border-brand/50 bg-brand-wash text-ink" : i < 4 ? "border-line bg-canvas/60 text-ink-soft" : "border-line text-ink-muted"
            }`}
          >
            <span className="font-mono text-[11px] text-ink-muted">{i + 1}</span>
            {s}
            {i < 4 && <Check className="ml-auto h-3.5 w-3.5 text-brand-strong" aria-hidden />}
          </li>
        ))}
      </ol>
      <p className="mt-4 text-[12.5px] leading-[1.45] text-ink-muted">
        Masters, opening balances and vouchers. The file is read in your browser; only the rows you apply are sent.
      </p>
    </div>
  );
}

/** What a Deku deployment contains. */
export function DeploymentDiagram() {
  const parts = [
    { name: "Web app", note: "The screens you use" },
    { name: "API", note: "Sign-in, rules and posting" },
    { name: "Database", note: "Your books, in Postgres" },
  ];
  return (
    <div className="flex aspect-[16/10] flex-col justify-center rounded-[10px] border border-line bg-surface p-5">
      <div className="rounded-[10px] border border-dashed border-brand/50 p-4">
        <p className="text-[12.5px] font-medium text-brand-strong">Your deployment</p>
        <ol className="mt-3 grid grid-cols-3 gap-2">
          {parts.map((p) => (
            <li key={p.name} className="rounded-[8px] border border-line bg-canvas/60 px-2.5 py-2.5">
              <p className="text-[13px] font-medium text-ink">{p.name}</p>
              <p className="mt-0.5 text-[11.5px] leading-[1.35] text-ink-muted">{p.note}</p>
            </li>
          ))}
        </ol>
      </div>
      <p className="mt-4 text-[12.5px] leading-[1.45] text-ink-muted">Set up for one business, not shared with other companies.</p>
    </div>
  );
}
