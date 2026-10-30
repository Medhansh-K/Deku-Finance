import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import {
  Building2,
  Calendar,
  Search,
  HelpCircle,
  User,
  LogOut,
  Settings,
  ChevronDown,
  ShieldCheck,
  Sun,
  Moon,
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
  const { user, logout, license } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(event.target as Node)
      ) {
        setIsProfileOpen(false);
      }
    };
    if (isProfileOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isProfileOpen]);

  const handleLogout = async () => {
    setIsProfileOpen(false);
    await logout();
    router.push("/login");
  };

  return (
    <header className="h-10 bg-[#0A0A0A] border-b border-[#3E4848] text-white flex items-center justify-between px-3 select-none text-xs font-sans shrink-0 z-30">
      {/* Left: Branding & Core Menus */}
      <div className="flex items-center gap-4">
        {/* Brand */}
        <Link
          href="/"
          title="Go to Landing Page"
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
            <kbd className="text-[9px] font-mono font-bold px-1 py-0.5 rounded bg-black/60 border border-[#3E4848] text-[#5BB5BB]">
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
          <kbd className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-black/40 border border-slate-600 text-[#91D7D2]">
            Alt+G
          </kbd>
        </button>
      </div>

      {/* Right: Active Context & Quick Actions */}
      <div className="flex items-center gap-2.5">
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

        {/* User Profile Dropdown */}
        <div className="relative" ref={profileMenuRef}>
          <button
            suppressHydrationWarning
            onClick={() => setIsProfileOpen((prev) => !prev)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded transition-colors ${
              isProfileOpen
                ? "bg-[#1F2324] text-white border border-[#5BB5BB]/50"
                : "hover:bg-[#1F2324] text-slate-300 hover:text-white"
            }`}
            title="User Account & Preferences"
            aria-label="User Account"
          >
            <div className="h-5 w-5 rounded-full bg-[#5BB5BB]/20 border border-[#5BB5BB]/40 flex items-center justify-center text-[#5BB5BB] text-[10px] font-bold">
              {user?.full_name ? user.full_name[0].toUpperCase() : <User className="h-3 w-3" />}
            </div>
            <span className="text-[11px] font-medium max-w-[100px] truncate hidden md:inline">
              {user?.full_name?.split(" ")[0] || "Profile"}
            </span>
            <ChevronDown className="h-3 w-3 text-slate-400" />
          </button>

          {isProfileOpen && (
            <div className="absolute right-0 mt-1.5 w-64 rounded-xl bg-[#0F1418] border border-[#2A3439] shadow-2xl shadow-black/80 p-2.5 z-50 text-slate-200 font-sans animate-in fade-in slide-in-from-top-1 duration-150">
              {/* User Details */}
              <div className="px-2 py-1.5 border-b border-[#2A3439]/80 pb-2.5 mb-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold text-xs text-white truncate">
                    {user?.full_name || "Enterprise User"}
                  </div>
                  {user?.is_demo ? (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 border border-amber-400/30">
                      DEMO
                    </span>
                  ) : (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-400/20 text-emerald-300 border border-emerald-400/30">
                      VERIFIED
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-400 truncate mt-0.5">
                  {user?.email || "user@deku.finance"}
                </div>
                {license && (
                  <div className="flex items-center gap-1.5 mt-2 text-[10px] font-mono text-teal-400 bg-teal-950/40 px-2 py-1 rounded border border-teal-800/40">
                    <ShieldCheck className="h-3 w-3 shrink-0" />
                    <span className="truncate">{license.license_key}</span>
                  </div>
                )}
              </div>

              {/* Navigation Items */}
              <div className="space-y-1">
                <Link
                  href="/settings"
                  onClick={() => setIsProfileOpen(false)}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-slate-300 hover:text-white hover:bg-[#1F2324] transition-colors"
                >
                  <Settings className="h-3.5 w-3.5 text-[#5BB5BB]" />
                  <span>Settings & Preferences</span>
                </Link>
                <Link
                  href="/companies"
                  onClick={() => setIsProfileOpen(false)}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-slate-300 hover:text-white hover:bg-[#1F2324] transition-colors"
                >
                  <Building2 className="h-3.5 w-3.5 text-[#5BB5BB]" />
                  <span>Switch Company (F3)</span>
                </Link>

                {/* ── Theme Toggle ── */}
                <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-[#1F2324] transition-colors">
                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    {theme === "dark" ? (
                      <Moon className="h-3.5 w-3.5 text-[#5BB5BB]" />
                    ) : (
                      <Sun className="h-3.5 w-3.5 text-[#5BB5BB]" />
                    )}
                    <span>{theme === "dark" ? "Dark Mode" : "Light Mode"}</span>
                  </div>
                  {/* Toggle pill */}
                  <button
                    suppressHydrationWarning
                    onClick={toggleTheme}
                    title="Toggle dark / light mode"
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 transition-colors duration-200 focus:outline-none ${
                      theme === "dark"
                        ? "bg-[#5BB5BB] border-[#5BB5BB]"
                        : "bg-[#2A3439] border-[#2A3439]"
                    }`}
                    aria-label="Toggle theme"
                  >
                    <span
                      className={`pointer-events-none inline-block h-3.5 w-3.5 rounded-full bg-white shadow-md ring-0 transition-transform duration-200 mt-px ${
                        theme === "dark" ? "translate-x-4" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Logout Button */}
              <div className="border-t border-[#2A3439]/80 mt-2 pt-2">
                <button
                  suppressHydrationWarning
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-colors font-medium"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
