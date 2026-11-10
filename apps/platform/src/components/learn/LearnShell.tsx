"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import LandingNavbar from "@/components/landing/LandingNavbar";
import LandingFooter from "@/components/landing/LandingFooter";
import { BookOpen, Building2, Compass, Play } from "lucide-react";

const SUBNAV = [
  { href: "/learn", label: "Learn Overview", icon: Compass, exact: true },
  { href: "/learn/demo", label: "Interactive Demo", icon: Play, exact: true },
  { href: "/learn/demo/companies", label: "Demo Companies", icon: Building2, exact: false },
  { href: "/learn/docs", label: "Manuals & Docs", icon: BookOpen, exact: false },
];

export function LearnShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/learn";

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col font-sans selection:bg-brand/30 selection:text-ink">
      <LandingNavbar />

      <div className="border-b border-line-strong bg-surface">
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
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                    active
                      ? "bg-panel text-white shadow-xs"
                      : "text-ink-soft hover:text-ink hover:bg-canvas-sunken"
                  }`}
                >
                  <Icon className={`h-3.5 w-3.5 ${active ? "text-brand" : "text-ink-muted"}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-mono text-ink-muted whitespace-nowrap">
            <span className="h-1.5 w-1.5 rounded-full bg-brand" />
            Public Learn Environment · No Login Required
          </span>
        </div>
      </div>

      <main className="flex-1">{children}</main>

      <LandingFooter />
    </div>
  );
}
