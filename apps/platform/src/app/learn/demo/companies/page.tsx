import React from "react";
import Link from "next/link";
import { LearnShell } from "@/components/learn/LearnShell";
import { DemoCompanyGrid } from "@/components/learn/DemoCompanyGrid";
import { ArrowLeft } from "lucide-react";

export default function LearnDemoCompaniesPage() {
  return (
    <LearnShell>
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12 space-y-8">
        <div className="space-y-3">
          <Link
            href="/learn/demo"
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-muted hover:text-ink"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to the workflows</span>
          </Link>
          <h1 className="text-[28px] font-semibold tracking-[-0.03em] text-ink">Demo companies</h1>
          <p className="text-[14px] text-ink-soft max-w-3xl leading-relaxed">
            Each company uses fictional GSTINs, parties and items with balanced books, so you can trace a transaction from the screen where it was made to the reports.
          </p>
        </div>

        <DemoCompanyGrid />
      </section>
    </LearnShell>
  );
}
