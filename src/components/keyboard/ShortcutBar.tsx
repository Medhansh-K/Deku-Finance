import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

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
  const pathname = usePathname();

  const shortcuts: ShortcutItem[] = [
    { key: "F1", label: "Help", onClick: onOpenHelp },
    { key: "F2", label: "Date" },
    { key: "F3", label: "Company", route: "/companies" },
    { key: "F4", label: "Contra", route: "/vouchers/contra", active: pathname === "/vouchers/contra" },
    { key: "F5", label: "Payment", route: "/vouchers/payment", active: pathname === "/vouchers" || pathname === "/vouchers/payment" },
    { key: "F6", label: "Receipt", route: "/vouchers/receipt", active: pathname === "/vouchers/receipt" },
    { key: "F7", label: "Journal", route: "/vouchers/journal", active: pathname === "/vouchers/journal" },
    { key: "F8", label: "Sales", route: "/vouchers/sales", active: pathname === "/vouchers/sales" },
    { key: "F9", label: "Purchase", route: "/vouchers/purchase", active: pathname === "/vouchers/purchase" },
    { key: "Alt+G", label: "Go To", onClick: onOpenGoTo },
    { key: "L", label: "Logs", route: "/audit", active: pathname === "/audit" || pathname === "/logs" },
    { key: "Esc", label: "Gateway", route: "/gateway" },
  ];

  return (
    <footer
      id="keyboard-shortcut-bar"
      className="hidden md:flex h-8 bg-surface border-t border-line text-ink-muted items-center justify-between px-3 select-none text-[11px] font-sans shrink-0 z-30 no-print"
    >
      <div className="flex items-center gap-1 overflow-x-auto py-0.5">
        {shortcuts.map((sc, i) => {
          const content = (
            <div
              className={`flex items-center gap-1 px-2 py-0.5 rounded cursor-pointer transition-colors ${
                sc.active
                  ? "bg-brand/12 text-brand-strong font-semibold"
                  : "hover:bg-canvas-sunken hover:text-ink"
              }`}
            >
              <kbd className="font-mono font-medium text-[10px] text-ink-subtle">
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

      <div className="text-[10px] font-mono text-ink-subtle hidden sm:block">
        Deku Financial OS • Double-Entry Strict
      </div>
    </footer>
  );
}
