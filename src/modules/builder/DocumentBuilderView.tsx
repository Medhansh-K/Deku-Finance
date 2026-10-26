"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  FileCheck,
  Tag,
  Receipt,
  Truck,
  FileMinus,
  FilePlus,
  ShoppingCart,
  Printer,
  Download,
  Copy,
  Plus,
  Trash2,
  RotateCcw,
  Building2,
  Calendar,
  Check,
  ShieldCheck,
  ArrowRightLeft,
  ChevronDown,
  Eye,
  Edit3,
  Columns,
  PanelLeftClose,
  PanelLeft,
  FileCode,
  FileType,
  ZoomIn,
  ZoomOut,
  GripVertical,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { formatINR } from "@/lib/formatters/currency";
import { numberToIndianWords } from "@/lib/builder/number-to-words";
import { saveBuilderDraft, BuilderLedgerDraft } from "@/lib/vouchers/builder-drafts";
import { logUserActivity } from "@/lib/logging/activity-logger";

export type DocumentType =
  | "invoice"
  | "quote"
  | "discount_coupon"
  | "proforma"
  | "delivery_challan"
  | "credit_note"
  | "debit_note"
  | "purchase_order";

export interface DocumentLineItem {
  id: string;
  description: string;
  hsn: string;
  qty: number;
  unit: string;
  rate: number;
  discountPct: number;
  gstRate: number; // 0, 5, 12, 18, 28
}

export interface DocumentSidebarItem {
  id: DocumentType;
  title: string;
  subtitle: string;
  icon: any;
  badge: string;
  badgeColor: string;
}

const DOCUMENT_TYPES: DocumentSidebarItem[] = [
  {
    id: "invoice",
    title: "Tax Invoice",
    subtitle: "Standard GST B2B / B2C tax billing invoice",
    icon: FileText,
    badge: "GST Strict",
    badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-200",
  },
  {
    id: "quote",
    title: "Commercial Quote",
    subtitle: "Formal quotation & estimate with validity terms",
    icon: FileCheck,
    badge: "Proposal",
    badgeColor: "bg-blue-100 text-blue-800 border-blue-200",
  },
  {
    id: "discount_coupon",
    title: "Discount Coupon",
    subtitle: "Promotional voucher, campaign codes & rebate cards",
    icon: Tag,
    badge: "Marketing",
    badgeColor: "bg-purple-100 text-purple-800 border-purple-200",
  },
  {
    id: "proforma",
    title: "Proforma Invoice",
    subtitle: "Advance commercial invoice prior to goods dispatch",
    icon: Receipt,
    badge: "Advance",
    badgeColor: "bg-amber-100 text-amber-800 border-amber-200",
  },
  {
    id: "delivery_challan",
    title: "Delivery Challan",
    subtitle: "Rule 55 goods transport, job work & approval transit",
    icon: Truck,
    badge: "Rule 55",
    badgeColor: "bg-indigo-100 text-indigo-800 border-indigo-200",
  },
  {
    id: "credit_note",
    title: "Credit Note",
    subtitle: "Sales return & downward value adjustment note",
    icon: FileMinus,
    badge: "Adjustment",
    badgeColor: "bg-rose-100 text-rose-800 border-rose-200",
  },
  {
    id: "debit_note",
    title: "Debit Note",
    subtitle: "Upward supplementary billing & debit adjustment",
    icon: FilePlus,
    badge: "Adjustment",
    badgeColor: "bg-cyan-100 text-cyan-800 border-cyan-200",
  },
  {
    id: "purchase_order",
    title: "Purchase Order (PO)",
    subtitle: "Vendor procurement order with delivery milestones",
    icon: ShoppingCart,
    badge: "Procure",
    badgeColor: "bg-teal-100 text-teal-800 border-teal-200",
  },
];

export function DocumentBuilderView() {
  const router = useRouter();
  const [activeDocType, setActiveDocType] = useState<DocumentType>("invoice");
  const [orgId, setOrgId] = useState<string>("b127e064-5da8-437f-94c4-b8d6a0c12927");
  const [activeCompanyName, setActiveCompanyName] = useState<string>("Deku Financial Technologies");
  const [activeGSTIN, setActiveGSTIN] = useState<string>("27AAACD1234E1Z5");
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [isSuccessAction, setIsSuccessAction] = useState<string | null>(null);

  // Layout View Modes: "create" (form only) | "preview" (document only) | "split" (both)
  const [viewMode, setViewMode] = useState<"create" | "preview" | "split">("create");

  // Slideable & Adjustable Sidebar State (Container on the same plane)
  const [sidebarWidth, setSidebarWidth] = useState<number>(260);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isDraggingSidebar, setIsDraggingSidebar] = useState<boolean>(false);

  // Draggable Split Screen State (Percentage width of Form Container)
  const [splitRatio, setSplitRatio] = useState<number>(50); // 50%
  const [isDraggingSplit, setIsDraggingSplit] = useState<boolean>(false);
  const mainWorkspaceRef = useRef<HTMLDivElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [previewContainerWidth, setPreviewContainerWidth] = useState<number>(600);
  const [zoomMode, setZoomMode] = useState<"auto" | number>("auto");

  // Download Dropdown Menu State
  const [isDownloadOpen, setIsDownloadOpen] = useState<boolean>(false);
  const downloadDropdownRef = useRef<HTMLDivElement>(null);

  // General Document Header
  const [docNumber, setDocNumber] = useState<string>("INV-2026-089");
  const [docDate, setDocDate] = useState<string>("2026-10-21");
  const [dueDate, setDueDate] = useState<string>("2026-11-20");
  const [placeOfSupply, setPlaceOfSupply] = useState<string>("27-Maharashtra");
  const [isInterstate, setIsInterstate] = useState<boolean>(false);
  const [reverseCharge, setReverseCharge] = useState<boolean>(false);

  // Counterparty / Party Details
  const [partyName, setPartyName] = useState<string>("Endeavor Energy & Tech Solutions");
  const [partyGSTIN, setPartyGSTIN] = useState<string>("27AABCE4567F1Z8");
  const [partyAddress, setPartyAddress] = useState<string>(
    "Plot 42, MIDC Cyber Gateway, Andheri East, Mumbai, Maharashtra 400069"
  );
  const [partyEmail, setPartyEmail] = useState<string>("procurement@endeavorenergy.com");
  const [partyPhone, setPartyPhone] = useState<string>("+91 98200 12345");

  // Discount Coupon Specific State
  const [couponCode, setCouponCode] = useState<string>("FESTIVE20");
  const [couponTitle, setCouponTitle] = useState<string>("Diwali Special Enterprise Grant");
  const [discountType, setDiscountType] = useState<"percentage" | "flat">("percentage");
  const [discountValue, setDiscountValue] = useState<number>(20);
  const [minOrderValue, setMinOrderValue] = useState<number>(25000);
  const [maxDiscountCap, setMaxDiscountCap] = useState<number>(10000);
  const [couponValidUntil, setCouponValidUntil] = useState<string>("2026-11-30");
  const [couponUsageLimit, setCouponUsageLimit] = useState<string>("1 Time Per Customer");
  const [couponEligibleScope, setCouponEligibleScope] = useState<string>(
    "Applicable on All Enterprise ERP Subscriptions & Double-Entry Ledgers"
  );

  // Delivery Challan Specific State
  const [challanReason, setChallanReason] = useState<string>("Supply on Approval / Exhibition");
  const [vehicleNumber, setVehicleNumber] = useState<string>("MH-02-EE-8822");
  const [transporterName, setTransporterName] = useState<string>("All Might Express Logistics Ltd");
  const [ewayBillNo, setEwayBillNo] = useState<string>("291084729104");

  // Line Items
  const [items, setItems] = useState<DocumentLineItem[]>([
    {
      id: "line-1",
      description: "Deku Financial OS — Annual Cloud Enterprise License",
      hsn: "998313",
      qty: 1,
      unit: "Year",
      rate: 150000,
      discountPct: 10,
      gstRate: 18,
    },
    {
      id: "line-2",
      description: "ALERX Multi-Tenant Ledger Architecture Consulting & Integration",
      hsn: "998314",
      qty: 40,
      unit: "Hours",
      rate: 3500,
      discountPct: 0,
      gstRate: 18,
    },
  ]);

  // Notes, Bank Details & Signatory
  const [notes, setNotes] = useState<string>(
    "1. Payment due strictly within 30 days of invoice date.\n2. In case of delayed payment, interest @ 18% p.a. will be levied.\n3. Goods / Services once supplied are subject to Deku OS Terms of Service."
  );
  const [bankName, setBankName] = useState<string>("HDFC Bank — Corporate Current A/c");
  const [bankAccount, setBankAccount] = useState<string>("50200088921478");
  const [bankIFSC, setBankIFSC] = useState<string>("HDFC0000128");
  const [signatoryName, setSignatoryName] = useState<string>("Medhansh K.");
  const [signatoryTitle, setSignatoryTitle] = useState<string>("Managing Director");

  // Synchronize company context
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedOrgId = localStorage.getItem("deku_active_org_id");
      if (savedOrgId) setOrgId(savedOrgId);
      const savedOrgName = localStorage.getItem("deku_active_org_name");
      if (savedOrgName) setActiveCompanyName(savedOrgName);
    }
  }, []);

  // Handle Dragging Sidebar Width
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingSidebar) return;
      const newWidth = Math.max(180, Math.min(450, e.clientX));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsDraggingSidebar(false);
    };

    if (isDraggingSidebar) {
      document.body.style.userSelect = "none";
      document.body.style.cursor = "col-resize";
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    } else if (!isDraggingSplit) {
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDraggingSidebar, isDraggingSplit]);

  // Handle Dragging Split View Ratio
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingSplit || !mainWorkspaceRef.current) return;
      const rect = mainWorkspaceRef.current.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      const pct = Math.max(25, Math.min(75, (offsetX / rect.width) * 100));
      setSplitRatio(pct);
    };

    const handleMouseUp = () => {
      setIsDraggingSplit(false);
    };

    if (isDraggingSplit) {
      document.body.style.userSelect = "none";
      document.body.style.cursor = "col-resize";
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    } else if (!isDraggingSidebar) {
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDraggingSplit, isDraggingSidebar]);

  // Keyboard shortcut to toggle template sidebar (Shift+B)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.shiftKey &&
        (e.key === "B" || e.key === "b") &&
        !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault();
        setIsSidebarCollapsed((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Measure preview container width to automatically scale A4 document
  useEffect(() => {
    if (!previewContainerRef.current) return;
    const updateWidth = () => {
      if (previewContainerRef.current) {
        setPreviewContainerWidth(previewContainerRef.current.clientWidth);
      }
    };
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(previewContainerRef.current);
    window.addEventListener("resize", updateWidth);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateWidth);
    };
  }, [viewMode, splitRatio, isSidebarCollapsed, sidebarWidth]);

  // Close download dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (downloadDropdownRef.current && !downloadDropdownRef.current.contains(e.target as Node)) {
        setIsDownloadOpen(false);
      }
    };
    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Update document series prefix when document type changes
  const applyPresetForDocType = (type: DocumentType) => {
    setActiveDocType(type);
    const rnd = Math.floor(100 + Math.random() * 900);
    switch (type) {
      case "invoice":
        setDocNumber(`INV-2026-${rnd}`);
        setNotes(
          "1. Tax payable on reverse charge: No.\n2. Payment terms: Net 30 days via NEFT/RTGS.\n3. Subject to Mumbai Jurisdiction."
        );
        break;
      case "quote":
        setDocNumber(`QT-2026-${rnd}`);
        setNotes(
          "1. This commercial quotation is valid for 30 calendar days from issue.\n2. 50% advance upon contract signing, 50% upon deployment.\n3. Implementation timeline: 4 weeks."
        );
        break;
      case "discount_coupon":
        setDocNumber(`COUPON-${rnd}`);
        setCouponCode(`DEKU${rnd}`);
        break;
      case "proforma":
        setDocNumber(`PI-2026-${rnd}`);
        setNotes(
          "1. This is a Proforma Invoice for advance payment and not a final Tax Invoice.\n2. Final Tax Invoice will be issued upon realization of funds and shipment."
        );
        break;
      case "delivery_challan":
        setDocNumber(`DC-2026-${rnd}`);
        setNotes(
          "1. Delivered under Rule 55 of CGST Rules, 2017.\n2. Goods transported not for sale / on approval.\n3. Value declared solely for transit and road security purposes."
        );
        break;
      case "credit_note":
        setDocNumber(`CN-2026-${rnd}`);
        setNotes(
          "1. Issued in reference to original Tax Invoice INV-2026-089.\n2. Reason: Post-sale volume rebate and service tier adjustment."
        );
        break;
      case "debit_note":
        setDocNumber(`DN-2026-${rnd}`);
        setNotes(
          "1. Issued in reference to original Tax Invoice INV-2026-089.\n2. Supplementary charges for additional compute & migration hours."
        );
        break;
      case "purchase_order":
        setDocNumber(`PO-2026-${rnd}`);
        setNotes(
          "1. Please supply the items as per specifications agreed in NDA.\n2. Deliver to Deku Warehouse & Datacenter Facility, Mumbai.\n3. Payment Net 15 days upon quality acceptance."
        );
        break;
    }
  };

  // Line item helpers
  const handleItemChange = (index: number, field: keyof DocumentLineItem, value: any) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: `line-${Date.now()}`,
        description: "Standard Financial Ledger Module",
        hsn: "998313",
        qty: 1,
        unit: "Nos",
        rate: 25000,
        discountPct: 0,
        gstRate: 18,
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Calculation Math
  const calculations = useMemo(() => {
    let subtotal = 0;
    let totalDiscount = 0;
    let taxableAmount = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;

    items.forEach((item) => {
      const gross = (item.qty || 0) * (item.rate || 0);
      const discount = gross * ((item.discountPct || 0) / 100);
      const taxable = gross - discount;
      const taxRate = item.gstRate || 0;

      subtotal += gross;
      totalDiscount += discount;
      taxableAmount += taxable;

      if (isInterstate) {
        totalIgst += taxable * (taxRate / 100);
      } else {
        totalCgst += taxable * (taxRate / 2 / 100);
        totalSgst += taxable * (taxRate / 2 / 100);
      }
    });

    let couponDiscount = 0;
    if (activeDocType === "discount_coupon") {
      if (discountType === "percentage") {
        couponDiscount = Math.min(taxableAmount * (discountValue / 100), maxDiscountCap);
      } else {
        couponDiscount = Math.min(discountValue, taxableAmount);
      }
    }

    const totalTax = totalCgst + totalSgst + totalIgst;
    const finalAmount = Math.max(0, taxableAmount + totalTax - couponDiscount);
    const roundOff = Math.round(finalAmount) - finalAmount;
    const roundedTotal = Math.round(finalAmount);

    return {
      subtotal,
      totalDiscount,
      taxableAmount,
      totalCgst,
      totalSgst,
      totalIgst,
      totalTax,
      couponDiscount,
      roundOff,
      roundedTotal,
      words: numberToIndianWords(roundedTotal),
    };
  }, [items, isInterstate, activeDocType, discountType, discountValue, maxDiscountCap]);

  // Responsive scale factor for A4 preview (guarantees zero overlap & zero clipping on any screen width!)
  const autoScale = useMemo(() => {
    if (viewMode === "create") return 1;
    const padding = 48;
    const targetWidth = activeDocType === "discount_coupon" ? 620 : 794;
    const available = Math.max(260, previewContainerWidth - padding);
    return Math.min(1.0, available / targetWidth);
  }, [previewContainerWidth, viewMode, activeDocType]);

  const effectiveScale = zoomMode === "auto" ? autoScale : zoomMode;

  const copyCouponToClipboard = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(couponCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
    }
  };

  // =========================================================================
  // DOWNLOAD & EXPORT ENGINES (PDF, Word, Plain Text, JSON)
  // =========================================================================
  const handleDownloadPDF = () => {
    setIsDownloadOpen(false);
    if (viewMode === "create") {
      setViewMode("preview");
      setTimeout(() => window.print(), 250);
    } else {
      window.print();
    }
  };

  const handleDownloadJSON = () => {
    setIsDownloadOpen(false);
    const data = {
      generator: "Deku Financial Technologies - Business Document Builder",
      documentType: activeDocType,
      documentNumber: docNumber,
      issueDate: docDate,
      dueDate,
      placeOfSupply,
      isInterstate,
      reverseCharge,
      company: {
        name: activeCompanyName,
        gstin: activeGSTIN,
        pan: "AAACD1234E",
        address: "Plot 104, BKC Financial Center, Mumbai, Maharashtra 400051",
      },
      party: {
        name: partyName,
        gstin: partyGSTIN,
        address: partyAddress,
        email: partyEmail,
        phone: partyPhone,
      },
      couponConfig:
        activeDocType === "discount_coupon"
          ? {
              code: couponCode,
              title: couponTitle,
              discountType,
              discountValue,
              minOrderValue,
              maxDiscountCap,
              validUntil: couponValidUntil,
              usageLimit: couponUsageLimit,
              terms: couponEligibleScope,
            }
          : undefined,
      challanConfig:
        activeDocType === "delivery_challan"
          ? {
              reason: challanReason,
              vehicleNumber,
              transporterName,
              ewayBillNo,
            }
          : undefined,
      items,
      calculations,
      notes,
      settlementBank: {
        bankName,
        accountNumber: bankAccount,
        ifsc: bankIFSC,
      },
      authorizedSignatory: {
        name: signatoryName,
        title: signatoryTitle,
      },
      exportedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${docNumber || "document"}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setIsSuccessAction("✓ Exported structured JSON document.");
    setTimeout(() => setIsSuccessAction(null), 3000);
  };

  const handleDownloadText = () => {
    setIsDownloadOpen(false);
    const border = "=".repeat(78);
    const divider = "-".repeat(78);
    const lines = [
      border,
      `                      ${activeCompanyName.toUpperCase()}`,
      `        Plot 104, BKC Financial Center, Mumbai, Maharashtra - 400051`,
      `        GSTIN: ${activeGSTIN}  |  PAN: AAACD1234E  |  State: 27`,
      border,
      ` DOCUMENT TYPE : ${activeDocType.toUpperCase().replace("_", " ")}`,
      ` DOCUMENT NO   : ${docNumber.padEnd(25)} ISSUE DATE : ${docDate}`,
      ` POS           : ${placeOfSupply.padEnd(25)} DUE DATE   : ${dueDate}`,
      divider,
      ` RECIPIENT / BILL TO:`,
      ` ${partyName}`,
      ` ${partyAddress}`,
      ` GSTIN: ${partyGSTIN || "Unregistered"}  |  Phone: ${partyPhone}`,
      divider,
      ` #  ITEM DESCRIPTION                     HSN/SAC   QTY   RATE       TAXABLE(INR)`,
      divider,
      ...items.map((item, idx) => {
        const taxable = item.qty * item.rate * (1 - item.discountPct / 100);
        const desc = item.description.slice(0, 35).padEnd(36);
        const hsn = (item.hsn || "").padEnd(8);
        const qty = `${item.qty} ${item.unit}`.padStart(6);
        const rate = formatINR(item.rate, { showCurrencySymbol: false }).padStart(10);
        const taxAmt = formatINR(taxable, { showCurrencySymbol: false }).padStart(12);
        return ` ${(idx + 1).toString().padEnd(2)} ${desc} ${hsn} ${qty} ${rate} ${taxAmt}`;
      }),
      divider,
      ` Subtotal (Gross Items)           : ${formatINR(calculations.subtotal)}`,
      calculations.totalDiscount > 0
        ? ` Less Discount                    : -${formatINR(calculations.totalDiscount)}`
        : "",
      ` Total Taxable Value              : ${formatINR(calculations.taxableAmount)}`,
      isInterstate
        ? ` Integrated GST (IGST)            : ${formatINR(calculations.totalIgst)}`
        : ` Central GST (CGST)               : ${formatINR(calculations.totalCgst)}\n State GST (SGST)                 : ${formatINR(calculations.totalSgst)}`,
      calculations.roundOff !== 0
        ? ` Round Off                        : ${formatINR(calculations.roundOff)}`
        : "",
      border,
      ` GRAND TOTAL (INR)                : ${formatINR(calculations.roundedTotal)}`,
      ` Amount in Words: ${calculations.words}`,
      border,
      ` Bank Settlement: ${bankName} | A/c: ${bankAccount} | IFSC: ${bankIFSC}`,
      divider,
      ` Terms & Conditions:`,
      notes,
      border,
      ` For ${activeCompanyName}: [Authorized Signatory - ${signatoryName}]`,
      border,
    ].filter(Boolean);

    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${docNumber || "document"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    setIsSuccessAction("✓ Exported Plain Text Ledger Document (.txt).");
    setTimeout(() => setIsSuccessAction(null), 3000);
  };

  const handleDownloadWord = () => {
    setIsDownloadOpen(false);
    const wordHtml = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>${docNumber}</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 10.5pt; color: #111; line-height: 1.4; padding: 24px; }
          h1 { font-size: 16pt; font-weight: bold; margin: 0; color: #000; }
          .header-box { border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 16px; }
          .doc-badge { background: #0A0A0A; color: #fff; padding: 5px 12px; font-weight: bold; font-size: 11pt; display: inline-block; }
          table { width: 100%; border-collapse: collapse; margin-top: 12px; margin-bottom: 12px; }
          th { background-color: #f1f5f9; border: 1px solid #cbd5e1; padding: 7px; font-size: 9.5pt; font-weight: bold; text-align: left; }
          td { border: 1px solid #cbd5e1; padding: 7px; font-size: 9.5pt; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .totals-table td { border: none; border-bottom: 1px solid #e2e8f0; padding: 4px 6px; }
          .grand-total { font-weight: bold; font-size: 12pt; background-color: #f8fafc; border-top: 2px solid #000 !important; border-bottom: 2px solid #000 !important; }
        </style>
      </head>
      <body>
        <div class="header-box">
          <table style="width: 100%; border: none;">
            <tr>
              <td style="border: none; vertical-align: top;">
                <h1>${activeCompanyName}</h1>
                <div>Plot 104, BKC Financial Center, Mumbai, Maharashtra — 400051</div>
                <div>GSTIN: <b>${activeGSTIN}</b> | PAN: <b>AAACD1234E</b> | State: 27</div>
              </td>
              <td style="border: none; text-align: right; vertical-align: top;">
                <span class="doc-badge">${activeDocType.toUpperCase().replace("_", " ")}</span>
                <div style="font-size: 9pt; color: #555; margin-top: 4px;">ORIGINAL FOR RECIPIENT</div>
              </td>
            </tr>
          </table>
        </div>

        <table style="margin-bottom: 16px;">
          <tr>
            <td style="width: 25%;"><b>Document No:</b> ${docNumber}</td>
            <td style="width: 25%;"><b>Issue Date:</b> ${docDate}</td>
            <td style="width: 25%;"><b>Place of Supply:</b> ${placeOfSupply}</td>
            <td style="width: 25%;"><b>Due Date:</b> ${dueDate}</td>
          </tr>
        </table>

        <table style="margin-bottom: 16px;">
          <tr>
            <td style="width: 50%; vertical-align: top;">
              <b>BILL TO (RECIPIENT):</b><br/>
              <b>${partyName}</b><br/>
              ${partyAddress}<br/>
              GSTIN: <b>${partyGSTIN || "Unregistered"}</b> | Phone: ${partyPhone}
            </td>
            <td style="width: 50%; vertical-align: top;">
              <b>SHIP TO (CONSIGNEE):</b><br/>
              <b>${partyName}</b><br/>
              ${partyAddress}<br/>
              Email: ${partyEmail}
            </td>
          </tr>
        </table>

        <table>
          <thead>
            <tr>
              <th class="text-center" style="width: 30px;">#</th>
              <th>Item Description</th>
              <th class="text-center">HSN/SAC</th>
              <th class="text-right">Qty</th>
              <th class="text-right">Rate (INR)</th>
              <th class="text-right">Disc %</th>
              <th class="text-right">GST %</th>
              <th class="text-right">Taxable (INR)</th>
            </tr>
          </thead>
          <tbody>
            ${items
              .map((item, idx) => {
                const taxable = item.qty * item.rate * (1 - item.discountPct / 100);
                return `
                  <tr>
                    <td class="text-center">${idx + 1}</td>
                    <td><b>${item.description}</b></td>
                    <td class="text-center">${item.hsn}</td>
                    <td class="text-right">${item.qty} ${item.unit}</td>
                    <td class="text-right">${item.rate.toLocaleString("en-IN")}</td>
                    <td class="text-right">${item.discountPct > 0 ? item.discountPct + "%" : "—"}</td>
                    <td class="text-right">${item.gstRate}%</td>
                    <td class="text-right"><b>${taxable.toLocaleString("en-IN")}</b></td>
                  </tr>
                `;
              })
              .join("")}
          </tbody>
        </table>

        <table style="width: 100%; border: none; margin-top: 15px;">
          <tr>
            <td style="border: none; width: 50%; vertical-align: top;">
              <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; padding: 10px; margin-bottom: 10px;">
                <b>Bank Settlement Details:</b><br/>
                Bank: ${bankName}<br/>
                Account: ${bankAccount}<br/>
                IFSC: ${bankIFSC}
              </div>
              <div style="font-size: 9pt; color: #555;">
                <b>Commercial Terms:</b><br/>
                ${notes.replace(/\n/g, "<br/>")}
              </div>
            </td>
            <td style="border: none; width: 50%; vertical-align: top;">
              <table class="totals-table">
                <tr><td>Subtotal:</td><td class="text-right">₹ ${calculations.subtotal.toLocaleString("en-IN")}</td></tr>
                ${
                  calculations.totalDiscount > 0
                    ? `<tr><td>Less Discount:</td><td class="text-right" style="color: green;">- ₹ ${calculations.totalDiscount.toLocaleString("en-IN")}</td></tr>`
                    : ""
                }
                <tr><td><b>Total Taxable Value:</b></td><td class="text-right"><b>₹ ${calculations.taxableAmount.toLocaleString("en-IN")}</b></td></tr>
                ${
                  isInterstate
                    ? `<tr><td>IGST:</td><td class="text-right">₹ ${calculations.totalIgst.toLocaleString("en-IN")}</td></tr>`
                    : `<tr><td>CGST:</td><td class="text-right">₹ ${calculations.totalCgst.toLocaleString("en-IN")}</td></tr><tr><td>SGST:</td><td class="text-right">₹ ${calculations.totalSgst.toLocaleString("en-IN")}</td></tr>`
                }
                <tr class="grand-total"><td><b>GRAND TOTAL (INR):</b></td><td class="text-right"><b>₹ ${calculations.roundedTotal.toLocaleString("en-IN")}</b></td></tr>
              </table>
              <div style="font-size: 9pt; margin-top: 6px; font-style: italic;">
                <b>Amount in Words:</b> ${calculations.words}
              </div>
            </td>
          </tr>
        </table>

        <div style="margin-top: 30px; border-top: 1px solid #ccc; padding-top: 15px;">
          <table style="width: 100%; border: none;">
            <tr>
              <td style="border: none; font-size: 8pt; color: #888;">
                Deku Financial Technologies Operating System<br/>
                Double-Entry Audited Engine • ISO A4 Standard
              </td>
              <td style="border: none; text-align: right;">
                <div style="font-size: 9pt;">For <b>${activeCompanyName}</b></div>
                <div style="margin-top: 25px; font-weight: bold; border-top: 1px solid #000; display: inline-block; min-width: 180px; text-align: center;">
                  ${signatoryName} (${signatoryTitle})
                </div>
              </td>
            </tr>
          </table>
        </div>
      </body>
      </html>
    `;

    const blob = new Blob([wordHtml], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${docNumber || "document"}.doc`;
    a.click();
    URL.revokeObjectURL(url);
    setIsSuccessAction("✓ Exported Microsoft Word Document (.doc).");
    setTimeout(() => setIsSuccessAction(null), 3000);
  };

  const handlePostToVoucher = () => {
    let targetMode: "sales" | "purchase" | "journal" = "sales";
    if (activeDocType === "purchase_order") {
      targetMode = "purchase";
    } else if (activeDocType === "debit_note" || activeDocType === "credit_note") {
      targetMode = "journal";
    }

    const voucherDraft: BuilderLedgerDraft = {
      id: `draft-${docNumber.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${Date.now()}`,
      source: "builder",
      documentType: activeDocType,
      docNumber,
      docDate,
      dueDate,
      partyName,
      partyGSTIN,
      partyAddress,
      partyPhone,
      partyEmail,
      placeOfSupply,
      isInterstate,
      items,
      calculations,
      notes,
      settlementBank: { bankName, accountNumber: bankAccount, ifsc: bankIFSC },
      authorizedSignatory: { name: signatoryName, title: signatoryTitle },
      status: "draft",
      createdAt: new Date().toISOString(),
    };

    saveBuilderDraft(voucherDraft);

    logUserActivity({
      category: "DOCUMENT",
      crud_type: "CREATE",
      action: "Document Generated",
      description: `Generated ${voucherDraft.documentType.toUpperCase()} #${voucherDraft.docNumber} for ₹${(voucherDraft.calculations.roundedTotal || voucherDraft.calculations.taxableAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })} to ${voucherDraft.partyName}`,
      entity_type: "document",
      entity_id: voucherDraft.docNumber,
      organisation_id: orgId,
      status: "success",
      metadata: {
        documentType: voucherDraft.documentType,
        total: voucherDraft.calculations.roundedTotal || voucherDraft.calculations.taxableAmount,
        partyName: voucherDraft.partyName,
        lineItemCount: voucherDraft.items.length,
      },
    });

    setIsSuccessAction(`✓ Ledger request sent as Draft (${docNumber}). Opening Voucher Desk...`);
    setTimeout(() => {
      router.push(`/vouchers?type=${targetMode}&source=builder&docNumber=${encodeURIComponent(docNumber)}`);
    }, 450);
  };

  return (
    <div className="flex h-full w-full overflow-hidden font-sans text-xs bg-[#F8FAFC] print:h-auto print:w-auto print:overflow-visible print:bg-white">
      {/* ========================================================================= */}
      {/* 1. SLIDEABLE & ADJUSTABLE SIDEBAR: DOCUMENT SELECTOR                      */}
      {/* ========================================================================= */}
      <aside
        style={{
          width: isSidebarCollapsed ? 0 : sidebarWidth,
        }}
        className={`bg-white flex flex-col shrink-0 select-none overflow-hidden transition-[width] duration-200 relative no-print ${
          isSidebarCollapsed ? "w-0 border-none pointer-events-none" : "border-r border-[#CBD5E1]"
        }`}
      >
        {/* Sidebar Header */}
        <div className="p-3 border-b border-[#CBD5E1] bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded bg-[#0A0A0A] flex items-center justify-center text-[#5BB5BB]">
              <FileText className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-bold text-xs text-slate-900 tracking-tight">Document Builder</h2>
              <p className="text-[10px] text-slate-500 font-mono">Shift+B • GST Suite</p>
            </div>
          </div>

          <button
            suppressHydrationWarning
            onClick={() => setIsSidebarCollapsed(true)}
            className="p-1 rounded text-slate-400 hover:text-slate-800 hover:bg-slate-200 transition-colors"
            title="Collapse Sidebar (Shift+B)"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        </div>

        {/* Document Navigation Menu */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Document Templates
          </div>

          {DOCUMENT_TYPES.map((doc) => {
            const Icon = doc.icon;
            const isActive = activeDocType === doc.id;

            return (
              <button
                key={doc.id}
                suppressHydrationWarning
                onClick={() => applyPresetForDocType(doc.id)}
                className={`w-full text-left p-2.5 rounded-lg border transition-all flex items-start gap-2.5 group ${
                  isActive
                    ? "bg-[#1F2324] text-white border-[#5BB5BB] shadow-sm"
                    : "bg-white hover:bg-slate-50 border-slate-200 text-slate-700"
                }`}
              >
                <div
                  className={`h-7 w-7 rounded flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                    isActive
                      ? "bg-[#5BB5BB] text-[#0A0A0A]"
                      : "bg-slate-100 text-slate-600 group-hover:bg-slate-200"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className={`font-bold text-xs truncate ${isActive ? "text-white" : "text-slate-900"}`}>
                      {doc.title}
                    </span>
                    <span className={`text-[9px] font-mono px-1 py-0.2 rounded border font-semibold ${doc.badgeColor}`}>
                      {doc.badge}
                    </span>
                  </div>
                  <p className={`text-[10px] mt-0.5 line-clamp-1 ${isActive ? "text-slate-300" : "text-slate-500"}`}>
                    {doc.subtitle}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Sidebar Footer Info */}
        <div className="p-2.5 border-t border-[#CBD5E1] bg-slate-50 text-[10px] text-slate-500 space-y-1">
          <div className="flex items-center justify-between">
            <span>Authoritative Engine:</span>
            <span className="font-mono font-bold text-slate-800">Deku OS v2.4</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Print Standard:</span>
            <span className="font-mono text-emerald-700 font-semibold">ISO A4 300DPI</span>
          </div>
        </div>
      </aside>

      {/* DRAG RESIZE HANDLE FOR SIDEBAR (Flat plane) */}
      {!isSidebarCollapsed && (
        <div
          onMouseDown={() => setIsDraggingSidebar(true)}
          className="w-1.5 hover:w-2 bg-transparent hover:bg-[#5BB5BB]/40 cursor-col-resize transition-all shrink-0 relative flex items-center justify-center select-none no-print"
          title="Drag to resize sidebar width"
        >
          <div className="h-8 w-0.5 bg-slate-300 group-hover:bg-[#5BB5BB] rounded-full" />
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. UNIFIED MAIN CONTAINER (Create / Preview / Split Toggle)                */}
      {/* ========================================================================= */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-white min-w-0 print:h-auto print:overflow-visible print:w-full print:block">
        {/* Unified Top Toolbar */}
        <header className="h-12 border-b border-[#CBD5E1] bg-slate-50/90 px-4 flex items-center justify-between gap-3 shrink-0 select-none no-print">
          {/* Left: Dedicated Sidebar Toggle + Document Title */}
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              suppressHydrationWarning
              type="button"
              onClick={() => setIsSidebarCollapsed((prev) => !prev)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs font-semibold transition-all shrink-0 ${
                isSidebarCollapsed
                  ? "bg-white border-slate-300 text-slate-700 hover:text-slate-900 hover:border-[#5BB5BB] shadow-2xs"
                  : "bg-slate-200/90 border-slate-300 text-slate-800 hover:bg-slate-300"
              }`}
              title={isSidebarCollapsed ? "Expand Templates Sidebar (Shift+B)" : "Collapse Sidebar to Full Width (Shift+B)"}
            >
              {isSidebarCollapsed ? (
                <>
                  <PanelLeft className="h-4 w-4 text-[#5BB5BB]" />
                  <span className="hidden md:inline font-mono text-[11px]">Templates</span>
                </>
              ) : (
                <>
                  <PanelLeftClose className="h-4 w-4 text-slate-700" />
                  <span className="hidden md:inline font-mono text-[11px]">Hide</span>
                </>
              )}
            </button>

            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block leading-tight truncate">
                Form Specification &amp; Builder
              </span>
              <div className="flex items-center gap-2 truncate">
                <h3 className="font-bold text-xs text-slate-900 capitalize truncate">
                  {activeDocType.replace("_", " ")} Specification
                </h3>
                <span className="font-mono text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-200 text-slate-700 shrink-0">
                  {docNumber}
                </span>
              </div>
            </div>
          </div>

          {/* Center: Segmented Viewport Switcher [Create | Preview | Split] */}
          <div className="flex items-center bg-slate-200/80 p-0.5 rounded-lg border border-slate-300 shrink-0">
            <button
              suppressHydrationWarning
              onClick={() => setViewMode("create")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold transition-all ${
                viewMode === "create"
                  ? "bg-[#1F2324] text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Edit3 className="h-3.5 w-3.5 text-[#5BB5BB]" />
              <span>Create / Edit</span>
            </button>

            <button
              suppressHydrationWarning
              onClick={() => setViewMode("preview")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold transition-all ${
                viewMode === "preview"
                  ? "bg-[#1F2324] text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Eye className="h-3.5 w-3.5 text-[#5BB5BB]" />
              <span>Preview</span>
            </button>

            <button
              suppressHydrationWarning
              onClick={() => setViewMode("split")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                viewMode === "split"
                  ? "bg-[#1F2324] text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
              title="Split View (Form & Preview side-by-side with real-time updates)"
            >
              <Columns className="h-3.5 w-3.5 text-[#5BB5BB]" />
              <span className="hidden sm:inline">Split</span>
              {viewMode === "split" && (
                <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-black/40 text-[#91D7D2]">
                  {Math.round(splitRatio)}%
                </span>
              )}
            </button>
          </div>

          {/* Right: Actions, Zoom, Download & Post to Voucher Desk */}
          <div className="flex items-center gap-2 shrink-0">
            {isSuccessAction && (
              <span className="text-emerald-700 text-[11px] font-semibold hidden md:flex items-center gap-1">
                <Check className="h-3.5 w-3.5 text-emerald-600" /> {isSuccessAction}
              </span>
            )}

            {/* Interactive Zoom Controls in Preview or Split mode */}
            {viewMode !== "create" && (
              <div className="hidden lg:flex items-center gap-1 bg-slate-100 border border-slate-200 rounded px-1 py-0.5 text-[11px] font-mono">
                <button
                  type="button"
                  onClick={() => {
                    setZoomMode((prev) => {
                      const curr = prev === "auto" ? autoScale : prev;
                      return Math.max(0.4, Number((curr - 0.1).toFixed(1)));
                    });
                  }}
                  className="p-1 hover:bg-slate-200 rounded text-slate-700 transition-colors"
                  title="Zoom Out"
                >
                  <ZoomOut className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoomMode("auto")}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    zoomMode === "auto" ? "text-[#0A0A0A] bg-white shadow-2xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                  title="Reset to Fit Width"
                >
                  {Math.round(effectiveScale * 100)}% {zoomMode === "auto" ? "(Fit)" : ""}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setZoomMode((prev) => {
                      const curr = prev === "auto" ? autoScale : prev;
                      return Math.min(1.5, Number((curr + 0.1).toFixed(1)));
                    });
                  }}
                  className="p-1 hover:bg-slate-200 rounded text-slate-700 transition-colors"
                  title="Zoom In"
                >
                  <ZoomIn className="h-3 w-3" />
                </button>
              </div>
            )}

            {/* DOWNLOAD DROPDOWN BUTTON */}
            <div className="relative" ref={downloadDropdownRef}>
              <button
                suppressHydrationWarning
                onClick={() => setIsDownloadOpen((prev) => !prev)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#1F2324] text-white hover:bg-[#2A3032] border border-[#3E4848] font-bold text-xs transition-colors shadow-xs"
              >
                <Download className="h-3.5 w-3.5 text-[#5BB5BB]" />
                <span>Download</span>
                <ChevronDown className="h-3 w-3 text-slate-400 ml-0.5" />
              </button>

              {isDownloadOpen && (
                <div className="absolute right-0 mt-1 w-56 bg-white rounded-lg shadow-xl border border-slate-200 py-1.5 z-50 text-xs">
                  <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                    Export Formats
                  </div>

                  <button
                    suppressHydrationWarning
                    onClick={handleDownloadPDF}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2 text-slate-800 transition-colors"
                  >
                    <Printer className="h-4 w-4 text-emerald-600" />
                    <div>
                      <div className="font-bold">PDF Document (.pdf)</div>
                      <div className="text-[10px] text-slate-400">Print-ready A4 PDF export</div>
                    </div>
                  </button>

                  <button
                    suppressHydrationWarning
                    onClick={handleDownloadWord}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2 text-slate-800 transition-colors"
                  >
                    <FileType className="h-4 w-4 text-blue-600" />
                    <div>
                      <div className="font-bold">Microsoft Word (.doc)</div>
                      <div className="text-[10px] text-slate-400">Formatted Word document table</div>
                    </div>
                  </button>

                  <button
                    suppressHydrationWarning
                    onClick={handleDownloadText}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2 text-slate-800 transition-colors"
                  >
                    <FileText className="h-4 w-4 text-amber-600" />
                    <div>
                      <div className="font-bold">Plain Text Ledger (.txt)</div>
                      <div className="text-[10px] text-slate-400">Standard ASCII bordered format</div>
                    </div>
                  </button>

                  <button
                    suppressHydrationWarning
                    onClick={handleDownloadJSON}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2 text-slate-800 transition-colors"
                  >
                    <FileCode className="h-4 w-4 text-purple-600" />
                    <div>
                      <div className="font-bold">Structured Schema (.json)</div>
                      <div className="text-[10px] text-slate-400">Full JSON payload &amp; calculations</div>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* Post to Voucher Page Button */}
            <Button
              suppressHydrationWarning
              variant="tally"
              size="sm"
              onClick={handlePostToVoucher}
              className="gap-1.5 text-xs font-bold px-3 py-1.5 shadow-xs"
              title="Stage document and navigate to Voucher Desk"
            >
              <ArrowRightLeft className="h-3.5 w-3.5 text-[#5BB5BB]" />
              <span className="hidden sm:inline">Post to Voucher Page</span>
              <span className="sm:hidden">Post</span>
            </Button>

            {/* Copy Coupon Code if coupon */}
            {activeDocType === "discount_coupon" && (
              <Button
                suppressHydrationWarning
                variant="outline"
                size="sm"
                onClick={copyCouponToClipboard}
                className="gap-1 font-bold text-xs"
              >
                {copiedCode ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedCode ? "Copied!" : "Copy Code"}
              </Button>
            )}

            {/* Reset */}
            <Button
              suppressHydrationWarning
              variant="outline"
              size="sm"
              onClick={() => applyPresetForDocType(activeDocType)}
              className="gap-1 text-[11px] h-7 px-2"
              title="Reset with fresh sample data"
            >
              <RotateCcw className="h-3 w-3 text-slate-500" /> Reset
            </Button>
          </div>
        </header>

        {/* =================================================================== */}
        {/* WORKSPACE VIEWPORT (Unified, Resizable & Overlap-Free)              */}
        {/* =================================================================== */}
        <div ref={mainWorkspaceRef} className="flex-1 overflow-hidden flex relative w-full h-full min-w-0 print:overflow-visible print:h-auto print:block">
          {/* ================================================================= */}
          {/* PANE 1: CREATE / EDIT FORM                                       */}
          {/* ================================================================= */}
          {(viewMode === "create" || viewMode === "split") && (
            <div
              style={{
                width: viewMode === "split" ? `${splitRatio}%` : "100%",
                flexShrink: 0,
              }}
              className="overflow-y-auto overflow-x-hidden p-6 space-y-5 bg-white min-w-0 transition-[width] duration-75 no-print"
            >
              <div className={`${viewMode === "create" ? "max-w-4xl mx-auto" : "w-full"} space-y-5`}>
                {/* Document Identification */}
                <div className="space-y-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between border-b border-slate-100 pb-2">
                    <span>Document Identification</span>
                    <span className="text-slate-400 font-mono">Series: 2026-27</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input
                      label="Document Number"
                      value={docNumber}
                      onChange={(e) => setDocNumber(e.target.value)}
                      required
                    />
                    <Input
                      label="Issue Date"
                      type="date"
                      value={docDate}
                      onChange={(e) => setDocDate(e.target.value)}
                      required
                    />
                  </div>

                  {activeDocType !== "discount_coupon" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Input
                        label="Due / Delivery Date"
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        required
                      />
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                          Place of Supply (POS)
                        </label>
                        <select
                          suppressHydrationWarning
                          value={placeOfSupply}
                          onChange={(e) => {
                            setPlaceOfSupply(e.target.value);
                            setIsInterstate(e.target.value !== "27-Maharashtra");
                          }}
                          className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-[#5BB5BB] focus:outline-none"
                        >
                          <option value="27-Maharashtra">27 - Maharashtra (Intrastate CGST+SGST)</option>
                          <option value="29-Karnataka">29 - Karnataka (Interstate IGST)</option>
                          <option value="07-Delhi">07 - Delhi (Interstate IGST)</option>
                          <option value="33-Tamil Nadu">33 - Tamil Nadu (Interstate IGST)</option>
                          <option value="24-Gujarat">24 - Gujarat (Interstate IGST)</option>
                          <option value="09-Uttar Pradesh">09 - Uttar Pradesh (Interstate IGST)</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                {/* SPECIAL SECTION: DISCOUNT COUPON FORM */}
                {activeDocType === "discount_coupon" && (
                  <div className="p-4 rounded-xl bg-purple-50/70 border border-purple-200 space-y-3">
                    <div className="flex items-center justify-between border-b border-purple-200/60 pb-2">
                      <span className="font-bold text-purple-900 text-xs flex items-center gap-1.5">
                        <Tag className="h-3.5 w-3.5 text-purple-700" /> Coupon &amp; Promotional Campaign Setup
                      </span>
                      <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-purple-200 text-purple-900">
                        Voucher
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-purple-900 mb-1">
                          Coupon Code
                        </label>
                        <div className="flex items-center gap-1">
                          <input
                            suppressHydrationWarning
                            type="text"
                            value={couponCode}
                            onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                            className="flex-1 rounded border border-purple-300 font-mono font-bold text-xs uppercase px-2 py-1.5 text-purple-950 bg-white focus:outline-none focus:border-purple-600"
                          />
                          <Button
                            suppressHydrationWarning
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setCouponCode(`PROMO${Math.floor(1000 + Math.random() * 9000)}`)}
                            className="h-8 px-2 text-[10px]"
                            title="Randomize Code"
                          >
                            🎲
                          </Button>
                        </div>
                      </div>

                      <Input
                        label="Campaign Title"
                        value={couponTitle}
                        onChange={(e) => setCouponTitle(e.target.value)}
                        required
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-purple-900 mb-1">
                          Discount Structure
                        </label>
                        <select
                          suppressHydrationWarning
                          value={discountType}
                          onChange={(e) => setDiscountType(e.target.value as "percentage" | "flat")}
                          className="w-full rounded border border-purple-300 bg-white px-2 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-purple-600"
                        >
                          <option value="percentage">Percentage Discount (%)</option>
                          <option value="flat">Flat Cash Rebate (₹)</option>
                        </select>
                      </div>

                      <Input
                        label={discountType === "percentage" ? "Discount Rate (%)" : "Flat Amount (₹)"}
                        type="number"
                        value={discountValue.toString()}
                        onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
                        required
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Input
                        label="Min Cart Value (₹)"
                        type="number"
                        value={minOrderValue.toString()}
                        onChange={(e) => setMinOrderValue(parseFloat(e.target.value) || 0)}
                      />
                      <Input
                        label="Max Discount Cap (₹)"
                        type="number"
                        value={maxDiscountCap.toString()}
                        onChange={(e) => setMaxDiscountCap(parseFloat(e.target.value) || 0)}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Input
                        label="Valid Until"
                        type="date"
                        value={couponValidUntil}
                        onChange={(e) => setCouponValidUntil(e.target.value)}
                      />
                      <Input
                        label="Usage Limit"
                        value={couponUsageLimit}
                        onChange={(e) => setCouponUsageLimit(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase text-purple-900 mb-1">
                        Redemption Scope / Terms
                      </label>
                      <textarea
                        suppressHydrationWarning
                        rows={2}
                        value={couponEligibleScope}
                        onChange={(e) => setCouponEligibleScope(e.target.value)}
                        className="w-full rounded border border-purple-300 p-2 text-xs text-slate-800 bg-white focus:outline-none focus:border-purple-600"
                      />
                    </div>
                  </div>
                )}

                {/* SPECIAL SECTION: DELIVERY CHALLAN (RULE 55) */}
                {activeDocType === "delivery_challan" && (
                  <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-200 space-y-3">
                    <div className="flex items-center justify-between border-b border-indigo-200/60 pb-2">
                      <span className="font-bold text-indigo-900 text-xs flex items-center gap-1.5">
                        <Truck className="h-3.5 w-3.5 text-indigo-700" /> GST Rule 55 Transport &amp; Vehicle Mandate
                      </span>
                      <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-indigo-200 text-indigo-900">
                        Goods in Transit
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-indigo-900 mb-1">
                          Nature of Transport
                        </label>
                        <select
                          suppressHydrationWarning
                          value={challanReason}
                          onChange={(e) => setChallanReason(e.target.value)}
                          className="w-full rounded border border-indigo-300 bg-white px-2 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-indigo-600"
                        >
                          <option value="Supply on Approval / Return">Supply on Approval / Return</option>
                          <option value="Job Work / Processing">Job Work / Processing</option>
                          <option value="Inter-Branch Stock Transit">Inter-Branch Stock Transit</option>
                          <option value="Exhibition / Demonstration">Exhibition / Demonstration</option>
                          <option value="Semi-Knocked Down Transport">Semi-Knocked Down Transport</option>
                        </select>
                      </div>

                      <Input
                        label="Vehicle / Container No"
                        placeholder="e.g. MH-02-EE-8822"
                        value={vehicleNumber}
                        onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
                        required
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Input
                        label="Transporter Name"
                        value={transporterName}
                        onChange={(e) => setTransporterName(e.target.value)}
                      />
                      <Input
                        label="E-Way Bill Number"
                        value={ewayBillNo}
                        onChange={(e) => setEwayBillNo(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                {/* Counterparty / Party Information */}
                <div className="space-y-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between border-b border-slate-100 pb-2">
                    <span>
                      {activeDocType === "purchase_order" ? "Vendor / Supplier Details" : "Customer / Bill To Details"}
                    </span>
                    <span className="text-slate-400 font-mono">Consignee</span>
                  </div>

                  <Input
                    label="Recipient Legal Name"
                    value={partyName}
                    onChange={(e) => setPartyName(e.target.value)}
                    required
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input
                      label="Recipient GSTIN"
                      placeholder="27AABCE4567F1Z8"
                      value={partyGSTIN}
                      onChange={(e) => setPartyGSTIN(e.target.value.toUpperCase())}
                    />
                    <Input
                      label="Phone Contact"
                      value={partyPhone}
                      onChange={(e) => setPartyPhone(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                      Full Registered Address
                    </label>
                    <textarea
                      suppressHydrationWarning
                      rows={2}
                      value={partyAddress}
                      onChange={(e) => setPartyAddress(e.target.value)}
                      className="w-full rounded border border-slate-300 p-2 text-xs text-slate-800 bg-white focus:border-[#5BB5BB] focus:outline-none"
                    />
                  </div>
                </div>

                {/* Line Items Table */}
                <div className="space-y-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Itemized Goods &amp; Services ({items.length})
                    </span>
                    <Button
                      suppressHydrationWarning
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddItem}
                      className="gap-1 text-[10px] h-6 px-2 text-[#5BB5BB]"
                    >
                      <Plus className="h-3 w-3" /> Add Item
                    </Button>
                  </div>

                  <div className="space-y-2.5">
                    {items.map((item, idx) => (
                      <div
                        key={item.id}
                        className="p-3 rounded-lg border border-slate-200 bg-slate-50/60 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono font-bold text-[10px] text-slate-400">#{idx + 1}</span>
                          <input
                            suppressHydrationWarning
                            type="text"
                            placeholder="Item name / description"
                            value={item.description}
                            onChange={(e) => handleItemChange(idx, "description", e.target.value)}
                            className="flex-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 font-medium focus:border-[#5BB5BB] focus:outline-none"
                          />
                          <button
                            suppressHydrationWarning
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            disabled={items.length <= 1}
                            className="text-slate-400 hover:text-rose-600 disabled:opacity-30 p-1"
                            title="Remove line"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                          <div>
                            <span className="text-[9px] text-slate-400 uppercase font-mono block">HSN/SAC</span>
                            <input
                              suppressHydrationWarning
                              type="text"
                              value={item.hsn}
                              onChange={(e) => handleItemChange(idx, "hsn", e.target.value)}
                              className="w-full rounded border border-slate-300 bg-white px-1.5 py-1 text-[11px] font-mono text-slate-800 focus:outline-none"
                            />
                          </div>

                          <div>
                            <span className="text-[9px] text-slate-400 uppercase font-mono block">Qty</span>
                            <input
                              suppressHydrationWarning
                              type="number"
                              min="1"
                              value={item.qty}
                              onChange={(e) => handleItemChange(idx, "qty", parseFloat(e.target.value) || 0)}
                              className="w-full rounded border border-slate-300 bg-white px-1.5 py-1 text-[11px] font-mono text-slate-800 focus:outline-none"
                            />
                          </div>

                          <div>
                            <span className="text-[9px] text-slate-400 uppercase font-mono block">Unit</span>
                            <input
                              suppressHydrationWarning
                              type="text"
                              value={item.unit}
                              onChange={(e) => handleItemChange(idx, "unit", e.target.value)}
                              className="w-full rounded border border-slate-300 bg-white px-1.5 py-1 text-[11px] text-slate-800 focus:outline-none"
                            />
                          </div>

                          <div>
                            <span className="text-[9px] text-slate-400 uppercase font-mono block">Rate (₹)</span>
                            <input
                              suppressHydrationWarning
                              type="number"
                              value={item.rate}
                              onChange={(e) => handleItemChange(idx, "rate", parseFloat(e.target.value) || 0)}
                              className="w-full rounded border border-slate-300 bg-white px-1.5 py-1 text-[11px] font-mono text-slate-800 focus:outline-none"
                            />
                          </div>

                          <div>
                            <span className="text-[9px] text-slate-400 uppercase font-mono block">GST %</span>
                            <select
                              suppressHydrationWarning
                              value={item.gstRate}
                              onChange={(e) => handleItemChange(idx, "gstRate", parseInt(e.target.value) || 0)}
                              className="w-full rounded border border-slate-300 bg-white px-1 py-1 text-[11px] font-mono text-slate-800 focus:outline-none"
                            >
                              <option value="0">0%</option>
                              <option value="5">5%</option>
                              <option value="12">12%</option>
                              <option value="18">18%</option>
                              <option value="28">28%</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Calculations Summary Box */}
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase">Subtotal</span>
                      <span className="font-mono font-bold text-slate-800">{formatINR(calculations.subtotal)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase">Taxable</span>
                      <span className="font-mono font-bold text-slate-800">{formatINR(calculations.taxableAmount)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase">Total GST</span>
                      <span className="font-mono font-bold text-slate-800">{formatINR(calculations.totalTax)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase">Grand Total</span>
                      <span className="font-mono font-black text-slate-950 text-sm">{formatINR(calculations.roundedTotal)}</span>
                    </div>
                  </div>
                </div>

                {/* Notes & Declarations */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-2">
                  <label className="block text-[10px] font-bold uppercase text-slate-500">
                    Terms &amp; Conditions / Commercial Notes
                  </label>
                  <textarea
                    suppressHydrationWarning
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full rounded border border-slate-300 p-2 text-xs text-slate-800 bg-white focus:border-[#5BB5BB] focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* DRAGGABLE SPLIT DIVIDER HANDLE (Adjust Container Viewport)       */}
          {/* ================================================================= */}
          {viewMode === "split" && (
            <div
              onMouseDown={() => setIsDraggingSplit(true)}
              onDoubleClick={() => setSplitRatio(50)}
              className="w-2 hover:w-2.5 bg-slate-200 hover:bg-[#5BB5BB] cursor-col-resize transition-all shrink-0 flex items-center justify-center group select-none border-x border-slate-300 no-print"
              title="Drag left/right to adjust form and preview container sizes (Double-click to reset 50/50)"
            >
              <div className="flex flex-col gap-1 items-center">
                <div className="h-1 w-1 rounded-full bg-slate-400 group-hover:bg-white" />
                <div className="h-1 w-1 rounded-full bg-slate-400 group-hover:bg-white" />
                <div className="h-1 w-1 rounded-full bg-slate-400 group-hover:bg-white" />
                <div className="h-1 w-1 rounded-full bg-slate-400 group-hover:bg-white" />
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* PANE 2: LIVE DOCUMENT PREVIEW (Auto-scaled, ZERO overlap)         */}
          {/* ================================================================= */}
          {(viewMode === "preview" || viewMode === "split") && (
            <div
              ref={previewContainerRef}
              id="document-preview-container"
              style={{
                width: viewMode === "split" ? `${100 - splitRatio}%` : "100%",
                flexShrink: 0,
              }}
              className="overflow-y-auto overflow-x-hidden p-6 flex flex-col items-center bg-slate-200/90 min-w-0 transition-[width] duration-75 relative print:p-0 print:m-0 print:bg-white print:overflow-visible print:w-full print:block"
            >
              {activeDocType === "discount_coupon" ? (
                /* LUXURY COUPON CARD (Centered, zero clipping) */
                <div
                  id="printable-coupon-wrapper"
                  className="mx-auto my-auto transition-transform duration-75 print:m-0 print:p-0 print:w-full print:block"
                  style={{
                    width: effectiveScale < 1 ? `${Math.round(620 * effectiveScale)}px` : "620px",
                    maxWidth: 620,
                    flexShrink: 0,
                  }}
                >
                  <div
                    id="printable-coupon-card"
                    className="w-[620px] bg-white rounded-2xl shadow-xl border border-slate-300 overflow-hidden print:w-full print:max-w-full print:shadow-none"
                    style={{
                      transform: effectiveScale < 1 ? `scale(${effectiveScale})` : undefined,
                      transformOrigin: "top left",
                    }}
                  >
                    <div className="bg-gradient-to-r from-[#0A0A0A] via-[#1A2526] to-[#0A0A0A] p-6 text-white relative overflow-hidden">
                      <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 opacity-15 pointer-events-none">
                        <Tag className="h-44 w-44 text-[#5BB5BB]" />
                      </div>

                      <div className="flex items-start justify-between relative z-10">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-[10px] tracking-wider uppercase px-2 py-0.5 rounded bg-[#5BB5BB] text-[#0A0A0A]">
                              Verified Business Voucher
                            </span>
                            <span className="text-slate-400 text-[10px] font-mono">FY 2026-27</span>
                          </div>
                          <h2 className="text-xl font-black mt-2 tracking-tight text-white">{couponTitle}</h2>
                          <p className="text-xs text-slate-300 mt-1">{activeCompanyName}</p>
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] uppercase tracking-wider text-slate-400 block">Voucher Value</span>
                          <span className="text-2xl font-black text-[#5BB5BB]">
                            {discountType === "percentage" ? `${discountValue}% OFF` : formatINR(discountValue)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="relative h-6 bg-slate-100 flex items-center justify-between px-3">
                      <div className="h-5 w-5 rounded-full bg-slate-200/90 -ml-5 border border-slate-300" />
                      <div className="flex-1 border-t-2 border-dashed border-slate-400 mx-4" />
                      <div className="h-5 w-5 rounded-full bg-slate-200/90 -mr-5 border border-slate-300" />
                    </div>

                    <div className="p-6 bg-white space-y-4">
                      <div className="bg-slate-50 border-2 border-dashed border-[#5BB5BB]/60 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                            Promotional Coupon Code
                          </span>
                          <div className="font-mono font-black text-2xl tracking-widest text-slate-900 select-all">
                            {couponCode}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-2">
                            <span>Min Purchase: {formatINR(minOrderValue)}</span>
                            <span>•</span>
                            <span>Max Cap: {formatINR(maxDiscountCap)}</span>
                          </div>
                        </div>

                        <Button
                          suppressHydrationWarning
                          onClick={copyCouponToClipboard}
                          variant="tally"
                          size="sm"
                          className="gap-1.5 font-bold shrink-0 text-xs px-4 py-2 no-print"
                        >
                          {copiedCode ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                          {copiedCode ? "Copied!" : "Copy Voucher"}
                        </Button>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50/70 p-3 rounded-lg border border-slate-200">
                        <div>
                          <span className="text-[10px] font-bold uppercase text-slate-400 block">Redemption Validity</span>
                          <span className="font-bold text-slate-800 flex items-center gap-1 mt-0.5">
                            <Calendar className="h-3.5 w-3.5 text-[#5BB5BB]" /> Valid until {couponValidUntil}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold uppercase text-slate-400 block">Account Eligibility</span>
                          <span className="font-bold text-slate-800 flex items-center gap-1 mt-0.5">
                            <ShieldCheck className="h-3.5 w-3.5 text-blue-600" /> {couponUsageLimit}
                          </span>
                        </div>
                      </div>

                      <div className="text-xs space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                          Scope of Application &amp; Terms
                        </span>
                        <p className="text-[11px] text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded border border-slate-200">
                          {couponEligibleScope}
                        </p>
                      </div>

                      <div className="pt-3 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                        <span>Authoritative Issuer: {activeGSTIN}</span>
                        <span>Deku Secure Coupon Engine</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* AUTHENTIC A4 DOCUMENT SHEET (Centered, zero horizontal clipping) */
                <div
                  id="printable-a4-wrapper"
                  className="mx-auto my-3 transition-transform duration-75 print:m-0 print:p-0 print:w-full print:h-auto print:block"
                  style={{
                    width: `${Math.round(794 * effectiveScale)}px`,
                    height: `${Math.round(1123 * effectiveScale)}px`,
                    flexShrink: 0,
                  }}
                >
                  <div
                    id="printable-a4-document"
                    className="w-[794px] min-h-[1123px] bg-white shadow-2xl p-8 border border-slate-300 text-slate-900 flex flex-col justify-between print:w-full print:max-w-full print:min-h-0 print:p-0 print:border-none print:shadow-none"
                    style={{
                      transform: `scale(${effectiveScale})`,
                      transformOrigin: "top left",
                      fontFamily: "system-ui, -apple-system, sans-serif",
                    }}
                  >
                    <div className="space-y-4">
                      {/* Header */}
                      <div className="flex items-start justify-between pb-4 border-b-2 border-slate-900">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-black text-xl tracking-tight text-slate-950 uppercase">
                              {activeCompanyName}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 max-w-sm mt-1">
                            Plot 104, Financial Center, Bandra Kurla Complex (BKC), Mumbai, Maharashtra — 400051
                          </p>
                          <div className="text-[10px] font-mono text-slate-700 mt-1 flex items-center gap-3">
                            <span>GSTIN: <strong>{activeGSTIN}</strong></span>
                            <span>•</span>
                            <span>PAN: <strong>AAACD1234E</strong></span>
                            <span>•</span>
                            <span>State: <strong>27 - Maharashtra</strong></span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="inline-block px-3 py-1 font-mono font-black text-sm uppercase tracking-wider bg-slate-900 text-white rounded border border-slate-900">
                            {activeDocType === "invoice" && "TAX INVOICE"}
                            {activeDocType === "quote" && "COMMERCIAL QUOTATION"}
                            {activeDocType === "proforma" && "PROFORMA INVOICE"}
                            {activeDocType === "delivery_challan" && "DELIVERY CHALLAN (RULE 55)"}
                            {activeDocType === "credit_note" && "GST CREDIT NOTE"}
                            {activeDocType === "debit_note" && "GST DEBIT NOTE"}
                            {activeDocType === "purchase_order" && "PURCHASE ORDER"}
                          </span>
                          <div className="text-[10px] text-slate-500 font-mono mt-1 whitespace-nowrap">
                            {activeDocType === "delivery_challan"
                              ? "NOT FOR SALE • TRANSIT ONLY"
                              : "ORIGINAL FOR RECIPIENT"}
                          </div>
                        </div>
                      </div>

                      {/* Metadata Grid */}
                      <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-3 rounded border border-slate-200">
                        <div className="space-y-1">
                          <div className="flex justify-between">
                            <span className="text-slate-500">Document No:</span>
                            <span className="font-mono font-bold text-slate-900">{docNumber}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Issue Date:</span>
                            <span className="font-mono text-slate-800">{docDate}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">
                              {activeDocType === "quote" ? "Valid Until:" : "Due Date:"}
                            </span>
                            <span className="font-mono text-slate-800">{dueDate}</span>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between">
                            <span className="text-slate-500">Place of Supply:</span>
                            <span className="font-semibold text-slate-900">{placeOfSupply}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Tax Type:</span>
                            <span className="font-mono font-bold text-slate-800">
                              {isInterstate ? "Interstate (IGST)" : "Intrastate (CGST + SGST)"}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Reverse Charge:</span>
                            <span className="font-mono text-slate-800">{reverseCharge ? "Yes" : "No"}</span>
                          </div>
                        </div>
                      </div>

                      {/* Logistics Strip for Delivery Challan */}
                      {activeDocType === "delivery_challan" && (
                        <div className="p-2.5 rounded bg-indigo-50 border border-indigo-200 text-xs grid grid-cols-3 gap-2">
                          <div>
                            <span className="text-[10px] font-bold text-indigo-900 uppercase block">Transport Reason</span>
                            <span className="font-medium text-slate-800">{challanReason}</span>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-indigo-900 uppercase block">Vehicle Number</span>
                            <span className="font-mono font-bold text-slate-900">{vehicleNumber}</span>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-indigo-900 uppercase block">Transporter / E-Way</span>
                            <span className="font-mono text-slate-800">{transporterName}</span>
                          </div>
                        </div>
                      )}

                      {/* Buyer / Recipient Details */}
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div className="p-3 rounded border border-slate-200 space-y-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                            {activeDocType === "purchase_order" ? "Vendor / Supplier" : "Bill To (Recipient)"}
                          </span>
                          <div className="font-bold text-slate-900">{partyName}</div>
                          <p className="text-[11px] text-slate-600 leading-tight">{partyAddress}</p>
                          <div className="text-[10px] font-mono text-slate-700 pt-1">
                            GSTIN: <strong>{partyGSTIN || "Unregistered"}</strong>
                          </div>
                        </div>

                        <div className="p-3 rounded border border-slate-200 space-y-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                            Ship To (Delivery Consignee)
                          </span>
                          <div className="font-bold text-slate-900">{partyName}</div>
                          <p className="text-[11px] text-slate-600 leading-tight">{partyAddress}</p>
                          <div className="text-[10px] text-slate-500 pt-1">
                            Contact: {partyPhone} • {partyEmail}
                          </div>
                        </div>
                      </div>

                      {/* Items Table */}
                      <div className="border border-slate-300 rounded overflow-hidden">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-100 border-b border-slate-300 font-mono text-[11px] text-slate-800">
                              <th className="py-2 px-2.5 w-8 text-center">#</th>
                              <th className="py-2 px-2.5">Item Description</th>
                              <th className="py-2 px-2 text-center w-20 whitespace-nowrap">HSN</th>
                              <th className="py-2 px-2 text-right w-16 whitespace-nowrap">Qty</th>
                              <th className="py-2 px-2 text-right w-24 whitespace-nowrap">Rate</th>
                              <th className="py-2 px-2 text-right w-16 whitespace-nowrap">Disc %</th>
                              <th className="py-2 px-2 text-right w-16 whitespace-nowrap">GST %</th>
                              <th className="py-2 px-3 text-right w-28 whitespace-nowrap">Taxable (₹)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {items.map((item, idx) => {
                              const gross = item.qty * item.rate;
                              const disc = gross * (item.discountPct / 100);
                              const taxable = gross - disc;

                              return (
                                <tr key={item.id} className="text-[11px]">
                                  <td className="py-2 px-2.5 text-center font-mono text-slate-500">{idx + 1}</td>
                                  <td className="py-2 px-2.5 font-medium text-slate-900">
                                    {item.description}
                                  </td>
                                  <td className="py-2 px-2 text-center font-mono text-slate-600 whitespace-nowrap">{item.hsn}</td>
                                  <td className="py-2 px-2 text-right font-mono whitespace-nowrap">
                                    {item.qty} {item.unit}
                                  </td>
                                  <td className="py-2 px-2 text-right font-mono whitespace-nowrap">{formatINR(item.rate, { showCurrencySymbol: false })}</td>
                                  <td className="py-2 px-2 text-right font-mono text-slate-500 whitespace-nowrap">
                                    {item.discountPct > 0 ? `${item.discountPct}%` : "—"}
                                  </td>
                                  <td className="py-2 px-2 text-right font-mono text-slate-600 whitespace-nowrap">{item.gstRate}%</td>
                                  <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                                    {formatINR(taxable, { showCurrencySymbol: false })}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Calculation Summary Block */}
                      <div className="grid grid-cols-2 gap-6 pt-2">
                        <div className="space-y-3">
                          <div className="p-3 rounded bg-slate-50 border border-slate-200 text-xs">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                              Bank Details for Direct Settlement
                            </span>
                            <div className="space-y-0.5 text-[11px] text-slate-700 font-mono">
                              <div>Bank: <strong>{bankName}</strong></div>
                              <div>A/c No: <strong>{bankAccount}</strong></div>
                              <div>IFSC: <strong>{bankIFSC}</strong></div>
                              <div>Branch: BKC Corporate Towers, Mumbai</div>
                            </div>
                          </div>

                          <div className="text-[11px] text-slate-600 space-y-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                              Commercial Terms
                            </span>
                            <p className="whitespace-pre-line leading-relaxed text-[10px] text-slate-500">
                              {notes}
                            </p>
                          </div>
                        </div>

                        <div className="space-y-1.5 text-xs">
                          <div className="flex justify-between py-1 border-b border-slate-200">
                            <span className="text-slate-600">Subtotal (Gross Item Total):</span>
                            <span className="font-mono text-slate-800">{formatINR(calculations.subtotal)}</span>
                          </div>

                          {calculations.totalDiscount > 0 && (
                            <div className="flex justify-between py-1 border-b border-slate-200 text-emerald-700">
                              <span>Less Discount:</span>
                              <span className="font-mono">- {formatINR(calculations.totalDiscount)}</span>
                            </div>
                          )}

                          <div className="flex justify-between py-1 border-b border-slate-200 font-semibold">
                            <span>Total Taxable Value:</span>
                            <span className="font-mono text-slate-900">{formatINR(calculations.taxableAmount)}</span>
                          </div>

                          {isInterstate ? (
                            <div className="flex justify-between py-1 border-b border-slate-200 text-slate-600">
                              <span>Integrated Tax (IGST):</span>
                              <span className="font-mono">{formatINR(calculations.totalIgst)}</span>
                            </div>
                          ) : (
                            <>
                              <div className="flex justify-between py-1 border-b border-slate-200 text-slate-600">
                                <span>Central Tax (CGST):</span>
                                <span className="font-mono">{formatINR(calculations.totalCgst)}</span>
                              </div>
                              <div className="flex justify-between py-1 border-b border-slate-200 text-slate-600">
                                <span>State Tax (SGST):</span>
                                <span className="font-mono">{formatINR(calculations.totalSgst)}</span>
                              </div>
                            </>
                          )}

                          {calculations.roundOff !== 0 && (
                            <div className="flex justify-between py-1 border-b border-slate-200 text-slate-500 text-[11px]">
                              <span>Round Off:</span>
                              <span className="font-mono">{formatINR(calculations.roundOff)}</span>
                            </div>
                          )}

                          <div className="flex justify-between py-2 border-t-2 border-b-2 border-slate-900 font-bold text-sm bg-slate-50 px-2 rounded">
                            <span className="uppercase text-slate-950">Grand Total (INR):</span>
                            <span className="font-mono text-slate-950 text-base">{formatINR(calculations.roundedTotal)}</span>
                          </div>

                          <div className="pt-1 text-[10px] text-slate-600 italic">
                            <strong>Amount in Words:</strong> {calculations.words}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Signatory */}
                    <div className="pt-6 border-t border-slate-300 mt-6 flex items-end justify-between text-xs">
                      <div className="text-[10px] text-slate-400 space-y-0.5 font-mono">
                        <div>Deku Financial Technologies Operating System</div>
                        <div>Digitally verified against PostgreSQL Double-Entry Ledger</div>
                        <div>This document is generated automatically under Rule 55 / Section 31 of CGST Act.</div>
                      </div>

                      <div className="text-right space-y-1">
                        <div className="text-[10px] text-slate-500 font-semibold">
                          For <strong>{activeCompanyName}</strong>
                        </div>
                        <div className="h-12 flex items-center justify-end pr-4 text-slate-400 italic font-mono text-[11px]">
                          [Authorized Digital Seal]
                        </div>
                        <div className="font-bold text-slate-900 border-t border-slate-400 pt-1 w-48 text-center ml-auto">
                          {signatoryName}
                        </div>
                        <div className="text-[10px] text-slate-500 text-center w-48 ml-auto">
                          {signatoryTitle}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
