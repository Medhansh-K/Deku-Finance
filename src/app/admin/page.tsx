"use client";

import React, { useState, useEffect } from "react";
import {
  ShieldAlert,
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-30 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-400 font-bold">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-tight text-white">Deku Admin Portal</h1>
              <span className="text-[10px] font-mono bg-teal-500/20 text-teal-300 border border-teal-500/40 px-2 py-0.5 rounded-full font-semibold">
                Super Admin Master
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Direct Access: <span className="font-mono text-teal-400">medhanshk10@gmail.com</span> • Commercial Licensing &amp; Distributor Governance
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/distributor"
            className="text-xs font-mono text-slate-400 hover:text-white px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/80 transition-colors flex items-center gap-1.5"
          >
            Distributor View <ExternalLink className="h-3.5 w-3.5" />
          </Link>
          <Link
            href="/"
            className="text-xs font-mono text-slate-400 hover:text-white px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/80 transition-colors flex items-center gap-1.5"
          >
            Deku App <ChevronRight className="h-3.5 w-3.5" />
          </Link>
          <button
            onClick={fetchAdminData}
            className="p-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Refresh Store"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </header>

      {/* Action Notification Banner */}
      {actionMessage && (
        <div className="bg-teal-950/80 border-b border-teal-500/30 px-6 py-2.5 text-xs text-teal-300 flex items-center justify-between">
          <span>{actionMessage}</span>
          <button onClick={() => setActionMessage(null)} className="text-teal-400 font-bold hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Main Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        {/* KPI Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Distributor Network</span>
              <Building2 className="h-4 w-4 text-teal-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-white mt-2">
              {data?.metrics.totalDistributors ?? 0}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Authorised partners</div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Dual-Gate Queue</span>
              <FileText className="h-4 w-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-amber-300 mt-2">
              {data?.metrics.pendingVerifications ?? 0}
            </div>
            <div className="text-[11px] text-amber-500/80 mt-1">Proof verification required</div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Active Licenses</span>
              <KeyRound className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-white mt-2">
              {data?.metrics.activeLicenses ?? 0}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Client companies active</div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Commercial Volume</span>
              <Receipt className="h-4 w-4 text-blue-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-white mt-2">
              ₹{(data?.metrics.totalSalesVolumeINR ?? 0).toLocaleString("en-IN")}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Validated invoices &amp; MoUs</div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Inbound Leads</span>
              <Users className="h-4 w-4 text-purple-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-white mt-2">
              {data?.metrics.inboundLeadsCount ?? 0}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Routed by state/pincode</div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 space-x-1">
          <button
            onClick={() => setActiveTab("dual_gate")}
            className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors border-b-2 flex items-center gap-2 ${
              activeTab === "dual_gate"
                ? "border-teal-400 text-teal-400 bg-slate-900/60"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <FileText className="h-4 w-4" />
            Dual-Gate Verification Desk
            {(data?.metrics.pendingVerifications ?? 0) > 0 && (
              <span className="bg-amber-500 text-slate-950 font-black text-[10px] px-1.5 py-0.2 rounded-full">
                {data?.metrics.pendingVerifications}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("distributors")}
            className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors border-b-2 flex items-center gap-2 ${
              activeTab === "distributors"
                ? "border-teal-400 text-teal-400 bg-slate-900/60"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Building2 className="h-4 w-4" />
            Distributor Network ({data?.distributors.length ?? 0})
          </button>

          <button
            onClick={() => setActiveTab("admins")}
            className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors border-b-2 flex items-center gap-2 ${
              activeTab === "admins"
                ? "border-teal-400 text-teal-400 bg-slate-900/60"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Users className="h-4 w-4" />
            Sub-Admins &amp; Access ({data?.admins.length ?? 0})
          </button>

          <button
            onClick={() => setActiveTab("licenses")}
            className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors border-b-2 flex items-center gap-2 ${
              activeTab === "licenses"
                ? "border-teal-400 text-teal-400 bg-slate-900/60"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <KeyRound className="h-4 w-4" />
            Global License &amp; Add-On Registry
          </button>

          <button
            onClick={() => setActiveTab("leads")}
            className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors border-b-2 flex items-center gap-2 ${
              activeTab === "leads"
                ? "border-teal-400 text-teal-400 bg-slate-900/60"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Users className="h-4 w-4" />
            Website Onboarding Leads
          </button>
        </div>

        {/* TAB 1: DUAL-GATE VERIFICATION DESK */}
        {activeTab === "dual_gate" && (
          <div className="space-y-4">
            <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl flex items-start justify-between">
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-teal-400" />
                  Dual-Gate License Generation Protocol
                </h2>
                <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
                  Activation licenses are strictly minted only when both criteria are verified:
                  <strong className="text-slate-200 ml-1">1)</strong> Authorized distributor client license request received, AND{" "}
                  <strong className="text-slate-200">2)</strong> A verified commercial copy of Invoice, MoU, or Quote with financial proof amount is uploaded from distributor to company.
                </p>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 font-mono">
                  Pending Commercial Verifications ({data?.licenseRequests.filter((r) => r.status === "pending_verification").length ?? 0})
                </span>
              </div>

              {data?.licenseRequests.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">No requests in queue.</div>
              ) : (
                <div className="divide-y divide-slate-800">
                  {data?.licenseRequests.map((req) => (
                    <div key={req.id} className="p-4 hover:bg-slate-800/40 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white">{req.companyName}</span>
                          <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 uppercase">
                            {req.planTier} tier
                          </span>
                          <span
                            className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                              req.status === "pending_verification"
                                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                                : req.status === "approved_issued"
                                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                                : "bg-red-500/20 text-red-300 border border-red-500/40"
                            }`}
                          >
                            {req.status}
                          </span>
                        </div>

                        <div className="text-xs text-slate-400 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                          <div>
                            Client: <strong className="text-slate-300">{req.clientName}</strong> ({req.clientEmail})
                          </div>
                          <div>
                            Distributor: <strong className="text-teal-400">{req.distributorName}</strong>
                          </div>
                          <div>
                            GSTIN: <span className="font-mono text-slate-300">{req.gstin || "Unregistered / Composition"}</span>
                          </div>
                          <div>
                            Request Type: <span className="font-mono text-slate-300">{req.requestType}</span>
                          </div>
                        </div>

                        {/* Condition 2 Proof Document Box */}
                        <div className="mt-2 p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-teal-400" />
                            <div>
                              <span className="font-semibold text-slate-200 uppercase text-[11px]">
                                Condition 2 Proof: {req.proofDocumentType} #{req.proofDocumentNumber}
                              </span>
                              <span className="text-slate-400 block text-[11px] font-mono">
                                File: {req.proofFileName}
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-mono font-bold text-emerald-400">
                              ₹{req.proofAmount.toLocaleString("en-IN")}
                            </span>
                            <span className="block text-[10px] text-slate-500">Commercial value</span>
                          </div>
                        </div>

                        {req.generatedLicenseKey && (
                          <div className="p-2 rounded bg-emerald-950/40 border border-emerald-500/30 text-xs font-mono text-emerald-300 flex items-center gap-2">
                            <KeyRound className="h-4 w-4 text-emerald-400" />
                            Minted Key: <strong>{req.generatedLicenseKey}</strong>
                          </div>
                        )}

                        {req.rejectionReason && (
                          <div className="p-2 rounded bg-red-950/40 border border-red-500/30 text-xs text-red-300">
                            Rejection Reason: {req.rejectionReason}
                          </div>
                        )}
                      </div>

                      {/* Action buttons */}
                      {req.status === "pending_verification" && (
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => handleApproveRequest(req.id)}
                            className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            Verify Proof &amp; Mint Key
                          </button>
                          <button
                            onClick={() => handleRejectRequest(req.id)}
                            className="px-3 py-2 bg-red-950/60 hover:bg-red-900 border border-red-800 text-red-200 text-xs rounded-lg transition-colors flex items-center gap-1.5"
                          >
                            <XCircle className="h-4 w-4" />
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: DISTRIBUTORS NETWORK */}
        {activeTab === "distributors" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-white">Authorized Regional Distributors</h2>
                <p className="text-xs text-slate-400">
                  Distributors can manage client renewals, provision extra seats, and track territory clients.
                </p>
              </div>
              <button
                onClick={() => setShowAddDist(true)}
                className="px-3.5 py-2 bg-teal-500 hover:bg-teal-600 text-slate-950 font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5"
              >
                <Plus className="h-4 w-4" />
                Register Distributor
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data?.distributors.map((dist) => (
                <div key={dist.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-mono text-[10px] text-teal-400 font-bold px-2 py-0.5 rounded bg-teal-950/60 border border-teal-500/30">
                        {dist.distributorCode}
                      </span>
                      <h3 className="text-sm font-bold text-white mt-1.5">{dist.companyName}</h3>
                      <p className="text-xs text-slate-400">Partner: {dist.name}</p>
                    </div>
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  </div>

                  <div className="text-xs text-slate-400 space-y-1 font-mono">
                    <div>Email: {dist.email}</div>
                    <div>Phone: {dist.phone}</div>
                    <div>
                      Territory: {dist.assignedStates.join(", ")}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800 grid grid-cols-2 gap-2 text-center text-xs">
                    <div className="p-2 rounded bg-slate-950/80 border border-slate-800">
                      <span className="text-[10px] text-slate-500 block">Seat Quota</span>
                      <span className="font-bold font-mono text-teal-300">{dist.allocatedSeatQuota} seats</span>
                    </div>
                    <div className="p-2 rounded bg-slate-950/80 border border-slate-800">
                      <span className="text-[10px] text-slate-500 block">Service Credits</span>
                      <span className="font-bold font-mono text-blue-300">{dist.availableServiceCredits} hrs</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: SUB-ADMINS & EXTENSIBILITY */}
        {activeTab === "admins" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-white">Deku Admin Management</h2>
                <p className="text-xs text-slate-400">
                  Medhansh (<span className="text-teal-400 font-mono">medhanshk10@gmail.com</span>) has master super-admin rights and can add more admin and sub-admin emails dynamically.
                </p>
              </div>
              <button
                onClick={() => setShowAddAdmin(true)}
                className="px-3.5 py-2 bg-teal-500 hover:bg-teal-600 text-slate-950 font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5"
              >
                <Plus className="h-4 w-4" />
                Add Admin / Sub-Admin Email
              </button>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase font-mono text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="p-3">Admin Email</th>
                    <th className="p-3">Full Name</th>
                    <th className="p-3">Assigned Role</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Created By</th>
                    <th className="p-3">Date Added</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-mono">
                  {data?.admins.map((admin) => (
                    <tr key={admin.id} className="hover:bg-slate-800/40">
                      <td className="p-3 font-semibold text-white">{admin.email}</td>
                      <td className="p-3 text-slate-300">{admin.fullName}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700 uppercase text-[10px]">
                          {admin.role.replace("_", " ")}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className="text-emerald-400 font-bold flex items-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Active
                        </span>
                      </td>
                      <td className="p-3 text-slate-400">{admin.createdBy}</td>
                      <td className="p-3 text-slate-500">
                        {new Date(admin.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: GLOBAL LICENSE & ADD-ON REGISTRY */}
        {activeTab === "licenses" && (
          <div className="space-y-4">
            <div>
              <h2 className="text-sm font-bold text-white">Real-Time Global License Registry</h2>
              <p className="text-xs text-slate-400">
                Track all activation licenses and add-on licenses (Modules managed by Company Admin; Seats &amp; Services managed by Distributors).
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase font-mono text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="p-3">License Key</th>
                    <th className="p-3">Client Company</th>
                    <th className="p-3">Type &amp; Tier</th>
                    <th className="p-3">Sub-Type / Provision</th>
                    <th className="p-3">Issuer / Governance</th>
                    <th className="p-3">Partner Distributor</th>
                    <th className="p-3">Expiry</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-mono">
                  {data?.licenses.map((lic) => (
                    <tr key={lic.id} className="hover:bg-slate-800/40">
                      <td className="p-3 font-bold text-teal-300">{lic.licenseKey}</td>
                      <td className="p-3 text-white">
                        {lic.companyName}
                        <span className="block text-[10px] text-slate-500">{lic.assignedClientEmail}</span>
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 uppercase text-[10px] border border-slate-700">
                          {lic.licenseType} ({lic.planTier})
                        </span>
                      </td>
                      <td className="p-3 text-slate-300">
                        {lic.addOnCategory === "module" && (
                          <span className="text-purple-300">Module: {lic.addOnModuleName}</span>
                        )}
                        {lic.addOnCategory === "seat" && (
                          <span className="text-blue-300">+{lic.extraSeatsCount} Extra Seats</span>
                        )}
                        {lic.addOnCategory === "service" && (
                          <span className="text-amber-300">Service: {lic.serviceDescription}</span>
                        )}
                        {!lic.addOnCategory && "Base Platform Activation"}
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            lic.managedBy === "company_admin"
                              ? "bg-purple-950/60 text-purple-300 border border-purple-500/40"
                              : "bg-blue-950/60 text-blue-300 border border-blue-500/40"
                          }`}
                        >
                          {lic.managedBy === "company_admin" ? "Deku Admin Verified" : "Distributor Self-Service"}
                        </span>
                      </td>
                      <td className="p-3 text-slate-400">{lic.distributorName || "Direct Platform"}</td>
                      <td className="p-3 text-slate-400">{new Date(lic.validUntil).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 5: WEBSITE ONBOARDING LEADS */}
        {activeTab === "leads" && (
          <div className="space-y-4">
            <div>
              <h2 className="text-sm font-bold text-white">Inbound Website Setup Requests</h2>
              <p className="text-xs text-slate-400">
                Prospective businesses request setup by submitting company location; automatically routed to local distributors.
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase font-mono text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="p-3">Company Name</th>
                    <th className="p-3">Contact Person</th>
                    <th className="p-3">Location (State/Pincode)</th>
                    <th className="p-3">Assigned Distributor</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Request Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-mono">
                  {data?.onboardingRequests.map((lead) => (
                    <tr key={lead.id} className="hover:bg-slate-800/40">
                      <td className="p-3 font-semibold text-white">{lead.companyName}</td>
                      <td className="p-3 text-slate-300">
                        {lead.clientName} ({lead.clientPhone})
                      </td>
                      <td className="p-3 text-slate-300">
                        {lead.city}, {lead.stateName} - {lead.pincode}
                      </td>
                      <td className="p-3 text-teal-400 font-bold">{lead.assignedDistributorName || "Unassigned"}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 uppercase text-[10px]">
                          {lead.status}
                        </span>
                      </td>
                      <td className="p-3 text-slate-500">{new Date(lead.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Modal: Add Sub-Admin */}
      {showAddAdmin && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Users className="h-4 w-4 text-teal-400" />
                Add Admin / Sub-Admin Email
              </h3>
              <button onClick={() => setShowAddAdmin(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateAdmin} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                  placeholder="admin.associate@deku.finance"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white font-mono focus:border-teal-400 outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={newAdminName}
                  onChange={(e) => setNewAdminName(e.target.value)}
                  placeholder="Rahul Saxena"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white focus:border-teal-400 outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Privilege Role</label>
                <select
                  value={newAdminRole}
                  onChange={(e) => setNewAdminRole(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white font-mono focus:border-teal-400 outline-none"
                >
                  <option value="license_manager">License Manager (Can verify proof &amp; mint keys)</option>
                  <option value="super_admin">Super Admin (Full administrative rights)</option>
                  <option value="support_admin">Support Admin (Read-only / Audit)</option>
                </select>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddAdmin(false)}
                  className="px-3 py-2 text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-teal-500 hover:bg-teal-600 text-slate-950 font-bold rounded-lg transition-colors"
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
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Building2 className="h-4 w-4 text-teal-400" />
                Register New Authorized Distributor
              </h3>
              <button onClick={() => setShowAddDist(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateDistributor} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Partner Contact Name</label>
                  <input
                    type="text"
                    required
                    value={newDistName}
                    onChange={(e) => setNewDistName(e.target.value)}
                    placeholder="Sunil Grover"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white focus:border-teal-400 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Company / Enterprise Name</label>
                  <input
                    type="text"
                    required
                    value={newDistCompany}
                    onChange={(e) => setNewDistCompany(e.target.value)}
                    placeholder="Gujarat FinTech Partners LLP"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white focus:border-teal-400 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={newDistEmail}
                    onChange={(e) => setNewDistEmail(e.target.value)}
                    placeholder="partner@gujaratfin.in"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white font-mono focus:border-teal-400 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Phone</label>
                  <input
                    type="text"
                    required
                    value={newDistPhone}
                    onChange={(e) => setNewDistPhone(e.target.value)}
                    placeholder="+91 98980 12345"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white font-mono focus:border-teal-400 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Assigned States (Comma-separated)</label>
                <input
                  type="text"
                  required
                  value={newDistStates}
                  onChange={(e) => setNewDistStates(e.target.value)}
                  placeholder="Gujarat, Daman & Diu"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white focus:border-teal-400 outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Assigned Pincodes</label>
                <input
                  type="text"
                  required
                  value={newDistPincodes}
                  onChange={(e) => setNewDistPincodes(e.target.value)}
                  placeholder="380001, 380015, 395001"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white font-mono focus:border-teal-400 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Allocated Seat Quota</label>
                  <input
                    type="number"
                    min="1"
                    value={newDistSeats}
                    onChange={(e) => setNewDistSeats(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white font-mono focus:border-teal-400 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Service Credits (Hours)</label>
                  <input
                    type="number"
                    min="1"
                    value={newDistCredits}
                    onChange={(e) => setNewDistCredits(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white font-mono focus:border-teal-400 outline-none"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddDist(false)}
                  className="px-3 py-2 text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-teal-500 hover:bg-teal-600 text-slate-950 font-bold rounded-lg transition-colors"
                >
                  Issue Distributor License &amp; Credentials
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
