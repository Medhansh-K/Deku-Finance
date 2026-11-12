import type { Metadata } from "next";
import React from "react";
import Link from "next/link";
import { LearnShell } from "@/components/learn/LearnShell";

export const metadata: Metadata = {
  title: "Learn Centre | Guided Accounting & GST Workflows",
  description:
    "Explore Deku Finance with 18 interactive guided workflows on sample books and comprehensive accounting, GST, and keyboard-shortcut manuals.",
  alternates: { canonical: "/learn" },
};
import { DEMO_COMPANIES } from "@/lib/learn/companies";
import { DEMO_ROLES } from "@/lib/learn/demo-roles";
import { DOC_ARTICLES, DOC_CATEGORIES } from "@/lib/learn/docs-data";
import { LEARN_WORKFLOWS } from "@/lib/learn/workflows/catalogue";
import { workspaceHref } from "@/lib/learn/workflows/runner";
import { ArrowRight, BookOpen, Check, Layers, Play, ShieldCheck, Users } from "lucide-react";

export default function LearnPage() {
  const flagship = LEARN_WORKFLOWS.find((w) => w.category === "complete-cycle");

  return (
    <LearnShell>
      <section className="border-b border-line bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 space-y-8">
          <div className="max-w-3xl space-y-3">
            <p className="text-[13px] text-brand-strong font-medium">Deku Learn Centre</p>
            <h1 className="text-[30px] sm:text-[40px] font-semibold tracking-[-0.035em] text-ink leading-tight">
              Learn Deku Finance by doing the work
            </h1>
            <p className="text-[15px] text-ink-soft leading-relaxed">
              Follow guided workflows on the real screens with sample books, or read the manuals. No login, and nothing leaves your
              browser.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-panel border border-brand bg-brand-wash p-6 flex flex-col justify-between gap-5">
              <div className="space-y-3">
                <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-strong">
                  <Play className="h-3.5 w-3.5" />
                  Interactive demo
                </span>
                <h2 className="text-[20px] font-semibold tracking-tight text-ink">Run a workflow, see the books change</h2>
                <ul className="space-y-1.5 text-[13.5px] text-ink-soft">
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-ok shrink-0 mt-px" />
                    {LEARN_WORKFLOWS.length} guided workflows; a step completes only when you have actually done it
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-ok shrink-0 mt-px" />
                    {DEMO_COMPANIES.length} fictional companies, each keeping its own books and activity log
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-ok shrink-0 mt-px" />
                    {DEMO_ROLES.length} roles with the same access rules as the real app
                  </li>
                </ul>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href="/learn/demo"
                  className="inline-flex items-center gap-1.5 h-10 px-4 rounded-ctl bg-ink text-white hover:bg-panel-raised text-[14px] font-medium"
                >
                  Browse the workflows
                  <ArrowRight className="h-4 w-4" />
                </Link>
                {flagship && (
                  <Link
                    href={workspaceHref(flagship)}
                    className="inline-flex items-center gap-1.5 h-10 px-4 rounded-ctl border border-line-strong bg-surface hover:bg-canvas text-[14px] font-medium text-ink"
                  >
                    Start {flagship.code}: {flagship.name}
                  </Link>
                )}
              </div>
            </div>

            <div className="rounded-panel border border-line bg-surface p-6 flex flex-col justify-between gap-5">
              <div className="space-y-3">
                <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-soft">
                  <BookOpen className="h-3.5 w-3.5" />
                  Manuals
                </span>
                <h2 className="text-[20px] font-semibold tracking-tight text-ink">Understand every part of Deku</h2>
                <ul className="space-y-1.5 text-[13.5px] text-ink-soft">
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-ok shrink-0 mt-px" />
                    {DOC_ARTICLES.length} articles in {DOC_CATEGORIES.length} sections, from getting started to technical
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-ok shrink-0 mt-px" />
                    Search, contents and links straight into the demo screens
                  </li>
                </ul>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href="/learn/docs"
                  className="inline-flex items-center gap-1.5 h-10 px-4 rounded-ctl border border-line-strong bg-surface hover:bg-canvas text-[14px] font-medium text-ink"
                >
                  Read the manuals
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-[17px] font-semibold tracking-tight text-ink">{DEMO_COMPANIES.length} demo companies</h2>
          <Link href="/learn/demo/companies" className="inline-flex items-center gap-1 text-[13px] font-medium text-brand-strong hover:underline">
            Compare them
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {DEMO_COMPANIES.map((c) => (
            <Link
              key={c.slug}
              href={`/learn/demo/workspace?company=${c.slug}&plan=${c.recommendedPlan}`}
              className="rounded-panel border border-line bg-surface p-4 hover:bg-brand-wash transition-colors space-y-1.5"
            >
              <p className="text-[12.5px] text-ink-muted">{c.industry}</p>
              <h3 className="text-[14px] font-[550] text-ink">{c.tradeName}</h3>
              <p className="text-[12.5px] text-ink-muted leading-relaxed line-clamp-3">{c.summary}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="border-t border-line bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-[17px] font-semibold tracking-tight text-ink">Manual sections</h2>
            <Link href="/learn/docs" className="inline-flex items-center gap-1 text-[13px] font-medium text-brand-strong hover:underline">
              Search all manuals
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {DOC_CATEGORIES.map((cat) => (
              <Link key={cat.slug} href={`/learn/docs/${cat.slug}`} className="rounded-panel border border-line bg-canvas p-4 hover:bg-brand-wash transition-colors space-y-1">
                <h3 className="text-[14px] font-[550] text-ink">{cat.title}</h3>
                <p className="text-[12.5px] text-ink-muted leading-relaxed">{cat.summary}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-line">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 grid grid-cols-1 md:grid-cols-3 gap-6 text-[13.5px]">
          <div className="flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-brand-strong shrink-0" />
            <div>
              <h3 className="font-semibold text-ink">Stays in your browser</h3>
              <p className="text-ink-muted mt-1 leading-relaxed">
                The demo books live in this browser only. Nothing reaches a real company, and GST filing, payments and messages are simulated.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Layers className="h-5 w-5 text-brand-strong shrink-0" />
            <div>
              <h3 className="font-semibold text-ink">The real screens</h3>
              <p className="text-ink-muted mt-1 leading-relaxed">
                Gateway, vouchers, GST, inventory, banking and reports are the same screens the app uses, with double entry checked on every
                posting.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Users className="h-5 w-5 text-brand-strong shrink-0" />
            <div>
              <h3 className="font-semibold text-ink">Every role, every plan</h3>
              <p className="text-ink-muted mt-1 leading-relaxed">
                Switch between the {DEMO_ROLES.length} roles and the GO, PRO and Enterprise plans from the demo bar to see what each can do.
              </p>
            </div>
          </div>
        </div>
      </section>
    </LearnShell>
  );
}
