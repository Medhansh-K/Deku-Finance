"use client";

import React, { useId, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import Reveal from "./Reveal";

type PresetKey = "saas" | "ecommerce" | "freelance" | "wholesale";
type GroupCode = "A" | "L" | "E" | "R" | "X";

interface AccountRow {
  code: string;
  group: GroupCode;
  ledger: string;
  subLedger: string;
  label: string;
  entries: number;
  balance: number;
  description: string;
}

interface Preset {
  title: string;
  subtitle: string;
  summary: string;
  accounts: AccountRow[];
}

const GROUP_NAME: Record<GroupCode, string> = { A: "Assets", L: "Liabilities", E: "Equity", R: "Revenue", X: "Expenses" };

/** Illustrations of how each kind of business labels its accounts. Names are generic; balances are samples. */
const PRESETS: Record<PresetKey, Preset> = {
  saas: {
    title: "Software and digital agency",
    subtitle: "Licences, retainers, cloud hosting and payment gateways",
    summary: "Gateway settlement ledgers, recurring revenue, hosting costs and output GST.",
    accounts: [
      { code: "1021", group: "A", ledger: "Cash and bank", subLedger: "Operating bank accounts", label: "Primary current account", entries: 14, balance: 420000, description: "Receives gateway payouts and client transfers." },
      { code: "1031", group: "A", ledger: "Current assets and receivables", subLedger: "Trade debtors", label: "Annual contract receivables", entries: 5, balance: 185000, description: "Unpaid invoices to annual contract clients." },
      { code: "2081", group: "L", ledger: "Statutory and tax liabilities", subLedger: "Output GST", label: "Output IGST 18%, software licences", entries: 12, balance: 45000, description: "Tax collected on inter-state subscriptions." },
      { code: "3010", group: "E", ledger: "Owner capital", subLedger: "Shareholder capital", label: "Founder capital", entries: 1, balance: 500000, description: "Capital put in at incorporation." },
      { code: "4010", group: "R", ledger: "Operating revenue", subLedger: "Product revenue", label: "Monthly subscription revenue", entries: 24, balance: 680000, description: "Subscription fees earned from customers." },
      { code: "5030", group: "X", ledger: "Operating overheads", subLedger: "Technology and infrastructure", label: "Cloud hosting", entries: 4, balance: 68500, description: "Monthly server and hosting invoices." },
    ],
  },
  ecommerce: {
    title: "D2C and e-commerce seller",
    subtitle: "Marketplace and web-store sales, stock and shipping",
    summary: "Marketplace receivables, stock valuation, courier freight and reverse charge.",
    accounts: [
      { code: "1032", group: "A", ledger: "Current assets and receivables", subLedger: "Trade debtors", label: "Marketplace settlements due", entries: 38, balance: 245000, description: "Sales the marketplace holds until its settlement cycle pays out." },
      { code: "1040", group: "A", ledger: "Current assets and receivables", subLedger: "Stock", label: "Finished goods in the warehouse", entries: 15, balance: 890000, description: "Landed stock ready to ship." },
      { code: "1081", group: "A", ledger: "Tax assets and input credit", subLedger: "Input GST", label: "Input CGST and SGST on purchases", entries: 22, balance: 64200, description: "Eligible credit to set off in GSTR-3B." },
      { code: "4011", group: "R", ledger: "Operating revenue", subLedger: "Product revenue", label: "Own web store sales", entries: 112, balance: 740000, description: "Orders taken on the brand's own store." },
      { code: "5010", group: "X", ledger: "Cost of sales", subLedger: "Materials and packaging", label: "Raw materials and packaging", entries: 19, balance: 280000, description: "Direct costs and packing material." },
      { code: "5091", group: "X", ledger: "Operating overheads", subLedger: "Financial charges", label: "Gateway and cash-on-delivery fees", entries: 84, balance: 18200, description: "Processing fees deducted from payouts." },
    ],
  },
  freelance: {
    title: "Freelancer or solo studio",
    subtitle: "Designers, consultants and developers below the GST limit",
    summary: "Bills of supply, client retainers, UPI receipts and no GST ledgers to maintain.",
    accounts: [
      { code: "1020", group: "A", ledger: "Cash and bank", subLedger: "Operating bank accounts", label: "Professional bank account", entries: 9, balance: 195000, description: "Receives UPI and NEFT payments from clients." },
      { code: "1030", group: "A", ledger: "Current assets and receivables", subLedger: "Trade debtors", label: "Unpaid client bills", entries: 3, balance: 75000, description: "Milestone bills not yet paid, watched against the 45-day MSME rule." },
      { code: "3010", group: "E", ledger: "Owner capital", subLedger: "Proprietor capital", label: "Owner's capital", entries: 1, balance: 100000, description: "Money put in for equipment and setup." },
      { code: "4020", group: "R", ledger: "Operating revenue", subLedger: "Service fees", label: "Design and branding retainers", entries: 7, balance: 340000, description: "Service income while below the registration limit." },
      { code: "5030", group: "X", ledger: "Operating overheads", subLedger: "Software and subscriptions", label: "Design and productivity software", entries: 6, balance: 24500, description: "Monthly software licences." },
    ],
  },
  wholesale: {
    title: "Wholesale and trading",
    subtitle: "Distributors, stockists and manufacturing units",
    summary: "Dealer credit, supplier payables, freight and intra- or inter-state tax splits.",
    accounts: [
      { code: "1030", group: "A", ledger: "Current assets and receivables", subLedger: "Trade debtors", label: "Dealer and distributor receivables", entries: 44, balance: 1850000, description: "30-day dealer credit." },
      { code: "2010", group: "L", ledger: "Current liabilities", subLedger: "Trade creditors", label: "Mill supplier payables", entries: 16, balance: 1240000, description: "Unpaid bills for raw material." },
      { code: "2080", group: "L", ledger: "Statutory and tax liabilities", subLedger: "Output GST", label: "Output CGST and SGST, intra-state", entries: 28, balance: 166500, description: "9% + 9% on dispatches within the state." },
      { code: "4010", group: "R", ledger: "Operating revenue", subLedger: "Wholesale sales", label: "Bulk finished goods sales", entries: 32, balance: 2480000, description: "Revenue on large consignments." },
      { code: "5010", group: "X", ledger: "Cost of sales", subLedger: "Freight and transport", label: "Inward and outward freight", entries: 21, balance: 145000, description: "Truck freight and transit insurance." },
    ],
  },
};

const TIERS = [
  { name: "Group", desc: "Assets, Liabilities, Equity, Revenue, Expenses" },
  { name: "Ledger", desc: "Cash and bank, receivables, statutory taxes" },
  { name: "Sub-ledger", desc: "Bank accounts, trade debtors, output GST" },
  { name: "Label", desc: "The account you post to: a bank, a customer, hosting" },
];

const PILLARS = [
  {
    title: "A standard chart from day one",
    body: "No weeks of setup. Numbering follows the familiar pattern: Assets in the 1000s, Liabilities 2000s, Equity 3000s, Revenue 4000s and Expenses 5000s.",
  },
  {
    title: "Entries counted as well as valued",
    body: "Each journal line records the rupee amount and a count of the business event, so you can see how often something happens next to what it cost.",
  },
  {
    title: "Reports that need no reconciling",
    body: "Entries post only to labels inside the tree, so Profit & Loss, Balance Sheet and Trial Balance are computed straight from them.",
  },
];

const inr = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2 });

export default function AlerxLedgerSection() {
  const [preset, setPreset] = useState<PresetKey>("saas");
  const [query, setQuery] = useState("");
  const searchId = useId();
  const current = PRESETS[preset];
  const q = query.trim().toLowerCase();
  const rows = current.accounts.filter(
    (a) =>
      !q ||
      a.label.toLowerCase().includes(q) ||
      a.code.includes(q) ||
      GROUP_NAME[a.group].toLowerCase().includes(q) ||
      a.subLedger.toLowerCase().includes(q)
  );

  return (
    <section id="alerx" aria-labelledby="alerx-title" className="scroll-mt-20 bg-surface">
      <div className="mx-auto max-w-[1200px] px-5 py-24 sm:px-8 lg:py-36">
        <Reveal className="max-w-[720px]">
          <h2 id="alerx-title" className="text-[32px] font-semibold leading-[1.1] tracking-[-0.03em] text-ink sm:text-[40px]">
            A clear chart of accounts for any kind of business
          </h2>
          <p className="mt-5 text-[17px] leading-[1.55] text-ink-soft sm:text-[18px]">
            Every company starts on the same four-tier ALERX structure. Pick a business type below to see how its
            revenue, bank accounts, receivables and costs sit inside it.
          </p>
        </Reveal>

        {/* The four tiers, read left to right */}
        <Reveal delay={80} className="mt-14">
          <ol className="grid gap-px overflow-hidden rounded-panel border border-line bg-line sm:grid-cols-2 lg:grid-cols-5">
            {TIERS.map((t, i) => (
              <li key={t.name} className="bg-surface p-5">
                <p className="text-[13px] text-ink-muted">Tier {i + 1}</p>
                <p className="mt-1 text-[16px] font-semibold text-ink">{t.name}</p>
                <p className="mt-1.5 text-[13.5px] leading-[1.5] text-ink-soft">{t.desc}</p>
              </li>
            ))}
            <li className="bg-brand-wash p-5 sm:col-span-2 lg:col-span-1">
              <p className="text-[13px] text-brand-strong">On every label</p>
              <p className="mt-1 text-[16px] font-semibold text-ink">Entries and value</p>
              <p className="mt-1.5 text-[13.5px] leading-[1.5] text-ink-soft">How many entries it has, and its rupee balance.</p>
            </li>
          </ol>
        </Reveal>

        <Reveal className="mt-16">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div role="tablist" aria-label="Business type" className="flex flex-wrap gap-2">
              {(Object.keys(PRESETS) as PresetKey[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={preset === key}
                  aria-controls="alerx-table"
                  onClick={() => setPreset(key)}
                  className={`rounded-ctl border px-3.5 py-2 text-left text-[14px] transition-[background-color,border-color,color] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                    preset === key
                      ? "border-ink bg-ink text-white"
                      : "border-line-strong bg-surface text-ink-soft hover:border-ink-subtle hover:text-ink"
                  }`}
                >
                  {PRESETS[key].title}
                </button>
              ))}
            </div>
            <div className="relative w-full lg:w-72">
              <label htmlFor={searchId} className="sr-only">
                Search accounts
              </label>
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
              <input
                id={searchId}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search accounts or codes"
                className="h-10 w-full rounded-ctl border border-line-strong bg-surface pl-9 pr-3 text-[14px] text-ink placeholder:text-ink-subtle focus:border-brand focus:outline-none focus:ring-3 focus:ring-brand/20"
              />
            </div>
          </div>

          <p className="mt-5 text-[15px] text-ink-soft">
            <span className="font-medium text-ink">{current.subtitle}.</span> {current.summary}
          </p>

          <div id="alerx-table" role="tabpanel" className="mt-5 overflow-hidden rounded-panel border border-line">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left text-[14px]">
                <thead>
                  <tr className="bg-[#fafbfa] text-[13px] text-ink-muted">
                    <th scope="col" className="px-5 py-3 font-medium">Code</th>
                    <th scope="col" className="px-5 py-3 font-medium">Group</th>
                    <th scope="col" className="px-5 py-3 font-medium">Ledger and sub-ledger</th>
                    <th scope="col" className="px-5 py-3 font-medium">Label</th>
                    <th scope="col" className="px-5 py-3 text-right font-medium">Sample entries</th>
                    <th scope="col" className="px-5 py-3 text-right font-medium">Sample balance</th>
                  </tr>
                </thead>
                <tbody key={preset} className="motion-safe:animate-[dekuFade_.35s_ease-out]">
                  {rows.length > 0 ? (
                    rows.map((a) => (
                      <tr key={a.code} className="border-t border-line align-top transition-colors hover:bg-canvas/60">
                        <td className="px-5 py-4 font-mono text-[13px] text-ink-soft">{a.code}</td>
                        <td className="px-5 py-4">
                          <span className="inline-flex h-[22px] items-center gap-1.5 rounded-chip bg-canvas-sunken px-2 text-xs font-medium text-ink-soft">
                            <span className="font-mono text-ink">{a.group}</span>
                            {GROUP_NAME[a.group]}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-ink-soft">
                          {a.ledger}
                          <span className="block text-[13px] text-ink-muted">{a.subLedger}</span>
                        </td>
                        <td className="px-5 py-4">
                          <span className="font-medium text-ink">{a.label}</span>
                          <span className="mt-0.5 block text-[13px] text-ink-muted">{a.description}</span>
                        </td>
                        <td className="px-5 py-4 text-right tabular-nums text-ink-soft">{a.entries}</td>
                        <td className="px-5 py-4 text-right tabular-nums text-ink">₹{inr(a.balance)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr className="border-t border-line">
                      <td colSpan={6} className="px-5 py-10 text-center text-ink-muted">
                        No account in this example matches &ldquo;{query}&rdquo;.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col gap-3 border-t border-line bg-[#fafbfa] px-5 py-4 text-[13.5px] text-ink-soft sm:flex-row sm:items-center sm:justify-between">
              <p>Entries can only post to labels. The database refuses a line posted to a group or ledger.</p>
              <Link
                href="/request-setup"
                className="shrink-0 rounded-chip font-medium text-brand-strong hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                Set up your chart
              </Link>
            </div>
          </div>
        </Reveal>

        <div className="mt-16 grid gap-10 border-t border-line pt-12 md:grid-cols-3">
          {PILLARS.map((p, i) => (
            <Reveal key={p.title} delay={i * 80}>
              <h3 className="text-[17px] font-semibold tracking-[-0.01em] text-ink">{p.title}</h3>
              <p className="mt-2.5 text-[15px] leading-[1.6] text-ink-soft">{p.body}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
