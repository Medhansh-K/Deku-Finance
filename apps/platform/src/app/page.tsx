import Link from "next/link";
import { Check } from "lucide-react";
import LandingNavbar from "@/components/landing/LandingNavbar";
import LandingFooter from "@/components/landing/LandingFooter";
import InteractiveModePreview from "@/components/landing/InteractiveModePreview";
import LandingBentoGrid from "@/components/landing/LandingBentoGrid";
import KeyboardSection from "@/components/landing/KeyboardSection";
import AlerxLedgerSection from "@/components/landing/AlerxLedgerSection";
import ComparisonSection from "@/components/landing/ComparisonSection";
import PricingPlansSection from "@/components/landing/PricingPlansSection";
import FaqSection from "@/components/landing/FaqSection";
import ProductShot from "@/components/landing/ProductShot";
import Reveal from "@/components/landing/Reveal";
import { LEARN_WORKFLOWS } from "@/lib/learn/workflows/catalogue";
import { DEMO_COMPANIES } from "@/lib/learn/companies";
import executiveShot from "../../public/landing/executive.webp";
import dayBookShot from "../../public/landing/day-book-approval.webp";
import gstReturnsShot from "../../public/landing/gst-returns.webp";
import balanceSheetShot from "../../public/landing/balance-sheet.webp";

const primaryBtn =
  "inline-flex h-11 sm:h-12 items-center justify-center whitespace-nowrap rounded-ctl bg-brand px-5 sm:px-6 text-[15px] sm:text-[15.5px] font-medium text-ink transition-[background-color,transform] hover:bg-brand-hover active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2";
const h2 = "text-[26px] font-semibold leading-[1.12] tracking-[-0.03em] text-ink sm:text-[34px] lg:text-[40px]";
const lead = "mt-3 text-[15.5px] leading-[1.55] text-ink-soft sm:mt-5 sm:text-[18px]";

const HIGHLIGHTS = ["UPI QR on every bill", "Live cash flow and P&L", "Team roles and approvals", "GST when you're ready"];

const ALSO = [
  { title: "Inventory", body: "Items, warehouses and stock valued first-in first-out." },
  { title: "Tally and CSV import", body: "Bring in masters, opening balances and vouchers." },
  { title: "Deku Consultant", body: "Questions about your books, answered from the ledger with fixed logic." },
  { title: "Seven roles", body: "Owner to auditor, each seeing and posting only what it should." },
];

// Motion used across the landing sections; every use is wrapped in motion-safe.
const KEYFRAMES = `
@keyframes dekuRise{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:none}}
@keyframes dekuFade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@keyframes dekuGrow{from{transform:scaleX(0)}to{transform:scaleX(1)}}
`;

export default function Home() {
  const workflows = LEARN_WORKFLOWS.length;
  return (
    <div className="flex min-h-screen flex-col bg-canvas font-sans text-ink selection:bg-brand/25">
      <style>{KEYFRAMES}</style>
      <LandingNavbar />

      <main>
        {/* Hero */}
        <section aria-labelledby="hero-title" className="bg-canvas">
          <div className="mx-auto max-w-[1200px] px-4 pb-8 pt-6 sm:px-8 sm:pb-14 sm:pt-14 lg:pb-20 lg:pt-20">
            <h1
              id="hero-title"
              className="max-w-[16ch] text-[34px] font-semibold leading-[1.04] tracking-[-0.04em] text-ink motion-safe:animate-[dekuFade_.6s_ease-out_both] sm:text-[56px] lg:text-[68px]"
            >
              Invoices, GST and books that balance.
            </h1>
            <div className="mt-5 grid gap-5 sm:mt-8 sm:gap-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:items-end lg:gap-10">
              <p className="max-w-[60ch] text-[16px] leading-[1.5] text-ink-soft motion-safe:animate-[dekuFade_.6s_.08s_ease-out_both] sm:text-[19px] sm:leading-[1.55]">
                Deku Finance is a GST and financial operating system for Indian businesses. Raise invoices, post
                vouchers from the keyboard, have a second person approve them, and prepare GST returns from the same
                double-entry books.
              </p>
              <div className="motion-safe:animate-[dekuFade_.6s_.16s_ease-out_both] lg:justify-self-end">
                <div className="flex flex-col gap-2.5 sm:flex-row sm:gap-3">
                  <Link href="/learn/demo" className={primaryBtn}>
                    Try the demo
                  </Link>
                  <Link
                    href="/request-setup"
                    className="inline-flex h-11 items-center justify-center whitespace-nowrap rounded-ctl border border-line-strong bg-surface px-5 text-[15px] font-medium text-ink transition-[background-color,transform] hover:bg-canvas-sunken active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 sm:h-12 sm:px-6 sm:text-[15.5px]"
                  >
                    Request a setup
                  </Link>
                </div>
                <p className="mt-2.5 text-[13px] text-ink-muted sm:mt-3 sm:text-[14px]">
                  {workflows} guided workflows on sample books (best on laptop). No sign-up.
                </p>
              </div>
            </div>
            <ul className="mt-6 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-line pt-4 text-[13px] text-ink-soft sm:mt-12 sm:flex sm:flex-wrap sm:gap-x-7 sm:gap-y-3 sm:pt-6 sm:text-[14.5px]">
              {HIGHLIGHTS.map((h) => (
                <li key={h} className="flex items-center gap-1.5 sm:gap-2">
                  <Check aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-brand-strong sm:h-4 sm:w-4" />
                  <span>{h}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* The product shot straddles the hero and the dark section below it. */}
        <div className="bg-[linear-gradient(to_bottom,var(--color-canvas)_0,var(--color-canvas)_50%,var(--color-panel-deep)_50%)]">
          <div className="mx-auto max-w-[1200px] px-4 sm:px-8">
            <div className="motion-safe:animate-[dekuRise_1s_.25s_cubic-bezier(.2,.7,.2,1)_both]">
              <ProductShot
                src={executiveShot}
                priority
                alt="The Executive summary in Deku Finance for the fictional Aster Trading Co.: turnover, net profit, cash, debtors and GST payable, and a balance check showing assets equal liabilities plus equity."
              />
            </div>
          </div>
        </div>

        <InteractiveModePreview />

        {/* Real screens */}
        <section aria-labelledby="screens-title" className="bg-surface">
          <div className="mx-auto max-w-[1200px] px-4 py-10 sm:px-8 sm:py-16 lg:py-24">
            <h2 id="screens-title" className="sr-only">
              The product, screen by screen
            </h2>

            <div className="grid items-center gap-6 sm:gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-20">
              <Reveal>
                <h3 className={h2}>Every voucher shows who made it and who approved it</h3>
                <p className={lead}>
                  The Day Book lists every voucher in date order. Open one to see its journal lines, the debit and
                  credit totals that must match, and the approval trail from created to posted.
                </p>
                <p className="mt-3 text-[14.5px] leading-[1.55] text-ink-muted sm:mt-4 sm:text-[15.5px] sm:leading-[1.6]">
                  Drafts wait in the approvals queue until an owner, CFO or admin signs off.
                </p>
              </Reveal>
              <Reveal delay={100} className="mx-auto w-full max-w-[540px] lg:mr-0">
                <ProductShot
                  src={dayBookShot}
                  chrome={false}
                  sizes="(min-width: 1024px) 540px, 100vw"
                  alt="A payment voucher open in the Day Book: debit Accounts Payable and credit Operating Bank Account for ₹7,00,000, with an approval trail showing it was created and submitted by an accountant and approved and posted by the CFO."
                />
              </Reveal>
            </div>

            <div className="mt-10 grid items-center gap-6 sm:mt-16 sm:gap-12 lg:mt-36 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)] lg:gap-16">
              <Reveal className="lg:order-2">
                <h3 className={h2}>GSTR-1 and GSTR-3B, prepared from your invoices</h3>
                <p className={lead}>
                  Deku sorts sales and eligible credit into the return sections, validates them and gives you offline
                  JSON to upload on the GST portal.
                </p>
                <p className="mt-3 text-[14.5px] leading-[1.55] text-ink-muted sm:mt-4 sm:text-[15.5px] sm:leading-[1.6]">
                  Sections Deku doesn&apos;t generate yet are listed on the screen. Filing straight from Deku needs a
                  GST Suvidha Provider connection.
                </p>
              </Reveal>
              <Reveal delay={100} className="lg:order-1">
                <ProductShot
                  src={gstReturnsShot}
                  sizes="(min-width: 1024px) 700px, 100vw"
                  alt="GST returns for October 2026: GSTR-1 and GSTR-3B tables with taxable value, CGST and SGST of ₹54,000 each, eligible ITC, both marked validated, with a Download GSTR-1 JSON button."
                />
              </Reveal>
            </div>

            <div className="mt-10 sm:mt-16 lg:mt-36">
              <Reveal className="max-w-[680px]">
                <h3 className={h2}>Statements that tie out to the rupee</h3>
                <p className={lead}>
                  Balance Sheet, Profit &amp; Loss, Trial Balance, Cash Flow, General Ledger and debtor and creditor
                  ageing are all computed from posted vouchers. When a statement balances, its totals carry the
                  accountant&apos;s double rule.
                </p>
              </Reveal>
              <Reveal delay={100} className="mt-6 sm:mt-12">
                <ProductShot
                  src={balanceSheetShot}
                  chrome={false}
                  alt="A balance sheet with capital and liabilities totalling ₹34,53,600.00 on the left and assets totalling ₹34,53,600.00 on the right, both totals double-underlined."
                />
              </Reveal>
              <dl className="mt-8 grid grid-cols-2 gap-4 sm:mt-14 sm:gap-8 lg:grid-cols-4">
                {ALSO.map((a) => (
                  <div key={a.title} className="border-t border-line pt-3.5 sm:pt-5">
                    <dt className="text-[14.5px] font-semibold text-ink sm:text-[15.5px]">{a.title}</dt>
                    <dd className="mt-1 text-[13.5px] leading-[1.45] text-ink-soft sm:mt-1.5 sm:text-[14.5px] sm:leading-[1.55]">{a.body}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>

        <LandingBentoGrid />
        <KeyboardSection />
        <AlerxLedgerSection />
        <ComparisonSection />
        <PricingPlansSection />
        <FaqSection />

        {/* Learn Centre invitation */}
        <section aria-labelledby="learn-title" className="bg-panel-deep text-white">
          <div className="mx-auto grid max-w-[1200px] gap-8 px-4 py-10 sm:px-8 sm:py-16 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-20 lg:py-24">
            <Reveal>
              <h2 id="learn-title" className="text-[26px] font-semibold leading-[1.12] tracking-[-0.03em] sm:text-[38px] lg:text-[44px]">
                Try it on sample books
              </h2>
              <p className="mt-3 max-w-[52ch] text-[15.5px] leading-[1.55] text-white/70 sm:mt-5 sm:text-[18px]">
                {workflows} guided workflows run on the real screens, from issuing an invoice to closing the month.
                Pick one of {DEMO_COMPANIES.length} fictional companies and any of the seven roles on a desktop or
                laptop browser. No sign-up; the sample books stay in your browser.
              </p>
              <div className="mt-6 flex flex-col gap-2.5 sm:mt-9 sm:flex-row sm:gap-3">
                <Link href="/learn/demo" className={`${primaryBtn} focus-visible:ring-offset-panel-deep`}>
                  Try the demo
                </Link>
                <Link
                  href="/learn"
                  className="inline-flex h-11 items-center justify-center whitespace-nowrap rounded-ctl border border-edge px-5 text-[15px] font-medium text-white transition-[background-color,transform] hover:bg-panel active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand sm:h-12 sm:px-6 sm:text-[15.5px]"
                >
                  Browse the Learn Centre
                </Link>
              </div>
            </Reveal>
            <Reveal delay={100}>
              <ul className="divide-y divide-edge border-y border-edge">
                {DEMO_COMPANIES.map((c) => (
                  <li key={c.slug}>
                    <Link
                      href={`/learn/demo/workspace?company=${c.slug}&role=owner&plan=${c.recommendedPlan}`}
                      className="group flex items-center justify-between gap-4 py-3.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand sm:py-5"
                    >
                      <span>
                        <span className="block text-[16.5px] font-medium text-white">{c.tradeName}</span>
                        <span className="mt-0.5 block text-[14px] text-white/55">{c.industry}</span>
                      </span>
                      <span className="text-[14px] text-brand-soft transition-transform group-hover:translate-x-1">Open</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
