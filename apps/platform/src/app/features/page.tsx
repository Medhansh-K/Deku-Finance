import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import LandingNavbar from "@/components/landing/LandingNavbar";
import LandingFooter from "@/components/landing/LandingFooter";
import { Reveal } from "@/components/marketing/Reveal";
import { Thumb } from "@/components/marketing/Shot";
import { card, container, darkSecondaryCta, h1, h2, lead, primaryCta, secondaryCta } from "@/components/marketing/styles";
import { DeploymentDiagram, ImportSteps } from "./MiniUis";
import { LEARN_WORKFLOWS } from "@/lib/learn/workflows/catalogue";
import { FeatureTabs } from "./FeatureTabs";

export const metadata: Metadata = {
  title: "Features | Deku Finance",
  description:
    "What Deku Finance does: two operating modes, the ALERX double-entry ledger, F4–F9 vouchers, bank reconciliation, financial reports and maker-checker governance.",
};

type Visual = { src: string; alt: string } | "import" | "deployment";

const MORE: { title: string; body: string; visual: Visual }[] = [
  {
    title: "Collections",
    body: "See what each customer still owes, settled against the debtors ledger, and send a WhatsApp reminder link yourself.",
    visual: { src: "/landing/features-collect-card.webp", alt: "Collections screen with what is uncollected, overdue and due soon, and an open invoice" },
  },
  {
    title: "Inventory at FIFO cost",
    body: "Stock on hand valued first in, first out, moved by issued invoices, linked purchase bills, sales returns and adjustments.",
    visual: { src: "/landing/features-inventory-fifo-card.webp", alt: "Inventory stock summary with quantity on hand and FIFO value per item" },
  },
  {
    title: "Deku Consultant",
    body: "Ask about your numbers in plain words. It answers from your ledger with fixed logic, not an external AI model, so your data stays in your deployment.",
    visual: { src: "/landing/features-consultant-card.webp", alt: "Deku Consultant with suggested questions about expenses, overdue payments and budgets" },
  },
  {
    title: "General ledger and ageing",
    body: "Every account's entries, plus who owes you, whom you owe, and for how long.",
    visual: { src: "/landing/features-debtors-card.webp", alt: "Debtors ageing with days sales outstanding, receivables and age brackets" },
  },
  {
    title: "FP&A",
    body: "Margins, working capital, runway, and department budgets alongside the actual figures.",
    visual: { src: "/landing/features-fpa-card.webp", alt: "FP&A screen with margins, working capital, cash runway and department budget against actual" },
  },
  {
    title: "Import from Tally or CSV",
    body: "Bring in masters, opening balances and vouchers from a Tally XML export or a spreadsheet, checked step by step before anything is applied.",
    visual: "import",
  },
  {
    title: "Gateway and shortcuts",
    body: "Every screen has a letter on the Gateway. Esc brings you back to it, and Ctrl K jumps to anything.",
    visual: { src: "/landing/features-gateway-card.webp", alt: "The Gateway, listing every screen with its shortcut letter beside figures from the books" },
  },
  {
    title: "Your own deployment",
    body: "Deku runs in a deployment set up for your business, not on a shared platform.",
    visual: "deployment",
  },
];

export default function FeaturesPage() {
  return (
    <div className="flex min-h-screen flex-col bg-canvas font-sans text-ink">
      <LandingNavbar />

      <main className="flex-1">
        <section className={`${container} pb-20 pt-20 sm:pt-28 lg:pb-28`}>
          <Reveal>
            <p className="text-[15px] font-medium text-brand-strong">Feature matrix</p>
            <h1 className={`mt-4 max-w-[22ch] ${h1}`}>Built for Indian businesses, on a proper double-entry ledger.</h1>
            <p className={`mt-6 ${lead} sm:text-[18px]`}>
              From section 22 turnover exemptions to a ledger that won&apos;t post until debits equal credits, here is
              every capability in Deku Finance, and you can try each one in the demo on sample books.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/learn/demo" className={primaryCta}>
                Try the demo
              </Link>
              <Link href="/learn" className={secondaryCta}>
                Explore the Learn Centre
              </Link>
            </div>
          </Reveal>
        </section>

        <FeatureTabs />

        <section aria-labelledby="more-title" className="border-t border-line bg-canvas">
          <div className={`${container} py-20 lg:py-28`}>
            <Reveal>
              <h2 id="more-title" className={h2}>
                Also in Deku
              </h2>
              <p className={`mt-4 ${lead}`}>The rest of the day-to-day work, in the same keyboard-first workspace.</p>
            </Reveal>
            <div className="mt-12 grid gap-6 md:grid-cols-2">
              {MORE.map((m, i) => (
                <Reveal key={m.title} delay={(i % 2) * 80} className="h-full">
                  <article className={`${card} group h-full p-4 sm:p-5`}>
                    {m.visual === "import" ? (
                      <ImportSteps />
                    ) : m.visual === "deployment" ? (
                      <DeploymentDiagram />
                    ) : (
                      <Thumb src={m.visual.src} alt={m.visual.alt} />
                    )}
                    <div className="px-1 pb-1 pt-5">
                      <h3 className="text-[17px] font-semibold tracking-[-0.01em]">{m.title}</h3>
                      <p className="mt-2 text-[15.5px] leading-[1.55] text-ink-soft">{m.body}</p>
                    </div>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section aria-labelledby="learn-title" className="bg-panel-deep text-white">
          <div className={`${container} py-24 lg:py-32`}>
            <Reveal>
              <p className="text-[15px] font-medium text-brand">Public sandbox, no registration</p>
              <h2 id="learn-title" className={`mt-4 max-w-[22ch] ${h2} text-white`}>
                Test every feature in the public Learn Centre.
              </h2>
              <p className="mt-4 max-w-[60ch] text-[17px] leading-[1.55] text-white/70">
                Follow {LEARN_WORKFLOWS.length} hands-on guided workflows on the real screens, with sample books. No
                login, and nothing you do there touches real accounts.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Link href="/learn/demo" className={primaryCta}>
                  Try the demo
                </Link>
                <Link href="/learn" className={darkSecondaryCta}>
                  Enter the Learn Centre
                </Link>
                <Link
                  href="/gst-compliance"
                  className="inline-flex h-11 items-center px-2 text-[15px] font-medium text-white/80 underline-offset-4 transition-colors hover:text-white hover:underline"
                >
                  How GST works in Deku <span aria-hidden className="ml-1.5">→</span>
                </Link>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
