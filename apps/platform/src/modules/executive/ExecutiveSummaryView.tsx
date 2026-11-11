"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  ArrowDownLeft,
  FileText,
  BookOpen,
  ChevronDown,
  AlertCircle,
  ShieldCheck,
  SlidersHorizontal,
  Scale,
} from "lucide-react";
import { WorkspaceLayout } from "@/layouts/WorkspaceLayout";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { invoicesApi, organisationsApi, reportsApi, OrgSummary } from "@/api/endpoints";
import { loadOrgTaxProfile, convertOrgToGst, validateGstin, OrgTaxProfile } from "@/lib/org-regime";
import { emptyKpis, formatKpis, FormattedKpiProfile } from "@/lib/kpi/kpi-service";
import { fyStart, LedgerKpis, toLedgerKpis, toRupees } from "@/lib/reports/ledger";
import { formatINR } from "@/lib/formatters/currency";
import { toISODateString } from "@/lib/formatters/date";
import { setActiveOrg } from "@/lib/organisation/active-org";
import { useOptionalLearnDemo } from "@/context/LearnDemoContext";
import type { ProfitLossRow, SalesInvoice } from "@/types/accounting";
import { CustomizeKpiModal } from "./CustomizeKpiModal";
import { InvoicesInProgress, WhereMoneyGoes, Slot } from "./ActivityPanels";

const KEYCAP =
  "font-mono text-[11px] leading-none px-1.5 pt-[3px] pb-[2px] rounded-[5px] border border-line-strong border-b-2 bg-surface text-ink-muted";
const CHIP = "inline-flex items-center h-[22px] px-2 rounded-chip text-xs font-medium whitespace-nowrap";
const money = (p: number) => formatINR(toRupees(p), { minimumFractionDigits: 0 });
const failed = (e: any) => ({ error: e?.message || "The server did not answer" });

function KpiTile({
  href,
  title,
  label,
  chip,
  value,
  children,
}: {
  href: string;
  title: string;
  label: string;
  chip?: React.ReactNode;
  value: string;
  children?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      title={title}
      className="block rounded-panel border border-line bg-surface px-[18px] py-4 hover:border-line-strong hover:bg-canvas/40 transition-colors min-w-0"
    >
      <div className="flex items-center gap-2 text-[13px] text-ink-muted">
        <span className="truncate">{label}</span>
        {chip && <span className="ml-auto">{chip}</span>}
      </div>
      <div className="mt-1.5 mb-1 text-[26px] leading-tight font-semibold tracking-[-0.035em] text-ink tabular-nums truncate">
        {value}
      </div>
      <div className="text-[12.5px] text-ink-muted">{children}</div>
    </Link>
  );
}

function BalanceHealth({ ledger, kpi }: { ledger: LedgerKpis | null; kpi: FormattedKpiProfile }) {
  const a = ledger?.assetsPaise ?? null;
  const l = ledger?.liabilitiesPaise ?? null;
  const e = ledger?.equityPaise ?? null;
  // The API gives three totals only, so Assets is one bar and the other side splits into Liabilities + Equity.
  const drawable = a !== null && l !== null && e !== null && a >= 0 && l >= 0 && e >= 0 && a + l + e > 0;
  const scale = drawable ? Math.max(a, l + e) || 1 : 1;
  const w = (v: number) => `${(v / scale) * 100}%`;
  const le = l !== null && e !== null ? money(l + e) : "–";

  const line = (name: string, note: string, total: string, bar: React.ReactNode, legend: React.ReactNode) => (
    <div className="mt-4">
      <div className="grid grid-cols-[1fr_auto] sm:grid-cols-[150px_1fr_130px] items-center gap-x-4 gap-y-2">
        <div className="text-[13.5px] font-[550] text-ink leading-snug">
          {name}
          <small className="block text-[12.5px] font-normal text-ink-muted">{note}</small>
        </div>
        <div className="col-span-2 sm:col-span-1 order-last sm:order-none flex h-[30px] gap-[2px] rounded-[8px] overflow-hidden bg-canvas-sunken">
          {bar}
        </div>
        <div className="text-right text-[16px] font-semibold text-ink tabular-nums">{total}</div>
      </div>
      <div className="mt-2 sm:pl-[166px] flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-ink-soft">{legend}</div>
    </div>
  );
  const key = (color: string, text: string) => (
    <span className="inline-flex items-center gap-1.5">
      <i className={`inline-block h-2 w-2 rounded-[2px] ${color}`} />
      {text}
    </span>
  );

  return (
    <section className="rounded-panel border border-line bg-surface min-w-0">
      <div className="px-5 pt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-[15px] font-semibold tracking-tight text-ink">Balance health</h2>
        <p className="text-[13px] text-ink-muted">Computed from posted journal entries</p>
        <div className="ml-auto flex gap-3 text-[13px] font-medium">
          <Link href="/reports/balance-sheet" className="text-brand-strong hover:underline">
            Balance sheet
          </Link>
          <Link href="/reports/trial-balance" className="text-brand-strong hover:underline">
            Trial balance
          </Link>
        </div>
      </div>
      <div className="px-5 pb-[18px] pt-1">
        {line(
          "Assets",
          "What the business holds",
          kpi.assets,
          drawable && <span className="h-full bg-brand-strong" style={{ width: w(a) }} />,
          key("bg-brand-strong", `All asset ledgers ${kpi.assets}`)
        )}
        {line(
          "Liabilities + equity",
          "Who it is owed to",
          le,
          drawable && (
            <>
              {e > 0 && <span className="h-full bg-ink" style={{ width: w(e) }} />}
              {l > 0 && <span className="h-full bg-ink-subtle" style={{ width: w(l) }} />}
            </>
          ),
          <>
            {key("bg-ink", `Equity incl. profit to date ${kpi.equity}`)}
            {key("bg-ink-subtle", `Liabilities ${kpi.liabilities}`)}
          </>
        )}
        {ledger && ledger.hasEntries && !drawable && (
          <p className="mt-3 text-[12.5px] text-ink-muted">Bars are not drawn because one of the totals is negative.</p>
        )}
        <div className="mt-4 pt-3.5 border-t border-line flex flex-wrap items-center gap-x-2.5 gap-y-2 text-[13.5px] text-ink-soft">
          <Scale className="h-4 w-4 text-ink-muted" />
          <span>
            Assets <b className="font-semibold text-ink tabular-nums">{kpi.assets}</b>
          </span>
          <span>
            = Liabilities <b className="font-semibold text-ink tabular-nums">{kpi.liabilities}</b>
          </span>
          <span>
            + Equity <b className="ledger-total font-semibold text-ink tabular-nums">{kpi.equity}</b>
          </span>
          <span className="ml-auto">
            {kpi.balanced === null ? (
              <span className={`${CHIP} bg-canvas-sunken text-ink-soft`}>No posted entries yet</span>
            ) : kpi.balanced ? (
              <span className={`${CHIP} bg-ok-wash text-ok`}>Balanced</span>
            ) : (
              <span className={`${CHIP} bg-bad-wash text-bad`}>Debits and credits differ</span>
            )}
          </span>
        </div>
      </div>
    </section>
  );
}

function RecordSomething({ isSec22 }: { isSec22: boolean }) {
  const flows = [
    { href: "/vouchers/payment", icon: <ArrowUpRight className="h-4 w-4" />, title: "Payment", note: "Vendor and expense payouts", k: "F5" },
    { href: "/vouchers/receipt", icon: <ArrowDownLeft className="h-4 w-4" />, title: "Receipt", note: "Money received from customers", k: "F6" },
    {
      href: "/vouchers/sales",
      icon: <FileText className="h-4 w-4" />,
      title: isSec22 ? "Bill of supply" : "Sales invoice",
      note: isSec22 ? "Sec 22, no GST charged" : "GST tax invoice",
      k: "F8",
    },
    { href: "/day-book", icon: <BookOpen className="h-4 w-4" />, title: "Day Book", note: "Every voucher in date order", k: "D" },
  ];
  return (
    <section className="rounded-panel border border-line bg-surface min-w-0">
      <div className="px-5 pt-4">
        <h2 className="text-[15px] font-semibold tracking-tight text-ink">Record something</h2>
      </div>
      <div className="px-2 pt-1.5 pb-2.5">
        {flows.map((f) => (
          <Link key={f.href} href={f.href} className="flex items-center gap-3 px-3 py-2.5 rounded-[10px] hover:bg-brand-wash transition-colors">
            <span className="h-8 w-8 shrink-0 rounded-[8px] bg-canvas-sunken text-ink-soft grid place-items-center">{f.icon}</span>
            <span className="flex-1 min-w-0 leading-tight">
              <strong className="block text-[14px] font-[550] text-ink">{f.title}</strong>
              <small className="block text-[12.5px] text-ink-muted truncate">{f.note}</small>
            </span>
            <kbd className={KEYCAP}>{f.k}</kbd>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function ExecutiveSummaryView() {
  const router = useRouter();
  const demo = useOptionalLearnDemo();

  const [activeOrgId, setActiveOrgId] = useState("");
  const [activeOrgName, setActiveOrgName] = useState("");
  const [taxProfile, setTaxProfile] = useState<OrgTaxProfile | null>(null);

  // Conversion Modal State
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
  const [newGstin, setNewGstin] = useState("");
  const [convertError, setConvertError] = useState<string | null>(null);
  const [isConverting, setIsConverting] = useState(false);

  // KPI Customizer Modal State & Profile
  const [isKpiModalOpen, setIsKpiModalOpen] = useState(false);
  const [kpiProfile, setKpiProfile] = useState<FormattedKpiProfile>(emptyKpis);
  const [ledger, setLedger] = useState<LedgerKpis | null>(null);
  const [invoices, setInvoices] = useState<Slot<SalesInvoice[]>>();
  const [expenses, setExpenses] = useState<Slot<ProfitLossRow[]>>();

  const [orgList, setOrgList] = useState<OrgSummary[]>([]);
  // Read the clock only once invoices have loaded in the browser, never during prerender.
  const today = invoices?.rows ? toISODateString() : "";

  // Synchronize active organization from storage
  const syncFromStorage = () => {
    if (typeof window !== "undefined") {
      const savedId = localStorage.getItem("deku_active_org_id");
      const savedName = localStorage.getItem("deku_active_org_name");
      if (savedId) setActiveOrgId(savedId);
      if (savedName) setActiveOrgName(savedName);
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

    window.addEventListener("deku_active_org_changed", handleOrgChanged);
    window.addEventListener("deku_org_regime_changed", handleRegimeChanged);

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
    };
  }, [activeOrgId]);

  // Load the company's regime, KPIs, invoices and expense heads from its record and books
  useEffect(() => {
    if (!activeOrgId) return;
    let live = true;
    setTaxProfile(null);
    setKpiProfile(emptyKpis());
    setLedger(null);
    setInvoices(undefined);
    setExpenses(undefined);
    loadOrgTaxProfile(activeOrgId).then((p) => live && setTaxProfile(p));
    invoicesApi.list(activeOrgId).then(
      (r) => live && setInvoices({ rows: r.data || [] }),
      (e) => live && setInvoices(failed(e))
    );
    const asOf = toISODateString();
    organisationsApi
      .get(activeOrgId)
      .then((org) => {
        const from = fyStart(asOf, org.data?.[0]?.financial_year_start_month || 4);
        reportsApi
          .getKpis(activeOrgId, from, asOf)
          .then((k) => {
            if (!live) return;
            const kp = toLedgerKpis(k.data);
            setLedger(kp);
            setKpiProfile(formatKpis(kp, from, asOf));
          })
          .catch(() => {});
        return reportsApi.getProfitAndLoss(activeOrgId, { from, to: asOf });
      })
      .then(
        (r) => live && setExpenses({ rows: r.data || [] }),
        (e) => live && setExpenses(failed(e))
      );
    return () => {
      live = false;
    };
  }, [activeOrgId]);

  const handleSwitchOrg = (orgId: string) => {
    const found = orgList.find((o) => o.id === orgId);
    if (!found) return;

    setActiveOrgId(found.id);
    setActiveOrgName(found.name);
    setActiveOrg(found);
  };

  // Handle conversion of a Sec 22 organisation to GST Registered
  const handleConfirmGstConversion = async (e: React.FormEvent) => {
    e.preventDefault();
    setConvertError(null);

    const validation = validateGstin(newGstin);
    if (!validation.isValid) {
      setConvertError(validation.error || "Invalid GSTIN format");
      return;
    }

    setIsConverting(true);
    try {
      const result = await convertOrgToGst(activeOrgId, newGstin);
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
        if (demo) demo.navigateTo("/gateway");
        else router.push("/gateway");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router, demo, isConvertModalOpen]);

  const isSec22 = taxProfile?.regime === "sec22";
  const marginTone = kpiProfile.margin === "–" ? "text-ink-muted" : kpiProfile.margin.startsWith("-") ? "text-bad" : "text-ok";
  const sec22Tone = { safe: "text-ok", warn: "text-warn", corp: "text-bad" }[kpiProfile.sec22Variant];

  const actions = (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <select
          id="executive-company-selector"
          value={activeOrgId}
          onChange={(e) => handleSwitchOrg(e.target.value)}
          className="h-9 max-w-[240px] appearance-none rounded-ctl border border-line-strong bg-surface pl-3 pr-8 text-[13.5px] font-medium text-ink cursor-pointer hover:bg-canvas focus:border-brand focus:outline-none focus:ring-3 focus:ring-brand/20 truncate"
          title="Select active company workspace"
        >
          {orgList.map((org) => (
            <option key={org.id} value={org.id}>
              {org.name}
            </option>
          ))}
        </select>
        <ChevronDown className="h-4 w-4 text-ink-muted absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>

      {/* Organisation-level tax regime (a property of the company, not a view toggle) */}
      <div suppressHydrationWarning className="contents">
        {!taxProfile ? null : isSec22 ? (
          <Button
            variant="outline"
            size="md"
            onClick={() => {
              setConvertError(null);
              setNewGstin("");
              setIsConvertModalOpen(true);
            }}
            title="A Sec 22 company can convert to GST registered once it gets a valid GST ID"
          >
            <ShieldCheck className="h-4 w-4 text-brand-strong" />
            Convert to GST
          </Button>
        ) : (
          taxProfile.gstin && (
            <span
              suppressHydrationWarning
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-ctl bg-brand-wash text-[13px] text-brand-strong"
              title="GST Registered entity. Under statutory law, a GST company cannot revert to Sec 22 and operates on the GST module."
            >
              GSTIN <span className="font-mono text-[12.5px] text-ink">{taxProfile.gstin}</span>
            </span>
          )
        )}
      </div>

      <Button variant="secondary" onClick={() => setIsKpiModalOpen(true)} title="Choose which KPIs the Gateway lists">
        <SlidersHorizontal className="h-4 w-4" />
        Customize KPIs
      </Button>

      <Link
        href="/gateway"
        className="inline-flex items-center gap-2 h-9 px-3.5 rounded-ctl border border-line-strong bg-surface text-[13.5px] font-medium text-ink hover:bg-canvas transition-colors"
        title="Return to Gateway (Esc)"
      >
        Gateway
        <kbd className={KEYCAP}>Esc</kbd>
      </Link>
    </div>
  );

  const regimeChip = !taxProfile ? undefined : isSec22 ? (
    <span className={`${CHIP} bg-canvas-sunken text-ink-soft`} title="No GSTIN on the company record, so it is treated as unregistered (Sec 22) and issues Bills of Supply.">
      Sec 22
    </span>
  ) : (
    <span className={`${CHIP} bg-brand-wash text-brand-strong`}>Registered</span>
  );

  return (
    <WorkspaceLayout
      title="Executive summary"
      subtitle={`${activeOrgName || "–"}, from posted vouchers only${kpiProfile.periodLabel !== "–" ? ` (${kpiProfile.periodLabel})` : ""}`}
      actions={actions}
    >
      <div className="space-y-[18px] pb-4">
        {/* KPI tiles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5">
          <KpiTile href="/gst" title="Open Sales Invoices Register & Billed Turnover Tracker" label="Turnover, FY to date" value={kpiProfile.turnover}>
            {kpiProfile.sec22Sub}
            <div className="mt-2.5 h-1.5 rounded-[3px] bg-canvas-sunken overflow-hidden">
              <div className="h-full rounded-[3px] bg-brand" style={{ width: `${kpiProfile.sec22Pct ?? 0}%` }} />
            </div>
            {isSec22 && kpiProfile.sec22Badge !== "–" && <div className={`mt-1.5 ${sec22Tone}`}>{kpiProfile.sec22Badge}</div>}
          </KpiTile>

          <KpiTile href="/reports/profit-loss" title="Open Profit & Loss Account (L)" label="Net profit" value={kpiProfile.profit}>
            <b className={`font-[550] ${marginTone}`}>{kpiProfile.margin}</b> net margin
          </KpiTile>

          <KpiTile
            href="/masters/chart-of-accounts?group=asset&filter=liquid"
            title="Open Chart of Accounts: Liquid Cash & Bank Asset Units and Values"
            label="Liquid cash & bank"
            value={kpiProfile.liquid}
          >
            <span className="block truncate">{kpiProfile.liquidBank}</span>
          </KpiTile>

          <KpiTile href="/reports/debtors" title="Open Trade Debtors (AR) DSO Analysis & Customer Invoices" label="Trade debtors" value={kpiProfile.debtors}>
            {ledger && ledger.debtorsOver45Count > 0 ? (
              <span className={`${CHIP} bg-warn-wash text-warn`}>
                {ledger.debtorsOver45Count} aged over 45 days
              </span>
            ) : (
              kpiProfile.debtorsCount
            )}
          </KpiTile>

          <KpiTile
            href="/gst"
            title={isSec22 ? "Section 22 Exemption Hub" : "Open GST Returns & Tax Engine Hub (G)"}
            label={isSec22 ? "Statutory status" : "GST net payable"}
            chip={regimeChip}
            value={isSec22 ? "Not registered" : kpiProfile.gst}
          >
            {isSec22 ? "Exempt under § 22, issues bills of supply" : kpiProfile.gstBreakdown}
          </KpiTile>
        </div>

        {/* Balance health + shortcuts */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-[18px]">
          <BalanceHealth ledger={ledger} kpi={kpiProfile} />
          <RecordSomething isSec22={isSec22} />
        </div>

        {/* What is moving: invoices and spending */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-[18px]">
          <InvoicesInProgress slot={invoices} today={today} />
          <WhereMoneyGoes
            slot={expenses}
            payables={ledger && ledger.creditorsPaise !== null ? { amount: kpiProfile.creditors, count: ledger.creditorsCount } : null}
          />
        </div>
      </div>

      {/* Convert Sec 22 Organisation to GST Registered Modal */}
      <Modal
        isOpen={isConvertModalOpen}
        onClose={() => setIsConvertModalOpen(false)}
        title="Convert organisation to GST"
        description={`Add a valid GSTIN to turn on the GST module for ${activeOrgName}`}
        maxWidth="lg"
      >
        <form onSubmit={handleConfirmGstConversion} className="space-y-4 text-[13.5px]">
          <div className="p-3.5 rounded-[10px] bg-warn-wash text-ink-soft space-y-1.5">
            <div className="flex items-center gap-2 font-semibold text-warn">
              <AlertCircle className="h-4 w-4 shrink-0" />
              This change is permanent
            </div>
            <p className="text-[12.5px] leading-relaxed">
              Once an organisation has a valid GSTIN and moves to the GST regime, the status is <strong>permanent at the organisation level</strong>. The company then runs on the full GST module (CGST/SGST/IGST, GSTR-1 and GSTR-3B, ITC records). <strong>A GST registered company cannot go back to Sec 22.</strong>
            </p>
          </div>

          <Input label="Organisation" value={activeOrgName} disabled readOnly />

          <div>
            <Input
              label="GSTIN (15 characters)"
              id="executive-convert-gstin"
              value={newGstin}
              onChange={(e) => {
                setNewGstin(e.target.value.toUpperCase());
                setConvertError(null);
              }}
              placeholder="e.g. 27AAACD1234E1Z5"
              maxLength={15}
              required
              className="font-mono"
            />
            <span className="text-[12.5px] text-ink-muted mt-1 block">
              2 state digits, 10-character PAN, 1 entity number, &apos;Z&apos;, check digit
            </span>
          </div>

          {convertError && (
            <div className="p-2.5 rounded-[10px] bg-bad-wash text-bad text-[13px] flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{convertError}</span>
            </div>
          )}

          <div className="pt-3 border-t border-line flex items-center justify-end gap-2.5">
            <Button type="button" variant="ghost" onClick={() => setIsConvertModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isConverting}>
              <ShieldCheck className="h-4 w-4" />
              {isConverting ? "Validating and converting…" : "Confirm and turn on GST"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Customize Financial KPIs Modal */}
      <CustomizeKpiModal
        isOpen={isKpiModalOpen}
        onClose={() => setIsKpiModalOpen(false)}
        activeOrgId={activeOrgId}
        activeOrgName={activeOrgName}
      />
    </WorkspaceLayout>
  );
}
