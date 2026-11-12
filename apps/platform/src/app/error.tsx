"use client";

import Link from "next/link";
import { DekuLogo } from "@/components/ui/DekuLogo";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-screen bg-canvas text-ink flex flex-col items-center justify-center px-5 py-12">
      <Link href="/" className="flex items-center gap-2.5 mb-10" aria-label="Deku Finance home">
        <DekuLogo size={34} />
        <span className="text-[18px] font-semibold tracking-[-0.02em]">
          Deku <span className="font-normal text-ink-muted">Finance</span>
        </span>
      </Link>

      <div className="w-full max-w-[440px] rounded-panel border border-line bg-surface p-8 text-center">
        <span className="inline-flex items-center h-[24px] px-2.5 rounded-chip bg-bad-wash text-bad text-xs font-medium">
          Something went wrong
        </span>
        <h1 className="mt-4 text-[24px] leading-tight font-semibold tracking-[-0.03em]">
          Unable to load this view
        </h1>
        <p className="mt-3 text-[14px] leading-relaxed text-ink-muted">
          An unexpected error interrupted this screen. Retry the view or return to the home page.
        </p>
        <div className="mt-7 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex items-center justify-center h-11 rounded-ctl bg-ink text-white text-sm font-medium hover:bg-panel-raised transition-colors cursor-pointer"
          >
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center h-11 rounded-ctl border border-line-strong bg-surface text-sm font-medium hover:bg-canvas transition-colors"
          >
            Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}

