"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { organisationsApi, OrgSummary, subscriptionApi } from "@/api/endpoints";
import { orgFromRow } from "@/lib/organisation/profile";
import type { Entitlements, Subscription } from "@/lib/subscription/entitlements";
import { UserProfile, Organisation, OperatingMode } from "@/types";

interface AuthContextType {
  user: UserProfile | null;
  organisation: Organisation | null;
  organisations: Organisation[];
  /** The selected company's plan, from the server; null until loaded or if it could not be read. */
  subscription: Subscription | null;
  entitlements: Entitlements | null;
  refreshSubscription: () => Promise<void>;
  isLoading: boolean;
  operatingMode: OperatingMode;
  setOrganisation: (org: Organisation) => void;
  /** Re-reads the companies from the database, e.g. after the profile changed. */
  refreshOrganisations: () => Promise<void>;
  login: (email: string, pass: string) => Promise<{ error?: string }>;
  signup: (
    email: string,
    pass: string,
    fullName: string,
    businessName: string,
    mode: OperatingMode,
    state: string
  ) => Promise<{ error?: string }>;
  loginDemo: (type: "owner" | "accountant" | "freelancer") => Promise<void>;
  logout: () => Promise<void>;
}

// Sandbox accounts from the demo seed (seed.sql). They belong only to fictional demo companies,
// so row-level security keeps demo visitors out of every real tenant.
const DEMO_ACCOUNTS = {
  owner: "demo-owner@deku.finance",
  accountant: "demo-accountant@deku.finance",
  freelancer: "demo-freelancer@deku.finance",
} as const;
const DEMO_PASSWORD = "DekuDemo#2026";

// The user object our /api/auth/* handlers return (tokens stay in httpOnly cookies).
interface SessionUser {
  id: string;
  email: string;
  full_name?: string;
  is_demo?: boolean;
  business_name?: string;
}

const AUTH_ERRORS: Record<string, string> = {
  invalid_credentials: "Incorrect email or password.",
  email_taken: "An account with this email already exists.",
  backend_unavailable: "Deku Finance is unreachable right now. Please try again shortly.",
};

async function authRequest(
  path: "login" | "signup" | "me" | "logout",
  body?: unknown
): Promise<{ user?: SessionUser; error?: string }> {
  const res = await fetch(
    `/api/auth/${path}`,
    body === undefined && path === "me"
      ? undefined
      : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) }
  );
  const data = await res.json().catch(() => ({}));
  if (res.ok) return { user: data.user };
  return { error: AUTH_ERRORS[data.error] || data.message || data.error || `Request failed (${res.status}).` };
}

const slugify = (name: string) =>
  `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${crypto.randomUUID().slice(0, 6)}`;

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [organisation, setOrg] = useState<Organisation | null>(null);
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [operatingMode, setOperatingModeState] =
    useState<OperatingMode>("pure_accounting");

  const router = useRouter();
  const pathname = usePathname();

  const setOrganisation = (org: Organisation) => {
    setOrg(org);
    setOperatingModeState(org.operating_mode);
    // Only the selected company (a per-browser choice) is remembered; its profile comes from the database.
    localStorage.setItem("deku_active_org_id", org.id);
    localStorage.setItem("deku_active_org_name", org.name);
    window.dispatchEvent(new Event("deku_active_org_changed"));
  };

  const toUser = (u: SessionUser): UserProfile => ({
    id: u.id,
    email: u.email || "",
    full_name: u.full_name || u.email?.split("@")[0],
    is_demo: u.is_demo === true,
  });

  // Companies come from the database; row-level security returns only this user's.
  const loadOrganisations = async (businessName?: string) => {
    try {
      let list: OrgSummary[] = (await organisationsApi.list()).data || [];
      if (list.length === 0 && businessName) {
        // Signup records the business name; the company is created on first sign-in.
        await organisationsApi.create({ name: businessName, slug: slugify(businessName) });
        list = (await organisationsApi.list()).data || [];
      }
      const orgs: Organisation[] = list.map(orgFromRow);
      setOrganisations(orgs);
      const savedId = localStorage.getItem("deku_active_org_id");
      const active = orgs.find((o) => o.id === savedId) ?? orgs[0];
      if (active) setOrganisation(active);
    } catch (e) {
      console.error("Failed to load companies:", e);
    }
  };

  const startSession = async (u: SessionUser, businessName?: string) => {
    setUser(toUser(u));
    await loadOrganisations(businessName ?? u.business_name);
  };

  const refreshOrganisations = async () => {
    if (user) await loadOrganisations();
  };

  // `isCurrent` drops a late answer for a company the user has already switched away from.
  const loadSubscription = async (orgId: string, isCurrent: () => boolean = () => true) => {
    try {
      const data = (await subscriptionApi.get(orgId)).data ?? null;
      if (isCurrent()) setSubscription(data);
    } catch (e) {
      console.error("Failed to load the plan:", e);
      if (isCurrent()) setSubscription(null);
    }
  };

  const refreshSubscription = async () => {
    if (organisation) await loadSubscription(organisation.id);
  };

  const activeOrgId = organisation?.id;
  useEffect(() => {
    setSubscription(null);
    if (!activeOrgId) return;
    let current = true;
    void loadSubscription(activeOrgId, () => current);
    return () => {
      current = false;
    };
  }, [activeOrgId]);

  // A company that hasn't finished onboarding goes to the wizard first, whatever page was asked for.
  useEffect(() => {
    if (organisation && !organisation.onboarded_at && pathname !== "/onboarding") router.replace("/onboarding");
  }, [organisation, pathname, router]);

  useEffect(() => {
    const onRegimeChanged = () => void refreshOrganisations();
    window.addEventListener("deku_org_regime_changed", onRegimeChanged);
    return () => window.removeEventListener("deku_org_regime_changed", onRegimeChanged);
  });

  useEffect(() => {
    authRequest("me")
      .then(({ user: u }) => (u ? startSession(u) : setUser(null)))
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false));
  }, []);

  const login = async (email: string, pass: string) => {
    setIsLoading(true);
    try {
      const { user: u, error } = await authRequest("login", { email, password: pass });

      if (error) {
        return { error };
      }

      if (u) {
        await startSession(u);
      }
      return {};
    } catch (err: unknown) {
      return {
        error: (err as Error).message || "An unexpected error occurred.",
      };
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (
    email: string,
    pass: string,
    fullName: string,
    businessName: string,
    mode: OperatingMode,
    state: string
  ) => {
    setIsLoading(true);
    try {
      const { user: u, error } = await authRequest("signup", {
        email,
        password: pass,
        full_name: fullName,
        business_name: businessName,
        operating_mode: mode,
        state,
      });

      if (error) {
        return { error };
      }
      if (u) {
        // The company is created from the business name on this first load.
        await startSession(u, businessName);
      }
      return {};
    } catch (err: unknown) {
      return { error: (err as Error).message || "Signup failed." };
    } finally {
      setIsLoading(false);
    }
  };

  const loginDemo = async (type: "owner" | "accountant" | "freelancer") => {
    setIsLoading(true);
    try {
      const { user: u, error } = await authRequest("login", {
        email: DEMO_ACCOUNTS[type],
        password: DEMO_PASSWORD,
      });
      if (error || !u) throw new Error(error || "Demo sign-in failed.");
      await startSession(u);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await authRequest("logout");
    } catch (e) {
      console.warn("Sign out err:", e);
    }
    setUser(null);
    setOrg(null);
    setOrganisations([]);
    setSubscription(null);
    for (const key of ["deku_active_org", "deku_active_org_id", "deku_active_org_name", "deku_operating_mode"]) {
      localStorage.removeItem(key);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        organisation,
        organisations,
        subscription,
        entitlements: subscription?.entitlements ?? null,
        refreshSubscription,
        isLoading,
        operatingMode,
        setOrganisation,
        refreshOrganisations,
        login,
        signup,
        loginDemo,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
