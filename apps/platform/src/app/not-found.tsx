import Link from "next/link";
import { DekuLogo } from "@/components/ui/DekuLogo";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-canvas text-ink flex flex-col items-center justify-center px-5 py-12">
      <Link href="/" className="flex items-center gap-2.5 mb-10" aria-label="Deku Finance home">
        <DekuLogo size={34} />
        <span className="text-[18px] font-semibold tracking-[-0.02em]">
          Deku <span className="font-normal text-ink-muted">Finance</span>
        </span>
      </Link>

      <div className="w-full max-w-[440px] rounded-panel border border-line bg-surface p-8 text-center">
        <span className="inline-flex items-center h-[24px] px-2.5 rounded-chip bg-canvas-sunken text-ink-muted text-xs font-mono font-medium">
          404
        </span>
        <h1 className="mt-4 text-[26px] leading-tight font-semibold tracking-[-0.03em]">
          Page not found
        </h1>
        <p className="mt-3 text-[14px] leading-relaxed text-ink-muted">
          The page you are looking for has moved or does not exist.
        </p>
        <div className="mt-7 flex flex-col gap-2.5">
          <Link
            href="/"
            className="inline-flex items-center justify-center h-11 rounded-ctl bg-ink text-white text-sm font-medium hover:bg-panel-raised transition-colors"
          >
            Go to home
          </Link>
          <Link
            href="/learn/demo"
            className="inline-flex items-center justify-center h-11 rounded-ctl border border-line-strong bg-surface text-sm font-medium hover:bg-canvas transition-colors"
          >
            Open interactive demo
          </Link>
        </div>
      </div>
    </main>
  );
}

