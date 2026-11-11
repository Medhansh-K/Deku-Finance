"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { reminderMessage } from "@/lib/collect/whatsapp";
import Reveal from "./Reveal";
import { SampleQr } from "./InteractiveModePreview";

const DEMO = "/learn/demo/workspace?company=aster-trading&role=owner&plan=pro";

const card =
  "group flex h-full flex-col rounded-panel border border-line bg-surface p-7 transition-[border-color,box-shadow] duration-300 hover:border-line-strong hover:shadow-[0_12px_32px_-18px_rgb(14_27_25/0.25)] sm:p-8";
const title = "text-[20px] font-semibold leading-tight tracking-[-0.02em] text-ink";
const body = "mt-2.5 text-[15px] leading-[1.6] text-ink-soft";

function CardLink({ href, children, dark = false }: { href: string; children: React.ReactNode; dark?: boolean }) {
  return (
    <Link
      href={href}
      className={`mt-auto inline-flex items-center gap-1.5 self-start rounded-chip pt-7 text-[14.5px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
        dark ? "text-brand-soft hover:text-white" : "text-brand-strong hover:text-ink"
      }`}
    >
      {children}
      <ArrowRight aria-hidden="true" className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

function GrowthCard() {
  const [gst, setGst] = useState(false);
  return (
    <div className={card}>
      <h3 className={title}>Start lean, switch on GST in the same books</h3>
      <p className={body}>
        Begin with simple bills while you grow. When you register, turn on tax splits and team workflows without
        moving to another tool.
      </p>
      <div className="mt-6 inline-flex self-start rounded-ctl bg-canvas-sunken p-1" role="radiogroup" aria-label="Billing mode">
        {[
          [false, "Lean business"],
          [true, "GST registered"],
        ].map(([v, label]) => (
          <button
            key={String(v)}
            type="button"
            role="radio"
            aria-checked={gst === v}
            onClick={() => setGst(v as boolean)}
            className={`rounded-[7px] px-3 py-1.5 text-[13.5px] font-medium transition-[background-color,color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
              gst === v ? "bg-surface text-ink shadow-[0_1px_2px_rgb(14_27_25/0.1)]" : "text-ink-muted hover:text-ink"
            }`}
          >
            {label as string}
          </button>
        ))}
      </div>
      <div className="mt-4 rounded-ctl border border-line p-4 text-[13.5px]">
        <div className="flex justify-between gap-3">
          <span className="text-ink-muted">Bill format</span>
          <span className="font-medium text-ink">{gst ? "Tax invoice with tax split" : "Bill of supply"}</span>
        </div>
        <div className="mt-3 flex justify-between gap-3">
          <span className="text-ink-muted">Turnover this year</span>
          <span className={`tabular-nums ${gst ? "text-brand-strong" : "text-warn"}`}>
            {gst ? "Registered, no limit to watch" : "₹18,40,000 of ₹20,00,000"}
          </span>
        </div>
        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-canvas-sunken">
          <div
            className={`h-full rounded-full transition-[width,background-color] duration-700 ease-[cubic-bezier(.2,.7,.2,1)] motion-reduce:transition-none ${
              gst ? "w-full bg-brand" : "w-[92%] bg-warn"
            }`}
          />
        </div>
        <p className="mt-2.5 text-[12.5px] text-ink-muted">
          {gst ? "CGST and SGST or IGST worked out from the place of supply." : "Sample figures. Close to the limit, so it's time to register."}
        </p>
      </div>
      <CardLink href="/features">See all features</CardLink>
    </div>
  );
}

const TREE = [
  { name: "Assets", tier: "Group" },
  { name: "Current assets", tier: "Ledger" },
  { name: "Bank accounts", tier: "Sub-ledger" },
  { name: "Operating bank account", tier: "Label, takes entries" },
];

// The reminder text is the same function the Collections screen uses; noon UTC keeps the date stable in every time zone.
const REMINDER = reminderMessage({
  companyName: "Kavya Design Studio",
  customerName: "Apex Growth Solutions LLP",
  invoiceNumber: "KDS/26-27/0084",
  amountDuePaise: 4800000,
  dueDate: "2026-11-17T12:00:00Z",
  upiId: "kavya.studio@bank",
  msme45: false,
});

const TRAIL = [
  { step: "Created", who: "Vikram Desai", role: "Accountant" },
  { step: "Submitted for approval", who: "Vikram Desai", role: "Accountant" },
  { step: "Approved and posted", who: "Meera Joshi", role: "CFO" },
];

export default function LandingBentoGrid() {
  return (
    <section id="features" aria-labelledby="features-title" className="scroll-mt-20 bg-canvas">
      <div className="mx-auto max-w-[1200px] px-5 py-16 sm:px-8 lg:py-24">
        <Reveal className="max-w-[680px]">
          <h2 id="features-title" className="text-[32px] font-semibold leading-[1.1] tracking-[-0.03em] text-ink sm:text-[40px]">
            From the first bill to the balance sheet
          </h2>
          <p className="mt-5 text-[17px] leading-[1.55] text-ink-soft sm:text-[18px]">
            Collections, keyboard entry, live statements and safe delegation, all working on the same double-entry
            books.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-5 lg:grid-cols-12">
          <Reveal className="lg:col-span-7">
            <GrowthCard />
          </Reveal>

          <Reveal className="lg:col-span-5" delay={80}>
            <div className="group flex h-full flex-col rounded-panel border border-edge bg-panel-deep p-7 text-white sm:p-8">
              <h3 className="text-[20px] font-semibold leading-tight tracking-[-0.02em]">Books that balance themselves</h3>
              <p className="mt-2.5 text-[15px] leading-[1.6] text-white/70">
                Every rupee sits in Assets, Liabilities, Equity, Revenue or Expenses, so reports are right without
                spreadsheet fixes.
              </p>
              <ol className="mt-6 space-y-2 text-[13.5px]">
                {TREE.map((n, i) => (
                  <li key={n.name} className="flex items-center gap-3" style={{ paddingLeft: i * 18 }}>
                    {i > 0 && <span aria-hidden="true" className="-mt-3 h-4 w-3 shrink-0 rounded-bl-[4px] border-b border-l border-edge" />}
                    <span
                      className={`flex flex-1 items-baseline justify-between gap-3 rounded-[7px] px-2.5 py-1.5 ${
                        i === TREE.length - 1 ? "bg-brand/15 text-brand-soft" : "text-white/85"
                      }`}
                    >
                      <span>{n.name}</span>
                      <span className="text-[12px] text-white/45">{n.tier}</span>
                    </span>
                  </li>
                ))}
              </ol>
              <p className="mt-6 border-t border-edge pt-4 text-[13.5px] text-white/70">
                Debits equal credits on every voucher, or it doesn&apos;t post.
              </p>
              <CardLink href="#alerx" dark>
                Explore the chart of accounts
              </CardLink>
            </div>
          </Reveal>

          <Reveal className="lg:col-span-4">
            <div className={card}>
              <h3 className={title}>UPI QR on every bill</h3>
              <p className={body}>Your UPI ID and the exact amount, printed on the bill for any UPI app to scan.</p>
              <div className="mt-6 flex items-center gap-4 rounded-ctl border border-line p-4">
                <SampleQr className="h-[72px] w-[72px]" />
                <div className="min-w-0 text-[13px]">
                  <p className="truncate font-mono text-ink">kavya.studio@bank</p>
                  <p className="mt-0.5 text-[15px] font-semibold tabular-nums text-ink">₹24,890.00</p>
                  <p className="font-mono text-[12px] text-ink-muted">KDS/26-27/0104</p>
                </div>
              </div>
              <p className="mt-auto flex items-center gap-2 pt-6 text-[13.5px] text-ink-soft">
                <Check aria-hidden="true" className="h-4 w-4 text-brand-strong" />
                Paid straight to your own bank account
              </p>
            </div>
          </Reveal>

          <Reveal className="lg:col-span-8" delay={80}>
            <div className={card}>
              <div className="grid gap-8 md:grid-cols-[1fr_1.1fr]">
                <div>
                  <h3 className={title}>Know who owes you, and remind them on WhatsApp</h3>
                  <p className={body}>
                    Unpaid invoices are grouped by how long they&apos;ve been due. One click opens WhatsApp with a
                    polite reminder, the amount and your UPI ID already written. Your WhatsApp sends it; Deku
                    doesn&apos;t.
                  </p>
                  <ul className="mt-5 flex flex-wrap gap-2 text-xs font-medium">
                    <li className="inline-flex h-[22px] items-center rounded-chip bg-canvas-sunken px-2 text-ink-soft">Due in 6 days</li>
                    <li className="inline-flex h-[22px] items-center rounded-chip bg-warn-wash px-2 text-warn">Overdue 15+ days</li>
                    <li className="inline-flex h-[22px] items-center rounded-chip bg-bad-wash px-2 text-bad">Over 45 days</li>
                  </ul>
                </div>
                <figure className="self-start rounded-panel bg-canvas p-4">
                  <figcaption className="mb-2.5 text-[12.5px] text-ink-muted">Reminder text, as the Collections screen writes it</figcaption>
                  <p className="whitespace-pre-line rounded-[12px] rounded-tl-[4px] bg-surface p-3.5 text-[13.5px] leading-[1.55] text-ink shadow-[0_1px_2px_rgb(14_27_25/0.08)]">
                    {REMINDER}
                  </p>
                </figure>
              </div>
              <CardLink href={`${DEMO}&route=/collect`}>Open Collections in the demo</CardLink>
            </div>
          </Reveal>

          <Reveal className="lg:col-span-5">
            <div className={card}>
              <h3 className={title}>GST return files, prepared from your books</h3>
              <p className={body}>
                Sales and eligible credits are sorted into GSTR-1 and GSTR-3B summaries with offline JSON to upload on
                the portal. No mapping spreadsheets at month-end.
              </p>
              <pre className="mt-6 overflow-x-auto rounded-ctl border border-line bg-canvas p-4 font-mono text-[12.5px] leading-[1.7] text-ink-soft">
                <code>
                  {"{\n"}
                  {"  "}
                  <span className="text-ink-muted">&quot;period&quot;</span>: <span className="text-brand-strong">&quot;Oct 2026&quot;</span>
                  {",\n  "}
                  <span className="text-ink-muted">&quot;taxable_sales&quot;</span>: <span className="text-ink">600000.00</span>
                  {",\n  "}
                  <span className="text-ink-muted">&quot;eligible_credits&quot;</span>: <span className="text-ink">183600.00</span>
                  {"\n}"}
                </code>
              </pre>
              <p className="mt-2.5 text-[12.5px] text-ink-muted">Summary figures from the Aster Trading demo books.</p>
              <CardLink href="/gst-compliance">How GST works in Deku</CardLink>
            </div>
          </Reveal>

          <Reveal className="lg:col-span-7" delay={80}>
            <div className={card}>
              <h3 className={title}>Delegate daily entry, keep the final say</h3>
              <p className={body}>
                Your team drafts bills, expenses and vendor entries. An owner or manager approves before anything
                posts, and the voucher keeps the trail.
              </p>
              <ol className="mt-6 divide-y divide-line rounded-ctl border border-line">
                {TRAIL.map((t, i) => (
                  <li key={t.step} className="flex items-center gap-3.5 px-4 py-3 text-[13.5px]">
                    <span
                      className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[12px] font-medium ${
                        i === TRAIL.length - 1 ? "bg-brand text-ink" : "bg-canvas-sunken text-ink-soft"
                      }`}
                    >
                      {i + 1}
                    </span>
                    <span className="flex-1 text-ink-soft">{t.step}</span>
                    <span className="font-medium text-ink">{t.who}</span>
                    <span className="hidden h-[22px] items-center rounded-chip bg-canvas-sunken px-2 text-xs text-ink-soft sm:inline-flex">
                      {t.role}
                    </span>
                  </li>
                ))}
              </ol>
              <CardLink href={`${DEMO}&route=/approvals`}>See approvals in the demo</CardLink>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
