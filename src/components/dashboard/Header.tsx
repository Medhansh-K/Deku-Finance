"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  Calendar,
  Building2,
  UserCheck,
  KeyRound,
  PhoneCall,
  LogOut,
  ChevronDown,
  Sparkles,
  ShieldCheck,
  Bell,
  Mail,
} from "lucide-react";

export default function DashboardHeader() {
  const router = useRouter();
  const {
    user,
    organisation,
    license,
    operatingMode,
    setOperatingMode,
    logout,
    sendActivationEmail,
  } = useAuth();

  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [selectedFy, setSelectedFy] = useState("2026-27");
  const [selectedMonth, setSelectedMonth] = useState("October");

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  const handleTriggerActivationEmail = async () => {
    if (user?.email) {
      await sendActivationEmail(user.email);
    }
  };

  const isTemp = license?.license_type === "temp";
  const planTier = license?.plan_tier || "go";

  return (
    <header className="h-16 bg-white border-b border-zinc-200 px-6 flex items-center justify-between z-20 shrink-0 font-sans text-zinc-900">
      {/* Left: Active Fiscal Controls */}
      <div className="flex items-center gap-3">
        {/* FY Pill */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-100 border border-zinc-200 text-xs font-semibold">
          <Calendar className="h-3.5 w-3.5 text-zinc-500" />
          <span className="text-zinc-500 text-[11px]">FY:</span>
          <select
            value={selectedFy}
            onChange={(e) => setSelectedFy(e.target.value)}
            className="bg-transparent font-bold text-zinc-900 focus:outline-none cursor-pointer"
          >
            <option value="2026-27">2026-27 (Current)</option>
            <option value="2025-26">2025-26</option>
          </select>
        </div>

        {/* Month Selector */}
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-100 border border-zinc-200 text-xs font-semibold">
          <span className="text-zinc-500 text-[11px]">Period:</span>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="bg-transparent font-bold text-zinc-900 focus:outline-none cursor-pointer"
          >
            <option value="October">October 2026</option>
            <option value="September">September 2026</option>
            <option value="August">August 2026</option>
            <option value="July">July 2026</option>
          </select>
        </div>

        {/* Organisation Tax Regime Status (Fixed per organisation entity) */}
        <div className="hidden md:flex items-center">
          {operatingMode === "pure_accounting" ? (
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-300 text-xs font-bold text-emerald-900 shadow-2xs"
              title="Section 22 CGST Act: Exempt from GST Registration (Threshold: ₹40L). Operates on Pure Accounting."
            >
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span>Sec 22 Exempt (Pure)</span>
            </div>
          ) : (
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-bold text-[#5BB5BB] shadow-2xs"
              title="GST Registered Enterprise. Operates permanently on GST Module."
            >
              <Building2 className="h-3.5 w-3.5 text-[#5BB5BB]" />
              <span>GST Registered</span>
              {organisation?.gstin && (
                <span className="text-[10px] font-mono text-zinc-300 ml-1">
                  ({organisation.gstin})
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right: License Pill, Helpline & Profile */}
      <div className="flex items-center gap-3">
        {/* License Pill */}
        <Link
          href="/dashboard/license"
          className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#5BB5BB]/15 border border-[#5BB5BB]/40 text-xs font-bold text-[#91D7D2] hover:bg-[#5BB5BB]/25 transition-colors shadow-2xs"
        >
          <KeyRound className="h-3.5 w-3.5 text-[#5BB5BB]" />
          <span>
            {isTemp ? (
              <>
                <span className="text-emerald-700">GO Temp Trial</span> (13d remaining)
              </>
            ) : (
              <>
                <span className="text-[#91D7D2]">PRO Plan Active</span>
              </>
            )}
          </span>
          <span className="text-[10px] bg-[#5BB5BB]/20 text-[#91D7D2] px-1.5 py-0.2 rounded font-extrabold uppercase">
            {isTemp ? "15d + 5d Grace" : "Active"}
          </span>
        </Link>

        {/* Send Activation Email Trigger */}
        <button
          type="button"
          onClick={handleTriggerActivationEmail}
          title="Send license key to email"
          className="p-2 rounded-xl border border-zinc-200 text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100 transition-colors flex items-center gap-1 text-xs font-semibold"
        >
          <Mail className="h-4 w-4 text-[#5BB5BB]" />
          <span className="hidden lg:inline">License Email</span>
        </button>

        {/* Helpline Button */}
        <a
          href="tel:+917506461004"
          className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-300 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition-colors"
        >
          <PhoneCall className="h-3.5 w-3.5 text-emerald-600" />
          <span>+91 7506461004</span>
        </a>

        {/* User Profile Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex items-center gap-2 p-1.5 rounded-xl border border-zinc-200 hover:bg-zinc-50 transition-colors"
          >
            <div className="h-8 w-8 rounded-lg bg-[#5BB5BB] text-[#060D17] font-black flex items-center justify-center text-xs shadow-xs">
              {user?.full_name?.charAt(0) || user?.email?.charAt(0).toUpperCase() || "U"}
            </div>
            <div className="hidden md:block text-left">
              <span className="text-xs font-bold text-zinc-900 block truncate max-w-[120px]">
                {user?.full_name || user?.email?.split("@")[0] || "User"}
              </span>
              <span className="text-[10px] text-zinc-500 block">
                {user?.is_demo ? "Demo Persona" : "Admin / Owner"}
              </span>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
          </button>

          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-56 bg-white border border-zinc-200 rounded-2xl shadow-xl p-2 z-50 text-xs space-y-1">
              <div className="p-2 border-b border-zinc-100">
                <span className="text-zinc-400 block text-[10px] uppercase font-bold">
                  Signed in as
                </span>
                <span className="font-bold text-zinc-900 block truncate">
                  {user?.email || "owner@datalis.in"}
                </span>
              </div>

              <Link
                href="/dashboard/license"
                onClick={() => setShowProfileMenu(false)}
                className="w-full text-left p-2 rounded-lg hover:bg-zinc-100 flex items-center gap-2 text-zinc-700 font-semibold"
              >
                <KeyRound className="h-4 w-4 text-[#5BB5BB]" />
                <span>Manage Licenses & Plans</span>
              </Link>

              <button
                type="button"
                onClick={handleLogout}
                className="w-full text-left p-2 rounded-lg hover:bg-rose-50 text-rose-600 font-semibold flex items-center gap-2"
              >
                <LogOut className="h-4 w-4" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
