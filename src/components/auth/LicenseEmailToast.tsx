"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  Mail,
  X,
  KeyRound,
  Clock,
  ShieldAlert,
  CheckCircle2,
  Copy,
  ExternalLink,
} from "lucide-react";

export default function LicenseEmailToast() {
  const { emailNotification, dismissEmailNotification, activateLicense } = useAuth();
  const [copied, setCopied] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [activationMsg, setActivationMsg] = useState("");

  if (!emailNotification || !emailNotification.visible) {
    return null;
  }

  const handleCopyKey = () => {
    navigator.clipboard.writeText(emailNotification.licenseKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleQuickActivate = async () => {
    setIsActivating(true);
    setActivationMsg("");
    const res = await activateLicense(
      emailNotification.licenseKey,
      emailNotification.to
    );
    setIsActivating(false);
    if (res.success) {
      setActivationMsg("✓ Workspace successfully activated!");
      setTimeout(() => {
        dismissEmailNotification();
      }, 2000);
    } else {
      setActivationMsg(res.error || "Failed to activate");
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 max-w-lg w-full p-4 animate-in fade-in slide-in-from-bottom-5 duration-300">
      <div className="bg-zinc-900/95 backdrop-blur-2xl border-2 border-amber-400/80 rounded-2xl shadow-2xl shadow-black/80 text-white overflow-hidden ring-4 ring-amber-400/10">
        {/* Email Header Simulation */}
        <div className="bg-zinc-950 px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-amber-400 text-zinc-950 flex items-center justify-center font-bold">
              <Mail className="h-4 w-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-white block">
                [Simulated Email Inbox] License Dispatch
              </span>
              <span className="text-[10px] text-zinc-400 block">
                Sent to: <strong>{emailNotification.to}</strong> • {emailNotification.sentAt}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={dismissEmailNotification}
            className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Email Body */}
        <div className="p-4 space-y-3.5 text-xs text-zinc-300">
          <div>
            <span className="font-bold text-white block text-sm">
              Your Deku Finance License Key is Ready
            </span>
            <span className="text-[11px] text-zinc-400">
              Each organisation must activate with their unique license key and owner credentials.
            </span>
          </div>

          {/* License Key Box */}
          <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800 space-y-1.5">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-amber-400 font-bold">
              <span className="flex items-center gap-1">
                <KeyRound className="h-3 w-3" />
                License Key ({emailNotification.licenseType.toUpperCase()})
              </span>
              <button
                type="button"
                onClick={handleCopyKey}
                className="flex items-center gap-1 text-zinc-400 hover:text-white transition-colors"
              >
                <Copy className="h-3 w-3" />
                <span>{copied ? "Copied!" : "Copy"}</span>
              </button>
            </div>
            <div className="font-mono text-sm font-black text-amber-300 select-all tracking-wide">
              {emailNotification.licenseKey}
            </div>
          </div>

          {/* License Tenure & Lifecycle Rules (As requested) */}
          <div className="bg-zinc-800/60 rounded-xl p-2.5 border border-zinc-700/60 space-y-1 text-[11px]">
            <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              <span>Temp License: 15-Day Full Free Trial Active</span>
            </div>
            <div className="flex items-start gap-1.5 text-amber-300/90">
              <ShieldAlert className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-400" />
              <span>
                <strong>5-Day Plan Purchase / Migration Period:</strong> Days 16–20 reserved for plan upgrade.
              </span>
            </div>
            <div className="text-[10px] text-rose-300/80 pl-5">
              • Access auto-terminates strictly after 20 days if no plan license is activated.
            </div>
          </div>

          {/* Quick Activate Action */}
          <div className="pt-1 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleQuickActivate}
              disabled={isActivating}
              className="flex-1 py-2 px-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-amber-400/20 disabled:opacity-50"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>{isActivating ? "Activating..." : "1-Click Activate Workspace"}</span>
            </button>
            <button
              type="button"
              onClick={dismissEmailNotification}
              className="py-2 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium text-xs transition-colors"
            >
              Dismiss
            </button>
          </div>

          {activationMsg && (
            <div className="text-center font-bold text-[11px] text-emerald-400 pt-1">
              {activationMsg}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
