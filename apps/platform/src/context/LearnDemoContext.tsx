"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { setDemoApiInterceptor } from "@/api/client";
import { AuthContext, type AuthContextType } from "@/context/AuthContext";
import { clearActiveOrg, setActiveOrg } from "@/lib/organisation/active-org";
import { safeNextPath } from "@/lib/auth/next-path";
import { DEMO_COMPANIES, getDemoCompany, type DemoCompanySlug } from "@/lib/learn/companies";
import { dispatchDemoApi } from "@/lib/learn/demo-api";
import { buildDemoSubscription, getDemoPlanConfig, type DemoPlanId } from "@/lib/learn/demo-plans";
import { getDemoRoleConfig, type DemoRoleConfig } from "@/lib/learn/demo-roles";
import { createInitialDemoDataset, type DemoDataset } from "@/lib/learn/sample-data";
import type { OrgRole } from "@/modules/departments-members/team";
import type { Organisation, UserProfile } from "@/types";

export interface DemoActionNotice {
  title: string;
  body: string;
  tone: "info" | "warning" | "blocked";
}

export interface LearnDemoContextValue {
  isDemoMode: true;
  companySlug: DemoCompanySlug;
  role: OrgRole;
  plan: DemoPlanId;
  activeRoute: string;
  roleConfig: DemoRoleConfig;
  dataset: DemoDataset;
  datasetVersion: number;
  workflowDrawerOpen: boolean;
  setWorkflowDrawerOpen: (open: boolean) => void;
  actionNotice: DemoActionNotice | null;
  dismissActionNotice: () => void;
  notifyAction: (title: string, body: string, tone?: "info" | "warning" | "blocked") => void;
  switchCompany: (slug: DemoCompanySlug) => void;
  switchRole: (role: OrgRole) => void;
  switchPlan: (plan: DemoPlanId) => void;
  navigateTo: (route: string) => void;
  resetDemo: () => void;
}

const LearnDemoContext = createContext<LearnDemoContextValue | null>(null);

function normalizeDemoRoute(raw?: string | null): string {
  const safe = safeNextPath(raw || "/gateway");
  if (safe === "/" || safe.startsWith("/learn")) return "/gateway";
  return safe;
}

export function LearnDemoProvider({
  initialCompany = "aster-trading",
  initialRole = "owner",
  initialPlan,
  initialRoute = "/gateway",
  children,
}: {
  initialCompany?: DemoCompanySlug;
  initialRole?: OrgRole;
  initialPlan?: DemoPlanId;
  initialRoute?: string;
  children: React.ReactNode;
}) {
  const validCompany = getDemoCompany(initialCompany) ?? DEMO_COMPANIES[0];
  const [companySlug, setCompanySlug] = useState<DemoCompanySlug>(validCompany.slug);
  const [role, setRole] = useState<OrgRole>(initialRole);
  const [plan, setPlan] = useState<DemoPlanId>(initialPlan ?? validCompany.recommendedPlan);
  const [activeRoute, setActiveRoute] = useState<string>(() => normalizeDemoRoute(initialRoute));
  const [dataset, setDataset] = useState<DemoDataset>(() => createInitialDemoDataset(validCompany.slug));
  const [datasetVersion, setDatasetVersion] = useState(1);
  const [workflowDrawerOpen, setWorkflowDrawerOpen] = useState(false);
  const [actionNotice, setActionNotice] = useState<DemoActionNotice | null>(null);
  const [interceptorReady, setInterceptorReady] = useState(false);

  const router = useRouter();
  const prevOrgRef = useRef<{ id: string | null; name: string | null } | null>(null);
  const datasetRef = useRef(dataset);
  const roleRef = useRef(role);
  const planRef = useRef(plan);

  useEffect(() => {
    datasetRef.current = dataset;
  }, [dataset]);

  useEffect(() => {
    roleRef.current = role;
  }, [role]);

  useEffect(() => {
    planRef.current = plan;
  }, [plan]);

  const notifyAction = useCallback(
    (title: string, body: string, tone: "info" | "warning" | "blocked" = "info") => {
      setActionNotice({ title, body, tone });
    },
    []
  );

  // Preserve & restore any existing authenticated browser org selection cleanly.
  useEffect(() => {
    if (typeof window === "undefined") return;
    prevOrgRef.current = {
      id: localStorage.getItem("deku_active_org_id"),
      name: localStorage.getItem("deku_active_org_name"),
    };
    return () => {
      const prev = prevOrgRef.current;
      if (prev?.id) {
        setActiveOrg({ id: prev.id, name: prev.name || "" });
      } else {
        clearActiveOrg();
      }
    };
  }, []);

  // Sync active org via the sanctioned active-org helper so reused screens load sample books.
  useLayoutEffect(() => {
    setActiveOrg({ id: dataset.org.id, name: dataset.org.name });
  }, [dataset.org.id, dataset.org.name]);

  // Register interceptor synchronously before child screen effects fire.
  useLayoutEffect(() => {
    setDemoApiInterceptor((path, opts) =>
      dispatchDemoApi(
        {
          getDataset: () => datasetRef.current,
          updateDataset: (updater) => {
            const next = updater(datasetRef.current);
            datasetRef.current = next;
            setDataset(next);
          },
          getRole: () => roleRef.current,
          getPlan: () => planRef.current,
          notifyAction,
        },
        path,
        opts
      )
    );
    queueMicrotask(() => setInterceptorReady(true));
    return () => {
      setDemoApiInterceptor(null);
    };
  }, [notifyAction]);

  const syncUrl = useCallback(
    (nextCompany: DemoCompanySlug, nextRole: OrgRole, nextPlan: DemoPlanId, nextRoute: string) => {
      if (typeof window === "undefined") return;
      const url = `/learn/demo/workspace?company=${encodeURIComponent(nextCompany)}&role=${encodeURIComponent(nextRole)}&plan=${encodeURIComponent(nextPlan)}&route=${encodeURIComponent(nextRoute)}`;
      window.history.replaceState(null, "", url);
    },
    []
  );

  const navigateTo = useCallback(
    (route: string) => {
      const next = normalizeDemoRoute(route);
      setActiveRoute(next);
      syncUrl(companySlug, role, plan, next);
    },
    [companySlug, role, plan, syncUrl]
  );

  const switchCompany = useCallback(
    (slug: DemoCompanySlug) => {
      const fresh = createInitialDemoDataset(slug);
      datasetRef.current = fresh;
      setCompanySlug(slug);
      setDataset(fresh);
      setDatasetVersion((v) => v + 1);
      setActionNotice({
        title: `Switched to ${fresh.org.name}`,
        body: "Loaded reconciled sample books for this industry template.",
        tone: "info",
      });
      syncUrl(slug, role, plan, activeRoute);
    },
    [role, plan, activeRoute, syncUrl]
  );

  const switchRole = useCallback(
    (nextRole: OrgRole) => {
      const cfg = getDemoRoleConfig(nextRole);
      setRole(nextRole);
      setDatasetVersion((v) => v + 1);
      setActionNotice({
        title: `Role Preview: ${cfg.label}`,
        body: cfg.governanceSummary,
        tone: cfg.readOnly ? "warning" : "info",
      });
      syncUrl(companySlug, nextRole, plan, activeRoute);
    },
    [companySlug, plan, activeRoute, syncUrl]
  );

  const switchPlan = useCallback(
    (nextPlan: DemoPlanId) => {
      const cfg = getDemoPlanConfig(nextPlan);
      setPlan(nextPlan);
      setDatasetVersion((v) => v + 1);
      setActionNotice({
        title: `Plan Preview: ${cfg.name} (${cfg.priceLabel})`,
        body: cfg.upgradeNote,
        tone: "info",
      });
      syncUrl(companySlug, role, nextPlan, activeRoute);
    },
    [companySlug, role, activeRoute, syncUrl]
  );

  const resetDemo = useCallback(() => {
    const fresh = createInitialDemoDataset(companySlug);
    datasetRef.current = fresh;
    setDataset(fresh);
    setDatasetVersion((v) => v + 1);
    if (typeof window !== "undefined") {
      localStorage.removeItem("deku_tutorial_progress_public-learn-demo");
    }
    setActionNotice({
      title: "Demo Environment Reset",
      body: `Restored fresh sample books for ${fresh.org.name} and cleared local tutorial progress.`,
      tone: "info",
    });
  }, [companySlug]);

  const roleConfig = useMemo(() => getDemoRoleConfig(role), [role]);

  const demoAuthValue = useMemo<AuthContextType>(() => {
    const orgRow = dataset.org;
    const demoUser: UserProfile = {
      id: "public-learn-demo",
      email: `${role}@${companySlug}.demo`,
      full_name: `${roleConfig.label} Preview`,
      is_demo: true,
    };
    const demoOrg: Organisation = {
      id: orgRow.id,
      name: orgRow.name,
      slug: orgRow.slug,
      legal_name: orgRow.bank_beneficiary ?? orgRow.name,
      gstin: orgRow.gstin ?? undefined,
      pan: orgRow.pan ?? undefined,
      currency: orgRow.currency,
      timezone: orgRow.timezone,
      fy_start_month: orgRow.financial_year_start_month,
      operating_mode: orgRow.operating_mode === "pure" ? "pure_accounting" : "gst_enterprise",
      state_code: orgRow.state_code ?? undefined,
      registered_address: orgRow.registered_address ?? undefined,
      upi_vpa: orgRow.upi_vpa ?? undefined,
      bank_name: orgRow.bank_name ?? undefined,
      bank_ifsc: orgRow.bank_ifsc ?? undefined,
      bank_account_number: orgRow.bank_account_number ?? undefined,
      bank_beneficiary: orgRow.bank_beneficiary ?? undefined,
      onboarded_at: orgRow.onboarded_at ?? "2026-04-01T09:00:00.000Z",
    };
    const sub = buildDemoSubscription(plan, {
      invoices_this_month: dataset.invoices.length + 14,
      seats_used: dataset.members.length + dataset.invitations.length,
    });
    return {
      user: demoUser,
      organisation: demoOrg,
      organisations: [demoOrg],
      subscription: sub,
      entitlements: sub.entitlements,
      refreshSubscription: async () => { },
      isLoading: false,
      operatingMode: demoOrg.operating_mode,
      setOrganisation: () => { },
      refreshOrganisations: async () => { },
      login: async () => ({}),
      signup: async () => ({}),
      loginDemo: async () => { },
      logout: async () => {
        router.push("/learn");
      },
    };
  }, [dataset.org, dataset.invoices.length, dataset.members.length, dataset.invitations.length, companySlug, role, roleConfig.label, plan, router]);

  const ctxValue = useMemo<LearnDemoContextValue>(
    () => ({
      isDemoMode: true,
      companySlug,
      role,
      plan,
      activeRoute,
      roleConfig,
      dataset,
      datasetVersion,
      workflowDrawerOpen,
      setWorkflowDrawerOpen,
      actionNotice,
      dismissActionNotice: () => setActionNotice(null),
      notifyAction,
      switchCompany,
      switchRole,
      switchPlan,
      navigateTo,
      resetDemo,
    }),
    [
      companySlug,
      role,
      plan,
      activeRoute,
      roleConfig,
      dataset,
      datasetVersion,
      workflowDrawerOpen,
      actionNotice,
      notifyAction,
      switchCompany,
      switchRole,
      switchPlan,
      navigateTo,
      resetDemo,
    ]
  );

  // Intercept <Link href="/..."> clicks inside the workspace so navigation never hits /login.
  const handleLinkCapture = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const anchor = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      const rawHref = anchor.getAttribute("href") || "";
      if (
        !rawHref.startsWith("/") ||
        rawHref.startsWith("/learn") ||
        rawHref.startsWith("/request-setup") ||
        rawHref.startsWith("/login") ||
        rawHref.startsWith("/signup")
      ) {
        return;
      }
      e.preventDefault();
      navigateTo(rawHref);
    },
    [navigateTo]
  );

  return (
    <LearnDemoContext.Provider value={ctxValue}>
      <AuthContext.Provider value={demoAuthValue}>
        <div onClickCapture={handleLinkCapture} className="min-h-screen">
          {interceptorReady ? children : null}
        </div>
      </AuthContext.Provider>
    </LearnDemoContext.Provider>
  );
}

export function useOptionalLearnDemo(): LearnDemoContextValue | null {
  return useContext(LearnDemoContext);
}

export function useLearnDemo(): LearnDemoContextValue {
  const ctx = useContext(LearnDemoContext);
  if (!ctx) throw new Error("useLearnDemo must be used inside LearnDemoProvider");
  return ctx;
}

