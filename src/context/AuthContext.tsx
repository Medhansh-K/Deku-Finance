"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { organisationsApi, OrgSummary } from "@/api/endpoints";
import {
  UserProfile,
  Organisation,
  OperatingMode,
  OrganisationLicense,
  PlanTier,
  LicenseType,
} from "@/types";

export interface EmailNotification {
  visible: boolean;
  to: string;
  licenseKey: string;
  licenseType: LicenseType;
  planTier: PlanTier;
  subject: string;
  sentAt: string;
}

interface AuthContextType {
  user: UserProfile | null;
  organisation: Organisation | null;
  organisations: Organisation[];
  license: OrganisationLicense | null;
  isLoading: boolean;
  operatingMode: OperatingMode;
  emailNotification: EmailNotification | null;
  dismissEmailNotification: () => void;
  setOperatingMode: (mode: OperatingMode) => void;
  setOrganisation: (org: Organisation) => void;
  login: (email: string, pass: string) => Promise<{ error?: string }>;
  signup: (
    email: string,
    pass: string,
    fullName: string,
    businessName: string,
    mode: OperatingMode,
    state: string,
    plan?: PlanTier
  ) => Promise<{ error?: string }>;
  activateLicense: (
    licenseKey: string,
    ownerEmail: string,
    pass?: string
  ) => Promise<{ success: boolean; error?: string }>;
  sendActivationEmail: (
    email: string
  ) => Promise<{ success: boolean; licenseKey?: string; message?: string }>;
  loginDemo: (type: "owner" | "accountant" | "freelancer") => Promise<void>;
  logout: () => Promise<void>;
}

export const createDefaultLicense = (
  orgId: string,
  ownerEmail: string,
  type: LicenseType = "temp",
  tier: PlanTier = "go"
): OrganisationLicense => {
  const now = new Date();
  const trialEnds = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000); // 15 days unrestricted
  const graceEnds = new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000); // 20 days (5 days migration/purchase)
  const randomSuffix =
    Math.random().toString(36).substring(2, 6).toUpperCase() +
    "-" +
    Math.random().toString(36).substring(2, 6).toUpperCase();

  return {
    id: crypto.randomUUID(),
    organisation_id: orgId,
    license_key: `DEKU-${type.toUpperCase()}-${tier.toUpperCase()}-${randomSuffix}`,
    license_type: type,
    plan_tier: tier,
    owner_email: ownerEmail,
    issued_at: now.toISOString(),
    trial_ends_at: type === "temp" ? trialEnds.toISOString() : undefined,
    grace_period_ends_at: type === "temp" ? graceEnds.toISOString() : undefined,
    expires_at:
      type === "temp"
        ? graceEnds.toISOString()
        : new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    status: "active",
    activated_at: now.toISOString(),
    activated_by_email: ownerEmail,
    last_email_sent_at: now.toISOString(),
    features: {
      max_monthly_bills: tier === "go" ? 150 : -1,
      has_gstn_json: tier === "pro",
      has_custom_fields: true,
      has_upi_qr: true,
      seats: tier === "go" ? 2 : -1,
    },
  };
};

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
  const [license, setLicense] = useState<OrganisationLicense | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [operatingMode, setOperatingModeState] =
    useState<OperatingMode>("pure_accounting");
  const [emailNotification, setEmailNotification] =
    useState<EmailNotification | null>(null);

  const setOrganisation = (org: Organisation) => {
    setOrg(org);
    setOperatingModeState(org.operating_mode);
    if (org.license) {
      setLicense(org.license);
      localStorage.setItem("deku_active_license", JSON.stringify(org.license));
    }
    localStorage.setItem("deku_active_org", JSON.stringify(org));
    localStorage.setItem("deku_operating_mode", org.operating_mode);
    // Screens read the active company id from here.
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
  const loadOrganisations = async (email: string, businessName?: string) => {
    try {
      let list: OrgSummary[] = (await organisationsApi.list()).data || [];
      if (list.length === 0 && businessName) {
        // Signup records the business name; the company is created on first sign-in.
        await organisationsApi.create({ name: businessName, slug: slugify(businessName) });
        list = (await organisationsApi.list()).data || [];
      }
      const savedMode = localStorage.getItem("deku_operating_mode") as OperatingMode | null;
      let savedLicense: OrganisationLicense | null = null;
      try {
        savedLicense = JSON.parse(localStorage.getItem("deku_active_license") || "null");
      } catch {
        // ignore a corrupt saved license
      }
      // shortcut: licenses are still issued client-side; move them to the backend licenses API.
      const orgs: Organisation[] = list.map((o) => ({
        id: o.id,
        name: o.name,
        slug: o.slug,
        gstin: o.gstin ?? undefined,
        pan: o.pan ?? undefined,
        currency: o.currency,
        timezone: o.timezone,
        fy_start_month: o.financial_year_start_month,
        operating_mode: savedMode || (o.gstin ? "gst_enterprise" : "pure_accounting"),
        license:
          savedLicense?.organisation_id === o.id ? savedLicense : createDefaultLicense(o.id, email),
      }));
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
    await loadOrganisations(u.email || "", businessName ?? u.business_name);
  };

  useEffect(() => {
    authRequest("me")
      .then(({ user: u }) => (u ? startSession(u) : setUser(null)))
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false));
  }, []);

  const setOperatingMode = (mode: OperatingMode) => {
    setOperatingModeState(mode);
    localStorage.setItem("deku_operating_mode", mode);
    if (organisation) {
      const updated = { ...organisation, operating_mode: mode };
      setOrg(updated);
      localStorage.setItem("deku_active_org", JSON.stringify(updated));
    }
  };

  const dismissEmailNotification = () => {
    setEmailNotification(null);
  };

  const sendActivationEmail = async (email: string) => {
    const targetEmail = email.trim();
    if (!targetEmail) {
      return { success: false, message: "Please provide a valid email." };
    }

    // Determine or generate license key
    let targetKey = license?.license_key;
    if (!targetKey) {
      const newLic = createDefaultLicense(
        organisation?.id || crypto.randomUUID(),
        targetEmail,
        "temp",
        "go"
      );
      targetKey = newLic.license_key;
      setLicense(newLic);
      localStorage.setItem("deku_active_license", JSON.stringify(newLic));
    }

    setEmailNotification({
      visible: true,
      to: targetEmail,
      licenseKey: targetKey,
      licenseType: license?.license_type || "temp",
      planTier: license?.plan_tier || "go",
      subject: `[Deku Finance] Workspace License Activation Key (${targetKey})`,
      sentAt: new Date().toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    });

    return {
      success: true,
      licenseKey: targetKey,
      message: `License activation email successfully dispatched to ${targetEmail}.`,
    };
  };

  const activateLicense = async (
    licenseKey: string,
    ownerEmail: string,
    pass?: string
  ) => {
    const cleanKey = licenseKey.trim().toUpperCase();
    const cleanEmail = ownerEmail.trim().toLowerCase();

    if (!cleanKey) {
      return { success: false, error: "Please provide a license key." };
    }
    if (!cleanEmail) {
      return { success: false, error: "Please provide the owner's email." };
    }

    // Basic format check
    if (!cleanKey.startsWith("DEKU-")) {
      return {
        success: false,
        error: "Invalid license key format. Keys start with DEKU-TEMP- or DEKU-PLAN-.",
      };
    }

    const isTemp = cleanKey.includes("-TEMP-");
    const isPro = cleanKey.includes("-PRO-");
    const now = new Date();
    const trialEnds = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);
    const graceEnds = new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000);

    const activatedLicense: OrganisationLicense = {
      id: license?.id || crypto.randomUUID(),
      organisation_id: organisation?.id || crypto.randomUUID(),
      license_key: cleanKey,
      license_type: isTemp ? "temp" : "plan",
      plan_tier: isPro ? "pro" : "go",
      owner_email: cleanEmail,
      issued_at: license?.issued_at || now.toISOString(),
      trial_ends_at: isTemp ? trialEnds.toISOString() : undefined,
      grace_period_ends_at: isTemp ? graceEnds.toISOString() : undefined,
      expires_at: isTemp
        ? graceEnds.toISOString()
        : new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      status: "active",
      activated_at: now.toISOString(),
      activated_by_email: cleanEmail,
      features: {
        max_monthly_bills: isPro ? -1 : 150,
        has_gstn_json: isPro,
        has_custom_fields: true,
        has_upi_qr: true,
        seats: isPro ? -1 : 2,
      },
    };

    setLicense(activatedLicense);
    localStorage.setItem(
      "deku_active_license",
      JSON.stringify(activatedLicense)
    );

    if (organisation) {
      const updatedOrg = { ...organisation, license: activatedLicense };
      setOrg(updatedOrg);
      localStorage.setItem("deku_active_org", JSON.stringify(updatedOrg));
    }

    return { success: true };
  };

  const login = async (email: string, pass: string) => {
    setIsLoading(true);
    try {
      const { user: u, error } = await authRequest("login", { email, password: pass });

      if (error) {
        return { error };
      }

      if (u) {
        await startSession(u);

        // Automatically trigger activation email dispatch record for the logged in user
        await sendActivationEmail(email);
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
    state: string,
    plan: PlanTier = "go"
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
      localStorage.setItem("deku_operating_mode", mode);

      // Dispatch activation email on signup
      await sendActivationEmail(email);

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
    for (const key of ["deku_active_org", "deku_active_license", "deku_active_org_id", "deku_active_org_name"]) {
      localStorage.removeItem(key);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        organisation,
        organisations,
        license,
        isLoading,
        operatingMode,
        emailNotification,
        dismissEmailNotification,
        setOperatingMode,
        setOrganisation,
        login,
        signup,
        activateLicense,
        sendActivationEmail,
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
