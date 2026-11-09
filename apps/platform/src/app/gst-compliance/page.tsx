"use client";

import React, { useState } from "react";
import Link from "next/link";
import LandingNavbar from "@/components/landing/LandingNavbar";
import LandingFooter from "@/components/landing/LandingFooter";
import {
  ShieldCheck,
  Zap,
  ArrowRight,
  CheckCircle2,
  Receipt,
  FileCode,
  Server,
  KeyRound,
  Lock,
} from "lucide-react";

export default function GstCompliancePage() {
  const [selectedScenario, setSelectedScenario] = useState<"intra" | "inter" | "exempt">("intra");

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col font-sans selection:bg-brand/30 selection:text-ink">
      <LandingNavbar />

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-16 lg:pt-20 lg:pb-24 border-b border-line-strong bg-gradient-to-b from-emerald-500/10 via-canvas to-white">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-60 pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-950 px-4 py-1.5 text-xs font-mono font-bold text-emerald-300 border border-emerald-800 shadow-sm">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            <span>Statutory India GST Engine &amp; GSP Roadmap</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-ink max-w-4xl mx-auto leading-tight">
            Native GST Architecture &amp;{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-800 via-teal-700 to-brand">
              Direct GSP Connectivity
            </span>
          </h1>

          <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-2xl mx-auto">
            From Section 22 CGST Act turnover exemptions to automated CGST/SGST/IGST splits, GSTR-1/3B offline JSON exports, and upcoming GSP API integration for live e-Invoicing.
          </p>

          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/gateway"
              className="inline-flex items-center gap-2 rounded-xl bg-brand hover:bg-brand-soft px-6 py-3 text-sm font-bold text-ink shadow-md shadow-brand/20 transition-all hover:scale-105 active:scale-95"
            >
              <Receipt className="h-4 w-4" />
              <span>Launch Invoicing Desk</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/learn"
              className="inline-flex items-center gap-2 rounded-xl bg-panel hover:bg-panel-deep border border-edge px-6 py-3 text-sm font-semibold text-white transition-all shadow-md"
            >
              <Zap className="h-4 w-4 text-brand" />
              <span>Learn GST Workflows in Public Tour</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Main Content Sections */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-20">
        {/* ========================================================================= */}
        {/* Section 1: Section 22 Exemption & Turnover Thresholds                    */}
        {/* ========================================================================= */}
        <section className="space-y-8">
          <div className="max-w-3xl">
            <span className="text-xs font-mono font-bold text-brand-strong uppercase tracking-wider">
              Statutory Thresholds
            </span>
            <h2 className="text-3xl font-black text-ink tracking-tight mt-1">
              Section 22 CGST Act: Know When to Register
            </h2>
            <p className="text-slate-600 text-sm mt-2 leading-relaxed">
              Under Indian GST law, businesses with annual aggregate turnover below statutory limits are legally exempt from registration. Deku lets you operate in Pure Accounting Mode without demanding a 15-digit GSTIN.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl border border-line-strong bg-surface space-y-3">
              <span className="text-xs font-mono font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200">
                Service Providers
              </span>
              <div className="text-3xl font-black text-ink">₹20 Lakhs</div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Threshold across standard states for professionals, consultants, software engineers, designers, and service businesses.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-line-strong bg-surface space-y-3">
              <span className="text-xs font-mono font-bold text-blue-800 bg-blue-50 px-2.5 py-1 rounded border border-blue-200">
                Goods Suppliers
              </span>
              <div className="text-3xl font-black text-ink">₹40 Lakhs</div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Standard threshold for physical goods traders and manufacturers in general category states (Notification No. 10/2019-Central Tax).
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-line-strong bg-surface space-y-3">
              <span className="text-xs font-mono font-bold text-purple-800 bg-purple-50 px-2.5 py-1 rounded border border-purple-200">
                Special Category States
              </span>
              <div className="text-3xl font-black text-ink">₹10 Lakhs</div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Applicable in special category states including Manipur, Mizoram, Nagaland, and Tripura under Section 22 proviso.
              </p>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* Section 2: Real-Time Tax Determination Matrix                            */}
        {/* ========================================================================= */}
        <section className="space-y-8">
          <div className="max-w-3xl">
            <span className="text-xs font-mono font-bold text-brand-strong uppercase tracking-wider">
              Real-Time Tax Engine
            </span>
            <h2 className="text-3xl font-black text-ink tracking-tight mt-1">
              Automated Intra-State vs. Inter-State Determination
            </h2>
            <p className="text-slate-600 text-sm mt-2 leading-relaxed">
              Deku compares your organization&apos;s registered state code with the customer&apos;s Place of Supply (POS) to split taxes with 100% mathematical accuracy.
            </p>
          </div>

          {/* Interactive Split Simulator */}
          <div className="p-6 rounded-2xl border border-line-strong bg-surface shadow-sm space-y-6">
            <div className="flex flex-wrap items-center gap-2 border-b border-line pb-4">
              <button
                onClick={() => setSelectedScenario("intra")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  selectedScenario === "intra"
                    ? "bg-panel text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:text-ink"
                }`}
              >
                Intra-State Supply (e.g. MH ➔ MH)
              </button>
              <button
                onClick={() => setSelectedScenario("inter")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  selectedScenario === "inter"
                    ? "bg-panel text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:text-ink"
                }`}
              >
                Inter-State Supply (e.g. MH ➔ KA)
              </button>
              <button
                onClick={() => setSelectedScenario("exempt")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  selectedScenario === "exempt"
                    ? "bg-panel text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:text-ink"
                }`}
              >
                Pure Accounting (Sec 22 Exempt)
              </button>
            </div>

            {selectedScenario === "intra" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="p-4 rounded-xl bg-canvas-sunken border border-line space-y-1">
                  <div className="text-ink-muted font-mono uppercase text-[10px]">Taxable Value</div>
                  <div className="text-xl font-black text-ink">₹1,00,000</div>
                  <div className="text-slate-500">HSN/SAC 9983 @ 18%</div>
                </div>
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-1">
                  <div className="text-emerald-800 font-mono uppercase text-[10px]">CGST (9%) + SGST (9%)</div>
                  <div className="text-xl font-black text-emerald-900">₹9,000 + ₹9,000</div>
                  <div className="text-emerald-700 font-mono">Central Tax + State Tax</div>
                </div>
                <div className="p-4 rounded-xl bg-panel text-white space-y-1">
                  <div className="text-brand font-mono uppercase text-[10px]">Total Invoice Value</div>
                  <div className="text-xl font-black text-white">₹1,18,000</div>
                  <div className="text-slate-400 font-mono">Ledger AR: ₹1,18,000</div>
                </div>
              </div>
            )}

            {selectedScenario === "inter" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="p-4 rounded-xl bg-canvas-sunken border border-line space-y-1">
                  <div className="text-ink-muted font-mono uppercase text-[10px]">Taxable Value</div>
                  <div className="text-xl font-black text-ink">₹1,00,000</div>
                  <div className="text-slate-500">HSN/SAC 9983 @ 18%</div>
                </div>
                <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 space-y-1">
                  <div className="text-blue-800 font-mono uppercase text-[10px]">IGST (18%)</div>
                  <div className="text-xl font-black text-blue-900">₹18,000</div>
                  <div className="text-blue-700 font-mono">Integrated Goods &amp; Services Tax</div>
                </div>
                <div className="p-4 rounded-xl bg-panel text-white space-y-1">
                  <div className="text-brand font-mono uppercase text-[10px]">Total Invoice Value</div>
                  <div className="text-xl font-black text-white">₹1,18,000</div>
                  <div className="text-slate-400 font-mono">Ledger AR: ₹1,18,000</div>
                </div>
              </div>
            )}

            {selectedScenario === "exempt" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="p-4 rounded-xl bg-canvas-sunken border border-line space-y-1">
                  <div className="text-ink-muted font-mono uppercase text-[10px]">Commercial Value</div>
                  <div className="text-xl font-black text-ink">₹1,00,000</div>
                  <div className="text-slate-500">Bill of Supply Format</div>
                </div>
                <div className="p-4 rounded-xl bg-slate-100 border border-slate-300 space-y-1">
                  <div className="text-slate-700 font-mono uppercase text-[10px]">Taxes Applied</div>
                  <div className="text-xl font-black text-slate-800">₹0.00</div>
                  <div className="text-slate-600 font-mono">Section 22 Exemption Active</div>
                </div>
                <div className="p-4 rounded-xl bg-panel text-white space-y-1">
                  <div className="text-brand font-mono uppercase text-[10px]">Total Bill Amount</div>
                  <div className="text-xl font-black text-white">₹1,00,000</div>
                  <div className="text-slate-400 font-mono">Zero GST Lines Generated</div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ========================================================================= */}
        {/* Section 3: GSP (GST Suvidha Provider) Service Provider API Integration  */}
        {/* ========================================================================= */}
        <section className="space-y-8 bg-panel text-white p-8 rounded-3xl border border-edge">
          <div className="max-w-3xl space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-brand/20 px-3 py-1 text-xs font-mono font-bold text-brand">
              <Server className="h-3.5 w-3.5" />
              <span>GSP SERVICE PROVIDER SETUP</span>
            </div>
            <h2 className="text-3xl font-black text-white tracking-tight">
              Connect Your GSP Service Provider API to Deku
            </h2>
            <p className="text-slate-300 text-sm leading-relaxed">
              We cannot file live GST returns directly onto the government portal using scrapers or insecure password sharing. Instead, Deku integrates with licensed <strong>GST Suvidha Providers (GSPs)</strong>. You simply connect your GSP account, and Deku handles the rest.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
            <div className="p-5 rounded-2xl bg-panel-raised border border-edge space-y-3">
              <div className="h-8 w-8 rounded-lg bg-brand/20 text-brand flex items-center justify-center font-bold">
                <KeyRound className="h-4 w-4" />
              </div>
              <h4 className="font-bold text-white text-sm">1. Bring Your Own GSP Credentials</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Connect API keys from authorized providers such as <strong>NIC e-Way Bill</strong>, <strong>Cygnet</strong>, <strong>Masters India</strong>, <strong>Clear</strong>, or <strong>IRIS</strong>.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-panel-raised border border-edge space-y-3">
              <div className="h-8 w-8 rounded-lg bg-brand/20 text-brand flex items-center justify-center font-bold">
                <FileCode className="h-4 w-4" />
              </div>
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-white text-sm">2. Live e-Invoicing (IRN) Flow</h4>
                <span className="text-[9px] font-mono font-bold bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded border border-amber-400/30">
                  Target Architecture
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Once your GSP provider credentials are configured, posting an F8 Sales Voucher will transmit the compliant JSON to your GSP, retrieve the 64-character Invoice Reference Number (IRN), and print the government-signed QR code.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-panel-raised border border-edge space-y-3">
              <div className="h-8 w-8 rounded-lg bg-brand/20 text-brand flex items-center justify-center font-bold">
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <h4 className="font-bold text-white text-sm">3. Zero Double Data Entry</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                e-Way Bills Part-A and Part-B are created simultaneously from the same voucher without having to log in to external government portals.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-panel-deep border border-edge flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-slate-400">
            <span className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>GSP API tokens will be stored encrypted in PostgreSQL using AES-256 GCM authenticated encryption.</span>
            </span>
            <span className="font-mono text-[11px] text-amber-300 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-800 shrink-0">
              Current Status: Offline JSON Active • Live GSP Seam in Development
            </span>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* Section 4: Returns Exporters (GSTR-1, GSTR-3B)                            */}
        {/* ========================================================================= */}
        <section className="space-y-8">
          <div className="max-w-3xl">
            <span className="text-xs font-mono font-bold text-brand-strong uppercase tracking-wider">
              Statutory Exporters
            </span>
            <h2 className="text-3xl font-black text-ink tracking-tight mt-1">
              GSTR-1 &amp; GSTR-3B Offline JSON Generators
            </h2>
            <p className="text-slate-600 text-sm mt-2 leading-relaxed">
              If you prefer filing manually on the official government portal, Deku generates 100% compliant JSON files that match the exact offline schema required by gst.gov.in.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="p-6 rounded-2xl border border-line-strong bg-surface space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-ink text-lg">GSTR-1: Outward Supplies</h4>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                  Ready
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Compiles all issued sales invoices, credit notes, debit notes, and export supplies into the government offline JSON format:
              </p>
              <ul className="space-y-2 text-xs text-slate-700">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>Table 4: B2B Invoices with recipient GSTIN and POS.</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>Table 5 &amp; 7: B2C Large &amp; B2C Small supplies.</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>Table 12: HSN/SAC summary with unique quantities &amp; tax rates.</span>
                </li>
              </ul>
            </div>

            <div className="p-6 rounded-2xl border border-line-strong bg-surface space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-ink text-lg">GSTR-3B: Monthly Summary</h4>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                  Ready
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Aggregates taxable turnover, tax liability, and Input Tax Credit (ITC) from posted purchase bills:
              </p>
              <ul className="space-y-2 text-xs text-slate-700">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>Table 3.1: Tax on outward and reverse charge inward supplies.</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>Table 4: Eligible Input Tax Credit (ITC) breakdown.</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>Net tax payable computation with instant CSV/JSON download.</span>
                </li>
              </ul>
            </div>
          </div>
        </section>
      </div>

      {/* CTA Footer */}
      <section className="bg-canvas-sunken border-t border-line-strong py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
          <h3 className="text-2xl font-bold text-ink">Ready to explore Deku’s GST Invoicing?</h3>
          <p className="text-slate-600 text-xs max-w-lg mx-auto">
            Test creating sample GST invoices in the public learn sandbox without an account or login.
          </p>
          <div className="pt-2 flex justify-center gap-3">
            <Link
              href="/learn"
              className="inline-flex items-center gap-2 rounded-xl bg-brand hover:bg-brand-soft px-6 py-2.5 text-xs font-bold text-ink shadow-sm transition-all"
            >
              <span>Explore Public Learn Centre</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}

