"use client";

import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  Building2,
  Users,
  KeyRound,
  FileText,
  CheckCircle2,
  XCircle,
  Plus,
  RefreshCw,
  Search,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Receipt,
  Layers,
  Award,
  Sparkles,
  ReceiptText,
  ArrowRightLeft,
  Calendar,
  Check,
  AlertCircle,
  MapPin,
  Activity,
} from "lucide-react";
import Link from "next/link";

interface AdminData {
  metrics: {
    totalDistributors: number;
    activeLicenses: number;
    pendingVerifications: number;
    totalSalesVolumeINR: number;
    inboundLeadsCount: number;
  };
  admins: Array<{
    id: string;
    email: string;
    fullName: string;
    role: "super_admin" | "license_manager" | "support_admin";
    isActive: boolean;
    createdBy: string;
    createdAt: string;
  }>;
  distributors: Array<{
    id: string;
    distributorCode: string;
    name: string;
    companyName: string;
    email: string;
    phone: string;
    assignedStates: string[];
    assignedPincodes: string[];
    allocatedSeatQuota: number;
    availableServiceCredits: number;
    status: string;
  }>;
  licenseRequests: Array<{
    id: string;
    distributorId: string;
    distributorName: string;
    clientName: string;
    clientEmail: string;
    clientPhone: string;
    companyName: string;
    gstin?: string;
    requestType: "activation" | "add_on_module";
    planTier: string;
    moduleName?: string;
    proofDocumentType: "invoice" | "mou" | "quote";
    proofDocumentNumber: string;
    proofFileName: string;
    proofAmount: number;
    status: "pending_verification" | "approved_issued" | "rejected";
    generatedLicenseKey?: string;
    reviewedBy?: string;
    reviewedAt?: string;
    rejectionReason?: string;
    createdAt: string;
  }>;
  licenses: Array<{
    id: string;
    licenseKey: string;
    licenseType: "activation" | "add_on";
    planTier: string;
    addOnCategory?: "module" | "seat" | "service";
    addOnModuleName?: string;
    extraSeatsCount: number;
    serviceDescription?: string;
    managedBy: "company_admin" | "distributor";
    distributorName?: string;
    assignedClientEmail: string;
    companyName: string;
    validUntil: string;
    status: string;
    createdAt: string;
  }>;
  onboardingRequests: Array<{
    id: string;
    clientName: string;
    clientPhone: string;
    clientEmail: string;
    companyName: string;
    stateName: string;
    city: string;
    pincode: string;
    assignedDistributorName?: string;
    status: string;
    createdAt: string;
  }>;
}

export default function DekuAdminPortal() {
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "dual_gate" | "distributors" | "admins" | "licenses" | "leads"
  >("dual_gate");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "F1") {
        e.preventDefault();
        setActiveTab("dual_gate");
      } else if (e.key === "F2") {
        e.preventDefault();
        setActiveTab("distributors");
      } else if (e.key === "F3") {
        e.preventDefault();
        setActiveTab("admins");
      } else if (e.key === "F4") {
        e.preventDefault();
        setActiveTab("licenses");
      } else if (e.key === "F5") {
        e.preventDefault();
        setActiveTab("leads");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Sub-admin form modal state
  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminName, setNewAdminName] = useState("");
  const [newAdminRole, setNewAdminRole] = useState<"license_manager" | "super_admin" | "support_admin">("license_manager");

  // Distributor modal state
  const [showAddDist, setShowAddDist] = useState(false);
  const [newDistName, setNewDistName] = useState("");
  const [newDistCompany, setNewDistCompany] = useState("");
  const [newDistEmail, setNewDistEmail] = useState("");
  const [newDistPhone, setNewDistPhone] = useState("");
  const [newDistStates, setNewDistStates] = useState("Maharashtra, Goa");
  const [newDistPincodes, setNewDistPincodes] = useState("400001, 400050");
  const [newDistSeats, setNewDistSeats] = useState(30);
  const [newDistCredits, setNewDistCredits] = useState(50);

  const fetchAdminData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/ecosystem/admin");
      const json = await res.json();
      if (json.success) {
        setData(json);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const handleApproveRequest = async (requestId: string) => {
    try {
      const res = await fetch("/api/ecosystem/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "approve_request",
          requestId,
          reviewedBy: "medhanshk10@gmail.com",
        }),
      });
      const json = await res.json();
      if (json.success) {
        setActionMessage(`License approved! Generated Key: ${json.result.license.licenseKey}`);
        fetchAdminData();
      } else {
        alert(json.error || "Approval failed");
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    const reason = prompt("Enter rejection reason for distributor:");
    if (!reason) return;
    try {
      const res = await fetch("/api/ecosystem/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reject_request",
          requestId,
          reviewedBy: "medhanshk10@gmail.com",
          reason,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setActionMessage("Request marked as rejected.");
        fetchAdminData();
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/ecosystem/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_admin",
          email: newAdminEmail,
          fullName: newAdminName,
          role: newAdminRole,
          createdBy: "medhanshk10@gmail.com",
        }),
      });
      const json = await res.json();
      if (json.success) {
        setShowAddAdmin(false);
        setNewAdminEmail("");
        setNewAdminName("");
        setActionMessage(`New admin ${json.admin.email} added successfully!`);
        fetchAdminData();
      } else {
        alert(json.error);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateDistributor = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/ecosystem/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_distributor",
          name: newDistName,
          companyName: newDistCompany,
          email: newDistEmail,
          phone: newDistPhone,
          assignedStates: newDistStates.split(",").map((s) => s.trim()),
          assignedPincodes: newDistPincodes.split(",").map((p) => p.trim()),
          allocatedSeatQuota: newDistSeats,
          availableServiceCredits: newDistCredits,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setShowAddDist(false);
        setActionMessage(`Distributor ${json.distributor.companyName} registered!`);
        fetchAdminData();
      } else {
        alert(json.error);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col font-sans">
      {/* Top Header Bar: Dark Chrome with Deku Brand Icon */}
      <header className="bg-panel border-b border-edge px-4 py-2 flex items-center justify-between text-white shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-7 w-7 rounded-lg bg-brand text-panel-deep flex items-center justify-center font-black shadow-xs">
            <ReceiptText className="h-4 w-4 text-panel-deep" />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm tracking-tight text-white">Deku Admin</span>
            <span className="text-[10px] font-mono bg-panel-raised text-brand-soft px-2 py-0.5 rounded border border-edge">
              Console
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 ml-2 pl-3 border-l border-edge text-xs">
            <span className="text-slate-400">Master:</span>
            <span className="font-mono text-brand font-semibold text-[11px]">medhanshk10@gmail.com</span>
            <span className="text-[9px] font-mono bg-brand/20 text-brand px-1.5 py-0.2 rounded font-bold">
              SUPER ADMIN
            </span>
          </div>
        </div>

        {/* Tab Shortcuts & Actions */}
        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center gap-1 bg-panel-deep/60 p-0.5 rounded-lg border border-edge text-[11px] font-mono">
            <button
              onClick={() => setActiveTab("dual_gate")}
              className={`px-2.5 py-1 rounded transition-colors ${
                activeTab === "dual_gate"
                  ? "bg-brand text-panel-deep font-bold"
                  : "text-slate-300 hover:text-white hover:bg-panel-raised"
              }`}
            >
              Verification ({data?.metrics.pendingVerifications ?? 0})
            </button>
            <button
              onClick={() => setActiveTab("distributors")}
              className={`px-2.5 py-1 rounded transition-colors ${
                activeTab === "distributors"
                  ? "bg-brand text-panel-deep font-bold"
                  : "text-slate-300 hover:text-white hover:bg-panel-raised"
              }`}
            >
              Distributors ({data?.distributors.length ?? 0})
            </button>
            <button
              onClick={() => setActiveTab("admins")}
              className={`px-2.5 py-1 rounded transition-colors ${
                activeTab === "admins"
                  ? "bg-brand text-panel-deep font-bold"
                  : "text-slate-300 hover:text-white hover:bg-panel-raised"
              }`}
            >
              Sub-Admins ({data?.admins.length ?? 0})
            </button>
            <button
              onClick={() => setActiveTab("licenses")}
              className={`px-2.5 py-1 rounded transition-colors ${
                activeTab === "licenses"
                  ? "bg-brand text-panel-deep font-bold"
                  : "text-slate-300 hover:text-white hover:bg-panel-raised"
              }`}
            >
              Licenses
            </button>
            <button
              onClick={() => setActiveTab("leads")}
              className={`px-2.5 py-1 rounded transition-colors ${
                activeTab === "leads"
                  ? "bg-brand text-panel-deep font-bold"
                  : "text-slate-300 hover:text-white hover:bg-panel-raised"
              }`}
            >
              Leads ({data?.metrics.inboundLeadsCount ?? 0})
            </button>
          </div>

          <button
            onClick={fetchAdminData}
            className="p-1.5 rounded-lg border border-edge text-slate-300 hover:text-white hover:bg-panel-raised transition-colors"
            title="Refresh Store"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </header>

      {/* Action Notification Banner */}
      {actionMessage && (
        <div className="bg-emerald-50 border-b border-emerald-300 px-4 py-2 text-xs text-emerald-900 flex items-center justify-between font-medium">
          <span>{actionMessage}</span>
          <button onClick={() => setActionMessage(null)} className="text-emerald-700 font-bold hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Main Bento Grid Canvas */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto p-3.5 flex flex-col md:flex-row gap-3.5 items-stretch">
        {/* ========================================================================= */}
        {/* Column 1 (Left): Admin Profile & Command Panel Bento Card                 */}
        {/* ========================================================================= */}
        <div className="w-full md:w-64 lg:w-72 shrink-0 bg-surface border border-edge rounded-xl shadow-md overflow-hidden flex flex-col justify-between">
          <div>
            {/* Box Header */}
            <div className="bg-panel px-3.5 py-1.5 border-b border-edge flex items-center justify-between text-white">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-300">
                Administration Console
              </span>
              <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/20 px-1.5 py-0.2 rounded border border-emerald-400/30 font-bold">
                Master Online
              </span>
            </div>

            <div className="p-3 space-y-3">
              {/* Super Admin Badge Card */}
              <div className="p-2.5 rounded-lg bg-canvas-sunken border border-line">
                <div className="text-[10px] font-mono font-bold uppercase text-ink-muted">Master Authority</div>
                <div className="font-bold text-xs text-ink truncate mt-0.5">Medhansh</div>
                <div className="font-mono text-[10px] text-ink-soft truncate">medhanshk10@gmail.com</div>
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="text-[9px] font-mono bg-panel text-brand-soft px-1.5 py-0.5 rounded font-bold">
                    Super Admin
                  </span>
                  <span className="text-[9px] font-mono bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded border border-emerald-300 font-bold">
                    Active
                  </span>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="space-y-1.5">
                <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-ink-soft">
                  Platform Operations
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddAdmin(true)}
                  className="w-full text-left px-2.5 py-2 rounded-lg text-xs transition-all flex items-center justify-between border bg-surface hover:bg-canvas text-ink border-line hover:border-brand/40 shadow-xs group"
                >
                  <span className="flex items-center gap-2 font-medium">
                    <Users className="h-3.5 w-3.5 text-brand" />
                    Add Sub-Admin Email
                  </span>
                  <Plus className="h-3.5 w-3.5 text-ink-subtle group-hover:text-brand" />
                </button>

                <button
                  type="button"
                  onClick={() => setShowAddDist(true)}
                  className="w-full text-left px-2.5 py-2 rounded-lg text-xs transition-all flex items-center justify-between border bg-surface hover:bg-canvas text-ink border-line hover:border-brand/40 shadow-xs group"
                >
                  <span className="flex items-center gap-2 font-medium">
                    <Building2 className="h-3.5 w-3.5 text-brand" />
                    Register Distributor
                  </span>
                  <Plus className="h-3.5 w-3.5 text-ink-subtle group-hover:text-brand" />
                </button>
              </div>

              {/* Metadata Info */}
              <div className="space-y-1 text-[11px] pt-1">
                <div className="flex justify-between py-1 border-b border-line">
                  <span className="text-ink-muted">Distributor Partners:</span>
                  <span className="font-mono font-bold text-ink">
                    {data?.metrics.totalDistributors ?? 0}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-line">
                  <span className="text-ink-muted">Active Workspaces:</span>
                  <span className="font-mono font-bold text-ink">
                    {data?.metrics.activeLicenses ?? 0}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-line">
                  <span className="text-ink-muted">Dual-Gate Queue:</span>
                  <span className="font-mono font-bold text-amber-700">
                    {data?.metrics.pendingVerifications ?? 0} pending
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-line">
                  <span className="text-ink-muted">Verified Volume:</span>
                  <span className="font-mono font-bold text-emerald-700">
                    ₹{(data?.metrics.totalSalesVolumeINR ?? 0).toLocaleString("en-IN")}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Bento Card Footer */}
          <div className="px-3.5 py-2 bg-canvas border-t border-line text-[10px] text-ink-muted flex items-center justify-between">
            <span className="font-mono">Deku Admin 1.0</span>
            <span className="font-mono font-bold text-brand-strong">ALERX Core</span>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* Column 2 & 3: Main Active Workspaces Bento Cards                          */}
        {/* ========================================================================= */}
        <div className="flex-1 min-w-0 grid grid-cols-1 lg:grid-cols-2 gap-3.5 items-stretch">
          {/* Bento Center Card: Dual-Gate Verification Desk */}
          <div className="min-w-0 bg-surface border border-edge rounded-xl shadow-md overflow-hidden flex flex-col justify-between">
            <div>
              {/* Header */}
              <div className="bg-panel px-3.5 py-1.5 border-b border-edge flex items-center justify-between text-white">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-brand" />
                  <span className="text-xs font-mono font-black tracking-wider uppercase">
                    Dual-Gate Verification Desk
                  </span>
                </div>
                <span className="text-[10px] font-mono text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded border border-amber-400/40 font-bold">
                  {data?.metrics.pendingVerifications ?? 0} In Queue
                </span>
              </div>

              {/* Sub-header notice */}
              <div className="p-3 bg-canvas-sunken border-b border-line text-[11px] text-ink-soft leading-relaxed">
                <strong>Dual-Gate Protocol:</strong> Licenses are minted only when{" "}
                <span className="text-ink font-semibold">1) Distributor requests client access</span> and{" "}
                <span className="text-ink font-semibold">2) A verified Invoice/MoU proof document</span> is approved.
              </div>

              {/* Requests List */}
              <div className="p-3 space-y-2.5 overflow-y-auto max-h-[620px]">
                {data?.licenseRequests.length === 0 ? (
                  <div className="p-8 text-center text-xs text-ink-muted">No license requests currently pending.</div>
                ) : (
                  data?.licenseRequests.map((req) => (
                    <div
                      key={req.id}
                      className="p-3 rounded-lg border border-line bg-surface hover:border-brand/40 transition-all shadow-xs space-y-2"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-bold text-xs text-ink">{req.companyName}</div>
                          <div className="text-[11px] text-ink-muted">
                            Client: <span className="text-ink font-medium">{req.clientName}</span> ({req.clientEmail})
                          </div>
                        </div>
                        <span
                          className={`text-[9px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                            req.status === "pending_verification"
                              ? "bg-amber-100 text-amber-800 border border-amber-300"
                              : req.status === "approved_issued"
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                              : "bg-rose-100 text-rose-800 border border-rose-300"
                          }`}
                        >
                          {req.status.replace("_", " ")}
                        </span>
                      </div>

                      {/* Condition 2 Proof Box */}
                      <div className="p-2 rounded bg-canvas-sunken border border-line text-[11px] space-y-1">
                        <div className="flex items-center justify-between font-mono">
                          <span className="text-ink font-semibold uppercase">
                            Proof: {req.proofDocumentType} #{req.proofDocumentNumber}
                          </span>
                          <span className="text-emerald-700 font-bold">
                            ₹{req.proofAmount.toLocaleString("en-IN")}
                          </span>
                        </div>
                        <div className="text-[10px] text-ink-subtle font-mono truncate">
                          File: {req.proofFileName}
                        </div>
                        <div className="text-[10px] text-ink-muted">
                          Distributor: <span className="font-medium text-ink">{req.distributorName}</span> • Tier: <span className="font-bold uppercase text-brand-strong">{req.planTier}</span>
                        </div>
                      </div>

                      {req.generatedLicenseKey && (
                        <div className="p-2 rounded bg-emerald-50 border border-emerald-200 text-[11px] font-mono text-emerald-900 flex items-center justify-between">
                          <span className="font-bold">Key: {req.generatedLicenseKey}</span>
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                        </div>
                      )}

                      {req.status === "pending_verification" && (
                        <div className="pt-1 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleApproveRequest(req.id)}
                            className="flex-1 py-1.5 px-3 bg-brand hover:bg-brand-hover text-panel-deep font-bold text-xs rounded transition-colors shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Verify &amp; Mint Key
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRejectRequest(req.id)}
                            className="py-1.5 px-2.5 bg-canvas hover:bg-canvas-sunken text-rose-700 border border-rose-300 text-xs rounded transition-colors cursor-pointer"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-3.5 py-1.5 bg-canvas border-t border-line flex items-center justify-between text-xs">
              <span className="text-[10px] font-mono text-ink-muted">Double-Gate Verified</span>
              <span className="text-[10px] font-mono text-brand-strong font-semibold">Commercial Audit Trail</span>
            </div>
          </div>

          {/* Bento Right Card: Global Licenses & Distributor Network */}
          <div className="min-w-0 bg-surface border border-edge rounded-xl shadow-md overflow-hidden flex flex-col justify-between">
            <div>
              {/* Header */}
              <div className="bg-panel px-3.5 py-1.5 border-b border-edge flex items-center justify-between text-white">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-brand" />
                  <span className="text-xs font-mono font-black tracking-wider uppercase">
                    Active Licenses &amp; Registry
                  </span>
                </div>
                <span className="text-[10px] font-mono text-brand-soft">
                  {data?.licenses.length ?? 0} Issued
                </span>
              </div>

              {/* KPI highlight strip */}
              <div className="p-2.5 bg-canvas border-b border-line grid grid-cols-2 gap-2">
                <div className="p-2 rounded bg-surface border border-line">
                  <span className="text-[10px] font-mono text-ink-muted block uppercase">Turnover Volume</span>
                  <span className="text-base font-bold font-mono text-ink">
                    ₹{(data?.metrics.totalSalesVolumeINR ?? 0).toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="p-2 rounded bg-surface border border-line">
                  <span className="text-[10px] font-mono text-ink-muted block uppercase">Active Workspaces</span>
                  <span className="text-base font-bold font-mono text-brand-strong">
                    {data?.metrics.activeLicenses ?? 0}
                  </span>
                </div>
              </div>

              {/* Live registry feed */}
              <div className="p-3 space-y-2 overflow-y-auto max-h-[600px]">
                {data?.licenses.map((lic) => (
                  <div
                    key={lic.id}
                    className="p-2.5 rounded-lg border border-line bg-surface hover:bg-canvas-sunken/40 transition-colors text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-brand-strong text-[11px]">{lic.licenseKey}</span>
                      <span
                        className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-bold uppercase ${
                          lic.managedBy === "company_admin"
                            ? "bg-panel text-brand-soft border border-edge"
                            : "bg-sky-50 text-sky-800 border border-sky-300"
                        }`}
                      >
                        {lic.managedBy === "company_admin" ? "Admin Issued" : "Distributor"}
                      </span>
                    </div>
                    <div className="font-semibold text-ink text-xs">{lic.companyName}</div>
                    <div className="text-[10px] text-ink-muted flex items-center justify-between font-mono">
                      <span>{lic.assignedClientEmail}</span>
                      <span>Expires: {new Date(lic.validUntil).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="px-3.5 py-1.5 bg-canvas border-t border-line flex items-center justify-between text-xs">
              <span className="text-[10px] font-mono text-ink-muted">Single Customer Runtime Safe</span>
              <span className="text-[10px] font-mono text-brand-strong font-semibold">Platform Multi-Tenant Auth</span>
            </div>
          </div>
        </div>
      </main>

      {/* Modal: Add Sub-Admin */}
      {showAddAdmin && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface border border-edge rounded-xl max-w-md w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-line pb-2.5">
              <h3 className="text-xs font-bold font-mono text-ink uppercase tracking-wider flex items-center gap-2">
                <Users className="h-4 w-4 text-brand" />
                Add Admin / Sub-Admin Email
              </h3>
              <button onClick={() => setShowAddAdmin(false)} className="text-ink-muted hover:text-ink text-sm">
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateAdmin} className="space-y-3 text-xs">
              <div>
                <label className="block text-ink-soft mb-1 font-medium">Email Address</label>
                <input
                  type="email"
                  required
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                  placeholder="admin.associate@deku.finance"
                  className="w-full bg-canvas border border-line-strong rounded-lg p-2 text-ink font-mono focus:border-brand outline-none"
                />
              </div>
              <div>
                <label className="block text-ink-soft mb-1 font-medium">Full Name</label>
                <input
                  type="text"
                  required
                  value={newAdminName}
                  onChange={(e) => setNewAdminName(e.target.value)}
                  placeholder="Rahul Saxena"
                  className="w-full bg-canvas border border-line-strong rounded-lg p-2 text-ink focus:border-brand outline-none"
                />
              </div>
              <div>
                <label className="block text-ink-soft mb-1 font-medium">Privilege Role</label>
                <select
                  value={newAdminRole}
                  onChange={(e) => setNewAdminRole(e.target.value as any)}
                  className="w-full bg-canvas border border-line-strong rounded-lg p-2 text-ink font-mono focus:border-brand outline-none"
                >
                  <option value="license_manager">License Manager (Can verify proof &amp; mint keys)</option>
                  <option value="super_admin">Super Admin (Full administrative rights)</option>
                  <option value="support_admin">Support Admin (Read-only / Audit)</option>
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-line">
                <button
                  type="button"
                  onClick={() => setShowAddAdmin(false)}
                  className="px-3 py-1.5 text-ink-muted hover:text-ink text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 bg-brand hover:bg-brand-hover text-panel-deep font-bold rounded-lg text-xs transition-colors shadow-xs"
                >
                  Confirm &amp; Add Admin
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Register Distributor */}
      {showAddDist && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface border border-edge rounded-xl max-w-lg w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-line pb-2.5">
              <h3 className="text-xs font-bold font-mono text-ink uppercase tracking-wider flex items-center gap-2">
                <Building2 className="h-4 w-4 text-brand" />
                Register New Authorized Distributor
              </h3>
              <button onClick={() => setShowAddDist(false)} className="text-ink-muted hover:text-ink text-sm">
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateDistributor} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-ink-soft mb-1 font-medium">Partner Contact Name</label>
                  <input
                    type="text"
                    required
                    value={newDistName}
                    onChange={(e) => setNewDistName(e.target.value)}
                    placeholder="Sunil Grover"
                    className="w-full bg-canvas border border-line-strong rounded-lg p-2 text-ink focus:border-brand outline-none"
                  />
                </div>
                <div>
                  <label className="block text-ink-soft mb-1 font-medium">Enterprise Name</label>
                  <input
                    type="text"
                    required
                    value={newDistCompany}
                    onChange={(e) => setNewDistCompany(e.target.value)}
                    placeholder="Gujarat FinTech Partners LLP"
                    className="w-full bg-canvas border border-line-strong rounded-lg p-2 text-ink focus:border-brand outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-ink-soft mb-1 font-medium">Email</label>
                  <input
                    type="email"
                    required
                    value={newDistEmail}
                    onChange={(e) => setNewDistEmail(e.target.value)}
                    placeholder="partner@gujaratfin.in"
                    className="w-full bg-canvas border border-line-strong rounded-lg p-2 text-ink font-mono focus:border-brand outline-none"
                  />
                </div>
                <div>
                  <label className="block text-ink-soft mb-1 font-medium">Phone</label>
                  <input
                    type="text"
                    required
                    value={newDistPhone}
                    onChange={(e) => setNewDistPhone(e.target.value)}
                    placeholder="+91 98980 12345"
                    className="w-full bg-canvas border border-line-strong rounded-lg p-2 text-ink font-mono focus:border-brand outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-ink-soft mb-1 font-medium">Assigned States (Comma-separated)</label>
                <input
                  type="text"
                  required
                  value={newDistStates}
                  onChange={(e) => setNewDistStates(e.target.value)}
                  placeholder="Gujarat, Daman & Diu"
                  className="w-full bg-canvas border border-line-strong rounded-lg p-2 text-ink focus:border-brand outline-none"
                />
              </div>

              <div>
                <label className="block text-ink-soft mb-1 font-medium">Assigned Pincodes</label>
                <input
                  type="text"
                  required
                  value={newDistPincodes}
                  onChange={(e) => setNewDistPincodes(e.target.value)}
                  placeholder="380001, 380015, 395001"
                  className="w-full bg-canvas border border-line-strong rounded-lg p-2 text-ink font-mono focus:border-brand outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-ink-soft mb-1 font-medium">Allocated Seat Quota</label>
                  <input
                    type="number"
                    min="1"
                    value={newDistSeats}
                    onChange={(e) => setNewDistSeats(Number(e.target.value))}
                    className="w-full bg-canvas border border-line-strong rounded-lg p-2 text-ink font-mono focus:border-brand outline-none"
                  />
                </div>
                <div>
                  <label className="block text-ink-soft mb-1 font-medium">Service Credits (Hours)</label>
                  <input
                    type="number"
                    min="1"
                    value={newDistCredits}
                    onChange={(e) => setNewDistCredits(Number(e.target.value))}
                    className="w-full bg-canvas border border-line-strong rounded-lg p-2 text-ink font-mono focus:border-brand outline-none"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-line">
                <button
                  type="button"
                  onClick={() => setShowAddDist(false)}
                  className="px-3 py-1.5 text-ink-muted hover:text-ink text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 bg-brand hover:bg-brand-hover text-panel-deep font-bold rounded-lg text-xs transition-colors shadow-xs"
                >
                  Issue Distributor License &amp; Credentials
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Persistent Bottom Keyboard Shortcut Strip */}
      <footer className="bg-panel border-t border-edge text-[11px] font-mono px-4 py-1.5 flex items-center justify-between text-slate-300 shrink-0 select-none">
        <div className="flex items-center gap-3 overflow-x-auto">
          <button onClick={() => setActiveTab("dual_gate")} className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer">
            <span className="text-brand font-bold">F1:</span> Verification
          </button>
          <span className="text-slate-600">•</span>
          <button onClick={() => setActiveTab("distributors")} className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer">
            <span className="text-brand font-bold">F2:</span> Distributors
          </button>
          <span className="text-slate-600">•</span>
          <button onClick={() => setActiveTab("admins")} className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer">
            <span className="text-brand font-bold">F3:</span> Sub-Admins
          </button>
          <span className="text-slate-600">•</span>
          <button onClick={() => setActiveTab("licenses")} className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer">
            <span className="text-brand font-bold">F4:</span> Licenses
          </button>
          <span className="text-slate-600">•</span>
          <button onClick={() => setActiveTab("leads")} className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer">
            <span className="text-brand font-bold">F5:</span> Leads
          </button>
        </div>
        <div className="hidden md:flex items-center gap-3 text-[10px] text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Deku Master Governance Active
          </span>
          <span className="text-slate-600">|</span>
          <span>medhanshk10@gmail.com</span>
        </div>
      </footer>
    </div>
  );
}
