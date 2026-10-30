"use client";

import React, { useState, useEffect, Suspense } from "react";
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

  const [selectedPlan, setSelectedPlan] = useState<"go" | "pro">(() => {
    const planParam = searchParams.get("plan");
    if (planParam === "pro" || planParam === "enterprise") return "pro";
    return "go";
  });

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
  useEffect(() => {
    if (user) {
      router.push("/gateway");
    }
  }, [user, router]);

  if (user) {
    return null;
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

    const res = await signup(email, password, fullName, businessName, mode, state, selectedPlan);
    setIsLoading(false);

    if (res.error) {
      setErrorMsg(res.error);
    } else {
      router.push("/gateway");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#060D17] via-[#091524] to-[#060D17] text-white flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden font-sans">
      {/* Background Ambient Glows - Signature Blue & Cyan */}
      <div className="absolute top-0 left-1/4 -mt-20 w-96 h-96 bg-[#5BB5BB]/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 -mb-20 w-96 h-96 bg-[#0284C7]/15 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-2xl relative z-10 text-center space-y-2">
        <Link href="/" className="inline-flex items-center gap-3 group" title="Return to Landing Page">
          <div className="h-12 w-12 rounded-2xl bg-[#5BB5BB] text-[#060D17] flex items-center justify-center font-black shadow-lg shadow-[#5BB5BB]/30 group-hover:scale-105 transition-transform">
            <ReceiptText className="h-6 w-6 text-[#060D17]" />
          </div>
        </Link>
        <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
          Complete Your Workspace Setup
        </h2>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          Choose your plan and operating mode. Zero password sharing — your credentials stay 100% private.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-2xl relative z-10">
        <div className="bg-[#0B1522]/90 backdrop-blur-xl border border-[#1A2E44] rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/80 space-y-6">
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
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                1. Select Subscription Plan (2 Plans Available)
              </label>
              <Link href="/#pricing" className="text-[11px] text-[#5BB5BB] hover:text-[#91D7D2] hover:underline">
                View Feature Matrix ➔
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* GO Plan Card */}
              <div
                onClick={() => setSelectedPlan("go")}
                className={`cursor-pointer rounded-2xl p-4 border transition-all text-left space-y-1.5 ${
                  selectedPlan === "go"
                    ? "bg-[#0E2538] border-[#5BB5BB] shadow-md ring-1 ring-[#5BB5BB]"
                    : "bg-[#07101B] border-[#182C40] hover:border-[#1E3A5A]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-black text-white">GO Plan</span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#5BB5BB]/20 text-[#91D7D2] border border-[#5BB5BB]/30">
                    <Sparkles className="h-2.5 w-2.5" />
                    15-Day Free Trial
                  </span>
                </div>
                <div className="text-xs text-slate-300 font-medium">
                  ₹1,499/mo <span className="text-[10px] text-[#91D7D2] font-bold">(₹0 for 15 Days)</span>
                </div>
                <p className="text-[10px] text-slate-400 leading-normal">
                  Standard invoice field customization, dynamic UPI QR on invoices, and up to 150 bills/mo.
                </p>
              </div>

              {/* PRO Plan Card */}
              <div
                onClick={() => setSelectedPlan("pro")}
                className={`cursor-pointer rounded-2xl p-4 border transition-all text-left space-y-1.5 ${
                  selectedPlan === "pro"
                    ? "bg-[#0A223E] border-[#38BDF8] shadow-md ring-1 ring-[#38BDF8]"
                    : "bg-[#07101B] border-[#182C40] hover:border-[#1E3A5A]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-black text-white">PRO Plan</span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#38BDF8]/20 text-[#7DD3FC] border border-[#38BDF8]/30">
                    <Zap className="h-2.5 w-2.5" />
                    Scaling Tier
                  </span>
                </div>
                <div className="text-xs text-slate-300 font-medium">
                  ₹4,999/mo <span className="text-[10px] text-slate-400">(₹3,999/mo billed annually)</span>
                </div>
                <p className="text-[10px] text-slate-400 leading-normal">
                  Unlimited invoices, advanced field builder, 1-click GSTN offline JSON, and VIP helpline.
                </p>
              </div>
            </div>
          </div>

          {/* Active Plan Banner */}
          {selectedPlan === "go" ? (
            <div className="rounded-2xl bg-gradient-to-r from-[#5BB5BB]/15 via-[#5BB5BB]/10 to-transparent border border-[#5BB5BB]/30 p-3.5 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-[#91D7D2]">
                <Sparkles className="h-4 w-4 text-[#5BB5BB] shrink-0" />
                <span>
                  <strong>15-Day Free Trial on GO Active</strong>: Full feature access enabled automatically upon signup (No credit card required).
                </span>
              </div>
              <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full bg-[#5BB5BB]/20 text-[#91D7D2] text-[10px] font-bold uppercase border border-[#5BB5BB]/30">
                GO Trial
              </span>
            </div>
          ) : (
            <div className="rounded-2xl bg-gradient-to-r from-[#38BDF8]/15 via-[#38BDF8]/10 to-transparent border border-[#38BDF8]/30 p-3.5 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-[#BAE6FD]">
                <Zap className="h-4 w-4 text-[#38BDF8] shrink-0" />
                <span>
                  <strong>PRO Plan Selected</strong>: Dedicated onboarding assistance & VIP helpline (+91 7506461004) included.
                </span>
              </div>
              <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full bg-[#38BDF8]/20 text-[#BAE6FD] text-[10px] font-bold uppercase border border-[#38BDF8]/30">
                PRO Tier
              </span>
            </div>
          )}

          {/* Operating Mode Selector */}
          <div className="space-y-3">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
              2. Choose Operating Mode
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Option A: Pure Accounting */}
              <div
                onClick={() => setMode("pure_accounting")}
                className={`cursor-pointer rounded-2xl p-4.5 border transition-all text-left space-y-2 ${
                  mode === "pure_accounting"
                    ? "bg-[#0E2538] border-[#5BB5BB] shadow-md ring-1 ring-[#5BB5BB]"
                    : "bg-[#07101B] border-[#182C40] hover:border-[#1E3A5A]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="h-8 w-8 rounded-lg bg-[#5BB5BB]/20 text-[#5BB5BB] flex items-center justify-center">
                    <UserCheck className="h-4 w-4" />
                  </div>
                  {mode === "pure_accounting" && (
                    <CheckCircle2 className="h-4 w-4 text-[#5BB5BB]" />
                  )}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">
                    Pure Accounting (Non-GST)
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    For Freelancers, Startups & Small Businesses under ₹20L/₹40L. Issues standard Commercial Invoices & Bills of Supply with zero GST complexity.
                  </p>
                </div>
                <div className="pt-2 flex flex-wrap gap-1.5 text-[10px] font-bold">
                  <span className="bg-[#101E30] text-slate-300 px-2 py-0.5 rounded border border-[#1B3250]">
                    NO GSTIN REQUIRED
                  </span>
                  <span className="bg-[#5BB5BB]/20 text-[#91D7D2] px-2 py-0.5 rounded">
                    SEC 22 CGST EXEMPT
                  </span>
                </div>
              </div>

              {/* Option B: GST Registered */}
              <div
                onClick={() => setMode("gst_enterprise")}
                className={`cursor-pointer rounded-2xl p-4.5 border transition-all text-left space-y-2 ${
                  mode === "gst_enterprise"
                    ? "bg-[#0A223E] border-[#38BDF8] shadow-md ring-1 ring-[#38BDF8]"
                    : "bg-[#07101B] border-[#182C40] hover:border-[#1E3A5A]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="h-8 w-8 rounded-lg bg-[#38BDF8]/20 text-[#38BDF8] flex items-center justify-center">
                    <Building2 className="h-4 w-4" />
                  </div>
                  {mode === "gst_enterprise" && (
                    <CheckCircle2 className="h-4 w-4 text-[#38BDF8]" />
                  )}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">
                    GST Registered Enterprise
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    Enter your 15-digit GSTIN. Government API Setu instantly auto-fetches your verified legal entity name, trade name, and registered address.
                  </p>
                </div>
                <div className="pt-2 flex flex-wrap gap-1.5 text-[10px] font-bold">
                  <span className="bg-[#101E30] text-slate-300 px-2 py-0.5 rounded border border-[#1B3250]">
                    API SETU AUTO-FETCH
                  </span>
                  <span className="bg-[#38BDF8]/20 text-[#BAE6FD] px-2 py-0.5 rounded">
                    GSTR-1 & 3B READY
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 22 CGST Advisory Box */}
          {mode === "pure_accounting" ? (
            <div className="rounded-xl bg-[#5BB5BB]/10 border border-[#5BB5BB]/30 p-3.5 flex items-start gap-2.5 text-xs text-[#91D7D2]">
              <ShieldCheck className="h-4 w-4 text-[#5BB5BB] shrink-0 mt-0.5" />
              <div>
                <strong className="font-semibold block text-white">
                  Exempted Registration under Section 22 of the CGST Act
                </strong>
                <span className="text-[11px] text-slate-400 leading-relaxed block mt-0.5">
                  Your business will operate in Pure Accounting mode. Invoices will be issued as Commercial Invoices / Bills of Supply without charging tax. If your turnover approaches ₹20L/₹40L, you can activate GST filing anytime.
                </span>
              </div>
            </div>
          ) : (
            <div className="rounded-xl bg-[#38BDF8]/10 border border-[#38BDF8]/30 p-3.5 flex items-start gap-2.5 text-xs text-[#BAE6FD]">
              <Building2 className="h-4 w-4 text-[#38BDF8] shrink-0 mt-0.5" />
              <div>
                <strong className="font-semibold block text-white">
                  GST Multi-State Tax Compliance Mode
                </strong>
                <span className="text-[11px] text-slate-400 leading-relaxed block mt-0.5">
                  Full automatic intra/inter-state tax splitting (CGST, SGST, IGST), e-Way bill support, and exportable GSTR-3B offline JSON.
                </span>
              </div>
            </div>
          )}

          {/* Registration Form */}
          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Business / Practice Name *
                </label>
                <div className="relative">
                  <Briefcase className="h-4 w-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="e.g. Sharma Creative Studio or Apex Consulting"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#07101B] border border-[#182C40] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#5BB5BB] focus:ring-1 focus:ring-[#5BB5BB] transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Owner / Signatory Name *
                </label>
                <div className="relative">
                  <User className="h-4 w-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Medhansh K"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#07101B] border border-[#182C40] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#5BB5BB] focus:ring-1 focus:ring-[#5BB5BB] transition-all"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Work Email *
                </label>
                <div className="relative">
                  <Mail className="h-4 w-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@business.com"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#07101B] border border-[#182C40] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#5BB5BB] focus:ring-1 focus:ring-[#5BB5BB] transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Password *
                </label>
                <div className="relative">
                  <Lock className="h-4 w-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Create a secure password"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#07101B] border border-[#182C40] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#5BB5BB] focus:ring-1 focus:ring-[#5BB5BB] transition-all"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Operating State (Place of Supply) *
                </label>
                <div className="relative">
                  <MapPin className="h-4 w-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <select
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#07101B] border border-[#182C40] text-xs text-white focus:outline-none focus:border-[#5BB5BB] focus:ring-1 focus:ring-[#5BB5BB] transition-all"
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
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Instant UPI VPA (For Scan-to-Pay on Bills)
                </label>
                <div className="relative">
                  <QrCode className="h-4 w-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={upiVpa}
                    onChange={(e) => setUpiVpa(e.target.value)}
                    placeholder="e.g. 7506461004@paytm or yourbusiness@okaxis"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#07101B] border border-[#182C40] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#5BB5BB] focus:ring-1 focus:ring-[#5BB5BB] transition-all"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-[#5BB5BB] hover:bg-[#91D7D2] py-3.5 px-4 text-xs font-bold text-[#060D17] shadow-lg shadow-[#5BB5BB]/25 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-[#060D17]" />
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
          <div className="pt-2 flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
            <ShieldCheck className="h-3.5 w-3.5 text-[#5BB5BB]" />
            <span>Dedicated Support Helpline: +91 7506461004</span>
          </div>
        </div>

        {/* Link to Login */}
        <p className="mt-6 text-center text-xs text-slate-400">
          Already have a workspace?{" "}
          <Link href="/login" className="font-bold text-[#5BB5BB] hover:text-[#91D7D2] hover:underline">
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
        <div className="min-h-screen bg-[#060D17] flex items-center justify-center text-slate-400">
          <div className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-[#5BB5BB]" />
            <span className="text-sm">Loading workspace setup...</span>
          </div>
        </div>
      }
    >
      <SignupForm />
    </Suspense>
  );
}
