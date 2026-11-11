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
    { key: "F2", label: "Consultant", route: "/consultant", active: pathname === "/consultant" },
    { key: "F3", label: "Vouchers", route: "/vouchers", active: pathname === "/vouchers" },
    { key: "F4", label: "Contra", route: "/vouchers/contra", active: pathname === "/vouchers/contra" },
    { key: "F5", label: "Payment", route: "/vouchers/payment", active: pathname === "/vouchers/payment" },
    { key: "F6", label: "Receipt", route: "/vouchers/receipt", active: pathname === "/vouchers/receipt" },
    { key: "F7", label: "Journal", route: "/vouchers/journal", active: pathname === "/vouchers/journal" },
    { key: "F8", label: "Sales", route: "/vouchers/sales", active: pathname === "/vouchers/sales" },
    { key: "F9", label: "Purchase", route: "/vouchers/purchase", active: pathname === "/vouchers/purchase" },
    { key: "F10", label: "Bank rec", route: "/banking/reconciliation", active: pathname === "/banking/reconciliation" },
    { key: "F11", label: "GST file", route: "/gst/file", active: pathname === "/gst/file" },
    { key: "Ctrl K", label: "Go to", onClick: onOpenGoTo },
    { key: "Help", label: "Cheatsheet", onClick: onOpenHelp },
    { key: "Esc", label: "Gateway", route: "/gateway", active: pathname === "/gateway" },
  ];

  return (
    <footer
      id="keyboard-shortcut-bar"
      data-tour="shortcut-bar"
      className="flex h-10 bg-surface border-t border-line text-ink-muted items-center justify-between px-3 sm:px-6 select-none text-[12.5px] font-sans shrink-0 z-30 no-print overflow-hidden"
    >
      <div className="flex items-center gap-1 overflow-x-auto py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {shortcuts.map((sc, i) => {
          const content = (
            <div
              className={`flex items-center gap-1.5 px-2 py-1 rounded-[7px] cursor-pointer transition-colors whitespace-nowrap ${
                sc.active
                  ? "bg-brand-wash text-brand-strong font-medium"
                  : "hover:bg-canvas-sunken hover:text-ink text-ink-muted"
              }`}
            >
              <kbd
                className={`font-mono text-[11px] font-medium leading-none px-1.5 pt-[3px] pb-[2px] rounded-[5px] border border-line-strong border-b-2 bg-surface ${
                  keyboardNavEnabled ? "text-ink-soft" : "text-ink-subtle opacity-70"
                }`}
              >
                {sc.key}
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

      <div className="text-[12px] text-ink-muted hidden xl:flex items-center gap-2 pl-3 border-l border-line shrink-0">
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            keyboardNavEnabled ? "bg-brand" : "bg-ink-subtle"
          }`}
        />
        <span className={keyboardNavEnabled ? "text-brand-strong" : "text-ink-muted"}>
          {keyboardNavEnabled ? "F-keys active" : "F-keys paused"}
        </span>
      </div>
    </footer>
  );
}
