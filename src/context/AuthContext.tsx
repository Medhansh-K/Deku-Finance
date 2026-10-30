"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
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

const DEFAULT_DEMO_ORG: Organisation = {
  id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  name: "Datalis Infoedge Pvt Ltd",
  slug: "datalis-infoedge",
  legal_name: "Datalis Infoedge Private Limited",
  gstin: "27AABCD1234F1Z5",
  pan: "AABCD1234F",
  currency: "INR",
  timezone: "Asia/Kolkata",
  fy_start_month: 4,
  operating_mode: "pure_accounting",
  operating_state: "Maharashtra",
  state_code: "27",
  upi_vpa: "7506461004@paytm",
  turnover_limit: 4000000,
  current_turnover: 640000,
  license: createDefaultLicense(
    "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    "owner@tenant1.com",
    "temp",
    "go"
  ),
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [organisation, setOrg] = useState<Organisation | null>(DEFAULT_DEMO_ORG);
  const [organisations, setOrganisations] = useState<Organisation[]>([
    DEFAULT_DEMO_ORG,
  ]);
  const [license, setLicense] = useState<OrganisationLicense | null>(
    DEFAULT_DEMO_ORG.license || null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [operatingMode, setOperatingModeState] =
    useState<OperatingMode>("pure_accounting");
  const [emailNotification, setEmailNotification] =
    useState<EmailNotification | null>(null);

  const supabase = createClient();

  useEffect(() => {
    const initAuth = async () => {
      try {
        const savedDemo = localStorage.getItem("deku_demo_user");
        const savedOrg = localStorage.getItem("deku_active_org");
        const savedMode = localStorage.getItem(
          "deku_operating_mode"
        ) as OperatingMode;
        const savedLicense = localStorage.getItem("deku_active_license");

        if (savedMode) {
          setOperatingModeState(savedMode);
        }

        if (savedOrg) {
          try {
            const parsed = JSON.parse(savedOrg);
            setOrg(parsed);
            if (parsed.license) {
              setLicense(parsed.license);
            }
          } catch {
            setOrg(DEFAULT_DEMO_ORG);
            setLicense(DEFAULT_DEMO_ORG.license || null);
          }
        }

        if (savedLicense) {
          try {
            const parsedLic = JSON.parse(savedLicense);
            setLicense(parsedLic);
          } catch {
            // ignore
          }
        }

        if (savedDemo) {
          try {
            const parsedUser = JSON.parse(savedDemo);
            setUser(parsedUser);
            setIsLoading(false);
            return;
          } catch {
            localStorage.removeItem("deku_demo_user");
          }
        }

        const savedAuthUser = localStorage.getItem("deku_auth_user");
        if (savedAuthUser) {
          try {
            const parsed = JSON.parse(savedAuthUser);
            setUser(parsed);
          } catch {
            localStorage.removeItem("deku_auth_user");
          }
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.user) {
          const authUser = {
            id: session.user.id,
            email: session.user.email || "",
            full_name:
              session.user.user_metadata?.full_name ||
              session.user.email?.split("@")[0],
            avatar_url: session.user.user_metadata?.avatar_url,
            is_demo: false,
          };
          setUser(authUser);
          localStorage.setItem("deku_auth_user", JSON.stringify(authUser));
          if (session.access_token) {
            localStorage.setItem("deku_auth_token", session.access_token);
          }
        }
      } catch (e) {
        console.error("Auth init error:", e);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const authUser = {
          id: session.user.id,
          email: session.user.email || "",
          full_name:
            session.user.user_metadata?.full_name ||
            session.user.email?.split("@")[0],
          avatar_url: session.user.user_metadata?.avatar_url,
          is_demo: false,
        };
        setUser(authUser);
        localStorage.setItem("deku_auth_user", JSON.stringify(authUser));
        localStorage.removeItem("deku_demo_user");
        if (session.access_token) {
          localStorage.setItem("deku_auth_token", session.access_token);
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
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

  const setOrganisation = (org: Organisation) => {
    setOrg(org);
    setOperatingModeState(org.operating_mode);
    if (org.license) {
      setLicense(org.license);
      localStorage.setItem("deku_active_license", JSON.stringify(org.license));
    }
    localStorage.setItem("deku_active_org", JSON.stringify(org));
    localStorage.setItem("deku_operating_mode", org.operating_mode);
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
    const ownerUser = {
      id: crypto.randomUUID(),
      email: cleanEmail,
      full_name: cleanEmail.split("@")[0],
      is_demo: false,
    };
    setUser(ownerUser);
    localStorage.setItem("deku_auth_user", JSON.stringify(ownerUser));
    localStorage.setItem("deku_auth_token", "deku-license-" + ownerUser.id);

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
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: pass,
      });

      if (error) {
        if (error.message.toLowerCase().includes("email not confirmed")) {
          return {
            error: "Email verification is pending for this account. If you did not receive a confirmation email, check Spam or disable 'Confirm email' in Supabase Dashboard (Auth > Providers > Email).",
          };
        }
        return { error: error.message };
      }

      if (data.user) {
        const authUser = {
          id: data.user.id,
          email: data.user.email || email,
          full_name: data.user.user_metadata?.full_name || email.split("@")[0],
          is_demo: false,
        };
        setUser(authUser);
        localStorage.setItem("deku_auth_user", JSON.stringify(authUser));
        if (data.session?.access_token) {
          localStorage.setItem("deku_auth_token", data.session.access_token);
        } else {
          localStorage.setItem("deku_auth_token", "deku-auth-" + data.user.id);
        }
        localStorage.removeItem("deku_demo_user");

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
      const { data, error } = await supabase.auth.signUp({
        email,
        password: pass,
        options: {
          data: {
            full_name: fullName,
            business_name: businessName,
            initial_mode: mode,
            operating_state: state,
            plan_tier: plan,
          },
        },
      });

      if (error) {
        return { error: error.message };
      }

      const orgId = crypto.randomUUID();
      // Auto-issue 15-day Temp License with 5-day migration grace period
      const newLicense = createDefaultLicense(orgId, email, "temp", plan);

      const newOrg: Organisation = {
        id: orgId,
        name: businessName,
        slug: businessName.toLowerCase().replace(/[^a-z0-9]/g, "-"),
        legal_name: businessName,
        currency: "INR",
        timezone: "Asia/Kolkata",
        fy_start_month: 4,
        operating_mode: mode,
        operating_state: state,
        state_code: "27",
        upi_vpa: "7506461004@paytm",
        turnover_limit: mode === "pure_accounting" ? 4000000 : undefined,
        current_turnover: 0,
        license: newLicense,
      };

      setOrganisation(newOrg);
      setLicense(newLicense);
      localStorage.setItem("deku_active_license", JSON.stringify(newLicense));

      // Dispatch activation email on signup
      await sendActivationEmail(email);

      const authUser = {
        id: data.user?.id || crypto.randomUUID(),
        email: email,
        full_name: fullName,
        is_demo: false,
      };
      setUser(authUser);
      localStorage.setItem("deku_auth_user", JSON.stringify(authUser));
      if (data.session?.access_token) {
        localStorage.setItem("deku_auth_token", data.session.access_token);
      } else {
        localStorage.setItem("deku_auth_token", "deku-user-" + authUser.id);
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
    let demoUser: UserProfile;
    let demoOrg: Organisation;
    let demoLic: OrganisationLicense;

    if (type === "owner") {
      demoUser = {
        id: "11111111-1111-1111-1111-111111111111",
        email: "owner@tenant1.com",
        full_name: "Medhansh (Founder)",
        is_demo: true,
      };
      demoLic = createDefaultLicense(
        DEFAULT_DEMO_ORG.id,
        "owner@tenant1.com",
        "plan",
        "pro"
      );
      demoOrg = {
        ...DEFAULT_DEMO_ORG,
        operating_mode: "gst_enterprise",
        license: demoLic,
      };
    } else if (type === "freelancer") {
      demoUser = {
        id: "44444444-4444-4444-4444-444444444444",
        email: "freelancer@deku.finance",
        full_name: "Aarav Sharma (Studio Lead)",
        is_demo: true,
      };
      demoLic = createDefaultLicense(
        "44444444-org-4444-4444-444444444444",
        "freelancer@deku.finance",
        "temp",
        "go"
      );
      demoOrg = {
        ...DEFAULT_DEMO_ORG,
        id: "44444444-org-4444-4444-444444444444",
        name: "Sharma Creative Studio",
        legal_name: "Sharma Creative Studio",
        gstin: undefined,
        operating_mode: "pure_accounting",
        license: demoLic,
      };
    } else {
      demoUser = {
        id: "22222222-2222-2222-2222-222222222222",
        email: "accountant@tenant1.com",
        full_name: "Rohan Verma (Tax Lead)",
        is_demo: true,
      };
      demoLic = createDefaultLicense(
        DEFAULT_DEMO_ORG.id,
        "accountant@tenant1.com",
        "plan",
        "pro"
      );
      demoOrg = {
        ...DEFAULT_DEMO_ORG,
        operating_mode: "gst_enterprise",
        license: demoLic,
      };
    }

    setUser(demoUser);
    setOrganisation(demoOrg);
    setLicense(demoLic);
    setOperatingModeState(demoOrg.operating_mode);
    localStorage.setItem("deku_demo_user", JSON.stringify(demoUser));
    localStorage.setItem("deku_auth_user", JSON.stringify(demoUser));
    localStorage.setItem("deku_auth_token", "deku-demo-" + type);
    localStorage.setItem("deku_active_org", JSON.stringify(demoOrg));
    localStorage.setItem("deku_active_license", JSON.stringify(demoLic));
    localStorage.setItem("deku_operating_mode", demoOrg.operating_mode);
    setIsLoading(false);
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn("Sign out err:", e);
    }
    setUser(null);
    localStorage.removeItem("deku_auth_user");
    localStorage.removeItem("deku_auth_token");
    localStorage.removeItem("deku_demo_user");
    localStorage.removeItem("deku_active_org");
    localStorage.removeItem("deku_active_license");
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
