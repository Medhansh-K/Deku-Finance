"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/layouts/AppShell";
import {
  TrendingUp,
  Receipt,
  FileSpreadsheet,
  Layers,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  Building2,
  QrCode,
  DollarSign,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Sparkles,
  ArrowLeft,
  BookOpen,
  ChevronDown,
  AlertCircle,
  HelpCircle,
  SlidersHorizontal,
} from "lucide-react";
import { RecentlyAddedVouchers } from "@/modules/executive/RecentlyAddedVouchers";
import { organisationsApi, OrgSummary } from "@/api/endpoints";
import {
  getOrgTaxProfile,
  getDefaultTaxProfile,
  convertOrgToGst,
  validateGstin,
  OrgTaxProfile,
} from "@/lib/org-regime";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { CustomizeKpiModal } from "@/modules/executive/CustomizeKpiModal";
import { getKpiProfile, FormattedKpiProfile } from "@/lib/kpi/kpi-service";

interface ExecCompanyProfile {
  name: string;
  shortName: string;
  turnover: number;
  turnoverFormatted: string;
  profit: number;
  profitFormatted: string;
  margin: string;
  liquid: number;
  liquidFormatted: string;
  liquidBank: string;
  receivables: number;
  receivablesFormatted: string;
  debtorsCount: string;
  debtorsAging: string;
  payables: number;
  payablesFormatted: string;
  gstLiability: number;
  gstLiabilityFormatted: string;
  gstBreakdown: string;
  gstStatus: string;
  totalAssetsFormatted: string;
  totalLiabFormatted: string;
  totalEquityFormatted: string;
  equationText: string;
  sec22Badge: string;
  sec22Progress: string;
  sec22Sub: string;
}

const EXEC_PROFILES: Record<string, ExecCompanyProfile> = {
  // 1. Deku Financial Technologies
  "b127e064-5da8-437f-94c4-b8d6a0c12927": {
    name: "Deku Financial Technologies",
    shortName: "Deku",
    turnover: 1245000,
    turnoverFormatted: "₹12,45,000.00",
    profit: 825000,
    profitFormatted: "₹8,25,000.00",
    margin: "66.3%",
    liquid: 640000,
    liquidFormatted: "₹6,40,000.00",
    liquidBank: "HDFC Current + Cash",
    receivables: 260000,
    receivablesFormatted: "₹2,60,000.00",
    debtorsCount: "14 Active Clients",
    debtorsAging: "0 Overdue > 45d",
    payables: 115000,
    payablesFormatted: "₹1,15,000.00",
    gstLiability: 48600,
    gstLiabilityFormatted: "₹48,600.00",
    gstBreakdown: "Outward ₹92k − ITC ₹44k",
    gstStatus: "Due 20-Nov",
    totalAssetsFormatted: "₹9,00,000.00",
    totalLiabFormatted: "₹1,63,600.00",
    totalEquityFormatted: "₹7,36,400.00",
    equationText: "Assets (₹9.00L) = Liabilities (₹1.64L) + Equity (₹7.36L)",
    sec22Badge: "Sec 22 Safe",
    sec22Progress: "w-[31.1%]",
    sec22Sub: "31.1% of ₹40L limit",
  },
  // 2. All Might Logistics & Warehousing
  "b093d7d9-395a-429b-8c9a-af31b8b270f2": {
    name: "All Might Logistics & Warehousing",
    shortName: "All Might",
    turnover: 3870000,
    turnoverFormatted: "₹38,70,000.00",
    profit: 1420000,
    profitFormatted: "₹14,20,000.00",
    margin: "36.7%",
    liquid: 1180000,
    liquidFormatted: "₹11,80,000.00",
    liquidBank: "SBI Commercial + Cash",
    receivables: 845000,
    receivablesFormatted: "₹8,45,000.00",
    debtorsCount: "28 Active Clients",
    debtorsAging: "2 Overdue > 45d",
    payables: 590000,
    payablesFormatted: "₹5,90,000.00",
    gstLiability: 162400,
    gstLiabilityFormatted: "₹1,62,400.00",
    gstBreakdown: "Outward ₹4.20L − ITC ₹2.58L",
    gstStatus: "Due 20-Nov",
    totalAssetsFormatted: "₹20,25,000.00",
    totalLiabFormatted: "₹7,52,400.00",
    totalEquityFormatted: "₹12,72,600.00",
    equationText: "Assets (₹20.25L) = Liabilities (₹7.52L) + Equity (₹12.73L)",
    sec22Badge: "GST Due",
    sec22Progress: "w-[96.8%]",
    sec22Sub: "96.8% of ₹40L limit",
  },
  // 3. Endeavor Energy & Tech Solutions
  "8aec2336-5531-459e-baba-6a37128cffa2": {
    name: "Endeavor Energy & Tech Solutions",
    shortName: "Endeavor",
    turnover: 7250000,
    turnoverFormatted: "₹72,50,000.00",
    profit: 3180000,
    profitFormatted: "₹31,80,000.00",
    margin: "43.9%",
    liquid: 2415000,
    liquidFormatted: "₹24,15,000.00",
    liquidBank: "ICICI Corporate + Treasury",
    receivables: 1630000,
    receivablesFormatted: "₹16,30,000.00",
    debtorsCount: "42 Enterprise Clients",
    debtorsAging: "0 Overdue > 45d",
    payables: 980000,
    payablesFormatted: "₹9,80,000.00",
    gstLiability: 312000,
    gstLiabilityFormatted: "₹3,12,000.00",
    gstBreakdown: "Outward ₹8.50L − ITC ₹5.38L",
    gstStatus: "Advance Settled",
    totalAssetsFormatted: "₹40,45,000.00",
    totalLiabFormatted: "₹12,92,000.00",
    totalEquityFormatted: "₹27,53,000.00",
    equationText: "Assets (₹40.45L) = Liabilities (₹12.92L) + Equity (₹27.53L)",
    sec22Badge: "Corporate Active",
    sec22Progress: "w-[100%]",
    sec22Sub: "Corporate Turnover > ₹40L",
  },
};

function getExecProfile(orgId: string): ExecCompanyProfile {
  if (EXEC_PROFILES[orgId]) return EXEC_PROFILES[orgId];
  return EXEC_PROFILES["b127e064-5da8-437f-94c4-b8d6a0c12927"];
}

export default function ExecutiveDashboardPage() {
  const router = useRouter();

  const [activeOrgId, setActiveOrgId] = useState("");
  const [activeOrgName, setActiveOrgName] = useState("");
  const [taxProfile, setTaxProfile] = useState<OrgTaxProfile>(() =>
    getDefaultTaxProfile("")
  );

  // Conversion Modal State
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
  const [newGstin, setNewGstin] = useState("");
  const [convertError, setConvertError] = useState<string | null>(null);
  const [isConverting, setIsConverting] = useState(false);

  // KPI Customizer Modal State & Profile
  const [isKpiModalOpen, setIsKpiModalOpen] = useState(false);
  const [kpiProfile, setKpiProfile] = useState<FormattedKpiProfile>(() =>
    getKpiProfile("b127e064-5da8-437f-94c4-b8d6a0c12927", "Deku Financial Technologies")
  );

  const [orgList, setOrgList] = useState<OrgSummary[]>([]);

  // Synchronize active organization and tax profile from storage
  const syncFromStorage = () => {
    if (typeof window !== "undefined") {
      const savedId = localStorage.getItem("deku_active_org_id");
      const savedName = localStorage.getItem("deku_active_org_name");
      const targetId = savedId || activeOrgId;
      if (savedId) setActiveOrgId(savedId);
      if (savedName) setActiveOrgName(savedName);
      setTaxProfile(getOrgTaxProfile(targetId));
    }
  };

  useEffect(() => {
    syncFromStorage();

    const handleOrgChanged = () => syncFromStorage();
    const handleRegimeChanged = (e: any) => {
      if (e.detail?.orgId === activeOrgId) {
        setTaxProfile(e.detail.profile);
      }
    };
    const handleKpiChanged = () => {
      setKpiProfile(getKpiProfile(activeOrgId, activeOrgName));
    };

    window.addEventListener("deku_active_org_changed", handleOrgChanged);
    window.addEventListener("deku_org_regime_changed", handleRegimeChanged);
    window.addEventListener("deku_kpi_changed", handleKpiChanged);

    organisationsApi
      .list()
      .then((res) => {
        if (res.data && res.data.length > 0) {
          setOrgList(res.data);
        }
      })
      .catch(() => {});

    return () => {
      window.removeEventListener("deku_active_org_changed", handleOrgChanged);
      window.removeEventListener("deku_org_regime_changed", handleRegimeChanged);
      window.removeEventListener("deku_kpi_changed", handleKpiChanged);
    };
  }, [activeOrgId, activeOrgName]);

  // Keep kpiProfile in sync when active org changes
  useEffect(() => {
    setKpiProfile(getKpiProfile(activeOrgId, activeOrgName));
  }, [activeOrgId, activeOrgName]);

  const handleSwitchOrg = (orgId: string) => {
    const found = orgList.find((o) => o.id === orgId);
    if (!found) return;

    setActiveOrgId(found.id);
    setActiveOrgName(found.name);
    setTaxProfile(getOrgTaxProfile(found.id));

    if (typeof window !== "undefined") {
      localStorage.setItem("deku_active_org_id", found.id);
      localStorage.setItem("deku_active_org_name", found.name);
      window.dispatchEvent(new Event("deku_active_org_changed"));
    }
  };

  // Handle conversion of a Sec 22 organisation to GST Registered
  const handleConfirmGstConversion = (e: React.FormEvent) => {
    e.preventDefault();
    setConvertError(null);

    const validation = validateGstin(newGstin);
    if (!validation.isValid) {
      setConvertError(validation.error || "Invalid GSTIN format");
      return;
    }

    setIsConverting(true);
    try {
      const result = convertOrgToGst(activeOrgId, newGstin, activeOrgName);
      if (result.success && result.profile) {
        setTaxProfile(result.profile);
        setIsConvertModalOpen(false);
        setNewGstin("");
      } else {
        setConvertError(result.error || "Failed to convert organisation to GST");
      }
    } finally {
      setIsConverting(false);
    }
  };

  // Keyboard shortcut Esc to return to Gateway (unless modal is open)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isConvertModalOpen) return;
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT") {
        return;
      }
      if (e.key === "Escape") {
        router.push("/gateway");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router, isConvertModalOpen]);

  const baseProfile = getExecProfile(activeOrgId);
  const isSec22 = taxProfile.regime === "sec22";

  return (
    <AppShell>
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-[#F8FAFC] font-sans text-slate-900 space-y-6">
        {/* Top Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#CBD5E1] pb-4">
          <div className="flex items-center gap-3">
            <Link
              href="/gateway"
              className="p-2 rounded-xl bg-white border border-[#CBD5E1] hover:bg-slate-50 text-slate-700 hover:text-[#0A0A0A] transition-colors"
              title="Return to Gateway (Esc)"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-[#0A0A0A] tracking-tight">
                  Executive Financial Dashboard
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-800 border border-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Audited ({baseProfile.shortName})
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Authoritative overview of cash flow, receivables, operating margins &amp; statutory compliance
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Quick Company Selector (Tax Regime belongs to Organisation Entity) */}
            <div className="relative">
              <select
                id="executive-company-selector"
                value={activeOrgId}
                onChange={(e) => handleSwitchOrg(e.target.value)}
                className="bg-[#1F2324] text-white font-bold text-xs py-2 px-3 pr-8 rounded-xl border border-[#3E4848] focus:border-[#5BB5BB] focus:outline-none cursor-pointer appearance-none shadow-xs hover:border-[#5BB5BB] transition-colors"
                title="Select active company workspace"
              >
                {orgList.map((org) => (
                  <option key={org.id} value={org.id} className="bg-[#1F2324] text-white py-1">
                    🏢 {org.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="h-3.5 w-3.5 text-[#5BB5BB] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* ========================================================================= */}
            {/* Organisation-Level Tax Regime Status Indicator (Not an ad-hoc view toggle) */}
            {/* ========================================================================= */}
            <div suppressHydrationWarning>
              {isSec22 ? (
                <div className="flex items-center gap-2" suppressHydrationWarning>
                  <div
                    suppressHydrationWarning
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 border border-slate-300 text-xs font-bold text-slate-800 shadow-xs"
                    title="Section 22 CGST Act: Exempt from GST Registration (Turnover < ₹40L). Issues Native Bill of Supply."
                  >
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span>Sec 22 Exempt (Pure)</span>
                  </div>
                  <button
                    onClick={() => {
                      setConvertError(null);
                      setNewGstin("");
                      setIsConvertModalOpen(true);
                    }}
                    className="px-3 py-2 rounded-xl bg-white border border-[#5BB5BB] hover:bg-[#5BB5BB]/15 text-[#0A0A0A] font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                    title="A Sec 22 company can convert to GST registered once it gets a valid GST ID"
                  >
                    <ShieldCheck className="h-3.5 w-3.5 text-[#2D7A7A]" />
                    <span>Convert to GST</span>
                  </button>
                </div>
              ) : (
                <div
                  suppressHydrationWarning
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-50 border border-emerald-300 text-xs font-bold text-emerald-950 shadow-xs"
                  title="GST Registered entity. Under statutory law, a GST company cannot revert to Sec 22 and operates on the GST module."
                >
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <div className="flex items-center gap-1.5" suppressHydrationWarning>
                    <span>GST Registered</span>
                    {taxProfile.gstin && (
                      <span className="font-mono text-[11px] text-emerald-800 bg-white/80 px-2 py-0.5 rounded border border-emerald-200 font-bold">
                        {taxProfile.gstin}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-mono text-emerald-700 hidden lg:inline">
                    • GST Module Active
                  </span>
                </div>
              )}
            </div>

            <button
              onClick={() => setIsKpiModalOpen(true)}
              className="px-3 py-2 rounded-xl bg-white border border-[#3E4848] hover:border-[#5BB5BB] hover:bg-[#5BB5BB]/10 text-slate-800 font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              title="Change and customize listed KPI values and targets"
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-[#2D7A7A]" />
              <span>Customize KPIs</span>
            </button>

            <Link
              href="/gateway"
              className="px-3.5 py-2 rounded-xl bg-[#5BB5BB] hover:bg-[#91D7D2] text-[#0A0A0A] font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <span className="font-mono text-[10px]">Esc</span>
              <span>Gateway</span>
            </Link>
          </div>
        </div>

        {/* Top 5 Primary KPI Cards (Dynamically adjusted for Sec 22 vs GST Regime) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Card 1: Revenue & Turnover */}
          <Link
            href="/invoices"
            className="bg-white p-4 rounded-xl border border-[#CBD5E1] shadow-xs space-y-2 hover:border-[#5BB5BB] hover:shadow-md transition-all cursor-pointer block group"
            title="Open Sales Invoices Register & Billed Turnover Tracker"
          >
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-mono font-bold uppercase tracking-wider text-[10px] group-hover:text-slate-900 transition-colors">
                Gross Turnover
              </span>
              <span className="h-6 w-6 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold group-hover:bg-[#5BB5BB] group-hover:text-[#0A0A0A] transition-colors">
                <ArrowUpRight className="h-3.5 w-3.5" />
              </span>
            </div>
            <div className="text-xl font-black font-mono text-[#0A0A0A] group-hover:text-[#2D7A7A] transition-colors">
              {kpiProfile.turnover}
            </div>

            {isSec22 ? (
              <div className="space-y-1">
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                  <div className={`bg-[#5BB5BB] h-full rounded-full ${kpiProfile.sec22Progress}`} />
                </div>
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>{kpiProfile.sec22Sub}</span>
                  <span className="text-emerald-700 font-bold">{kpiProfile.sec22Badge}</span>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full rounded-full w-full" />
                </div>
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>Regular GST Taxpayer</span>
                  <span className="text-emerald-700 font-bold">GSTIN Active</span>
                </div>
              </div>
            )}
          </Link>

          {/* Card 2: Net Profit */}
          <Link
            href="/reports/profit-loss"
            className="bg-white p-4 rounded-xl border border-[#CBD5E1] shadow-xs space-y-2 hover:border-[#5BB5BB] hover:shadow-md transition-all cursor-pointer block group"
            title="Open Profit & Loss Account (L)"
          >
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-mono font-bold uppercase tracking-wider text-[10px] group-hover:text-slate-900 transition-colors">
                Net Profit (EBITDA)
              </span>
              <span className="h-6 w-6 rounded-lg bg-[#5BB5BB]/15 text-[#2D7A7A] flex items-center justify-center font-bold group-hover:bg-[#5BB5BB] group-hover:text-[#0A0A0A] transition-colors">
                <TrendingUp className="h-3.5 w-3.5" />
              </span>
            </div>
            <div className="text-xl font-black font-mono text-emerald-700 group-hover:text-emerald-600 transition-colors">
              {kpiProfile.profit}
            </div>
            <div className="text-[11px] font-mono text-slate-500 flex items-center justify-between">
              <span>Operating Margin:</span>
              <span className="font-bold text-slate-900">{kpiProfile.margin}</span>
            </div>
          </Link>

          {/* Card 3: Liquid Bank & Cash */}
          <Link
            href="/masters/chart-of-accounts?group=asset&filter=liquid"
            className="bg-white p-4 rounded-xl border border-[#CBD5E1] shadow-xs space-y-2 hover:border-[#5BB5BB] hover:shadow-md transition-all cursor-pointer block group"
            title="Open Chart of Accounts: Liquid Cash & Bank Asset Units and Values"
          >
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-mono font-bold uppercase tracking-wider text-[10px] group-hover:text-slate-900 transition-colors">
                Liquid Cash &amp; Bank
              </span>
              <span className="h-6 w-6 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-bold group-hover:bg-[#5BB5BB] group-hover:text-[#0A0A0A] transition-colors">
                <DollarSign className="h-3.5 w-3.5" />
              </span>
            </div>
            <div className="text-xl font-black font-mono text-[#0A0A0A] group-hover:text-[#2D7A7A] transition-colors">
              {kpiProfile.liquid}
            </div>
            <div className="text-[11px] font-mono text-slate-500 flex items-center justify-between">
              <span>{kpiProfile.liquidBank}</span>
              <span className="text-emerald-700 font-bold">Instant Liquidity</span>
            </div>
          </Link>

          {/* Card 4: Accounts Receivable */}
          <Link
            href="/reports/debtors"
            className="bg-white p-4 rounded-xl border border-[#CBD5E1] shadow-xs space-y-2 hover:border-[#5BB5BB] hover:shadow-md transition-all cursor-pointer block group"
            title="Open Trade Debtors (AR) DSO Analysis & Customer Invoices"
          >
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-mono font-bold uppercase tracking-wider text-[10px] group-hover:text-slate-900 transition-colors">
                Trade Debtors
              </span>
              <span className="h-6 w-6 rounded-lg bg-amber-50 text-amber-800 flex items-center justify-center font-bold group-hover:bg-[#5BB5BB] group-hover:text-[#0A0A0A] transition-colors">
                <Receipt className="h-3.5 w-3.5" />
              </span>
            </div>
            <div className="text-xl font-black font-mono text-[#0A0A0A] group-hover:text-[#2D7A7A] transition-colors">
              {kpiProfile.debtors}
            </div>
            <div className="text-[11px] font-mono text-slate-500 flex items-center justify-between">
              <span>{kpiProfile.debtorsCount}</span>
              <span className="text-emerald-700 font-bold">{kpiProfile.debtorsAging}</span>
            </div>
          </Link>

          {/* Card 5: Statutory & GST (Dynamic Sec 22 Exempt vs GST Registered) */}
          <Link
            href="/gst"
            className="bg-white p-4 rounded-xl border border-[#CBD5E1] shadow-xs space-y-2 hover:border-[#5BB5BB] hover:shadow-md transition-all cursor-pointer block group"
            title={isSec22 ? "Section 22 Exemption Hub" : "Open GST Returns & Tax Engine Hub (G)"}
          >
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-mono font-bold uppercase tracking-wider text-[10px] group-hover:text-slate-900 transition-colors">
                {isSec22 ? "Statutory Status" : "GST Net Liability"}
              </span>
              <span
                className={`h-6 w-6 rounded-lg flex items-center justify-center font-bold transition-colors ${
                  isSec22
                    ? "bg-emerald-50 text-emerald-700 group-hover:bg-[#5BB5BB] group-hover:text-[#0A0A0A]"
                    : "bg-rose-50 text-rose-700 group-hover:bg-[#5BB5BB] group-hover:text-[#0A0A0A]"
                }`}
              >
                <ShieldCheck className="h-3.5 w-3.5" />
              </span>
            </div>
            <div
              className={`text-xl font-black font-mono transition-colors ${
                isSec22
                  ? "text-emerald-700 group-hover:text-emerald-600"
                  : "text-rose-700 group-hover:text-rose-600"
              }`}
            >
              {isSec22 ? "₹0.00 (Exempt)" : kpiProfile.gst}
            </div>
            <div className="text-[11px] font-mono text-slate-500 flex items-center justify-between">
              <span>{isSec22 ? "Exempt under § 22" : kpiProfile.gstBreakdown}</span>
              <span className="text-slate-800 font-bold">
                {isSec22 ? "Bill of Supply" : kpiProfile.gstStatus}
              </span>
            </div>
          </Link>
        </div>

        {/* 2-Column Analytical Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Financial Statement Health & ALERX Parity (7 cols) */}
          <div className="lg:col-span-7 bg-white border border-[#CBD5E1] rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-[#5BB5BB]" />
                <h2 className="text-sm font-bold text-[#0A0A0A]">
                  ALERX Double-Entry Balance Health
                </h2>
              </div>
              <span className="text-[11px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-300 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Mathematical Equilibrium OK
              </span>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-[10px] text-slate-500 uppercase font-mono block">Total Assets (A)</span>
                  <span className="text-sm font-black font-mono text-slate-900">{baseProfile.totalAssetsFormatted}</span>
                  <span className="text-[10px] text-emerald-700 block mt-0.5 font-mono">Bank + Debtors</span>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-[10px] text-slate-500 uppercase font-mono block">Total Liabilities (L)</span>
                  <span className="text-sm font-black font-mono text-slate-900">{baseProfile.totalLiabFormatted}</span>
                  <span className="text-[10px] text-slate-500 block mt-0.5 font-mono">
                    {isSec22 ? "Creditors (Nil GST)" : "Creditors + GST"}
                  </span>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-[10px] text-slate-500 uppercase font-mono block">Owner Equity (E)</span>
                  <span className="text-sm font-black font-mono text-slate-900">{baseProfile.totalEquityFormatted}</span>
                  <span className="text-[10px] text-slate-500 block mt-0.5 font-mono">Retained + Capital</span>
                </div>
              </div>

              <div className="p-3.5 bg-[#F8FAFC] rounded-lg border border-slate-200 flex items-center justify-between text-xs font-mono">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
                  <span className="text-slate-700">Accounting Parity Equation:</span>
                </div>
                <span className="font-bold text-[#0A0A0A]">
                  {baseProfile.equationText}
                </span>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100">
              <span className="font-mono text-[11px]">Database View: view_ledger_balances</span>
              <div className="flex items-center gap-3">
                <Link
                  href="/reports/balance-sheet"
                  className="font-bold text-[#2D7A7A] hover:text-[#5BB5BB] transition-colors"
                >
                  Balance Sheet ➔
                </Link>
                <Link
                  href="/reports/trial-balance"
                  className="font-bold text-[#2D7A7A] hover:text-[#5BB5BB] transition-colors"
                >
                  Trial Balance ➔
                </Link>
              </div>
            </div>
          </div>

          {/* Right: Quick Action Hub & Navigation (5 cols) */}
          <div className="lg:col-span-5 bg-white border border-[#CBD5E1] rounded-xl p-5 shadow-xs flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[#5BB5BB]" />
                  <h2 className="text-sm font-bold text-[#0A0A0A]">
                    Accounting Workflow Shortcuts
                  </h2>
                </div>
                <span className="text-[10px] font-mono text-slate-400">Desktop First</span>
              </div>

              <div className="grid grid-cols-2 gap-2.5 pt-3">
                <Link
                  href="/vouchers/payment"
                  className="p-3 rounded-lg bg-slate-50 hover:bg-[#5BB5BB]/10 border border-slate-200 hover:border-[#5BB5BB] transition-all text-left"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">Payment</span>
                    <kbd className="text-[10px] font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-slate-300">F5</kbd>
                  </div>
                  <span className="text-[11px] text-slate-500 mt-1 block">Record vendor payouts</span>
                </Link>

                <Link
                  href="/vouchers/receipt"
                  className="p-3 rounded-lg bg-slate-50 hover:bg-[#5BB5BB]/10 border border-slate-200 hover:border-[#5BB5BB] transition-all text-left"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">Receipt</span>
                    <kbd className="text-[10px] font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-slate-300">F6</kbd>
                  </div>
                  <span className="text-[11px] text-slate-500 mt-1 block">Customer collections</span>
                </Link>

                <Link
                  href="/vouchers/sales"
                  className="p-3 rounded-lg bg-slate-50 hover:bg-[#5BB5BB]/10 border border-slate-200 hover:border-[#5BB5BB] transition-all text-left"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">
                      {isSec22 ? "Bill of Supply" : "Sales Invoice"}
                    </span>
                    <kbd className="text-[10px] font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-slate-300">F8</kbd>
                  </div>
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    {isSec22 ? "Sec 22 Nil GST" : "Tax Invoice (GST)"}
                  </span>
                </Link>

                <Link
                  href="/day-book"
                  className="p-3 rounded-lg bg-slate-50 hover:bg-[#5BB5BB]/10 border border-slate-200 hover:border-[#5BB5BB] transition-all text-left"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">Day Book</span>
                    <kbd className="text-[10px] font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-slate-300">D</kbd>
                  </div>
                  <span className="text-[11px] text-slate-500 mt-1 block">Chronological register</span>
                </Link>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500">Return to Gateway menu anytime:</span>
              <Link
                href="/gateway"
                className="font-bold text-[#1F2324] hover:text-[#5BB5BB] flex items-center gap-1"
              >
                <span>Gateway of Deku</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* Section 4: Authoritative Day Book View (Chronological Daily Register)     */}
        {/* ========================================================================= */}
        <RecentlyAddedVouchers
          activeOrgId={activeOrgId}
          activeOrgName={activeOrgName}
          activeRegime={taxProfile.regime}
          activeGstin={taxProfile.gstin}
        />
      </div>

      {/* Convert Sec 22 Organisation to GST Registered Modal */}
      <Modal
        isOpen={isConvertModalOpen}
        onClose={() => setIsConvertModalOpen(false)}
        title="Convert Organisation to GST Regime"
        description={`Assign valid GSTIN to unlock GST Module for ${activeOrgName}`}
        maxWidth="lg"
      >
        <form onSubmit={handleConfirmGstConversion} className="space-y-4 font-sans text-xs">
          {/* Statutory Irreversibility Alert */}
          <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-300 text-amber-900 space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-xs text-amber-950">
              <AlertCircle className="h-4 w-4 text-amber-700 shrink-0" />
              <span>Statutory Compliance Notice (Permanent GST Status)</span>
            </div>
            <p className="text-[11px] leading-relaxed text-amber-800">
              Under GST rules, once an organisation obtains a valid GST identification number (GSTIN) and converts to the GST regime, this status is <strong>permanent at the organisation level</strong>. The company will operate permanently on the full GST module (calculating CGST/SGST/IGST, filing GSTR-1 &amp; GSTR-3B, and maintaining ITC records). <strong>A GST registered company cannot revert to Sec 22 exemption.</strong>
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-slate-700 font-bold mb-1">
                Organisation Legal Entity
              </label>
              <input
                type="text"
                value={activeOrgName}
                disabled
                className="w-full bg-slate-100 border border-slate-300 rounded-lg py-2 px-3 text-xs text-slate-600 cursor-not-allowed font-medium"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">
                Valid 15-Digit GSTIN <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={newGstin}
                onChange={(e) => {
                  setNewGstin(e.target.value.toUpperCase());
                  setConvertError(null);
                }}
                placeholder="e.g. 27AAACD1234E1Z5"
                maxLength={15}
                required
                className="w-full bg-white border border-slate-300 rounded-lg py-2 px-3 text-xs font-mono font-bold tracking-wider placeholder:text-slate-400 focus:outline-none focus:border-[#5BB5BB] focus:ring-1 focus:ring-[#5BB5BB]"
              />
              <span className="text-[10px] text-slate-400 font-mono mt-1 block">
                Format: 2 state digits + 10-char PAN + 1 entity num + 'Z' + check digit
              </span>
            </div>

            {convertError && (
              <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-300 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{convertError}</span>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setIsConvertModalOpen(false)}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isConverting}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
            >
              <ShieldCheck className="h-4 w-4" />
              <span>{isConverting ? "Validating & Converting..." : "Confirm & Activate GST Module"}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Customize Financial KPIs Modal */}
      <CustomizeKpiModal
        isOpen={isKpiModalOpen}
        onClose={() => setIsKpiModalOpen(false)}
        activeOrgId={activeOrgId}
        activeOrgName={activeOrgName}
        onSaved={() => setKpiProfile(getKpiProfile(activeOrgId, activeOrgName))}
      />
    </AppShell>
  );
}
