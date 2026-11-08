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
  ReceiptText,
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
    <div className="min-h-screen bg-panel-deep text-slate-100 flex flex-col font-sans relative overflow-x-hidden">
      {/* Background Ambient Glows */}
      <div className="absolute top-0 right-1/4 -mt-20 w-96 h-96 bg-brand/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 -mb-20 w-96 h-96 bg-sky-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header */}
      <header className="border-b border-edge bg-panel/90 backdrop-blur-xl sticky top-0 z-30 px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-brand text-panel-deep flex items-center justify-center font-black shadow-lg shadow-brand/20">
            <Building2 className="h-5 w-5 text-panel-deep" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-black tracking-tight text-white">Distributor Portal</h1>
              <span className="text-[10px] font-mono bg-brand/15 text-brand border border-brand/30 px-2.5 py-0.5 rounded-full font-semibold">
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
            className="bg-panel-deep border border-edge rounded-xl px-3 py-1.5 text-slate-200 font-mono text-xs focus:border-brand focus:ring-1 focus:ring-brand outline-none"
          >
            <option value="dist-mh-01">DIST-MH-01 (Maharashtra Tech)</option>
            <option value="dist-ka-01">DIST-KA-01 (Karnataka FinEdge)</option>
            <option value="dist-dl-01">DIST-DL-01 (Northern India Cloud)</option>
          </select>

          <Link
            href="/admin"
            className="text-xs font-mono text-slate-300 hover:text-white px-3 py-1.5 rounded-xl border border-edge bg-panel-raised/70 hover:bg-panel-raised transition-all"
          >
            Admin View
          </Link>
          <Link
            href="/login"
            className="text-xs font-mono text-slate-300 hover:text-white px-3 py-1.5 rounded-xl border border-edge bg-panel-raised/70 hover:bg-panel-raised transition-all"
          >
            Deku Login
          </Link>
        </div>
      </header>

      {/* Alert Notification */}
      {bannerMessage && (
        <div className="bg-brand/10 border-b border-brand/25 px-6 py-2.5 text-xs text-brand-soft flex items-center justify-between">
          <span className="font-medium">{bannerMessage}</span>
          <button onClick={() => setBannerMessage(null)} className="text-brand font-bold hover:underline">
            ✕
          </button>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6 relative z-10">
        {/* Territory & Quota Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-panel border border-edge rounded-2xl p-4.5 shadow-sm hover:border-slate-600 transition-all">
            <div className="text-xs text-slate-400 flex items-center justify-between">
              <span className="font-medium">Remaining Seat Quota</span>
              <Users className="h-4 w-4 text-brand" />
            </div>
            <div className="text-2xl font-bold font-mono text-white mt-2">
              {data?.quota.allocatedSeatQuota ?? 0} <span className="text-xs text-slate-500 font-normal">seats left</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Available for self-service add-ons</div>
          </div>

          <div className="bg-panel border border-edge rounded-2xl p-4.5 shadow-sm hover:border-slate-600 transition-all">
            <div className="text-xs text-slate-400 flex items-center justify-between">
              <span className="font-medium">Service Credits</span>
              <Award className="h-4 w-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-amber-300 mt-2">
              {data?.quota.availableServiceCredits ?? 0} <span className="text-xs text-slate-500 font-normal">credits</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1">For CA onboarding &amp; migrations</div>
          </div>

          <div className="bg-panel border border-edge rounded-2xl p-4.5 shadow-sm hover:border-slate-600 transition-all">
            <div className="text-xs text-slate-400 flex items-center justify-between">
              <span className="font-medium">Assigned Territory</span>
              <Building2 className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="text-sm font-bold font-mono text-white mt-2 truncate">
              {data?.distributor.assignedStates.join(", ") || "General"}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Pincodes: {data?.distributor.assignedPincodes.slice(0, 3).join(", ")}...</div>
          </div>

          <div className="bg-panel border border-edge rounded-2xl p-4.5 shadow-sm hover:border-slate-600 transition-all">
            <div className="text-xs text-slate-400 flex items-center justify-between">
              <span className="font-medium">Inbound Leads Waiting</span>
              <Clock className="h-4 w-4 text-brand-soft" />
            </div>
            <div className="text-2xl font-bold font-mono text-white mt-2">
              {data?.leads.length ?? 0} <span className="text-xs text-slate-500 font-normal">clients</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Auto-routed by company location</div>
          </div>
        </div>

        {/* Tab Strip */}
        <div className="flex border-b border-edge space-x-1">
          <button
            onClick={() => setActiveTab("new_request")}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 flex items-center gap-2 ${
              activeTab === "new_request"
                ? "border-brand text-brand bg-panel/70"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <FileText className="h-4 w-4" />
            Request Activation License (Dual-Gate)
          </button>

          <button
            onClick={() => setActiveTab("leads")}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 flex items-center gap-2 ${
              activeTab === "leads"
                ? "border-brand text-brand bg-panel/70"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Users className="h-4 w-4" />
            Territory Leads ({data?.leads.length ?? 0})
          </button>

          <button
            onClick={() => setActiveTab("clients")}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 flex items-center gap-2 ${
              activeTab === "clients"
                ? "border-brand text-brand bg-panel/70"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <KeyRound className="h-4 w-4" />
            Active Client Licenses ({data?.clientLicenses.length ?? 0})
          </button>

          <button
            onClick={() => setActiveTab("add_ons")}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 flex items-center gap-2 ${
              activeTab === "add_ons"
                ? "border-brand text-brand bg-panel/70"
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
              <div className="bg-panel border border-edge rounded-2xl p-6 space-y-4 shadow-lg">
                <div>
                  <h2 className="text-sm font-bold text-white flex items-center gap-2">
                    <FileText className="h-4 w-4 text-brand" />
                    Submit Client Activation License Request
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Compliance Notice: Activation licenses are strictly minted when you supply client details and upload a verified commercial document (Tax Invoice, signed MoU, or Quote).
                  </p>
                </div>

                <form onSubmit={handleSubmitLicenseRequest} className="space-y-4 text-xs">
                  {/* Condition 1: Client & Company Info */}
                  <div className="border border-edge rounded-xl p-4 space-y-3.5 bg-panel-deep/70">
                    <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-brand">
                      Condition 1: Client &amp; Enterprise Details
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-300 mb-1 font-medium">Company / Entity Name *</label>
                        <input
                          type="text"
                          required
                          value={companyName}
                          onChange={(e) => setCompanyName(e.target.value)}
                          placeholder="e.g. Acme Industrial Solutions Pvt Ltd"
                          className="w-full bg-panel border border-edge rounded-xl p-2.5 text-white focus:border-brand focus:ring-1 focus:ring-brand outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-300 mb-1 font-medium">Contact Person Name *</label>
                        <input
                          type="text"
                          required
                          value={clientName}
                          onChange={(e) => setClientName(e.target.value)}
                          placeholder="e.g. Ramesh Patel"
                          className="w-full bg-panel border border-edge rounded-xl p-2.5 text-white focus:border-brand focus:ring-1 focus:ring-brand outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-slate-300 mb-1 font-medium">Client Login Email *</label>
                        <input
                          type="email"
                          required
                          value={clientEmail}
                          onChange={(e) => setClientEmail(e.target.value)}
                          placeholder="ramesh@acme.com"
                          className="w-full bg-panel border border-edge rounded-xl p-2.5 text-white font-mono focus:border-brand focus:ring-1 focus:ring-brand outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-300 mb-1 font-medium">Phone Number</label>
                        <input
                          type="text"
                          value={clientPhone}
                          onChange={(e) => setClientPhone(e.target.value)}
                          placeholder="+91 98200 12345"
                          className="w-full bg-panel border border-edge rounded-xl p-2.5 text-white font-mono focus:border-brand focus:ring-1 focus:ring-brand outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-300 mb-1 font-medium">GSTIN (Optional)</label>
                        <input
                          type="text"
                          value={gstin}
                          onChange={(e) => setGstin(e.target.value)}
                          placeholder="27AABCA1234F1Z5"
                          className="w-full bg-panel border border-edge rounded-xl p-2.5 text-white font-mono focus:border-brand focus:ring-1 focus:ring-brand outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-slate-300 mb-1.5 font-medium">Requested Plan Tier</label>
                      <div className="grid grid-cols-3 gap-2.5">
                        <button
                          type="button"
                          onClick={() => setPlanTier("go")}
                          className={`p-3 rounded-xl border text-center transition-all ${
                            planTier === "go"
                              ? "border-brand bg-brand/15 text-brand font-bold shadow-sm"
                              : "border-edge bg-panel text-slate-400 hover:border-slate-600"
                          }`}
                        >
                          Deku GO (Up to 2 Seats)
                        </button>
                        <button
                          type="button"
                          onClick={() => setPlanTier("pro")}
                          className={`p-3 rounded-xl border text-center transition-all ${
                            planTier === "pro"
                              ? "border-brand bg-brand/15 text-brand font-bold shadow-sm"
                              : "border-edge bg-panel text-slate-400 hover:border-slate-600"
                          }`}
                        >
                          Deku PRO (Up to 5 Seats)
                        </button>
                        <button
                          type="button"
                          onClick={() => setPlanTier("enterprise")}
                          className={`p-3 rounded-xl border text-center transition-all ${
                            planTier === "enterprise"
                              ? "border-purple-400 bg-purple-500/15 text-purple-300 font-bold shadow-sm"
                              : "border-edge bg-panel text-slate-400 hover:border-slate-600"
                          }`}
                        >
                          Enterprise (20+ Seats)
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Condition 2: Commercial Proof Document */}
                  <div className="border border-amber-500/30 rounded-xl p-4 space-y-3.5 bg-amber-950/15">
                    <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                      <AlertCircle className="h-4 w-4" />
                      Condition 2: Commercial Document Verification Proof
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Deku Admin requires proof before issuing the license key. Provide proof type, invoice/quote number, and file reference.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-slate-300 mb-1 font-medium">Proof Document Type *</label>
                        <select
                          value={proofType}
                          onChange={(e) => setProofType(e.target.value as any)}
                          className="w-full bg-panel border border-edge rounded-xl p-2.5 text-white font-mono focus:border-brand focus:ring-1 focus:ring-brand outline-none"
                        >
                          <option value="invoice">Tax Invoice Issued</option>
                          <option value="mou">Signed MoU / Contract</option>
                          <option value="quote">Accepted Quotation</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-slate-300 mb-1 font-medium">Document Number *</label>
                        <input
                          type="text"
                          required
                          value={proofDocNumber}
                          onChange={(e) => setProofDocNumber(e.target.value)}
                          placeholder="e.g. MHTECH-INV-2026-891"
                          className="w-full bg-panel border border-edge rounded-xl p-2.5 text-white font-mono focus:border-brand focus:ring-1 focus:ring-brand outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-300 mb-1 font-medium">Commercial Value (₹)</label>
                        <input
                          type="number"
                          min="1"
                          value={proofAmount}
                          onChange={(e) => setProofAmount(Number(e.target.value))}
                          className="w-full bg-panel border border-edge rounded-xl p-2.5 text-white font-mono focus:border-brand focus:ring-1 focus:ring-brand outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-slate-300 mb-1 font-medium">Attached PDF File Name *</label>
                      <input
                        type="text"
                        required
                        value={proofFileName}
                        onChange={(e) => setProofFileName(e.target.value)}
                        placeholder="e.g. Acme_Industrial_Annual_Invoice_Signed.pdf"
                        className="w-full bg-panel border border-edge rounded-xl p-2.5 text-white font-mono focus:border-brand focus:ring-1 focus:ring-brand outline-none"
                      />
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full py-3 px-4 bg-brand hover:bg-brand-hover disabled:opacity-50 text-panel-deep font-black rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-brand/20 hover:scale-[1.01]"
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
              <div className="bg-panel border border-edge rounded-2xl p-5 shadow-lg">
                <h3 className="text-xs font-bold font-mono text-slate-300 uppercase tracking-wider mb-3.5">
                  Submitted License Requests ({data?.requests.length ?? 0})
                </h3>

                <div className="space-y-2.5">
                  {data?.requests.map((req) => (
                    <div key={req.id} className="p-3.5 rounded-xl bg-panel-deep/80 border border-edge text-xs space-y-1.5">
                      <div className="flex items-start justify-between">
                        <span className="font-bold text-white">{req.companyName}</span>
                        <span
                          className={`text-[9px] font-mono px-2 py-0.5 rounded-full font-bold uppercase ${
                            req.status === "approved_issued"
                              ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                              : req.status === "rejected"
                              ? "bg-rose-500/15 text-rose-300 border border-rose-500/30"
                              : "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                          }`}
                        >
                          {req.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Tier: {req.planTier.toUpperCase()} • Doc: {req.proofDocumentType} #{req.proofDocumentNumber}
                      </div>
                      {req.generatedLicenseKey && (
                        <div className="p-2 rounded-lg bg-emerald-950/50 border border-emerald-500/30 font-mono text-emerald-300 text-[11px] flex items-center gap-1.5">
                          <KeyRound className="h-3.5 w-3.5" />
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

            <div className="bg-panel border border-edge rounded-2xl overflow-hidden shadow-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-panel-deep text-slate-400 uppercase font-mono text-[10px] border-b border-edge">
                  <tr>
                    <th className="p-3.5">Company Name</th>
                    <th className="p-3.5">Contact</th>
                    <th className="p-3.5">City / Pincode</th>
                    <th className="p-3.5">Current Status</th>
                    <th className="p-3.5">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-edge font-mono">
                  {data?.leads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-panel-raised/40 transition-colors">
                      <td className="p-3.5 font-bold text-white">
                        {lead.companyName}
                        {lead.gstinOrPan && <span className="block text-[10px] text-slate-500">GST: {lead.gstinOrPan}</span>}
                      </td>
                      <td className="p-3.5 text-slate-300">
                        {lead.clientName}
                        <span className="block text-[10px] text-slate-400">{lead.clientPhone} • {lead.clientEmail}</span>
                      </td>
                      <td className="p-3.5 text-slate-300">
                        {lead.city}, {lead.stateName} ({lead.pincode})
                      </td>
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded-lg bg-panel-raised text-slate-300 border border-edge uppercase text-[10px]">
                          {lead.status}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleUpdateLeadStatus(lead.id, "contacted")}
                            className="px-2.5 py-1 bg-panel-raised hover:bg-slate-700 text-slate-200 rounded-lg text-[10px] border border-edge transition-colors"
                          >
                            Mark Contacted
                          </button>
                          <button
                            onClick={() => handleUpdateLeadStatus(lead.id, "setup_in_progress")}
                            className="px-2.5 py-1 bg-brand/15 hover:bg-brand/25 text-brand border border-brand/30 rounded-lg text-[10px] font-bold transition-colors"
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

            <div className="bg-panel border border-edge rounded-2xl overflow-hidden shadow-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-panel-deep text-slate-400 uppercase font-mono text-[10px] border-b border-edge">
                  <tr>
                    <th className="p-3.5">License Key</th>
                    <th className="p-3.5">Company Name</th>
                    <th className="p-3.5">Plan Tier</th>
                    <th className="p-3.5">Add-Ons / Provisions</th>
                    <th className="p-3.5">Renewal Date</th>
                    <th className="p-3.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-edge font-mono">
                  {data?.clientLicenses.map((lic) => (
                    <tr key={lic.id} className="hover:bg-panel-raised/40 transition-colors">
                      <td className="p-3.5 font-bold text-brand">{lic.licenseKey}</td>
                      <td className="p-3.5 text-white">
                        {lic.companyName}
                        <span className="block text-[10px] text-slate-400">{lic.assignedClientEmail}</span>
                      </td>
                      <td className="p-3.5 uppercase">{lic.planTier}</td>
                      <td className="p-3.5 text-slate-300">
                        {lic.extraSeatsCount > 0 && `+${lic.extraSeatsCount} Seats `}
                        {lic.serviceDescription && `[${lic.serviceDescription}] `}
                        {!lic.extraSeatsCount && !lic.serviceDescription && "Base Activation"}
                      </td>
                      <td className="p-3.5 text-slate-400">{new Date(lic.validUntil).toLocaleDateString()}</td>
                      <td className="p-3.5">
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
            <div className="bg-panel border border-edge rounded-2xl p-6 space-y-4 shadow-lg">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Users className="h-4 w-4 text-brand" />
                  Sub-Type B: Provision Extra Seats (Self-Service)
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Deducts from your remaining seat quota ({data?.quota.allocatedSeatQuota} seats). Visible in real-time in Deku Admin.
                </p>
              </div>

              <form onSubmit={handleProvisionSeats} className="space-y-3.5 text-xs">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Client Company Name</label>
                  <input
                    type="text"
                    required
                    value={seatCompanyName}
                    onChange={(e) => setSeatCompanyName(e.target.value)}
                    placeholder="Solar Digital Technologies Pvt Ltd"
                    className="w-full bg-panel-deep border border-edge rounded-xl p-2.5 text-white focus:border-brand focus:ring-1 focus:ring-brand outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Client Registered Email</label>
                  <input
                    type="email"
                    required
                    value={seatClientEmail}
                    onChange={(e) => setSeatClientEmail(e.target.value)}
                    placeholder="ananya@solardigital.in"
                    className="w-full bg-panel-deep border border-edge rounded-xl p-2.5 text-white font-mono focus:border-brand focus:ring-1 focus:ring-brand outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Seats to Allocate</label>
                  <input
                    type="number"
                    min="1"
                    max={data?.quota.allocatedSeatQuota ?? 10}
                    value={seatCount}
                    onChange={(e) => setSeatCount(Number(e.target.value))}
                    className="w-full bg-panel-deep border border-edge rounded-xl p-2.5 text-white font-mono focus:border-brand focus:ring-1 focus:ring-brand outline-none"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full py-3 bg-brand hover:bg-brand-hover text-panel-deep font-black rounded-xl transition-all shadow-md shadow-brand/20 hover:scale-[1.01]"
                  >
                    Allocate Extra Seats
                  </button>
                </div>
              </form>
            </div>

            {/* Sub-Type C: Service Provisions */}
            <div className="bg-panel border border-edge rounded-2xl p-6 space-y-4 shadow-lg">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Award className="h-4 w-4 text-amber-400" />
                  Sub-Type C: Provision Implementation Service
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Log chartered accountant training, master setup, or Tally migration ({data?.quota.availableServiceCredits} credits available).
                </p>
              </div>

              <form onSubmit={handleProvisionService} className="space-y-3.5 text-xs">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Client Company Name</label>
                  <input
                    type="text"
                    required
                    value={svcCompanyName}
                    onChange={(e) => setSvcCompanyName(e.target.value)}
                    placeholder="PixelScale Studio LLP"
                    className="w-full bg-panel-deep border border-edge rounded-xl p-2.5 text-white focus:border-brand focus:ring-1 focus:ring-brand outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Client Registered Email</label>
                  <input
                    type="email"
                    required
                    value={svcClientEmail}
                    onChange={(e) => setSvcClientEmail(e.target.value)}
                    placeholder="deepak@pixelscale.co"
                    className="w-full bg-panel-deep border border-edge rounded-xl p-2.5 text-white font-mono focus:border-brand focus:ring-1 focus:ring-brand outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Service Scope &amp; Deliverables</label>
                  <input
                    type="text"
                    required
                    value={svcDescription}
                    onChange={(e) => setSvcDescription(e.target.value)}
                    className="w-full bg-panel-deep border border-edge rounded-xl p-2.5 text-white focus:border-brand focus:ring-1 focus:ring-brand outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Credits to Deduct</label>
                  <input
                    type="number"
                    min="1"
                    max={data?.quota.availableServiceCredits ?? 20}
                    value={svcCredits}
                    onChange={(e) => setSvcCredits(Number(e.target.value))}
                    className="w-full bg-panel-deep border border-edge rounded-xl p-2.5 text-white font-mono focus:border-brand focus:ring-1 focus:ring-brand outline-none"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-panel-deep font-black rounded-xl transition-all shadow-md shadow-amber-500/20 hover:scale-[1.01]"
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
