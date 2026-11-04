"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  ReceiptText,
  ChevronsUpDown,
  Search,
  Keyboard,
  HelpCircle,
  LogOut,
  Building2,
  Calendar,
  Sparkles,
  Check,
  X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useKeyboardNav } from "@/context/KeyboardNavContext";
import { CommandPalette } from "@/components/command-palette/CommandPalette";
import { KeyboardHelpModal } from "@/components/keyboard/KeyboardHelpModal";
import { NotificationBell } from "@/modules/notifications/NotificationBell";
import { ShortcutBar } from "@/components/keyboard/ShortcutBar";
import { GLOBAL_FUNCTION_KEY_MAP, isTargetInteractive } from "@/lib/keyboard/shortcuts";

// Create React Query client once
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export interface AppShellProps {
  children: React.ReactNode;
}

/** Helper: detect if a modal, drawer, or dialog is currently open in the DOM */
function isModalOrDrawerOpen(): boolean {
  if (typeof document === "undefined") return false;
  const activeDialog = document.querySelector(
    '[role="dialog"], [aria-modal="true"], .modal-overlay, [data-modal="true"]'
  );
  return !!activeDialog;
}

/** Helper: detect if user has active, unsaved form inputs on transaction pages */
function hasActiveUnsavedEntries(pathname: string): boolean {
  if (typeof document === "undefined") return false;
  const isEditingPath =
    pathname.startsWith("/vouchers") ||
    pathname.startsWith("/builder") ||
    pathname.startsWith("/gst") ||
    pathname.startsWith("/purchases");

  if (!isEditingPath) return false;

  const textInputs = Array.from(
    document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
      'main input[type="text"], main input[type="number"], main textarea'
    )
  );

  return textInputs.some((el) => el.value && el.value.trim() !== "");
}

export function AppShell({ children }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname() || "";
  const { user, logout } = useAuth();
  const { keyboardNavEnabled, toggleKeyboardNav } = useKeyboardNav();

  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  // Active company context
  const [activeCompany, setActiveCompany] = useState<{ id: string; name: string }>({ id: "", name: "" });
  const [financialYear, setFinancialYear] = useState<string>("");

  useEffect(() => {
    const today = new Date();
    const y = today.getMonth() + 1 >= 4 ? today.getFullYear() : today.getFullYear() - 1;
    setFinancialYear(`${y}-${String((y + 1) % 100).padStart(2, "0")}`);
  }, []);

  // Sync active company from localStorage upon shift
  useEffect(() => {
    const syncActiveCompany = () => {
      if (typeof window !== "undefined") {
        const savedOrgId = localStorage.getItem("deku_active_org_id");
        const savedOrgName = localStorage.getItem("deku_active_org_name");
        if (savedOrgId && savedOrgName) {
          setActiveCompany({ id: savedOrgId, name: savedOrgName });
        }
      }
    };

    syncActiveCompany();
    window.addEventListener("deku_active_org_changed", syncActiveCompany);
    return () => window.removeEventListener("deku_active_org_changed", syncActiveCompany);
  }, []);

  // Global Keyboard Shortcuts Handler
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = isTargetInteractive(target);
      const isDialogActive = isModalOrDrawerOpen() || isCommandPaletteOpen || isHelpOpen;

      // 1. Omnibox / Command Palette: Ctrl+K or Cmd+K or Alt+G (Always active regardless of preference)
      if (
        ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) ||
        (e.altKey && (e.key === "g" || e.key === "G"))
      ) {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
        return;
      }

      // 2. If Keyboard Navigation is toggled OFF by user preference, skip all F1-F11 and ESC jumps
      if (!keyboardNavEnabled) {
        return;
      }

      // 3. ESC -> Return to Gateway or close modals/drawers
      if (e.key === "Escape") {
        if (isCommandPaletteOpen) {
          e.preventDefault();
          setIsCommandPaletteOpen(false);
          return;
        }
        if (isHelpOpen) {
          e.preventDefault();
          setIsHelpOpen(false);
          return;
        }

        if (isDialogActive) {
          return;
        }

        if (isInput) {
          (target as HTMLElement).blur();
          e.preventDefault();
          return;
        }

        if (hasActiveUnsavedEntries(pathname)) {
          const confirmLeave = window.confirm(
            "You have an active entry in progress. Discard unsaved changes and return to Gateway?"
          );
          if (!confirmLeave) {
            e.preventDefault();
            return;
          }
        }

        if (pathname !== "/gateway") {
          e.preventDefault();
          router.push("/gateway");
        }
        return;
      }

      // 4. Function Key Navigation: F1 - F11
      const destination = GLOBAL_FUNCTION_KEY_MAP[e.key];
      if (destination) {
        if (isInput || isDialogActive) {
          return;
        }

        const isVoucherDesk = pathname.startsWith("/vouchers");
        const isLocalVoucherKey = ["F4", "F5", "F6", "F7", "F8", "F9"].includes(e.key);

        if (isVoucherDesk && isLocalVoucherKey) {
          return;
        }

        if (hasActiveUnsavedEntries(pathname) && pathname !== destination) {
          const confirmLeave = window.confirm(
            `You have unsaved changes in progress. Discard and navigate to ${destination}?`
          );
          if (!confirmLeave) {
            e.preventDefault();
            return;
          }
        }

        e.preventDefault();
        router.push(destination);
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [router, pathname, isCommandPaletteOpen, isHelpOpen, keyboardNavEnabled]);

  return (
    <QueryClientProvider client={queryClient}>
      <div className="app-shell-root flex flex-col h-screen w-screen overflow-hidden bg-canvas text-ink font-sans print:h-auto print:w-auto print:overflow-visible print:bg-white">
        {/* Persistent Unified Navigation Header */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-line bg-panel-deep px-4 text-white z-30 no-print select-none">
          {/* Left: Brand Logo & Company Switcher */}
          <div className="flex items-center gap-3 min-w-0">
            {/* Logo / Gateway Home Link */}
            <Link
              href="/gateway"
              className="flex items-center gap-2.5 rounded-lg py-1 px-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand hover:opacity-90 transition-opacity shrink-0"
              title="Return to Gateway (Esc)"
            >
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-panel-deep font-black shadow-xs">
                <ReceiptText className="h-5 w-5 text-panel-deep" />
              </div>
              <span className="hidden sm:inline text-sm font-bold tracking-tight text-white">
                Deku <span className="font-normal text-slate-400">Finance</span>
              </span>
            </Link>

            <div className="hidden sm:block h-5 w-px bg-edge shrink-0" />

            {/* Company Switcher Header Control */}
            <Link
              href="/companies"
              className="flex items-center gap-2 rounded-lg border border-edge bg-panel/80 hover:bg-panel px-2.5 py-1.5 transition-colors text-left max-w-[240px] sm:max-w-[320px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              title="Switch company"
            >
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded bg-panel-raised text-[10px] font-bold text-brand">
                {(activeCompany.name || "D").slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold text-white leading-tight">
                  {activeCompany.name || "Select Company"}
                </span>
                <span className="block text-[10px] text-slate-400 leading-tight">
                  {financialYear ? `FY ${financialYear}` : "Active Workspace"}
                </span>
              </div>
              <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-slate-400 ml-0.5" />
            </Link>
          </div>

          {/* Right: Quick Tools & User Controls */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Omnibox / Command Palette trigger */}
            <button
              onClick={() => setIsCommandPaletteOpen(true)}
              className="hidden md:flex items-center gap-2 rounded-lg border border-edge bg-panel/60 hover:bg-panel px-3 py-1.5 text-xs text-slate-300 hover:text-white transition-colors"
              title="Search or jump to module (Ctrl+K)"
            >
              <Search className="h-3.5 w-3.5 text-slate-400" />
              <span className="text-[11px] text-slate-400">Jump to…</span>
              <kbd className="rounded border border-edge bg-panel-raised px-1.5 py-0.5 font-mono text-[9px] text-slate-300">
                Ctrl K
              </kbd>
            </button>

            {/* Keyboard Navigation Quick Toggle Button */}
            <button
              onClick={toggleKeyboardNav}
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all ${
                keyboardNavEnabled
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                  : "border-edge bg-panel/40 text-slate-400 hover:bg-panel hover:text-slate-200"
              }`}
              title={
                keyboardNavEnabled
                  ? "Keyboard Shortcuts (F1–F11): ON (Click to disable)"
                  : "Keyboard Shortcuts (F1–F11): OFF (Click to enable)"
              }
              aria-label="Toggle keyboard shortcuts"
            >
              <Keyboard className="h-3.5 w-3.5" />
              <span className="hidden lg:inline text-[11px]">
                {keyboardNavEnabled ? "F-Keys ON" : "F-Keys OFF"}
              </span>
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  keyboardNavEnabled ? "bg-emerald-400 animate-pulse" : "bg-slate-500"
                }`}
              />
            </button>

            {/* Notification Bell */}
            <NotificationBell />

            {/* Keyboard Help Modal Trigger */}
            <button
              onClick={() => setIsHelpOpen(true)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-panel hover:text-slate-200 transition-colors"
              title="Keyboard Shortcuts Cheatsheet"
              aria-label="Keyboard Shortcuts"
            >
              <HelpCircle className="h-4 w-4" />
            </button>

            {/* User Profile / Logout */}
            <div className="flex items-center gap-1.5 border-l border-edge pl-2 ml-1">
              <span
                className="grid h-7 w-7 place-items-center rounded-full bg-panel-raised text-[11px] font-bold text-slate-200 border border-edge"
                title={user?.email || "User profile"}
              >
                {(user?.full_name || user?.email || "U").slice(0, 1).toUpperCase()}
              </span>

              <button
                onClick={() => logout().then(() => (window.location.href = "/login"))}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 transition-colors"
                title="Sign out"
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </header>

        {/* Central Content Area (Full screen width, no permanent sidebar) */}
        <div className="relative flex flex-1 flex-col overflow-hidden print:overflow-visible print:h-auto print:flex-none">
          {children}
        </div>

        {/* Persistent Bottom Keyboard Shortcut Strip */}
        <ShortcutBar
          onOpenHelp={() => setIsHelpOpen(true)}
          onOpenGoTo={() => setIsCommandPaletteOpen(true)}
        />

        {/* Global Dialogs */}
        <CommandPalette
          isOpen={isCommandPaletteOpen}
          onClose={() => setIsCommandPaletteOpen(false)}
        />
        <KeyboardHelpModal
          isOpen={isHelpOpen}
          onClose={() => setIsHelpOpen(false)}
        />
      </div>
    </QueryClientProvider>
  );
}
