"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Check,
  Zap,
  Sparkles,
  QrCode,
  Sliders,
  ShieldCheck,
  Building2,
  UserCheck,
  Clock,
  ArrowRight,
  HelpCircle,
} from "lucide-react";

export default function PricingPlansSection() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");

  const plans = [
    {
      id: "go",
      name: "GO",
      tagline: "Ideal for freelancers, solo studios, and early-stage businesses starting friction-free.",
      badge: "🎁 15-Day Free Trial Included",
      badgeColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      priceMonthly: 1499,
      priceAnnual: 1199, // ₹1,199/mo billed as ₹14,388/yr
      trialText: "15-day full free trial on signup • No credit card required",
      ctaText: "Start 15-Day Free Trial",
      ctaHref: "/signup?plan=go",
      isPopular: false,
      highlights: [
        "15-Day Free Trial with 100% full feature access",
        "Dual Mode: Pure Accounting (Sec 22 Exempt) or 1 GSTIN",
        "Dynamic Bharat UPI QR code directly in every invoice",
        "Standard Invoice Field Customization (PO, Delivery, Notes)",
        "Turnover Exemption Tracker (against ₹20L/₹40L threshold)",
        "Up to 150 invoices & bills / month",
        "ALERX 4-Tier Double-Entry General Ledger",
        "1 Admin + 1 Accountant seat",
      ],
    },
    {
      id: "pro",
      name: "PRO",
      tagline: "For high-volume B2B suppliers, e-commerce sellers, and multi-state growing enterprises.",
      badge: "⚡ Most Popular for Growth",
      badgeColor: "bg-[#5BB5BB]/15 text-[#91D7D2] border-[#5BB5BB]/30",
      priceMonthly: 4999,
      priceAnnual: 3999, // ₹3,999/mo billed as ₹47,988/yr
      trialText: "Designed for scaling compliance & unlimited volume",
      ctaText: "Get Started with PRO",
      ctaHref: "/signup?plan=pro",
      isPopular: true,
      highlights: [
        "Everything in GO, plus unlimited monthly invoices",
        "Advanced Invoice Field Customizer (E-Way, Batch, Serial No)",
        "Custom Logo, Branding & Stamp on Invoices",
        "Payment Gateway Webhooks + Instant UPI QR settlement",
        "Official GSTR-1 & GSTR-3B offline JSON exports for gst.gov.in",
        "Automated Input Tax Credit (ITC) reconciliation with GSTR-2B",
        "Marketplace Bulk Sync (Amazon, Flipkart, Meesho, Shopify)",
        "Unlimited team members with role-based RBAC access",
        "Priority VIP helpline & WhatsApp support (+91 7506461004)",
      ],
    },
  ];

  const featureBreakup = [
    {
      category: "Invoicing & Payment Collection",
      features: [
        {
          name: "Direct Payment QR on Invoices",
          description: "Embedded dynamic Bharat UPI QR code pre-filled with exact amount and invoice reference for instant scan-to-pay.",
          go: "Included (Standard UPI)",
          pro: "Advanced (UPI + Gateway Webhooks)",
        },
        {
          name: "Customizable Invoice Fields",
          description: "Add custom metadata such as PO Number, Vehicle/E-Way Bill No, Transporter ID, and custom terms.",
          go: "Standard Custom Fields (PO, Terms)",
          pro: "Full Field Customizer + Custom Line Attributes",
        },
        {
          name: "Custom Branding & Invoice Design",
          description: "Upload business logo, digital signature stamp, and choose high-DPI PDF invoice layouts.",
          go: "Basic Logo & Address",
          pro: "Full White-Label Branding & Colors",
        },
        {
          name: "Monthly Invoicing Volume",
          description: "Number of commercial bills of supply and GST tax invoices generated per month.",
          go: "Up to 150 bills / month",
          pro: "Unlimited bills / month",
        },
        {
          name: "MSME Collect (45-Day Rule)",
          description: "Automated WhatsApp payment reminders with direct UPI link for overdue invoices.",
          go: "Manual WhatsApp Send",
          pro: "Automated 45-day MSME Chase Schedules",
        },
      ],
    },
    {
      category: "GST & Statutory Compliance",
      features: [
        {
          name: "Section 22 Non-GST Mode",
          description: "Issue tax-exempt Bills of Supply under Section 22 of the CGST Act with zero GST filing hassle.",
          go: "✓ Full Support",
          pro: "✓ Full Support",
        },
        {
          name: "Turnover Exemption Tracker",
          description: "Real-time visual tracker monitoring your revenue against the ₹20L/₹40L registration threshold.",
          go: "✓ Included",
          pro: "✓ Included",
        },
        {
          name: "Official GSTN Offline JSON Export",
          description: "Download validated GSTR-1 and GSTR-3B offline JSON files ready to upload straight to gst.gov.in.",
          go: "Standard Tax Summary View",
          pro: "1-Click Direct GSTN Offline JSON",
        },
        {
          name: "Input Tax Credit (ITC) Matching",
          description: "Differentiate eligible vs Section 17(5) blocked credit and reconcile against GSTR-2B purchase logs.",
          go: "Basic Purchase Register",
          pro: "Automated GSTR-2B Matching & Rule 36(4)",
        },
        {
          name: "Marketplace Sales (Section 14 ECO)",
          description: "Categorize e-commerce sales from Amazon, Flipkart, Blinkit, and Meesho for separate Table 3.1.1 reporting.",
          go: "Manual entry",
          pro: "Automated Bulk Marketplace Sync",
        },
      ],
    },
    {
      category: "ALERX Double-Entry Engine & Governance",
      features: [
        {
          name: "ALERX 4-Tier Chart of Accounts",
          description: "Strict database trigger enforcement across Group ➔ Ledger ➔ Sub-Ledger ➔ Leaf Label.",
          go: "✓ Standard 25 GAAP Accounts",
          pro: "✓ Custom Hierarchy & Sub-Ledgers",
        },
        {
          name: "State Change Units Tracking",
          description: "Discrete tracking of transaction event counts (units) alongside net financial magnitude in INR.",
          go: "✓ Included",
          pro: "✓ Included",
        },
        {
          name: "Live Financial Statements",
          description: "Real-time Profit & Loss, Balance Sheet, and Trial Balance generated from verified ledger labels.",
          go: "✓ Real-time P&L & Balance Sheet",
          pro: "✓ Real-time P&L, BS & Detailed Audit",
        },
        {
          name: "User Seats & Access Control",
          description: "Grant secure access to internal team members, co-founders, and external chartered accountants.",
          go: "2 Seats (1 Admin + 1 Accountant)",
          pro: "Unlimited Seats with Custom RBAC",
        },
        {
          name: "Customer Support Helpline",
          description: "Direct assistance from our dedicated accounting & engineering support desk.",
          go: "Standard Email + Help Center",
          pro: "VIP Priority Helpline (+91 7506461004)",
        },
      ],
    },
  ];

  return (
    <section id="pricing" className="py-24 bg-white text-slate-900 border-b border-[#CBD5E1] scroll-mt-16 font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#1F2324] px-4 py-1.5 text-xs font-mono font-bold text-[#91D7D2] border border-[#3E4848] shadow-sm">
            <Sparkles className="h-3.5 w-3.5 text-[#5BB5BB]" />
            <span>Built for Indian Businesses • 100% Transparent</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-[#0A0A0A]">
            Simple Plans,{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#1F2324] via-[#2D7A7A] to-[#5BB5BB]">
              Transparent Pricing.
            </span>
          </h2>

          <p className="text-sm sm:text-base text-slate-600 max-w-xl mx-auto leading-relaxed">
            Start completely risk-free with a <strong>15-day free trial on GO</strong>. Upgrade to <strong>PRO</strong> when you need unlimited volume and automated GSTN filing.
          </p>

          {/* Billing Cycle Toggle */}
          <div className="pt-2 flex items-center justify-center gap-3">
            <span
              className={`text-xs font-semibold ${
                billingCycle === "monthly" ? "text-slate-950 font-bold" : "text-slate-500"
              }`}
            >
              Monthly Billing
            </span>
            <button
              type="button"
              onClick={() =>
                setBillingCycle(billingCycle === "monthly" ? "annual" : "monthly")
              }
              className="w-12 h-6 bg-[#1F2324] border border-[#3E4848] rounded-full p-1 transition-colors relative"
            >
              <div
                className={`w-4 h-4 rounded-full bg-[#5BB5BB] transition-transform ${
                  billingCycle === "annual" ? "translate-x-6" : "translate-x-0"
                }`}
              />
            </button>
            <span
              className={`text-xs font-semibold flex items-center gap-1.5 ${
                billingCycle === "annual" ? "text-slate-950 font-bold" : "text-slate-500"
              }`}
            >
              <span>Annual Billing</span>
              <span className="inline-block bg-[#5BB5BB]/15 text-[#1F2324] text-[10px] font-mono font-extrabold px-2 py-0.5 rounded-full border border-[#5BB5BB]/30">
                Save 20%
              </span>
            </span>
          </div>
        </div>

        {/* 2 Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto items-stretch">
          {plans.map((plan) => {
            const currentPrice =
              billingCycle === "annual" ? plan.priceAnnual : plan.priceMonthly;

            return (
              <div
                key={plan.id}
                className={`rounded-3xl p-8 flex flex-col justify-between transition-all relative ${
                  plan.isPopular
                    ? "bg-[#1F2324] text-white border-2 border-[#5BB5BB] shadow-2xl ring-4 ring-[#5BB5BB]/10"
                    : "bg-[#F8FAFC] text-slate-900 border border-slate-200 shadow-sm"
                }`}
              >
                {/* Free Trial / Popular Badge */}
                <div className="flex items-center justify-between gap-2 mb-4">
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${plan.badgeColor}`}
                  >
                    <Clock className="h-3 w-3" />
                    {plan.badge}
                  </span>
                  <span
                    className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                      plan.id === "go"
                        ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                        : "text-[#91D7D2] bg-[#5BB5BB]/10 border-[#5BB5BB]/30 font-mono"
                    }`}
                  >
                    {plan.id === "go" ? "Instant 60s Setup" : "Full Compliance Suite"}
                  </span>
                </div>

                {/* Plan Header */}
                <div className="space-y-3">
                  <h3 className="text-2xl font-black tracking-tight">{plan.name}</h3>
                  <p
                    className={`text-xs leading-relaxed ${
                      plan.isPopular ? "text-slate-300" : "text-slate-600"
                    }`}
                  >
                    {plan.tagline}
                  </p>

                  {/* Pricing Box */}
                  <div className="pt-2 flex items-baseline gap-1.5">
                    <span className="text-base font-bold">₹</span>
                    <span className="text-4xl font-black tracking-tight font-mono">
                      {currentPrice.toLocaleString("en-IN")}
                    </span>
                    <span
                      className={`text-xs font-medium ${
                        plan.isPopular ? "text-slate-300" : "text-slate-500"
                      }`}
                    >
                      / month {billingCycle === "annual" ? "(billed annually)" : ""}
                    </span>
                  </div>

                  <p
                    className={`text-[11px] font-medium pt-1 ${
                      plan.isPopular ? "text-[#91D7D2]" : "text-emerald-700"
                    }`}
                  >
                    {plan.trialText}
                  </p>
                </div>

                {/* Feature Highlights List */}
                <div className="py-8 space-y-3 flex-1">
                  <div
                    className={`text-xs font-mono font-bold uppercase tracking-wider ${
                      plan.isPopular ? "text-slate-400" : "text-slate-500"
                    }`}
                  >
                    Core Inclusions
                  </div>
                  <ul className="space-y-2.5 text-xs">
                    {plan.highlights.map((h, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <div
                          className={`h-4 w-4 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                            plan.isPopular
                              ? "bg-[#5BB5BB] text-[#0A0A0A] font-bold"
                              : "bg-emerald-500 text-white"
                          }`}
                        >
                          <Check className="h-2.5 w-2.5" />
                        </div>
                        <span
                          className={
                            plan.isPopular ? "text-slate-200" : "text-slate-700"
                          }
                        >
                          {h}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* CTA Button */}
                <div className="pt-4">
                  <Link
                    href={plan.ctaHref}
                    className={`w-full py-3.5 px-6 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-transform hover:scale-[1.02] active:scale-[0.98] shadow-md ${
                      plan.isPopular
                        ? "bg-[#5BB5BB] hover:bg-[#91D7D2] text-[#0A0A0A] shadow-[#5BB5BB]/20"
                        : "bg-[#1F2324] hover:bg-[#0A0A0A] text-white border border-[#3E4848]"
                    }`}
                  >
                    <span>{plan.ctaText}</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <p
                    className={`text-center text-[10px] mt-2.5 ${
                      plan.isPopular ? "text-slate-400" : "text-slate-500"
                    }`}
                  >
                    {plan.id === "go"
                      ? "Instant setup in 60s • Cancel anytime"
                      : "Dedicated onboarding assistance included"}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Detailed Plan Feature Breakup Table */}
        <div className="pt-10 space-y-6 max-w-5xl mx-auto">
          <div className="text-center space-y-2">
            <span className="text-xs font-mono font-bold uppercase tracking-widest text-[#3E4848]">
              Feature Matrix
            </span>
            <h3 className="text-2xl font-black text-slate-950">
              Detailed Feature Breakup: GO vs PRO
            </h3>
            <p className="text-xs text-slate-600 max-w-md mx-auto">
              Compare every capability side-by-side to choose the right fit for your operations.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-[#1F2324] text-white text-[11px] font-bold uppercase tracking-wider border-b border-[#3E4848]">
                    <th className="py-4 px-5 w-1/2">Capabilities & Modules</th>
                    <th className="py-4 px-5 text-center w-1/4 bg-[#181B1C]">
                      GO (₹1,499/mo)
                      <span className="block text-[10px] text-emerald-400 font-normal lowercase font-mono">
                        (15-day free trial)
                      </span>
                    </th>
                    <th className="py-4 px-5 text-center w-1/4 text-[#91D7D2] bg-[#0A0A0A] border-x border-[#3E4848]">
                      PRO (₹4,999/mo)
                      <span className="block text-[10px] text-slate-300 font-normal lowercase font-mono">
                        (unlimited scaling)
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {featureBreakup.map((cat, catIdx) => (
                    <React.Fragment key={catIdx}>
                      {/* Category Header Row */}
                      <tr className="bg-slate-100/90 font-bold text-slate-900">
                        <td colSpan={3} className="py-3 px-5 text-[11px] font-mono uppercase tracking-wider text-slate-700">
                          {cat.category}
                        </td>
                      </tr>

                      {/* Feature Item Rows */}
                      {cat.features.map((feat, fIdx) => (
                        <tr key={fIdx} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3.5 px-5">
                            <span className="font-bold text-slate-900 block">{feat.name}</span>
                            <span className="text-[11px] text-slate-500 block mt-0.5">{feat.description}</span>
                          </td>
                          <td className="py-3.5 px-5 text-center font-medium text-slate-700 bg-slate-50/50">
                            {feat.go}
                          </td>
                          <td className="py-3.5 px-5 text-center font-bold text-slate-950 bg-[#5BB5BB]/5 border-x border-slate-200">
                            {feat.pro}
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Bottom Support Callout inside Breakup */}
            <div className="p-4 bg-zinc-50 border-t border-zinc-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-600">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>
                  Both plans include 100% data privacy, append-only tamper-evident audit trail, and zero password sharing.
                </span>
              </div>
              <div className="text-zinc-500 text-[11px]">
                Questions about plans? Call helpline: <strong>+91 7506461004</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
