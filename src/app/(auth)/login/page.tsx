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
  const { login, loginDemo, user } = useAuth();

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

  // If already logged in, redirect
  if (user) {
    router.push("/gateway");
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setIsLoading(true);
    const res = await login(email, password);
    setIsLoading(false);
    if (res.error) {
      setErrorMsg(res.error);
    } else {
      router.push("/gateway");
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

          {/* Quick Sandbox / Instant Demo Options */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
              <span className="flex items-center gap-1.5 text-brand">
                <Zap className="h-3.5 w-3.5 fill-brand" />
                Instant Demo Sandbox
              </span>
              <span className="text-[10px] text-slate-500">Fictional sample companies</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleDemoLogin("owner")}
                disabled={demoLoading !== null}
                className="py-2 px-3 rounded-xl bg-panel-raised hover:bg-edge border border-edge text-xs font-bold text-white text-left transition-colors flex items-center justify-between"
              >
                <div className="flex items-center gap-1.5">
                  <Building className="h-3.5 w-3.5 text-brand" />
                  <span>PRO Enterprise</span>
                </div>
                {demoLoading === "owner" && (
                  <Loader2 className="h-3 w-3 animate-spin text-brand" />
                )}
              </button>

              <button
                type="button"
                onClick={() => handleDemoLogin("freelancer")}
                disabled={demoLoading !== null}
                className="py-2 px-3 rounded-xl bg-panel-raised hover:bg-edge border border-edge text-xs font-bold text-white text-left transition-colors flex items-center justify-between"
              >
                <div className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-emerald-400" />
                  <span>GO Freelancer</span>
                </div>
                {demoLoading === "freelancer" && (
                  <Loader2 className="h-3 w-3 animate-spin text-emerald-400" />
                )}
              </button>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
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
                        alert("Please use the Instant Demo Sandbox or contact support at +91 7506461004.");
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

        {/* Link to Signup */}
        <p className="mt-6 text-center text-xs text-slate-400">
          New to Deku Finance?{" "}
          <Link href="/signup" className="font-bold text-brand hover:underline">
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
        <div className="min-h-screen bg-panel-deep flex items-center justify-center text-white">
          <Loader2 className="h-8 w-8 animate-spin text-brand" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
