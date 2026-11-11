import React from "react";
import Link from "next/link";
import { LearnShell } from "@/components/learn/LearnShell";
import { DocsExplorer } from "@/components/learn/DocsExplorer";
import { ArrowLeft, BookOpen, Play } from "lucide-react";

export default function LearnDocsPage() {
  return (
    <LearnShell>
      <section className="border-b border-line-strong bg-surface py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
          <Link
            href="/learn"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-muted hover:text-ink"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Learn Centre</span>
          </Link>

          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-3xl space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-panel text-brand-soft font-mono text-[11px] font-bold border border-edge">
                <BookOpen className="h-3.5 w-3.5" />
                <span>DEKU MANUALS &amp; DOCUMENTATION</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black text-ink tracking-tight">
                Understand every layer of Deku.
              </h1>
              <p className="text-sm text-ink-soft leading-relaxed">
                Structured product manuals, statutory GST guides, RBAC &amp; entitlement references, and technical architecture documentation—cross-linked directly to the Interactive Demo.
              </p>
            </div>

            <Link
              href="/learn/demo"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand hover:bg-brand-hover text-ink font-bold text-xs shadow-xs transition-colors"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>Open Interactive Demo</span>
            </Link>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <DocsExplorer />
      </section>
    </LearnShell>
  );
}
