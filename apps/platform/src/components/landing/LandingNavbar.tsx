"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { ArrowRight } from "lucide-react";
import { DekuLogo } from "@/components/ui/DekuLogo";

export default function LandingNavbar() {
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-line-strong/80 bg-white/95 backdrop-blur-md transition-all font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="h-10 w-10 rounded-xl bg-panel-deep flex items-center justify-center shadow-md shadow-brand/20 group-hover:bg-panel transition-colors border border-edge">
            <DekuLogo size={26} />
          </div>
          <span className="font-extrabold text-xl tracking-tight text-ink">
            Deku<span className="text-brand">Finance</span>
          </span>
        </Link>

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-600">
          <Link
            href="/features"
            className="hover:text-ink transition-colors flex items-center gap-1.5"
          >
            Features
            <span className="h-1.5 w-1.5 rounded-full bg-brand inline-block animate-pulse" />
          </Link>
          <Link href="/gst-compliance" className="hover:text-ink transition-colors">
            GST Compliance
          </Link>
          <Link href="/#pricing" className="hover:text-ink transition-colors">
            Plans & Pricing
          </Link>
          <Link href="/#faq" className="hover:text-ink transition-colors">
            FAQ
          </Link>
          <Link
            href="/learn"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-brand/15 text-brand-strong font-bold hover:bg-brand/25 transition-all"
          >
            <span>Learn</span>
            <span className="text-[9px] font-mono uppercase bg-brand text-ink px-1.5 py-0.2 rounded font-extrabold tracking-wide">
              Hub
            </span>
          </Link>
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
