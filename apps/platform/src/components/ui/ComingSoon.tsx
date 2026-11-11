import Link from "next/link";
import { DekuLogo } from "@/components/ui/DekuLogo";

/** Sign-in and sign-up are closed for now; the demo shows the full app on sample books. */
export function ComingSoon({ title }: { title: string }) {
  return (
    <main className="min-h-screen bg-canvas text-ink flex flex-col items-center justify-center px-5 py-12">
      <Link href="/" className="flex items-center gap-2.5 mb-10" aria-label="Deku Finance home">
        <DekuLogo size={34} />
        <span className="text-[18px] font-semibold tracking-[-0.02em]">
          Deku <span className="font-normal text-ink-muted">Finance</span>
        </span>
      </Link>

      <div className="w-full max-w-[440px] rounded-panel border border-line bg-surface p-8 text-center">
        <span className="inline-flex items-center h-[24px] px-2.5 rounded-chip bg-brand-wash text-brand-strong text-xs font-medium">
          Coming soon
        </span>
        <h1 className="mt-4 text-[26px] leading-tight font-semibold tracking-[-0.03em]">{title}</h1>
        <p className="mt-3 text-[14px] leading-relaxed text-ink-muted">
          Accounts open soon. Meanwhile, the interactive demo runs the full app on sample books, with no sign-up.
        </p>
        <div className="mt-7 flex flex-col gap-2.5">
          <Link
            href="/learn/demo"
            className="inline-flex items-center justify-center h-11 rounded-ctl bg-ink text-white text-sm font-medium hover:bg-panel-raised transition-colors"
          >
            Explore the interactive demo
          </Link>
          <Link
            href="/request-setup"
            className="inline-flex items-center justify-center h-11 rounded-ctl border border-line-strong bg-surface text-sm font-medium hover:bg-canvas transition-colors"
          >
            Request a setup
          </Link>
        </div>
      </div>

      <Link href="/" className="mt-6 text-[13px] text-ink-muted hover:text-ink">
        Back to home
      </Link>
    </main>
  );
}
