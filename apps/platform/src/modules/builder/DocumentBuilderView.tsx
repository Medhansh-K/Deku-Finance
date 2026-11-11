"use client";

import { businessDocumentsApi, partiesApi } from "@/api/endpoints";
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
  Save,
  List,
  Shuffle,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { formatINR } from "@/lib/formatters/currency";
import { numberToIndianWords } from "@/lib/builder/number-to-words";
import { logUserActivity } from "@/lib/logging/activity-logger";
import { useAuth } from "@/context/AuthContext";
import { toISODateString } from "@/lib/formatters/date";
import { GST_STATES, placeOfSupplyLabel, stateCodeOf } from "@/lib/invoices/tax-summary";
import {
  BusinessDocStatus,
  BuilderForm,
  BusinessDocType,
  BusinessDocument,
  blankLine,
  formErrors,
  formatAddress,
  fromDocument,
  snapshotFromParty,
  summarise,
  toSavePayload,
} from "@/lib/builder/business-documents";
import type { Party } from "@/types/accounting";
import { BusinessDocumentsRegister } from "./BusinessDocumentsRegister";

// Invoices and credit/debit notes live in the GST hub (they post to the ledger); a coupon is print-only.
export type DocumentType = BusinessDocType | "invoice" | "discount_coupon" | "credit_note" | "debit_note";
const GST_HUB_TYPES: ReadonlyArray<DocumentType> = ["invoice", "credit_note", "debit_note"];
const isBusinessType = (t: DocumentType): t is BusinessDocType =>
  t === "quotation" || t === "proforma" || t === "purchase_order" || t === "delivery_challan";

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
    title: "Tax invoice",
    subtitle: "Raised in the GST hub so it reaches the ledger and returns",
    icon: FileText,
    badge: "GST hub",
    badgeColor: "bg-canvas-sunken text-ink-soft",
  },
  {
    id: "quotation",
    title: "Commercial quote",
    subtitle: "Formal quotation & estimate with validity terms",
    icon: FileCheck,
    badge: "Proposal",
    badgeColor: "bg-canvas-sunken text-ink-soft",
  },
  {
    id: "discount_coupon",
    title: "Discount coupon",
    subtitle: "Promotional voucher, campaign codes & rebate cards",
    icon: Tag,
    badge: "Marketing",
    badgeColor: "bg-canvas-sunken text-ink-soft",
  },
  {
    id: "proforma",
    title: "Proforma invoice",
    subtitle: "Advance commercial invoice prior to goods dispatch",
    icon: Receipt,
    badge: "Advance",
    badgeColor: "bg-canvas-sunken text-ink-soft",
  },
  {
    id: "delivery_challan",
    title: "Delivery challan",
    subtitle: "Rule 55 goods transport, job work & approval transit",
    icon: Truck,
    badge: "Rule 55",
    badgeColor: "bg-canvas-sunken text-ink-soft",
  },
  {
    id: "credit_note",
    title: "Credit note",
    subtitle: "Raised in the GST hub against an issued invoice",
    icon: FileMinus,
    badge: "Adjustment",
    badgeColor: "bg-canvas-sunken text-ink-soft",
  },
  {
    id: "debit_note",
    title: "Debit note",
    subtitle: "Raised in the GST hub against an issued invoice",
    icon: FilePlus,
    badge: "Adjustment",
    badgeColor: "bg-canvas-sunken text-ink-soft",
  },
  {
    id: "purchase_order",
    title: "Purchase order (PO)",
    subtitle: "Vendor procurement order with delivery milestones",
    icon: ShoppingCart,
    badge: "Procure",
    badgeColor: "bg-canvas-sunken text-ink-soft",
  },
];

// Shared class strings for the builder chrome (premium UI tokens). The printed sheets keep their own layout.
const KEYCAP = "font-mono text-[11px] leading-none px-1.5 pt-[3px] pb-[2px] rounded-[5px] border border-b-2 bg-surface shrink-0";
const SEG = "flex items-center gap-1.5 h-8 px-3 rounded-[7px] text-[13px] font-medium transition-colors";
const SEG_ON = "bg-surface text-ink shadow-[0_0_0_1px_var(--color-line)]";
const SEG_OFF = "text-ink-muted hover:text-ink";
const CTL = "h-9 min-w-0 rounded-ctl border border-line-strong bg-surface px-3 text-[13.5px] text-ink placeholder:text-ink-subtle focus:border-brand focus:outline-none focus:ring-3 focus:ring-brand/20";
const TEXTAREA = "w-full rounded-ctl border border-line-strong bg-surface px-3 py-2 text-[13.5px] text-ink focus:border-brand focus:outline-none focus:ring-3 focus:ring-brand/20";
const LABEL = "block text-[13px] font-medium text-ink-soft mb-1";
const MINI_LABEL = "block text-[12.5px] text-ink-muted mb-1";
const CHIP = "inline-flex items-center h-[22px] px-2 rounded-chip text-xs font-medium";
const PANEL = "rounded-panel border border-line bg-surface";
const PANEL_HEAD = "flex items-center justify-between gap-3 px-5 pt-4";
const PANEL_TITLE = "text-[15px] font-semibold tracking-tight text-ink";
const MENU_ITEM = "w-full text-left px-2.5 py-2 rounded-ctl hover:bg-canvas flex items-center gap-3 transition-colors";
const MENU_ICON = "h-8 w-8 rounded-[8px] bg-canvas-sunken text-ink-soft grid place-items-center shrink-0";

export function DocumentBuilderView() {
  const router = useRouter();
  const { organisation } = useAuth();
  const [activeDocType, setActiveDocType] = useState<DocumentType>("quotation");
  // Issuer details printed on documents come from the company profile, never a placeholder.
  const orgId = organisation?.id ?? "";
  const activeCompanyName = organisation?.legal_name || organisation?.name || "";
  const activeGSTIN = organisation?.gstin ?? "";
  // PAN and state code are embedded in the GSTIN (chars 3-12 and 1-2).
  const activePAN = organisation?.pan || activeGSTIN.slice(2, 12);
  const activeStateCode = stateCodeOf(activeGSTIN) || organisation?.state_code || "";
  const activeStateLabel = placeOfSupplyLabel(activeStateCode) || activeStateCode;
  const companyAddress = formatAddress(organisation?.registered_address);
  const bankName = organisation?.bank_name ?? "";
  const bankAccount = organisation?.bank_account_number ?? "";
  const bankIFSC = organisation?.bank_ifsc ?? "";
  const upiId = organisation?.upi_vpa ?? "";
  const [docId, setDocId] = useState<string | null>(null);
  const [docStatus, setDocStatus] = useState<BusinessDocStatus>("draft");
  const [formErrs, setFormErrs] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [parties, setParties] = useState<Party[]>([]);
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
  const [docNumber, setDocNumber] = useState<string>("");
  const [docDate, setDocDate] = useState<string>(() => toISODateString());
  const [dueDate, setDueDate] = useState<string>("");
  const [placeOfSupply, setPlaceOfSupply] = useState<string>("");
  // Same rule as the invoice editor: supplier state vs place of supply.
  const posCode = stateCodeOf(placeOfSupply);
  const isInterstate = !!activeStateCode && !!posCode && activeStateCode !== posCode;
  const reverseCharge = false;

  // Counterparty / Party Details
  const [partyId, setPartyId] = useState<string>("");
  const [partyName, setPartyName] = useState<string>("");
  const [partyGSTIN, setPartyGSTIN] = useState<string>("");
  const [partyAddress, setPartyAddress] = useState<string>("");
  const [partyEmail, setPartyEmail] = useState<string>("");
  const [partyPhone, setPartyPhone] = useState<string>("");

  // Discount Coupon Specific State
  const [couponCode, setCouponCode] = useState<string>("");
  const [couponTitle, setCouponTitle] = useState<string>("");
  const [discountType, setDiscountType] = useState<"percentage" | "flat">("percentage");
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [minOrderValue, setMinOrderValue] = useState<number>(0);
  const [maxDiscountCap, setMaxDiscountCap] = useState<number>(0);
  const [couponValidUntil, setCouponValidUntil] = useState<string>("");
  const [couponUsageLimit, setCouponUsageLimit] = useState<string>("");
  const [couponEligibleScope, setCouponEligibleScope] = useState<string>("");

  // Delivery Challan Specific State
  const [challanReason, setChallanReason] = useState<string>("");
  const [vehicleNumber, setVehicleNumber] = useState<string>("");
  const [transporterName, setTransporterName] = useState<string>("");
  const [ewayBillNo, setEwayBillNo] = useState<string>("");

  // Line Items
  const [items, setItems] = useState<DocumentLineItem[]>([blankLine("line-1")]);


  // Notes, Bank Details & Signatory
  const [notes, setNotes] = useState<string>("");
  const signatoryName = "";
  const signatoryTitle = "";

  useEffect(() => {
    if (!orgId) return;
    partiesApi
      .list(orgId)
      .then((res) => setParties(res.data || []))
      .catch(() => setParties([]));
  }, [orgId]);

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

  // Start a fresh, blank document of the chosen type. Statutory wording only, no sample terms.
  const applyPresetForDocType = (type: DocumentType) => {
    if (GST_HUB_TYPES.includes(type)) {
      router.push("/gst");
      return;
    }
    setActiveDocType(type);
    setDocId(null);
    setDocStatus("draft");
    setFormErrs([]);
    setDocNumber("");
    setDocDate(toISODateString());
    setDueDate("");
    setPlaceOfSupply("");
    setPartyId("");
    setPartyName("");
    setPartyGSTIN("");
    setPartyAddress("");
    setPartyEmail("");
    setPartyPhone("");
    setChallanReason("");
    setVehicleNumber("");
    setTransporterName("");
    setEwayBillNo("");
    setItems([blankLine(`line-${Date.now()}`)]);
    setNotes(
      type === "proforma"
        ? "This is a proforma invoice, not a tax invoice."
        : type === "delivery_challan"
          ? "Delivery challan under Rule 55 of the CGST Rules, 2017."
          : ""
    );
  };

  const loadDocument = (doc: BusinessDocument) => {
    const f = fromDocument(doc);
    setActiveDocType(f.docType);
    setDocId(doc.id);
    setDocStatus(doc.status);
    setFormErrs([]);
    setDocNumber(f.docNumber);
    setDocDate(f.docDate);
    setDueDate(f.dueDate);
    setPlaceOfSupply(f.placeOfSupply);
    setPartyId(f.partyId);
    setPartyName(f.party.name ?? "");
    setPartyGSTIN(f.party.gstin ?? "");
    setPartyAddress(f.party.address ?? "");
    setPartyPhone(f.party.phone ?? "");
    setPartyEmail(f.party.email ?? "");
    setChallanReason(f.details.reason ?? "");
    setVehicleNumber(f.details.vehicle ?? "");
    setTransporterName(f.details.transporter ?? "");
    setEwayBillNo(f.details.eway_bill ?? "");
    setNotes(f.notes);
    setItems(f.items.length ? f.items : [blankLine("line-1")]);
    setShowRegister(false);
  };

  const choosePartyRecord = (id: string) => {
    setPartyId(id);
    const p = parties.find((x) => x.id === id);
    if (!p) return;
    const snap = snapshotFromParty(p);
    setPartyName(snap.name ?? "");
    setPartyGSTIN(snap.gstin ?? "");
    setPartyAddress(snap.address ?? "");
    setPartyPhone(snap.phone ?? "");
    setPartyEmail(snap.email ?? "");
    const code = stateCodeOf(p.gstin);
    if (code) setPlaceOfSupply(placeOfSupplyLabel(code));
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
      blankLine(`line-${Date.now()}`),
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Calculation Math: the invoice editor's paise maths, so a converted quotation issues unchanged.
  const calculations = useMemo(() => {
    const t = summarise(items, isInterstate);
    const subtotal = items.reduce((sum, i) => sum + (i.qty || 0) * (i.rate || 0), 0);
    const taxableAmount = t.taxable / 100;
    const totalTax = (t.cgst + t.sgst + t.igst + t.cess) / 100;

    let couponDiscount = 0;
    if (activeDocType === "discount_coupon") {
      couponDiscount =
        discountType === "percentage"
          ? Math.min(taxableAmount * (discountValue / 100), maxDiscountCap)
          : Math.min(discountValue, taxableAmount);
    }
    const finalAmount = Math.max(0, taxableAmount + totalTax - couponDiscount);
    const roundedTotal = couponDiscount ? Math.round(finalAmount) : t.grandTotal / 100;
    const roundOff = couponDiscount ? roundedTotal - finalAmount : t.roundOff / 100;

    return {
      subtotal,
      totalDiscount: subtotal - taxableAmount,
      taxableAmount,
      totalCgst: t.cgst / 100,
      totalSgst: t.sgst / 100,
      totalIgst: t.igst / 100,
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
        pan: activePAN,
        address: companyAddress,
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
    setIsSuccessAction("Exported JSON.");
    setTimeout(() => setIsSuccessAction(null), 3000);
  };

  const handleDownloadText = () => {
    setIsDownloadOpen(false);
    const border = "=".repeat(78);
    const divider = "-".repeat(78);
    const lines = [
      border,
      `                      ${activeCompanyName.toUpperCase()}`,
      `        ${companyAddress}`,
      `        GSTIN: ${activeGSTIN}  |  PAN: ${activePAN}  |  State: ${activeStateCode}`,
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
      ` Bank Settlement: ${bankName} | A/c: ${bankAccount} | IFSC: ${bankIFSC}${upiId ? ` | UPI: ${upiId}` : ""}`,
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
    setIsSuccessAction("Exported plain text (.txt).");
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
                <div>${companyAddress}</div>
                <div>GSTIN: <b>${activeGSTIN}</b> | PAN: <b>${activePAN}</b> | State: <b>${activeStateCode}</b></div>
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
                IFSC: ${bankIFSC}${upiId ? `<br/>UPI: ${upiId}` : ""}
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
    setIsSuccessAction("Exported Word document (.doc).");
    setTimeout(() => setIsSuccessAction(null), 3000);
  };

  const handleSave = async () => {
    if (!isBusinessType(activeDocType) || !orgId) return;
    const form: BuilderForm = {
      docType: activeDocType,
      docNumber,
      docDate,
      dueDate,
      partyId,
      party: { name: partyName, gstin: partyGSTIN, address: partyAddress, phone: partyPhone, email: partyEmail },
      placeOfSupply,
      interState: isInterstate,
      notes,
      details:
        activeDocType === "delivery_challan"
          ? { reason: challanReason, vehicle: vehicleNumber, transporter: transporterName, eway_bill: ewayBillNo }
          : {},
      items,
    };
    const errs = formErrors(form);
    setFormErrs(errs);
    if (errs.length) return;

    setIsSaving(true);
    try {
      const payload = toSavePayload(form);
      const res = docId
        ? await businessDocumentsApi.update(orgId, docId, payload)
        : await businessDocumentsApi.create(orgId, payload);
      const saved = res.data;
      setDocId(saved.id);
      setDocStatus(saved.status);
      logUserActivity({
        category: "DOCUMENT",
        crud_type: docId ? "UPDATE" : "CREATE",
        action: "Document Saved",
        description: `Saved ${saved.doc_type} ${saved.doc_number}`,
        entity_type: "business_document",
        entity_id: saved.id,
        organisation_id: orgId,
        status: "success",
      });
      setIsSuccessAction(`Saved ${saved.doc_number} as a draft.`);
      setTimeout(() => setIsSuccessAction(null), 3000);
    } catch (err) {
      setFormErrs([err instanceof Error ? err.message : "Couldn't save the document."]);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex h-full w-full overflow-hidden text-[13.5px] text-ink bg-canvas print:h-auto print:w-auto print:overflow-visible print:bg-white">
      {/* ========================================================================= */}
      {/* 1. SLIDEABLE & ADJUSTABLE SIDEBAR: DOCUMENT SELECTOR                      */}
      {/* ========================================================================= */}
      <aside
        style={{
          width: isSidebarCollapsed ? 0 : sidebarWidth,
        }}
        className={`bg-surface flex flex-col shrink-0 select-none overflow-hidden transition-[width] duration-200 relative no-print ${
          isSidebarCollapsed ? "w-0 border-none pointer-events-none" : "border-r border-line"
        }`}
      >
        {/* Sidebar Header */}
        <div className="px-4 py-3.5 border-b border-line flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <span className="h-8 w-8 rounded-[8px] bg-brand-wash text-brand-strong grid place-items-center shrink-0">
              <FileText className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h2 className="text-[15px] font-semibold tracking-tight text-ink truncate">Document builder</h2>
              <p className="text-[12.5px] text-ink-muted flex items-center gap-1.5">
                Hide or show <kbd className={`${KEYCAP} border-line-strong text-ink-muted`}>Shift B</kbd>
              </p>
            </div>
          </div>

          <button
            suppressHydrationWarning
            onClick={() => setIsSidebarCollapsed(true)}
            className="p-1.5 rounded-ctl text-ink-muted hover:text-ink hover:bg-canvas-sunken transition-colors"
            title="Collapse sidebar (Shift+B)"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        </div>

        {/* Document Navigation Menu */}
        <div data-tour="builder-templates" className="flex-1 overflow-y-auto p-2 space-y-0.5">
          <div className="px-2 pt-1.5 pb-1 text-[12.5px] font-medium text-ink-muted">
            Templates
          </div>

          {DOCUMENT_TYPES.map((doc) => {
            const Icon = doc.icon;
            const isActive = activeDocType === doc.id;

            return (
              <button
                key={doc.id}
                suppressHydrationWarning
                onClick={() => applyPresetForDocType(doc.id)}
                className={`w-full text-left px-2 py-2 rounded-ctl transition-colors flex items-start gap-3 ${
                  isActive
                    ? "bg-brand-wash shadow-[inset_3px_0_0_var(--color-brand)]"
                    : "hover:bg-canvas"
                }`}
              >
                <span
                  className={`h-8 w-8 rounded-[8px] grid place-items-center shrink-0 ${
                    isActive ? "bg-surface text-brand-strong" : "bg-canvas-sunken text-ink-soft"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-1.5">
                    <span className={`text-[14px] font-[550] truncate ${isActive ? "text-ink" : "text-ink-soft"}`}>
                      {doc.title}
                    </span>
                    <span className={`inline-flex items-center h-5 px-1.5 rounded-chip text-xs font-medium shrink-0 ${doc.badgeColor}`}>
                      {doc.badge}
                    </span>
                  </span>
                  <span className="block text-[12.5px] text-ink-muted mt-0.5 line-clamp-1">
                    {doc.subtitle}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {/* Sidebar Footer Info */}
        <div className="px-4 py-3 border-t border-line text-[12.5px] text-ink-muted space-y-1">
          <div className="flex items-center justify-between">
            <span>Engine</span>
            <span className="text-ink-soft">Deku OS v2.4</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Print size</span>
            <span className="text-ink-soft">A4</span>
          </div>
        </div>
      </aside>

      {/* DRAG RESIZE HANDLE FOR SIDEBAR (Flat plane) */}
      {!isSidebarCollapsed && (
        <div
          onMouseDown={() => setIsDraggingSidebar(true)}
          className="w-1.5 hover:w-2 bg-transparent hover:bg-brand/30 cursor-col-resize transition-all shrink-0 relative flex items-center justify-center select-none no-print"
          title="Drag to resize sidebar width"
        >
          <div className="h-8 w-0.5 bg-line-strong rounded-full" />
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. UNIFIED MAIN CONTAINER (Create / Preview / Split Toggle)                */}
      {/* ========================================================================= */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-canvas min-w-0 print:h-auto print:overflow-visible print:w-full print:block">
        {/* Unified Top Toolbar */}
        <header className="h-14 border-b border-line bg-surface px-4 flex items-center justify-between gap-3 shrink-0 select-none no-print">
          {/* Left: Dedicated Sidebar Toggle + Document Title */}
          <div className="flex items-center gap-3 min-w-0">
            <Button
              suppressHydrationWarning
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsSidebarCollapsed((prev) => !prev)}
              className="shrink-0"
              title={isSidebarCollapsed ? "Expand templates sidebar (Shift+B)" : "Collapse sidebar to full width (Shift+B)"}
            >
              {isSidebarCollapsed ? (
                <>
                  <PanelLeft className="h-4 w-4 text-brand-strong" />
                  <span className="hidden md:inline">Templates</span>
                </>
              ) : (
                <>
                  <PanelLeftClose className="h-4 w-4" />
                  <span className="hidden md:inline">Hide</span>
                </>
              )}
            </Button>

            <div className="min-w-0 flex items-center gap-2">
              <h3 className="text-[15px] font-semibold tracking-tight text-ink truncate">
                {DOCUMENT_TYPES.find((d) => d.id === activeDocType)?.title ?? activeDocType.replace("_", " ")}
              </h3>
              <span className="inline-flex items-center h-[22px] px-2 rounded-chip font-mono text-[12px] bg-canvas-sunken text-ink-soft shrink-0">
                {docNumber || "unnumbered"}
              </span>
              {docId && (
                <Badge variant={docStatus === "draft" ? "warning" : "teal"} className="capitalize">
                  {docStatus}
                </Badge>
              )}
            </div>
          </div>

          {/* Center: Segmented Viewport Switcher [Create | Preview | Split] */}
          <div className="flex items-center gap-0.5 p-0.5 rounded-ctl bg-canvas-sunken shrink-0">
            <button
              suppressHydrationWarning
              onClick={() => setViewMode("create")}
              className={`${SEG} ${viewMode === "create" ? SEG_ON : SEG_OFF}`}
            >
              <Edit3 className="h-3.5 w-3.5" />
              <span>Edit</span>
            </button>

            <button
              suppressHydrationWarning
              onClick={() => setViewMode("preview")}
              className={`${SEG} ${viewMode === "preview" ? SEG_ON : SEG_OFF}`}
            >
              <Eye className="h-3.5 w-3.5" />
              <span>Preview</span>
            </button>

            <button
              suppressHydrationWarning
              onClick={() => setViewMode("split")}
              className={`${SEG} ${viewMode === "split" ? SEG_ON : SEG_OFF}`}
              title="Split view (form and preview side by side, updating live)"
            >
              <Columns className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Split</span>
              {viewMode === "split" && (
                <span className="text-xs text-ink-muted tabular-nums">{Math.round(splitRatio)}%</span>
              )}
            </button>
          </div>

          {/* Right: Actions, Zoom, Download & Post to Voucher Desk */}
          <div className="flex items-center gap-2 shrink-0">
            {isSuccessAction && (
              <span className="text-ok text-[12.5px] font-medium hidden md:flex items-center gap-1">
                <Check className="h-3.5 w-3.5" /> {isSuccessAction}
              </span>
            )}

            {/* Interactive Zoom Controls in Preview or Split mode */}
            {viewMode !== "create" && (
              <div className="hidden lg:flex items-center gap-0.5 rounded-ctl border border-line bg-surface p-0.5 text-[12.5px]">
                <button
                  type="button"
                  onClick={() => {
                    setZoomMode((prev) => {
                      const curr = prev === "auto" ? autoScale : prev;
                      return Math.max(0.4, Number((curr - 0.1).toFixed(1)));
                    });
                  }}
                  className="p-1.5 rounded-[6px] text-ink-soft hover:bg-canvas-sunken transition-colors"
                  title="Zoom out"
                >
                  <ZoomOut className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoomMode("auto")}
                  className={`h-7 px-2 rounded-[6px] font-medium tabular-nums ${
                    zoomMode === "auto" ? "bg-canvas-sunken text-ink" : "text-ink-muted hover:text-ink"
                  }`}
                  title="Reset to fit width"
                >
                  {Math.round(effectiveScale * 100)}% {zoomMode === "auto" ? "(fit)" : ""}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setZoomMode((prev) => {
                      const curr = prev === "auto" ? autoScale : prev;
                      return Math.min(1.5, Number((curr + 0.1).toFixed(1)));
                    });
                  }}
                  className="p-1.5 rounded-[6px] text-ink-soft hover:bg-canvas-sunken transition-colors"
                  title="Zoom in"
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* DOWNLOAD DROPDOWN BUTTON */}
            <div data-tour="builder-download" className="relative" ref={downloadDropdownRef}>
              <Button
                suppressHydrationWarning
                variant="primary"
                size="sm"
                onClick={() => setIsDownloadOpen((prev) => !prev)}
                aria-expanded={isDownloadOpen}
              >
                <Download className="h-3.5 w-3.5" />
                <span>Download</span>
                <ChevronDown className="h-3.5 w-3.5 opacity-70" />
              </Button>

              {isDownloadOpen && (
                <div className="absolute right-0 mt-1.5 w-64 rounded-panel border border-line bg-surface shadow-pop p-1.5 z-50">
                  <div className="px-2.5 pt-1 pb-1.5 text-[12.5px] font-medium text-ink-muted">
                    Export format
                  </div>

                  <button
                    suppressHydrationWarning
                    onClick={handleDownloadPDF}
                    className={MENU_ITEM}
                  >
                    <span className={MENU_ICON}><Printer className="h-4 w-4" /></span>
                    <span>
                      <span className="block text-[14px] font-[550] text-ink">PDF (.pdf)</span>
                      <span className="block text-[12.5px] text-ink-muted">Print-ready A4</span>
                    </span>
                  </button>

                  <button
                    suppressHydrationWarning
                    onClick={handleDownloadWord}
                    className={MENU_ITEM}
                  >
                    <span className={MENU_ICON}><FileType className="h-4 w-4" /></span>
                    <span>
                      <span className="block text-[14px] font-[550] text-ink">Microsoft Word (.doc)</span>
                      <span className="block text-[12.5px] text-ink-muted">Formatted Word table</span>
                    </span>
                  </button>

                  <button
                    suppressHydrationWarning
                    onClick={handleDownloadText}
                    className={MENU_ITEM}
                  >
                    <span className={MENU_ICON}><FileText className="h-4 w-4" /></span>
                    <span>
                      <span className="block text-[14px] font-[550] text-ink">Plain text (.txt)</span>
                      <span className="block text-[12.5px] text-ink-muted">Bordered text layout</span>
                    </span>
                  </button>

                  <button
                    suppressHydrationWarning
                    onClick={handleDownloadJSON}
                    className={MENU_ITEM}
                  >
                    <span className={MENU_ICON}><FileCode className="h-4 w-4" /></span>
                    <span>
                      <span className="block text-[14px] font-[550] text-ink">Structured data (.json)</span>
                      <span className="block text-[12.5px] text-ink-muted">Full payload and calculations</span>
                    </span>
                  </button>
                </div>
              )}
            </div>

            <Button
              suppressHydrationWarning
              variant="outline"
              size="sm"
              onClick={() => setShowRegister((v) => !v)}
              title="Saved quotations, proformas, purchase orders and challans"
            >
              <List className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{showRegister ? "Back to builder" : "Documents"}</span>
            </Button>

            {isBusinessType(activeDocType) && (
              <Button
                suppressHydrationWarning
                variant="tally"
                size="sm"
                onClick={handleSave}
                isLoading={isSaving}
                disabled={docStatus !== "draft" || !orgId}
                title={docStatus === "draft" ? "Save this document as a draft" : `This document is ${docStatus}; only drafts can be edited`}
              >
                <Save className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{docId ? "Save changes" : "Save draft"}</span>
                <span className="sm:hidden">Save</span>
              </Button>
            )}

            {/* Copy Coupon Code if coupon */}
            {activeDocType === "discount_coupon" && (
              <Button
                suppressHydrationWarning
                variant="outline"
                size="sm"
                onClick={copyCouponToClipboard}
              >
                {copiedCode ? <Check className="h-3.5 w-3.5 text-ok" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedCode ? "Copied" : "Copy code"}
              </Button>
            )}

            {/* Reset */}
            <Button
              suppressHydrationWarning
              variant="ghost"
              size="sm"
              onClick={() => applyPresetForDocType(activeDocType)}
              title="Start a new blank document"
            >
              <RotateCcw className="h-3.5 w-3.5" /> New
            </Button>
          </div>
        </header>

        {/* =================================================================== */}
        {/* WORKSPACE VIEWPORT (Unified, Resizable & Overlap-Free)              */}
        {/* =================================================================== */}
        {formErrs.length > 0 && !showRegister && (
          <div role="alert" className="mx-4 mt-3 px-3.5 py-3 rounded-ctl bg-bad-wash text-[13px] text-bad space-y-0.5 no-print">
            {formErrs.map((m) => (
              <div key={m}>{m}</div>
            ))}
          </div>
        )}
        {showRegister && (
          <div className="flex-1 overflow-y-auto p-5 bg-canvas no-print">
            <BusinessDocumentsRegister orgId={orgId} onOpen={loadDocument} />
          </div>
        )}
        <div ref={mainWorkspaceRef} className={`flex-1 overflow-hidden flex relative w-full h-full min-w-0 print:overflow-visible print:h-auto print:block ${showRegister ? "hidden" : ""}`}>
          {/* ================================================================= */}
          {/* PANE 1: CREATE / EDIT FORM                                       */}
          {/* ================================================================= */}
          {(viewMode === "create" || viewMode === "split") && (
            <div
              style={{
                width: viewMode === "split" ? `${splitRatio}%` : "100%",
                flexShrink: 0,
              }}
              className="overflow-y-auto overflow-x-hidden p-6 space-y-5 bg-canvas min-w-0 transition-[width] duration-75 no-print"
            >
              <div className={`${viewMode === "create" ? "max-w-4xl mx-auto" : "w-full"} space-y-4`}>
                {/* Document Identification */}
                <section className={PANEL}>
                  <div className={PANEL_HEAD}>
                    <h4 className={PANEL_TITLE}>Document details</h4>
                    <span className="text-[12.5px] text-ink-muted">Series 2026-27</span>
                  </div>

                  <div className="p-5 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Input
                        label="Document number"
                        value={docNumber}
                        onChange={(e) => setDocNumber(e.target.value)}
                        className="font-mono"
                        required
                      />
                      <Input
                        label="Issue date"
                        type="date"
                        value={docDate}
                        onChange={(e) => setDocDate(e.target.value)}
                        required
                      />
                    </div>

                    {activeDocType !== "discount_coupon" && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Input
                          label="Due or delivery date"
                          type="date"
                          value={dueDate}
                          onChange={(e) => setDueDate(e.target.value)}
                          required
                        />
                        <div>
                          <label className={LABEL}>Place of supply</label>
                          <select
                            suppressHydrationWarning
                            value={placeOfSupply}
                            onChange={(e) => setPlaceOfSupply(e.target.value)}
                            className={`${CTL} w-full`}
                          >
                            <option value="">Choose state</option>
                            {GST_STATES.map(([code, name]) => (
                              <option key={code} value={`${code}-${name}`}>
                                {code} - {name}
                                {activeStateCode ? (code === activeStateCode ? " (CGST + SGST)" : " (IGST)") : ""}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                </section>

                {/* SPECIAL SECTION: DISCOUNT COUPON FORM */}
                {activeDocType === "discount_coupon" && (
                  <section className={PANEL}>
                    <div className={PANEL_HEAD}>
                      <h4 className={`${PANEL_TITLE} flex items-center gap-2`}>
                        <Tag className="h-4 w-4 text-brand-strong" /> Coupon and campaign
                      </h4>
                      <span className={`${CHIP} bg-canvas-sunken text-ink-soft`}>Voucher</span>
                    </div>

                    <div className="p-5 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className={LABEL}>Coupon code</label>
                          <div className="flex items-center gap-1.5">
                            <input
                              suppressHydrationWarning
                              type="text"
                              value={couponCode}
                              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                              className={`${CTL} flex-1 font-mono uppercase`}
                            />
                            <Button
                              suppressHydrationWarning
                              type="button"
                              variant="outline"
                              size="md"
                              onClick={() => setCouponCode(`PROMO${Math.floor(1000 + Math.random() * 9000)}`)}
                              className="px-2.5"
                              title="Randomise code"
                              aria-label="Randomise code"
                            >
                              <Shuffle className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        <Input
                          label="Campaign title"
                          value={couponTitle}
                          onChange={(e) => setCouponTitle(e.target.value)}
                          required
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className={LABEL}>Discount structure</label>
                          <select
                            suppressHydrationWarning
                            value={discountType}
                            onChange={(e) => setDiscountType(e.target.value as "percentage" | "flat")}
                            className={`${CTL} w-full`}
                          >
                            <option value="percentage">Percentage discount (%)</option>
                            <option value="flat">Flat cash rebate (₹)</option>
                          </select>
                        </div>

                        <Input
                          label={discountType === "percentage" ? "Discount rate (%)" : "Flat amount (₹)"}
                          type="number"
                          value={discountValue.toString()}
                          onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
                          required
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Input
                          label="Minimum cart value (₹)"
                          type="number"
                          value={minOrderValue.toString()}
                          onChange={(e) => setMinOrderValue(parseFloat(e.target.value) || 0)}
                        />
                        <Input
                          label="Maximum discount cap (₹)"
                          type="number"
                          value={maxDiscountCap.toString()}
                          onChange={(e) => setMaxDiscountCap(parseFloat(e.target.value) || 0)}
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Input
                          label="Valid until"
                          type="date"
                          value={couponValidUntil}
                          onChange={(e) => setCouponValidUntil(e.target.value)}
                        />
                        <Input
                          label="Usage limit"
                          value={couponUsageLimit}
                          onChange={(e) => setCouponUsageLimit(e.target.value)}
                        />
                      </div>

                      <div>
                        <label className={LABEL}>Redemption scope and terms</label>
                        <textarea
                          suppressHydrationWarning
                          rows={2}
                          value={couponEligibleScope}
                          onChange={(e) => setCouponEligibleScope(e.target.value)}
                          className={TEXTAREA}
                        />
                      </div>
                    </div>
                  </section>
                )}

                {/* SPECIAL SECTION: DELIVERY CHALLAN (RULE 55) */}
                {activeDocType === "delivery_challan" && (
                  <section className={PANEL}>
                    <div className={PANEL_HEAD}>
                      <h4 className={`${PANEL_TITLE} flex items-center gap-2`}>
                        <Truck className="h-4 w-4 text-brand-strong" /> Transport and vehicle (GST Rule 55)
                      </h4>
                      <span className={`${CHIP} bg-canvas-sunken text-ink-soft`}>Goods in transit</span>
                    </div>

                    <div className="p-5 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className={LABEL}>Nature of transport</label>
                          <select
                            suppressHydrationWarning
                            value={challanReason}
                            onChange={(e) => setChallanReason(e.target.value)}
                            className={`${CTL} w-full`}
                          >
                            <option value="">Choose reason</option>
                            <option value="Supply on Approval / Return">Supply on Approval / Return</option>
                            <option value="Job Work / Processing">Job Work / Processing</option>
                            <option value="Inter-Branch Stock Transit">Inter-Branch Stock Transit</option>
                            <option value="Exhibition / Demonstration">Exhibition / Demonstration</option>
                            <option value="Semi-Knocked Down Transport">Semi-Knocked Down Transport</option>
                          </select>
                        </div>

                        <Input
                          label="Vehicle or container no."
                          value={vehicleNumber}
                          onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
                          className="font-mono"
                          required
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Input
                          label="Transporter name"
                          value={transporterName}
                          onChange={(e) => setTransporterName(e.target.value)}
                        />
                        <Input
                          label="E-way bill number"
                          value={ewayBillNo}
                          onChange={(e) => setEwayBillNo(e.target.value)}
                          className="font-mono"
                        />
                      </div>
                    </div>
                  </section>
                )}

                {/* Counterparty / Party Information */}
                <section className={PANEL}>
                  <div className={PANEL_HEAD}>
                    <h4 className={PANEL_TITLE}>
                      {activeDocType === "purchase_order" ? "Vendor / supplier" : "Customer / bill to"}
                    </h4>
                    <span className="text-[12.5px] text-ink-muted">Consignee</span>
                  </div>

                  <div className="p-5 space-y-3">
                    <div>
                      <label className={LABEL}>Party from Parties</label>
                      <select
                        suppressHydrationWarning
                        value={partyId}
                        onChange={(e) => choosePartyRecord(e.target.value)}
                        className={`${CTL} w-full`}
                      >
                        <option value="">Not in Parties (type the details below)</option>
                        {parties
                          .filter((p) => (activeDocType === "purchase_order" ? p.type === "vendor" : p.type === "customer"))
                          .map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.legal_name}
                              {p.gstin ? ` · ${p.gstin}` : ""}
                            </option>
                          ))}
                      </select>
                      {(activeDocType === "quotation" || activeDocType === "proforma") && !partyId && (
                        <p className="text-[12.5px] text-ink-muted mt-1">Converting to an invoice needs a customer from Parties.</p>
                      )}
                    </div>

                    <Input
                      label="Recipient legal name"
                      value={partyName}
                      onChange={(e) => setPartyName(e.target.value)}
                      required
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Input
                        label="Recipient GSTIN"
                        value={partyGSTIN}
                        onChange={(e) => setPartyGSTIN(e.target.value.toUpperCase())}
                        className="font-mono"
                      />
                      <Input
                        label="Phone"
                        value={partyPhone}
                        onChange={(e) => setPartyPhone(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className={LABEL}>Registered address</label>
                      <textarea
                        suppressHydrationWarning
                        rows={2}
                        value={partyAddress}
                        onChange={(e) => setPartyAddress(e.target.value)}
                        className={TEXTAREA}
                      />
                    </div>
                  </div>
                </section>

                {/* Line Items Table */}
                <section className={PANEL}>
                  <div className={PANEL_HEAD}>
                    <div>
                      <h4 className={PANEL_TITLE}>Goods and services</h4>
                      <p className="text-[13px] text-ink-muted">
                        {items.length} {items.length === 1 ? "line" : "lines"}
                      </p>
                    </div>
                    <Button
                      suppressHydrationWarning
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddItem}
                    >
                      <Plus className="h-3.5 w-3.5" /> Add item
                    </Button>
                  </div>

                  <div className="p-5 space-y-3">
                    {items.map((item, idx) => (
                      <div
                        key={item.id}
                        className="p-3.5 rounded-ctl border border-line bg-canvas/60 space-y-2.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[12.5px] text-ink-muted tabular-nums w-6 shrink-0">{idx + 1}</span>
                          <input
                            suppressHydrationWarning
                            type="text"
                            placeholder="Item name or description"
                            aria-label={`Line ${idx + 1} description`}
                            value={item.description}
                            onChange={(e) => handleItemChange(idx, "description", e.target.value)}
                            className={`${CTL} flex-1 font-medium`}
                          />
                          <button
                            suppressHydrationWarning
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            disabled={items.length <= 1}
                            className="text-ink-subtle hover:text-bad hover:bg-bad-wash disabled:opacity-30 p-1.5 rounded-chip transition-colors"
                            title="Remove line"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:pl-8">
                          <label className="block">
                            <span className={MINI_LABEL}>HSN/SAC</span>
                            <input
                              suppressHydrationWarning
                              type="text"
                              value={item.hsn}
                              onChange={(e) => handleItemChange(idx, "hsn", e.target.value)}
                              className={`${CTL} w-full font-mono`}
                            />
                          </label>

                          <label className="block">
                            <span className={MINI_LABEL}>Qty</span>
                            <input
                              suppressHydrationWarning
                              type="number"
                              min="1"
                              value={item.qty}
                              onChange={(e) => handleItemChange(idx, "qty", parseFloat(e.target.value) || 0)}
                              className={`${CTL} w-full tabular-nums`}
                            />
                          </label>

                          <label className="block">
                            <span className={MINI_LABEL}>Unit</span>
                            <input
                              suppressHydrationWarning
                              type="text"
                              value={item.unit}
                              onChange={(e) => handleItemChange(idx, "unit", e.target.value)}
                              className={`${CTL} w-full`}
                            />
                          </label>

                          <label className="block">
                            <span className={MINI_LABEL}>Rate (₹)</span>
                            <input
                              suppressHydrationWarning
                              type="number"
                              value={item.rate}
                              onChange={(e) => handleItemChange(idx, "rate", parseFloat(e.target.value) || 0)}
                              className={`${CTL} w-full tabular-nums`}
                            />
                          </label>

                          <label className="block">
                            <span className={MINI_LABEL}>GST %</span>
                            <select
                              suppressHydrationWarning
                              value={item.gstRate}
                              onChange={(e) => handleItemChange(idx, "gstRate", parseInt(e.target.value) || 0)}
                              className={`${CTL} w-full tabular-nums`}
                            >
                              <option value="0">0%</option>
                              <option value="5">5%</option>
                              <option value="12">12%</option>
                              <option value="18">18%</option>
                              <option value="28">28%</option>
                              <option value="40">40%</option>
                            </select>
                          </label>
                        </div>
                      </div>
                    ))}

                    {/* Calculations Summary Box */}
                    <div className="p-4 rounded-ctl bg-canvas-sunken grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div>
                        <span className="text-[12.5px] text-ink-muted block">Subtotal</span>
                        <span className="text-[14px] font-[550] text-ink tabular-nums">{formatINR(calculations.subtotal)}</span>
                      </div>
                      <div>
                        <span className="text-[12.5px] text-ink-muted block">Taxable</span>
                        <span className="text-[14px] font-[550] text-ink tabular-nums">{formatINR(calculations.taxableAmount)}</span>
                      </div>
                      <div>
                        <span className="text-[12.5px] text-ink-muted block">Total GST</span>
                        <span className="text-[14px] font-[550] text-ink tabular-nums">{formatINR(calculations.totalTax)}</span>
                      </div>
                      <div>
                        <span className="text-[12.5px] text-ink-muted block">Grand total</span>
                        <span className="ledger-total text-[17px] font-semibold tracking-[-0.02em] text-ink tabular-nums">
                          {formatINR(calculations.roundedTotal)}
                        </span>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Notes & Declarations */}
                <section className={`${PANEL} p-5`}>
                  <label className={LABEL}>Terms, conditions and notes</label>
                  <textarea
                    suppressHydrationWarning
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className={TEXTAREA}
                  />
                </section>
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
              className="w-2 hover:w-2.5 bg-line hover:bg-brand cursor-col-resize transition-all shrink-0 flex items-center justify-center group select-none border-x border-line-strong no-print"
              title="Drag left or right to resize the form and preview (double-click to reset to 50/50)"
            >
              <div className="flex flex-col gap-1 items-center">
                <div className="h-1 w-1 rounded-full bg-ink-subtle group-hover:bg-surface" />
                <div className="h-1 w-1 rounded-full bg-ink-subtle group-hover:bg-surface" />
                <div className="h-1 w-1 rounded-full bg-ink-subtle group-hover:bg-surface" />
                <div className="h-1 w-1 rounded-full bg-ink-subtle group-hover:bg-surface" />
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
              className="overflow-y-auto overflow-x-hidden p-6 flex flex-col items-center bg-canvas-sunken min-w-0 transition-[width] duration-75 relative print:p-0 print:m-0 print:bg-white print:overflow-visible print:w-full print:block"
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
                    className="w-[620px] bg-surface rounded-2xl shadow-xl border border-line-strong overflow-hidden print:w-full print:max-w-full print:shadow-none"
                    style={{
                      transform: effectiveScale < 1 ? `scale(${effectiveScale})` : undefined,
                      transformOrigin: "top left",
                    }}
                  >
                    <div className="bg-panel-deep p-6 text-white relative overflow-hidden">
                      <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 opacity-15 pointer-events-none">
                        <Tag className="h-44 w-44 text-brand" />
                      </div>

                      <div className="flex items-start justify-between relative z-10">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-[10px] tracking-wider uppercase px-2 py-0.5 rounded bg-brand text-ink">
                              Verified Business Voucher
                            </span>
                            <span className="text-white/60 text-[10px] font-mono">FY 2026-27</span>
                          </div>
                          <h2 className="text-xl font-black mt-2 tracking-tight text-white">{couponTitle}</h2>
                          <p className="text-xs text-white/75 mt-1">{activeCompanyName}</p>
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] uppercase tracking-wider text-white/60 block">Voucher Value</span>
                          <span className="text-2xl font-black text-brand">
                            {discountType === "percentage" ? `${discountValue}% OFF` : formatINR(discountValue)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="relative h-6 bg-canvas-sunken flex items-center justify-between px-3">
                      <div className="h-5 w-5 rounded-full bg-canvas-sunken -ml-5 border border-line-strong" />
                      <div className="flex-1 border-t-2 border-dashed border-ink-subtle mx-4" />
                      <div className="h-5 w-5 rounded-full bg-canvas-sunken -mr-5 border border-line-strong" />
                    </div>

                    <div className="p-6 bg-surface space-y-4">
                      <div className="bg-canvas border-2 border-dashed border-brand/60 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-ink-subtle block mb-1">
                            Promotional Coupon Code
                          </span>
                          <div className="font-mono font-black text-2xl tracking-widest text-ink select-all">
                            {couponCode}
                          </div>
                          <div className="text-[11px] text-ink-muted mt-1 flex items-center gap-2">
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
                          className="shrink-0 no-print"
                        >
                          {copiedCode ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                          {copiedCode ? "Copied" : "Copy voucher"}
                        </Button>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-xs bg-canvas p-3 rounded-lg border border-line">
                        <div>
                          <span className="text-[10px] font-bold uppercase text-ink-subtle block">Redemption Validity</span>
                          <span className="font-bold text-ink flex items-center gap-1 mt-0.5">
                            <Calendar className="h-3.5 w-3.5 text-brand" /> Valid until {couponValidUntil}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold uppercase text-ink-subtle block">Account Eligibility</span>
                          <span className="font-bold text-ink flex items-center gap-1 mt-0.5">
                            <ShieldCheck className="h-3.5 w-3.5 text-brand-strong" /> {couponUsageLimit}
                          </span>
                        </div>
                      </div>

                      <div className="text-xs space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-ink-subtle block">
                          Scope of Application &amp; Terms
                        </span>
                        <p className="text-[11px] text-ink-soft leading-relaxed bg-canvas p-2.5 rounded border border-line">
                          {couponEligibleScope}
                        </p>
                      </div>

                      <div className="pt-3 border-t border-line flex items-center justify-between text-[10px] text-ink-subtle font-mono">
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
                    className="w-[794px] min-h-[1123px] bg-surface shadow-2xl p-8 border border-line-strong text-ink flex flex-col justify-between print:w-full print:max-w-full print:min-h-0 print:p-0 print:border-none print:shadow-none"
                    style={{
                      transform: `scale(${effectiveScale})`,
                      transformOrigin: "top left",
                      fontFamily: "system-ui, -apple-system, sans-serif",
                    }}
                  >
                    <div className="space-y-4">
                      {/* Header */}
                      <div className="flex items-start justify-between pb-4 border-b-2 border-ink">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-black text-xl tracking-tight text-ink uppercase">
                              {activeCompanyName}
                            </span>
                          </div>
                          {companyAddress && (
                            <p className="text-[11px] text-ink-soft max-w-sm mt-1">{companyAddress}</p>
                          )}
                          <div className="text-[10px] font-mono text-ink-soft mt-1 flex items-center gap-3">
                            <span>GSTIN: <strong>{activeGSTIN}</strong></span>
                            <span>•</span>
                            <span>PAN: <strong>{activePAN}</strong></span>
                            <span>•</span>
                            <span>State: <strong>{activeStateLabel || "–"}</strong></span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="inline-block px-3 py-1 font-mono font-black text-sm uppercase tracking-wider bg-ink text-surface rounded border border-ink">
                            {activeDocType === "invoice" && "TAX INVOICE"}
                            {activeDocType === "quotation" && "COMMERCIAL QUOTATION"}
                            {activeDocType === "proforma" && "PROFORMA INVOICE"}
                            {activeDocType === "delivery_challan" && "DELIVERY CHALLAN (RULE 55)"}
                            {activeDocType === "credit_note" && "GST CREDIT NOTE"}
                            {activeDocType === "debit_note" && "GST DEBIT NOTE"}
                            {activeDocType === "purchase_order" && "PURCHASE ORDER"}
                          </span>
                          <div className="text-[10px] text-ink-muted font-mono mt-1 whitespace-nowrap">
                            {activeDocType === "delivery_challan"
                              ? "NOT FOR SALE • TRANSIT ONLY"
                              : "ORIGINAL FOR RECIPIENT"}
                          </div>
                        </div>
                      </div>

                      {/* Metadata Grid */}
                      <div className="grid grid-cols-2 gap-4 text-xs bg-canvas p-3 rounded border border-line">
                        <div className="space-y-1">
                          <div className="flex justify-between">
                            <span className="text-ink-muted">Document No:</span>
                            <span className="font-mono font-bold text-ink">{docNumber}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-ink-muted">Issue Date:</span>
                            <span className="font-mono text-ink">{docDate}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-ink-muted">
                              {activeDocType === "quotation" ? "Valid Until:" : "Due Date:"}
                            </span>
                            <span className="font-mono text-ink">{dueDate}</span>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between">
                            <span className="text-ink-muted">Place of Supply:</span>
                            <span className="font-semibold text-ink">{placeOfSupply}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-ink-muted">Tax Type:</span>
                            <span className="font-mono font-bold text-ink">
                              {isInterstate ? "Interstate (IGST)" : "Intrastate (CGST + SGST)"}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-ink-muted">Reverse Charge:</span>
                            <span className="font-mono text-ink">{reverseCharge ? "Yes" : "No"}</span>
                          </div>
                        </div>
                      </div>

                      {/* Logistics Strip for Delivery Challan */}
                      {activeDocType === "delivery_challan" && (
                        <div className="p-2.5 rounded bg-canvas border border-line text-xs grid grid-cols-3 gap-2">
                          <div>
                            <span className="text-[10px] font-bold text-ink-soft uppercase block">Transport Reason</span>
                            <span className="font-medium text-ink">{challanReason}</span>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-ink-soft uppercase block">Vehicle Number</span>
                            <span className="font-mono font-bold text-ink">{vehicleNumber}</span>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-ink-soft uppercase block">Transporter / E-Way</span>
                            <span className="font-mono text-ink">{transporterName}</span>
                          </div>
                        </div>
                      )}

                      {/* Buyer / Recipient Details */}
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div className="p-3 rounded border border-line space-y-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-ink-subtle block mb-1">
                            {activeDocType === "purchase_order" ? "Vendor / Supplier" : "Bill To (Recipient)"}
                          </span>
                          <div className="font-bold text-ink">{partyName}</div>
                          <p className="text-[11px] text-ink-soft leading-tight">{partyAddress}</p>
                          <div className="text-[10px] font-mono text-ink-soft pt-1">
                            GSTIN: <strong>{partyGSTIN || "Unregistered"}</strong>
                          </div>
                        </div>

                        <div className="p-3 rounded border border-line space-y-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-ink-subtle block mb-1">
                            Ship To (Delivery Consignee)
                          </span>
                          <div className="font-bold text-ink">{partyName}</div>
                          <p className="text-[11px] text-ink-soft leading-tight">{partyAddress}</p>
                          <div className="text-[10px] text-ink-muted pt-1">
                            Contact: {partyPhone} • {partyEmail}
                          </div>
                        </div>
                      </div>

                      {/* Items Table */}
                      <div className="border border-line-strong rounded overflow-hidden">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-canvas-sunken border-b border-line-strong font-mono text-[11px] text-ink">
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
                          <tbody className="divide-y divide-line">
                            {items.map((item, idx) => {
                              const gross = item.qty * item.rate;
                              const disc = gross * (item.discountPct / 100);
                              const taxable = gross - disc;

                              return (
                                <tr key={item.id} className="text-[11px]">
                                  <td className="py-2 px-2.5 text-center font-mono text-ink-muted">{idx + 1}</td>
                                  <td className="py-2 px-2.5 font-medium text-ink">
                                    {item.description}
                                  </td>
                                  <td className="py-2 px-2 text-center font-mono text-ink-soft whitespace-nowrap">{item.hsn}</td>
                                  <td className="py-2 px-2 text-right font-mono whitespace-nowrap">
                                    {item.qty} {item.unit}
                                  </td>
                                  <td className="py-2 px-2 text-right font-mono whitespace-nowrap">{formatINR(item.rate, { showCurrencySymbol: false })}</td>
                                  <td className="py-2 px-2 text-right font-mono text-ink-muted whitespace-nowrap">
                                    {item.discountPct > 0 ? `${item.discountPct}%` : "—"}
                                  </td>
                                  <td className="py-2 px-2 text-right font-mono text-ink-soft whitespace-nowrap">{item.gstRate}%</td>
                                  <td className="py-2 px-3 text-right font-mono font-bold text-ink whitespace-nowrap">
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
                          <div className="p-3 rounded bg-canvas border border-line text-xs">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-ink-subtle block mb-1">
                              Bank Details for Direct Settlement
                            </span>
                            <div className="space-y-0.5 text-[11px] text-ink-soft font-mono">
                              <div>Bank: <strong>{bankName}</strong></div>
                              <div>A/c No: <strong>{bankAccount}</strong></div>
                              <div>IFSC: <strong>{bankIFSC}</strong></div>
                              {upiId && <div>UPI: <strong>{upiId}</strong></div>}
                            </div>
                          </div>

                          <div className="text-[11px] text-ink-soft space-y-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-ink-subtle block">
                              Commercial Terms
                            </span>
                            <p className="whitespace-pre-line leading-relaxed text-[10px] text-ink-muted">
                              {notes}
                            </p>
                          </div>
                        </div>

                        <div className="space-y-1.5 text-xs">
                          <div className="flex justify-between py-1 border-b border-line">
                            <span className="text-ink-soft">Subtotal (Gross Item Total):</span>
                            <span className="font-mono text-ink">{formatINR(calculations.subtotal)}</span>
                          </div>

                          {calculations.totalDiscount > 0 && (
                            <div className="flex justify-between py-1 border-b border-line text-ok">
                              <span>Less Discount:</span>
                              <span className="font-mono">- {formatINR(calculations.totalDiscount)}</span>
                            </div>
                          )}

                          <div className="flex justify-between py-1 border-b border-line font-semibold">
                            <span>Total Taxable Value:</span>
                            <span className="font-mono text-ink">{formatINR(calculations.taxableAmount)}</span>
                          </div>

                          {isInterstate ? (
                            <div className="flex justify-between py-1 border-b border-line text-ink-soft">
                              <span>Integrated Tax (IGST):</span>
                              <span className="font-mono">{formatINR(calculations.totalIgst)}</span>
                            </div>
                          ) : (
                            <>
                              <div className="flex justify-between py-1 border-b border-line text-ink-soft">
                                <span>Central Tax (CGST):</span>
                                <span className="font-mono">{formatINR(calculations.totalCgst)}</span>
                              </div>
                              <div className="flex justify-between py-1 border-b border-line text-ink-soft">
                                <span>State Tax (SGST):</span>
                                <span className="font-mono">{formatINR(calculations.totalSgst)}</span>
                              </div>
                            </>
                          )}

                          {calculations.roundOff !== 0 && (
                            <div className="flex justify-between py-1 border-b border-line text-ink-muted text-[11px]">
                              <span>Round Off:</span>
                              <span className="font-mono">{formatINR(calculations.roundOff)}</span>
                            </div>
                          )}

                          <div className="flex justify-between py-2 border-t-2 border-b-2 border-ink font-bold text-sm bg-canvas px-2 rounded">
                            <span className="uppercase text-ink">Grand Total (INR):</span>
                            <span className="font-mono text-ink text-base">{formatINR(calculations.roundedTotal)}</span>
                          </div>

                          <div className="pt-1 text-[10px] text-ink-soft italic">
                            <strong>Amount in Words:</strong> {calculations.words}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Signatory */}
                    <div className="pt-6 border-t border-line-strong mt-6 flex items-end justify-between text-xs">
                      <div className="text-[10px] text-ink-subtle space-y-0.5 font-mono">
                        <div>Deku Financial Technologies Operating System</div>
                      </div>

                      <div className="text-right space-y-1">
                        <div className="text-[10px] text-ink-muted font-semibold">
                          For <strong>{activeCompanyName}</strong>
                        </div>
                        <div className="h-12 flex items-center justify-end pr-4 text-ink-subtle italic font-mono text-[11px]">
                          [Authorized Digital Seal]
                        </div>
                        <div className="font-bold text-ink border-t border-ink-subtle pt-1 w-48 text-center ml-auto">
                          {signatoryName}
                        </div>
                        <div className="text-[10px] text-ink-muted text-center w-48 ml-auto">
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
