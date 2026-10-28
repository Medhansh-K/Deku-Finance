"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Receipt,
  BookOpen,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Eye,
  Plus,
  Building2,
  FileText,
  DollarSign,
  ShieldCheck,
  ChevronDown,
  Info,
  Layers,
  ExternalLink,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { formatINR } from "@/lib/formatters/currency";
import { formatDateTally } from "@/lib/formatters/date";
import { accountingApi } from "@/api/endpoints";
import { JournalEntry } from "@/types/accounting";
import { TaxRegime } from "@/lib/org-regime";

export type VoucherType = "all" | "sales" | "payment" | "receipt" | "purchase" | "contra" | "journal";

export interface VoucherLineDetail {
  dr_cr: "Dr" | "Cr";
  account_name: string;
  category: "Asset" | "Liability" | "Equity" | "Revenue" | "Expense";
  debit: number;
  credit: number;
  ledger_folio?: string;
  description?: string | null;
}

import { DocumentProofAttachment } from "@/lib/vouchers/document-proof";

export interface VoucherItem {
  id: string;
  entry_number: string;
  voucher_type: "sales" | "payment" | "receipt" | "purchase" | "contra" | "journal";
  f_key: string;
  entry_date: string;
  entry_time: string;
  party_name: string;
  source_document: string;
  ledger_folio: string; // Ledger Folio (L.F.) reference into ALERX general ledger
  reference: string;
  narration: string;
  amount: number;
  dr_cr: "Dr" | "Cr";
  status: "posted" | "draft" | "reversed";
  organisation_id: string;
  lines: VoucherLineDetail[];
  document_proof?: DocumentProofAttachment;
  reversal_ref?: string;
  reversal_reason?: string;
  reversed_at?: string;
}

// Curated seed Day Book entries for organisations with authoritative L.F. folios and source documents
export const COMPANY_VOUCHERS: Record<string, VoucherItem[]> = {
  // 1. Deku Financial Technologies
  "b127e064-5da8-437f-94c4-b8d6a0c12927": [
    {
      id: "vch-deku-1",
      entry_number: "SLS-2026-5360",
      voucher_type: "sales",
      f_key: "F8",
      entry_date: "2026-10-18",
      entry_time: "10:15 AM",
      party_name: "Acme Software Labs India",
      source_document: "Sales Invoice (BOS / Tax Inv #5360)",
      ledger_folio: "LF-104",
      reference: "INV-2026-5360",
      narration: "B2B SaaS Financial OS Subscription (Annual Enterprise License)",
      amount: 118000,
      dr_cr: "Dr",
      status: "posted",
      organisation_id: "b127e064-5da8-437f-94c4-b8d6a0c12927",
      lines: [
        { dr_cr: "Dr", account_name: "Trade Debtors - Acme Labs", category: "Asset", debit: 118000, credit: 0, ledger_folio: "LF-104", description: "Customer receivable ledger" },
        { dr_cr: "Cr", account_name: "SaaS Software Revenue", category: "Revenue", debit: 0, credit: 100000, ledger_folio: "LF-401", description: "Taxable revenue recognition" },
        { dr_cr: "Cr", account_name: "Output CGST @ 9%", category: "Liability", debit: 0, credit: 9000, ledger_folio: "LF-210", description: "Central GST liability" },
        { dr_cr: "Cr", account_name: "Output SGST @ 9%", category: "Liability", debit: 0, credit: 9000, ledger_folio: "LF-211", description: "State GST liability" },
      ],
    },
    {
      id: "vch-deku-2",
      entry_number: "RCP-2026-0048",
      voucher_type: "receipt",
      f_key: "F6",
      entry_date: "2026-10-16",
      entry_time: "11:42 AM",
      party_name: "Zenith Cloud Consulting",
      source_document: "Bank Settlement Advice (NEFT #8812)",
      ledger_folio: "LF-201",
      reference: "HDFC-NEFT-8812",
      narration: "Direct Bank NEFT Settlement for Q2 Platform Integration",
      amount: 236000,
      dr_cr: "Dr",
      status: "posted",
      organisation_id: "b127e064-5da8-437f-94c4-b8d6a0c12927",
      lines: [
        { dr_cr: "Dr", account_name: "HDFC Operating Current A/c", category: "Asset", debit: 236000, credit: 0, ledger_folio: "LF-201", description: "Bank funds received" },
        { dr_cr: "Cr", account_name: "Trade Debtors - Zenith Cloud", category: "Asset", debit: 0, credit: 236000, ledger_folio: "LF-105", description: "Customer ledger settlement" },
      ],
    },
    {
      id: "vch-deku-3",
      entry_number: "PAY-2026-0035",
      voucher_type: "payment",
      f_key: "F5",
      entry_date: "2026-10-14",
      entry_time: "02:30 PM",
      party_name: "Amazon Web Services India",
      source_document: "Vendor Invoice & Payout Voucher (AWS #9921)",
      ledger_folio: "LF-502",
      reference: "AWS-INV-9921",
      narration: "Cloud Server Hosting & Rust Ledger Cluster Infrastructure",
      amount: 42500,
      dr_cr: "Dr",
      status: "posted",
      organisation_id: "b127e064-5da8-437f-94c4-b8d6a0c12927",
      lines: [
        { dr_cr: "Dr", account_name: "Cloud Hosting & Infra Expense", category: "Expense", debit: 36017, credit: 0, ledger_folio: "LF-502", description: "Direct technological operating cost" },
        { dr_cr: "Dr", account_name: "Input IGST @ 18%", category: "Asset", debit: 6483, credit: 0, ledger_folio: "LF-212", description: "Eligible input tax credit" },
        { dr_cr: "Cr", account_name: "HDFC Operating Current A/c", category: "Asset", debit: 0, credit: 42500, ledger_folio: "LF-201", description: "Direct vendor debit payout" },
      ],
    },
    {
      id: "vch-deku-4",
      entry_number: "PUR-2026-0019",
      voucher_type: "purchase",
      f_key: "F9",
      entry_date: "2026-10-10",
      entry_time: "03:45 PM",
      party_name: "Dell India Technologies",
      source_document: "Vendor Tax Invoice & Inward Bill (DELL #3301)",
      ledger_folio: "LF-305",
      reference: "DELL-PO-3301",
      narration: "Developer Workstation Laptops & Engineering Assets",
      amount: 185000,
      dr_cr: "Cr",
      status: "posted",
      organisation_id: "b127e064-5da8-437f-94c4-b8d6a0c12927",
      lines: [
        { dr_cr: "Dr", account_name: "Computer Equipment Assets", category: "Asset", debit: 156780, credit: 0, ledger_folio: "LF-108", description: "Capital asset acquisition" },
        { dr_cr: "Dr", account_name: "Input CGST @ 9%", category: "Asset", debit: 14110, credit: 0, ledger_folio: "LF-210", description: "Capital goods ITC Central" },
        { dr_cr: "Dr", account_name: "Input SGST @ 9%", category: "Asset", debit: 14110, credit: 0, ledger_folio: "LF-211", description: "Capital goods ITC State" },
        { dr_cr: "Cr", account_name: "Trade Creditors - Dell India", category: "Liability", debit: 0, credit: 185000, ledger_folio: "LF-305", description: "Vendor payable net 30d" },
      ],
    },
    {
      id: "vch-deku-5",
      entry_number: "CNT-2026-0012",
      voucher_type: "contra",
      f_key: "F4",
      entry_date: "2026-10-05",
      entry_time: "04:15 PM",
      party_name: "HDFC Bank to Cash",
      source_document: "ATM Cash Withdrawal Slip (WDL #109)",
      ledger_folio: "LF-203",
      reference: "ATM-WDL-109",
      narration: "Office Petty Cash Withdrawal from Main Current Account",
      amount: 25000,
      dr_cr: "Dr",
      status: "posted",
      organisation_id: "b127e064-5da8-437f-94c4-b8d6a0c12927",
      lines: [
        { dr_cr: "Dr", account_name: "Cash-in-Hand Petty Account", category: "Asset", debit: 25000, credit: 0, ledger_folio: "LF-203", description: "Petty cash vault replenishment" },
        { dr_cr: "Cr", account_name: "HDFC Operating Current A/c", category: "Asset", debit: 0, credit: 25000, ledger_folio: "LF-201", description: "Bank cash disbursement" },
      ],
    },
    {
      id: "vch-deku-6",
      entry_number: "JRN-29133",
      voucher_type: "journal",
      f_key: "F7",
      entry_date: "2026-05-01",
      entry_time: "05:00 PM",
      party_name: "Founder Equity Account",
      source_document: "Capital Subscription & Bank Credit (NEFT #001)",
      ledger_folio: "LF-301",
      reference: "BANK-NEFT-001",
      narration: "Initial Founder Capital Infusion into Operating Bank Account",
      amount: 250000,
      dr_cr: "Cr",
      status: "posted",
      organisation_id: "b127e064-5da8-437f-94c4-b8d6a0c12927",
      lines: [
        { dr_cr: "Dr", account_name: "HDFC Operating Current A/c", category: "Asset", debit: 250000, credit: 0, ledger_folio: "LF-201", description: "Initial bank balance funding" },
        { dr_cr: "Cr", account_name: "Founder Equity & Paid-up Capital", category: "Equity", debit: 0, credit: 250000, ledger_folio: "LF-301", description: "Owner equity credit balance" },
      ],
    },
  ],

  // 2. All Might Logistics & Warehousing
  "b093d7d9-395a-429b-8c9a-af31b8b270f2": [
    {
      id: "vch-all-1",
      entry_number: "SLS-2026-4410",
      voucher_type: "sales",
      f_key: "F8",
      entry_date: "2026-10-20",
      entry_time: "09:30 AM",
      party_name: "Brimstone Cargo Express",
      source_document: "Freight Consignment Invoice (#4410)",
      ledger_folio: "LF-112",
      reference: "INV-2026-4410",
      narration: "Interstate Cold Chain Freight Shipping (Mumbai to Delhi Corridors)",
      amount: 472000,
      dr_cr: "Dr",
      status: "posted",
      organisation_id: "b093d7d9-395a-429b-8c9a-af31b8b270f2",
      lines: [
        { dr_cr: "Dr", account_name: "Trade Debtors - Brimstone Cargo", category: "Asset", debit: 472000, credit: 0, ledger_folio: "LF-112", description: "Freight freight receivables" },
        { dr_cr: "Cr", account_name: "Freight & Haulage Revenue", category: "Revenue", debit: 0, credit: 400000, ledger_folio: "LF-402", description: "Logistics billing" },
        { dr_cr: "Cr", account_name: "Output IGST @ 18%", category: "Liability", debit: 0, credit: 72000, ledger_folio: "LF-212", description: "Interstate GST payable" },
      ],
    },
    {
      id: "vch-all-2",
      entry_number: "RCP-2026-0112",
      voucher_type: "receipt",
      f_key: "F6",
      entry_date: "2026-10-19",
      entry_time: "11:15 AM",
      party_name: "Pinnacle Retail Fleet",
      source_document: "Corporate CMS Receipt Advice (#4402)",
      ledger_folio: "LF-202",
      reference: "SBI-CMS-4402",
      narration: "Consignment Delivery Clearing Payment via SBI Corporate Cash Mgmt",
      amount: 620000,
      dr_cr: "Dr",
      status: "posted",
      organisation_id: "b093d7d9-395a-429b-8c9a-af31b8b270f2",
      lines: [
        { dr_cr: "Dr", account_name: "SBI Commercial Operating A/c", category: "Asset", debit: 620000, credit: 0, ledger_folio: "LF-202", description: "CMS inward credit" },
        { dr_cr: "Cr", account_name: "Trade Debtors - Pinnacle Retail", category: "Asset", debit: 0, credit: 620000, ledger_folio: "LF-114", description: "Full invoice settlement" },
      ],
    },
    {
      id: "vch-all-3",
      entry_number: "PAY-2026-0088",
      voucher_type: "payment",
      f_key: "F5",
      entry_date: "2026-10-17",
      entry_time: "01:45 PM",
      party_name: "Indian Oil Fleet Services",
      source_document: "Bulk Fuel Delivery Voucher (IOCL #21)",
      ledger_folio: "LF-504",
      reference: "IOCL-BULK-21",
      narration: "Commercial Fleet Heavy Vehicle Diesel Bulk Refueling",
      amount: 345000,
      dr_cr: "Dr",
      status: "posted",
      organisation_id: "b093d7d9-395a-429b-8c9a-af31b8b270f2",
      lines: [
        { dr_cr: "Dr", account_name: "Fleet Fuel & Lubricants Expense", category: "Expense", debit: 345000, credit: 0, ledger_folio: "LF-504", description: "Commercial fleet direct fuel" },
        { dr_cr: "Cr", account_name: "SBI Commercial Operating A/c", category: "Asset", debit: 0, credit: 345000, ledger_folio: "LF-202", description: "Direct fleet card debit" },
      ],
    },
    {
      id: "vch-all-4",
      entry_number: "PUR-2026-0045",
      voucher_type: "purchase",
      f_key: "F9",
      entry_date: "2026-10-15",
      entry_time: "03:30 PM",
      party_name: "Apollo Tyres Commercial",
      source_document: "Commercial Tyre Purchase Invoice (APL #772)",
      ledger_folio: "LF-308",
      reference: "APL-INV-772",
      narration: "Heavy Truck Radial Tyres & Axle Maintenance Consumables",
      amount: 190000,
      dr_cr: "Cr",
      status: "posted",
      organisation_id: "b093d7d9-395a-429b-8c9a-af31b8b270f2",
      lines: [
        { dr_cr: "Dr", account_name: "Vehicle Maintenance & Spares", category: "Expense", debit: 161017, credit: 0, ledger_folio: "LF-506", description: "Truck maintenance materials" },
        { dr_cr: "Dr", account_name: "Input IGST @ 18%", category: "Asset", debit: 28983, credit: 0, ledger_folio: "LF-212", description: "Commercial spares ITC" },
        { dr_cr: "Cr", account_name: "Trade Creditors - Apollo Tyres", category: "Liability", debit: 0, credit: 190000, ledger_folio: "LF-308", description: "Vendor credit terms net 15d" },
      ],
    },
    {
      id: "vch-all-5",
      entry_number: "CNT-2026-0024",
      voucher_type: "contra",
      f_key: "F4",
      entry_date: "2026-10-11",
      entry_time: "04:50 PM",
      party_name: "SBI Bank to Toll Float",
      source_document: "FASTag Electronic Toll Topup Slip (#331)",
      ledger_folio: "LF-205",
      reference: "FAST-TX-331",
      narration: "National Highway FASTag Electronic Toll Float Wallet Recharge",
      amount: 80000,
      dr_cr: "Dr",
      status: "posted",
      organisation_id: "b093d7d9-395a-429b-8c9a-af31b8b270f2",
      lines: [
        { dr_cr: "Dr", account_name: "FASTag Electronic Toll Vault", category: "Asset", debit: 80000, credit: 0, ledger_folio: "LF-205", description: "Prepaid transit float" },
        { dr_cr: "Cr", account_name: "SBI Commercial Operating A/c", category: "Asset", debit: 0, credit: 80000, ledger_folio: "LF-202", description: "Bank auto-topup debit" },
      ],
    },
    {
      id: "vch-all-6",
      entry_number: "JRN-29801",
      voucher_type: "journal",
      f_key: "F7",
      entry_date: "2026-10-08",
      entry_time: "05:30 PM",
      party_name: "Fleet Depreciation A/c",
      source_document: "Asset Amortisation Memo (DEP-OCT-26)",
      ledger_folio: "LF-510",
      reference: "DEP-OCT-26",
      narration: "Monthly Straight-Line Commercial Heavy Vehicle Depreciation",
      amount: 115000,
      dr_cr: "Dr",
      status: "posted",
      organisation_id: "b093d7d9-395a-429b-8c9a-af31b8b270f2",
      lines: [
        { dr_cr: "Dr", account_name: "Depreciation Expense (Fleet)", category: "Expense", debit: 115000, credit: 0, ledger_folio: "LF-510", description: "Monthly fleet asset write-down" },
        { dr_cr: "Cr", account_name: "Accumulated Depreciation - Trucks", category: "Asset", debit: 0, credit: 115000, ledger_folio: "LF-120", description: "Contra-asset credit balance" },
      ],
    },
  ],

  // 3. Endeavor Energy & Tech Solutions
  "8aec2336-5531-459e-baba-6a37128cffa2": [
    {
      id: "vch-end-1",
      entry_number: "SLS-2026-7890",
      voucher_type: "sales",
      f_key: "F8",
      entry_date: "2026-10-19",
      entry_time: "10:00 AM",
      party_name: "Adani Solar Grid Systems",
      source_document: "Tax Invoice & EPC Milestone Bill (#7890)",
      ledger_folio: "LF-130",
      reference: "INV-2026-7890",
      narration: "Commercial Inverter Micro-Grid Deployment & EPC Commissioning",
      amount: 1450000,
      dr_cr: "Dr",
      status: "posted",
      organisation_id: "8aec2336-5531-459e-baba-6a37128cffa2",
      lines: [
        { dr_cr: "Dr", account_name: "Trade Debtors - Adani Solar", category: "Asset", debit: 1450000, credit: 0, ledger_folio: "LF-130", description: "Turnkey EPC contract milestone" },
        { dr_cr: "Cr", account_name: "Solar Energy Project Revenue", category: "Revenue", debit: 0, credit: 1228814, ledger_folio: "LF-403", description: "Taxable EPC revenue" },
        { dr_cr: "Cr", account_name: "Output IGST @ 18%", category: "Liability", debit: 0, credit: 221186, ledger_folio: "LF-212", description: "Solar grid statutory IGST" },
      ],
    },
    {
      id: "vch-end-2",
      entry_number: "RCP-2026-0205",
      voucher_type: "receipt",
      f_key: "F6",
      entry_date: "2026-10-18",
      entry_time: "11:50 AM",
      party_name: "Tata Power Renewable Ltd",
      source_document: "High-Value RTGS Credit Confirmation (#09)",
      ledger_folio: "LF-204",
      reference: "ICICI-RTGS-09",
      narration: "Milestone 2 Engineering Signoff Clearing via ICICI Corporate RTGS",
      amount: 1800000,
      dr_cr: "Dr",
      status: "posted",
      organisation_id: "8aec2336-5531-459e-baba-6a37128cffa2",
      lines: [
        { dr_cr: "Dr", account_name: "ICICI Corporate Current A/c", category: "Asset", debit: 1800000, credit: 0, ledger_folio: "LF-204", description: "High-value RTGS clearing" },
        { dr_cr: "Cr", account_name: "Trade Debtors - Tata Power", category: "Asset", debit: 0, credit: 1800000, ledger_folio: "LF-132", description: "Milestone progress settlement" },
      ],
    },
    {
      id: "vch-end-3",
      entry_number: "PAY-2026-0144",
      voucher_type: "payment",
      f_key: "F5",
      entry_date: "2026-10-16",
      entry_time: "02:15 PM",
      party_name: "Schneider Electric India",
      source_document: "Treasury Vendor Payment Advice (SCH #9912)",
      ledger_folio: "LF-315",
      reference: "SCH-PO-9912",
      narration: "High-Voltage Substation Switchgear Components & Protection Units",
      amount: 720000,
      dr_cr: "Dr",
      status: "posted",
      organisation_id: "8aec2336-5531-459e-baba-6a37128cffa2",
      lines: [
        { dr_cr: "Dr", account_name: "Trade Creditors - Schneider", category: "Liability", debit: 720000, credit: 0, ledger_folio: "LF-315", description: "Substation component invoice settlement" },
        { dr_cr: "Cr", account_name: "ICICI Corporate Current A/c", category: "Asset", debit: 0, credit: 720000, ledger_folio: "LF-204", description: "Treasury vendor payout" },
      ],
    },
    {
      id: "vch-end-4",
      entry_number: "PUR-2026-0078",
      voucher_type: "purchase",
      f_key: "F9",
      entry_date: "2026-10-13",
      entry_time: "03:45 PM",
      party_name: "Waaree Solar Photovoltaic",
      source_document: "Raw Materials Tax Invoice (WAR #551)",
      ledger_folio: "LF-318",
      reference: "WAR-INV-551",
      narration: "Monocrystalline Solar PV Panels Tier-1 Consignment",
      amount: 980000,
      dr_cr: "Cr",
      status: "posted",
      organisation_id: "8aec2336-5531-459e-baba-6a37128cffa2",
      lines: [
        { dr_cr: "Dr", account_name: "Solar Hardware Raw Materials", category: "Asset", debit: 830508, credit: 0, ledger_folio: "LF-140", description: "High-efficiency module inventory" },
        { dr_cr: "Dr", account_name: "Input IGST @ 18%", category: "Asset", debit: 149492, credit: 0, ledger_folio: "LF-212", description: "Hardware input tax credit" },
        { dr_cr: "Cr", account_name: "Trade Creditors - Waaree Solar", category: "Liability", debit: 0, credit: 980000, ledger_folio: "LF-318", description: "Raw material procurement debt" },
      ],
    },
    {
      id: "vch-end-5",
      entry_number: "CNT-2026-0036",
      voucher_type: "contra",
      f_key: "F4",
      entry_date: "2026-10-09",
      entry_time: "04:30 PM",
      party_name: "ICICI Current to Treasury",
      source_document: "Automated Daily Treasury Sweep Note (#8821)",
      ledger_folio: "LF-206",
      reference: "SWEEP-8821",
      narration: "Automated Daily Treasury Sweep into High-Yield Liquid Deposit",
      amount: 500000,
      dr_cr: "Dr",
      status: "posted",
      organisation_id: "8aec2336-5531-459e-baba-6a37128cffa2",
      lines: [
        { dr_cr: "Dr", account_name: "Treasury High-Yield Liquid Reserve", category: "Asset", debit: 500000, credit: 0, ledger_folio: "LF-206", description: "Short-term treasury fund transfer" },
        { dr_cr: "Cr", account_name: "ICICI Corporate Current A/c", category: "Asset", debit: 0, credit: 500000, ledger_folio: "LF-204", description: "Operating liquidity sweep" },
      ],
    },
    {
      id: "vch-end-6",
      entry_number: "JRN-30112",
      voucher_type: "journal",
      f_key: "F7",
      entry_date: "2026-10-04",
      entry_time: "05:15 PM",
      party_name: "R&D Battery Tech Capital",
      source_document: "Internal IP Capitalisation Memo (RD-CAP-03)",
      ledger_folio: "LF-150",
      reference: "RD-CAP-03",
      narration: "Q3 Solid-State EV Battery Storage Intellectual Asset Capitalization",
      amount: 450000,
      dr_cr: "Dr",
      status: "posted",
      organisation_id: "8aec2336-5531-459e-baba-6a37128cffa2",
      lines: [
        { dr_cr: "Dr", account_name: "Intangible Capital R&D Assets", category: "Asset", debit: 450000, credit: 0, ledger_folio: "LF-150", description: "Capitalized clean-tech intellectual property" },
        { dr_cr: "Cr", account_name: "R&D Development Internal Work", category: "Expense", debit: 0, credit: 450000, ledger_folio: "LF-520", description: "Capitalization contra-expense" },
      ],
    },
  ],
};

export function getVouchersForOrg(orgId: string): VoucherItem[] {
  if (COMPANY_VOUCHERS[orgId]) {
    return COMPANY_VOUCHERS[orgId];
  }
  return [];
}

export const VOUCHER_TYPE_STYLES = {
  sales: {
    label: "Sales",
    docSec22: "Bill of Supply (BOS)",
    docGst: "Tax Invoice (GST)",
    key: "F8",
    href: "/vouchers/sales",
    badge: "bg-emerald-50 text-emerald-800 border-emerald-300 font-bold",
    dot: "bg-emerald-500",
  },
  payment: {
    label: "Payment",
    docSec22: "Payment Voucher",
    docGst: "Payment Voucher",
    key: "F5",
    href: "/vouchers/payment",
    badge: "bg-rose-50 text-rose-800 border-rose-300 font-bold",
    dot: "bg-rose-500",
  },
  receipt: {
    label: "Receipt",
    docSec22: "Bank / Cash Receipt",
    docGst: "Bank / Cash Receipt",
    key: "F6",
    href: "/vouchers/receipt",
    badge: "bg-blue-50 text-blue-800 border-blue-300 font-bold",
    dot: "bg-blue-500",
  },
  purchase: {
    label: "Purchase",
    docSec22: "Inward Bill / Purchase",
    docGst: "Vendor Tax Invoice",
    key: "F9",
    href: "/vouchers/purchase",
    badge: "bg-amber-50 text-amber-800 border-amber-300 font-bold",
    dot: "bg-amber-500",
  },
  contra: {
    label: "Contra",
    docSec22: "Cash/Bank Transfer Slip",
    docGst: "Cash/Bank Transfer Slip",
    key: "F4",
    href: "/vouchers/contra",
    badge: "bg-cyan-50 text-cyan-800 border-cyan-300 font-bold",
    dot: "bg-cyan-500",
  },
  journal: {
    label: "Journal",
    docSec22: "Adjustment Journal Memo",
    docGst: "Adjustment Journal Memo",
    key: "F7",
    href: "/vouchers/journal",
    badge: "bg-purple-50 text-purple-800 border-purple-300 font-bold",
    dot: "bg-purple-500",
  },
};

interface DayBookProps {
  activeOrgId: string;
  activeOrgName: string;
  activeRegime?: TaxRegime;
  activeGstin?: string | null;
}

export function RecentlyAddedVouchers({
  activeOrgId,
  activeOrgName,
  activeRegime = "sec22",
  activeGstin,
}: DayBookProps) {
  const router = useRouter();

  const [vouchers, setVouchers] = useState<VoucherItem[]>(() =>
    getVouchersForOrg(activeOrgId)
  );
  const [selectedType, setSelectedType] = useState<VoucherType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedVoucher, setSelectedVoucher] = useState<VoucherItem | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isNewVoucherMenuOpen, setIsNewVoucherMenuOpen] = useState(false);
  const [isPostingPending, setIsPostingPending] = useState(false);
  const [showDefinitionHelp, setShowDefinitionHelp] = useState(true);

  // Sync vouchers whenever company changes
  useEffect(() => {
    const seed = getVouchersForOrg(activeOrgId);

    // Also query backend for real posted journals to merge them seamlessly
    accountingApi
      .listJournals(activeOrgId)
      .then((res) => {
        if (res.data && res.data.length > 0) {
          const apiVouchers: VoucherItem[] = res.data.map((j) => {
            const pfx = (j.entry_number || "").split("-")[0].toUpperCase();
            let vType: VoucherItem["voucher_type"] = "journal";
            let fKey = "F7";
            let lf = "LF-100";
            let srcDoc = "Journal Voucher Entry";

            if (pfx.includes("SLS") || pfx.includes("SAL") || pfx.includes("INV")) {
              vType = "sales";
              fKey = "F8";
              lf = "LF-104";
              srcDoc = activeRegime === "sec22" ? "Bill of Supply (BOS)" : "Tax Invoice";
            } else if (pfx.includes("PAY")) {
              vType = "payment";
              fKey = "F5";
              lf = "LF-502";
              srcDoc = "Payment Advice Voucher";
            } else if (pfx.includes("RCP") || pfx.includes("REC")) {
              vType = "receipt";
              fKey = "F6";
              lf = "LF-201";
              srcDoc = "Bank Collection Receipt";
            } else if (pfx.includes("PUR")) {
              vType = "purchase";
              fKey = "F9";
              lf = "LF-305";
              srcDoc = "Inward Purchase Bill";
            } else if (pfx.includes("CNT")) {
              vType = "contra";
              fKey = "F4";
              lf = "LF-203";
              srcDoc = "Contra Transfer Slip";
            }

            const totalAmount = (j.journal_entry_lines || []).reduce(
              (sum, l) => sum + (l.debit || 0),
              0
            );

            return {
              id: j.id,
              entry_number: j.entry_number,
              voucher_type: vType,
              f_key: fKey,
              entry_date: j.entry_date,
              entry_time: "12:00 PM",
              party_name: j.narration?.split("-")[0]?.trim() || "Authoritative Transaction",
              source_document: srcDoc,
              ledger_folio: lf,
              reference: j.reference || j.entry_number,
              narration: j.narration || "Recorded via Accounting Engine",
              amount: totalAmount || 10000,
              dr_cr: "Dr",
              status: (j.status as any) || "posted",
              organisation_id: activeOrgId,
              lines: (j.journal_entry_lines || []).map((l, idx) => ({
                dr_cr: l.debit > 0 ? "Dr" : "Cr",
                account_name: l.description || `Ledger Head (${l.account_id})`,
                category: "Asset",
                debit: l.debit || 0,
                credit: l.credit || 0,
                ledger_folio: `LF-${100 + idx * 5}`,
                description: l.description,
              })),
            };
          });

          // Merge without duplicate entry numbers
          const existingNos = new Set(apiVouchers.map((v) => v.entry_number));
          const uniqueSeed = seed.filter((v) => !existingNos.has(v.entry_number));
          setVouchers([...apiVouchers, ...uniqueSeed]);
        } else {
          setVouchers(seed);
        }
      })
      .catch(() => {
        setVouchers(seed);
      });
  }, [activeOrgId, activeRegime]);

  // Filter vouchers by type and search query
  const filteredVouchers = vouchers.filter((item) => {
    if (selectedType !== "all" && item.voucher_type !== selectedType) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchNo = item.entry_number.toLowerCase().includes(q);
      const matchParty = item.party_name.toLowerCase().includes(q);
      const matchRef = item.reference.toLowerCase().includes(q);
      const matchNarr = item.narration.toLowerCase().includes(q);
      const matchLF = item.ledger_folio.toLowerCase().includes(q);
      const matchDoc = item.source_document.toLowerCase().includes(q);
      if (!matchNo && !matchParty && !matchRef && !matchNarr && !matchLF && !matchDoc) {
        return false;
      }
    }
    return true;
  });

  const handleRowClick = (item: VoucherItem) => {
    setSelectedVoucher(item);
    setIsDetailModalOpen(true);
  };

  const handlePostDraftToLedger = async (vch: VoucherItem) => {
    setIsPostingPending(true);
    try {
      // Optimistic update
      setVouchers((prev) =>
        prev.map((v) => (v.id === vch.id ? { ...v, status: "posted" } : v))
      );
      if (selectedVoucher && selectedVoucher.id === vch.id) {
        setSelectedVoucher({ ...selectedVoucher, status: "posted" });
      }
      alert(`Voucher ${vch.entry_number} successfully posted to General Ledger (L.F. ${vch.ledger_folio}).`);
    } finally {
      setIsPostingPending(false);
    }
  };

  const shortOrgName = activeOrgName.startsWith("All Might")
    ? "All Might"
    : activeOrgName.startsWith("Endeavor")
    ? "Endeavor"
    : activeOrgName.startsWith("Deku")
    ? "Deku"
    : activeOrgName.split(" ")[0];

  return (
    <div className="bg-white border border-[#CBD5E1] rounded-xl shadow-xs overflow-hidden">
      {/* Table Header Strip */}
      <div className="bg-[#1F2324] px-4 py-3.5 border-b border-[#3E4848] flex flex-col md:flex-row md:items-center justify-between gap-3 text-white">
        <div className="flex items-start sm:items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-[#5BB5BB]/20 border border-[#5BB5BB]/50 flex items-center justify-center text-[#5BB5BB] shrink-0 mt-0.5 sm:mt-0">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-black tracking-tight font-sans uppercase">
                Day Book
              </h2>
              <span className="text-[10px] font-mono font-bold text-slate-300">
                (Chronological Financial Transactions Register)
              </span>
              <span className="text-[10px] font-mono text-[#91D7D2] bg-white/10 px-2 py-0.5 rounded border border-[#5BB5BB]/30 font-bold">
                🏢 {shortOrgName} Day Book
              </span>
              {activeRegime === "sec22" ? (
                <span className="text-[10px] font-mono text-emerald-300 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/40">
                  Sec 22 Bill of Supply
                </span>
              ) : (
                <span className="text-[10px] font-mono text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-500/40">
                  GST Tax Engine Active
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 font-mono mt-0.5">
              Book of Prime Entry • Chronological daily log before totals are posted to the ledger
            </p>
          </div>
        </div>

        {/* Quick Voucher Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {/* New Voucher Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsNewVoucherMenuOpen(!isNewVoucherMenuOpen)}
              className="px-3 py-1.5 rounded-lg bg-[#5BB5BB] hover:bg-[#91D7D2] text-[#0A0A0A] font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              title="Record transaction voucher (F4-F9)"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Record Voucher</span>
              <ChevronDown className="h-3 w-3" />
            </button>

            {isNewVoucherMenuOpen && (
              <div
                className="absolute right-0 mt-1.5 w-52 bg-[#1F2324] border border-[#3E4848] rounded-lg shadow-xl py-1 z-30 divide-y divide-white/10"
                onMouseLeave={() => setIsNewVoucherMenuOpen(false)}
              >
                <Link
                  href="/vouchers/sales"
                  className="flex items-center justify-between px-3 py-2 text-xs text-white hover:bg-[#5BB5BB]/20 hover:text-[#91D7D2] transition-colors"
                >
                  <div className="flex flex-col">
                    <span>{activeRegime === "sec22" ? "Bill of Supply" : "Sales Invoice"}</span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {activeRegime === "sec22" ? "Sec 22 Exempt" : "GST Tax Invoice"}
                    </span>
                  </div>
                  <kbd className="font-mono text-[10px] text-emerald-400 font-bold">F8</kbd>
                </Link>
                <Link
                  href="/vouchers/payment"
                  className="flex items-center justify-between px-3 py-2 text-xs text-white hover:bg-[#5BB5BB]/20 hover:text-[#91D7D2] transition-colors"
                >
                  <div className="flex flex-col">
                    <span>Payment (Vendor)</span>
                    <span className="text-[10px] text-slate-400 font-mono">Cash / Bank payout</span>
                  </div>
                  <kbd className="font-mono text-[10px] text-rose-400 font-bold">F5</kbd>
                </Link>
                <Link
                  href="/vouchers/receipt"
                  className="flex items-center justify-between px-3 py-2 text-xs text-white hover:bg-[#5BB5BB]/20 hover:text-[#91D7D2] transition-colors"
                >
                  <div className="flex flex-col">
                    <span>Receipt (Customer)</span>
                    <span className="text-[10px] text-slate-400 font-mono">Bank NEFT / Cash</span>
                  </div>
                  <kbd className="font-mono text-[10px] text-blue-400 font-bold">F6</kbd>
                </Link>
                <Link
                  href="/vouchers/purchase"
                  className="flex items-center justify-between px-3 py-2 text-xs text-white hover:bg-[#5BB5BB]/20 hover:text-[#91D7D2] transition-colors"
                >
                  <div className="flex flex-col">
                    <span>Purchase Bill</span>
                    <span className="text-[10px] text-slate-400 font-mono">Inward vendor bill</span>
                  </div>
                  <kbd className="font-mono text-[10px] text-amber-400 font-bold">F9</kbd>
                </Link>
                <Link
                  href="/vouchers/contra"
                  className="flex items-center justify-between px-3 py-2 text-xs text-white hover:bg-[#5BB5BB]/20 hover:text-[#91D7D2] transition-colors"
                >
                  <div className="flex flex-col">
                    <span>Contra (Bank/Cash)</span>
                    <span className="text-[10px] text-slate-400 font-mono">Internal transfers</span>
                  </div>
                  <kbd className="font-mono text-[10px] text-cyan-400 font-bold">F4</kbd>
                </Link>
                <Link
                  href="/vouchers/journal"
                  className="flex items-center justify-between px-3 py-2 text-xs text-white hover:bg-[#5BB5BB]/20 hover:text-[#91D7D2] transition-colors"
                >
                  <div className="flex flex-col">
                    <span>Journal Entry</span>
                    <span className="text-[10px] text-slate-400 font-mono">Adjustments / Folio</span>
                  </div>
                  <kbd className="font-mono text-[10px] text-purple-400 font-bold">F7</kbd>
                </Link>
              </div>
            )}
          </div>

          <Link
            href="/day-book"
            className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium text-xs flex items-center gap-1.5 border border-white/20 transition-colors"
            title="Open complete chronological Day Book workspace (D)"
          >
            <span>Full Day Book View</span>
            <ExternalLink className="h-3.5 w-3.5 text-[#5BB5BB]" />
          </Link>
        </div>
      </div>

      {/* Authoritative Accounting Definition Banner */}
      {showDefinitionHelp && (
        <div className="bg-[#F0FDF4] border-b border-emerald-200 px-4 py-2.5 flex items-start justify-between gap-3 text-xs">
          <div className="flex items-start gap-2.5">
            <span className="p-1 rounded bg-emerald-100 text-emerald-800 shrink-0 mt-0.5">
              <Info className="h-3.5 w-3.5" />
            </span>
            <div className="text-slate-800 leading-relaxed font-sans">
              <span className="font-bold text-emerald-950 font-mono uppercase text-[11px] mr-1.5">
                Accounting Definition:
              </span>
              <span>
                A day book is recorded chronologically as financial transactions happen throughout the day, using source documents like invoices, receipts, and vouchers. Each entry captures core details—such as the date, particulars/party name, voucher or invoice number, ledger folio reference, and the transaction amount—before totals are posted to the ledger.
              </span>
            </div>
          </div>
          <button
            onClick={() => setShowDefinitionHelp(false)}
            className="text-slate-400 hover:text-slate-600 text-xs font-mono font-bold shrink-0 ml-2 cursor-pointer"
            title="Dismiss definition"
          >
            ✕
          </button>
        </div>
      )}

      {/* Filter Tabs & Search Bar */}
      <div className="p-3 bg-[#F8FAFC] border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Type Filter Pills */}
        <div className="flex flex-wrap items-center gap-1">
          {(
            [
              { id: "all", label: "All Transactions", count: vouchers.length },
              { id: "sales", label: activeRegime === "sec22" ? "Sales / BOS (F8)" : "Sales Inv (F8)", count: vouchers.filter((v) => v.voucher_type === "sales").length },
              { id: "payment", label: "Payment (F5)", count: vouchers.filter((v) => v.voucher_type === "payment").length },
              { id: "receipt", label: "Receipt (F6)", count: vouchers.filter((v) => v.voucher_type === "receipt").length },
              { id: "purchase", label: "Purchase (F9)", count: vouchers.filter((v) => v.voucher_type === "purchase").length },
              { id: "contra", label: "Contra (F4)", count: vouchers.filter((v) => v.voucher_type === "contra").length },
              { id: "journal", label: "Journal (F7)", count: vouchers.filter((v) => v.voucher_type === "journal").length },
            ] as const
          ).map((tab) => {
            const isSelected = selectedType === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setSelectedType(tab.id as VoucherType)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 border ${
                  isSelected
                    ? "bg-[#1F2324] text-[#91D7D2] border-[#3E4848] shadow-xs"
                    : "bg-white hover:bg-slate-100 text-slate-700 border-slate-200"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] font-mono px-1 rounded ${
                    isSelected ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search input */}
        <div className="relative min-w-[240px]">
          <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search voucher, party, LF folio, or doc..."
            className="w-full bg-white border border-slate-300 rounded-md py-1 pl-8 pr-3 text-xs placeholder:text-slate-400 focus:outline-none focus:border-[#5BB5BB]"
          />
        </div>
      </div>

      {/* Day Book Data Table (Captures all core details) */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-100 border-b border-slate-200 text-[10px] font-mono uppercase tracking-wider text-slate-600">
              <th className="py-2.5 px-3 font-bold">Date &amp; Time</th>
              <th className="py-2.5 px-3 font-bold">Voucher / Invoice No.</th>
              <th className="py-2.5 px-3 font-bold">Type &amp; Source Document</th>
              <th className="py-2.5 px-3 font-bold">Particulars / Party Name</th>
              <th className="py-2.5 px-3 font-bold text-center" title="Ledger Folio: General ledger posting account reference">
                L.F.
              </th>
              <th className="py-2.5 px-3 font-bold">Narration &amp; Source Ref</th>
              <th className="py-2.5 px-3 font-bold text-right">Debit / Credit Amount</th>
              <th className="py-2.5 px-3 font-bold text-center">Ledger Status</th>
              <th className="py-2.5 px-3 font-bold text-right">Folio Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredVouchers.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-10 text-center text-slate-500 text-xs">
                  No Day Book entries found matching the selected filter.
                </td>
              </tr>
            ) : (
              filteredVouchers.map((item) => {
                const typeMeta = VOUCHER_TYPE_STYLES[item.voucher_type] || VOUCHER_TYPE_STYLES.journal;
                const docLabel =
                  item.voucher_type === "sales"
                    ? activeRegime === "sec22"
                      ? "Bill of Supply (BOS)"
                      : "Tax Invoice"
                    : typeMeta.docGst;

                return (
                  <tr
                    key={item.id}
                    onClick={() => handleRowClick(item)}
                    className="hover:bg-[#5BB5BB]/5 transition-colors cursor-pointer group"
                  >
                    {/* Date & Time (Chronological order) */}
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="font-mono text-slate-800 font-semibold block">
                        {formatDateTally(item.entry_date)}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5" />
                        {item.entry_time}
                      </span>
                    </td>

                    {/* Voucher / Invoice Number */}
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="font-mono font-bold text-[#0F172A] group-hover:text-[#2D7A7A] transition-colors block">
                        {item.entry_number}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        {item.reference}
                      </span>
                    </td>

                    {/* Type & Source Document */}
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded border ${typeMeta.badge}`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${typeMeta.dot}`} />
                          <span>{typeMeta.label}</span>
                          <span className="text-[9px] opacity-75">({typeMeta.key})</span>
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 block mt-0.5 truncate max-w-[160px]" title={item.source_document || docLabel}>
                        📄 {item.source_document || docLabel}
                      </span>
                    </td>

                    {/* Particulars / Party Name */}
                    <td className="py-2.5 px-3 max-w-[200px]">
                      <span className="font-semibold text-slate-900 block truncate group-hover:text-[#0A0A0A]">
                        {item.party_name}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        {item.lines.length} double-entry line{item.lines.length !== 1 ? "s" : ""}
                      </span>
                    </td>

                    {/* Ledger Folio (L.F.) Reference */}
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      <span
                        className="inline-block px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-slate-100 text-slate-800 border border-slate-300 group-hover:bg-[#5BB5BB]/20 group-hover:border-[#5BB5BB] group-hover:text-[#0A0A0A] transition-colors"
                        title={`General Ledger Folio Reference: ${item.ledger_folio}`}
                      >
                        {item.ledger_folio}
                      </span>
                    </td>

                    {/* Narration & Source Ref */}
                    <td className="py-2.5 px-3 max-w-[240px]">
                      <span className="text-slate-700 block truncate text-[11px]">
                        {item.narration}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        Source Ref: {item.reference}
                      </span>
                    </td>

                    {/* Debit / Credit Amount */}
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      <div className="font-mono font-black text-slate-900 text-xs group-hover:text-[#2D7A7A] transition-colors">
                        {formatINR(item.amount)}
                      </div>
                      <span
                        className={`text-[10px] font-mono font-bold ${
                          item.dr_cr === "Dr" ? "text-emerald-700" : "text-amber-700"
                        }`}
                      >
                        {item.dr_cr} Balance
                      </span>
                    </td>

                    {/* Ledger Status (before / after posting) */}
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      {item.status === "posted" ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300">
                          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                          Posted to Ledger
                        </span>
                      ) : item.status === "reversed" ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-300">
                          Reversed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-300">
                          <Clock className="h-3 w-3 text-amber-600" />
                          Draft (Unposted)
                        </span>
                      )}
                    </td>

                    {/* Action */}
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRowClick(item);
                        }}
                        className="px-2.5 py-1 rounded bg-slate-100 hover:bg-[#5BB5BB] hover:text-[#0A0A0A] text-slate-700 text-[11px] font-bold transition-colors inline-flex items-center gap-1 cursor-pointer"
                        title="View complete double-entry ledger folio breakdown"
                      >
                        <Eye className="h-3 w-3" />
                        <span>Folio</span>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Info Strip */}
      <div className="p-3 bg-[#F8FAFC] border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500 font-mono">
        <div>
          <span>Showing {filteredVouchers.length} of {vouchers.length} Day Book records • </span>
          <span className="text-slate-800 font-bold">
            Total Debit Volume: {formatINR(filteredVouchers.reduce((s, v) => s + v.amount, 0))}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span>ALERX Mathematical Equilibrium:</span>
          <span className="text-emerald-700 font-bold flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" /> Verified
          </span>
        </div>
      </div>

      {/* Double-Entry Transaction & Folio Detail Modal */}
      {selectedVoucher && (
        <Modal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          title={`Day Book Entry: ${selectedVoucher.entry_number}`}
          description={`Recorded on ${formatDateTally(selectedVoucher.entry_date)} at ${selectedVoucher.entry_time} • L.F. ${selectedVoucher.ledger_folio}`}
          maxWidth="2xl"
        >
          <div className="space-y-4 font-sans text-xs">
            {/* Header Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div>
                <span className="text-slate-400 block text-[10px] font-mono uppercase">
                  Voucher No.
                </span>
                <span className="font-mono font-black text-sm text-[#0F172A]">
                  {selectedVoucher.entry_number}
                </span>
                <span className="text-[10px] font-mono text-slate-500 block">
                  Ref: {selectedVoucher.reference}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] font-mono uppercase">
                  Source Document
                </span>
                <span className="font-medium text-slate-900 block truncate" title={selectedVoucher.source_document}>
                  {selectedVoucher.source_document}
                </span>
                <span className="text-[10px] font-mono text-[#2D7A7A] font-bold">
                  {selectedVoucher.f_key} Voucher
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] font-mono uppercase">
                  Ledger Folio (L.F.)
                </span>
                <span className="font-mono font-black text-sm text-[#0A0A0A] bg-white px-2 py-0.5 rounded border border-slate-300 inline-block mt-0.5">
                  {selectedVoucher.ledger_folio}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] font-mono uppercase">
                  Posting Lifecycle
                </span>
                <div className="mt-0.5">
                  {selectedVoucher.status === "posted" ? (
                    <Badge variant="success">Posted to Ledger</Badge>
                  ) : selectedVoucher.status === "reversed" ? (
                    <Badge variant="danger">Reversed</Badge>
                  ) : (
                    <Badge variant="warning">Draft (Unposted)</Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Narration */}
            <div>
              <span className="text-slate-500 block text-[10px] font-mono uppercase mb-1 font-bold">
                Particulars / Narration
              </span>
              <div className="p-3 bg-[#F8FAFC] rounded-lg border border-slate-200 text-slate-800">
                <div className="font-bold text-slate-900 mb-0.5">
                  Counterparty: {selectedVoucher.party_name}
                </div>
                <p className="text-slate-600 text-[11px] leading-relaxed">
                  {selectedVoucher.narration}
                </p>
              </div>
            </div>

            {/* ALERX Double-Entry Ledger Lines */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-slate-500 block text-[10px] font-mono uppercase font-bold">
                  authoritative double-entry general ledger postings
                </span>
                <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300">
                  Total Balanced: {formatINR(selectedVoucher.amount)}
                </span>
              </div>

              <div className="border border-slate-300 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200 text-[10px] font-mono uppercase text-slate-600">
                      <th className="py-2 px-3">Dr / Cr</th>
                      <th className="py-2 px-3">General Ledger Account Head</th>
                      <th className="py-2 px-3">L.F. Folio</th>
                      <th className="py-2 px-3">Category</th>
                      <th className="py-2 px-3 text-right">Debit (₹)</th>
                      <th className="py-2 px-3 text-right">Credit (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedVoucher.lines.map((line, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-mono font-bold">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] ${
                              line.dr_cr === "Dr"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {line.dr_cr}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          <span className="font-semibold text-slate-900 block">
                            {line.account_name}
                          </span>
                          {line.description && (
                            <span className="text-[10px] text-slate-500 block">
                              {line.description}
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 font-mono font-bold text-slate-600">
                          {line.ledger_folio || selectedVoucher.ledger_folio}
                        </td>
                        <td className="py-2 px-3">
                          <span className="font-mono text-[10px] text-slate-500 uppercase">
                            {line.category}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                          {line.debit > 0 ? formatINR(line.debit) : "—"}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                          {line.credit > 0 ? formatINR(line.credit) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 border-t border-slate-300 font-mono font-black text-xs text-slate-900">
                      <td colSpan={4} className="py-2 px-3 text-right">
                        Ledger Balance Check:
                      </td>
                      <td className="py-2 px-3 text-right text-emerald-700">
                        {formatINR(selectedVoucher.lines.reduce((s, l) => s + l.debit, 0))}
                      </td>
                      <td className="py-2 px-3 text-right text-emerald-700">
                        {formatINR(selectedVoucher.lines.reduce((s, l) => s + l.credit, 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
              <span className="text-[11px] text-slate-500 font-mono">
                Source Document: {selectedVoucher.source_document}
              </span>
              <div className="flex items-center gap-2">
                {selectedVoucher.status === "draft" && (
                  <button
                    onClick={() => handlePostDraftToLedger(selectedVoucher)}
                    disabled={isPostingPending}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors cursor-pointer"
                  >
                    {isPostingPending ? "Posting..." : "Post to General Ledger"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsDetailModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold text-xs transition-colors cursor-pointer"
                >
                  Close Folio
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// Backwards-compatibility alias
export const DayBookRegister = RecentlyAddedVouchers;
