"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  Boxes,
  Building2,
  ChevronsUpDown,
  ClipboardList,
  FileSpreadsheet,
  FileText,
  Gauge,
  HelpCircle,
  Landmark,
  LayoutGrid,
  LogOut,
  Moon,
  Network,
  Receipt,
  ScrollText,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Sun,
  Users,
  Wallet,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Extra path prefixes that count as this item being active. */
  match?: string[];
}

const NAV: { title: string; items: NavItem[] }[] = [
  {
    title: "Overview",
    items: [
      { label: "Gateway", href: "/gateway", icon: LayoutGrid },
      { label: "Executive dashboard", href: "/executive", icon: Gauge },
      { label: "Deku Consultant", href: "/consultant", icon: Sparkles },
    ],
  },
  {
    title: "Transactions",
    items: [
      { label: "Vouchers", href: "/vouchers", icon: Receipt, match: ["/vouchers/"] },
      { label: "Sales invoices", href: "/gst", icon: FileText },
      { label: "Purchases & ITC", href: "/purchases", icon: Wallet },
      { label: "Collections", href: "/collect", icon: Landmark },
      { label: "Document builder", href: "/builder", icon: ClipboardList },
      { label: "Day book", href: "/day-book", icon: BookOpen },
      { label: "Approvals", href: "/approvals", icon: ShieldCheck },
      { label: "Bank reconciliation", href: "/banking/reconciliation", icon: Landmark },
    ],
  },
  {
    title: "Masters",
    items: [
      { label: "Chart of accounts", href: "/masters/chart-of-accounts", icon: Network },
      { label: "Parties", href: "/masters/parties", icon: Users },
      { label: "Products & services", href: "/masters/products-services", icon: Boxes },
    ],
  },
  {
    title: "Reports",
    items: [
      { label: "Trial balance", href: "/reports/trial-balance", icon: BarChart3 },
      { label: "Profit & loss", href: "/reports/profit-loss", icon: BarChart3 },
      { label: "Balance sheet", href: "/reports/balance-sheet", icon: BarChart3 },
      { label: "Cash flow", href: "/reports/cash-flow", icon: Wallet },
      { label: "Debtors", href: "/reports/debtors", icon: BarChart3 },
      { label: "Creditors", href: "/reports/creditors", icon: BarChart3 },
      { label: "Operating expenses", href: "/reports/operating-expenses", icon: BarChart3 },
      { label: "FP&A", href: "/reports/fpa", icon: Gauge },
    ],
  },
  {
    title: "Compliance",
    items: [
      { label: "File GST return", href: "/gst/file", icon: FileSpreadsheet },
      { label: "GST returns", href: "/gst/returns", icon: FileSpreadsheet },
      { label: "GST portal guide", href: "/gst/guide", icon: BookOpen },
      { label: "Audit trail", href: "/audit", icon: ScrollText },
      { label: "Activity log", href: "/logs", icon: ScrollText },
    ],
  },
  {
    title: "Organisation",
    items: [
      { label: "Companies", href: "/companies", icon: Building2 },
      { label: "Departments & members", href: "/departments-members", icon: Users },
      { label: "Settings", href: "/settings", icon: Settings },
    ],
  },
];

/** Indian financial year label for today, e.g. "2026-27" (April start). */
export function currentFinancialYear(today = new Date(), startMonth = 4): string {
  const y = today.getMonth() + 1 >= startMonth ? today.getFullYear() : today.getFullYear() - 1;
  return `${y}-${String((y + 1) % 100).padStart(2, "0")}`;
}

export interface AppSidebarProps {
  companyName: string;
  onOpenCommandPalette: () => void;
  onOpenHelp: () => void;
  onNavigate?: () => void;
}

export function AppSidebar({ companyName, onOpenCommandPalette, onOpenHelp, onNavigate }: AppSidebarProps) {
  const pathname = usePathname() || "";
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  // "Today" must be read in the browser, not frozen into the prerendered page.
  const [financialYear, setFinancialYear] = useState("");
  useEffect(() => setFinancialYear(currentFinancialYear()), []);

  const isActive = (item: NavItem) =>
    pathname === item.href || (item.match ?? []).some((m) => pathname.startsWith(m));

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col bg-panel-deep text-slate-300">
      <div className="flex h-14 items-center gap-2 px-4">
        <Link href="/gateway" onClick={onNavigate} className="flex items-center gap-2 rounded-md focus-visible:ring-2 focus-visible:ring-brand">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand text-sm font-black text-panel-deep">D</span>
          <span className="text-[15px] font-semibold tracking-tight text-white">
            Deku <span className="font-normal text-slate-400">Finance</span>
          </span>
        </Link>
      </div>

      <div className="space-y-2 px-3">
        <Link
          href="/companies"
          onClick={onNavigate}
          className="flex items-center gap-2.5 rounded-lg border border-edge bg-panel px-3 py-2 transition-colors hover:border-ink-muted"
          title="Switch company (F3)"
        >
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-panel-raised text-xs font-semibold text-brand-soft">
            {(companyName || "?").slice(0, 2).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-white">{companyName || "No company selected"}</span>
            <span className="block text-xs text-slate-500">{financialYear && `FY ${financialYear}`}</span>
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-slate-500" />
        </Link>

        <button
          onClick={onOpenCommandPalette}
          className="flex w-full items-center gap-2 rounded-lg border border-edge px-3 py-1.5 text-sm text-slate-400 transition-colors hover:border-ink-muted hover:text-slate-200"
        >
          <Search className="h-4 w-4" />
          <span className="flex-1 text-left">Search or jump to…</span>
          <kbd className="rounded border border-edge px-1.5 font-mono text-[10px] text-slate-500">Ctrl K</kbd>
        </button>
      </div>

      <nav aria-label="Main" className="mt-3 flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        {NAV.map((group) => (
          <div key={group.title}>
            <div className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wider text-slate-500">{group.title}</div>
            <ul className="space-y-px">
              {group.items.map((item) => {
                const active = isActive(item);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={`group flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors ${
                        active ? "bg-panel-raised font-medium text-white" : "text-slate-400 hover:bg-panel hover:text-slate-100"
                      }`}
                    >
                      <Icon className={`h-4 w-4 shrink-0 ${active ? "text-brand" : "text-slate-500 group-hover:text-slate-300"}`} />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="flex items-center gap-2 border-t border-edge px-3 py-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-panel-raised text-xs font-semibold text-slate-200">
          {(user?.full_name || user?.email || "?").slice(0, 1).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm text-slate-200">{user?.full_name || user?.email || "Signed out"}</span>
          {user?.is_demo && <span className="block text-xs text-amber-400">Demo sandbox</span>}
        </span>
        <button onClick={onOpenHelp} className="rounded-md p-1.5 text-slate-500 hover:bg-panel hover:text-slate-200" title="Keyboard shortcuts (F1)" aria-label="Keyboard shortcuts">
          <HelpCircle className="h-4 w-4" />
        </button>
        <button
          onClick={toggleTheme}
          className="rounded-md p-1.5 text-slate-500 hover:bg-panel hover:text-slate-200"
          title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
        <button
          onClick={() => logout().then(() => (window.location.href = "/login"))}
          className="rounded-md p-1.5 text-slate-500 hover:bg-panel hover:text-slate-200"
          title="Sign out"
          aria-label="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
}
