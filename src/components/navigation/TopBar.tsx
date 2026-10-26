import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  Calendar,
  Search,
  HelpCircle,
  Download,
  Upload,
  Database,
  ArrowRightLeft,
} from "lucide-react";

export interface TopBarProps {
  companyName: string;
  financialYear: string;
  onOpenCommandPalette: () => void;
  onOpenHelp: () => void;
}

export function TopBar({
  companyName = "Deku Financial Technologies",
  financialYear = "2026-27",
  onOpenCommandPalette,
  onOpenHelp,
}: TopBarProps) {
  const router = useRouter();

  return (
    <header className="h-10 bg-[#0A0A0A] border-b border-[#3E4848] text-white flex items-center justify-between px-3 select-none text-xs font-sans shrink-0 z-30">
      {/* Left: Branding & Core Menus */}
      <div className="flex items-center gap-4">
        {/* Brand */}
        <Link
          href="/gateway"
          className="flex items-center gap-1.5 font-black text-sm tracking-tight text-white hover:opacity-90"
        >
          <span className="text-[#5BB5BB]">Deku</span>
          <span className="text-white">Finance</span>
        </Link>

        <div className="h-4 w-px bg-[#3E4848]" />

        {/* Top Dropdown Menus */}
        <nav className="flex items-center gap-1 text-[11px] font-semibold text-slate-300">
          <Link
            href="/companies"
            className="px-2 py-1 rounded hover:bg-[#1F2324] hover:text-white transition-colors"
          >
            <u>C</u>ompany <kbd className="text-[9px] text-[#91D7D2] ml-0.5">F3</kbd>
          </Link>
          <button
            suppressHydrationWarning
            onClick={() => router.push("/day-book")}
            className="px-2 py-1 rounded hover:bg-[#1F2324] hover:text-white transition-colors"
          >
            <u>D</u>ata
          </button>
          <button
            suppressHydrationWarning
            onClick={() => alert("Exchange & Backup features available via Backend PostgreSQL snapshot.")}
            className="px-2 py-1 rounded hover:bg-[#1F2324] hover:text-white transition-colors"
          >
            <u>E</u>xchange
          </button>
          <button
            suppressHydrationWarning
            onClick={() => alert("GSTN Import & Statement Import available in GST Module.")}
            className="px-2 py-1 rounded hover:bg-[#1F2324] hover:text-white transition-colors"
          >
            <u>I</u>mport
          </button>
          <button
            suppressHydrationWarning
            onClick={() => window.print()}
            className="px-2 py-1 rounded hover:bg-[#1F2324] hover:text-white transition-colors"
          >
            <u>E</u>xport
          </button>
          <div className="h-3 w-px bg-[#3E4848] mx-0.5" />
          <Link
            href="/builder"
            className="flex items-center gap-1 px-2 py-1 rounded bg-[#1F2324]/80 text-[#91D7D2] hover:bg-[#5BB5BB]/20 hover:text-white border border-[#3E4848] hover:border-[#5BB5BB] transition-colors"
            title="Business Document Builder (Shift + B)"
          >
            <span className="font-bold"><u>B</u>uilder</span>
            <kbd className="text-[9px] font-mono font-bold px-1 py-0.2 rounded bg-black/60 border border-[#3E4848] text-[#5BB5BB]">
              Shift+B
            </kbd>
          </Link>
          <Link
            href="/consultant"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-teal-950/40 text-teal-300 hover:bg-teal-900/60 hover:text-white border border-teal-500/40 hover:border-teal-400 transition-colors shadow-xs"
            title="Deku Consultant AI CFO (Sarvam AI Powered)"
          >
            <span className="font-bold"><u>K</u>onsultant</span>
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
          </Link>
        </nav>
      </div>

      {/* Center: Global Go To Button */}
      <div className="flex items-center">
        <button
          suppressHydrationWarning
          onClick={onOpenCommandPalette}
          className="flex items-center gap-2 px-3 py-1 rounded bg-[#1F2324] border border-[#3E4848] text-slate-200 hover:text-white hover:border-[#5BB5BB] transition-colors"
        >
          <Search className="h-3.5 w-3.5 text-[#5BB5BB]" />
          <span className="text-[11px] font-medium">Go To</span>
          <kbd className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-black/40 border border-slate-600 text-[#91D7D2]">
            Alt+G
          </kbd>
        </button>
      </div>

      {/* Right: Active Context & Quick Actions */}
      <div className="flex items-center gap-3">
        {/* Active Company Pill */}
        <Link
          href="/companies"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#1F2324] border border-[#3E4848] hover:border-[#5BB5BB] text-[11px] font-semibold text-slate-200 transition-colors"
          title="Switch Active Company (F3)"
        >
          <Building2 className="h-3.5 w-3.5 text-[#5BB5BB]" />
          <span className="max-w-[160px] truncate">{companyName}</span>
        </Link>

        {/* Active FY Pill */}
        <div
          className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#1F2324] border border-[#3E4848] text-[11px] font-mono text-slate-300"
          title="Active Financial Year"
        >
          <Calendar className="h-3.5 w-3.5 text-[#91D7D2]" />
          <span>FY {financialYear}</span>
        </div>

        {/* Help */}
        <button
          suppressHydrationWarning
          onClick={onOpenHelp}
          className="flex items-center gap-1 px-2 py-1 rounded hover:bg-[#1F2324] text-slate-300 hover:text-white transition-colors"
          title="Keyboard Shortcuts & Help (F1)"
        >
          <HelpCircle className="h-3.5 w-3.5 text-[#5BB5BB]" />
          <span className="text-[11px]">Help</span>
        </button>
      </div>
    </header>
  );
}
