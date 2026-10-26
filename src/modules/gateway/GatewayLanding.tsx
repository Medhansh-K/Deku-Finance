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
  ArrowRightLeft,
  ArrowUpRight,
  ArrowRight,
  Sparkles,
  Bot,
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

  const [lastEntryDate, setLastEntryDate] = useState<string>("18-Oct-2026");
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
      // Notify AppShell's TopBar to sync immediately
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
    <div className="flex-1 flex flex-col items-center justify-center p-2 sm:p-2.5 lg:px-4 lg:py-1 bg-[#F8FAFC] w-full min-h-0">
      <div className="w-full max-w-[1480px] flex flex-col lg:flex-row gap-3 xl:gap-3.5 items-stretch">
        {/* ========================================================================= */}
        {/* Column 1 (Left): Company Status & Instant Shift Switcher */}
        {/* ========================================================================= */}
        <div className="w-full lg:w-[310px] xl:w-[325px] shrink-0 bg-white border border-[#CBD5E1] rounded-lg p-3 shadow-xs flex flex-col justify-between">
          <div className="space-y-2.5">
            {/* Header with Company Selector Dropdown */}
            <div className="border-b border-[#E2E8F0] pb-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#3E4848]">
                  Current Active Company
                </span>
                <span className="text-[9px] font-mono font-bold text-[#5BB5BB] bg-[#1F2324] px-1.5 py-0.5 rounded">
                  F3 Shift
                </span>
              </div>

              {/* Instant Switcher Dropdown */}
              <div className="relative mt-1.5">
                <select
                  id="company-shift-select"
                  value={activeOrg.id}
                  onChange={(e) => {
                    const chosen = orgList.find((o) => o.id === e.target.value);
                    if (chosen) handleSwitchCompany(chosen);
                  }}
                  className="w-full bg-[#1F2324] text-white font-bold text-xs py-1.5 px-2.5 rounded border border-[#3E4848] focus:border-[#5BB5BB] focus:outline-none cursor-pointer appearance-none pr-8 shadow-xs hover:border-[#5BB5BB] transition-colors"
                  title="Select and switch active company workspace"
                >
                  {orgList.map((org) => (
                    <option key={org.id} value={org.id} className="bg-[#1F2324] text-white py-1">
                      {org.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="h-4 w-4 text-[#5BB5BB] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              <div className="flex items-center gap-1.5 mt-1.5">
                <span className="text-[10px] font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-300">
                  GSTIN: {activeOrg.gstin}
                </span>
                <span className="text-[10px] font-mono bg-emerald-50 text-emerald-800 px-1.5 py-0.5 rounded border border-emerald-300 font-bold">
                  {activeOrg.currency}
                </span>
              </div>
            </div>

            {/* Quick Shift Entities (Clickable Switcher Buttons) */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] font-mono font-bold uppercase tracking-wider text-[#3E4848]">
                <span className="flex items-center gap-1">
                  <ArrowRightLeft className="h-3 w-3 text-[#5BB5BB]" /> Shift Company
                </span>
                <Link
                  href="/companies"
                  className="text-[#2D7A7A] hover:text-[#5BB5BB] transition-colors"
                  title="Manage and create companies (F3)"
                >
                  + Add (F3)
                </Link>
              </div>

              <div className="space-y-1">
                {orgList.slice(0, 3).map((org) => {
                  const isSelected = org.id === activeOrg.id;
                  return (
                    <button
                      key={org.id}
                      id={`shift-company-${org.id}`}
                      type="button"
                      onClick={() => handleSwitchCompany(org)}
                      className={`w-full text-left px-2 py-1 rounded text-[11px] transition-all flex items-center justify-between border cursor-pointer ${
                        isSelected
                          ? "bg-[#1F2324] text-[#91D7D2] border-[#3E4848] font-bold shadow-xs"
                          : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <Building2
                          className={`h-3 w-3 shrink-0 ${
                            isSelected ? "text-[#5BB5BB]" : "text-slate-400"
                          }`}
                        />
                        <span className="truncate">{org.name}</span>
                      </div>
                      {isSelected ? (
                        <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-[#5BB5BB] text-[#0A0A0A] font-bold shrink-0">
                          Active
                        </span>
                      ) : (
                        <span className="text-[9px] font-mono text-slate-400 hover:text-slate-700 shrink-0">
                          Shift ➔
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Company Metadata Info */}
            <div className="space-y-1 text-[11px] pt-1">
              <div className="flex justify-between py-0.5 border-b border-slate-100">
                <span className="text-slate-500">Current Period:</span>
                <span className="font-mono font-bold text-[#0F172A]">
                  01-Apr-2026 to 31-Mar-2027
                </span>
              </div>
              <div className="flex justify-between py-0.5 border-b border-slate-100">
                <span className="text-slate-500">Date of Last Entry:</span>
                <span className="font-mono font-bold text-[#0F172A]">
                  {lastEntryDate}
                </span>
              </div>
              <div className="flex justify-between py-0.5 border-b border-slate-100">
                <span className="text-slate-500">Accounting Standard:</span>
                <span className="font-mono text-[#0F172A]">
                  ALERX 4-Tier Double Entry
                </span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-slate-500">Authoritative Ledger:</span>
                <span className="font-mono text-emerald-700 font-semibold flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
                  PostgreSQL Active
                </span>
              </div>
            </div>
          </div>

          <div className="pt-2 mt-1.5 border-t border-[#E2E8F0] text-[10px] text-slate-500">
            <p className="font-mono text-[9px] text-slate-400">
              Press <strong>F3</strong> or click above to shift company. Highlighted keys open menu items directly.
            </p>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* Column 2 (Center): Gateway of Deku Navigation Menu (Enlarged & Focused)  */}
        {/* ========================================================================= */}
        <div className="flex-1 bg-white border border-[#3E4848] rounded-lg shadow-md overflow-hidden flex flex-col justify-between min-w-[340px]">
          <div>
            {/* Menu Title Header */}
            <div className="bg-[#1F2324] px-3.5 py-1.5 border-b border-[#3E4848] flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-[#5BB5BB]" />
                <span className="text-xs font-mono font-black tracking-wider uppercase">
                  Gateway of Deku
                </span>
              </div>
              <span className="text-[10px] font-mono text-[#91D7D2] truncate max-w-[220px] bg-white/10 px-2 py-0.5 rounded border border-[#5BB5BB]/30">
                🏢 {companyShortName} Workspace
              </span>
            </div>

            <div className="p-2.5 space-y-1.5 divide-y divide-slate-100 text-xs font-sans">
              {/* EXECUTIVE DASHBOARD & DEKU KONSULTANT SPOTLIGHT */}
              <div className="pb-0.5">
                <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#3E4848] mb-1 px-1.5 flex items-center justify-between">
                  <span>Executive Overview</span>
                  <span className="text-[9px] font-mono text-[#00F5A0] bg-[#141C1E] px-1.5 py-0.5 rounded border border-[#233134] font-bold">
                    AI CFO Live
                  </span>
                </div>
                <Link
                  href="/consultant"
                  style={{
                    backgroundColor: "#141C1E",
                    border: "1px solid #233134",
                    color: "#FFFFFF",
                  }}
                  className="flex items-center justify-between px-2.5 py-2 rounded hover:border-[#00F5A0]/60 shadow-xs group transition-all"
                  title="Launch Deku Konsultant Executive Dashboard & Sovereign AI CFO (K or E)"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="h-6 w-6 rounded-lg flex items-center justify-center group-hover:scale-105 transition-transform shrink-0"
                      style={{
                        backgroundColor: "rgba(0, 245, 160, 0.15)",
                        border: "1px solid rgba(0, 245, 160, 0.4)",
                        color: "#00F5A0",
                      }}
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                    </span>
                    <div>
                      <span className="font-bold text-xs block text-white group-hover:text-[#00F5A0] transition-colors">
                        Deku <u>K</u>onsultant (<u>E</u>xecutive Dashboard)
                      </span>
                      <span className="text-[10px] text-slate-400 block font-mono">
                        {companyShortName} Sovereign AI CFO &amp; Real-time Ledger Intelligence
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <kbd
                      className="font-mono text-[10px] font-black px-1.5 py-0.5 rounded shadow-xs"
                      style={{ backgroundColor: "#00F5A0", color: "#000000" }}
                    >
                      K
                    </kbd>
                    <kbd
                      className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded border"
                      style={{
                        backgroundColor: "rgba(0,0,0,0.4)",
                        borderColor: "#3E4848",
                        color: "#CBD5E1",
                      }}
                    >
                      E
                    </kbd>
                  </div>
                </Link>
              </div>

              {/* MASTERS */}
              <div className="pt-1.5">
                <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#3E4848] mb-0.5 px-1.5">
                  Masters
                </div>
                <div className="space-y-0.5">
                  <Link
                    href="/masters/chart-of-accounts"
                    className="flex items-center justify-between px-2 py-0.5 rounded hover:bg-[#5BB5BB]/10 text-slate-800 hover:text-[#0A0A0A] transition-colors font-medium"
                  >
                    <span>
                      <u>C</u>hart of <u>A</u>ccounts (ALERX Ledgers)
                    </span>
                    <kbd className="font-mono text-[10px] font-bold text-[#3E4848] bg-slate-100 px-1.5 py-0.2 rounded border border-slate-300">
                      A
                    </kbd>
                  </Link>
                  <Link
                    href="/masters/parties"
                    className="flex items-center justify-between px-2 py-0.5 rounded hover:bg-[#5BB5BB]/10 text-slate-800 hover:text-[#0A0A0A] transition-colors font-medium"
                  >
                    <span>
                      <u>P</u>arties (Customers &amp; Vendors Master)
                    </span>
                    <kbd className="font-mono text-[10px] font-bold text-[#3E4848] bg-slate-100 px-1.5 py-0.2 rounded border border-slate-300">
                      P
                    </kbd>
                  </Link>
                  <Link
                    href="/masters/products-services"
                    className="flex items-center justify-between px-2 py-0.5 rounded hover:bg-[#5BB5BB]/10 text-slate-800 hover:text-[#0A0A0A] transition-colors font-medium"
                  >
                    <span>
                      Stock &amp; Services <u>I</u>tems
                    </span>
                    <kbd className="font-mono text-[10px] font-bold text-[#3E4848] bg-slate-100 px-1.5 py-0.2 rounded border border-slate-300">
                      I
                    </kbd>
                  </Link>
                </div>
              </div>

              {/* TRANSACTIONS */}
              <div className="pt-1.5">
                <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#3E4848] mb-0.5 px-1.5">
                  Transactions &amp; Registers
                </div>
                <div className="space-y-0.5">
                  <Link
                    href="/vouchers"
                    className="flex items-center justify-between px-2 py-0.5 rounded hover:bg-[#5BB5BB]/10 text-slate-800 hover:text-[#0A0A0A] transition-colors font-medium"
                  >
                    <span>
                      Accounting <u>V</u>ouchers (F4-F9)
                    </span>
                    <kbd className="font-mono text-[10px] font-bold text-white bg-[#1F2324] px-1.5 py-0.2 rounded border border-[#3E4848]">
                      V
                    </kbd>
                  </Link>
                  <Link
                    href="/day-book"
                    className="flex items-center justify-between px-2 py-0.5 rounded hover:bg-[#5BB5BB]/10 text-slate-800 hover:text-[#0A0A0A] transition-colors font-medium"
                  >
                    <span>
                      <u>D</u>ay Book (Chronological Register)
                    </span>
                    <kbd className="font-mono text-[10px] font-bold text-[#3E4848] bg-slate-100 px-1.5 py-0.2 rounded border border-slate-300">
                      D
                    </kbd>
                  </Link>
                  <Link
                    href="/builder"
                    className="flex items-center justify-between px-2 py-0.5 rounded hover:bg-[#5BB5BB]/10 text-slate-800 hover:text-[#0A0A0A] transition-colors font-medium"
                  >
                    <span className="flex items-center gap-1.5">
                      <span><u>B</u>uilder (Docs, Quotes &amp; Coupons)</span>
                      <span className="text-[9px] px-1 py-0.1 rounded bg-teal-100 text-[#0A0A0A] font-bold">New</span>
                    </span>
                    <kbd className="font-mono text-[10px] font-bold text-white bg-[#1F2324] px-1.5 py-0.2 rounded border border-[#3E4848]">
                      Shift+B
                    </kbd>
                  </Link>
                </div>
              </div>

              {/* FINANCIAL REPORTS */}
              <div className="pt-1.5">
                <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#3E4848] mb-0.5 px-1.5">
                  Financial Reports
                </div>
                <div className="space-y-0.5">
                  <Link
                    href="/reports/balance-sheet"
                    className="flex items-center justify-between px-2 py-0.5 rounded hover:bg-[#5BB5BB]/10 text-slate-800 hover:text-[#0A0A0A] transition-colors font-medium"
                  >
                    <span>
                      <u>B</u>alance Sheet
                    </span>
                    <kbd className="font-mono text-[10px] font-bold text-[#3E4848] bg-slate-100 px-1.5 py-0.2 rounded border border-slate-300">
                      B
                    </kbd>
                  </Link>
                  <Link
                    href="/reports/profit-loss"
                    className="flex items-center justify-between px-2 py-0.5 rounded hover:bg-[#5BB5BB]/10 text-slate-800 hover:text-[#0A0A0A] transition-colors font-medium"
                  >
                    <span>
                      Pr<u>o</u>fit &amp; Loss A/c
                    </span>
                    <kbd className="font-mono text-[10px] font-bold text-[#3E4848] bg-slate-100 px-1.5 py-0.2 rounded border border-slate-300">
                      O
                    </kbd>
                  </Link>
                  <Link
                    href="/reports/trial-balance"
                    className="flex items-center justify-between px-2 py-0.5 rounded hover:bg-[#5BB5BB]/10 text-slate-800 hover:text-[#0A0A0A] transition-colors font-medium"
                  >
                    <span>
                      <u>T</u>rial Balance
                    </span>
                    <kbd className="font-mono text-[10px] font-bold text-[#3E4848] bg-slate-100 px-1.5 py-0.2 rounded border border-slate-300">
                      T
                    </kbd>
                  </Link>
                  <Link
                    href="/reports/cash-flow"
                    className="flex items-center justify-between px-2 py-0.5 rounded hover:bg-[#5BB5BB]/10 text-slate-800 hover:text-[#0A0A0A] transition-colors font-medium"
                  >
                    <span>
                      <u>C</u>ash Flow (WCM)
                    </span>
                    <kbd className="font-mono text-[10px] font-bold text-[#5BB5BB] bg-[#1F2324] px-1.5 py-0.2 rounded border border-[#3E4848]">
                      C
                    </kbd>
                  </Link>
                  <Link
                    href="/reports/fpa"
                    className="flex items-center justify-between px-2 py-0.5 rounded hover:bg-[#5BB5BB]/10 text-slate-800 hover:text-[#0A0A0A] transition-colors font-medium"
                  >
                    <span>
                      <u>F</u>P&amp;A Intelligence
                    </span>
                    <kbd className="font-mono text-[10px] font-bold text-[#5BB5BB] bg-[#1F2324] px-1.5 py-0.2 rounded border border-[#3E4848]">
                      F
                    </kbd>
                  </Link>
                  <Link
                    href="/consultant"
                    className="flex items-center justify-between px-2 py-0.5 rounded bg-teal-500/10 hover:bg-teal-500/20 text-teal-950 hover:text-teal-900 transition-colors font-bold border border-teal-500/30"
                  >
                    <span className="flex items-center gap-1.5">
                      <span>Deku <u>K</u>onsultant</span>
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    </span>
                    <kbd className="font-mono text-[10px] font-bold text-white bg-teal-800 px-1.5 py-0.2 rounded border border-teal-700">
                      K
                    </kbd>
                  </Link>
                </div>
              </div>

              {/* UTILITIES & STATUTORY */}
              <div className="pt-1.5">
                <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#3E4848] mb-0.5 px-1.5">
                  Utilities &amp; Statutory
                </div>
                <div className="space-y-0.5">
                  <Link
                    href="/gst"
                    className="flex items-center justify-between px-2 py-0.5 rounded hover:bg-[#5BB5BB]/10 text-slate-800 hover:text-[#0A0A0A] transition-colors font-medium"
                  >
                    <span>
                      <u>G</u>ST Returns &amp; Tax Breakdown
                    </span>
                    <kbd className="font-mono text-[10px] font-bold text-[#3E4848] bg-slate-100 px-1.5 py-0.2 rounded border border-slate-300">
                      G
                    </kbd>
                  </Link>
                  <Link
                    href="/departments-members"
                    className="flex items-center justify-between px-2 py-0.5 rounded hover:bg-[#5BB5BB]/10 text-slate-800 hover:text-[#0A0A0A] transition-colors font-medium"
                  >
                    <span>
                      Departments &amp; <u>M</u>embers
                    </span>
                    <kbd className="font-mono text-[10px] font-bold text-white bg-[#1F2324] px-1.5 py-0.2 rounded border border-[#3E4848]">
                      M
                    </kbd>
                  </Link>
                  <Link
                    href="/audit"
                    className="flex items-center justify-between px-2 py-0.5 rounded hover:bg-[#5BB5BB]/10 text-slate-800 hover:text-[#0A0A0A] transition-colors font-medium"
                  >
                    <span>
                      User Activity &amp; Audit <u>L</u>ogs
                    </span>
                    <kbd className="font-mono text-[10px] font-bold text-white bg-[#1F2324] px-1.5 py-0.2 rounded border border-[#3E4848]">
                      L
                    </kbd>
                  </Link>
                  <Link
                    href="/settings"
                    className="flex items-center justify-between px-2 py-0.5 rounded hover:bg-[#5BB5BB]/10 text-slate-800 hover:text-[#0A0A0A] transition-colors font-medium"
                  >
                    <span>
                      <u>S</u>ettings &amp; Accounting Preferences
                    </span>
                    <kbd className="font-mono text-[10px] font-bold text-[#3E4848] bg-slate-100 px-1.5 py-0.2 rounded border border-slate-300">
                      S
                    </kbd>
                  </Link>

                </div>
              </div>
            </div>
          </div>

          {/* Balanced Card Footer */}
          <div className="px-3.5 py-1.5 bg-slate-50 border-t border-[#E2E8F0] flex items-center justify-between text-xs">
            <span className="text-[10px] font-mono text-slate-500">
              Press highlighted key to navigate
            </span>
            <span className="text-[10px] font-mono text-[#2D7A7A] font-semibold">
              ALERX Double-Entry
            </span>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* Column 3 (Right): Quick KPI Table (Dynamically Synced with Company)       */}
        {/* ========================================================================= */}
        <div className="flex-1 bg-white border border-[#3E4848] rounded-lg shadow-md overflow-hidden flex flex-col justify-between min-w-[350px]">
          <div>
            {/* KPI Title Header */}
            <div className="bg-[#1F2324] px-3.5 py-1.5 border-b border-[#3E4848] flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-[#5BB5BB]" />
                <span className="text-xs font-mono font-black tracking-wider uppercase">
                  Quick Business KPIs
                </span>
              </div>
              <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1 font-bold">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
                Live Audited ({companyShortName})
              </span>
            </div>

            {/* Top Revenue & Margin Highlight Strip with Direct Drilldown */}
            <div className="p-2.5 bg-[#F8FAFC] border-b border-slate-200 grid grid-cols-2 gap-2">
              <Link
                href="/invoices"
                className="p-1.5 rounded bg-white hover:bg-[#5BB5BB]/10 border border-slate-200/80 hover:border-[#5BB5BB] block shadow-2xs group transition-all cursor-pointer"
                title="View Sales Invoices & Billed Turnover Register"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-slate-500 uppercase block font-semibold group-hover:text-slate-900 transition-colors">
                    Turnover (FY 26-27)
                  </span>
                  <ArrowUpRight className="h-3 w-3 text-slate-400 group-hover:text-[#5BB5BB] transition-colors" />
                </div>
                <span className="text-base font-black font-mono text-[#0A0A0A] group-hover:text-[#2D7A7A] transition-colors">
                  {profile.turnover}
                </span>
              </Link>
              <Link
                href="/reports/profit-loss"
                className="p-1.5 rounded bg-white hover:bg-[#5BB5BB]/10 border border-slate-200/80 hover:border-[#5BB5BB] text-right block shadow-2xs group transition-all cursor-pointer"
                title="View Profit & Loss Account & Net Profit Statement (O)"
              >
                <div className="flex items-center justify-end gap-1">
                  <span className="text-[10px] font-mono text-slate-500 uppercase block font-semibold group-hover:text-slate-900 transition-colors">
                    Net Profit (EBITDA)
                  </span>
                  <ArrowUpRight className="h-3 w-3 text-slate-400 group-hover:text-[#5BB5BB] transition-colors" />
                </div>
                <span className="text-base font-black font-mono text-emerald-700 group-hover:text-emerald-600 transition-colors">
                  {profile.profit}
                </span>
              </Link>
            </div>

            {/* Quick KPI Table: Numerical Business Metrics with Direct Drilldown */}
            <div className="p-2.5 space-y-1.5 text-xs">
              <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#3E4848] px-1 flex items-center justify-between">
                <span>Business Metric (Click to view details)</span>
                <span>Position / Amount</span>
              </div>

              <div className="divide-y divide-slate-100 border border-slate-200 rounded overflow-hidden bg-white text-xs">
                {/* 1. Billed Turnover & Invoices Hub -> /invoices */}
                <Link
                  href="/invoices"
                  className="flex items-center justify-between px-2.5 py-1.5 hover:bg-[#5BB5BB]/10 transition-colors group cursor-pointer"
                  title="Open Sales Invoices Register, Issuance & Conversion Tracking"
                >
                  <div>
                    <div className="flex items-center gap-1">
                      <span className="font-semibold text-slate-800 group-hover:text-[#0A0A0A] block text-xs">
                        Billed Turnover
                      </span>
                      <ArrowUpRight className="h-3 w-3 text-[#3E4848] opacity-40 group-hover:opacity-100 group-hover:text-[#5BB5BB] transition-all" />
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">{profile.billedLimit}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-bold text-slate-900 group-hover:text-[#5BB5BB] block transition-colors text-xs">
                      {profile.billed}
                    </span>
                    <span
                      className={`text-[9px] font-mono px-1.5 py-0.2 rounded border font-bold ${
                        profile.sec22Variant === "safe"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : profile.sec22Variant === "warn"
                          ? "bg-amber-50 text-amber-800 border-amber-200"
                          : "bg-blue-50 text-blue-800 border-blue-200"
                      }`}
                    >
                      {profile.sec22Badge}
                    </span>
                  </div>
                </Link>

                {/* 2. Liquid Funds (Cash & Bank) -> /masters/chart-of-accounts?group=asset&filter=liquid */}
                <Link
                  href="/masters/chart-of-accounts?group=asset&filter=liquid"
                  className="flex items-center justify-between px-2.5 py-1.5 hover:bg-[#5BB5BB]/10 transition-colors group cursor-pointer"
                  title="Open Chart of Accounts: Liquid Cash & Bank Asset Units and Values"
                >
                  <div>
                    <div className="flex items-center gap-1">
                      <span className="font-semibold text-slate-800 group-hover:text-[#0A0A0A] block text-xs">
                        Liquid Funds
                      </span>
                      <ArrowUpRight className="h-3 w-3 text-[#3E4848] opacity-40 group-hover:opacity-100 group-hover:text-[#5BB5BB] transition-all" />
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">{profile.liquidBank}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-bold text-emerald-700 group-hover:text-emerald-600 block transition-colors text-xs">
                      {profile.liquid}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">Instant Liquidity</span>
                  </div>
                </Link>

                {/* 3. Trade Debtors (AR DSO Tracking) -> /reports/debtors */}
                <Link
                  href="/reports/debtors"
                  className="flex items-center justify-between px-2.5 py-1.5 hover:bg-[#5BB5BB]/10 transition-colors group cursor-pointer"
                  title="Open Trade Debtors (AR) DSO Analysis & Customer Outstanding Invoices"
                >
                  <div>
                    <div className="flex items-center gap-1">
                      <span className="font-semibold text-slate-800 group-hover:text-[#0A0A0A] block text-xs">
                        Trade Debtors (AR)
                      </span>
                      <ArrowUpRight className="h-3 w-3 text-[#3E4848] opacity-40 group-hover:opacity-100 group-hover:text-[#5BB5BB] transition-all" />
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">{profile.debtorsCount}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-bold text-slate-900 group-hover:text-[#5BB5BB] block transition-colors text-xs">
                      {profile.debtors}
                    </span>
                    <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-200 font-semibold">
                      {profile.debtorsAging}
                    </span>
                  </div>
                </Link>

                {/* 4. Trade Creditors (AP DPO Tracking) -> /reports/creditors */}
                <Link
                  href="/reports/creditors"
                  className="flex items-center justify-between px-2.5 py-1.5 hover:bg-[#5BB5BB]/10 transition-colors group cursor-pointer"
                  title="Open Trade Creditors (AP) DPO Analysis & Vendor Bills Tracker"
                >
                  <div>
                    <div className="flex items-center gap-1">
                      <span className="font-semibold text-slate-800 group-hover:text-[#0A0A0A] block text-xs">
                        Trade Creditors (AP)
                      </span>
                      <ArrowUpRight className="h-3 w-3 text-[#3E4848] opacity-40 group-hover:opacity-100 group-hover:text-[#5BB5BB] transition-all" />
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">{profile.creditorsCount}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-bold text-slate-900 group-hover:text-[#5BB5BB] block transition-colors text-xs">
                      {profile.creditors}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">{profile.creditorsTerms}</span>
                  </div>
                </Link>

                {/* 5. Operating Expenses & Payment Vouchers -> /reports/operating-expenses */}
                <Link
                  href="/reports/operating-expenses"
                  className="flex items-center justify-between px-2.5 py-1.5 hover:bg-[#5BB5BB]/10 transition-colors group cursor-pointer"
                  title="Open Operating Expenses Hub: Payment Vouchers & Department-wise Tracking"
                >
                  <div>
                    <div className="flex items-center gap-1">
                      <span className="font-semibold text-slate-800 group-hover:text-[#0A0A0A] block text-xs">
                        Operating Expenses
                      </span>
                      <ArrowUpRight className="h-3 w-3 text-[#3E4848] opacity-40 group-hover:opacity-100 group-hover:text-[#5BB5BB] transition-all" />
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">{profile.expensesHeads}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-bold text-slate-900 group-hover:text-[#5BB5BB] block transition-colors text-xs">
                      {profile.expenses}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">{profile.expenseRatio}</span>
                  </div>
                </Link>

                {/* 6. GST Net Liability -> /gst */}
                <Link
                  href="/gst"
                  className="flex items-center justify-between px-2.5 py-1.5 hover:bg-[#5BB5BB]/10 transition-colors group cursor-pointer"
                  title="Open GST Returns & Tax Breakdown Hub (G)"
                >
                  <div>
                    <div className="flex items-center gap-1">
                      <span className="font-semibold text-slate-800 group-hover:text-[#0A0A0A] block text-xs">
                        GST Net Payable
                      </span>
                      <ArrowUpRight className="h-3 w-3 text-[#3E4848] opacity-40 group-hover:opacity-100 group-hover:text-[#5BB5BB] transition-all" />
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">{profile.gstBreakdown}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-bold text-rose-700 group-hover:text-rose-600 block transition-colors text-xs">
                      {profile.gst}
                    </span>
                    <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 border border-slate-200">
                      {profile.gstStatus}
                    </span>
                  </div>
                </Link>
              </div>
            </div>
          </div>

          {/* Bottom Card Footer with Direct Drilldown to Executive Dashboard & Deku Consultant */}
          <div className="px-3.5 py-1.5 bg-slate-50 border-t border-[#E2E8F0] flex items-center justify-between text-xs">
            <Link
              href="/consultant"
              className="inline-flex items-center gap-1.5 font-bold text-teal-800 hover:text-teal-600 transition-colors"
              title="Launch Deku Consultant AI Advisor (K)"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Deku Konsultant (K)</span>
            </Link>
            <Link
              href="/consultant"
              className="inline-flex items-center gap-1 font-bold text-[#1F2324] hover:text-[#5BB5BB] transition-colors"
              title="Open Executive Dashboard & AI CFO (E)"
            >
              <span>Executive Dashboard (E)</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
