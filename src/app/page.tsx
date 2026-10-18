import SupabaseStatus from "@/components/SupabaseStatus";
import FinanceOverview from "@/components/FinanceOverview";
import { Coins, ExternalLink } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-zinc-100 flex flex-col selection:bg-emerald-500/30 selection:text-emerald-300">
      {/* Background Gradient Glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-emerald-600/15 via-teal-700/10 to-transparent blur-3xl opacity-70" />
      </div>

      {/* Navigation Header */}
      <header className="relative z-10 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 text-black shadow-lg shadow-emerald-500/20 font-black">
              <Coins className="h-5 w-5 text-black" />
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-white">Deku</span>
              <span className="text-lg font-light text-emerald-400 ml-1">Finance</span>
            </div>
            <span className="hidden sm:inline-flex items-center rounded-md bg-zinc-800/80 px-2 py-0.5 text-[11px] font-medium text-zinc-400 border border-zinc-700/60 ml-2">
              Next.js 16 + Supabase
            </span>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="https://github.com/Medhansh-K/Deku-Finance"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 border border-zinc-800 transition-colors"
            >
              <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
              <span className="hidden md:inline">GitHub</span>
            </a>
            <a
              href="https://supabase.com/dashboard/project/jylsaqqblbpwwxdkmlzd"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors shadow-md shadow-emerald-950"
            >
              <span>Supabase Dashboard</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Supabase Connection Status Card */}
        <section aria-label="Supabase Connection">
          <SupabaseStatus />
        </section>

        {/* Financial Performance & Overview */}
        <section aria-label="Financial Overview">
          <FinanceOverview />
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-zinc-800/80 bg-zinc-950/60 py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
          <div>
            © 2026 Deku Finance. Built with Next.js, Supabase & TailwindCSS.
          </div>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Production Mode
            </span>
            <span>•</span>
            <span>Region: Seoul (ap-northeast-2)</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
