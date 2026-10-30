"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  Layers,
  TrendingUp,
  Activity,
  ChevronDown,
  ArrowUpRight,
  ArrowRight,
  Sparkles,
  BookOpen,
  Users,
  Package,
  Receipt,
  Calendar,
  FileText,
  BarChart3,
  Scale,
  ArrowUpDown,
  PieChart,
  ShieldCheck,
  Settings,
  History,
  Users2,
} from "lucide-react";
import { organisationsApi, accountingApi, OrgSummary } from "@/api/endpoints";
import {
  getKpiProfile,
  FormattedKpiProfile,
} from "@/lib/kpi/kpi-service";

export function GatewayLanding() {
  const router = useRouter();

  const [orgList, setOrgList] = useState<OrgSummary[]>([
    {
      id: "b127e064-5da8-437f-94c4-b8d6a0c12927",
      name: "Deku Financial Technologies",
      slug: "deku-org-9601",
      gstin: "27AAACD1234E1Z5",
      currency: "INR",
      timezone: "Asia/Kolkata",
      financial_year_start_month: 4,
    },
    {
      id: "b093d7d9-395a-429b-8c9a-af31b8b270f2",
      name: "All Might Logistics & Warehousing",
      slug: "all-might-logistics",
      gstin: "27AABCA5678B1Z2",
      currency: "INR",
      timezone: "Asia/Kolkata",
      financial_year_start_month: 4,
    },
    {
      id: "8aec2336-5531-459e-baba-6a37128cffa2",
      name: "Endeavor Energy & Tech Solutions",
      slug: "endeavor-energy",
      gstin: "27AAECE9988C1Z8",
      currency: "INR",
      timezone: "Asia/Kolkata",
      financial_year_start_month: 4,
    },
  ]);

  const [activeOrg, setActiveOrg] = useState({
    id: "b127e064-5da8-437f-94c4-b8d6a0c12927",
    name: "Deku Financial Technologies",
    slug: "deku-org-9601",
    gstin: "27AAACD1234E1Z5",
    currency: "INR",
  });

  const [lastEntryDate, setLastEntryDate] = useState<string>("20-Oct-2026");
  const [profile, setProfile] = useState<FormattedKpiProfile>(() =>
    getKpiProfile(activeOrg.id, activeOrg.name)
  );

  // Sync profile when activeOrg changes or KPI event fires
  useEffect(() => {
    setProfile(getKpiProfile(activeOrg.id, activeOrg.name));
  }, [activeOrg.id, activeOrg.name]);

  useEffect(() => {
    const handleKpiChanged = () => {
      setProfile(getKpiProfile(activeOrg.id, activeOrg.name));
    };
    window.addEventListener("deku_kpi_changed", handleKpiChanged);
    return () => window.removeEventListener("deku_kpi_changed", handleKpiChanged);
  }, [activeOrg.id, activeOrg.name]);

  // Load all organisations from PostgreSQL backend
  const loadOrganisations = async () => {
    try {
      const res = await organisationsApi.list();
      if (res.data && res.data.length > 0) {
        setOrgList(res.data);
      }
    } catch {
      // Keep verified defaults
    }
  };

  useEffect(() => {
    loadOrganisations();

    // Check local storage for active org override
    if (typeof window !== "undefined") {
      const savedId = localStorage.getItem("deku_active_org_id");
      const savedName = localStorage.getItem("deku_active_org_name");
      if (savedId) {
        organisationsApi
          .get(savedId)
          .then((res) => {
            if (res.data && res.data.length > 0) {
              const org = res.data[0];
              setActiveOrg({
                id: org.id,
                name: org.name,
                slug: org.slug,
                gstin: org.gstin || "27AAACD1234E1Z5",
                currency: org.currency || "INR",
              });
            } else if (savedName) {
              setActiveOrg((prev) => ({
                ...prev,
                id: savedId,
                name: savedName,
              }));
            }
          })
          .catch(() => {});
      }
    }
  }, []);

  // Fetch journals and last entry date when active company changes
  useEffect(() => {
    accountingApi
      .listJournals(activeOrg.id)
      .then((res) => {
        if (res.data && res.data.length > 0) {
          const latest = res.data[0];
          setLastEntryDate(latest.entry_date);
        } else {
          const prof = getKpiProfile(activeOrg.id, activeOrg.name);
          setLastEntryDate(prof.lastEntry);
        }
      })
      .catch(() => {
        const prof = getKpiProfile(activeOrg.id, activeOrg.name);
        setLastEntryDate(prof.lastEntry);
      });
  }, [activeOrg.id, activeOrg.name]);

  // Handle switching company
  const handleSwitchCompany = (org: OrgSummary | { id: string; name: string; gstin?: string | null; currency?: string; slug?: string }) => {
    setActiveOrg({
      id: org.id,
      name: org.name,
      slug: org.slug || org.name.toLowerCase().replace(/[^a-z0-9]/g, "-"),
      gstin: org.gstin || "27AAACD1234E1Z5",
      currency: org.currency || "INR",
    });

    if (typeof window !== "undefined") {
      localStorage.setItem("deku_active_org_id", org.id);
      localStorage.setItem("deku_active_org_name", org.name);
      window.dispatchEvent(new Event("deku_active_org_changed"));
    }
  };

  // Keyboard shortcut handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        e.ctrlKey ||
        e.altKey ||
        e.metaKey
      ) {
        return;
      }

      const key = e.key.toUpperCase();
      switch (key) {
        case "E":
          router.push("/consultant");
          break;
        case "A":
          router.push("/masters/chart-of-accounts");
          break;
        case "P":
          router.push("/masters/parties");
          break;
        case "I":
          router.push("/masters/products-services");
          break;
        case "V":
          router.push("/vouchers");
          break;
        case "D":
          router.push("/day-book");
          break;
        case "B":
          if (e.shiftKey) {
            router.push("/builder");
          } else {
            router.push("/reports/balance-sheet");
          }
          break;
        case "O":
          router.push("/reports/profit-loss");
          break;
        case "L":
          router.push("/audit");
          break;
        case "T":
          router.push("/reports/trial-balance");
          break;
        case "C":
          router.push("/reports/cash-flow");
          break;
        case "F":
          router.push("/reports/fpa");
          break;
        case "K":
          router.push("/consultant");
          break;
        case "G":
          router.push("/gst");
          break;
        case "M":
          router.push("/departments-members");
          break;
        case "S":
          router.push("/settings");
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router]);

  const companyShortName = activeOrg.name.startsWith("All Might")
    ? "All Might"
    : activeOrg.name.startsWith("Endeavor")
    ? "Endeavor"
    : activeOrg.name.startsWith("Deku")
    ? "Deku"
    : activeOrg.name.split(" ")[0];

  return (
    <div className="w-full flex-1 flex flex-col justify-start items-center p-3 lg:px-5 lg:py-3.5 bg-[#F8FAFC] dark:bg-[#101820] font-sans transition-colors duration-200">
      <div className="w-full max-w-[1400px] flex flex-col lg:flex-row gap-3.5 items-stretch">
        
        {/* ========================================================================= */}
        {/* Column 1 (Left): Company Identity & Status Panel                         */}
        {/* ========================================================================= */}
        <div className="w-full lg:w-[280px] xl:w-[290px] shrink-0 bg-white dark:bg-[#162521] border border-[#E2E8F0] dark:border-[#3C474B] rounded-xl p-3.5 shadow-xs flex flex-col justify-between transition-colors">
          <div className="space-y-3">
            
            {/* Header: Active Workspace Status */}
            <div className="flex items-center justify-between pb-2.5 border-b border-[#E2E8F0] dark:border-[#3C474B]">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold tracking-wider text-slate-500 dark:text-slate-400 uppercase">
                  Active Workspace
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.2 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live
                </span>
              </div>
              <Link
                href="/companies"
                className="text-[11px] font-medium text-[#4F7CAC] dark:text-[#9EEFE5] hover:underline transition-colors flex items-center gap-1"
                title="Manage and switch companies (F3)"
              >
                <span>Shift</span>
                <kbd className="font-mono text-[9px] bg-slate-100 dark:bg-[#202D35] text-slate-600 dark:text-slate-300 px-1 py-0.2 rounded border border-slate-200 dark:border-[#3C474B]">
                  F3
                </kbd>
              </Link>
            </div>

            {/* Company Identity */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-[#4F7CAC]/15 dark:bg-[#4F7CAC]/25 text-[#4F7CAC] dark:text-[#9EEFE5] flex items-center justify-center shrink-0">
                  <Building2 className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {activeOrg.name}
                  </h2>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate">
                    GSTIN · <span className="text-slate-700 dark:text-slate-300 font-medium">{activeOrg.gstin}</span>
                  </p>
                </div>
              </div>

              {/* Company Switcher Select */}
              <div className="relative">
                <select
                  id="company-shift-select"
                  value={activeOrg.id}
                  onChange={(e) => {
                    const chosen = orgList.find((o) => o.id === e.target.value);
                    if (chosen) handleSwitchCompany(chosen);
                  }}
                  className="w-full bg-slate-50 dark:bg-[#202D35] text-slate-800 dark:text-slate-200 text-xs font-medium py-1 px-2 pr-7 rounded-md border border-slate-300 dark:border-[#3C474B] focus:outline-none focus:border-[#4F7CAC] cursor-pointer appearance-none transition-colors"
                  title="Switch workspace"
                >
                  {orgList.map((org) => (
                    <option key={org.id} value={org.id} className="bg-white dark:bg-[#162521] text-slate-900 dark:text-white">
                      {org.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="h-3.5 w-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Technical Metadata Rows */}
            <div className="divide-y divide-slate-100 dark:divide-[#3C474B]/40 text-xs pt-1">
              <div className="py-1.5 flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400 text-[11px]">Financial Year</span>
                <span className="font-mono font-medium text-slate-900 dark:text-slate-200 text-xs">2026–27</span>
              </div>
              <div className="py-1.5 flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400 text-[11px]">Accounting Engine</span>
                <span className="text-slate-800 dark:text-slate-200 font-medium text-xs">ALERX Double Entry</span>
              </div>
              <div className="py-1.5 flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400 text-[11px]">Last Entry Recorded</span>
                <span className="font-mono text-slate-700 dark:text-slate-300 text-xs">{lastEntryDate}</span>
              </div>
              <div className="py-1.5 flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400 text-[11px]">Authoritative Ledger</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-medium text-xs flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  PostgreSQL Active
                </span>
              </div>
            </div>

          </div>

          <div className="pt-2 mt-2 border-t border-[#E2E8F0] dark:border-[#3C474B] text-[10px] text-slate-400 dark:text-slate-500">
            Press <strong className="text-slate-600 dark:text-slate-300">F3</strong> to switch company entities.
          </div>
        </div>

        {/* ========================================================================= */}
        {/* Columns 2 & 3: Perfectly Matched Size (Equal 50/50 Width & Stretched Height)*/}
        {/* ========================================================================= */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-3.5 items-stretch">
          
          {/* ======================================================================= */}
          {/* Column 2: Gateway Workspace Panel                                      */}
          {/* ======================================================================= */}
          <div className="bg-white dark:bg-[#162521] border border-[#E2E8F0] dark:border-[#3C474B] rounded-xl shadow-xs overflow-hidden flex flex-col justify-between h-full transition-colors">
            <div>
              {/* Header */}
              <div className="px-3.5 py-2.5 border-b border-[#E2E8F0] dark:border-[#3C474B] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-[#4F7CAC] dark:text-[#9EEFE5]" />
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-900 dark:text-slate-100">
                    Gateway of Deku
                  </h2>
                </div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate max-w-[180px]">
                  {companyShortName} Workspace
                </span>
              </div>

              {/* Navigation Body */}
              <div className="p-3 space-y-2.5 text-xs">
                
                {/* Executive Highlight */}
                <Link
                  href="/consultant"
                  className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-[#202D35] border border-slate-200/80 dark:border-[#3C474B] hover:border-[#4F7CAC] dark:hover:border-[#4F7CAC] transition-colors group"
                  title="Launch Deku Konsultant Executive Dashboard (K or E)"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-6 w-6 rounded-md bg-[#4F7CAC]/15 dark:bg-[#4F7CAC]/25 text-[#4F7CAC] dark:text-[#9EEFE5] flex items-center justify-center shrink-0">
                      <Sparkles className="h-3.5 w-3.5" />
                    </div>
                    <div className="truncate">
                      <span className="font-semibold text-slate-900 dark:text-white group-hover:text-[#4F7CAC] dark:group-hover:text-[#9EEFE5] transition-colors text-xs block truncate">
                        Deku Konsultant (AI CFO)
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block truncate">
                        Real-time ledger intelligence
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <kbd className="font-mono text-[9px] font-semibold bg-white dark:bg-[#162521] text-slate-700 dark:text-slate-300 px-1 py-0.2 rounded border border-slate-200 dark:border-[#3C474B]">
                      K
                    </kbd>
                    <kbd className="font-mono text-[9px] font-semibold bg-white dark:bg-[#162521] text-slate-700 dark:text-slate-300 px-1 py-0.2 rounded border border-slate-200 dark:border-[#3C474B]">
                      E
                    </kbd>
                  </div>
                </Link>

                {/* Masters */}
                <div>
                  <h3 className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 px-1.5 mb-1 uppercase tracking-wider">
                    Masters
                  </h3>
                  <div className="space-y-0.5">
                    <Link
                      href="/masters/chart-of-accounts"
                      className="flex items-center justify-between px-2 py-1 rounded hover:bg-slate-50 dark:hover:bg-[#202D35] text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <BookOpen className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                        <span className="truncate">Chart of Accounts (ALERX Ledgers)</span>
                      </div>
                      <kbd className="font-mono text-[9px] text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-[#202D35] px-1 py-0.2 rounded border border-slate-200 dark:border-[#3C474B] shrink-0">
                        A
                      </kbd>
                    </Link>
                    <Link
                      href="/masters/parties"
                      className="flex items-center justify-between px-2 py-1 rounded hover:bg-slate-50 dark:hover:bg-[#202D35] text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Users className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                        <span className="truncate">Parties (Customers &amp; Vendors)</span>
                      </div>
                      <kbd className="font-mono text-[9px] text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-[#202D35] px-1 py-0.2 rounded border border-slate-200 dark:border-[#3C474B] shrink-0">
                        P
                      </kbd>
                    </Link>
                    <Link
                      href="/masters/products-services"
                      className="flex items-center justify-between px-2 py-1 rounded hover:bg-slate-50 dark:hover:bg-[#202D35] text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Package className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                        <span className="truncate">Stock &amp; Services Items</span>
                      </div>
                      <kbd className="font-mono text-[9px] text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-[#202D35] px-1 py-0.2 rounded border border-slate-200 dark:border-[#3C474B] shrink-0">
                        I
                      </kbd>
                    </Link>
                  </div>
                </div>

                {/* Transactions */}
                <div>
                  <h3 className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 px-1.5 mb-1 uppercase tracking-wider">
                    Transactions &amp; Registers
                  </h3>
                  <div className="space-y-0.5">
                    <Link
                      href="/vouchers"
                      className="flex items-center justify-between px-2 py-1 rounded hover:bg-slate-50 dark:hover:bg-[#202D35] text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Receipt className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                        <span className="truncate">Accounting Vouchers (F4–F9)</span>
                      </div>
                      <kbd className="font-mono text-[9px] font-semibold text-white bg-[#4F7CAC] px-1.5 py-0.2 rounded shrink-0">
                        V
                      </kbd>
                    </Link>
                    <Link
                      href="/day-book"
                      className="flex items-center justify-between px-2 py-1 rounded hover:bg-slate-50 dark:hover:bg-[#202D35] text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Calendar className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                        <span className="truncate">Day Book (Chronological Register)</span>
                      </div>
                      <kbd className="font-mono text-[9px] text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-[#202D35] px-1 py-0.2 rounded border border-slate-200 dark:border-[#3C474B] shrink-0">
                        D
                      </kbd>
                    </Link>
                    <Link
                      href="/builder"
                      className="flex items-center justify-between px-2 py-1 rounded hover:bg-slate-50 dark:hover:bg-[#202D35] text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <FileText className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                        <span className="truncate">Builder (Docs, Quotes &amp; Coupons)</span>
                      </div>
                      <kbd className="font-mono text-[9px] text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-[#202D35] px-1 py-0.2 rounded border border-slate-200 dark:border-[#3C474B] shrink-0">
                        Shift+B
                      </kbd>
                    </Link>
                  </div>
                </div>

                {/* Financial Reports */}
                <div>
                  <h3 className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 px-1.5 mb-1 uppercase tracking-wider">
                    Financial Reports
                  </h3>
                  <div className="space-y-0.5">
                    <Link
                      href="/reports/balance-sheet"
                      className="flex items-center justify-between px-2 py-1 rounded hover:bg-slate-50 dark:hover:bg-[#202D35] text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Scale className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                        <span className="truncate">Balance Sheet</span>
                      </div>
                      <kbd className="font-mono text-[9px] text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-[#202D35] px-1 py-0.2 rounded border border-slate-200 dark:border-[#3C474B] shrink-0">
                        B
                      </kbd>
                    </Link>
                    <Link
                      href="/reports/profit-loss"
                      className="flex items-center justify-between px-2 py-1 rounded hover:bg-slate-50 dark:hover:bg-[#202D35] text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <TrendingUp className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                        <span className="truncate">Profit &amp; Loss A/c</span>
                      </div>
                      <kbd className="font-mono text-[9px] text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-[#202D35] px-1 py-0.2 rounded border border-slate-200 dark:border-[#3C474B] shrink-0">
                        O
                      </kbd>
                    </Link>
                    <Link
                      href="/reports/trial-balance"
                      className="flex items-center justify-between px-2 py-1 rounded hover:bg-slate-50 dark:hover:bg-[#202D35] text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <BarChart3 className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                        <span className="truncate">Trial Balance</span>
                      </div>
                      <kbd className="font-mono text-[9px] text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-[#202D35] px-1 py-0.2 rounded border border-slate-200 dark:border-[#3C474B] shrink-0">
                        T
                      </kbd>
                    </Link>
                    <Link
                      href="/reports/cash-flow"
                      className="flex items-center justify-between px-2 py-1 rounded hover:bg-slate-50 dark:hover:bg-[#202D35] text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <ArrowUpDown className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                        <span className="truncate">Cash Flow (WCM)</span>
                      </div>
                      <kbd className="font-mono text-[9px] text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-[#202D35] px-1 py-0.2 rounded border border-slate-200 dark:border-[#3C474B] shrink-0">
                        C
                      </kbd>
                    </Link>
                    <Link
                      href="/reports/fpa"
                      className="flex items-center justify-between px-2 py-1 rounded hover:bg-slate-50 dark:hover:bg-[#202D35] text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <PieChart className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                        <span className="truncate">FP&amp;A Intelligence</span>
                      </div>
                      <kbd className="font-mono text-[9px] text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-[#202D35] px-1 py-0.2 rounded border border-slate-200 dark:border-[#3C474B] shrink-0">
                        F
                      </kbd>
                    </Link>
                  </div>
                </div>

                {/* Utilities */}
                <div>
                  <h3 className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 px-1.5 mb-1 uppercase tracking-wider">
                    Utilities &amp; Statutory
                  </h3>
                  <div className="space-y-0.5">
                    <Link
                      href="/gst"
                      className="flex items-center justify-between px-2 py-1 rounded hover:bg-slate-50 dark:hover:bg-[#202D35] text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <ShieldCheck className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                        <span className="truncate">GST Returns &amp; Tax Breakdown</span>
                      </div>
                      <kbd className="font-mono text-[9px] text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-[#202D35] px-1 py-0.2 rounded border border-slate-200 dark:border-[#3C474B] shrink-0">
                        G
                      </kbd>
                    </Link>
                    <Link
                      href="/departments-members"
                      className="flex items-center justify-between px-2 py-1 rounded hover:bg-slate-50 dark:hover:bg-[#202D35] text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Users2 className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                        <span className="truncate">Departments &amp; Members</span>
                      </div>
                      <kbd className="font-mono text-[9px] text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-[#202D35] px-1 py-0.2 rounded border border-slate-200 dark:border-[#3C474B] shrink-0">
                        M
                      </kbd>
                    </Link>
                    <Link
                      href="/audit"
                      className="flex items-center justify-between px-2 py-1 rounded hover:bg-slate-50 dark:hover:bg-[#202D35] text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <History className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                        <span className="truncate">User Activity &amp; Audit Logs</span>
                      </div>
                      <kbd className="font-mono text-[9px] text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-[#202D35] px-1 py-0.2 rounded border border-slate-200 dark:border-[#3C474B] shrink-0">
                        L
                      </kbd>
                    </Link>
                    <Link
                      href="/settings"
                      className="flex items-center justify-between px-2 py-1 rounded hover:bg-slate-50 dark:hover:bg-[#202D35] text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Settings className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                        <span className="truncate">Settings &amp; Accounting Preferences</span>
                      </div>
                      <kbd className="font-mono text-[9px] text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-[#202D35] px-1 py-0.2 rounded border border-slate-200 dark:border-[#3C474B] shrink-0">
                        S
                      </kbd>
                    </Link>
                  </div>
                </div>

              </div>
            </div>

            {/* Footer */}
            <div className="px-3.5 py-2 bg-slate-50 dark:bg-[#202D35]/50 border-t border-[#E2E8F0] dark:border-[#3C474B] flex items-center justify-between text-[11px]">
              <span className="text-slate-400 dark:text-slate-500">
                Press highlighted key to navigate
              </span>
              <span className="font-mono text-[#4F7CAC] dark:text-[#9EEFE5] font-medium">
                ALERX Double-Entry
              </span>
            </div>
          </div>

          {/* ======================================================================= */}
          {/* Column 3: Quick Business KPIs Panel (Exact Match in Size & Stretched)   */}
          {/* ======================================================================= */}
          <div className="bg-white dark:bg-[#162521] border border-[#E2E8F0] dark:border-[#3C474B] rounded-xl shadow-xs overflow-hidden flex flex-col justify-between h-full transition-colors">
            <div>
              {/* Header */}
              <div className="px-3.5 py-2.5 border-b border-[#E2E8F0] dark:border-[#3C474B] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-[#4F7CAC] dark:text-[#9EEFE5]" />
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-900 dark:text-slate-100">
                    Quick Business KPIs
                  </h2>
                </div>
                <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Audited
                </span>
              </div>

              {/* Hero Numbers */}
              <div className="p-3 grid grid-cols-2 gap-2.5 border-b border-[#E2E8F0] dark:border-[#3C474B]">
                <Link
                  href="/invoices"
                  className="p-2.5 rounded-lg bg-slate-50 dark:bg-[#202D35] border border-slate-200/80 dark:border-[#3C474B] hover:border-[#4F7CAC] dark:hover:border-[#4F7CAC] transition-colors group block"
                  title="View Sales Invoices & Turnover"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                      Turnover
                    </span>
                    <ArrowUpRight className="h-3 w-3 text-slate-400 group-hover:text-[#4F7CAC] dark:group-hover:text-[#9EEFE5] transition-colors" />
                  </div>
                  <div className="text-lg font-mono font-bold text-slate-900 dark:text-white mt-0.5 group-hover:text-[#4F7CAC] dark:group-hover:text-[#9EEFE5] transition-colors">
                    {profile.turnover}
                  </div>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 block">
                    FY 2026–27
                  </span>
                </Link>

                <Link
                  href="/reports/profit-loss"
                  className="p-2.5 rounded-lg bg-slate-50 dark:bg-[#202D35] border border-slate-200/80 dark:border-[#3C474B] hover:border-emerald-500/60 dark:hover:border-emerald-500/60 transition-colors group block"
                  title="View Profit & Loss Account"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                      Net Profit
                    </span>
                    <ArrowUpRight className="h-3 w-3 text-slate-400 group-hover:text-emerald-500 transition-colors" />
                  </div>
                  <div className="text-lg font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {profile.profit}
                  </div>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 block">
                    EBITDA
                  </span>
                </Link>
              </div>

              {/* Business Metrics Breakdown */}
              <div className="p-3 space-y-2">
                <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 px-1 flex items-center justify-between uppercase tracking-wider">
                  <span>Business Metric</span>
                  <span>Position / Amount</span>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-[#3C474B]/40 border border-slate-200/80 dark:border-[#3C474B] rounded-lg overflow-hidden bg-white dark:bg-[#162521] text-xs">
                  
                  {/* 1. Billed Turnover */}
                  <Link
                    href="/invoices"
                    className="flex items-center justify-between px-2.5 py-2 hover:bg-slate-50 dark:hover:bg-[#202D35] transition-colors group cursor-pointer"
                  >
                    <div>
                      <div className="flex items-center gap-1 font-medium text-slate-900 dark:text-slate-200 group-hover:text-[#4F7CAC] dark:group-hover:text-[#9EEFE5] transition-colors text-xs">
                        <span>Billed Turnover</span>
                        <ArrowUpRight className="h-3 w-3 text-slate-400 opacity-60 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">{profile.billedLimit}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-semibold text-slate-900 dark:text-slate-100 block text-xs">
                        {profile.billed}
                      </span>
                      <span className="text-[9px] font-mono px-1 py-0.2 rounded font-medium bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40">
                        {profile.sec22Badge}
                      </span>
                    </div>
                  </Link>

                  {/* 2. Liquid Funds (Green for positive safe reserves) */}
                  <Link
                    href="/masters/chart-of-accounts?group=asset&filter=liquid"
                    className="flex items-center justify-between px-2.5 py-2 hover:bg-slate-50 dark:hover:bg-[#202D35] transition-colors group cursor-pointer"
                  >
                    <div>
                      <div className="flex items-center gap-1 font-medium text-slate-900 dark:text-slate-200 group-hover:text-[#4F7CAC] dark:group-hover:text-[#9EEFE5] transition-colors text-xs">
                        <span>Liquid Funds</span>
                        <ArrowUpRight className="h-3 w-3 text-slate-400 opacity-60 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">{profile.liquidBank}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400 block text-xs">
                        {profile.liquid}
                      </span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">Instant Liquidity</span>
                    </div>
                  </Link>

                  {/* 3. Trade Debtors (AR) */}
                  <Link
                    href="/reports/debtors"
                    className="flex items-center justify-between px-2.5 py-2 hover:bg-slate-50 dark:hover:bg-[#202D35] transition-colors group cursor-pointer"
                  >
                    <div>
                      <div className="flex items-center gap-1 font-medium text-slate-900 dark:text-slate-200 group-hover:text-[#4F7CAC] dark:group-hover:text-[#9EEFE5] transition-colors text-xs">
                        <span>Trade Debtors (AR)</span>
                        <ArrowUpRight className="h-3 w-3 text-slate-400 opacity-60 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">{profile.debtorsCount}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-semibold text-slate-900 dark:text-slate-100 block text-xs">
                        {profile.debtors}
                      </span>
                      <span className="text-[9px] font-mono px-1 py-0.2 rounded font-medium bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40">
                        {profile.debtorsAging}
                      </span>
                    </div>
                  </Link>

                  {/* 4. Trade Creditors (AP) */}
                  <Link
                    href="/reports/creditors"
                    className="flex items-center justify-between px-2.5 py-2 hover:bg-slate-50 dark:hover:bg-[#202D35] transition-colors group cursor-pointer"
                  >
                    <div>
                      <div className="flex items-center gap-1 font-medium text-slate-900 dark:text-slate-200 group-hover:text-[#4F7CAC] dark:group-hover:text-[#9EEFE5] transition-colors text-xs">
                        <span>Trade Creditors (AP)</span>
                        <ArrowUpRight className="h-3 w-3 text-slate-400 opacity-60 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">{profile.creditorsCount}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-semibold text-slate-900 dark:text-slate-100 block text-xs">
                        {profile.creditors}
                      </span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">{profile.creditorsTerms}</span>
                    </div>
                  </Link>

                  {/* 5. Operating Expenses */}
                  <Link
                    href="/reports/operating-expenses"
                    className="flex items-center justify-between px-2.5 py-2 hover:bg-slate-50 dark:hover:bg-[#202D35] transition-colors group cursor-pointer"
                  >
                    <div>
                      <div className="flex items-center gap-1 font-medium text-slate-900 dark:text-slate-200 group-hover:text-[#4F7CAC] dark:group-hover:text-[#9EEFE5] transition-colors text-xs">
                        <span>Operating Expenses</span>
                        <ArrowUpRight className="h-3 w-3 text-slate-400 opacity-60 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">{profile.expensesHeads}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-semibold text-slate-900 dark:text-slate-100 block text-xs">
                        {profile.expenses}
                      </span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">{profile.expenseRatio}</span>
                    </div>
                  </Link>

                  {/* 6. GST Net Payable (Red for liability movement) */}
                  <Link
                    href="/gst"
                    className="flex items-center justify-between px-2.5 py-2 hover:bg-slate-50 dark:hover:bg-[#202D35] transition-colors group cursor-pointer"
                  >
                    <div>
                      <div className="flex items-center gap-1 font-medium text-slate-900 dark:text-slate-200 group-hover:text-[#4F7CAC] dark:group-hover:text-[#9EEFE5] transition-colors text-xs">
                        <span>GST Net Payable</span>
                        <ArrowUpRight className="h-3 w-3 text-slate-400 opacity-60 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">{profile.gstBreakdown}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-semibold text-rose-600 dark:text-rose-400 block text-xs">
                        {profile.gst}
                      </span>
                      <span className="text-[9px] font-mono px-1 py-0.2 rounded font-medium bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/40">
                        {profile.gstStatus}
                      </span>
                    </div>
                  </Link>

                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="px-3.5 py-2 bg-slate-50 dark:bg-[#202D35]/50 border-t border-[#E2E8F0] dark:border-[#3C474B] flex items-center justify-between text-[11px]">
              <Link
                href="/consultant"
                className="inline-flex items-center gap-1.5 font-medium text-[#4F7CAC] dark:text-[#9EEFE5] hover:underline transition-colors"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Deku Konsultant (K)</span>
              </Link>
              <Link
                href="/consultant"
                className="inline-flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300 hover:text-[#4F7CAC] dark:hover:text-[#9EEFE5] transition-colors"
              >
                <span>Executive Dashboard</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
