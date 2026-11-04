/**
 * Deku Finance — Keyboard Shortcut Registry & Keybindings
 * Final Navigation Refactor: Function-Key (F1-F11 + ESC) Specification
 */

export interface KeyboardShortcut {
  key: string;
  code?: string;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  label: string;
  description: string;
  category: "navigation" | "voucher" | "action";
  actionRoute?: string;
}

export const GLOBAL_FUNCTION_KEY_MAP: Record<string, string> = {
  F1: "/executive",
  F2: "/consultant",
  F3: "/vouchers",
  F4: "/gst",
  F5: "/purchases",
  F6: "/collect",
  F7: "/builder",
  F8: "/day-book",
  F9: "/approvals",
  F10: "/banking/reconciliation",
  F11: "/gst/file",
};

/** A function key with no modifier; Ctrl+F5, Shift+F5 and Alt+F4 belong to the browser and the OS. */
export function isPlainKey(e: Pick<KeyboardEvent, "ctrlKey" | "metaKey" | "altKey" | "shiftKey">): boolean {
  return !(e.ctrlKey || e.metaKey || e.altKey || e.shiftKey);
}

/**
 * Detect if an active element is an input, editable area, combobox, or code editor.
 * Protects transaction entry from accidental global shortcut navigation.
 */
export function isTargetInteractive(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable || target.getAttribute("contenteditable") === "true") return true;
  if (target.closest("[contenteditable='true']")) return true;
  if (target.closest("[role='combobox']")) return true;
  if (target.closest("[role='listbox']")) return true;
  if (target.closest(".monaco-editor")) return true;
  return false;
}

export const STANDARD_SHORTCUTS: KeyboardShortcut[] = [
  {
    key: "F1",
    label: "F1: Executive Dashboard",
    description: "Macro KPIs, runway projections, and solvency metrics",
    category: "navigation",
    actionRoute: "/executive",
  },
  {
    key: "F2",
    label: "F2: Deku Consultant",
    description: "Questions answered from your ledger figures",
    category: "navigation",
    actionRoute: "/consultant",
  },
  {
    key: "F3",
    label: "F3: Vouchers",
    description: "Universal double-entry accounting vouchers desk",
    category: "navigation",
    actionRoute: "/vouchers",
  },
  {
    key: "F4",
    label: "F4: Sales & Invoicing",
    description: "Tax invoices, bills of supply, and sales notes",
    category: "navigation",
    actionRoute: "/gst",
  },
  {
    key: "F5",
    label: "F5: Purchases & ITC",
    description: "Vendor bills and GSTR-2B inward reconciliation",
    category: "navigation",
    actionRoute: "/purchases",
  },
  {
    key: "F6",
    label: "F6: Collections",
    description: "Receivables aging, UPI QR, and Razorpay links",
    category: "navigation",
    actionRoute: "/collect",
  },
  {
    key: "F7",
    label: "F7: Document Builder",
    description: "Quotations, proformas, challans (Rule 55), and POs",
    category: "navigation",
    actionRoute: "/builder",
  },
  {
    key: "F8",
    label: "F8: Day Book",
    description: "Chronological immutable ledger transaction feed",
    category: "navigation",
    actionRoute: "/day-book",
  },
  {
    key: "F9",
    label: "F9: Approvals",
    description: "Maker-checker draft voucher review and ledger sign-off",
    category: "navigation",
    actionRoute: "/approvals",
  },
  {
    key: "F10",
    label: "F10: Bank Reconciliation",
    description: "Bank statement vs. internal accounting ledger matcher",
    category: "navigation",
    actionRoute: "/banking/reconciliation",
  },
  {
    key: "F11",
    label: "F11: GST Return Filing",
    description: "Direct GSP return preparation, GSTR-1 & GSTR-3B filing",
    category: "navigation",
    actionRoute: "/gst/file",
  },
  {
    key: "Escape",
    label: "Esc: Gateway",
    description: "Return to Gateway / Close active dialog or drawer",
    category: "navigation",
    actionRoute: "/gateway",
  },
  {
    key: "k",
    ctrlKey: true,
    label: "Ctrl+K / Cmd+K: Command Palette",
    description: "Global command palette to search or jump to any module",
    category: "action",
  },
  // Voucher editor local shortcuts
  {
    key: "F4",
    label: "Voucher F4: Contra",
    description: "Inside Voucher Desk: Bank to Cash / Contra transfer",
    category: "voucher",
  },
  {
    key: "F5",
    label: "Voucher F5: Payment",
    description: "Inside Voucher Desk: Vendor / Expense payment",
    category: "voucher",
  },
  {
    key: "F6",
    label: "Voucher F6: Receipt",
    description: "Inside Voucher Desk: Customer receipt / incoming funds",
    category: "voucher",
  },
  {
    key: "F7",
    label: "Voucher F7: Journal",
    description: "Inside Voucher Desk: Double-entry adjusting journal",
    category: "voucher",
  },
  {
    key: "F8",
    label: "Voucher F8: Sales",
    description: "Inside Voucher Desk: Sales transaction entry",
    category: "voucher",
  },
  {
    key: "F9",
    label: "Voucher F9: Purchase",
    description: "Inside Voucher Desk: Purchase voucher entry",
    category: "voucher",
  },
];
