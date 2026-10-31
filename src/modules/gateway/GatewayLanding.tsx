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
import { organisationsApi, OrgSummary } from "@/api/endpoints";
import {
  emptyKpis,
  getQuickKpiKeys,
  loadKpis,
  FormattedKpiProfile,
  KpiKey,
} from "@/lib/kpi/kpi-service";

export function GatewayLanding() {
  const router = useRouter();

  const [orgList, setOrgList] = useState<OrgSummary[]>([]);

  const [activeOrg, setActiveOrg] = useState({
    id: "",
    name: "",
    slug: "",
    gstin: "" as string | null,
    currency: "INR",
  });

  const [profile, setProfile] = useState<FormattedKpiProfile>(emptyKpis);
  const [quickKeys, setQuickKeys] = useState<KpiKey[]>([]);
  const show = (k: KpiKey) => quickKeys.includes(k);

  useEffect(() => {
    if (!activeOrg.id) return;
    setProfile(emptyKpis());
    let live = true;
    loadKpis(activeOrg.id)
      .then((p) => live && setProfile(p))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [activeOrg.id]);

  useEffect(() => {
    if (!activeOrg.id) return;
    const sync = () => setQuickKeys(getQuickKpiKeys(activeOrg.id));
    sync();
    window.addEventListener("deku_kpi_changed", sync);
    return () => window.removeEventListener("deku_kpi_changed", sync);
  }, [activeOrg.id]);

  // Handle switching company
  const handleSwitchCompany = (org: OrgSummary | { id: string; name: string; gstin?: string | null; currency?: string; slug?: string }) => {
    setActiveOrg({
      id: org.id,
      name: org.name,
      slug: org.slug || org.name.toLowerCase().replace(/[^a-z0-9]/g, "-"),
      gstin: org.gstin ?? null,
      currency: org.currency || "INR",
    });

    if (typeof window !== "undefined") {
      localStorage.setItem("deku_active_org_id", org.id);
      localStorage.setItem("deku_active_org_name", org.name);
      // Notify the shell to sync the active company
      window.dispatchEvent(new Event("deku_active_org_changed"));
    }
  };

  // Load all organisations from PostgreSQL backend
  const loadOrganisations = async () => {
    try {
      const res = await organisationsApi.list();
      if (res.data && res.data.length > 0) {
        setOrgList(res.data);
        if (!localStorage.getItem("deku_active_org_id")) handleSwitchCompany(res.data[0]);
      }
    } catch {
      // Backend unreachable or not signed in: show no companies rather than placeholders.
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
                gstin: org.gstin ?? null,
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



  const companyShortName = activeOrg.name.split(" ")[0];

  return (
    <div className="flex-1 flex flex-col items-center justify-start p-3 lg:px-5 lg:py-3.5 bg-canvas w-full min-h-0">
      <div className="w-full max-w-[1400px] flex flex-col xl:flex-row gap-3.5 items-stretch">
        {/* ========================================================================= */}
        {/* Column 1 (Left): Company Status & Instant Shift Switcher */}
        {/* ========================================================================= */}
        <div className="w-full xl:w-[290px] shrink-0 bg-surface border border-line-strong rounded-xl p-3.5 shadow-xs flex flex-col justify-between">
          <div className="space-y-2.5">
            {/* Header with Company Selector Dropdown */}
            <div className="border-b border-line pb-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-ink-soft">
                  Current Active Company
                </span>
                <span className="text-[9px] font-mono font-bold text-brand bg-panel px-1.5 py-0.5 rounded">
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
                  className="w-full bg-panel text-white font-bold text-xs py-1.5 px-2.5 rounded border border-edge focus:border-brand focus:outline-none cursor-pointer appearance-none pr-8 shadow-xs hover:border-brand transition-colors"
                  title="Select and switch active company workspace"
                >
                  {orgList.map((org) => (
                    <option key={org.id} value={org.id} className="bg-panel text-white py-1">
                      {org.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="h-4 w-4 text-brand absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              <div className="flex items-center gap-1.5 mt-1.5">
                <span className="text-[10px] font-mono bg-canvas-sunken text-ink-soft px-1.5 py-0.5 rounded border border-line-strong">
                  GSTIN: {activeOrg.gstin || "–"}
                </span>
                <span className="text-[10px] font-mono bg-emerald-50 text-emerald-800 px-1.5 py-0.5 rounded border border-emerald-300 font-bold">
                  {activeOrg.currency}
                </span>
              </div>
            </div>

            {/* Quick Shift Entities (Clickable Switcher Buttons) */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] font-mono font-bold uppercase tracking-wider text-ink-soft">
                <span className="flex items-center gap-1">
                  <ArrowRightLeft className="h-3 w-3 text-brand" /> Shift Company
                </span>
                <Link
                  href="/companies"
                  className="text-brand-strong hover:text-brand transition-colors"
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
                          ? "bg-panel text-brand-soft border-edge font-bold shadow-xs"
                          : "bg-canvas hover:bg-canvas-sunken text-ink-soft border-line"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <Building2
                          className={`h-3 w-3 shrink-0 ${
                            isSelected ? "text-brand" : "text-ink-subtle"
                          }`}
                        />
                        <span className="truncate">{org.name}</span>
                      </div>
                      {isSelected ? (
                        <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-brand text-panel-deep font-bold shrink-0">
                          Active
                        </span>
                      ) : (
                        <span className="text-[9px] font-mono text-ink-subtle hover:text-ink-soft shrink-0">
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
              <div className="flex justify-between py-0.5 border-b border-line">
                <span className="text-ink-muted">Current Period:</span>
                <span className="font-mono font-bold text-ink">
                  {profile.periodLabel}
                </span>
              </div>
              <div className="flex justify-between py-0.5 border-b border-line">
                <span className="text-ink-muted">Date of Last Entry:</span>
                <span className="font-mono font-bold text-ink">
                  {profile.lastEntry}
                </span>
              </div>
              <div className="flex justify-between py-0.5 border-b border-line">
                <span className="text-ink-muted">Accounting Standard:</span>
                <span className="font-mono text-ink">
                  ALERX 4-Tier Double Entry
                </span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-ink-muted">Authoritative Ledger:</span>
                <span className="font-mono text-emerald-700 font-semibold flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
                  PostgreSQL Active
                </span>
              </div>
            </div>
          </div>

          <div className="pt-2 mt-1.5 border-t border-line text-[10px] text-ink-muted">
            <p className="font-mono text-[9px] text-ink-subtle">
              Press <strong>F3</strong> or click above to shift company. Highlighted keys open menu items directly.
            </p>
          </div>
        </div>

        <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-2 gap-3.5 items-stretch">
        {/* ========================================================================= */}
        {/* Column 2 (Center): Gateway of Deku Navigation Menu (Enlarged & Focused)  */}
        {/* ========================================================================= */}
        <div className="min-w-0 bg-surface border border-edge rounded-xl shadow-md overflow-hidden flex flex-col justify-between">
          <div>
            {/* Menu Title Header */}
            <div className="bg-panel px-3.5 py-1.5 border-b border-edge flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-brand" />
                <span className="text-xs font-mono font-black tracking-wider uppercase">
                  Gateway of Deku
                </span>
              </div>
              <span className="text-[10px] font-mono text-brand-soft truncate max-w-[220px] bg-white/10 px-2 py-0.5 rounded border border-brand/30">
                🏢 {companyShortName} Workspace
              </span>
            </div>

            <div className="p-2.5 space-y-1.5 divide-y divide-line text-xs font-sans">
              {/* EXECUTIVE DASHBOARD & DEKU KONSULTANT SPOTLIGHT */}
              <div className="pb-0.5">
                <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-ink-soft mb-1 px-1.5 flex items-center justify-between">
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
                      <span className="text-[10px] text-ink-subtle block font-mono">
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
                <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-ink-soft mb-0.5 px-1.5">
                  Masters
                </div>
                <div className="space-y-0.5">
                  <Link
                    href="/masters/chart-of-accounts"
                    className="flex items-center justify-between px-2 py-0.5 rounded hover:bg-brand/10 text-ink hover:text-ink transition-colors font-medium"
                  >
                    <span>
                      <u>C</u>hart of <u>A</u>ccounts (ALERX Ledgers)
                    </span>
                    <kbd className="font-mono text-[10px] font-bold text-ink-soft bg-canvas-sunken px-1.5 py-0.2 rounded border border-line-strong">
                      A
                    </kbd>
                  </Link>
                  <Link
                    href="/masters/parties"
                    className="flex items-center justify-between px-2 py-0.5 rounded hover:bg-brand/10 text-ink hover:text-ink transition-colors font-medium"
                  >
                    <span>
                      <u>P</u>arties (Customers &amp; Vendors Master)
                    </span>
                    <kbd className="font-mono text-[10px] font-bold text-ink-soft bg-canvas-sunken px-1.5 py-0.2 rounded border border-line-strong">
                      P
                    </kbd>
                  </Link>
                  <Link
                    href="/masters/products-services"
                    className="flex items-center justify-between px-2 py-0.5 rounded hover:bg-brand/10 text-ink hover:text-ink transition-colors font-medium"
                  >
                    <span>
                      Stock &amp; Services <u>I</u>tems
                    </span>
                    <kbd className="font-mono text-[10px] font-bold text-ink-soft bg-canvas-sunken px-1.5 py-0.2 rounded border border-line-strong">
                      I
                    </kbd>
                  </Link>
                </div>
              </div>

              {/* TRANSACTIONS */}
              <div className="pt-1.5">
                <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-ink-soft mb-0.5 px-1.5">
                  Transactions &amp; Registers
                </div>
                <div className="space-y-0.5">
                  <Link
                    href="/vouchers"
                    className="flex items-center justify-between px-2 py-0.5 rounded hover:bg-brand/10 text-ink hover:text-ink transition-colors font-medium"
                  >
                    <span>
                      Accounting <u>V</u>ouchers (F4-F9)
                    </span>
                    <kbd className="font-mono text-[10px] font-bold text-white bg-panel px-1.5 py-0.2 rounded border border-edge">
                      V
                    </kbd>
                  </Link>
                  <Link
                    href="/day-book"
                    className="flex items-center justify-between px-2 py-0.5 rounded hover:bg-brand/10 text-ink hover:text-ink transition-colors font-medium"
                  >
                    <span>
                      <u>D</u>ay Book (Chronological Register)
                    </span>
                    <kbd className="font-mono text-[10px] font-bold text-ink-soft bg-canvas-sunken px-1.5 py-0.2 rounded border border-line-strong">
                      D
                    </kbd>
                  </Link>
                  <Link
                    href="/builder"
                    className="flex items-center justify-between px-2 py-0.5 rounded hover:bg-brand/10 text-ink hover:text-ink transition-colors font-medium"
                  >
                    <span className="flex items-center gap-1.5">
                      <span><u>B</u>uilder (Docs, Quotes &amp; Coupons)</span>
                      <span className="text-[9px] px-1 py-0.1 rounded bg-teal-100 text-teal-900 font-bold">New</span>
                    </span>
                    <kbd className="font-mono text-[10px] font-bold text-white bg-panel px-1.5 py-0.2 rounded border border-edge">
                      Shift+B
                    </kbd>
                  </Link>
                </div>
              </div>

              {/* FINANCIAL REPORTS */}
              <div className="pt-1.5">
                <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-ink-soft mb-0.5 px-1.5">
                  Financial Reports
                </div>
                <div className="space-y-0.5">
                  <Link
                    href="/reports/balance-sheet"
                    className="flex items-center justify-between px-2 py-0.5 rounded hover:bg-brand/10 text-ink hover:text-ink transition-colors font-medium"
                  >
                    <span>
                      <u>B</u>alance Sheet
                    </span>
                    <kbd className="font-mono text-[10px] font-bold text-ink-soft bg-canvas-sunken px-1.5 py-0.2 rounded border border-line-strong">
                      B
                    </kbd>
                  </Link>
                  <Link
                    href="/reports/profit-loss"
                    className="flex items-center justify-between px-2 py-0.5 rounded hover:bg-brand/10 text-ink hover:text-ink transition-colors font-medium"
                  >
                    <span>
                      Pr<u>o</u>fit &amp; Loss A/c
                    </span>
                    <kbd className="font-mono text-[10px] font-bold text-ink-soft bg-canvas-sunken px-1.5 py-0.2 rounded border border-line-strong">
                      O
                    </kbd>
                  </Link>
                  <Link
                    href="/reports/trial-balance"
                    className="flex items-center justify-between px-2 py-0.5 rounded hover:bg-brand/10 text-ink hover:text-ink transition-colors font-medium"
                  >
                    <span>
                      <u>T</u>rial Balance
                    </span>
                    <kbd className="font-mono text-[10px] font-bold text-ink-soft bg-canvas-sunken px-1.5 py-0.2 rounded border border-line-strong">
                      T
                    </kbd>
                  </Link>
                  <Link
                    href="/reports/cash-flow"
                    className="flex items-center justify-between px-2 py-0.5 rounded hover:bg-brand/10 text-ink hover:text-ink transition-colors font-medium"
                  >
                    <span>
                      <u>C</u>ash Flow (WCM)
                    </span>
                    <kbd className="font-mono text-[10px] font-bold text-brand bg-panel px-1.5 py-0.2 rounded border border-edge">
                      C
                    </kbd>
                  </Link>
                  <Link
                    href="/reports/fpa"
                    className="flex items-center justify-between px-2 py-0.5 rounded hover:bg-brand/10 text-ink hover:text-ink transition-colors font-medium"
                  >
                    <span>
                      <u>F</u>P&amp;A Intelligence
                    </span>
                    <kbd className="font-mono text-[10px] font-bold text-brand bg-panel px-1.5 py-0.2 rounded border border-edge">
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
                    <kbd className="font-mono text-[10px] font-bold text-white bg-panel px-1.5 py-0.2 rounded border border-edge">
                      K
                    </kbd>
                  </Link>
                </div>
              </div>

              {/* UTILITIES & STATUTORY */}
              <div className="pt-1.5">
                <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-ink-soft mb-0.5 px-1.5">
                  Utilities &amp; Statutory
                </div>
                <div className="space-y-0.5">
                  <Link
                    href="/gst"
                    className="flex items-center justify-between px-2 py-0.5 rounded hover:bg-brand/10 text-ink hover:text-ink transition-colors font-medium"
                  >
                    <span>
                      <u>G</u>ST Returns &amp; Tax Breakdown
                    </span>
                    <kbd className="font-mono text-[10px] font-bold text-ink-soft bg-canvas-sunken px-1.5 py-0.2 rounded border border-line-strong">
                      G
                    </kbd>
                  </Link>
                  <Link
                    href="/departments-members"
                    className="flex items-center justify-between px-2 py-0.5 rounded hover:bg-brand/10 text-ink hover:text-ink transition-colors font-medium"
                  >
                    <span>
                      Departments &amp; <u>M</u>embers
                    </span>
                    <kbd className="font-mono text-[10px] font-bold text-white bg-panel px-1.5 py-0.2 rounded border border-edge">
                      M
                    </kbd>
                  </Link>
                  <Link
                    href="/audit"
                    className="flex items-center justify-between px-2 py-0.5 rounded hover:bg-brand/10 text-ink hover:text-ink transition-colors font-medium"
                  >
                    <span>
                      User Activity &amp; Audit <u>L</u>ogs
                    </span>
                    <kbd className="font-mono text-[10px] font-bold text-white bg-panel px-1.5 py-0.2 rounded border border-edge">
                      L
                    </kbd>
                  </Link>
                  <Link
                    href="/settings"
                    className="flex items-center justify-between px-2 py-0.5 rounded hover:bg-brand/10 text-ink hover:text-ink transition-colors font-medium"
                  >
                    <span>
                      <u>S</u>ettings &amp; Accounting Preferences
                    </span>
                    <kbd className="font-mono text-[10px] font-bold text-ink-soft bg-canvas-sunken px-1.5 py-0.2 rounded border border-line-strong">
                      S
                    </kbd>
                  </Link>

                </div>
              </div>
            </div>
          </div>

          {/* Balanced Card Footer */}
          <div className="px-3.5 py-1.5 bg-canvas border-t border-line flex items-center justify-between text-xs">
            <span className="text-[10px] font-mono text-ink-muted">
              Press highlighted key to navigate
            </span>
            <span className="text-[10px] font-mono text-brand-strong font-semibold">
              ALERX Double-Entry
            </span>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* Column 3 (Right): Quick KPI Table (Dynamically Synced with Company)       */}
        {/* ========================================================================= */}
        <div className="min-w-0 bg-surface border border-edge rounded-xl shadow-md overflow-hidden flex flex-col justify-between">
          <div>
            {/* KPI Title Header */}
            <div className="bg-panel px-3.5 py-1.5 border-b border-edge flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-brand" />
                <span className="text-xs font-mono font-black tracking-wider uppercase">
                  Quick Business KPIs
                </span>
              </div>
              <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1 font-bold">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
                From the books ({companyShortName})
              </span>
            </div>

            {/* Top Revenue & Margin Highlight Strip with Direct Drilldown */}
            <div className="p-2.5 bg-canvas border-b border-line grid grid-cols-2 gap-2">
              <Link
                href="/gst"
                className="p-1.5 rounded bg-surface hover:bg-brand/10 border border-line/80 hover:border-brand block shadow-2xs group transition-all cursor-pointer"
                title="View Sales Invoices & Billed Turnover Register"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-ink-muted uppercase block font-semibold group-hover:text-ink transition-colors">
                    Turnover (FY to date)
                  </span>
                  <ArrowUpRight className="h-3 w-3 text-ink-subtle group-hover:text-brand transition-colors" />
                </div>
                <span className="text-base font-black font-mono text-ink group-hover:text-brand-strong transition-colors">
                  {profile.turnover}
                </span>
              </Link>
              <Link
                href="/reports/profit-loss"
                className="p-1.5 rounded bg-surface hover:bg-brand/10 border border-line/80 hover:border-brand text-right block shadow-2xs group transition-all cursor-pointer"
                title="View Profit & Loss Account & Net Profit Statement (O)"
              >
                <div className="flex items-center justify-end gap-1">
                  <span className="text-[10px] font-mono text-ink-muted uppercase block font-semibold group-hover:text-ink transition-colors">
                    Net Profit
                  </span>
                  <ArrowUpRight className="h-3 w-3 text-ink-subtle group-hover:text-brand transition-colors" />
                </div>
                <span className="text-base font-black font-mono text-emerald-700 group-hover:text-emerald-600 transition-colors">
                  {profile.profit}
                </span>
              </Link>
            </div>

            {/* Quick KPI Table: Numerical Business Metrics with Direct Drilldown */}
            <div className="p-2.5 space-y-1.5 text-xs">
              <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-ink-soft px-1 flex items-center justify-between">
                <span>Business Metric (Click to view details)</span>
                <span>Position / Amount</span>
              </div>

              <div className="divide-y divide-line border border-line rounded overflow-hidden bg-surface text-xs">
                {/* 1. Billed Turnover & Invoices Hub -> /gst */}
                {show("billed") && (
                <Link
                  href="/gst"
                  className="flex items-center justify-between px-2.5 py-1.5 hover:bg-brand/10 transition-colors group cursor-pointer"
                  title="Open Sales Invoices Register, Issuance & Conversion Tracking"
                >
                  <div>
                    <div className="flex items-center gap-1">
                      <span className="font-semibold text-ink group-hover:text-ink block text-xs">
                        Billed Turnover
                      </span>
                      <ArrowUpRight className="h-3 w-3 text-ink-soft opacity-40 group-hover:opacity-100 group-hover:text-brand transition-all" />
                    </div>
                    <span className="text-[10px] text-ink-subtle font-mono">{profile.billedLimit}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-bold text-ink group-hover:text-brand block transition-colors text-xs">
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
                )}

                {/* 2. Liquid Funds (Cash & Bank) -> /masters/chart-of-accounts?group=asset&filter=liquid */}
                {show("liquid") && (
                <Link
                  href="/masters/chart-of-accounts?group=asset&filter=liquid"
                  className="flex items-center justify-between px-2.5 py-1.5 hover:bg-brand/10 transition-colors group cursor-pointer"
                  title="Open Chart of Accounts: Liquid Cash & Bank Asset Units and Values"
                >
                  <div>
                    <div className="flex items-center gap-1">
                      <span className="font-semibold text-ink group-hover:text-ink block text-xs">
                        Liquid Funds
                      </span>
                      <ArrowUpRight className="h-3 w-3 text-ink-soft opacity-40 group-hover:opacity-100 group-hover:text-brand transition-all" />
                    </div>
                    <span className="text-[10px] text-ink-subtle font-mono">{profile.liquidBank}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-bold text-emerald-700 group-hover:text-emerald-600 block transition-colors text-xs">
                      {profile.liquid}
                    </span>
                    <span className="text-[10px] text-ink-subtle font-mono">Instant Liquidity</span>
                  </div>
                </Link>
                )}

                {/* 3. Trade Debtors (AR DSO Tracking) -> /reports/debtors */}
                {show("debtors") && (
                <Link
                  href="/reports/debtors"
                  className="flex items-center justify-between px-2.5 py-1.5 hover:bg-brand/10 transition-colors group cursor-pointer"
                  title="Open Trade Debtors (AR) DSO Analysis & Customer Outstanding Invoices"
                >
                  <div>
                    <div className="flex items-center gap-1">
                      <span className="font-semibold text-ink group-hover:text-ink block text-xs">
                        Trade Debtors (AR)
                      </span>
                      <ArrowUpRight className="h-3 w-3 text-ink-soft opacity-40 group-hover:opacity-100 group-hover:text-brand transition-all" />
                    </div>
                    <span className="text-[10px] text-ink-subtle font-mono">{profile.debtorsCount}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-bold text-ink group-hover:text-brand block transition-colors text-xs">
                      {profile.debtors}
                    </span>
                    <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-200 font-semibold">
                      {profile.debtorsAging}
                    </span>
                  </div>
                </Link>
                )}

                {/* 4. Trade Creditors (AP DPO Tracking) -> /reports/creditors */}
                {show("creditors") && (
                <Link
                  href="/reports/creditors"
                  className="flex items-center justify-between px-2.5 py-1.5 hover:bg-brand/10 transition-colors group cursor-pointer"
                  title="Open Trade Creditors (AP) DPO Analysis & Vendor Bills Tracker"
                >
                  <div>
                    <div className="flex items-center gap-1">
                      <span className="font-semibold text-ink group-hover:text-ink block text-xs">
                        Trade Creditors (AP)
                      </span>
                      <ArrowUpRight className="h-3 w-3 text-ink-soft opacity-40 group-hover:opacity-100 group-hover:text-brand transition-all" />
                    </div>
                    <span className="text-[10px] text-ink-subtle font-mono">{profile.creditorsCount}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-bold text-ink group-hover:text-brand block transition-colors text-xs">
                      {profile.creditors}
                    </span>
                    <span className="text-[10px] text-ink-subtle font-mono">{profile.creditorsTerms}</span>
                  </div>
                </Link>
                )}

                {/* 5. Operating Expenses & Payment Vouchers -> /reports/operating-expenses */}
                {show("expenses") && (
                <Link
                  href="/reports/operating-expenses"
                  className="flex items-center justify-between px-2.5 py-1.5 hover:bg-brand/10 transition-colors group cursor-pointer"
                  title="Open Operating Expenses Hub: Payment Vouchers & Department-wise Tracking"
                >
                  <div>
                    <div className="flex items-center gap-1">
                      <span className="font-semibold text-ink group-hover:text-ink block text-xs">
                        Operating Expenses
                      </span>
                      <ArrowUpRight className="h-3 w-3 text-ink-soft opacity-40 group-hover:opacity-100 group-hover:text-brand transition-all" />
                    </div>
                    <span className="text-[10px] text-ink-subtle font-mono">{profile.expensesHeads}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-bold text-ink group-hover:text-brand block transition-colors text-xs">
                      {profile.expenses}
                    </span>
                    <span className="text-[10px] text-ink-subtle font-mono">{profile.expenseRatio}</span>
                  </div>
                </Link>
                )}

                {/* 6. GST Net Liability -> /gst */}
                {show("gst") && (
                <Link
                  href="/gst"
                  className="flex items-center justify-between px-2.5 py-1.5 hover:bg-brand/10 transition-colors group cursor-pointer"
                  title="Open GST Returns & Tax Breakdown Hub (G)"
                >
                  <div>
                    <div className="flex items-center gap-1">
                      <span className="font-semibold text-ink group-hover:text-ink block text-xs">
                        GST Net Payable
                      </span>
                      <ArrowUpRight className="h-3 w-3 text-ink-soft opacity-40 group-hover:opacity-100 group-hover:text-brand transition-all" />
                    </div>
                    <span className="text-[10px] text-ink-subtle font-mono">{profile.gstBreakdown}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-bold text-rose-700 group-hover:text-rose-600 block transition-colors text-xs">
                      {profile.gst}
                    </span>
                    <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-canvas-sunken text-ink-soft border border-line">
                      {profile.gstStatus}
                    </span>
                  </div>
                </Link>
                )}
              </div>
            </div>
          </div>

          {/* Bottom Card Footer with Direct Drilldown to Executive Dashboard & Deku Consultant */}
          <div className="px-3.5 py-1.5 bg-canvas border-t border-line flex items-center justify-between text-xs">
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
              className="inline-flex items-center gap-1 font-bold text-ink hover:text-brand transition-colors"
              title="Open Executive Dashboard & AI CFO (E)"
            >
              <span>Executive Dashboard (E)</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
