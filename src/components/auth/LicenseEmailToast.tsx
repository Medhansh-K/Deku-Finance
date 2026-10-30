"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  Mail,
  X,
  KeyRound,
  Copy,
  Clock,
  ShieldAlert,
  CheckCircle2,
} from "lucide-react";

export function LicenseEmailToast() {
  const { emailNotification, dismissEmailNotification, activateLicense } =
    useAuth();
  const [copied, setCopied] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [activationMsg, setActivationMsg] = useState("");

  if (!emailNotification || !emailNotification.visible) {
    return null;
  }

  const handleCopyKey = () => {
    navigator.clipboard.writeText(emailNotification.licenseKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleQuickActivate = async () => {
    setIsActivating(true);
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
    <div className="fixed bottom-5 right-5 z-50 max-w-lg w-full p-4 animate-in fade-in slide-in-from-bottom-5 duration-300 font-sans">
      <div className="bg-[#0C1827]/95 backdrop-blur-2xl border-2 border-[#5BB5BB]/80 rounded-2xl shadow-2xl shadow-black/80 text-white overflow-hidden ring-4 ring-[#5BB5BB]/10">
        {/* Email Header Simulation */}
        <div className="bg-[#07111E] px-4 py-3 border-b border-[#1A2E44] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-[#5BB5BB] text-[#060D17] flex items-center justify-center font-bold">
              <Mail className="h-4 w-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-white block">
                [Simulated Email Inbox] License Dispatch
              </span>
              <span className="text-[10px] text-slate-400 block">
                Sent to: <strong>{emailNotification.to}</strong> • {emailNotification.sentAt}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={dismissEmailNotification}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-[#15273C] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Email Body */}
        <div className="p-4 space-y-3.5 text-xs text-slate-300">
          <div>
            <span className="font-bold text-white block text-sm">
              Your Deku Finance License Key is Ready
            </span>
            <span className="text-[11px] text-slate-400">
              Each organisation must activate with their unique license key and owner credentials.
            </span>
          </div>

          {/* License Key Box */}
          <div className="bg-[#07111E] p-3 rounded-xl border border-[#1A2E44] space-y-1.5">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-[#91D7D2] font-bold">
              <span className="flex items-center gap-1">
                <KeyRound className="h-3 w-3 text-[#5BB5BB]" />
                License Key ({emailNotification.licenseType.toUpperCase()})
              </span>
              <button
                type="button"
                onClick={handleCopyKey}
                className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors"
              >
                <Copy className="h-3 w-3" />
                <span>{copied ? "Copied!" : "Copy"}</span>
              </button>
            </div>
            <div className="font-mono text-sm font-black text-[#5BB5BB] select-all tracking-wide">
              {emailNotification.licenseKey}
            </div>
          </div>

          {/* License Tenure & Lifecycle Rules */}
          <div className="bg-[#0F1E30] rounded-xl p-2.5 border border-[#1E3652] space-y-1 text-[11px]">
            <div className="flex items-center gap-1.5 text-[#91D7D2] font-semibold">
              <Clock className="h-3.5 w-3.5 shrink-0 text-[#5BB5BB]" />
              <span>Temp License: 15-Day Full Free Trial Active</span>
            </div>
            <div className="flex items-start gap-1.5 text-[#38BDF8]">
              <ShieldAlert className="h-3.5 w-3.5 shrink-0 mt-0.5 text-[#38BDF8]" />
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
              className="flex-1 py-2 px-3 rounded-xl bg-[#5BB5BB] hover:bg-[#91D7D2] text-[#060D17] font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-[#5BB5BB]/20 disabled:opacity-50 cursor-pointer"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>{isActivating ? "Activating..." : "1-Click Activate Workspace"}</span>
            </button>
            <button
              type="button"
              onClick={dismissEmailNotification}
              className="py-2 px-3 rounded-xl bg-[#15273C] hover:bg-[#1D3450] text-slate-300 font-medium text-xs transition-colors cursor-pointer"
            >
              Dismiss
            </button>
          </div>

          {activationMsg && (
            <div className="text-center font-bold text-[11px] text-[#91D7D2] pt-1">
              {activationMsg}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
