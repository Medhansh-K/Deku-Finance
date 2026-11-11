"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeftRight,
  ArrowRightLeft,
  BookOpen,
  BookText,
  ChevronDown,
  ClipboardCheck,
  FilePen,
  FileText,
  Landmark,
  List,
  MessageSquare,
  Network,
  Package,
  PieChart,
  Plus,
  Receipt,
  Scale,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  TrendingUp,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { organisationsApi, OrgSummary, subscriptionApi } from "@/api/endpoints";
import {
  emptyKpis,
  getQuickKpiKeys,
  loadKpis,
  FormattedKpiProfile,
  KpiKey,
} from "@/lib/kpi/kpi-service";
import { setActiveOrg } from "@/lib/organisation/active-org";
import { GATEWAY_ALPHABET_KEY_MAP, isTargetInteractive } from "@/lib/keyboard/shortcuts";
import { useOptionalLearnDemo } from "@/context/LearnDemoContext";
import { DekuLogo } from "@/components/ui/DekuLogo";
import { GST_STATES } from "@/lib/invoices/tax-summary";
import { formatDateTally } from "@/lib/formatters/date";
import type { Subscription, SubscriptionStatus } from "@/lib/subscription/entitlements";

type ActiveOrg = Pick<OrgSummary, "id" | "name" | "slug" | "currency"> & Partial<Omit<OrgSummary, "id" | "name" | "slug" | "currency">>;

/** Each row's key is a key of GATEWAY_ALPHABET_KEY_MAP, and its link is that key's route, so the cap shown is always the key bound. */
type LaunchItem = { key: string; title: string; desc: string; icon: LucideIcon };
type LaunchGroup = { title: string; items: LaunchItem[] };

const LAUNCH_COLUMNS: LaunchGroup[][] = [
  [
    {
      title: "Transactions & registers",
      items: [
        { key: "V", title: "Accounting vouchers", desc: "Contra, payment, receipt, journal, sales, purchase (F4–F9)", icon: FileText },
        { key: "D", title: "Day Book", desc: "Every voucher in date order", icon: BookOpen },
        { key: "U", title: "Purchases & ITC", desc: "Inward supply and purchase bills", icon: ShoppingCart },
        { key: "W", title: "Collections & WhatsApp", desc: "Unpaid invoices with WhatsApp reminders", icon: MessageSquare },
        { key: "Shift+B", title: "Builder", desc: "Documents, quotes and coupons", icon: FilePen },
      ],
    },
    {
      title: "Utilities & statutory",
      items: [
        { key: "G", title: "GST returns", desc: "GSTR-1, GSTR-3B and tax breakdown", icon: Receipt },
        { key: "M", title: "Departments & members", desc: "Teams, roles and invitations", icon: UsersRound },
        { key: "Q", title: "Approvals queue", desc: "Maker-checker review", icon: ClipboardCheck },
        { key: "R", title: "Reconciliation & settlements", desc: "Bank and marketplace matching", icon: Landmark },
        { key: "L", title: "Audit log", desc: "User activity and changes", icon: ShieldCheck },
        { key: "S", title: "Settings", desc: "Company and accounting preferences", icon: Settings },
      ],
    },
  ],
  [
    {
      title: "Financial reports",
      items: [
        { key: "B", title: "Balance Sheet", desc: "Assets, liabilities and equity", icon: Scale },
        { key: "O", title: "Profit & Loss", desc: "Revenue, expenses and net profit", icon: TrendingUp },
        { key: "T", title: "Trial Balance", desc: "Debit and credit balances", icon: List },
        { key: "N", title: "General Ledger", desc: "One account, every entry", icon: BookText },
        { key: "C", title: "Cash Flow", desc: "Working capital and cash movement", icon: ArrowLeftRight },
        { key: "F", title: "FP&A", desc: "Budgets, forecasts and variance", icon: PieChart },
        { key: "K", title: "Deku Consultant", desc: "Questions answered from your ledger", icon: Sparkles },
      ],
    },
    {
      title: "Masters",
      items: [
        { key: "A", title: "Chart of accounts", desc: "Ledgers and account hierarchy", icon: Network },
        { key: "P", title: "Parties", desc: "Customers and vendors with GSTIN", icon: Users },
        { key: "I", title: "Stock & services", desc: "Items, HSN/SAC codes and tax rates", icon: Package },
      ],
    },
  ],
];

const STATUS: Record<SubscriptionStatus, [string, string]> = {
  trialing: ["Free trial", "text-brand-strong bg-brand-wash"],
  active: ["Active", "text-ok bg-ok-wash"],
  past_due: ["Payment overdue", "text-warn bg-warn-wash"],
  cancelled: ["Cancelled", "text-bad bg-bad-wash"],
  expired: ["Expired", "text-bad bg-bad-wash"],
};

const CHIP = "inline-flex items-center h-[22px] px-2 rounded-chip text-xs font-medium whitespace-nowrap";
const BTN = "inline-flex items-center gap-2 h-9 px-3.5 rounded-ctl text-[13.5px] font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";

function Kbd({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd className={`font-mono text-[11px] leading-none px-1.5 pt-[3px] pb-[2px] rounded-[5px] border border-line-strong border-b-2 bg-surface text-ink-muted ${className}`}>
      {children}
    </kbd>
  );
}

const keyCap = (key: string) => (key === "Shift+B" ? "⇧ B" : key);

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter((w) => /^[A-Za-z0-9]/.test(w))
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("") || "–";

function BookRow({ href, title, label, sub, amount, amountClass = "text-ink", chip }: {
  href: string;
  title: string;
  label: string;
  sub: string;
  amount: string;
  amountClass?: string;
  chip?: React.ReactNode;
}) {
  return (
    <Link href={href} title={title} className="flex items-start gap-3 py-3 border-b border-line last:border-b-0 group">
      <div className="flex-1 min-w-0">
        <span className="block text-sm font-[550] text-ink group-hover:text-brand-strong transition-colors">{label}</span>
        <span className="block text-[12.5px] text-ink-muted">{sub}</span>
      </div>
      <div className="text-right shrink-0">
        <span className={`block text-[15px] font-semibold tabular-nums ${amountClass}`}>{amount}</span>
        {chip && <div className="mt-1">{chip}</div>}
      </div>
    </Link>
  );
}

export function GatewayLanding() {
  const router = useRouter();
  const demo = useOptionalLearnDemo();

  const [orgList, setOrgList] = useState<OrgSummary[]>([]);
  const [orgsLoaded, setOrgsLoaded] = useState(false);

  const [activeOrg, setActiveOrgState] = useState<ActiveOrg>({
    id: "",
    name: "",
    slug: "",
    gstin: null,
    currency: "INR",
  });

  const [profile, setProfile] = useState<FormattedKpiProfile>(emptyKpis);
  const [quickKeys, setQuickKeys] = useState<KpiKey[]>([]);
  const show = (k: KpiKey) => quickKeys.includes(k);
  // undefined while loading, null when the plan couldn't be read.
  const [plan, setPlan] = useState<Subscription | null | undefined>(undefined);

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
    setPlan(undefined);
    let live = true;
    subscriptionApi
      .get(activeOrg.id)
      .then((r) => live && setPlan(r.data ?? null))
      .catch(() => live && setPlan(null));
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
    setActiveOrgState({
      ...org,
      slug: org.slug || org.name.toLowerCase().replace(/[^a-z0-9]/g, "-"),
      gstin: org.gstin ?? null,
      currency: org.currency || "INR",
    });
    setActiveOrg(org);
  };

  // Load all organisations from PostgreSQL backend
  const loadOrganisations = async () => {
    try {
      const res = await organisationsApi.list();
      setOrgsLoaded(true);
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
              setActiveOrgState({ ...org, gstin: org.gstin ?? null, currency: org.currency || "INR" });
            } else if (savedName) {
              setActiveOrgState((prev) => ({
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
      if (isTargetInteractive(e.target) || e.ctrlKey || e.altKey || e.metaKey) {
        return;
      }

      const raw = e.key.toUpperCase();
      const lookupKey = e.shiftKey && raw === "B" ? "Shift+B" : !e.shiftKey ? raw : null;
      if (!lookupKey) return;

      const route = GATEWAY_ALPHABET_KEY_MAP[lookupKey];
      if (route) {
        e.preventDefault();
        if (demo) demo.navigateTo(route);
        else router.push(route);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [demo, router]);

  const gstin = activeOrg.gstin?.trim() || null;
  const stateCode = activeOrg.state_code || gstin?.slice(0, 2) || "";
  const stateName = GST_STATES.find(([c]) => c === stateCode)?.[1] ?? null;
  const city = activeOrg.registered_address?.city?.trim() || null;
  const place = [city, stateName].filter(Boolean).join(", ");
  const regime = !activeOrg.id ? null : gstin ? (activeOrg.composition_scheme ? "GST registered, composition" : "GST registered") : "No GSTIN, Section 22";

  const status = plan?.status ? STATUS[plan.status] : null;
  const seatLimit = plan?.entitlements?.seats;
  const validLine = !plan
    ? null
    : plan.status === "trialing"
    ? `Trial ends ${formatDateTally(plan.trial_ends_at)}`
    : plan.current_period_end
    ? `Valid until ${formatDateTally(plan.current_period_end)}`
    : "No end date on record";

  return (
    <div className="w-full px-4 pt-6 pb-8 sm:px-8 sm:pt-7">
      <div className="mx-auto w-full max-w-[1400px] space-y-5">
        {/* Page head */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.03em] text-ink">Gateway of Deku</h1>
            <p className="text-sm text-ink-muted mt-1">
              {activeOrg.name || (orgsLoaded ? "No company selected" : "–")}
              <span className="mx-2">·</span>
              {gstin ? <>GSTIN <span className="font-mono">{gstin}</span></> : regime ?? "GST –"}
              <span className="mx-2">·</span>
              Last entry {profile.lastEntry}
            </p>
          </div>
          <Link href="/vouchers" className={`${BTN} bg-ink text-white hover:bg-panel-raised self-start sm:self-auto`}>
            <Plus className="h-4 w-4" />
            New voucher
            <kbd className="font-mono text-[11px] leading-none px-1.5 pt-[3px] pb-[2px] rounded-[5px] border border-white/25 border-b-2 text-white/70">F3</kbd>
          </Link>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-5 items-start">
          <div className="min-w-0 space-y-5">
            {/* Deku Consultant */}
            <div className="flex flex-col md:flex-row md:items-center gap-4 rounded-panel border border-brand-wash-strong bg-brand-wash px-5 py-4">
              <div className="flex items-center gap-4 min-w-0 flex-1">
                <DekuLogo size={44} className="shrink-0" aria-hidden="true" />
                <div className="min-w-0">
                  <h2 className="text-[15.5px] font-semibold tracking-tight text-ink">Deku Consultant</h2>
                  <p className="text-[13.5px] text-ink-soft">Ask about overdue payments, expense spikes or margins, answered from your ledger.</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2.5">
                <Link href="/consultant" className={`${BTN} border border-line-strong bg-surface text-ink hover:bg-canvas`}>
                  Ask a question <Kbd>K</Kbd>
                </Link>
                <Link href="/executive" className={`${BTN} border border-line-strong bg-surface text-ink hover:bg-canvas`}>
                  Executive dashboard <Kbd>E</Kbd>
                </Link>
              </div>
            </div>

            {/* Active company */}
            <div
              data-tour="gateway-company"
              className="rounded-panel border border-line bg-surface flex flex-col lg:flex-row lg:items-center divide-y lg:divide-y-0 lg:divide-x divide-line"
            >
              <div className="flex items-center gap-3 px-5 py-3.5 min-w-0 lg:w-[30%]">
                <span className="h-9 w-9 shrink-0 rounded-[9px] bg-ink text-white grid place-items-center text-[13px] font-semibold">
                  {activeOrg.name ? initials(activeOrg.name) : "–"}
                </span>
                <div className="min-w-0 flex-1">
                  {orgList.length > 0 ? (
                    <div className="relative">
                      <select
                        id="company-shift-select"
                        aria-label="Shift company"
                        title="Shift the active company"
                        value={activeOrg.id}
                        onChange={(e) => {
                          const chosen = orgList.find((o) => o.id === e.target.value);
                          if (chosen) handleSwitchCompany(chosen);
                        }}
                        className="w-full appearance-none bg-transparent pr-6 text-[15px] font-semibold tracking-tight text-ink truncate cursor-pointer rounded-[6px] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                      >
                        {orgList.map((org) => (
                          <option key={org.id} value={org.id}>
                            {org.name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="h-4 w-4 text-ink-muted absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  ) : (
                    <span className="block text-[15px] font-semibold tracking-tight text-ink truncate">
                      {activeOrg.name || (orgsLoaded ? "No company yet" : "–")}
                    </span>
                  )}
                  <span className="block text-[12.5px] text-ink-muted truncate">
                    {profile.periodLabel === "–" ? "Financial year –, books not read yet" : profile.periodLabel}
                  </span>
                </div>
              </div>

              <div className="px-5 py-3.5 min-w-0 lg:flex-1">
                <span className="block text-[12.5px] text-ink-muted">GST</span>
                <span className="block text-[13.5px] text-ink truncate">
                  {gstin ? <span className="font-mono">{gstin}</span> : activeOrg.id ? "No GSTIN" : "–"}
                  {regime && <span className="text-ink-muted"> · {regime}</span>}
                </span>
                <span className="block text-[12.5px] text-ink-muted truncate">
                  {place || (activeOrg.id ? "State –, not on the company record" : "–")}
                </span>
              </div>

              <div className="px-5 py-3.5 min-w-0 lg:flex-1">
                <span className="block text-[12.5px] text-ink-muted">Licence</span>
                {plan ? (
                  <>
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="text-[13.5px] text-ink truncate">{plan.plan?.name ?? "No plan"}</span>
                      {status && <span className={`${CHIP} ${status[1]}`}>{status[0]}</span>}
                      {plan.entitlements?.read_only && <span className={`${CHIP} text-bad bg-bad-wash`}>Read only</span>}
                    </span>
                    <span className="block text-[12.5px] text-ink-muted truncate">
                      {validLine} · Seats {plan.usage.seats_used} of {seatLimit === null || seatLimit === undefined ? "unlimited" : seatLimit}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="block text-[13.5px] text-ink">–</span>
                    <span className="block text-[12.5px] text-ink-muted">
                      {!activeOrg.id ? "No company selected" : plan === undefined ? "Loading the plan" : "Plan couldn't be read"}
                    </span>
                  </>
                )}
              </div>

              {/* One company per deployment: adding one is only for someone who has none yet. */}
              {orgsLoaded && (
                <div className="px-5 py-3.5 shrink-0">
                  <Link
                    href="/companies"
                    title="Manage companies"
                    className={`${BTN} h-8 text-[13px] border border-line-strong bg-surface text-ink hover:bg-canvas`}
                  >
                    {orgList.length > 0 ? <ArrowRightLeft className="h-3.5 w-3.5" aria-hidden="true" /> : <Plus className="h-3.5 w-3.5" aria-hidden="true" />}
                    {orgList.length > 0 ? "Switch" : "+ Add company"}
                  </Link>
                </div>
              )}
            </div>

            {/* Launcher */}
            <div data-tour="gateway-menu" className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
              {LAUNCH_COLUMNS.map((column, ci) => (
                <div key={ci} className="rounded-panel border border-line bg-surface overflow-hidden">
                  {column.map((group, gi) => (
                    <div key={group.title} className={`pt-1.5 pb-2 ${gi > 0 ? "border-t border-line" : ""}`}>
                      <h3 className="px-5 pt-3 pb-2 text-[13px] font-semibold text-ink-soft">{group.title}</h3>
                      {group.items.map(({ key, title, desc, icon: Icon }) => (
                        <Link
                          key={key}
                          href={GATEWAY_ALPHABET_KEY_MAP[key]}
                          title={`${title} (${key})`}
                          className="group mx-2 flex items-center gap-3 rounded-[10px] px-3 py-2 hover:bg-brand-wash focus-visible:bg-brand-wash focus-visible:outline-none transition-colors"
                        >
                          <span className="h-8 w-8 shrink-0 rounded-[8px] bg-canvas-sunken text-ink-soft grid place-items-center group-hover:bg-surface group-hover:text-brand-strong transition-colors">
                            <Icon className="h-4 w-4" aria-hidden="true" />
                          </span>
                          <span className="flex-1 min-w-0 leading-tight">
                            <span className="block text-sm font-[550] text-ink">{title}</span>
                            <span className="block text-[12.5px] text-ink-muted truncate">{desc}</span>
                          </span>
                          <Kbd className="shrink-0 group-hover:text-brand-strong group-hover:border-brand-wash-strong">{keyCap(key)}</Kbd>
                        </Link>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* From the books */}
          <div data-tour="gateway-kpis" className="min-w-0 rounded-panel border border-line bg-surface overflow-hidden">
            <div className="px-5 pt-4">
              <h2 className="text-[15px] font-semibold tracking-tight text-ink">From the books</h2>
              <p className="text-[13px] text-ink-muted truncate">{activeOrg.name || "–"}, posted entries only</p>
            </div>
            <div className="px-5 pt-4 pb-1">
              <div className="grid grid-cols-2 gap-4 pb-4 border-b border-line">
                <Link href="/gst" className="min-w-0 group" title="Sales invoices and billed turnover">
                  <span className="block text-[13px] text-ink-muted">Turnover, FY to date</span>
                  <span className="block text-[26px] sm:text-[30px] font-semibold tracking-[-0.035em] tabular-nums text-ink group-hover:text-brand-strong transition-colors truncate">
                    {profile.turnover}
                  </span>
                  <span className="block text-[12.5px] text-ink-muted">{profile.periodLabel}</span>
                </Link>
                <Link href="/reports/profit-loss" className="min-w-0 group" title="Profit & Loss account (O)">
                  <span className="block text-[13px] text-ink-muted">Net profit</span>
                  <span className="block text-[26px] sm:text-[30px] font-semibold tracking-[-0.035em] tabular-nums text-ink group-hover:text-brand-strong transition-colors truncate">
                    {profile.profit}
                  </span>
                  <span className="block text-[12.5px] text-ink-muted">
                    <span className="font-medium text-ok">{profile.margin}</span> net margin
                  </span>
                </Link>
              </div>

              <div className="pt-1">
                {show("billed") && (
                  <BookRow
                    href="/gst"
                    title="Sales invoices register"
                    label="Billed turnover"
                    sub={profile.billedLimit}
                    amount={profile.billed}
                    chip={
                      <span
                        className={`${CHIP} ${
                          profile.sec22Variant === "safe" ? "text-ok bg-ok-wash" : profile.sec22Variant === "warn" ? "text-warn bg-warn-wash" : "text-brand-strong bg-brand-wash"
                        }`}
                      >
                        {profile.sec22Badge}
                      </span>
                    }
                  />
                )}
                {show("liquid") && (
                  <BookRow
                    href="/masters/chart-of-accounts?group=asset&filter=liquid"
                    title="Cash and bank ledgers"
                    label="Liquid funds"
                    sub={profile.liquidBank}
                    amount={profile.liquid}
                    amountClass="text-ok"
                  />
                )}
                {show("debtors") && (
                  <BookRow
                    href="/reports/debtors"
                    title="Trade debtors and ageing"
                    label="Trade debtors"
                    sub={profile.debtorsCount}
                    amount={profile.debtors}
                    chip={
                      <span className={`${CHIP} ${profile.debtorsAging.startsWith("0 ") ? "text-ink-soft bg-canvas-sunken" : "text-warn bg-warn-wash"}`}>
                        {profile.debtorsAging}
                      </span>
                    }
                  />
                )}
                {show("creditors") && (
                  <BookRow
                    href="/reports/creditors"
                    title="Trade creditors and vendor bills"
                    label="Trade creditors"
                    sub={`${profile.creditorsCount} · ${profile.creditorsTerms}`}
                    amount={profile.creditors}
                  />
                )}
                {show("expenses") && (
                  <BookRow
                    href="/reports/operating-expenses"
                    title="Operating expenses by head"
                    label="Operating expenses"
                    sub={profile.expensesHeads}
                    amount={profile.expenses}
                    chip={<span className="text-[12.5px] text-ink-muted">{profile.expenseRatio}</span>}
                  />
                )}
                {show("gst") && (
                  <BookRow
                    href="/gst"
                    title="GST returns and tax breakdown (G)"
                    label="GST net payable"
                    sub={profile.gstBreakdown}
                    amount={profile.gst}
                    amountClass="text-bad"
                    chip={<span className={`${CHIP} text-ink-soft bg-canvas-sunken`}>{profile.gstStatus}</span>}
                  />
                )}
              </div>
            </div>

            <div className="mx-5 mb-4 mt-2 rounded-[11px] bg-canvas px-4 py-3.5 text-[13.5px] text-ink-soft">
              <div className="flex items-center gap-2 mb-1.5 font-semibold text-ink">
                <Scale className="h-4 w-4" aria-hidden="true" />
                Balance check
                <span
                  className={`ml-auto ${CHIP} ${
                    profile.balanced === true ? "text-ok bg-ok-wash" : profile.balanced === false ? "text-bad bg-bad-wash" : "text-ink-soft bg-canvas-sunken"
                  }`}
                >
                  {profile.balanced === true ? "Balanced" : profile.balanced === false ? "Out of balance" : "Not computed yet"}
                </span>
              </div>
              <span className="flex flex-wrap gap-x-1.5 gap-y-1 tabular-nums">
                <span className="whitespace-nowrap">Assets <b className="font-semibold text-ink ledger-total">{profile.assets}</b></span>
                <span>=</span>
                <span className="whitespace-nowrap">Liabilities <b className="font-semibold text-ink">{profile.liabilities}</b></span>
                <span>+</span>
                <span className="whitespace-nowrap">equity <b className="font-semibold text-ink">{profile.equity}</b></span>
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-5 py-3 text-[13.5px]">
              <Link href="/consultant" className="inline-flex items-center gap-2 font-medium text-brand-strong hover:text-ink transition-colors">
                Deku Consultant <Kbd>K</Kbd>
              </Link>
              <Link href="/executive" className="inline-flex items-center gap-2 font-medium text-ink hover:text-brand-strong transition-colors">
                Executive dashboard <Kbd>E</Kbd>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
