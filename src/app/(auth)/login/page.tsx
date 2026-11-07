"use client";

import React, { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { safeNextPath } from "@/lib/auth/next-path";
import { useAuth } from "@/context/AuthContext";
import {
  ReceiptText,
  Mail,
  Lock,
  ArrowRight,
  Eye,
  EyeOff,
  Zap,
  ShieldCheck,
  Building,
  User,
  AlertCircle,
  Loader2,
  Sparkles,
  BookOpen,
  KeyRound,
} from "lucide-react";
import { InteractivePlanTutorialModal } from "@/components/tutorial/InteractivePlanTutorialModal";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, loginDemo, user } = useAuth();

  const [licenseKey, setLicenseKey] = useState("DEKU-PRO-2026-88A1-42F0");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState(() => {
    const err = searchParams.get("error");
    if (err === "auth_code_error") return "Authentication link expired or invalid.";
    return "";
  });
  const [isLoading, setIsLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState<string | null>(null);
  const [demoEnabled, setDemoEnabled] = useState(false);
  // client.ts sends ?next= after a lost session, /join sends ?redirect= with the invitation.
  const nextPath = safeNextPath(searchParams.get("next") ?? searchParams.get("redirect"));

  useEffect(() => {
    fetch("/api/auth/demo")
      .then((r) => r.json())
      .then((d) => setDemoEnabled(d.enabled === true))
      .catch(() => setDemoEnabled(false));
  }, []);

  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const [tutorialPlan, setTutorialPlan] = useState<"freelancer" | "enterprise">("enterprise");

  const openTutorial = (plan: "freelancer" | "enterprise") => {
    setTutorialPlan(plan);
    setIsTutorialOpen(true);
  };

  // In an effect: Next keeps this page mounted but hidden after leaving it, and a redirect during
  // render would keep firing from there and fight the onboarding redirect in a loop.
  useEffect(() => {
    if (user) router.replace(nextPath);
  }, [user, nextPath, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!licenseKey.trim()) {
      setErrorMsg("Activation License Key is strictly required to log in.");
      return;
    }

    setIsLoading(true);

    try {
      // 1. Verify Activation License Key with Ecosystem Authority
      const licRes = await fetch("/api/ecosystem/validate-license", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          licenseKey: licenseKey.trim(),
          email: email.trim(),
        }),
      });
      const licData = await licRes.json();

      if (!licData.success) {
        setIsLoading(false);
        setErrorMsg(licData.error || "Invalid or inactive activation license key.");
        return;
      }

      // 2. Proceed with user authentication
      const res = await login(email, password);
      setIsLoading(false);
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        router.push(nextPath);
      }
    } catch (err: any) {
      setIsLoading(false);
      setErrorMsg(err.message || "Failed to validate activation license");
    }
  };

  const handleDemoLogin = async (type: "owner" | "freelancer" | "accountant") => {
    setDemoLoading(type);
    setErrorMsg("");
    try {
      await loginDemo(type);
      router.push(nextPath);
    } catch {
      setErrorMsg("Failed to start demo session");
    } finally {
      setDemoLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-panel-deep via-panel to-panel-deep text-white flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden font-sans">
      {/* Background Ambient Glow */}
      <div className="absolute top-0 right-1/4 -mt-20 w-96 h-96 bg-brand/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 -mb-20 w-96 h-96 bg-sky-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 text-center space-y-3">
        {/* Brand Logo */}
        <Link href="/" className="inline-flex items-center gap-3 group">
          <div className="h-12 w-12 rounded-2xl bg-brand text-panel-deep flex items-center justify-center font-black shadow-lg shadow-brand/25 group-hover:scale-105 transition-transform">
            <ReceiptText className="h-6 w-6 text-panel-deep" />
          </div>
        </Link>
        <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
          Sign In to Deku Finance
        </h2>
        <p className="text-xs text-slate-400 max-w-xs mx-auto">
          Access your dual-mode accounting, live GST returns, and immutable ALERX ledger.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-panel/90 backdrop-blur-xl border border-edge rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5">
          {/* Notifications / Alerts */}
          {errorMsg && (
            <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 p-3.5 flex items-center gap-2.5 text-xs text-rose-300">
              <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Quick Sandbox & Interactive Tutorial Options */}
          {demoEnabled && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
              <span className="flex items-center gap-1.5 text-brand">
                <Sparkles className="h-3.5 w-3.5 fill-brand" />
                Interactive Plan Tour
              </span>
              <button
                type="button"
                onClick={() => openTutorial("enterprise")}
                className="text-[10px] text-brand hover:underline flex items-center gap-1 font-semibold"
              >
                <BookOpen className="h-3 w-3" />
                Compare &amp; Learn
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => openTutorial("enterprise")}
                className="py-2.5 px-3 rounded-xl bg-panel-raised hover:bg-edge border border-edge text-xs font-bold text-white text-left transition-all flex items-center justify-between group hover:border-brand/50 shadow-sm"
              >
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-brand/10 border border-brand/30 flex items-center justify-center text-brand shrink-0 group-hover:scale-105 transition-transform">
                    <Building className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <div className="text-white text-xs">PRO (₹49,999/yr)</div>
                    <div className="text-[9px] text-slate-400 font-normal">Full GST &amp; Team</div>
                  </div>
                </div>
                <ArrowRight className="h-3 w-3 text-slate-500 group-hover:text-brand transition-colors" />
              </button>

              <button
                type="button"
                onClick={() => openTutorial("freelancer")}
                className="py-2.5 px-3 rounded-xl bg-panel-raised hover:bg-edge border border-edge text-xs font-bold text-white text-left transition-all flex items-center justify-between group hover:border-emerald-500/50 shadow-sm"
              >
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 group-hover:scale-105 transition-transform">
                    <User className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <div className="text-white text-xs">GO (₹24,999/yr)</div>
                    <div className="text-[9px] text-slate-400 font-normal">Section 22 &amp; Solo</div>
                  </div>
                </div>
                <ArrowRight className="h-3 w-3 text-slate-500 group-hover:text-emerald-400 transition-colors" />
              </button>
            </div>
            <p className="text-[10px] text-slate-400 text-center">
              Click either plan to open the interactive comparison, invoice simulator &amp; tutorial.
            </p>
          </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {/* Activation License Key */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-300">
                  Activation License Key
                </label>
                <Link
                  href="/request-setup"
                  className="text-[11px] font-medium text-brand hover:underline"
                >
                  Need a license?
                </Link>
              </div>
              <div className="relative">
                <KeyRound className="h-4 w-4 text-brand absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={licenseKey}
                  onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
                  placeholder="DEKU-PRO-2026-XXXX-XXXX"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-panel-deep border border-edge text-xs font-mono text-brand font-semibold placeholder-slate-500 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-all uppercase"
                />
              </div>
            </div>

            {/* Standard Login Email */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-300">
                  Work Email Address
                </label>
              </div>
              <div className="relative">
                <Mail className="h-4 w-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-panel-deep border border-edge text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-all"
                />
              </div>
            </div>

                {/* Standard Password */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-300">
                      Password
                    </label>
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        alert("Ask your company's owner or administrator for a password reset link. They can create one under Departments & Members.");
                      }}
                      className="text-[11px] font-medium text-brand hover:underline"
                    >
                      Forgot password?
                    </a>
                  </div>
                  <div className="relative">
                    <Lock className="h-4 w-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-panel-deep border border-edge text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-brand hover:bg-brand-soft py-3 px-4 text-xs font-bold text-panel-deep shadow-md shadow-brand/20 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-panel-deep" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>Sign In to Workspace</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Helpline and Privacy Footnote */}
          <div className="pt-2 flex flex-col items-center justify-center gap-1 text-[11px] text-slate-500">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              <span>Zero password sharing • 256-Bit SSL Encryption</span>
            </div>
            <span>Support Helpline: <strong>+91 7506461004</strong></span>
          </div>
        </div>

        {/* Link to Enterprise Onboarding & Setup */}
        <div className="mt-6 text-center space-y-1">
          <p className="text-xs text-slate-400">
            New Business or Enterprise?{" "}
            <Link href="/request-setup" className="font-bold text-brand hover:underline">
              Request Setup &amp; Activation License ➔
            </Link>
          </p>
          <p className="text-[10px] text-slate-500">
            Onboarding is handled exclusively by authorized regional distributors.
          </p>
        </div>
      </div>

      {/* Interactive Plan Tutorial & Architecture Walkthrough Modal */}
      <InteractivePlanTutorialModal
        isOpen={isTutorialOpen}
        onClose={() => setIsTutorialOpen(false)}
        initialPlan={tutorialPlan}
        onLaunchDemo={async (type) => {
          setIsTutorialOpen(false);
          await handleDemoLogin(type);
        }}
        isLoadingDemo={demoLoading}
      />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-panel-deep flex items-center justify-center text-white">
          <Loader2 className="h-8 w-8 animate-spin text-brand" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
