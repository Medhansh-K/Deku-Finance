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
import { DEMO_ACTIVITY_EVENT, nextActivity, screenName, type DemoActivity, type DemoActivityRefs, type DemoActivityType } from "@/lib/learn/activity";
import { clearStoredDataset, loadStoredDataset, saveStoredDataset } from "@/lib/learn/demo-store";
import { getLearnWorkflow } from "@/lib/learn/workflows/catalogue";
import {
  EMPTY_WORKFLOW_STATE,
  openWorkflow,
  clearWorkflowState,
  loadWorkflowState,
  saveWorkflowState,
  type CompanyWorkflowState,
} from "@/lib/learn/workflows/runner";
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
  /** Everything the visitor did in this company, oldest first. */
  activity: DemoActivity[];
  record: (type: DemoActivityType, summary: string, refs?: DemoActivityRefs) => void;
  /** This company's workflow runs (lib/learn/workflows/runner.ts); saved per company. */
  workflowState: CompanyWorkflowState;
  updateWorkflows: (fn: (state: CompanyWorkflowState, activity: DemoActivity[]) => CompanyWorkflowState) => void;
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
  initialWorkflow,
  children,
}: {
  initialCompany?: DemoCompanySlug;
  initialRole?: OrgRole;
  initialPlan?: DemoPlanId;
  initialRoute?: string;
  /** Workflow to start or resume on arrival (catalogue Start/Resume). Applied before any screen renders. */
  initialWorkflow?: string | null;
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
  const [workflowState, setWorkflowState] = useState<CompanyWorkflowState>(EMPTY_WORKFLOW_STATE);
  const workflowRef = useRef(workflowState);

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

  /** Append to the activity log and tell any open tour. The log lives inside the dataset, so it saves with it. */
  const record = useCallback((type: DemoActivityType, summary: string, refs?: DemoActivityRefs) => {
    const prev = datasetRef.current;
    const activity = nextActivity(prev.activity, type, roleRef.current, summary, refs);
    const next = { ...prev, activity: [...prev.activity, activity] };
    datasetRef.current = next;
    setDataset(next);
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent<DemoActivity>(DEMO_ACTIVITY_EVENT, { detail: activity }));
  }, []);

  // Restore this company's saved books after mount (never during render, so hydration matches).
  const companyRef = useRef(companySlug);
  const initialWorkflowRef = useRef(initialWorkflow);
  useLayoutEffect(() => {
    const saved = loadStoredDataset(companyRef.current);
    if (saved) {
      datasetRef.current = saved;
      setDataset(saved);
      setDatasetVersion((v) => v + 1);
    }
    const wf = getLearnWorkflow(initialWorkflowRef.current ?? "");
    const stored = loadWorkflowState(companyRef.current);
    workflowRef.current = wf ? openWorkflow(stored, wf, datasetRef.current.activity) : stored;
    if (wf) saveWorkflowState(companyRef.current, workflowRef.current);
    setWorkflowState(workflowRef.current);
  }, []);

  // Save after every change; each company keeps its own copy. The untouched first-render seed is never
  // saved: under StrictMode the restore above runs twice, and saving the seed in between wiped the visitor's books.
  const initialDatasetRef = useRef(dataset);
  useEffect(() => {
    companyRef.current = companySlug;
    if (dataset === initialDatasetRef.current) return;
    saveStoredDataset(companySlug, dataset);
  }, [companySlug, dataset]);

  const updateWorkflows = useCallback(
    (fn: (state: CompanyWorkflowState, activity: DemoActivity[]) => CompanyWorkflowState) => {
      const next = fn(workflowRef.current, datasetRef.current.activity);
      if (next === workflowRef.current) return;
      workflowRef.current = next;
      setWorkflowState(next);
      saveWorkflowState(companyRef.current, next);
    },
    []
  );

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
          record,
        },
        path,
        opts
      )
    );
    queueMicrotask(() => setInterceptorReady(true));
    return () => {
      setDemoApiInterceptor(null);
    };
  }, [notifyAction, record]);

  const syncUrl = useCallback(
    (nextCompany: DemoCompanySlug, nextRole: OrgRole, nextPlan: DemoPlanId, nextRoute: string) => {
      if (typeof window === "undefined") return;
      const url = new URL("/learn/demo/workspace", window.location.origin);
      // The screen's own query (?invoice=…, ?amount=…) goes on the page URL too: the reused screens read it from there.
      new URLSearchParams(nextRoute.split("?")[1] ?? "").forEach((v, k) => url.searchParams.set(k, v));
      url.searchParams.set("company", nextCompany);
      url.searchParams.set("role", nextRole);
      url.searchParams.set("plan", nextPlan);
      url.searchParams.set("route", nextRoute);
      window.history.replaceState(null, "", url);
    },
    []
  );

  const navigateTo = useCallback(
    (route: string) => {
      const next = normalizeDemoRoute(route);
      setActiveRoute(next);
      syncUrl(companySlug, role, plan, next);
      record("route.visited", `Opened ${screenName(next)}`, { path: next });
    },
    [companySlug, role, plan, syncUrl, record]
  );

  const switchCompany = useCallback(
    (slug: DemoCompanySlug) => {
      const fresh = loadStoredDataset(slug) ?? createInitialDemoDataset(slug);
      datasetRef.current = fresh;
      companyRef.current = slug;
      workflowRef.current = loadWorkflowState(slug);
      setWorkflowState(workflowRef.current);
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
      roleRef.current = nextRole;
      setRole(nextRole);
      record("role.switched", `Switched to ${cfg.label}`, { role: nextRole });
      setDatasetVersion((v) => v + 1);
      setActionNotice({
        title: `Now previewing as ${cfg.label}`,
        body: cfg.governanceSummary,
        tone: cfg.readOnly ? "warning" : "info",
      });
      syncUrl(companySlug, nextRole, plan, activeRoute);
    },
    [companySlug, plan, activeRoute, syncUrl, record]
  );

  const switchPlan = useCallback(
    (nextPlan: DemoPlanId) => {
      const cfg = getDemoPlanConfig(nextPlan);
      setPlan(nextPlan);
      setDatasetVersion((v) => v + 1);
      setActionNotice({
        title: `Previewing the ${cfg.name} plan (${cfg.priceLabel})`,
        body: cfg.upgradeNote,
        tone: "info",
      });
      syncUrl(companySlug, role, nextPlan, activeRoute);
    },
    [companySlug, role, activeRoute, syncUrl]
  );

  const resetDemo = useCallback(() => {
    clearStoredDataset(companySlug);
    clearWorkflowState(companySlug);
    workflowRef.current = EMPTY_WORKFLOW_STATE;
    setWorkflowState(EMPTY_WORKFLOW_STATE);
    const seeded = createInitialDemoDataset(companySlug);
    const fresh = { ...seeded, activity: [nextActivity([], "demo.reset", roleRef.current, "Reset the demo books", { company: companySlug })] };
    datasetRef.current = fresh;
    setDataset(fresh);
    setDatasetVersion((v) => v + 1);
    if (typeof window !== "undefined") {
      for (const m of seeded.members) localStorage.removeItem(`deku_tutorial_progress_${m.user_id}`);
    }
    setActionNotice({
      title: "Demo reset",
      body: `Restored fresh sample books for ${fresh.org.name} and cleared its workflow progress.`,
      tone: "info",
    });
  }, [companySlug]);

  const roleConfig = useMemo(() => getDemoRoleConfig(role), [role]);

  const demoAuthValue = useMemo<AuthContextType>(() => {
    const orgRow = dataset.org;
    // The seeded member holding this role, so screens (maker-checker, Help Centre) see a distinct person per role.
    const member = dataset.members.find((m) => m.role === role);
    const demoUser: UserProfile = {
      id: member?.user_id ?? `public-learn-demo-${role}`,
      email: member?.profiles?.email ?? `${role}@${companySlug}.demo`,
      full_name: member?.profiles?.full_name ?? `${roleConfig.label} preview`,
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
  }, [dataset.org, dataset.invoices.length, dataset.members, dataset.members.length, dataset.invitations.length, companySlug, role, roleConfig.label, plan, router]);

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
      record,
      activity: dataset.activity,
      workflowState,
      updateWorkflows,
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
      record,
      workflowState,
      updateWorkflows,
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

