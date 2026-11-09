"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Layers,
  Sparkles,
  CheckCircle2,
  Lock,
  ArrowRight,
  TrendingUp,
  Cpu,
  ShoppingBag,
  Palette,
  Factory,
  ChevronRight,
  Database,
  FileCode,
  ShieldCheck,
} from "lucide-react";

type BusinessPresetKey = "saas" | "ecommerce" | "freelance" | "wholesale";

interface AccountNode {
  code: string;
  group: "Asset" | "Liability" | "Equity" | "Revenue" | "Expense";
  groupCode: "A" | "L" | "E" | "R" | "X";
  ledger: string;
  subLedger: string;
  label: string;
  isPostable: boolean;
  sampleUnit: number;
  sampleValue: string;
  description: string;
}

interface BusinessPreset {
  title: string;
  subtitle: string;
  icon: React.ElementType;
  tag: string;
  color: string;
  summary: string;
  accounts: AccountNode[];
}

export default function AlerxLedgerSection() {
  const [selectedPreset, setSelectedPreset] = useState<BusinessPresetKey>("saas");
  const [filterQuery, setFilterQuery] = useState("");

  const presets: Record<BusinessPresetKey, BusinessPreset> = {
    saas: {
      title: "SaaS & Digital Agency",
      subtitle: "Software licenses, retainer fees, cloud hosting, and payment gateways",
      icon: Cpu,
      tag: "Tech & Services",
      color: "from-blue-500/20 to-indigo-500/20 text-blue-400 border-blue-500/30",
      summary: "Auto-configures Stripe/Razorpay settlement ledgers, recurring MRR accounts, AWS hosting expenses, and GST output liability.",
      accounts: [
        {
          code: "1021",
          group: "Asset",
          groupCode: "A",
          ledger: "Cash & Liquid Capital",
          subLedger: "Operating Bank Accounts",
          label: "HDFC Primary Current Account",
          isPostable: true,
          sampleUnit: 14,
          sampleValue: "₹4,20,000.00",
          description: "Receives subscription payouts from payment gateways and client wire transfers.",
        },
        {
          code: "1031",
          group: "Asset",
          groupCode: "A",
          ledger: "Current Assets & Receivables",
          subLedger: "Trade Debtors",
          label: "B2B SaaS Enterprise Receivables",
          isPostable: true,
          sampleUnit: 5,
          sampleValue: "₹1,85,000.00",
          description: "Unpaid invoices issued to annual contract clients.",
        },
        {
          code: "2081",
          group: "Liability",
          groupCode: "L",
          ledger: "Statutory & Tax Liabilities",
          subLedger: "Output GST Control",
          label: "Output IGST (18% Software License)",
          isPostable: true,
          sampleUnit: 12,
          sampleValue: "₹45,000.00",
          description: "Collected output tax on interstate customer subscriptions.",
        },
        {
          code: "3010",
          group: "Equity",
          groupCode: "E",
          ledger: "Owner / Contributed Capital",
          subLedger: "Shareholder Capital",
          label: "Founder Seed Capital",
          isPostable: true,
          sampleUnit: 1,
          sampleValue: "₹5,00,000.00",
          description: "Initial founder equity infusion deposited on incorporation.",
        },
        {
          code: "4010",
          group: "Revenue",
          groupCode: "R",
          ledger: "Operating Revenue / Sales",
          subLedger: "Product Sales Revenue",
          label: "Monthly Recurring Revenue (MRR)",
          isPostable: true,
          sampleUnit: 24,
          sampleValue: "₹6,80,000.00",
          description: "Subscription fees earned from active platform users.",
        },
        {
          code: "5030",
          group: "Expense",
          groupCode: "X",
          ledger: "Operating Overheads & Admin",
          subLedger: "Tech & SaaS Infrastructure",
          label: "Google Cloud Servers",
          isPostable: true,
          sampleUnit: 4,
          sampleValue: "₹68,500.00",
          description: "Monthly infrastructure and server hosting invoices.",
        },
      ],
    },
    ecommerce: {
      title: "D2C & E-Commerce Merchant",
      subtitle: "Marketplace sales (Amazon/Flipkart), inventory, and shipping",
      icon: ShoppingBag,
      tag: "E-Commerce & Retail",
      color: "from-brand/20 to-brand-soft/20 text-brand border-brand/30",
      summary: "Tracks Section 14 ECO marketplace receivables, stock inventory valuation, Shiprocket logistics freight, and reverse charge.",
      accounts: [
        {
          code: "1032",
          group: "Asset",
          groupCode: "A",
          ledger: "Current Assets & Receivables",
          subLedger: "Trade Debtors",
          label: "Amazon India Marketplace Escrow",
          isPostable: true,
          sampleUnit: 38,
          sampleValue: "₹2,45,000.00",
          description: "Undisbursed funds held by Amazon for 7-day payment settlement cycles.",
        },
        {
          code: "1040",
          group: "Asset",
          groupCode: "A",
          ledger: "Current Assets & Receivables",
          subLedger: "Stock Inventory",
          label: "Finished Goods Warehouse Stock",
          isPostable: true,
          sampleUnit: 15,
          sampleValue: "₹8,90,000.00",
          description: "Current landed inventory ready for fulfillment.",
        },
        {
          code: "1081",
          group: "Asset",
          groupCode: "A",
          ledger: "Tax Assets & Input Credits",
          subLedger: "Input GST Credits",
          label: "Input CGST + SGST (Purchase Bills)",
          isPostable: true,
          sampleUnit: 22,
          sampleValue: "₹64,200.00",
          description: "Eligible input tax credit ready to offset outward liabilities in GSTR-3B.",
        },
        {
          code: "4011",
          group: "Revenue",
          groupCode: "R",
          ledger: "Operating Revenue / Sales",
          subLedger: "Product Sales Revenue",
          label: "Shopify Store Direct D2C Sales",
          isPostable: true,
          sampleUnit: 112,
          sampleValue: "₹7,40,000.00",
          description: "Orders received directly via brand storefront.",
        },
        {
          code: "5010",
          group: "Expense",
          groupCode: "X",
          ledger: "Cost of Sales / Direct Delivery",
          subLedger: "COGS & Packaging",
          label: "Raw Materials & Packaging Boxes",
          isPostable: true,
          sampleUnit: 19,
          sampleValue: "₹2,80,000.00",
          description: "Direct manufacturing costs and packing materials.",
        },
        {
          code: "5091",
          group: "Expense",
          groupCode: "X",
          ledger: "Operating Overheads & Admin",
          subLedger: "Financial Charges",
          label: "Razorpay / COD Settlement Fees",
          isPostable: true,
          sampleUnit: 84,
          sampleValue: "₹18,200.00",
          description: "Payment gateway transaction processing cut (2% + GST).",
        },
      ],
    },
    freelance: {
      title: "Creative Freelancer / Solo Studio",
      subtitle: "Designers, consultants, and developers under Sec 22 Exemption",
      icon: Palette,
      tag: "Pure Accounting Non-GST",
      color: "from-emerald-500/20 to-teal-500/20 text-emerald-400 border-emerald-500/30",
      summary: "Zero GST bloat. Simple Bill of Supply income tracking, client retainers, instant UPI payouts, and tax-exempt ledger.",
      accounts: [
        {
          code: "1020",
          group: "Asset",
          groupCode: "A",
          ledger: "Cash & Liquid Capital",
          subLedger: "Operating Bank Accounts",
          label: "ICICI Bank Professional Account",
          isPostable: true,
          sampleUnit: 9,
          sampleValue: "₹1,95,000.00",
          description: "Primary savings/current account receiving instant UPI and NEFT transfers.",
        },
        {
          code: "1030",
          group: "Asset",
          groupCode: "A",
          ledger: "Current Assets & Receivables",
          subLedger: "Trade Debtors",
          label: "Client Unpaid Commercial Invoices",
          isPostable: true,
          sampleUnit: 3,
          sampleValue: "₹75,000.00",
          description: "Uncollected client milestone bills (tracked under 45-day MSME chase).",
        },
        {
          code: "3010",
          group: "Equity",
          groupCode: "E",
          ledger: "Owner / Contributed Capital",
          subLedger: "Proprietor Capital",
          label: "Owner's Personal Equity",
          isPostable: true,
          sampleUnit: 1,
          sampleValue: "₹1,00,000.00",
          description: "Initial capital deposited to cover workstation and equipment.",
        },
        {
          code: "4020",
          group: "Revenue",
          groupCode: "R",
          ledger: "Operating Revenue / Sales",
          subLedger: "Service & Advisory Fees",
          label: "UI/UX & Branding Retainer Income",
          isPostable: true,
          sampleUnit: 7,
          sampleValue: "₹3,40,000.00",
          description: "Service earnings exempt under Section 22 CGST Act (Turnover < ₹20L).",
        },
        {
          code: "5030",
          group: "Expense",
          groupCode: "X",
          ledger: "Operating Overheads & Admin",
          subLedger: "Technology & Subscriptions",
          label: "Figma, Adobe CC & Notion",
          isPostable: true,
          sampleUnit: 6,
          sampleValue: "₹24,500.00",
          description: "Monthly design software licenses and productivity tools.",
        },
      ],
    },
    wholesale: {
      title: "Wholesale & Trading Enterprise",
      subtitle: "Multi-tier distributors, stockists, and manufacturing units",
      icon: Factory,
      tag: "B2B & Distribution",
      color: "from-rose-500/20 to-pink-500/20 text-rose-400 border-rose-500/30",
      summary: "Handles high-volume trade debtors, credit terms, factory direct delivery, statutory TDS/TCS, and intra/inter-state tax splitting.",
      accounts: [
        {
          code: "1030",
          group: "Asset",
          groupCode: "A",
          ledger: "Current Assets & Receivables",
          subLedger: "Trade Debtors",
          label: "Regional Dealer & Distributor AR",
          isPostable: true,
          sampleUnit: 44,
          sampleValue: "₹18,50,000.00",
          description: "Receivables from 30-day dealer credit arrangements.",
        },
        {
          code: "2010",
          group: "Liability",
          groupCode: "L",
          ledger: "Current Liabilities & Payables",
          subLedger: "Trade Creditors",
          label: "Bulk Mill Supplier Accounts Payable",
          isPostable: true,
          sampleUnit: 16,
          sampleValue: "₹12,40,000.00",
          description: "Outstanding invoices for raw material deliveries.",
        },
        {
          code: "2080",
          group: "Liability",
          groupCode: "L",
          ledger: "Statutory & Tax Liabilities",
          subLedger: "Output GST Control",
          label: "Output CGST + SGST (Intrastate Trade)",
          isPostable: true,
          sampleUnit: 28,
          sampleValue: "₹1,66,500.00",
          description: "State tax liability auto-split at 9% + 9% on wholesale dispatches.",
        },
        {
          code: "4010",
          group: "Revenue",
          groupCode: "R",
          ledger: "Operating Revenue / Sales",
          subLedger: "Wholesale Trade Sales",
          label: "Bulk Finished Goods Sales",
          isPostable: true,
          sampleUnit: 32,
          sampleValue: "₹24,80,000.00",
          description: "Revenue earned on large commercial consignment sales.",
        },
        {
          code: "5010",
          group: "Expense",
          groupCode: "X",
          ledger: "Cost of Sales / Direct Delivery",
          subLedger: "Freight & Transport",
          label: "Inward & Outward Freight Charges",
          isPostable: true,
          sampleUnit: 21,
          sampleValue: "₹1,45,000.00",
          description: "Truck logistics and inter-state consignment transit insurance.",
        },
      ],
    },
  };

  const currentPreset = presets[selectedPreset];

  const filteredAccounts = currentPreset.accounts.filter(
    (acc) =>
      acc.label.toLowerCase().includes(filterQuery.toLowerCase()) ||
      acc.code.includes(filterQuery) ||
      acc.group.toLowerCase().includes(filterQuery.toLowerCase()) ||
      acc.subLedger.toLowerCase().includes(filterQuery.toLowerCase())
  );

  const getGroupBadgeColor = (groupCode: string) => {
    switch (groupCode) {
      case "A":
        return "bg-blue-500/10 text-blue-400 border-blue-500/30";
      case "L":
        return "bg-brand/10 text-brand-soft border-brand/30";
      case "E":
        return "bg-purple-500/10 text-purple-400 border-purple-500/30";
      case "R":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
      case "X":
        return "bg-rose-500/10 text-rose-400 border-rose-500/30";
      default:
        return "bg-zinc-800 text-zinc-300 border-zinc-700";
    }
  };

  return (
    <section id="alerx" className="py-24 bg-panel-deep border-b border-edge text-white relative overflow-hidden scroll-mt-16 font-sans">
      {/* Background Decorative Grid */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#5BB5BB10,transparent_60%)] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 space-y-16">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-panel px-4 py-1.5 text-xs font-mono font-bold text-brand-soft border border-edge shadow-sm">
            <Layers className="h-3.5 w-3.5 text-brand" />
            <span>The ALERX 4-Tier Foundation • Standard Indian GAAP</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-white leading-tight">
            Effortless Chart of Accounts (COA) for{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-soft via-brand to-brand-strong">
              Any Business Model
            </span>
          </h2>

          <p className="text-sm sm:text-base text-slate-400 leading-relaxed max-w-2xl mx-auto">
            Forget complex manual ledger setup. Deku Finance dynamically generates a verified 4-tier Chart of Accounts tailored to your exact industry in 1 click.
          </p>
        </div>

        {/* The 4-Tier Hierarchy Flow Banner */}
        <div className="bg-panel rounded-2xl border border-edge p-4 sm:p-6 shadow-xl">
          <div className="text-xs font-mono font-bold uppercase tracking-wider text-brand mb-3 flex items-center gap-2">
            <Database className="h-4 w-4 text-brand" />
            <span>Mathematical ALERX 4-Tier Architecture Enforced at Database Level</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-xs">
            <div className="bg-panel-deep p-3.5 rounded-xl border border-edge space-y-1">
              <span className="text-[10px] font-mono font-bold text-slate-500 uppercase">Tier 1: Group</span>
              <h4 className="font-bold text-white text-sm">ALERX Group</h4>
              <p className="text-[11px] text-slate-400">Assets, Liabilities, Equity, Revenue, Expense.</p>
            </div>

            <div className="bg-panel-deep p-3.5 rounded-xl border border-edge space-y-1">
              <span className="text-[10px] font-mono font-bold text-slate-500 uppercase">Tier 2: Major</span>
              <h4 className="font-bold text-white text-sm">Ledger Category</h4>
              <p className="text-[11px] text-slate-400">Liquid Capital, Receivables, Statutory Taxes.</p>
            </div>

            <div className="bg-panel-deep p-3.5 rounded-xl border border-edge space-y-1">
              <span className="text-[10px] font-mono font-bold text-slate-500 uppercase">Tier 3: Control</span>
              <h4 className="font-bold text-white text-sm">Sub-Ledger Bucket</h4>
              <p className="text-[11px] text-slate-400">Bank Accounts, Trade Debtors, Output GST.</p>
            </div>

            <div className="bg-panel-deep p-3.5 rounded-xl border border-brand/40 bg-brand/5 space-y-1">
              <span className="text-[10px] font-mono font-bold text-brand uppercase">Tier 4: Leaf Account</span>
              <h4 className="font-bold text-brand-soft text-sm">Transacting Label</h4>
              <p className="text-[11px] text-slate-400">HDFC Bank, Primary Customer, Server Hosting.</p>
            </div>

            <div className="bg-panel-deep p-3.5 rounded-xl border border-emerald-500/40 bg-emerald-500/5 space-y-1">
              <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase">State & Magnitude</span>
              <h4 className="font-bold text-emerald-300 text-sm">Units & INR Value</h4>
              <p className="text-[11px] text-slate-400">Count of vouchers (units) & Net INR balance.</p>
            </div>
          </div>
        </div>

        {/* Business Preset Switcher Tabs */}
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold text-white">
                Choose a Business Template to Preview
              </h3>
              <p className="text-xs text-zinc-400">
                Click a preset below to see how Deku Finance seeds your tailored Chart of Accounts:
              </p>
            </div>

            {/* Quick Search inside Preset */}
            <div className="w-full sm:w-64">
              <input
                type="text"
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                placeholder="Search accounts or code..."
                className="w-full px-3.5 py-2 rounded-xl bg-panel-deep border border-edge text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand transition-colors"
              />
            </div>
          </div>

          {/* 4 Preset Buttons */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {(Object.keys(presets) as BusinessPresetKey[]).map((key) => {
              const p = presets[key];
              const IconComp = p.icon;
              const isSelected = selectedPreset === key;

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedPreset(key)}
                  className={`p-4 rounded-2xl border text-left transition-all ${
                    isSelected
                      ? "bg-brand/15 border-brand ring-1 ring-brand shadow-lg"
                      : "bg-panel-deep/60 border-edge hover:border-slate-600 hover:bg-panel-deep"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div
                      className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                        isSelected ? "bg-brand text-ink font-bold" : "bg-panel text-slate-400"
                      }`}
                    >
                      <IconComp className="h-4 w-4" />
                    </div>
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                      {p.tag}
                    </span>
                  </div>
                  <h4 className="text-xs sm:text-sm font-bold text-white block">
                    {p.title}
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">
                    {p.subtitle}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Preset Summary Callout */}
          <div className="rounded-xl bg-panel border border-edge px-4 py-3 flex items-center justify-between text-xs text-slate-300">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-brand shrink-0" />
              <span>{currentPreset.summary}</span>
            </div>
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-mono text-emerald-400 font-bold">
              <CheckCircle2 className="h-3.5 w-3.5" />
              One-Click RPC Seeding Ready
            </span>
          </div>

          {/* Interactive Accounts Table */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/90 overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-950 text-zinc-400 font-bold uppercase tracking-wider text-[10px] border-b border-zinc-800">
                  <tr>
                    <th className="py-3.5 px-4">Code</th>
                    <th className="py-3.5 px-4">ALERX Group</th>
                    <th className="py-3.5 px-4">Ledger ➔ Sub-Ledger</th>
                    <th className="py-3.5 px-4">Transacting Leaf Label</th>
                    <th className="py-3.5 px-4 text-center">Posting Status</th>
                    <th className="py-3.5 px-4 text-right">Units (State Mutations)</th>
                    <th className="py-3.5 px-4 text-right">Magnitude (INR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 font-mono">
                  {filteredAccounts.length > 0 ? (
                    filteredAccounts.map((acc) => (
                      <tr key={acc.code} className="hover:bg-zinc-800/40 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-brand">
                          {acc.code}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${getGroupBadgeColor(
                              acc.groupCode
                            )}`}
                          >
                            <span>{acc.groupCode}</span>
                            <span>•</span>
                            <span className="font-sans">{acc.group}</span>
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-sans text-zinc-300">
                          <span className="text-zinc-400">{acc.ledger}</span>
                          <span className="mx-1 text-zinc-600">➔</span>
                          <span className="text-zinc-200 font-medium">{acc.subLedger}</span>
                        </td>
                        <td className="py-3.5 px-4 font-sans">
                          <div className="font-bold text-white">{acc.label}</div>
                          <div className="text-[11px] text-zinc-500 font-normal">
                            {acc.description}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-sans">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            Postable Label
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right text-zinc-300 font-mono">
                          {acc.sampleUnit} {acc.sampleUnit === 1 ? "unit" : "units"}
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-white font-mono">
                          {acc.sampleValue}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-zinc-500 font-sans">
                        No accounts matching &quot;{filterQuery}&quot; found in this template.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Bottom Enforced Integrity Note */}
            <div className="p-4 bg-panel-deep border-t border-edge text-xs text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-3 font-sans">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>
                  <strong>Postgres Guard Trigger Enforced</strong>: Double-entry transactions can strictly occur between postable leaf Labels. Root groups are immutable.
                </span>
              </div>
              <Link
                href="/signup"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-brand hover:text-brand-soft"
              >
                <span>Seed Your Business COA Now</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>

        {/* 3 Strategic Pillars of ALERX */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 font-sans">
          <div className="bg-panel border border-edge p-6 rounded-2xl space-y-3">
            <div className="h-10 w-10 rounded-xl bg-brand/15 text-brand flex items-center justify-center font-bold font-mono">
              1
            </div>
            <h4 className="text-base font-bold text-white">Instant GAAP Compliance</h4>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Eliminates the weeks-long headache of Chart of Accounts creation. Standard Indian GAAP numbering: Assets (1000s), Liabilities (2000s), Equity (3000s), Revenue (4000s), and Expenses (5000s).
            </p>
          </div>

          <div className="bg-zinc-900/60 border border-zinc-800 p-6 rounded-2xl space-y-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-400/10 text-emerald-400 flex items-center justify-center font-bold">
              2
            </div>
            <h4 className="text-base font-bold text-white">State Change Units Engine</h4>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Every journal line tracks both the financial rupee delta and the operational state-change unit count. Track exact business event frequencies alongside rupee balances.
            </p>
          </div>

          <div className="bg-zinc-900/60 border border-zinc-800 p-6 rounded-2xl space-y-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-400/10 text-indigo-400 flex items-center justify-center font-bold">
              3
            </div>
            <h4 className="text-base font-bold text-white">Live Automated Reporting</h4>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Because transactions post to verified Labels within the ALERX tree, your Profit & Loss, Balance Sheet, and Trial Balance compute live in real-time with zero manual reconciliation.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
