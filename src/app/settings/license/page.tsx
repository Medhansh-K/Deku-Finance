"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { AppShell } from "@/layouts/AppShell";
import { WorkspaceLayout } from "@/layouts/WorkspaceLayout";
import {
  KeyRound,
  ShieldCheck,
  Clock,
  AlertTriangle,
  Mail,
  Copy,
  CheckCircle2,
  Calendar,
  Lock,
  ArrowRight,
  Sparkles,
  PhoneCall,
  Loader2,
  Zap,
} from "lucide-react";

export default function LicenseManagementPage() {
  const {
    organisation,
    license,
    user,
    activateLicense,
    sendActivationEmail,
  } = useAuth();

  const [newKey, setNewKey] = useState("");
  const [ownerEmail, setOwnerEmail] = useState(user?.email || "");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const isTemp = license?.license_type === "temp";
  const planTier = license?.plan_tier || "go";

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSendEmail = async () => {
    setErrorMsg("");
    setStatusMsg("");
    setIsSendingEmail(true);
    const res = await sendActivationEmail(ownerEmail || user?.email || "owner@business.com");
    setIsSendingEmail(false);
    if (res.success) {
      setStatusMsg("✓ License activation email dispatched! Check the simulated inbox toast in the corner.");
    } else {
      setErrorMsg(res.message || "Failed to dispatch email.");
    }
  };

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setStatusMsg("");
    setIsLoading(true);

    const res = await activateLicense(newKey, ownerEmail, ownerPassword);
    setIsLoading(false);

    if (res.success) {
      setStatusMsg("✓ Organisation license activated successfully!");
      setNewKey("");
      setOwnerPassword("");
    } else {
      setErrorMsg(res.error || "Activation failed.");
    }
  };

  return (
    <AppShell>
    <WorkspaceLayout title="License" breadcrumbs={[{ label: "Settings", href: "/settings" }, { label: "License", href: "/settings/license" }]}>
    <div className="max-w-5xl mx-auto space-y-8 font-sans">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-black text-ink">
              Organisation License & Access Governance
            </h2>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
              IN-GAAP Verified
            </span>
          </div>
          <p className="text-xs text-ink-muted mt-1">
            Manage your organisation's active license, trial timelines, and plan migrations.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSendEmail}
          disabled={isSendingEmail}
          className="py-2.5 px-4 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-bold flex items-center gap-2 transition-all shadow-xs disabled:opacity-50"
        >
          <Mail className="h-4 w-4 text-amber-400" />
          <span>{isSendingEmail ? "Dispatching..." : "Send License Activation Email"}</span>
        </button>
      </div>

      {/* Notifications */}
      {statusMsg && (
        <div className="rounded-2xl bg-emerald-50 border border-emerald-300 p-4 flex items-center gap-3 text-xs text-emerald-900">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <span className="font-semibold">{statusMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="rounded-2xl bg-rose-50 border border-rose-300 p-4 flex items-center gap-3 text-xs text-rose-900">
          <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0" />
          <span className="font-semibold">{errorMsg}</span>
        </div>
      )}

      {/* 1. Active License Card */}
      <div className="bg-surface rounded-3xl p-6 sm:p-8 border border-line shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-5">
          <div className="flex items-center gap-3.5">
            <div
              className={`h-12 w-12 rounded-2xl flex items-center justify-center font-bold ${
                isTemp ? "bg-amber-400 text-ink" : "bg-emerald-600 text-white"
              }`}
            >
              <KeyRound className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-black text-ink">
                  {isTemp ? "Temporary Evaluation License" : "Active Commercial Plan License"}
                </span>
                <span
                  className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase border ${
                    isTemp
                      ? "bg-amber-100 text-amber-800 border-amber-300"
                      : "bg-emerald-100 text-emerald-800 border-emerald-300"
                  }`}
                >
                  {isTemp ? "15d Trial + 5d Grace" : "Plan Tenure Active"}
                </span>
              </div>
              <span className="text-xs text-ink-muted block mt-0.5">
                Organisation: <strong>{organisation?.name || "No company selected"}</strong>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-canvas p-2 rounded-xl border border-line font-mono text-xs">
            <span className="font-bold text-ink">
              {license?.license_key || "DEKU-TEMP-GO-7506-4610"}
            </span>
            <button
              type="button"
              onClick={() => handleCopy(license?.license_key || "DEKU-TEMP-GO-7506-4610")}
              className="p-1 rounded text-ink-subtle hover:text-ink transition-colors"
            >
              {copied ? (
                <span className="text-emerald-600 text-[10px] font-bold">Copied!</span>
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* 2. License Tenure Lifecycle (Strict rules per requirement) */}
        <div className="space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-ink-subtle">
            License Tenure & Auto-Expiry Lifecycle
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Phase 1 */}
            <div className="p-4 rounded-2xl bg-canvas border border-line space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-emerald-700 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  Phase 1: Full Trial
                </span>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">
                  Days 1–15
                </span>
              </div>
              <p className="text-xs text-ink-soft leading-relaxed">
                Unrestricted access to all features (dual-mode invoicing, Bharat UPI QR, ALERX double-entry ledger).
              </p>
              <div className="text-[11px] font-semibold text-emerald-600">
                ✓ Currently Active (Day 2 of 15)
              </div>
            </div>

            {/* Phase 2 */}
            <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-amber-800 flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-amber-600" />
                  Phase 2: Migration Period
                </span>
                <span className="text-[10px] bg-amber-200 text-amber-900 px-2 py-0.5 rounded font-bold">
                  Days 16–20 (5 Days)
                </span>
              </div>
              <p className="text-xs text-ink-soft leading-relaxed">
                5-day grace period for plan purchase & data migration. Warning banners active across workspace.
              </p>
              <div className="text-[11px] font-semibold text-amber-700">
                ⏳ Starts in 13 Days
              </div>
            </div>

            {/* Phase 3 */}
            <div className="p-4 rounded-2xl bg-rose-50/60 border border-rose-200 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-rose-800 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
                  Phase 3: Auto-Expiry
                </span>
                <span className="text-[10px] bg-rose-200 text-rose-900 px-2 py-0.5 rounded font-bold">
                  Day 20+ (Strict)
                </span>
              </div>
              <p className="text-xs text-ink-soft leading-relaxed">
                Workspace access auto-expires strictly after 20 days. Requires commercial plan activation to unlock.
              </p>
              <div className="text-[11px] font-semibold text-rose-700">
                🔒 Strict Lockout if Unpaid
              </div>
            </div>
          </div>
        </div>

        {/* 3. Activation Details */}
        <div className="bg-canvas rounded-2xl p-4 border border-line grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <span className="text-ink-subtle block text-[10px] uppercase font-bold">Owner Email</span>
            <span className="font-bold text-ink block mt-0.5">
              {license?.owner_email || user?.email || "owner@datalis.in"}
            </span>
          </div>
          <div>
            <span className="text-ink-subtle block text-[10px] uppercase font-bold">Activated At</span>
            <span className="font-medium text-ink-soft block mt-0.5">
              {new Date(license?.activated_at || Date.now()).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
          </div>
          <div>
            <span className="text-ink-subtle block text-[10px] uppercase font-bold">Hard Expiry Date</span>
            <span className="font-bold text-rose-700 block mt-0.5">
              {new Date(Date.now() + 18 * 24 * 60 * 60 * 1000).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
          </div>
        </div>
      </div>

      {/* 4. Activate New License Key Form */}
      <div className="bg-surface rounded-3xl p-6 sm:p-8 border border-line shadow-sm space-y-6">
        <div>
          <h3 className="text-lg font-black text-ink">
            Activate Organisation with License Key
          </h3>
          <p className="text-xs text-ink-muted mt-1">
            Each organisation must activate with their unique license key and the owner's credentials.
          </p>
        </div>

        <form onSubmit={handleActivate} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-ink-soft mb-1.5">
                License Key *
              </label>
              <input
                type="text"
                required
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder="e.g. DEKU-PLAN-PRO-8921-ABCD"
                className="w-full px-3.5 py-2.5 rounded-xl border border-line-strong text-xs font-mono font-bold text-ink uppercase placeholder:text-ink-subtle focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink-soft mb-1.5">
                Owner's Registered Email *
              </label>
              <input
                type="email"
                required
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
                placeholder="owner@business.com"
                className="w-full px-3.5 py-2.5 rounded-xl border border-line-strong text-xs text-ink placeholder:text-ink-subtle focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink-soft mb-1.5">
                Owner's Password *
              </label>
              <input
                type="password"
                required
                value={ownerPassword}
                onChange={(e) => setOwnerPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-3.5 py-2.5 rounded-xl border border-line-strong text-xs text-ink placeholder:text-ink-subtle focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              />
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-[11px] text-ink-muted">
              Need assistance activating your key? Call support: <strong>+91 7506461004</strong>
            </span>

            <button
              type="submit"
              disabled={isLoading}
              className="py-3 px-6 rounded-xl bg-amber-400 hover:bg-amber-300 text-ink font-bold text-xs flex items-center gap-2 shadow-md shadow-amber-400/20 transition-transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-ink" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4" />
                  <span>Verify Credentials & Activate License</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
    </WorkspaceLayout>
    </AppShell>
  );
}
