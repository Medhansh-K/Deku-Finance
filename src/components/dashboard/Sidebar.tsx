"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  LayoutDashboard,
  ReceiptText,
  FilePlus,
  Users,
  ShoppingBag,
  Truck,
  BookOpen,
  FolderTree,
  FileSpreadsheet,
  FileText,
  ShieldAlert,
  KeyRound,
  Sparkles,
  PhoneCall,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Zap,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: any;
  highlight?: boolean;
  badge?: string;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

export default function DashboardSidebar() {
  const pathname = usePathname();
  const { organisation, license, operatingMode } = useAuth();

  const navGroups: NavGroup[] = [
    {
      title: "OVERVIEW",
      items: [
        {
          label: "Gateway of Deku",
          href: "/gateway",
          icon: LayoutDashboard,
        },
      ],
    },
    {
      title: "SALES & OUTWARD",
      items: [
        {
          label: "Invoices & Bills",
          href: "/dashboard/invoices",
          icon: ReceiptText,
        },
        {
          label: "+ Create Invoice / BOS",
          href: "/dashboard/invoices/new",
          icon: FilePlus,
          highlight: true,
        },
        {
          label: "Customer Directory",
          href: "/dashboard/customers",
          icon: Users,
        },
      ],
    },
    {
      title: "PURCHASES & EXPENSES",
      items: [
        {
          label: "Vendor Bills",
          href: "/dashboard/bills",
          icon: ShoppingBag,
        },
        {
          label: "Vendor Directory",
          href: "/dashboard/vendors",
          icon: Truck,
        },
      ],
    },
    {
      title: "ALERX DOUBLE-ENTRY",
      items: [
        {
          label: "General Ledger",
          href: "/dashboard/ledger",
          icon: BookOpen,
        },
        {
          label: "Chart of Accounts (COA)",
          href: "/dashboard/coa",
          icon: FolderTree,
        },
        {
          label: "Financial Statements",
          href: "/dashboard/reports",
          icon: FileSpreadsheet,
        },
      ],
    },
    {
      title: "STATUTORY & RETURNS",
      items: [
        {
          label: "Returns & GSTR-3B JSON",
          href: "/dashboard/returns",
          icon: FileText,
        },
      ],
    },
    {
      title: "GOVERNANCE & ACCESS",
      items: [
        {
          label: "Departments & Members",
          href: "/departments-members",
          icon: Users,
        },
        {
          label: "Organisation Licenses",
          href: "/dashboard/license",
          icon: KeyRound,
          badge: license?.license_type === "temp" ? "15d Trial" : "Plan",
        },
      ],
    },
  ];

  // Compute trial status
  const isTemp = license?.license_type === "temp";
  const planTier = license?.plan_tier || "go";

  return (
    <aside className="w-64 bg-[#090D16] border-r border-zinc-800 flex flex-col justify-between shrink-0 select-none font-sans text-zinc-300">
      {/* Brand Header */}
      <div>
        <div className="h-16 px-5 border-b border-zinc-800/80 flex items-center justify-between">
          <Link href="/" title="Go to Landing Page" className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-[#5BB5BB] text-[#060D17] flex items-center justify-center font-black shadow-md shadow-[#5BB5BB]/20">
              <ReceiptText className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-sm tracking-tight text-white">
                  Deku<span className="text-[#5BB5BB]">Finance</span>
                </span>
                <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-[#5BB5BB]/20 text-[#91D7D2] border border-[#5BB5BB]/30">
                  IN GAAP
                </span>
              </div>
              <span className="text-[10px] text-zinc-400 block font-medium">
                Accounting & GST OS
              </span>
            </div>
          </Link>
        </div>

        {/* Active Organisation & License Pill */}
        <div className="p-3.5 border-b border-zinc-800/60 bg-zinc-950/40 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              Organisation
            </span>
            <span
              className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase border ${
                operatingMode === "pure_accounting"
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                  : "bg-indigo-500/10 text-indigo-400 border-indigo-500/30"
              }`}
            >
              {operatingMode === "pure_accounting" ? "Non-GST Sec 22" : "GST Active"}
            </span>
          </div>

          <div className="font-bold text-xs text-white truncate">
            {organisation?.name || "Datalis Infoedge Pvt Ltd"}
          </div>

          {/* License Status Badge with rules */}
          <Link
            href="/dashboard/license"
            className="block rounded-xl bg-zinc-900 border border-zinc-800 p-2 hover:border-[#5BB5BB]/50 transition-colors group"
          >
            <div className="flex items-center justify-between text-[11px]">
              <span className="flex items-center gap-1 font-bold text-[#91D7D2]">
                <KeyRound className="h-3 w-3" />
                <span>{planTier.toUpperCase()} {isTemp ? "Temp License" : "Plan"}</span>
              </span>
              <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                {isTemp ? "13d Left" : "Active"}
              </span>
            </div>
            <div className="text-[10px] text-zinc-400 mt-1 flex items-center justify-between">
              <span>{isTemp ? "15d Trial + 5d Grace" : "Terminates per tenure"}</span>
              <span className="text-[#5BB5BB] group-hover:underline">Manage ➔</span>
            </div>
          </Link>
        </div>

        {/* Navigation Items */}
        <nav className="p-3 space-y-5 overflow-y-auto max-h-[calc(100vh-280px)] scrollbar-none">
          {navGroups.map((group, gIdx) => (
            <div key={gIdx} className="space-y-1">
              <span className="px-3 text-[10px] font-bold tracking-wider text-zinc-400 block uppercase">
                {group.title}
              </span>
              <div className="space-y-0.5">
                {group.items.map((item, iIdx) => {
                  const isActive = pathname === item.href;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={iIdx}
                      href={item.href}
                      className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                        isActive
                          ? "bg-[#5BB5BB] text-[#060D17] font-bold shadow-sm shadow-[#5BB5BB]/20"
                          : item.highlight
                          ? "bg-amber-400/10 text-[#91D7D2] hover:bg-amber-400/20 border border-amber-400/30"
                          : "text-zinc-400 hover:text-white hover:bg-zinc-850"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className={`h-4 w-4 ${isActive ? "text-zinc-950" : "text-zinc-400"}`} />
                        <span>{item.label}</span>
                      </div>
                      {item.badge && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>

      {/* Footer Support Callout */}
      <div className="p-3 border-t border-zinc-800/80 bg-zinc-950/60">
        <a
          href="tel:+917506461004"
          className="rounded-xl bg-zinc-900 border border-zinc-800 p-2.5 flex items-center justify-between text-xs hover:border-[#5BB5BB]/60 transition-colors"
        >
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <PhoneCall className="h-3.5 w-3.5" />
            </div>
            <div>
              <span className="text-[10px] text-zinc-400 block">Helpline & Support</span>
              <span className="text-xs font-bold text-white block">+91 7506461004</span>
            </div>
          </div>
        </a>
      </div>
    </aside>
  );
}
