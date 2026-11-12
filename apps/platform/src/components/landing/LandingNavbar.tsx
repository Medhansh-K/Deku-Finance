"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { Menu, X } from "lucide-react";
import { DekuLogo } from "@/components/ui/DekuLogo";

const LINKS = [
  { href: "/features", label: "Features" },
  { href: "/gst-compliance", label: "GST compliance" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/learn", label: "Learn" },
];

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

export function DekuWordmark() {
  return (
    <span className="flex items-center gap-2 sm:gap-2.5">
      <DekuLogo size={26} aria-hidden="true" />
      <span className="whitespace-nowrap text-[15.5px] tracking-[-0.02em] text-ink sm:text-[17px]">
        <span className="font-semibold">Deku</span> <span className="text-ink-soft">Finance</span>
      </span>
    </span>
  );
}

export default function LandingNavbar() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  // Signed-in visitors go straight to their books; everyone else gets the demo.
  const secondary = user ? { href: "/gateway", label: "Open Gateway" } : { href: "/login", label: "Sign in" };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-line bg-surface/90 backdrop-blur-md font-sans">
      <div className="mx-auto flex h-14 max-w-[1200px] items-center justify-between gap-2.5 px-4 sm:h-16 sm:gap-6 sm:px-8">
        <Link href="/" aria-label="Deku Finance home" className={`shrink-0 rounded-ctl ${focusRing}`}>
          <DekuWordmark />
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-ctl px-3 py-2 text-[14px] text-ink-soft transition-colors hover:bg-canvas hover:text-ink ${focusRing}`}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            href={secondary.href}
            className={`hidden whitespace-nowrap rounded-ctl px-3 py-2 text-[14px] text-ink-soft transition-colors hover:bg-canvas hover:text-ink sm:block ${focusRing}`}
          >
            {secondary.label}
          </Link>
          <Link
            href="/learn/demo"
            className={`inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded-ctl bg-brand px-3 text-[13px] font-medium text-ink transition-colors hover:bg-brand-hover sm:px-4 sm:text-[14px] ${focusRing}`}
          >
            Try the demo
          </Link>
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-ctl border border-line text-ink-soft hover:bg-canvas md:hidden ${focusRing}`}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="landing-mobile-menu"
          >
            {open ? <X className="h-[18px] w-[18px]" /> : <Menu className="h-[18px] w-[18px]" />}
          </button>
        </div>
      </div>

      {open && (
        <nav
          id="landing-mobile-menu"
          aria-label="Main"
          className="border-t border-line bg-surface px-5 pb-5 pt-2 md:hidden"
        >
          <ul className="flex flex-col">
            {[...LINKS, secondary].map((l) => (
              <li key={l.href} className="border-b border-line last:border-0">
                <Link
                  href={l.href}
                  onClick={close}
                  className={`block rounded-ctl px-1 py-3.5 text-[16px] text-ink ${focusRing}`}
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}
