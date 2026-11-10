"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useKeyboardNav } from "@/context/KeyboardNavContext";
import { useOptionalLearnDemo } from "@/context/LearnDemoContext";

export interface ShortcutItem {
  key: string;
  label: string;
  route?: string;
  onClick?: () => void;
  active?: boolean;
}

export interface ShortcutBarProps {
  onOpenHelp?: () => void;
  onOpenGoTo?: () => void;
}

export function ShortcutBar({ onOpenHelp, onOpenGoTo }: ShortcutBarProps) {
  const demo = useOptionalLearnDemo();
  const rawPathname = usePathname() || "";
  const pathname = demo?.activeRoute ?? rawPathname;
  const { keyboardNavEnabled } = useKeyboardNav();

  // Unified F1-F11 shortcuts across the platform: F4-F9 are always Vouchers
  const shortcuts: ShortcutItem[] = [
    { key: "F1", label: "Executive", route: "/executive", active: pathname === "/executive" },
    { key: "F2", label: "Konsultant", route: "/consultant", active: pathname === "/consultant" },
    { key: "F3", label: "Vouchers", route: "/vouchers", active: pathname === "/vouchers" },
    { key: "F4", label: "Contra", route: "/vouchers/contra", active: pathname === "/vouchers/contra" },
    { key: "F5", label: "Payment", route: "/vouchers/payment", active: pathname === "/vouchers/payment" },
    { key: "F6", label: "Receipt", route: "/vouchers/receipt", active: pathname === "/vouchers/receipt" },
    { key: "F7", label: "Journal", route: "/vouchers/journal", active: pathname === "/vouchers/journal" },
    { key: "F8", label: "Sales", route: "/vouchers/sales", active: pathname === "/vouchers/sales" },
    { key: "F9", label: "Purchase", route: "/vouchers/purchase", active: pathname === "/vouchers/purchase" },
    { key: "F10", label: "Bank Rec", route: "/banking/reconciliation", active: pathname === "/banking/reconciliation" },
    { key: "F11", label: "GST File", route: "/gst/file", active: pathname === "/gst/file" },
    { key: "Ctrl+K", label: "Go To", onClick: onOpenGoTo },
    { key: "Help", label: "Cheatsheet", onClick: onOpenHelp },
    { key: "Esc", label: "Gateway", route: "/gateway", active: pathname === "/gateway" },
  ];

  return (
    <footer
      id="keyboard-shortcut-bar"
      data-tour="shortcut-bar"
      className="flex h-8 bg-panel-deep border-t border-edge text-slate-300 items-center justify-between px-3 select-none text-[11px] font-sans shrink-0 z-30 no-print overflow-hidden shadow-inner"
    >
      <div className="flex items-center gap-1 overflow-x-auto py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {shortcuts.map((sc, i) => {
          const content = (
            <div
              className={`flex items-center gap-1 px-2 py-0.5 rounded cursor-pointer transition-colors whitespace-nowrap ${
                sc.active
                  ? "bg-brand/20 text-brand font-bold shadow-2xs border border-brand/30"
                  : "hover:bg-panel hover:text-white text-slate-300"
              }`}
            >
              <kbd
                className={`font-mono text-[10px] font-bold ${
                  keyboardNavEnabled ? "text-brand" : "text-slate-400 opacity-70"
                }`}
              >
                {sc.key}:
              </kbd>
              <span className="truncate">{sc.label}</span>
            </div>
          );

          if (sc.route) {
            return (
              <Link key={i} href={sc.route}>
                {content}
              </Link>
            );
          }

          return (
            <div key={i} onClick={sc.onClick}>
              {content}
            </div>
          );
        })}
      </div>

      <div className="text-[10px] font-mono text-slate-400 hidden xl:flex items-center gap-2 pl-2 border-l border-edge shrink-0">
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            keyboardNavEnabled ? "bg-emerald-400 animate-pulse" : "bg-slate-500"
          }`}
        />
        <span className={keyboardNavEnabled ? "text-emerald-300" : "text-slate-400"}>
          {keyboardNavEnabled ? "F-Keys Active" : "F-Keys Paused"}
        </span>
        <span>•</span>
        <span>Deku Financial OS · Double-Entry Strict</span>
      </div>
    </footer>
  );
}
