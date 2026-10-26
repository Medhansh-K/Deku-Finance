"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { OperatingMode } from "@/types";
import {
  ReceiptText,
  UserCheck,
  Building2,
  Mail,
  Lock,
  User,
  Briefcase,
  MapPin,
  QrCode,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  Zap,
} from "lucide-react";

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signup, user } = useAuth();

  const initialPlan = searchParams.get("plan") === "pro" ? "pro" : "go";
  const [selectedPlan, setSelectedPlan] = useState<"go" | "pro">(initialPlan);
  const [mode, setMode] = useState<OperatingMode>("pure_accounting");
  const [fullName, setFullName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = useState("Maharashtra");
  const [upiVpa, setUpiVpa] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // If already logged in, redirect
  if (user) {
    router.push("/gateway");
  }

  const indianStates = [
    "Maharashtra",
    "Karnataka",
    "Delhi",
    "Tamil Nadu",
    "Gujarat",
    "Telangana",
    "Uttar Pradesh",
    "Haryana",
    "Rajasthan",
    "West Bengal",
    "Kerala",
    "Madhya Pradesh",
    "Andhra Pradesh",
    "Punjab",
    "Goa",
    "Other",
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setIsLoading(true);

    const res = await signup(email, password, fullName, businessName, mode, state);
    setIsLoading(false);

    if (res.error) {
      setErrorMsg(res.error);
    } else {
      router.push("/gateway");
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden font-sans">
      {/* Background Ambient Glow */}
      <div className="absolute top-0 left-1/4 -mt-20 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 -mb-20 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-2xl relative z-10 text-center space-y-2">
        <Link href="/" className="inline-flex items-center gap-3 group">
          <div className="h-12 w-12 rounded-2xl bg-amber-400 text-black flex items-center justify-center font-black shadow-lg shadow-amber-400/25 group-hover:scale-105 transition-transform">
            <ReceiptText className="h-6 w-6 text-zinc-950" />
          </div>
        </Link>
        <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
          Complete Your Workspace Setup
        </h2>
        <p className="text-xs text-zinc-400 max-w-md mx-auto">
          Choose your plan and operating mode. Zero password sharing — your credentials stay 100% private.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-2xl relative z-10">
        <div className="bg-zinc-900/90 backdrop-blur-xl border border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          {/* Error Banner */}
          {errorMsg && (
            <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 p-3.5 flex items-center gap-2.5 text-xs text-rose-300">
              <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 2-Plan Selector (GO vs PRO) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400">
                1. Select Subscription Plan (2 Plans Available)
              </label>
              <Link href="/#pricing" className="text-[11px] text-amber-400 hover:underline">
                View Feature Matrix ➔
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* GO Plan Card */}
              <div
                onClick={() => setSelectedPlan("go")}
                className={`cursor-pointer rounded-2xl p-4 border transition-all text-left space-y-1.5 ${
                  selectedPlan === "go"
                    ? "bg-emerald-500/10 border-emerald-500 shadow-md ring-1 ring-emerald-500"
                    : "bg-zinc-950 border-zinc-800 hover:border-zinc-700"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-black text-white">GO Plan</span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    <Sparkles className="h-2.5 w-2.5" />
                    15-Day Free Trial
                  </span>
                </div>
                <div className="text-xs text-zinc-300 font-medium">
                  ₹1,499/mo <span className="text-[10px] text-emerald-400 font-bold">(₹0 for 15 Days)</span>
                </div>
                <p className="text-[10px] text-zinc-400 leading-normal">
                  Standard invoice field customization, dynamic UPI QR on invoices, and up to 150 bills/mo.
                </p>
              </div>

              {/* PRO Plan Card */}
              <div
                onClick={() => setSelectedPlan("pro")}
                className={`cursor-pointer rounded-2xl p-4 border transition-all text-left space-y-1.5 ${
                  selectedPlan === "pro"
                    ? "bg-amber-400/10 border-amber-400 shadow-md ring-1 ring-amber-400"
                    : "bg-zinc-950 border-zinc-800 hover:border-zinc-700"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-black text-white">PRO Plan</span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30">
                    <Zap className="h-2.5 w-2.5" />
                    Scaling Tier
                  </span>
                </div>
                <div className="text-xs text-zinc-300 font-medium">
                  ₹4,999/mo <span className="text-[10px] text-zinc-400">(₹3,999/mo billed annually)</span>
                </div>
                <p className="text-[10px] text-zinc-400 leading-normal">
                  Unlimited invoices, advanced field builder, 1-click GSTN offline JSON, and VIP helpline.
                </p>
              </div>
            </div>
          </div>

          {/* Active Plan Banner */}
          {selectedPlan === "go" ? (
            <div className="rounded-2xl bg-gradient-to-r from-emerald-500/15 via-emerald-500/10 to-transparent border border-emerald-500/30 p-3.5 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-emerald-300">
                <Sparkles className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>
                  <strong>15-Day Free Trial on GO Active</strong>: Full feature access enabled automatically upon signup (No credit card required).
                </span>
              </div>
              <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold uppercase border border-emerald-500/30">
                GO Trial
              </span>
            </div>
          ) : (
            <div className="rounded-2xl bg-gradient-to-r from-amber-400/15 via-amber-400/10 to-transparent border border-amber-400/30 p-3.5 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-amber-300">
                <Zap className="h-4 w-4 text-amber-400 shrink-0" />
                <span>
                  <strong>PRO Plan Selected</strong>: Dedicated onboarding assistance & VIP helpline (+91 7506461004) included.
                </span>
              </div>
              <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 text-[10px] font-bold uppercase border border-amber-400/30">
                PRO Tier
              </span>
            </div>
          )}

          {/* Operating Mode Selector (Matching Screenshot 2627) */}
          <div className="space-y-3">
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400">
              2. Choose Operating Mode
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Option A: Pure Accounting */}
              <div
                onClick={() => setMode("pure_accounting")}
                className={`cursor-pointer rounded-2xl p-4.5 border transition-all text-left space-y-2 ${
                  mode === "pure_accounting"
                    ? "bg-amber-400/10 border-amber-400 shadow-md ring-1 ring-amber-400"
                    : "bg-zinc-950 border-zinc-800 hover:border-zinc-700"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="h-8 w-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <UserCheck className="h-4 w-4" />
                  </div>
                  {mode === "pure_accounting" && (
                    <CheckCircle2 className="h-4 w-4 text-amber-400" />
                  )}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">
                    Pure Accounting (Non-GST)
                  </h4>
                  <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                    For Freelancers, Startups & Small Businesses under ₹20L/₹40L. Issues standard Commercial Invoices & Bills of Supply with zero GST complexity.
                  </p>
                </div>
                <div className="pt-2 flex flex-wrap gap-1.5 text-[10px] font-bold">
                  <span className="bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded">
                    NO GSTIN REQUIRED
                  </span>
                  <span className="bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded">
                    SEC 22 CGST EXEMPT
                  </span>
                </div>
              </div>

              {/* Option B: GST Registered */}
              <div
                onClick={() => setMode("gst_enterprise")}
                className={`cursor-pointer rounded-2xl p-4.5 border transition-all text-left space-y-2 ${
                  mode === "gst_enterprise"
                    ? "bg-amber-400/10 border-amber-400 shadow-md ring-1 ring-amber-400"
                    : "bg-zinc-950 border-zinc-800 hover:border-zinc-700"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="h-8 w-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                    <Building2 className="h-4 w-4" />
                  </div>
                  {mode === "gst_enterprise" && (
                    <CheckCircle2 className="h-4 w-4 text-amber-400" />
                  )}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">
                    GST Registered Enterprise
                  </h4>
                  <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                    Enter your 15-digit GSTIN. Government API Setu instantly auto-fetches your verified legal entity name, trade name, and registered address.
                  </p>
                </div>
                <div className="pt-2 flex flex-wrap gap-1.5 text-[10px] font-bold">
                  <span className="bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded">
                    API SETU AUTO-FETCH
                  </span>
                  <span className="bg-amber-400/20 text-amber-300 px-2 py-0.5 rounded">
                    GSTR-1 & 3B READY
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 22 CGST Advisory Box (Matching Screenshot 2628) */}
          {mode === "pure_accounting" ? (
            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3.5 flex items-start gap-2.5 text-xs text-emerald-300">
              <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong className="font-semibold block text-white">
                  Exempted Registration under Section 22 of the CGST Act
                </strong>
                <span className="text-[11px] text-emerald-300/80 leading-relaxed block mt-0.5">
                  Your business will operate in Pure Accounting mode. Invoices will be issued as Commercial Invoices / Bills of Supply without charging tax. If your turnover approaches ₹20L/₹40L, you can activate GST filing anytime.
                </span>
              </div>
            </div>
          ) : (
            <div className="rounded-xl bg-amber-400/10 border border-amber-400/20 p-3.5 flex items-start gap-2.5 text-xs text-amber-300">
              <Building2 className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="font-semibold block text-white">
                  GST Multi-State Tax Compliance Mode
                </strong>
                <span className="text-[11px] text-amber-300/80 leading-relaxed block mt-0.5">
                  Full automatic intra/inter-state tax splitting (CGST, SGST, IGST), e-Way bill support, and exportable GSTR-3B offline JSON.
                </span>
              </div>
            </div>
          )}

          {/* Registration Form */}
          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Business / Practice Name *
                </label>
                <div className="relative">
                  <Briefcase className="h-4 w-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="e.g. Sharma Creative Studio or Apex Consulting"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Owner / Signatory Name *
                </label>
                <div className="relative">
                  <User className="h-4 w-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Medhansh K"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Work Email *
                </label>
                <div className="relative">
                  <Mail className="h-4 w-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@business.com"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Password *
                </label>
                <div className="relative">
                  <Lock className="h-4 w-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Create a secure password"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Operating State (Place of Supply) *
                </label>
                <div className="relative">
                  <MapPin className="h-4 w-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <select
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all"
                  >
                    {indianStates.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Instant UPI VPA (For Scan-to-Pay on Bills)
                </label>
                <div className="relative">
                  <QrCode className="h-4 w-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={upiVpa}
                    onChange={(e) => setUpiVpa(e.target.value)}
                    placeholder="e.g. 7506461004@paytm or yourbusiness@okaxis"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-amber-400 hover:bg-amber-300 py-3.5 px-4 text-xs font-bold text-zinc-950 shadow-md shadow-amber-400/20 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-zinc-950" />
                  <span>Configuring Workspace...</span>
                </>
              ) : (
                <>
                  <span>
                    {selectedPlan === "go"
                      ? "Start 15-Day Free Trial (GO Plan)"
                      : "Activate PRO Workspace"}
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Privacy Footnote */}
          <div className="pt-2 flex items-center justify-center gap-1.5 text-[11px] text-zinc-500">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            <span>Dedicated Support Helpline: +91 7506461004</span>
          </div>
        </div>

        {/* Link to Login */}
        <p className="mt-6 text-center text-xs text-zinc-400">
          Already have a workspace?{" "}
          <Link href="/login" className="font-bold text-amber-400 hover:underline">
            Sign In ➔
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-400">
          <div className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-amber-400" />
            <span className="text-sm">Loading workspace setup...</span>
          </div>
        </div>
      }
    >
      <SignupForm />
    </Suspense>
  );
}
