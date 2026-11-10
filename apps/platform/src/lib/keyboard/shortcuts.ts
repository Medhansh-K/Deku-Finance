/**
 * Deku Finance — Keyboard Shortcut Registry & Keybindings
 * Unified Function-Key (F1-F11 + ESC) & Gateway Alphabet Specification
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
  category: "navigation" | "voucher" | "gateway" | "action";
  actionRoute?: string;
}

export const GLOBAL_FUNCTION_KEY_MAP: Record<string, string> = {
  F1: "/executive",
  F2: "/consultant",
  F3: "/vouchers",
  F4: "/vouchers/contra",
  F5: "/vouchers/payment",
  F6: "/vouchers/receipt",
  F7: "/vouchers/journal",
  F8: "/vouchers/sales",
  F9: "/vouchers/purchase",
  F10: "/banking/reconciliation",
  F11: "/gst/file",
};

export const GATEWAY_ALPHABET_KEY_MAP: Record<string, string> = {
  A: "/masters/chart-of-accounts",
  B: "/reports/balance-sheet",
  "Shift+B": "/builder",
  C: "/reports/cash-flow",
  D: "/day-book",
  E: "/executive",
  F: "/reports/fpa",
  G: "/gst",
  H: "/help",
  I: "/masters/products-services",
  K: "/consultant",
  L: "/audit",
  M: "/departments-members",
  N: "/reports/general-ledger",
  O: "/reports/profit-loss",
  P: "/masters/parties",
  Q: "/approvals",
  R: "/reconciliation",
  S: "/settings",
  T: "/reports/trial-balance",
  U: "/purchases",
  V: "/vouchers",
  W: "/collect",
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
  // Global Function Keys (F1–F11)
  {
    key: "F1",
    label: "F1: Executive Dashboard",
    description: "Macro KPIs, runway projections, and solvency metrics",
    category: "navigation",
    actionRoute: "/executive",
  },
  {
    key: "F2",
    label: "F2: Deku Konsultant",
    description: "Questions answered from your ledger figures",
    category: "navigation",
    actionRoute: "/consultant",
  },
  {
    key: "F3",
    label: "F3: Vouchers Desk",
    description: "Universal double-entry accounting vouchers workspace",
    category: "navigation",
    actionRoute: "/vouchers",
  },
  {
    key: "F4",
    label: "F4: Contra Voucher",
    description: "Bank to Cash / internal account transfers",
    category: "voucher",
    actionRoute: "/vouchers/contra",
  },
  {
    key: "F5",
    label: "F5: Payment Voucher",
    description: "Vendor settlements and expense payouts",
    category: "voucher",
    actionRoute: "/vouchers/payment",
  },
  {
    key: "F6",
    label: "F6: Receipt Voucher",
    description: "Customer payments and incoming receipts",
    category: "voucher",
    actionRoute: "/vouchers/receipt",
  },
  {
    key: "F7",
    label: "F7: Journal Voucher",
    description: "Double-entry adjusting journals and provisions",
    category: "voucher",
    actionRoute: "/vouchers/journal",
  },
  {
    key: "F8",
    label: "F8: Sales Voucher",
    description: "Sales & invoicing entry",
    category: "voucher",
    actionRoute: "/vouchers/sales",
  },
  {
    key: "F9",
    label: "F9: Purchase Voucher",
    description: "Vendor purchase bill entry",
    category: "voucher",
    actionRoute: "/vouchers/purchase",
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

  // Gateway Alphabet Keys (for unassigned pages & quick access)
  {
    key: "G",
    label: "G: GST & Sales Invoicing",
    description: "Tax invoices, bills of supply, and sales notes",
    category: "gateway",
    actionRoute: "/gst",
  },
  {
    key: "U",
    label: "U: Purchases & ITC",
    description: "Vendor bills and inward ITC reconciliation",
    category: "gateway",
    actionRoute: "/purchases",
  },
  {
    key: "W",
    label: "W: Collections & WhatsApp",
    description: "Receivables aging, UPI QR, and WhatsApp payment links",
    category: "gateway",
    actionRoute: "/collect",
  },
  {
    key: "Shift+B",
    shiftKey: true,
    label: "Shift+B: Document Builder",
    description: "Quotations, proformas, challans, and coupons",
    category: "gateway",
    actionRoute: "/builder",
  },
  {
    key: "D",
    label: "D: Day Book",
    description: "Chronological immutable ledger transaction feed",
    category: "gateway",
    actionRoute: "/day-book",
  },
  {
    key: "Q",
    label: "Q: Approvals Queue",
    description: "Maker-checker draft voucher review and ledger sign-off",
    category: "gateway",
    actionRoute: "/approvals",
  },
  {
    key: "R",
    label: "R: Reconciliation & Settlements",
    description: "Bank statement matching and marketplace payouts",
    category: "gateway",
    actionRoute: "/reconciliation",
  },
  {
    key: "N",
    label: "N: General Ledger",
    description: "Full account-level ledger statement",
    category: "gateway",
    actionRoute: "/reports/general-ledger",
  },
  {
    key: "H",
    label: "H: Help & Shortcuts",
    description: "Documentation and walkthroughs",
    category: "gateway",
    actionRoute: "/help",
  },
];
