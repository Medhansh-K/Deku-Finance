import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  BookOpen,
  Receipt,
  FileSpreadsheet,
  Layers,
  Users,
  ShoppingBag,
  Building2,
  Calendar,
  ShieldAlert,
  Settings,
  HelpCircle,
  ArrowRight,
  TrendingUp,
  FileText,
  Sparkles,
  ShieldCheck as ShieldCheckIcon,
  Landmark as LandmarkIcon,
  FileSpreadsheet as FileSpreadsheetIcon,
} from "lucide-react";

export interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  category: "Masters" | "Transactions" | "Reports" | "Utilities";
  route: string;
  shortcut?: string;
  icon: any;
}

export const COMMAND_REGISTRY: CommandItem[] = [
  // Masters
  {
    id: "gateway",
    title: "Gateway of Deku",
    subtitle: "Main accounting gateway and menu dashboard",
    category: "Masters",
    route: "/gateway",
    shortcut: "Esc",
    icon: Layers,
  },
  {
    id: "executive",
    title: "Executive Dashboard",
    subtitle: "Live business KPI snapshot, cash flow & health",
    category: "Reports",
    route: "/executive",
    shortcut: "E",
    icon: TrendingUp,
  },
  {
    id: "deku-consultant",
    title: "Deku Consultant (AI CFO)",
    subtitle: "Answers from your own ledger. Nothing leaves your servers",
    category: "Reports",
    route: "/consultant",
    shortcut: "K",
    icon: Sparkles,
  },
  {
    id: "coa",
    title: "Chart of Accounts",
    subtitle: "ALERX accounts hierarchy & ledger management",
    category: "Masters",
    route: "/masters/chart-of-accounts",
    shortcut: "Alt+C",
    icon: BookOpen,
  },
  {
    id: "parties",
    title: "Parties & Counterparties",
    subtitle: "Customer & vendor master directory with GSTIN",
    category: "Masters",
    route: "/masters/parties",
    icon: Users,
  },
  {
    id: "catalogue",
    title: "Catalogue (Goods & Services)",
    subtitle: "Item masters, SKU, HSN/SAC codes & tax rates",
    category: "Masters",
    route: "/masters/products-services",
    icon: ShoppingBag,
  },

  // Transactions
  {
    id: "v-hub",
    title: "Accounting Vouchers Hub",
    subtitle: "Unified voucher desk with direct document auto-extraction (F4-F9)",
    category: "Transactions",
    route: "/vouchers",
    shortcut: "V",
    icon: Receipt,
  },
  {
    id: "v-payment",
    title: "Payment Voucher",
    subtitle: "Record vendor and expense bank/cash payouts",
    category: "Transactions",
    route: "/vouchers/payment",
    shortcut: "F5",
    icon: Receipt,
  },
  {
    id: "v-receipt",
    title: "Receipt Voucher",
    subtitle: "Customer inward payments and collections",
    category: "Transactions",
    route: "/vouchers/receipt",
    shortcut: "F6",
    icon: Receipt,
  },
  {
    id: "v-contra",
    title: "Contra Voucher",
    subtitle: "Bank deposit, withdrawal or inter-bank transfer",
    category: "Transactions",
    route: "/vouchers/contra",
    shortcut: "F4",
    icon: Receipt,
  },
  {
    id: "v-journal",
    title: "Journal Voucher",
    subtitle: "Atomic double-entry adjustment voucher",
    category: "Transactions",
    route: "/vouchers/journal",
    shortcut: "F7",
    icon: Receipt,
  },
  {
    id: "v-sales",
    title: "Sales Invoices",
    subtitle: "GST tax invoices & bills of supply creation",
    category: "Transactions",
    route: "/vouchers/sales",
    shortcut: "F8",
    icon: Receipt,
  },
  {
    id: "v-purchase",
    title: "Purchase Invoices",
    subtitle: "Inward supply and purchase vouchers",
    category: "Transactions",
    route: "/vouchers/purchase",
    shortcut: "F9",
    icon: Receipt,
  },
  {
    id: "day-book",
    title: "Day Book",
    subtitle: "Chronological transaction register and voucher history",
    category: "Transactions",
    route: "/day-book",
    icon: Calendar,
  },
  {
    id: "approvals",
    title: "Voucher Approvals",
    subtitle: "Maker-checker queue: approve or send back vouchers",
    category: "Transactions",
    route: "/approvals",
    icon: ShieldCheckIcon,
  },
  {
    id: "bank-reconciliation",
    title: "Bank Reconciliation",
    subtitle: "Import a bank statement and match it to the books",
    category: "Transactions",
    route: "/banking/reconciliation",
    icon: LandmarkIcon,
  },
  {
    id: "gst-returns",
    title: "GST Returns (GSTR-1 / 3B)",
    subtitle: "Generate return JSON from posted invoices and ITC ledgers",
    category: "Reports",
    route: "/dashboard/returns",
    icon: FileSpreadsheetIcon,
  },

  // Reports
  {
    id: "rep-trial-balance",
    title: "Trial Balance",
    subtitle: "Debit and credit account balances verification",
    category: "Reports",
    route: "/reports/trial-balance",
    icon: FileSpreadsheet,
  },
  {
    id: "rep-pnl",
    title: "Profit & Loss Account",
    subtitle: "Revenue, operating expenses & net profit",
    category: "Reports",
    route: "/reports/profit-loss",
    icon: TrendingUp,
  },
  {
    id: "rep-balance-sheet",
    title: "Balance Sheet",
    subtitle: "Assets, liabilities and shareholder equity statement",
    category: "Reports",
    route: "/reports/balance-sheet",
    icon: FileSpreadsheet,
  },
  {
    id: "invoices-turnover",
    title: "Sales Invoices & Billed Turnover",
    subtitle: "Invoices register, issuance, conversion tracking & revenue realization",
    category: "Transactions",
    route: "/invoices",
    icon: FileText,
  },
  {
    id: "rep-debtors",
    title: "Trade Debtors (AR) & DSO Tracking",
    subtitle: "Accounts receivable tracking as per Days Sales Outstanding (DSO) & open invoices",
    category: "Reports",
    route: "/reports/debtors",
    icon: Users,
  },
  {
    id: "rep-creditors",
    title: "Trade Creditors (AP) & DPO Tracking",
    subtitle: "Accounts payable tracking as per Days Payable Outstanding (DPO) & vendor bills",
    category: "Reports",
    route: "/reports/creditors",
    icon: Building2,
  },
  {
    id: "rep-operating-expenses",
    title: "Operating Expenses & Payment Vouchers",
    subtitle: "Payment vouchers issued to companies & individuals with department-wise tracking",
    category: "Reports",
    route: "/reports/operating-expenses",
    icon: TrendingUp,
  },
  {
    id: "rep-cash-flow",
    title: "Cash Flow Statement (WCM)",
    subtitle: "Direct operating, investing, and financing liquid cash flows & reserves",
    category: "Reports",
    route: "/reports/cash-flow",
    icon: Layers,
  },
  {
    id: "rep-fpa",
    title: "FP&A Intelligence & Analytics",
    subtitle: "Strategic margins, solvency ratios, working capital gap, and budget variances",
    category: "Reports",
    route: "/reports/fpa",
    icon: TrendingUp,
  },

  // Utilities
  {
    id: "gst",
    title: "GST Returns & Tax Engine",
    subtitle: "Tax calculations, supply breakdown & GSTR summary",
    category: "Utilities",
    route: "/gst",
    icon: ShieldAlert,
  },
  {
    id: "departments-members",
    title: "Departments & Members",
    subtitle: "Department leads, budgets, inter/intra tasks, payroll, CTC & owner permissions",
    category: "Utilities",
    route: "/departments-members",
    shortcut: "M",
    icon: Users,
  },
  {
    id: "builder",
    title: "Business Document Builder",
    subtitle: "Generate Invoice, Quote, Discount Coupon, Proforma, Delivery Challan & PO",
    category: "Transactions",
    route: "/builder",
    shortcut: "Shift+B",
    icon: FileText,
  },
  {
    id: "companies",
    title: "Select Company / Financial Year",
    subtitle: "Switch active organisation or fiscal period",
    category: "Utilities",
    route: "/companies",
    shortcut: "F3",
    icon: Building2,
  },
  {
    id: "audit",
    title: "User Activity Logs & Audit Trail",
    subtitle: "Real-time user actions, transaction lifecycle & immutable compliance logs",
    category: "Utilities",
    route: "/audit",
    shortcut: "L",
    icon: ShieldAlert,
  },
  {
    id: "settings",
    title: "Settings & Configuration",
    subtitle: "Company preferences, operating mode and currencies",
    category: "Utilities",
    route: "/settings",
    icon: Settings,
  },
];

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter commands
  const filteredCommands = COMMAND_REGISTRY.filter((cmd) => {
    const text = `${cmd.title} ${cmd.subtitle || ""} ${cmd.category}`.toLowerCase();
    return text.includes(query.toLowerCase());
  });

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleSelect = (route: string) => {
    onClose();
    router.push(route);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev < filteredCommands.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev > 0 ? prev - 1 : filteredCommands.length - 1
      );
    } else if (e.key === "Enter" && filteredCommands[selectedIndex]) {
      e.preventDefault();
      handleSelect(filteredCommands[selectedIndex].route);
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Palette Container */}
      <div
        className="relative z-10 w-full max-w-xl rounded-lg border border-edge bg-panel-deep text-white shadow-2xl overflow-hidden font-sans"
        onKeyDown={handleKeyDown}
      >
        {/* Search Input Bar */}
        <div className="flex items-center border-b border-edge px-4 py-3 bg-panel">
          <Search className="h-5 w-5 text-brand mr-3" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Go To: Type a report, voucher, master, or setting..."
            className="w-full bg-transparent text-sm text-white placeholder-slate-400 focus:outline-none"
          />
          <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/40 border border-slate-600 text-slate-300">
            Esc
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 divide-y divide-slate-800/40">
          {filteredCommands.length > 0 ? (
            filteredCommands.map((cmd, idx) => {
              const isSelected = selectedIndex === idx;
              const Icon = cmd.icon;
              return (
                <div
                  key={cmd.id}
                  onClick={() => handleSelect(cmd.route)}
                  className={`flex items-center justify-between p-2.5 rounded cursor-pointer transition-colors ${
                    isSelected
                      ? "bg-brand text-ink"
                      : "text-slate-200 hover:bg-slate-800/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon
                      className={`h-4 w-4 ${
                        isSelected ? "text-ink" : "text-brand"
                      }`}
                    />
                    <div>
                      <div className="text-xs font-bold leading-none">
                        {cmd.title}
                      </div>
                      {cmd.subtitle && (
                        <div
                          className={`text-[11px] mt-1 ${
                            isSelected ? "text-ink/80" : "text-slate-400"
                          }`}
                        >
                          {cmd.subtitle}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded ${
                        isSelected
                          ? "bg-black/20 text-ink"
                          : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {cmd.category}
                    </span>
                    {cmd.shortcut && (
                      <kbd
                        className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                          isSelected
                            ? "bg-black/10 border-black/30 text-ink"
                            : "bg-slate-800 border-slate-700 text-brand-soft"
                        }`}
                      >
                        {cmd.shortcut}
                      </kbd>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-8 text-center text-xs text-slate-400 font-mono">
              No matching destinations found for &quot;{query}&quot;.
            </div>
          )}
        </div>

        {/* Footer Shortcut Hints */}
        <div className="flex items-center justify-between border-t border-edge bg-panel px-4 py-2 text-[11px] text-slate-400 font-mono">
          <div className="flex items-center gap-3">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>Esc Dismiss</span>
          </div>
          <div className="text-brand-soft">Tally Go To: Alt+G / Ctrl+K</div>
        </div>
      </div>
    </div>
  );
}
