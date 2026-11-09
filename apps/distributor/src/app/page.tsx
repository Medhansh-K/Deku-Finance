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
  Activity,
  ArrowRightLeft,
  Check,
  MapPin,
  Phone,
  Mail,
  RefreshCw,
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
  const [activeTab, setActiveTab] = useState<"new_request" | "leads" | "clients" | "add_ons">("new_request");
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "F1") {
        e.preventDefault();
        setActiveTab("new_request");
      } else if (e.key === "F2") {
        e.preventDefault();
        setActiveTab("leads");
      } else if (e.key === "F3") {
        e.preventDefault();
        setActiveTab("clients");
      } else if (e.key === "F4") {
        e.preventDefault();
        setActiveTab("add_ons");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

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

  // Modals
  const [showSeatModal, setShowSeatModal] = useState(false);
  const [showServiceModal, setShowServiceModal] = useState(false);

  const fetchDistributorData = async (distId: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/distributor?distributorId=${distId}`);
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
      const res = await fetch("/api/distributor", {
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
      const res = await fetch("/api/distributor", {
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
        setShowSeatModal(false);
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
      const res = await fetch("/api/distributor", {
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
        setShowServiceModal(false);
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
      await fetch("/api/distributor", {
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
    <div className="min-h-screen bg-canvas text-ink flex flex-col font-sans">
      {/* Top Header Bar: Clean Dark Chrome with Brand Icon (Isolated from Admin) */}
      <header className="bg-panel border-b border-edge px-4 py-2 flex items-center justify-between text-white shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-7 w-7 rounded-lg bg-brand text-panel-deep flex items-center justify-center font-black shadow-xs">
            <Building2 className="h-4 w-4 text-panel-deep" />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm tracking-tight text-white">Distributor Portal</span>
            <span className="text-[10px] font-mono bg-panel-raised text-brand-soft px-2 py-0.5 rounded border border-edge">
              Territory Workspace
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 ml-2 pl-3 border-l border-edge text-xs">
            <span className="text-slate-400">Partner:</span>
            <span className="font-bold text-white text-[11px] truncate max-w-[200px]">
              {data?.distributor.companyName}
            </span>
            <span className="text-[9px] font-mono bg-brand/20 text-brand px-1.5 py-0.2 rounded font-bold">
              {data?.distributor.distributorCode}
            </span>
          </div>
        </div>

        {/* Quick Tabs & Refresh */}
        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center gap-1 bg-panel-deep/60 p-0.5 rounded-lg border border-edge text-[11px] font-mono">
            <button
              onClick={() => setActiveTab("new_request")}
              className={`px-2.5 py-1 rounded transition-colors ${
                activeTab === "new_request"
                  ? "bg-brand text-panel-deep font-bold"
                  : "text-slate-300 hover:text-white hover:bg-panel-raised"
              }`}
            >
              New Client Request
            </button>
            <button
              onClick={() => setActiveTab("leads")}
              className={`px-2.5 py-1 rounded transition-colors ${
                activeTab === "leads"
                  ? "bg-brand text-panel-deep font-bold"
                  : "text-slate-300 hover:text-white hover:bg-panel-raised"
              }`}
            >
              Inbound Leads ({data?.leads.length ?? 0})
            </button>
            <button
              onClick={() => setActiveTab("clients")}
              className={`px-2.5 py-1 rounded transition-colors ${
                activeTab === "clients"
                  ? "bg-brand text-panel-deep font-bold"
                  : "text-slate-300 hover:text-white hover:bg-panel-raised"
              }`}
            >
              Active Clients ({data?.clientLicenses.length ?? 0})
            </button>
            <button
              onClick={() => setActiveTab("add_ons")}
              className={`px-2.5 py-1 rounded transition-colors ${
                activeTab === "add_ons"
                  ? "bg-brand text-panel-deep font-bold"
                  : "text-slate-300 hover:text-white hover:bg-panel-raised"
              }`}
            >
              Add-On Allocator
            </button>
          </div>

          <button
            onClick={() => fetchDistributorData(selectedDistributorId)}
            className="p-1.5 rounded-lg border border-edge text-slate-300 hover:text-white hover:bg-panel-raised transition-colors"
            title="Refresh Data"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </header>

      {/* Alert Notification */}
      {bannerMessage && (
        <div className="bg-emerald-50 border-b border-emerald-300 px-4 py-2 text-xs text-emerald-900 flex items-center justify-between font-medium">
          <span>{bannerMessage}</span>
          <button onClick={() => setBannerMessage(null)} className="text-emerald-700 font-bold hover:underline">
            ✕
          </button>
        </div>
      )}

      {/* Main Bento Grid Canvas */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto p-3.5 flex flex-col md:flex-row gap-3.5 items-stretch">
        {/* ========================================================================= */}
        {/* Column 1 (Left): Territory Partner Profile & Quotas Bento Card            */}
        {/* ========================================================================= */}
        <div className="w-full md:w-64 lg:w-72 shrink-0 bg-surface border border-edge rounded-xl shadow-md overflow-hidden flex flex-col justify-between">
          <div>
            {/* Box Header */}
            <div className="bg-panel px-3.5 py-1.5 border-b border-edge flex items-center justify-between text-white">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-300">
                Partner Quotas &amp; Scope
              </span>
              <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/20 px-1.5 py-0.2 rounded border border-emerald-400/30 font-bold">
                Online
              </span>
            </div>

            <div className="p-3 space-y-3">
              {/* Partner Credentials Card */}
              <div className="p-2.5 rounded-lg bg-canvas-sunken border border-line">
                <div className="text-[10px] font-mono font-bold uppercase text-ink-muted">Distributorship</div>
                <div className="font-bold text-xs text-ink truncate mt-0.5">{data?.distributor.companyName}</div>
                <div className="text-[11px] text-ink-soft truncate">{data?.distributor.name}</div>
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="text-[9px] font-mono bg-panel text-brand-soft px-1.5 py-0.5 rounded font-bold">
                    {data?.distributor.distributorCode}
                  </span>
                  <span className="text-[9px] font-mono bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded border border-emerald-300 font-bold">
                    Authorised
                  </span>
                </div>
              </div>

              {/* Territory Quota Highlights */}
              <div className="grid grid-cols-2 gap-2 text-center text-xs">
                <div className="p-2 rounded bg-surface border border-line">
                  <span className="text-[10px] font-mono text-ink-muted block uppercase">Seat Bank</span>
                  <span className="text-base font-bold font-mono text-brand-strong">
                    {data?.quota.allocatedSeatQuota ?? 0}
                  </span>
                  <span className="text-[9px] text-ink-subtle block">seats remaining</span>
                </div>
                <div className="p-2 rounded bg-surface border border-line">
                  <span className="text-[10px] font-mono text-ink-muted block uppercase">Service Credits</span>
                  <span className="text-base font-bold font-mono text-amber-700">
                    {data?.quota.availableServiceCredits ?? 0}
                  </span>
                  <span className="text-[9px] text-ink-subtle block">hours allocated</span>
                </div>
              </div>

              {/* Quick Add-on Actions */}
              <div className="space-y-1.5 pt-1">
                <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-ink-soft">
                  Self-Service Provisions
                </div>
                <button
                  type="button"
                  onClick={() => setShowSeatModal(true)}
                  className="w-full text-left px-2.5 py-2 rounded-lg text-xs transition-all flex items-center justify-between border bg-surface hover:bg-canvas text-ink border-line hover:border-brand/40 shadow-xs group"
                >
                  <span className="flex items-center gap-2 font-medium">
                    <Users className="h-3.5 w-3.5 text-brand" />
                    Allocate Extra Seats
                  </span>
                  <Plus className="h-3.5 w-3.5 text-ink-subtle group-hover:text-brand" />
                </button>

                <button
                  type="button"
                  onClick={() => setShowServiceModal(true)}
                  className="w-full text-left px-2.5 py-2 rounded-lg text-xs transition-all flex items-center justify-between border bg-surface hover:bg-canvas text-ink border-line hover:border-brand/40 shadow-xs group"
                >
                  <span className="flex items-center gap-2 font-medium">
                    <Award className="h-3.5 w-3.5 text-amber-600" />
                    Log CA Onboarding Service
                  </span>
                  <Plus className="h-3.5 w-3.5 text-ink-subtle group-hover:text-amber-600" />
                </button>
              </div>

              {/* Territory Metadata */}
              <div className="space-y-1 text-[11px] pt-1 border-t border-line">
                <div className="flex justify-between py-1 border-b border-line">
                  <span className="text-ink-muted">Assigned Territory:</span>
                  <span className="font-mono font-bold text-ink truncate max-w-[130px]">
                    {data?.distributor.assignedStates.join(", ")}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-line">
                  <span className="text-ink-muted">Inbound Leads:</span>
                  <span className="font-mono font-bold text-brand-strong">
                    {data?.leads.length ?? 0} prospective
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-line">
                  <span className="text-ink-muted">Client Workspaces:</span>
                  <span className="font-mono font-bold text-ink">
                    {data?.clientLicenses.length ?? 0} active
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Bento Card Footer */}
          <div className="px-3.5 py-2 bg-canvas border-t border-line text-[10px] text-ink-muted flex items-center justify-between">
            <span className="font-mono">Distributor OS</span>
            <span className="font-mono font-bold text-brand-strong">Partner Network</span>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* Column 2 & 3: Main Active Bento Cards                                     */}
        {/* ========================================================================= */}
        <div className="flex-1 min-w-0 grid grid-cols-1 lg:grid-cols-2 gap-3.5 items-stretch">
          {/* Bento Center Card: Request Client License (Dual Gate) */}
          <div className="min-w-0 bg-surface border border-edge rounded-xl shadow-md overflow-hidden flex flex-col justify-between">
            <div>
              {/* Header */}
              <div className="bg-panel px-3.5 py-1.5 border-b border-edge flex items-center justify-between text-white">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-brand" />
                  <span className="text-xs font-mono font-black tracking-wider uppercase">
                    New Client License Request
                  </span>
                </div>
                <span className="text-[10px] font-mono text-brand-soft">
                  Dual-Gate Commercial Desk
                </span>
              </div>

              {/* Sub-header notice */}
              <div className="p-3 bg-canvas-sunken border-b border-line text-[11px] text-ink-soft leading-relaxed">
                <strong>Commercial Compliance:</strong> You must attach a copy of the issued Invoice, MoU, or Quote.
                Upon approval by Deku Admin, the client activation key will be issued immediately.
              </div>

              {/* Form */}
              <form onSubmit={handleSubmitLicenseRequest} className="p-3.5 space-y-3.5 overflow-y-auto max-h-[620px] text-xs">
                {/* Condition 1: Client & Company */}
                <div className="p-3 rounded-lg border border-line bg-surface space-y-2.5">
                  <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-brand-strong">
                    Condition 1: Client &amp; Enterprise Details
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-ink-soft mb-1 font-medium">Company Name *</label>
                      <input
                        type="text"
                        required
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="Solar Digital Technologies Pvt Ltd"
                        className="w-full bg-canvas border border-line-strong rounded-lg p-2 text-ink focus:border-brand outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-ink-soft mb-1 font-medium">Contact Person *</label>
                      <input
                        type="text"
                        required
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                        placeholder="Ananya Deshmukh"
                        className="w-full bg-canvas border border-line-strong rounded-lg p-2 text-ink focus:border-brand outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-ink-soft mb-1 font-medium">Login Email *</label>
                      <input
                        type="email"
                        required
                        value={clientEmail}
                        onChange={(e) => setClientEmail(e.target.value)}
                        placeholder="ananya@solardigital.in"
                        className="w-full bg-canvas border border-line-strong rounded-lg p-2 text-ink font-mono focus:border-brand outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-ink-soft mb-1 font-medium">Phone</label>
                      <input
                        type="text"
                        value={clientPhone}
                        onChange={(e) => setClientPhone(e.target.value)}
                        placeholder="+91 98220 99887"
                        className="w-full bg-canvas border border-line-strong rounded-lg p-2 text-ink font-mono focus:border-brand outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-ink-soft mb-1 font-medium">GSTIN (Optional)</label>
                      <input
                        type="text"
                        value={gstin}
                        onChange={(e) => setGstin(e.target.value)}
                        placeholder="27AABCS1429B1Z8"
                        className="w-full bg-canvas border border-line-strong rounded-lg p-2 text-ink font-mono focus:border-brand outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-ink-soft mb-1 font-medium">Requested Plan Tier</label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setPlanTier("go")}
                        className={`p-2 rounded-lg border text-center transition-all ${
                          planTier === "go"
                            ? "border-brand bg-panel text-brand-soft font-bold shadow-xs"
                            : "border-line bg-canvas text-ink-soft hover:bg-canvas-sunken"
                        }`}
                      >
                        Deku GO (2 Seats)
                      </button>
                      <button
                        type="button"
                        onClick={() => setPlanTier("pro")}
                        className={`p-2 rounded-lg border text-center transition-all ${
                          planTier === "pro"
                            ? "border-brand bg-panel text-brand-soft font-bold shadow-xs"
                            : "border-line bg-canvas text-ink-soft hover:bg-canvas-sunken"
                        }`}
                      >
                        Deku PRO (5 Seats)
                      </button>
                      <button
                        type="button"
                        onClick={() => setPlanTier("enterprise")}
                        className={`p-2 rounded-lg border text-center transition-all ${
                          planTier === "enterprise"
                            ? "border-brand bg-panel text-brand-soft font-bold shadow-xs"
                            : "border-line bg-canvas text-ink-soft hover:bg-canvas-sunken"
                        }`}
                      >
                        Enterprise (20+ Seats)
                      </button>
                    </div>
                  </div>
                </div>

                {/* Condition 2: Commercial Proof Document */}
                <div className="p-3 rounded-lg border border-amber-300 bg-amber-50/50 space-y-2.5">
                  <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5" />
                    Condition 2: Commercial Document Proof
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-ink-soft mb-1 font-medium">Document Type *</label>
                      <select
                        value={proofType}
                        onChange={(e) => setProofType(e.target.value as any)}
                        className="w-full bg-surface border border-line-strong rounded-lg p-2 text-ink font-mono focus:border-brand outline-none"
                      >
                        <option value="invoice">Tax Invoice</option>
                        <option value="mou">Signed MoU</option>
                        <option value="quote">Accepted Quote</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-ink-soft mb-1 font-medium">Document # *</label>
                      <input
                        type="text"
                        required
                        value={proofDocNumber}
                        onChange={(e) => setProofDocNumber(e.target.value)}
                        placeholder="MHTECH-INV-2026-901"
                        className="w-full bg-surface border border-line-strong rounded-lg p-2 text-ink font-mono focus:border-brand outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-ink-soft mb-1 font-medium">Commercial Amount (₹)</label>
                      <input
                        type="number"
                        min="1"
                        value={proofAmount}
                        onChange={(e) => setProofAmount(Number(e.target.value))}
                        className="w-full bg-surface border border-line-strong rounded-lg p-2 text-ink font-mono focus:border-brand outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-ink-soft mb-1 font-medium">Attached PDF File Name *</label>
                    <input
                      type="text"
                      required
                      value={proofFileName}
                      onChange={(e) => setProofFileName(e.target.value)}
                      placeholder="Solar_Digital_Annual_Contract_Tax_Invoice.pdf"
                      className="w-full bg-surface border border-line-strong rounded-lg p-2 text-ink font-mono focus:border-brand outline-none"
                    />
                  </div>
                </div>

                <div className="pt-1">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-2.5 px-3 bg-brand hover:bg-brand-hover disabled:opacity-50 text-panel-deep font-bold rounded-lg text-xs transition-colors shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    {submitting ? "Uploading & Submitting..." : "Submit License Request to Deku Admin"}
                  </button>
                </div>
              </form>
            </div>

            {/* Footer */}
            <div className="px-3.5 py-1.5 bg-canvas border-t border-line flex items-center justify-between text-xs">
              <span className="text-[10px] font-mono text-ink-muted">Commercial Verification Required</span>
              <span className="text-[10px] font-mono text-brand-strong font-semibold">Dual-Gate Protocol</span>
            </div>
          </div>

          {/* Bento Right Card: Territory Inbound Leads & Active Clients */}
          <div className="min-w-0 bg-surface border border-edge rounded-xl shadow-md overflow-hidden flex flex-col justify-between">
            <div>
              {/* Header */}
              <div className="bg-panel px-3.5 py-1.5 border-b border-edge flex items-center justify-between text-white">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-brand" />
                  <span className="text-xs font-mono font-black tracking-wider uppercase">
                    Territory Leads &amp; Clients
                  </span>
                </div>
                <span className="text-[10px] font-mono text-emerald-400 font-bold">
                  {data?.leads.length ?? 0} Inbound
                </span>
              </div>

              {/* KPI highlight strip */}
              <div className="p-2.5 bg-canvas border-b border-line grid grid-cols-2 gap-2">
                <div className="p-2 rounded bg-surface border border-line">
                  <span className="text-[10px] font-mono text-ink-muted block uppercase">Active Workspaces</span>
                  <span className="text-base font-bold font-mono text-brand-strong">
                    {data?.clientLicenses.length ?? 0}
                  </span>
                </div>
                <div className="p-2 rounded bg-surface border border-line">
                  <span className="text-[10px] font-mono text-ink-muted block uppercase">Website Leads</span>
                  <span className="text-base font-bold font-mono text-amber-700">
                    {data?.leads.length ?? 0}
                  </span>
                </div>
              </div>

              {/* Leads list */}
              <div className="p-3 space-y-2.5 overflow-y-auto max-h-[600px]">
                <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-ink-soft">
                  Incoming Territory Inquiries
                </div>
                {data?.leads.length === 0 ? (
                  <div className="p-6 text-center text-xs text-ink-muted">No inbound leads waiting.</div>
                ) : (
                  data?.leads.map((lead) => (
                    <div
                      key={lead.id}
                      className="p-3 rounded-lg border border-line bg-surface hover:border-brand/40 transition-colors text-xs space-y-1.5 shadow-xs"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-bold text-ink">{lead.companyName}</div>
                          <div className="text-[11px] text-ink-muted font-mono">
                            {lead.clientName} • {lead.clientPhone}
                          </div>
                        </div>
                        <span className="text-[9px] font-mono bg-canvas-sunken border border-line px-1.5 py-0.2 rounded font-bold uppercase text-ink-soft">
                          {lead.status}
                        </span>
                      </div>

                      <div className="text-[10px] text-ink-soft flex items-center gap-1 font-mono">
                        <MapPin className="h-3 w-3 text-brand" />
                        {lead.city}, {lead.stateName} ({lead.pincode})
                      </div>

                      <div className="pt-1 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleUpdateLeadStatus(lead.id, "contacted")}
                          className="px-2 py-1 bg-canvas hover:bg-canvas-sunken border border-line text-[10px] rounded transition-colors text-ink-soft"
                        >
                          Mark Contacted
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateLeadStatus(lead.id, "setup_in_progress")}
                          className="px-2 py-1 bg-brand/10 hover:bg-brand/20 border border-brand/30 text-brand-strong font-bold text-[10px] rounded transition-colors"
                        >
                          In Setup
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-3.5 py-1.5 bg-canvas border-t border-line flex items-center justify-between text-xs">
              <span className="text-[10px] font-mono text-ink-muted">Regional Franchise SLA</span>
              <span className="text-[10px] font-mono text-brand-strong font-semibold">Territory Protected</span>
            </div>
          </div>
        </div>
      </main>

      {/* Modal: Allocate Extra Seats (Sub-Type B) */}
      {showSeatModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface border border-edge rounded-xl max-w-md w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-line pb-2.5">
              <h3 className="text-xs font-bold font-mono text-ink uppercase tracking-wider flex items-center gap-2">
                <Users className="h-4 w-4 text-brand" />
                Sub-Type B: Allocate Extra Seats
              </h3>
              <button onClick={() => setShowSeatModal(false)} className="text-ink-muted hover:text-ink text-sm">
                ✕
              </button>
            </div>
            <p className="text-xs text-ink-muted">
              Deducts directly from your seat quota ({data?.quota.allocatedSeatQuota} seats left). Visible in Deku Admin in real time.
            </p>
            <form onSubmit={handleProvisionSeats} className="space-y-3 text-xs">
              <div>
                <label className="block text-ink-soft mb-1 font-medium">Client Company Name</label>
                <input
                  type="text"
                  required
                  value={seatCompanyName}
                  onChange={(e) => setSeatCompanyName(e.target.value)}
                  placeholder="Solar Digital Technologies Pvt Ltd"
                  className="w-full bg-canvas border border-line-strong rounded-lg p-2 text-ink focus:border-brand outline-none"
                />
              </div>
              <div>
                <label className="block text-ink-soft mb-1 font-medium">Client Registered Email</label>
                <input
                  type="email"
                  required
                  value={seatClientEmail}
                  onChange={(e) => setSeatClientEmail(e.target.value)}
                  placeholder="ananya@solardigital.in"
                  className="w-full bg-canvas border border-line-strong rounded-lg p-2 text-ink font-mono focus:border-brand outline-none"
                />
              </div>
              <div>
                <label className="block text-ink-soft mb-1 font-medium">Seats to Allocate</label>
                <input
                  type="number"
                  min="1"
                  max={data?.quota.allocatedSeatQuota ?? 10}
                  value={seatCount}
                  onChange={(e) => setSeatCount(Number(e.target.value))}
                  className="w-full bg-canvas border border-line-strong rounded-lg p-2 text-ink font-mono focus:border-brand outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-line">
                <button
                  type="button"
                  onClick={() => setShowSeatModal(false)}
                  className="px-3 py-1.5 text-ink-muted hover:text-ink text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 bg-brand hover:bg-brand-hover text-panel-deep font-bold rounded-lg text-xs transition-colors shadow-xs"
                >
                  Allocate Seats
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Provision Service (Sub-Type C) */}
      {showServiceModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface border border-edge rounded-xl max-w-md w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-line pb-2.5">
              <h3 className="text-xs font-bold font-mono text-ink uppercase tracking-wider flex items-center gap-2">
                <Award className="h-4 w-4 text-amber-600" />
                Sub-Type C: Provision Implementation Service
              </h3>
              <button onClick={() => setShowServiceModal(false)} className="text-ink-muted hover:text-ink text-sm">
                ✕
              </button>
            </div>
            <p className="text-xs text-ink-muted">
              Log chartered accountant training, master setup, or Tally migration ({data?.quota.availableServiceCredits} credits available).
            </p>
            <form onSubmit={handleProvisionService} className="space-y-3 text-xs">
              <div>
                <label className="block text-ink-soft mb-1 font-medium">Client Company Name</label>
                <input
                  type="text"
                  required
                  value={svcCompanyName}
                  onChange={(e) => setSvcCompanyName(e.target.value)}
                  placeholder="PixelScale Studio LLP"
                  className="w-full bg-canvas border border-line-strong rounded-lg p-2 text-ink focus:border-brand outline-none"
                />
              </div>
              <div>
                <label className="block text-ink-soft mb-1 font-medium">Client Registered Email</label>
                <input
                  type="email"
                  required
                  value={svcClientEmail}
                  onChange={(e) => setSvcClientEmail(e.target.value)}
                  placeholder="deepak@pixelscale.co"
                  className="w-full bg-canvas border border-line-strong rounded-lg p-2 text-ink font-mono focus:border-brand outline-none"
                />
              </div>
              <div>
                <label className="block text-ink-soft mb-1 font-medium">Service Scope &amp; Deliverables</label>
                <input
                  type="text"
                  required
                  value={svcDescription}
                  onChange={(e) => setSvcDescription(e.target.value)}
                  className="w-full bg-canvas border border-line-strong rounded-lg p-2 text-ink focus:border-brand outline-none"
                />
              </div>
              <div>
                <label className="block text-ink-soft mb-1 font-medium">Credits to Deduct</label>
                <input
                  type="number"
                  min="1"
                  max={data?.quota.availableServiceCredits ?? 20}
                  value={svcCredits}
                  onChange={(e) => setSvcCredits(Number(e.target.value))}
                  className="w-full bg-canvas border border-line-strong rounded-lg p-2 text-ink font-mono focus:border-brand outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-line">
                <button
                  type="button"
                  onClick={() => setShowServiceModal(false)}
                  className="px-3 py-1.5 text-ink-muted hover:text-ink text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs transition-colors shadow-xs"
                >
                  Log Service Delivery
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Persistent Bottom Keyboard Shortcut Strip */}
      <footer className="bg-panel border-t border-edge text-[11px] font-mono px-4 py-1.5 flex items-center justify-between text-slate-300 shrink-0 select-none">
        <div className="flex items-center gap-3 overflow-x-auto">
          <button onClick={() => setActiveTab("new_request")} className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer">
            <span className="text-brand font-bold">F1:</span> License Request
          </button>
          <span className="text-slate-600">•</span>
          <button onClick={() => setActiveTab("leads")} className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer">
            <span className="text-brand font-bold">F2:</span> Inbound Leads
          </button>
          <span className="text-slate-600">•</span>
          <button onClick={() => setActiveTab("clients")} className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer">
            <span className="text-brand font-bold">F3:</span> Active Clients
          </button>
          <span className="text-slate-600">•</span>
          <button onClick={() => setActiveTab("add_ons")} className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer">
            <span className="text-brand font-bold">F4:</span> Add-On Desks
          </button>
        </div>
        <div className="hidden md:flex items-center gap-3 text-[10px] text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-brand animate-pulse" />
            Distributor Territory Active
          </span>
          <span className="text-slate-600">|</span>
          <span>{data?.distributor.companyName || "Regional Partner"}</span>
        </div>
      </footer>
    </div>
  );
}

