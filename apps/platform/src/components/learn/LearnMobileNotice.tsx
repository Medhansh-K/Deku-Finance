"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Check, Copy, Laptop } from "lucide-react";

export function LearnMobileNotice({ title = "Open the interactive demo on a laptop" }: { title?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard API may be unavailable on insecure contexts; link stays visible to copy manually.
    }
  };

  return (
    <section className="mx-auto max-w-lg px-4 py-10 sm:py-14">
      <div className="rounded-panel border border-line bg-surface p-6 text-left shadow-[0_12px_32px_-18px_rgb(14_27_25/0.18)]">
        <div className="inline-flex h-11 w-11 items-center justify-center rounded-ctl bg-brand-wash text-brand-strong">
          <Laptop aria-hidden="true" className="h-5 w-5" />
        </div>
        <p className="mt-4 text-[12.5px] font-medium uppercase tracking-[0.04em] text-brand-strong">
          Desktop &amp; laptop required
        </p>
        <h1 className="mt-1.5 text-[24px] font-semibold leading-[1.15] tracking-[-0.025em] text-ink">
          {title}
        </h1>
        <p className="mt-3 text-[15px] leading-[1.6] text-ink-soft">
          The Deku Finance Learn Centre and interactive demo workspace use function-key shortcuts (F1–F11),
          multi-column accounting ledgers, and side-by-side workflow coaching built for a larger screen.
        </p>
        <p className="mt-2.5 text-[14px] leading-[1.55] text-ink-muted">
          Please switch to a laptop or desktop browser to explore the live sample books and interactive tour.
        </p>

        <div className="mt-6 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-ctl bg-brand px-4 text-[14.5px] font-semibold text-ink transition-colors hover:bg-brand-hover"
          >
            {copied ? <Check aria-hidden="true" className="h-4 w-4" /> : <Copy aria-hidden="true" className="h-4 w-4" />}
            {copied ? "Link copied — open it on your laptop" : "Copy demo link for laptop"}
          </button>
          <Link
            href="/request-setup"
            className="inline-flex h-11 w-full items-center justify-center rounded-ctl border border-line-strong bg-surface px-4 text-[14.5px] font-medium text-ink transition-colors hover:bg-canvas"
          >
            Request a setup on WhatsApp
          </Link>
          <Link
            href="/"
            className="inline-flex h-10 w-full items-center justify-center rounded-ctl text-[14px] font-medium text-ink-soft hover:text-ink"
          >
            Back to home
          </Link>
        </div>
      </div>
    </section>
  );
}

