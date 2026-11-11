"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Building2,
  MapPin,
  Mail,
  Phone,
  User,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Sparkles,
} from "lucide-react";

const INDIAN_STATES = [
  { code: "27", name: "Maharashtra" },
  { code: "29", name: "Karnataka" },
  { code: "07", name: "Delhi" },
  { code: "24", name: "Gujarat" },
  { code: "33", name: "Tamil Nadu" },
  { code: "36", name: "Telangana" },
  { code: "06", name: "Haryana" },
  { code: "09", name: "Uttar Pradesh" },
  { code: "19", name: "West Bengal" },
  { code: "32", name: "Kerala" },
  { code: "08", name: "Rajasthan" },
  { code: "23", name: "Madhya Pradesh" },
  { code: "30", name: "Goa" },
  { code: "21", name: "Odisha" },
  { code: "03", name: "Punjab" },
  { code: "10", name: "Bihar" },
  { code: "37", name: "Andhra Pradesh" },
];

export default function RequestSetupPage() {
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [gstinOrPan, setGstinOrPan] = useState("");
  const [selectedState, setSelectedState] = useState(INDIAN_STATES[0]);
  const [city, setCity] = useState("");
  const [pincode, setPincode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const res = await fetch("/api/ecosystem/onboarding-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName,
          clientPhone,
          clientEmail,
          companyName,
          gstinOrPan,
          stateCode: selectedState.code,
          stateName: selectedState.name,
          city,
          pincode,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setResult(json.lead);
      } else {
        alert(json.error || "Failed to submit request");
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-teal-500/10 border border-teal-500/30 text-teal-400 mb-3 shadow-lg">
          <Building2 className="h-6 w-6" />
        </div>
        <h2 className="text-2xl font-black tracking-tight text-white">
          Request Business Setup
        </h2>
        <p className="mt-1.5 text-xs text-slate-400 max-w-sm mx-auto">
          Deku operates exclusively through authorized regional distributors. Submit your company location to connect with your territory partner.
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-lg">
        <div className="bg-slate-900 border border-slate-800 py-8 px-6 shadow-2xl rounded-2xl sm:px-10">
          {result ? (
            <div className="text-center space-y-4">
              <div className="h-12 w-12 bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Setup Request Registered!</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Your enterprise details have been routed to your authorized regional distributor:
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-left text-xs space-y-2">
                <div className="text-teal-400 font-bold text-sm">
                  {result.assignedDistributorName || "Regional FinTech Partner"}
                </div>
                <div className="text-slate-400">
                  Territory: <strong className="text-slate-200">{result.city}, {result.stateName} ({result.pincode})</strong>
                </div>
                <div className="text-slate-400">
                  Registered Entity: <strong className="text-slate-200">{result.companyName}</strong>
                </div>
                <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-800">
                  Your distributor will verify your commercial invoice/MoU and mint your official Activation License Key.
                </div>
              </div>

              <div className="pt-2">
                <Link
                  href="/login"
                  className="w-full inline-flex items-center justify-center py-2.5 px-4 bg-teal-500 hover:bg-teal-600 text-slate-950 font-bold text-xs rounded-lg transition-colors"
                >
                  Return to Platform Login <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              {/* Company Info */}
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Company / Organization Name *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="e.g. Apex Industrial Solutions Ltd"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-white focus:border-teal-400 outline-none"
                  />
                </div>
              </div>

              {/* Contact Person & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Contact Person Name *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                      <User className="h-4 w-4" />
                    </div>
                    <input
                      type="text"
                      required
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      placeholder="e.g. Rahul Sharma"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-white focus:border-teal-400 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Phone / Mobile *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                      <Phone className="h-4 w-4" />
                    </div>
                    <input
                      type="tel"
                      required
                      value={clientPhone}
                      onChange={(e) => setClientPhone(e.target.value)}
                      placeholder="+91 98200 12345"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-white font-mono focus:border-teal-400 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Email & GSTIN */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Work Email *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                      <Mail className="h-4 w-4" />
                    </div>
                    <input
                      type="email"
                      required
                      value={clientEmail}
                      onChange={(e) => setClientEmail(e.target.value)}
                      placeholder="owner@company.com"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-white font-mono focus:border-teal-400 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    GSTIN or PAN (Optional)
                  </label>
                  <input
                    type="text"
                    value={gstinOrPan}
                    onChange={(e) => setGstinOrPan(e.target.value)}
                    placeholder="27AAACS1234A1Z5"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:border-teal-400 outline-none"
                  />
                </div>
              </div>

              {/* Location Routing */}
              <div className="border-t border-slate-800 pt-3 space-y-3">
                <div className="text-[11px] font-mono text-teal-400 font-bold uppercase tracking-wider flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  Territory Distributor Routing
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">State *</label>
                    <select
                      value={selectedState.code}
                      onChange={(e) => {
                        const found = INDIAN_STATES.find((s) => s.code === e.target.value);
                        if (found) setSelectedState(found);
                      }}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-white focus:border-teal-400 outline-none"
                    >
                      {INDIAN_STATES.map((s) => (
                        <option key={s.code} value={s.code}>
                          {s.name} ({s.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-medium mb-1">City / Town *</label>
                    <input
                      type="text"
                      required
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="e.g. Pune"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-teal-400 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Pincode *</label>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      value={pincode}
                      onChange={(e) => setPincode(e.target.value)}
                      placeholder="411001"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:border-teal-400 outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 px-4 bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-slate-950 font-bold rounded-lg transition-colors shadow-lg"
                >
                  {submitting ? "Routing to Territory Partner..." : "Submit Setup Request"}
                </button>
              </div>

              <div className="text-center pt-2">
                <span className="text-slate-400 text-xs">Already have an Activation License? </span>
                <Link href="/login" className="text-teal-400 font-semibold hover:underline text-xs">
                  Sign in here
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

