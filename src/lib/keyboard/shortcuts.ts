/**
 * Deku Finance — Keyboard Shortcut Registry & Keybindings
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
  category: "navigation" | "voucher" | "report" | "action";
  actionRoute?: string;
}

export const STANDARD_SHORTCUTS: KeyboardShortcut[] = [
  {
    key: "F1",
    label: "F1: Help",
    description: "Open keyboard cheatsheet & shortcut index",
    category: "action",
  },
  {
    key: "F2",
    label: "F2: Date",
    description: "Change current transaction date / period",
    category: "action",
  },
  {
    key: "F3",
    label: "F3: Company",
    description: "Switch active organisation / company",
    category: "navigation",
    actionRoute: "/companies",
  },
  {
    key: "F4",
    label: "F4: Contra",
    description: "Bank to cash / transfer voucher",
    category: "voucher",
    actionRoute: "/vouchers/contra",
  },
  {
    key: "F5",
    label: "F5: Payment",
    description: "Vendor and expense payment voucher",
    category: "voucher",
    actionRoute: "/vouchers/payment",
  },
  {
    key: "F6",
    label: "F6: Receipt",
    description: "Customer collections and incoming receipts",
    category: "voucher",
    actionRoute: "/vouchers/receipt",
  },
  {
    key: "F7",
    label: "F7: Journal",
    description: "Adjustment, depreciation & double-entry journal",
    category: "voucher",
    actionRoute: "/vouchers/journal",
  },
  {
    key: "F8",
    label: "F8: Sales",
    description: "Sales invoice and outward billing",
    category: "voucher",
    actionRoute: "/vouchers/sales",
  },
  {
    key: "F9",
    label: "F9: Purchase",
    description: "Purchase bill and inward inventory",
    category: "voucher",
    actionRoute: "/vouchers/purchase",
  },
  {
    key: "k",
    ctrlKey: true,
    label: "Ctrl+K / Alt+G: Go To",
    description: "Global command palette to jump anywhere",
    category: "navigation",
  },
  {
    key: "m",
    label: "M: Departments & Members",
    description: "Manage departments, leads, tasks, members & payroll",
    category: "navigation",
    actionRoute: "/departments-members",
  },
  {
    key: "l",
    label: "L: Activity Logs",
    description: "Open user activity history, system events & immutable audit trail",
    category: "navigation",
    actionRoute: "/audit",
  },
  {
    key: "b",
    shiftKey: true,
    label: "Shift+B: Document Builder",
    description: "Generate business documents (Invoice, Quote, Coupon, Proforma, Challan, PO)",
    category: "action",
    actionRoute: "/builder",
  },
  {
    key: "Escape",
    label: "Esc: Gateway",
    description: "Return to Gateway / Close active dialog",
    category: "navigation",
    actionRoute: "/gateway",
  },
];
