"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { ArrowRight, Layers } from "lucide-react";

export default function LandingNavbar() {
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-line-strong/80 bg-white/95 backdrop-blur-md transition-all font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="h-10 w-10 rounded-xl bg-brand text-ink flex items-center justify-center font-black shadow-md shadow-brand/20 group-hover:bg-brand-soft transition-colors">
            <Layers className="h-5 w-5 text-ink" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-xl tracking-tight text-ink">
                Deku<span className="text-brand">Finance</span>
              </span>
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-800 border border-emerald-300">
                IN GAAP
              </span>
            </div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-ink-soft">
              ALERX • Desktop Gateway OS
            </span>
          </div>
        </Link>

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center gap-7 text-xs font-semibold text-slate-600">
          <a
            href="#modes"
            className="hover:text-ink transition-colors flex items-center gap-1.5"
          >
            Dual Modes
            <span className="h-1.5 w-1.5 rounded-full bg-brand inline-block animate-pulse" />
          </a>
          <a href="#features" className="hover:text-ink transition-colors">
            Features
          </a>
          <a href="#alerx" className="hover:text-ink transition-colors">
            ALERX Ledger
          </a>
          <a href="#gstn" className="hover:text-ink transition-colors">
            GST Returns
          </a>
          <a href="#pricing" className="hover:text-ink transition-colors">
            Plans & Pricing
          </a>
          <a href="#faq" className="hover:text-ink transition-colors">
            FAQ
          </a>
        </nav>

        {/* Action Buttons - Exactly ONE button for Gateway */}
        <div className="flex items-center gap-2 sm:gap-3">
          {user ? (
            <Link
              href="/gateway"
              className="inline-flex items-center gap-2 rounded-xl bg-brand hover:bg-brand-soft px-4 py-2 text-xs font-bold text-ink shadow-sm transition-all"
            >
              <span className="text-ink font-mono text-[10px] bg-black/10 px-1.5 py-0.5 rounded font-bold">
                Alt+G
              </span>
              <span>Gateway of Deku</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="px-3 py-2 text-xs font-semibold text-slate-700 hover:text-ink hover:bg-slate-100 rounded-lg transition-colors hidden sm:block"
              >
                Sign In
              </Link>
              <Link
                href="/gateway"
                className="inline-flex items-center gap-2 rounded-xl bg-brand hover:bg-brand-soft px-4 py-2 text-xs font-bold text-ink shadow-sm shadow-brand/20 transition-all"
              >
                <span className="text-ink font-mono text-[10px] bg-black/10 px-1.5 py-0.5 rounded font-bold">
                  Alt+G
                </span>
                <span>Gateway of Deku</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
