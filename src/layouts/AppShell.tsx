"use client";

import React, { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TopBar } from "@/components/navigation/TopBar";
import { ShortcutBar } from "@/components/keyboard/ShortcutBar";
import { CommandPalette } from "@/components/command-palette/CommandPalette";
import { KeyboardHelpModal } from "@/components/keyboard/KeyboardHelpModal";

// Create client once
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

export function AppShell({ children }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  // Default active company context verified against backend
  const [activeCompany, setActiveCompany] = useState<{
    id: string;
    name: string;
    financialYear: string;
  }>({
    id: "b127e064-5da8-437f-94c4-b8d6a0c12927",
    name: "Deku Financial Technologies",
    financialYear: "2026-27",
  });

  // Sync active company from localStorage if saved or upon company shift
  useEffect(() => {
    const syncActiveCompany = () => {
      if (typeof window !== "undefined") {
        const savedOrgId = localStorage.getItem("deku_active_org_id");
        const savedOrgName = localStorage.getItem("deku_active_org_name");
        if (savedOrgId && savedOrgName) {
          setActiveCompany({
            id: savedOrgId,
            name: savedOrgName,
            financialYear: "2026-27",
          });
        }
      }
    };

    syncActiveCompany();
    window.addEventListener("deku_active_org_changed", syncActiveCompany);
    return () => window.removeEventListener("deku_active_org_changed", syncActiveCompany);
  }, []);

  // Global Keyboard Shortcuts (No navigation logging)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Don't trigger when inside inputs if typing regular text
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      // Alt+G or Ctrl+K / Cmd+K -> Go To Palette
      if ((e.altKey && (e.key === "g" || e.key === "G")) || ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K"))) {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
        return;
      }

      // F1 -> Help
      if (e.key === "F1") {
        e.preventDefault();
        setIsHelpOpen((prev) => !prev);
        return;
      }

      // F3 -> Switch Company
      if (e.key === "F3") {
        e.preventDefault();
        router.push("/companies");
        return;
      }

      // Shift + B -> Business Document Builder
      if (e.shiftKey && (e.key === "b" || e.key === "B")) {
        if (!isInput) {
          e.preventDefault();
          router.push("/builder");
          return;
        }
      }

      // Shift + K -> Deku Consultant AI Advisor
      if (e.shiftKey && (e.key === "k" || e.key === "K")) {
        if (!isInput) {
          e.preventDefault();
          router.push("/consultant");
          return;
        }
      }

      // L or l -> Activity Logs & Audit Trail (Shortcut L retained for navigation)
      if ((e.key === "l" || e.key === "L") && !e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey) {
        if (!isInput && !isCommandPaletteOpen && !isHelpOpen) {
          e.preventDefault();
          router.push("/audit");
          return;
        }
      }

      // Voucher F-Keys (F4 - F9)
      const voucherKeyMap: Record<string, string> = {
        F4: "contra",
        F5: "payment",
        F6: "receipt",
        F7: "journal",
        F8: "sales",
        F9: "purchase",
      };

      if (voucherKeyMap[e.key]) {
        if (!pathname?.startsWith("/vouchers")) {
          e.preventDefault();
          router.push(`/vouchers/${voucherKeyMap[e.key]}`);
          return;
        }
      }

      // Esc -> If no modals open, return to Gateway
      if (e.key === "Escape" && !isCommandPaletteOpen && !isHelpOpen && pathname !== "/gateway") {
        if (!isInput) {
          e.preventDefault();
          router.push("/gateway");
        }
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [router, pathname, isCommandPaletteOpen, isHelpOpen]);

  return (
    <QueryClientProvider client={queryClient}>
      <div className="app-shell-root flex flex-col h-screen w-screen overflow-hidden bg-[#F8FAFC] text-[#0F172A] font-sans print:h-auto print:w-auto print:overflow-visible print:bg-white">
        {/* Top Tally Navigation Bar */}
        <TopBar
          companyName={activeCompany.name}
          financialYear={activeCompany.financialYear}
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
          onOpenHelp={() => setIsHelpOpen(true)}
        />

        {/* Dynamic App Workspace */}
        <div className="flex-1 overflow-hidden flex flex-col relative print:overflow-visible print:h-auto print:flex-none">
          {children}
        </div>

        {/* Bottom Keyboard Shortcut Strip */}
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
