"use client";

import React, { useState, useEffect } from "react";
import {
  Building2,
  Users,
  KeyRound,
  FileText,
  Upload,
  Plus,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  Layers,
  Award,
  Clock,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

interface DistributorData {
  distributor: {
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
  };
  leads: Array<{
    id: string;
    clientName: string;
    clientPhone: string;
    clientEmail: string;
    companyName: string;
    gstinOrPan?: string;
    stateName: string;
    city: string;
    pincode: string;
    status: string;
    notes?: string;
    createdAt: string;
  }>;
  requests: Array<{
    id: string;
    clientName: string;
    clientEmail: string;
    companyName: string;
    planTier: string;
    requestType: string;
    proofDocumentType: string;
    proofDocumentNumber: string;
    proofFileName: string;
    proofAmount: number;
    status: string;
    generatedLicenseKey?: string;
    rejectionReason?: string;
    createdAt: string;
  }>;
  clientLicenses: Array<{
    id: string;
    licenseKey: string;
    licenseType: string;
    planTier: string;
    companyName: string;
    assignedClientEmail: string;
    addOnCategory?: string;
    extraSeatsCount: number;
    serviceDescription?: string;
    validUntil: string;
    status: string;
  }>;
  quota: {
    allocatedSeatQuota: number;
    availableServiceCredits: number;
  };
}

export default function DistributorPortal() {
  const [selectedDistributorId, setSelectedDistributorId] = useState("dist-mh-01");
  const [data, setData] = useState<DistributorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"leads" | "new_request" | "clients" | "add_ons">("new_request");
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);

  // Form: Request Client License
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [gstin, setGstin] = useState("");
  const [planTier, setPlanTier] = useState<"go" | "pro" | "enterprise">("pro");
  const [proofType, setProofType] = useState<"invoice" | "mou" | "quote">("invoice");
  const [proofDocNumber, setProofDocNumber] = useState("");
  const [proofFileName, setProofFileName] = useState("");
  const [proofAmount, setProofAmount] = useState(39999);
  const [submitting, setSubmitting] = useState(false);

  // Form: Provision Seats
  const [seatClientEmail, setSeatClientEmail] = useState("");
  const [seatCompanyName, setSeatCompanyName] = useState("");
  const [seatCount, setSeatCount] = useState(2);

  // Form: Provision Service
  const [svcClientEmail, setSvcClientEmail] = useState("");
  const [svcCompanyName, setSvcCompanyName] = useState("");
  const [svcDescription, setSvcDescription] = useState("On-site Chartered Accountant Tally Migration & Team Training");
  const [svcCredits, setSvcCredits] = useState(10);

  const fetchDistributorData = async (distId: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/ecosystem/distributor?distributorId=${distId}`);
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
    fetchDistributorData(selectedDistributorId);
  }, [selectedDistributorId]);

  const handleSubmitLicenseRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proofDocNumber || !proofFileName) {
      alert("Condition 2 Required: You must specify the verified Invoice/MoU Document Number and upload filename before submitting.");
      return;
    }
    try {
      setSubmitting(true);
      const res = await fetch("/api/ecosystem/distributor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit_license_request",
          distributorId: selectedDistributorId,
          clientName,
          clientEmail,
          clientPhone,
          companyName,
          gstin,
          requestType: "activation",
          planTier,
          proofDocumentType: proofType,
          proofDocumentNumber: proofDocNumber,
          proofFileName,
          proofAmount,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setBannerMessage("License Request submitted with commercial proof! Queued for Deku Admin verification.");
        setClientName("");
        setClientEmail("");
        setClientPhone("");
        setCompanyName("");
        setGstin("");
        setProofDocNumber("");
        setProofFileName("");
        fetchDistributorData(selectedDistributorId);
      } else {
        alert(json.error);
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleProvisionSeats = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/ecosystem/distributor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "provision_seats",
          distributorId: selectedDistributorId,
          clientEmail: seatClientEmail,
          companyName: seatCompanyName,
          extraSeatsCount: seatCount,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setBannerMessage(`Allocated ${seatCount} extra seats to ${seatCompanyName}. Visible in Deku Admin audit.`);
        setSeatClientEmail("");
        setSeatCompanyName("");
        fetchDistributorData(selectedDistributorId);
      } else {
        alert(json.error);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleProvisionService = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/ecosystem/distributor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "provision_service",
          distributorId: selectedDistributorId,
          clientEmail: svcClientEmail,
          companyName: svcCompanyName,
          serviceDescription: svcDescription,
          creditsUsed: svcCredits,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setBannerMessage(`Implementation service logged for ${svcCompanyName}.`);
        setSvcClientEmail("");
        setSvcCompanyName("");
        fetchDistributorData(selectedDistributorId);
      } else {
        alert(json.error);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleUpdateLeadStatus = async (leadId: string, status: string) => {
    try {
      await fetch("/api/ecosystem/distributor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_lead_status",
          leadId,
          status,
        }),
      });
      fetchDistributorData(selectedDistributorId);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-30 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400 font-bold">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-tight text-white">Distributor Portal</h1>
              <span className="text-[10px] font-mono bg-blue-500/20 text-blue-300 border border-blue-500/40 px-2 py-0.5 rounded-full font-semibold">
                Territory Partner
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Partner: <strong className="text-white">{data?.distributor.companyName}</strong> ({data?.distributor.distributorCode})
            </p>
          </div>
        </div>

        {/* Distributor Switcher & Quick Navigation */}
        <div className="flex items-center gap-2 text-xs">
          <label className="text-slate-400 font-mono text-[11px] hidden sm:inline">Partner Switcher:</label>
          <select
            value={selectedDistributorId}
            onChange={(e) => setSelectedDistributorId(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 font-mono text-xs focus:border-blue-400 outline-none"
          >
            <option value="dist-mh-01">DIST-MH-01 (Maharashtra Tech)</option>
            <option value="dist-ka-01">DIST-KA-01 (Karnataka FinEdge)</option>
            <option value="dist-dl-01">DIST-DL-01 (Northern India Cloud)</option>
          </select>

          <Link
            href="/admin"
            className="text-xs font-mono text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800/80 transition-colors"
          >
            Admin View
          </Link>
          <Link
            href="/login"
            className="text-xs font-mono text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800/80 transition-colors"
          >
            Deku Login
          </Link>
        </div>
      </header>

      {/* Alert Notification */}
      {bannerMessage && (
        <div className="bg-blue-950/80 border-b border-blue-500/30 px-6 py-2.5 text-xs text-blue-300 flex items-center justify-between">
          <span>{bannerMessage}</span>
          <button onClick={() => setBannerMessage(null)} className="text-blue-400 font-bold hover:underline">
            ✕
          </button>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        {/* Territory & Quota Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="text-xs text-slate-400 flex items-center justify-between">
              <span>Remaining Seat Quota</span>
              <Users className="h-4 w-4 text-blue-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-white mt-2">
              {data?.quota.allocatedSeatQuota ?? 0} <span className="text-xs text-slate-500 font-normal">seats left</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Available for self-service add-ons</div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="text-xs text-slate-400 flex items-center justify-between">
              <span>Service Credits</span>
              <Award className="h-4 w-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-amber-300 mt-2">
              {data?.quota.availableServiceCredits ?? 0} <span className="text-xs text-slate-500 font-normal">credits</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1">For CA onboarding &amp; migrations</div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="text-xs text-slate-400 flex items-center justify-between">
              <span>Assigned Territory</span>
              <Building2 className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="text-sm font-bold font-mono text-white mt-2">
              {data?.distributor.assignedStates.join(", ") || "General"}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Pincodes: {data?.distributor.assignedPincodes.slice(0, 3).join(", ")}...</div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="text-xs text-slate-400 flex items-center justify-between">
              <span>Inbound Leads Waiting</span>
              <Clock className="h-4 w-4 text-purple-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-white mt-2">
              {data?.leads.length ?? 0} <span className="text-xs text-slate-500 font-normal">clients</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Auto-routed by company location</div>
          </div>
        </div>

        {/* Tab Strip */}
        <div className="flex border-b border-slate-800 space-x-1">
          <button
            onClick={() => setActiveTab("new_request")}
            className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors border-b-2 flex items-center gap-2 ${
              activeTab === "new_request"
                ? "border-blue-400 text-blue-400 bg-slate-900/60"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <FileText className="h-4 w-4" />
            Request Activation License (Dual-Gate)
          </button>

          <button
            onClick={() => setActiveTab("leads")}
            className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors border-b-2 flex items-center gap-2 ${
              activeTab === "leads"
                ? "border-blue-400 text-blue-400 bg-slate-900/60"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Users className="h-4 w-4" />
            Territory Leads ({data?.leads.length ?? 0})
          </button>

          <button
            onClick={() => setActiveTab("clients")}
            className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors border-b-2 flex items-center gap-2 ${
              activeTab === "clients"
                ? "border-blue-400 text-blue-400 bg-slate-900/60"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <KeyRound className="h-4 w-4" />
            Active Client Licenses ({data?.clientLicenses.length ?? 0})
          </button>

          <button
            onClick={() => setActiveTab("add_ons")}
            className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors border-b-2 flex items-center gap-2 ${
              activeTab === "add_ons"
                ? "border-blue-400 text-blue-400 bg-slate-900/60"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Layers className="h-4 w-4" />
            Self-Service Add-Ons (Seats &amp; Services)
          </button>
        </div>

        {/* TAB 1: REQUEST CLIENT LICENSE (WITH DUAL-GATE RULE) */}
        {activeTab === "new_request" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                <div>
                  <h2 className="text-sm font-bold text-white flex items-center gap-2">
                    <FileText className="h-4 w-4 text-blue-400" />
                    Submit Client Activation License Request
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Compliance Notice: Activation licenses are strictly minted when you supply client details and upload a verified commercial document (Tax Invoice, signed MoU, or Quote).
                  </p>
                </div>

                <form onSubmit={handleSubmitLicenseRequest} className="space-y-4 text-xs">
                  {/* Condition 1: Client & Company Info */}
                  <div className="border border-slate-800 rounded-lg p-3.5 space-y-3 bg-slate-950/60">
                    <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-teal-400">
                      Condition 1: Client &amp; Enterprise Details
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-400 mb-1">Company / Entity Name *</label>
                        <input
                          type="text"
                          required
                          value={companyName}
                          onChange={(e) => setCompanyName(e.target.value)}
                          placeholder="e.g. Acme Industrial Solutions Pvt Ltd"
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white focus:border-blue-400 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1">Contact Person Name *</label>
                        <input
                          type="text"
                          required
                          value={clientName}
                          onChange={(e) => setClientName(e.target.value)}
                          placeholder="e.g. Ramesh Patel"
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white focus:border-blue-400 outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-slate-400 mb-1">Client Login Email *</label>
                        <input
                          type="email"
                          required
                          value={clientEmail}
                          onChange={(e) => setClientEmail(e.target.value)}
                          placeholder="ramesh@acme.com"
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white font-mono focus:border-blue-400 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1">Phone Number</label>
                        <input
                          type="text"
                          value={clientPhone}
                          onChange={(e) => setClientPhone(e.target.value)}
                          placeholder="+91 98200 12345"
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white font-mono focus:border-blue-400 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1">GSTIN (Optional)</label>
                        <input
                          type="text"
                          value={gstin}
                          onChange={(e) => setGstin(e.target.value)}
                          placeholder="27AABCA1234F1Z5"
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white font-mono focus:border-blue-400 outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1">Requested Plan Tier</label>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => setPlanTier("go")}
                          className={`p-2.5 rounded-lg border text-center transition-colors ${
                            planTier === "go"
                              ? "border-teal-400 bg-teal-950/40 text-teal-300 font-bold"
                              : "border-slate-800 bg-slate-900 text-slate-400"
                          }`}
                        >
                          Deku GO (Up to 2 Seats)
                        </button>
                        <button
                          type="button"
                          onClick={() => setPlanTier("pro")}
                          className={`p-2.5 rounded-lg border text-center transition-colors ${
                            planTier === "pro"
                              ? "border-blue-400 bg-blue-950/40 text-blue-300 font-bold"
                              : "border-slate-800 bg-slate-900 text-slate-400"
                          }`}
                        >
                          Deku PRO (Up to 5 Seats)
                        </button>
                        <button
                          type="button"
                          onClick={() => setPlanTier("enterprise")}
                          className={`p-2.5 rounded-lg border text-center transition-colors ${
                            planTier === "enterprise"
                              ? "border-purple-400 bg-purple-950/40 text-purple-300 font-bold"
                              : "border-slate-800 bg-slate-900 text-slate-400"
                          }`}
                        >
                          Enterprise (20+ Seats)
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Condition 2: Commercial Proof Document */}
                  <div className="border border-amber-500/30 rounded-lg p-3.5 space-y-3 bg-amber-950/20">
                    <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                      <AlertCircle className="h-4 w-4" />
                      Condition 2: Commercial Document Verification Proof
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Deku Admin requires proof before issuing the license key. Provide proof type, invoice/quote number, and file reference.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-slate-400 mb-1">Proof Document Type *</label>
                        <select
                          value={proofType}
                          onChange={(e) => setProofType(e.target.value as any)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white font-mono focus:border-blue-400 outline-none"
                        >
                          <option value="invoice">Tax Invoice Issued</option>
                          <option value="mou">Signed MoU / Contract</option>
                          <option value="quote">Accepted Quotation</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1">Document Number *</label>
                        <input
                          type="text"
                          required
                          value={proofDocNumber}
                          onChange={(e) => setProofDocNumber(e.target.value)}
                          placeholder="e.g. MHTECH-INV-2026-891"
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white font-mono focus:border-blue-400 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1">Commercial Value (₹)</label>
                        <input
                          type="number"
                          min="1"
                          value={proofAmount}
                          onChange={(e) => setProofAmount(Number(e.target.value))}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white font-mono focus:border-blue-400 outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1">Attached PDF File Name *</label>
                      <input
                        type="text"
                        required
                        value={proofFileName}
                        onChange={(e) => setProofFileName(e.target.value)}
                        placeholder="e.g. Acme_Industrial_Annual_Invoice_Signed.pdf"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white font-mono focus:border-blue-400 outline-none"
                      />
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full py-3 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-slate-950 font-bold rounded-lg transition-colors flex items-center justify-center gap-2 shadow-lg"
                    >
                      <Upload className="h-4 w-4" />
                      {submitting ? "Uploading Proof & Submitting..." : "Submit License Request to Deku Admin"}
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* Sidebar: Requests Queue History */}
            <div className="space-y-4">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <h3 className="text-xs font-bold font-mono text-slate-300 uppercase tracking-wider mb-3">
                  Submitted License Requests ({data?.requests.length ?? 0})
                </h3>

                <div className="space-y-2.5">
                  {data?.requests.map((req) => (
                    <div key={req.id} className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 text-xs space-y-1.5">
                      <div className="flex items-start justify-between">
                        <span className="font-bold text-white">{req.companyName}</span>
                        <span
                          className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-bold uppercase ${
                            req.status === "approved_issued"
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                              : req.status === "rejected"
                              ? "bg-red-500/20 text-red-300 border border-red-500/40"
                              : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                          }`}
                        >
                          {req.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Tier: {req.planTier.toUpperCase()} • Doc: {req.proofDocumentType} #{req.proofDocumentNumber}
                      </div>
                      {req.generatedLicenseKey && (
                        <div className="p-1.5 rounded bg-emerald-950/50 border border-emerald-500/30 font-mono text-emerald-300 text-[11px] flex items-center gap-1">
                          <KeyRound className="h-3 w-3" />
                          Key: {req.generatedLicenseKey}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: TERRITORY LEADS */}
        {activeTab === "leads" && (
          <div className="space-y-4">
            <div>
              <h2 className="text-sm font-bold text-white">Prospective Clients in Your Territory</h2>
              <p className="text-xs text-slate-400">
                These clients requested Deku platform setup from your assigned states ({data?.distributor.assignedStates.join(", ")}).
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase font-mono text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="p-3">Company Name</th>
                    <th className="p-3">Contact</th>
                    <th className="p-3">City / Pincode</th>
                    <th className="p-3">Current Status</th>
                    <th className="p-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-mono">
                  {data?.leads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-slate-800/40">
                      <td className="p-3 font-semibold text-white">
                        {lead.companyName}
                        {lead.gstinOrPan && <span className="block text-[10px] text-slate-500">GST: {lead.gstinOrPan}</span>}
                      </td>
                      <td className="p-3 text-slate-300">
                        {lead.clientName}
                        <span className="block text-[10px] text-slate-400">{lead.clientPhone} • {lead.clientEmail}</span>
                      </td>
                      <td className="p-3 text-slate-300">
                        {lead.city}, {lead.stateName} ({lead.pincode})
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 uppercase text-[10px]">
                          {lead.status}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleUpdateLeadStatus(lead.id, "contacted")}
                            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[10px]"
                          >
                            Mark Contacted
                          </button>
                          <button
                            onClick={() => handleUpdateLeadStatus(lead.id, "setup_in_progress")}
                            className="px-2 py-1 bg-blue-900/60 hover:bg-blue-800 text-blue-200 border border-blue-700 rounded text-[10px]"
                          >
                            In Setup
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: CLIENT LICENSES */}
        {activeTab === "clients" && (
          <div className="space-y-4">
            <div>
              <h2 className="text-sm font-bold text-white">All Active Client Licenses</h2>
              <p className="text-xs text-slate-400">
                Clients using activation keys provisioned through your distributorship.
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase font-mono text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="p-3">License Key</th>
                    <th className="p-3">Company Name</th>
                    <th className="p-3">Plan Tier</th>
                    <th className="p-3">Add-Ons / Provisions</th>
                    <th className="p-3">Renewal Date</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-mono">
                  {data?.clientLicenses.map((lic) => (
                    <tr key={lic.id} className="hover:bg-slate-800/40">
                      <td className="p-3 font-bold text-teal-400">{lic.licenseKey}</td>
                      <td className="p-3 text-white">
                        {lic.companyName}
                        <span className="block text-[10px] text-slate-400">{lic.assignedClientEmail}</span>
                      </td>
                      <td className="p-3 uppercase">{lic.planTier}</td>
                      <td className="p-3 text-slate-300">
                        {lic.extraSeatsCount > 0 && `+${lic.extraSeatsCount} Seats `}
                        {lic.serviceDescription && `[${lic.serviceDescription}] `}
                        {!lic.extraSeatsCount && !lic.serviceDescription && "Base Activation"}
                      </td>
                      <td className="p-3 text-slate-400">{new Date(lic.validUntil).toLocaleDateString()}</td>
                      <td className="p-3">
                        <span className="text-emerald-400 font-bold">Active</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: SELF-SERVICE ADD-ONS (SEATS & SERVICES) */}
        {activeTab === "add_ons" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Sub-Type B: Seat Provisions */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-400" />
                  Sub-Type B: Provision Extra Seats (Self-Service)
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Deducts from your remaining seat quota ({data?.quota.allocatedSeatQuota} seats). Visible in real-time in Deku Admin.
                </p>
              </div>

              <form onSubmit={handleProvisionSeats} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1">Client Company Name</label>
                  <input
                    type="text"
                    required
                    value={seatCompanyName}
                    onChange={(e) => setSeatCompanyName(e.target.value)}
                    placeholder="Solar Digital Technologies Pvt Ltd"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white focus:border-blue-400 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Client Registered Email</label>
                  <input
                    type="email"
                    required
                    value={seatClientEmail}
                    onChange={(e) => setSeatClientEmail(e.target.value)}
                    placeholder="ananya@solardigital.in"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white font-mono focus:border-blue-400 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Seats to Allocate</label>
                  <input
                    type="number"
                    min="1"
                    max={data?.quota.allocatedSeatQuota ?? 10}
                    value={seatCount}
                    onChange={(e) => setSeatCount(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white font-mono focus:border-blue-400 outline-none"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full py-2.5 bg-blue-500 hover:bg-blue-600 text-slate-950 font-bold rounded-lg transition-colors"
                  >
                    Allocate Extra Seats
                  </button>
                </div>
              </form>
            </div>

            {/* Sub-Type C: Service Provisions */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Award className="h-4 w-4 text-amber-400" />
                  Sub-Type C: Provision Implementation Service
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Log chartered accountant training, master setup, or Tally migration ({data?.quota.availableServiceCredits} credits available).
                </p>
              </div>

              <form onSubmit={handleProvisionService} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1">Client Company Name</label>
                  <input
                    type="text"
                    required
                    value={svcCompanyName}
                    onChange={(e) => setSvcCompanyName(e.target.value)}
                    placeholder="PixelScale Studio LLP"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white focus:border-blue-400 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Client Registered Email</label>
                  <input
                    type="email"
                    required
                    value={svcClientEmail}
                    onChange={(e) => setSvcClientEmail(e.target.value)}
                    placeholder="deepak@pixelscale.co"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white font-mono focus:border-blue-400 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Service Scope &amp; Deliverables</label>
                  <input
                    type="text"
                    required
                    value={svcDescription}
                    onChange={(e) => setSvcDescription(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white focus:border-blue-400 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Credits to Deduct</label>
                  <input
                    type="number"
                    min="1"
                    max={data?.quota.availableServiceCredits ?? 20}
                    value={svcCredits}
                    onChange={(e) => setSvcCredits(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white font-mono focus:border-blue-400 outline-none"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg transition-colors"
                  >
                    Log Service Delivery
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

