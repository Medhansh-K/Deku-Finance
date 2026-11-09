"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { ArrowRight, Menu, X, Sparkles, BookOpen, ShieldCheck } from "lucide-react";
import { DekuLogo } from "@/components/ui/DekuLogo";

export default function LandingNavbar() {
  const { user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => setMobileMenuOpen(!mobileMenuOpen);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-line-strong/80 bg-white/95 backdrop-blur-md transition-all font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-2.5 sm:gap-3 group shrink-0">
          <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-panel-deep flex items-center justify-center shadow-md shadow-brand/20 group-hover:bg-panel transition-colors border border-edge">
            <DekuLogo size={24} />
          </div>
          <span className="font-extrabold text-lg sm:text-xl tracking-tight text-ink">
            Deku<span className="text-brand">Finance</span>
          </span>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-5 lg:gap-6 text-xs font-semibold text-slate-600">
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

        {/* Action Buttons & Mobile Toggle */}
        <div className="flex items-center gap-2 sm:gap-3">
          {user ? (
            <Link
              href="/gateway"
              className="inline-flex items-center gap-1.5 sm:gap-2 rounded-xl bg-brand hover:bg-brand-soft px-3.5 sm:px-4 py-2 text-xs font-bold text-ink shadow-sm transition-all"
            >
              <span className="hidden sm:inline text-ink font-mono text-[10px] bg-black/10 px-1.5 py-0.5 rounded font-bold">
                Alt+G
              </span>
              <span>Gateway</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-ink hover:bg-slate-100 rounded-lg transition-colors hidden sm:block"
              >
                Sign In
              </Link>
              <Link
                href="/gateway"
                className="inline-flex items-center gap-1.5 sm:gap-2 rounded-xl bg-brand hover:bg-brand-soft px-3 sm:px-4 py-2 text-xs font-bold text-ink shadow-sm shadow-brand/20 transition-all"
              >
                <span className="hidden sm:inline text-ink font-mono text-[10px] bg-black/10 px-1.5 py-0.5 rounded font-bold">
                  Alt+G
                </span>
                <span>Gateway</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </>
          )}

          {/* Mobile Menu Hamburger Button */}
          <button
            type="button"
            onClick={toggleMobileMenu}
            className="md:hidden p-2 rounded-xl text-slate-700 hover:text-ink hover:bg-slate-100 transition-colors border border-slate-200"
            aria-label="Toggle mobile menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Slide-Down Navigation Sheet */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-edge bg-white/98 backdrop-blur-xl px-4 py-4 space-y-3 animate-in slide-in-from-top-2 duration-200">
          <nav className="flex flex-col space-y-2 text-sm font-semibold text-slate-700">
            <Link
              href="/features"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-100 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-brand" />
                <span>All Features</span>
              </span>
              <span className="text-[10px] font-mono bg-brand/15 text-brand-strong px-2 py-0.5 rounded font-bold">
                Bento OS
              </span>
            </Link>
            <Link
              href="/gst-compliance"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-100 transition-colors"
            >
              <span className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <span>GST Compliance & Sec 22</span>
              </span>
            </Link>
            <Link
              href="/#pricing"
              onClick={() => setMobileMenuOpen(false)}
              className="p-2.5 rounded-xl hover:bg-slate-100 transition-colors"
            >
              Plans & Pricing
            </Link>
            <Link
              href="/#faq"
              onClick={() => setMobileMenuOpen(false)}
              className="p-2.5 rounded-xl hover:bg-slate-100 transition-colors"
            >
              Frequently Asked Questions
            </Link>
            <Link
              href="/learn"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-between p-2.5 rounded-xl bg-brand/10 text-brand-strong font-bold"
            >
              <span className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-brand" />
                <span>Public Learn Centre</span>
              </span>
              <span className="text-[10px] font-mono uppercase bg-brand text-ink px-2 py-0.5 rounded font-extrabold">
                76 Lessons
              </span>
            </Link>
            {!user && (
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="p-2.5 rounded-xl hover:bg-slate-100 transition-colors text-slate-900 border-t border-slate-100 pt-3"
              >
                Sign In to Workspace
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
