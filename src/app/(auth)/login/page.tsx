"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
} from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, loginDemo, user, activateLicense, sendActivationEmail } = useAuth();

  const [activeTab, setActiveTab] = useState<"login" | "activate">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [licenseKey, setLicenseKey] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState(() => {
    const err = searchParams.get("error");
    if (err === "auth_code_error") return "Authentication link expired or invalid.";
    return "";
  });
  const [successMsg, setSuccessMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [demoLoading, setDemoLoading] = useState<string | null>(null);

  // If already logged in, redirect
  if (user) {
    router.push("/gateway");
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    setIsLoading(true);

    if (activeTab === "activate") {
      const res = await activateLicense(licenseKey, ownerEmail, ownerPassword);
      if (!res.success) {
        setErrorMsg(res.error || "License activation failed.");
        setIsLoading(false);
        return;
      }

      // Also sign in or start session for owner
      const loginRes = await login(ownerEmail, ownerPassword);
      setIsLoading(false);
      if (loginRes.error) {
        // If password login fails, proceed with demo/activated session
        setSuccessMsg("License activated successfully! Entering workspace...");
        setTimeout(() => router.push("/gateway"), 1000);
      } else {
        router.push("/gateway");
      }
    } else {
      const res = await login(email, password);
      setIsLoading(false);

      if (res.error) {
        setErrorMsg(res.error);
      } else {
        router.push("/gateway");
      }
    }
  };

  const handleSendLicenseEmail = async () => {
    const target = activeTab === "activate" ? ownerEmail : email;
    if (!target) {
      setErrorMsg("Please enter your work email to receive the license key.");
      return;
    }
    setErrorMsg("");
    setIsSendingEmail(true);
    const res = await sendActivationEmail(target);
    setIsSendingEmail(false);
    if (res.success) {
      setSuccessMsg(`✓ Activation email sent! Check simulated inbox toast below.`);
      if (res.licenseKey && activeTab === "activate") {
        setLicenseKey(res.licenseKey);
      }
    } else {
      setErrorMsg(res.message || "Failed to dispatch email.");
    }
  };

  const handleDemoLogin = async (type: "owner" | "freelancer" | "accountant") => {
    setDemoLoading(type);
    setErrorMsg("");
    try {
      await loginDemo(type);
      router.push("/gateway");
    } catch {
      setErrorMsg("Failed to start demo session");
    } finally {
      setDemoLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden font-sans">
      {/* Background Ambient Glow */}
      <div className="absolute top-0 right-1/4 -mt-20 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 -mb-20 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 text-center space-y-3">
        {/* Brand Logo */}
        <Link href="/" className="inline-flex items-center gap-3 group">
          <div className="h-12 w-12 rounded-2xl bg-amber-400 text-black flex items-center justify-center font-black shadow-lg shadow-amber-400/25 group-hover:scale-105 transition-transform">
            <ReceiptText className="h-6 w-6 text-zinc-950" />
          </div>
        </Link>
        <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
          Sign In to Deku Finance
        </h2>
        <p className="text-xs text-zinc-400 max-w-xs mx-auto">
          Access your dual-mode accounting, live GST returns, and immutable ALERX ledger.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-zinc-900/90 backdrop-blur-xl border border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5">
          {/* Notifications / Alerts */}
          {errorMsg && (
            <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 p-3.5 flex items-center gap-2.5 text-xs text-rose-300">
              <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3.5 flex items-center gap-2.5 text-xs text-emerald-300">
              <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Quick Sandbox / Instant Demo Options */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-zinc-400">
              <span className="flex items-center gap-1.5 text-amber-400">
                <Zap className="h-3.5 w-3.5 fill-amber-400" />
                Instant Demo Sandbox
              </span>
              <span className="text-[10px] text-zinc-500">Pre-activated licenses</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleDemoLogin("owner")}
                disabled={demoLoading !== null}
                className="py-2 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/60 text-xs font-bold text-white text-left transition-colors flex items-center justify-between"
              >
                <div className="flex items-center gap-1.5">
                  <Building className="h-3.5 w-3.5 text-amber-400" />
                  <span>PRO Enterprise</span>
                </div>
                {demoLoading === "owner" && (
                  <Loader2 className="h-3 w-3 animate-spin text-amber-400" />
                )}
              </button>

              <button
                type="button"
                onClick={() => handleDemoLogin("freelancer")}
                disabled={demoLoading !== null}
                className="py-2 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/60 text-xs font-bold text-white text-left transition-colors flex items-center justify-between"
              >
                <div className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-emerald-400" />
                  <span>GO Temp (15d)</span>
                </div>
                {demoLoading === "freelancer" && (
                  <Loader2 className="h-3 w-3 animate-spin text-emerald-400" />
                )}
              </button>
            </div>
          </div>

          {/* Tab Selector: Standard Login vs Activate with License Key */}
          <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-800 text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setActiveTab("login");
                setErrorMsg("");
                setSuccessMsg("");
              }}
              className={`flex-1 py-2 rounded-lg transition-all ${
                activeTab === "login"
                  ? "bg-amber-400 text-zinc-950 font-bold shadow-xs"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("activate");
                setErrorMsg("");
                setSuccessMsg("");
              }}
              className={`flex-1 py-2 rounded-lg transition-all ${
                activeTab === "activate"
                  ? "bg-amber-400 text-zinc-950 font-bold shadow-xs"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              🔑 Activate License
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {activeTab === "activate" ? (
              <>
                {/* License Key Field */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-zinc-300">
                      License Key *
                    </label>
                    <button
                      type="button"
                      onClick={handleSendLicenseEmail}
                      disabled={isSendingEmail}
                      className="text-[11px] font-medium text-amber-400 hover:underline flex items-center gap-1"
                    >
                      <Mail className="h-3 w-3" />
                      <span>{isSendingEmail ? "Sending..." : "Email My Key"}</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    value={licenseKey}
                    onChange={(e) => setLicenseKey(e.target.value)}
                    placeholder="e.g. DEKU-TEMP-GO-7506-4610"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs font-mono font-bold text-amber-300 placeholder-zinc-600 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all uppercase"
                  />
                  <span className="text-[10px] text-zinc-500 mt-1 block">
                    Temp license: 15-day trial + 5-day migration period (20d total access).
                  </span>
                </div>

                {/* Owner Email */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Owner's Registered Email *
                  </label>
                  <div className="relative">
                    <Mail className="h-4 w-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={ownerEmail}
                      onChange={(e) => setOwnerEmail(e.target.value)}
                      placeholder="owner@business.com"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all"
                    />
                  </div>
                </div>

                {/* Owner Password */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Owner's Password *
                  </label>
                  <div className="relative">
                    <Lock className="h-4 w-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={ownerPassword}
                      onChange={(e) => setOwnerPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Standard Login Email */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-zinc-300">
                      Work Email Address
                    </label>
                    <button
                      type="button"
                      onClick={handleSendLicenseEmail}
                      disabled={isSendingEmail}
                      className="text-[11px] font-medium text-amber-400 hover:underline flex items-center gap-1"
                    >
                      <Mail className="h-3 w-3" />
                      <span>{isSendingEmail ? "Sending..." : "Send Activation Email"}</span>
                    </button>
                  </div>
                  <div className="relative">
                    <Mail className="h-4 w-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@company.com"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all"
                    />
                  </div>
                </div>

                {/* Standard Password */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-zinc-300">
                      Password
                    </label>
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        alert("Please use the Instant Demo Sandbox or contact support at +91 7506461004.");
                      }}
                      className="text-[11px] font-medium text-amber-400 hover:underline"
                    >
                      Forgot password?
                    </a>
                  </div>
                  <div className="relative">
                    <Lock className="h-4 w-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-amber-400 hover:bg-amber-300 py-3 px-4 text-xs font-bold text-zinc-950 shadow-md shadow-amber-400/20 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-zinc-950" />
                  <span>
                    {activeTab === "activate"
                      ? "Verifying & Activating..."
                      : "Authenticating..."}
                  </span>
                </>
              ) : (
                <>
                  <span>
                    {activeTab === "activate"
                      ? "Verify & Activate Organisation"
                      : "Sign In to Workspace"}
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Helpline and Privacy Footnote */}
          <div className="pt-2 flex flex-col items-center justify-center gap-1 text-[11px] text-zinc-500">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              <span>Zero password sharing • 256-Bit SSL Encryption</span>
            </div>
            <span>Support & Activation Helpline: <strong>+91 7506461004</strong></span>
          </div>
        </div>

        {/* Link to Signup */}
        <p className="mt-6 text-center text-xs text-zinc-400">
          New to Deku Finance?{" "}
          <Link href="/signup" className="font-bold text-amber-400 hover:underline">
            Create Free Workspace ➔
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-white">
          <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
