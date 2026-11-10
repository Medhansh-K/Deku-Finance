import React from "react";
import Link from "next/link";
import { LearnShell } from "@/components/learn/LearnShell";
import { DemoCompanyGrid } from "@/components/learn/DemoCompanyGrid";
import { ArrowLeft } from "lucide-react";

export default function LearnDemoCompaniesPage() {
  return (
    <LearnShell>
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
        <div className="space-y-3">
          <Link
            href="/learn/demo"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-muted hover:text-ink"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Interactive Demo</span>
          </Link>
          <h1 className="text-3xl font-black text-ink tracking-tight">
            Industry Demonstration Companies
          </h1>
          <p className="text-sm text-ink-soft max-w-3xl leading-relaxed">
            Every demonstration company uses fictional GSTINs, counterparties, inventory SKUs, and balanced accounting journals so you can trace operational transactions straight through to financial reports.
          </p>
        </div>

        <DemoCompanyGrid />
      </section>
    </LearnShell>
  );
}
