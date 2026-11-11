"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import LandingNavbar from "@/components/landing/LandingNavbar";
import LandingFooter from "@/components/landing/LandingFooter";
import { BookOpen, Building2, Compass, Play } from "lucide-react";

const SUBNAV = [
  { href: "/learn", label: "Overview", icon: Compass, exact: true },
  { href: "/learn/demo", label: "Workflows & demo", icon: Play, exact: true },
  { href: "/learn/demo/companies", label: "Demo companies", icon: Building2, exact: false },
  { href: "/learn/docs", label: "Manuals", icon: BookOpen, exact: false },
];

export function LearnShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/learn";

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col font-sans selection:bg-brand/30 selection:text-ink">
      <LandingNavbar />

      <div className="border-b border-line bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4 overflow-x-auto">
          <nav aria-label="Learn Centre navigation" className="flex items-center gap-1 py-2">
            {SUBNAV.map((item) => {
              const Icon = item.icon;
              const active = item.exact
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-ctl text-[13px] font-medium whitespace-nowrap transition-colors ${
                    active
                      ? "bg-brand-wash text-brand-strong"
                      : "text-ink-soft hover:text-ink hover:bg-canvas-sunken"
                  }`}
                >
                  <Icon className={`h-3.5 w-3.5 ${active ? "text-brand-strong" : "text-ink-muted"}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <span className="hidden sm:inline-flex items-center gap-1.5 text-[12.5px] text-ink-muted whitespace-nowrap">
            <span className="h-1.5 w-1.5 rounded-full bg-brand" />
            Sample books in your browser, no login
          </span>
        </div>
      </div>

      <main className="flex-1">{children}</main>

      <LandingFooter />
    </div>
  );
}
