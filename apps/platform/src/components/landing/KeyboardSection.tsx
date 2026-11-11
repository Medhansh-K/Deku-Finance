"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Reveal from "./Reveal";

interface KeyInfo {
  cap: string;
  name: string;
  /** Label under the cap when the name is too long for it. */
  short?: string;
  kind: string;
  desc: string;
}

/** Same keys and screens as the app's F-key bar and Gateway (lib/keyboard/shortcuts.ts). */
const FUNCTION_ROW: KeyInfo[] = [
  { cap: "Esc", name: "Gateway", kind: "Home screen", desc: "Back to the Gateway of Deku from anywhere." },
  { cap: "F1", name: "Executive", kind: "Overview", desc: "Turnover, profit, cash, debtors and GST payable from posted vouchers." },
  { cap: "F2", name: "Consultant", kind: "Questions", desc: "Ask Deku Consultant about overdue payments, expense spikes or margins, answered from your ledger." },
  { cap: "F3", name: "Vouchers", kind: "All vouchers", desc: "Every double-entry voucher type in one place." },
  { cap: "F4", name: "Contra", kind: "Bank and cash transfer", desc: "Cash deposits and transfers between your own accounts." },
  { cap: "F5", name: "Payment", kind: "Money going out", desc: "Vendor settlements, rent, bills and expense payouts." },
  { cap: "F6", name: "Receipt", kind: "Money coming in", desc: "Customer payments, advances and other receipts." },
  { cap: "F7", name: "Journal", kind: "Adjustment entry", desc: "Depreciation, month-end adjustments and tax provisions." },
  { cap: "F8", name: "Sales", kind: "Tax invoice or bill of supply", desc: "B2B and B2C sales with place of supply, CGST, SGST or IGST, and a UPI QR." },
  { cap: "F9", name: "Purchase", kind: "Input tax credit", desc: "Vendor bills, with section 17(5) blocked credit kept apart." },
  { cap: "F10", name: "Bank rec", kind: "Reconciliation", desc: "Match a bank statement CSV against the bank ledger." },
  { cap: "F11", name: "GST file", kind: "Returns", desc: "GSTR-1 and GSTR-3B summaries with offline JSON for the portal." },
];

const LETTER_ROW: KeyInfo[] = [
  { cap: "V", name: "Vouchers", kind: "Gateway letter", desc: "Contra, payment, receipt, journal, sales and purchase." },
  { cap: "D", name: "Day Book", kind: "Gateway letter", desc: "Every voucher in date order, with its approval trail." },
  { cap: "U", name: "Purchases", kind: "Gateway letter", desc: "Inward supplies, purchase bills and ITC." },
  { cap: "W", name: "Collections", kind: "Gateway letter", desc: "Unpaid invoices and WhatsApp reminders." },
  { cap: "B", name: "Balance Sheet", short: "Balance", kind: "Gateway letter", desc: "Assets, liabilities and equity, with profit to date." },
  { cap: "O", name: "Profit & Loss", kind: "Gateway letter", desc: "Revenue, expenses and net profit for any period." },
  { cap: "T", name: "Trial Balance", kind: "Gateway letter", desc: "Debit and credit balances for every ledger." },
  { cap: "N", name: "General Ledger", short: "Ledger", kind: "Gateway letter", desc: "One account, every entry, with running balances." },
  { cap: "G", name: "GST", kind: "Gateway letter", desc: "Sales invoices, credit notes and the tax breakdown." },
  { cap: "R", name: "Reconciliation", kind: "Gateway letter", desc: "Bank and marketplace settlement matching." },
  { cap: "Q", name: "Approvals", kind: "Gateway letter", desc: "Vouchers waiting for a checker." },
  { cap: "Ctrl K", name: "Go to", kind: "Search", desc: "Jump to any screen, ledger or party by typing its name." },
];

const ALL = [...FUNCTION_ROW, ...LETTER_ROW];
const isVoucherKey = (cap: string) => /^F[4-9]$/.test(cap);
// Keys the browser uses for something a visitor might want (reload, full screen) are shown but never swallowed.
const SWALLOW = new Set(["F1", "F2", "F3", "F4", "F6", "F7", "F8", "F9", "F10", "Ctrl K"]);

function capFor(e: KeyboardEvent): string | null {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") return "Ctrl K";
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  if (e.key === "Escape") return "Esc";
  if (/^F([1-9]|1[01])$/.test(e.key)) return e.key;
  if (e.key.length === 1) return e.key.toUpperCase();
  return null;
}

function Cap({ k, active, onSelect }: { k: KeyInfo; active: boolean; onSelect: (cap: string) => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={`${k.cap}: ${k.name}`}
      onClick={() => onSelect(k.cap)}
      className="group flex min-w-0 flex-col items-center gap-2 rounded-[12px] focus-visible:outline-none"
    >
      <span
        className={`grid h-14 w-full place-items-center whitespace-nowrap rounded-[10px] border font-mono text-[15px] sm:text-[16px] transition-[transform,background-color,border-color,box-shadow] duration-150 group-focus-visible:ring-2 group-focus-visible:ring-brand group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-panel sm:h-16 ${
          active
            ? "translate-y-[2px] border-brand bg-brand text-ink shadow-[0_1px_0_0_#078a7c]"
            : "border-[#d7dfdc] bg-[#f6f8f7] text-ink shadow-[0_3px_0_0_#b9c5c1] group-hover:bg-white group-active:translate-y-[2px] group-active:shadow-[0_1px_0_0_#b9c5c1]"
        }`}
      >
        {k.cap}
      </span>
      <span className={`w-full text-center text-[12.5px] leading-tight transition-colors ${active ? "text-white" : "text-white/55"}`}>
        {k.short ?? k.name}
      </span>
    </button>
  );
}

export default function KeyboardSection() {
  const [active, setActive] = useState("F8");
  const ref = useRef<HTMLElement>(null);
  const current = ALL.find((k) => k.cap === active) ?? FUNCTION_ROW[8];

  // Listens only while the section is on screen, so the rest of the page keeps normal keyboard behaviour.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let inView = false;
    const io = new IntersectionObserver(([e]) => (inView = e.isIntersecting), { threshold: 0.35 });
    io.observe(el);
    const onKey = (e: KeyboardEvent) => {
      if (!inView) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const cap = capFor(e);
      if (!cap || !ALL.some((k) => k.cap === cap)) return;
      if (SWALLOW.has(cap)) e.preventDefault();
      setActive(cap);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      io.disconnect();
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <section ref={ref} id="keyboard" aria-labelledby="keyboard-title" className="scroll-mt-20 bg-panel-deep text-white">
      <div className="mx-auto max-w-[1200px] px-5 py-16 sm:px-8 lg:py-24">
        <Reveal className="max-w-[720px]">
          <h2 id="keyboard-title" className="text-[32px] font-semibold leading-[1.1] tracking-[-0.03em] sm:text-[44px]">
            Keep your hands on the keyboard
          </h2>
          <p className="mt-5 text-[17px] leading-[1.55] text-white/70 sm:text-[18px]">
            Every voucher has a function key and every register a letter, the way accountants who learned on desktop
            software already work. Press a key, or tap one, to see what it opens.
          </p>
        </Reveal>

        <Reveal delay={100} className="mt-14">
          <div className="rounded-[20px] border border-edge bg-panel p-4 sm:p-6">
            <div className="grid grid-cols-4 gap-x-2.5 gap-y-4 sm:grid-cols-6 lg:grid-cols-12 lg:gap-x-2.5">
              {FUNCTION_ROW.map((k) => (
                <Cap key={k.cap} k={k} active={active === k.cap} onSelect={setActive} />
              ))}
            </div>
            <div className="my-5 border-t border-edge" />
            <div className="grid grid-cols-4 gap-x-2.5 gap-y-4 sm:grid-cols-6 lg:grid-cols-12 lg:gap-x-2.5">
              {LETTER_ROW.map((k) => (
                <Cap key={k.cap} k={k} active={active === k.cap} onSelect={setActive} />
              ))}
            </div>
          </div>

          <div
            aria-live="polite"
            className="mt-6 grid gap-6 rounded-[20px] border border-edge p-6 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:gap-8 sm:p-7"
          >
            <span className="grid h-16 min-w-16 place-items-center self-start justify-self-start rounded-[12px] bg-brand px-3 font-mono text-[20px] text-ink">
              {current.cap}
            </span>
            <div key={current.cap} className="motion-safe:animate-[dekuFade_.3s_ease-out]">
              <p className="text-[20px] font-semibold tracking-[-0.02em]">
                {current.name}
                <span className="ml-3 text-[15px] font-normal text-white/55">{current.kind}</span>
              </p>
              <p className="mt-1.5 text-[15.5px] leading-[1.55] text-white/70">{current.desc}</p>
            </div>
            {isVoucherKey(current.cap) && (
              <ul className="flex flex-wrap gap-x-5 gap-y-2 text-[13.5px] text-white/65 sm:flex-col">
                <li className="flex items-center gap-2">
                  <kbd className="rounded-[5px] border border-edge border-b-2 bg-panel-deep px-1.5 pb-[2px] pt-[3px] font-mono text-[12px] text-white/85">Enter</kbd>
                  next field
                </li>
                <li className="flex items-center gap-2">
                  <kbd className="rounded-[5px] border border-edge border-b-2 bg-panel-deep px-1.5 pb-[2px] pt-[3px] font-mono text-[12px] text-white/85">Ctrl Enter</kbd>
                  save
                </li>
              </ul>
            )}
          </div>
        </Reveal>

        <p className="mt-8 text-[15px] text-white/60">
          The demo has the full key map.{" "}
          <Link
            href="/learn/demo"
            className="rounded-chip text-brand-soft underline decoration-brand/40 underline-offset-4 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            Try it on sample books
          </Link>
        </p>
      </div>
    </section>
  );
}
