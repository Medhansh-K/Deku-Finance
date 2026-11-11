"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Receipt,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Send,
  Save,
  RotateCcw,
  BookOpen,
  UploadCloud,
  FileText,
  Sparkles,
  ArrowRightLeft,
  ArrowUpRight,
  ArrowDownLeft,
  FileSpreadsheet,
  ShoppingCart,
  Check,
  X,
  Loader2,
  HelpCircle,
  FileCheck2,
  ShieldCheck,
  Paperclip,
  ShieldAlert,
  ExternalLink,
  FileCheck,
  Landmark,
  Banknote,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { accountingApi, businessDocumentsApi, invoicesApi, organisationsApi, partiesApi , filesApi, MAX_DOCUMENT_BYTES } from "@/api/endpoints";
import { Account, CreateJournalRequest, FiscalPeriod, Party, SalesInvoice } from "@/types/accounting";
import { useOptionalLearnDemo } from "@/context/LearnDemoContext";
import { formatINR, parseAmount } from "@/lib/formatters/currency";
import { toISODateString } from "@/lib/formatters/date";
import {
  extractFromFile,
  ExtractedVoucherData,
} from "@/lib/vouchers/document-extractor";
import { BuilderDraftsInbox } from "./BuilderDraftsInbox";
import type { BusinessDocument } from "@/lib/builder/business-documents";
import { mapPurchaseOrderToVoucher } from "@/lib/vouchers/builder-mapper";
import { logUserActivity } from "@/lib/logging/activity-logger";
import {
  DocumentProofAttachment,
  validateProofForVoucher,
  PROOF_REQUIREMENTS,
  ProofType,
} from "@/lib/vouchers/document-proof";
import { isPlainKey, isTargetInteractive } from "@/lib/keyboard/shortcuts";

export type VoucherMode = "payment" | "receipt" | "contra" | "journal" | "sales" | "purchase";

export interface VoucherTypeConfig {
  mode: VoucherMode;
  fKey: string;
  title: string;
  shortLabel: string;
  prefix: string;
  subtitle: string;
  defaultNarration: string;
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
}

export const VOUCHER_CONFIGS: Record<VoucherMode, VoucherTypeConfig> = {
  contra: {
    mode: "contra",
    fKey: "F4",
    title: "Contra voucher entry",
    shortLabel: "Contra",
    prefix: "CNT",
    subtitle: "Internal transfers between cash and bank accounts",
    defaultNarration: "Internal cash/bank contra transfer",
    icon: ArrowRightLeft,
    accentColor: "#3B82F6",
  },
  payment: {
    mode: "payment",
    fKey: "F5",
    title: "Payment voucher entry",
    shortLabel: "Payment",
    prefix: "PAY",
    subtitle: "Payments made to vendors, creditors or expense ledgers",
    defaultNarration: "Payment made towards vendor bill / expense settlement",
    icon: ArrowUpRight,
    accentColor: "#EF4444",
  },
  receipt: {
    mode: "receipt",
    fKey: "F6",
    title: "Receipt voucher entry",
    shortLabel: "Receipt",
    prefix: "RCT",
    subtitle: "Inward customer settlements and revenue receipts",
    defaultNarration: "Receipt received from customer against sales invoice settlement",
    icon: ArrowDownLeft,
    accentColor: "#10B981",
  },
  journal: {
    mode: "journal",
    fKey: "F7",
    title: "Journal voucher entry",
    shortLabel: "Journal",
    prefix: "JRN",
    subtitle: "Non-cash adjustments, depreciation and period-end accruals",
    defaultNarration: "Adjustment journal entry for accounting period reconciliation",
    icon: FileSpreadsheet,
    accentColor: "#8B5CF6",
  },
  sales: {
    mode: "sales",
    fKey: "F8",
    title: "Sales voucher entry",
    shortLabel: "Sales",
    prefix: "SAL",
    subtitle: "Outward sales transactions and customer receivables",
    defaultNarration: "Sales revenue recognized from customer delivery",
    icon: Receipt,
    accentColor: "#F59E0B",
  },
  purchase: {
    mode: "purchase",
    fKey: "F9",
    title: "Purchase voucher entry",
    shortLabel: "Purchase",
    prefix: "PUR",
    subtitle: "Inward purchases, inventory and supplier payables",
    defaultNarration: "Purchases booked against vendor invoice",
    icon: ShoppingCart,
    accentColor: "#06B6D4",
  },
};

export interface VoucherWorkspaceProps {
  mode?: VoucherMode;
  initialMode?: VoucherMode;
  title?: string;
  fKey?: string;
  defaultNarration?: string;
}

export interface VoucherLineState {
  id: string;
  line_number: number;
  dr_cr: "Dr" | "Cr";
  account_id: string;
  party_id?: string;
  description: string;
  amount: string; // Form string input
}

export const getDefaultPartyForMode = (
  mode: VoucherMode,
  lineIdx: number,
  partiesList: Party[]
): string => {
  const firstPartyId = partiesList[0]?.id || "";
  switch (mode) {
    case "contra":
      // Contra is always internal liquidity: Self to Self
      return "self";
    case "payment":
      // Payment: Line 1 (Dr: Vendor/Expense) -> X party (or Self), Line 2 (Cr: Bank/Cash) -> Self
      return lineIdx === 0 ? (firstPartyId || "self") : "self";
    case "receipt":
      // Receipt: Line 1 (Dr: Bank) -> Self, Line 2 (Cr: Customer) -> X party
      return lineIdx === 0 ? "self" : (firstPartyId || "self");
    case "journal":
      // Journal non-cash adjustments default to Self to Self
      return "self";
    case "sales":
      // Sales: Line 1 (Dr: Customer) -> X party, Line 2 (Cr: Revenue) -> Self
      return lineIdx === 0 ? (firstPartyId || "self") : "self";
    case "purchase":
      // Purchase: Line 1 (Dr: Inventory/Expense) -> Self, Line 2 (Cr: Vendor) -> X party (or Self)
      return lineIdx === 0 ? "self" : (firstPartyId || "self");
    default:
      return "self";
  }
};

const VOUCHER_MODE_KEYS: Record<string, VoucherMode> = {
  F4: "contra",
  F5: "payment",
  F6: "receipt",
  F7: "journal",
  F8: "sales",
  F9: "purchase",
};

// Shared class strings for the voucher desk (premium UI tokens).
const KEYCAP = "font-mono text-[11px] leading-none px-1.5 pt-[3px] pb-[2px] rounded-[5px] border border-b-2 bg-surface shrink-0";
const SEG = "flex-1 h-8 px-2 rounded-[7px] text-[13px] font-medium flex items-center justify-center gap-1.5 transition-colors";
const SEG_ON = "bg-surface text-ink shadow-[0_0_0_1px_var(--color-line)]";
const SEG_OFF = "text-ink-muted hover:text-ink";
const CTL = "h-9 min-w-0 rounded-ctl border border-line-strong bg-surface px-2.5 text-[13.5px] placeholder:text-ink-subtle focus:border-brand focus:outline-none focus:ring-3 focus:ring-brand/20";
const CHIP = "inline-flex items-center gap-1 h-[22px] px-2 rounded-chip text-xs font-medium";
const NOTE = "px-3.5 py-2.5 rounded-ctl bg-canvas-sunken text-ink-soft text-[13px] flex items-start gap-2";
const SUBPANEL = "p-3.5 rounded-ctl border border-line bg-canvas/60 space-y-2.5";
const RADIO = "flex items-center gap-2 cursor-pointer text-[13px] text-ink";

export function VoucherWorkspace({
  mode: propMode,
  initialMode = "payment",
  defaultNarration: propDefaultNarration,
}: VoucherWorkspaceProps) {
  const router = useRouter();
  const demo = useOptionalLearnDemo();

  // Active Voucher Mode
  const [activeMode, setActiveMode] = useState<VoucherMode>(propMode || initialMode);

  // Sync if propMode changes
  useEffect(() => {
    if (propMode) {
      setActiveMode(propMode);
    }
  }, [propMode]);

  const activeConfig = VOUCHER_CONFIGS[activeMode];

  const [orgId, setOrgId] = useState<string>("");
  const [orgGstin, setOrgGstin] = useState<string | null>(null);
  // Maker-checker (migration 20): when on, "post" submits the voucher for someone else to approve.
  const [requireApproval, setRequireApproval] = useState(false);
  const [activeCompanyName, setActiveCompanyName] = useState<string>("Deku Financial Technologies");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [fiscalPeriods, setFiscalPeriods] = useState<FiscalPeriod[]>([]);

  // Header State - initialize with stable deterministic values for SSR/prerender
  const [voucherNumber, setVoucherNumber] = useState<string>("");
  const [numberRequest, setNumberRequest] = useState(0);
  const [entryDate, setEntryDate] = useState<string>("2026-10-21");
  const [reference, setReference] = useState<string>("");
  const [narration, setNarration] = useState<string>(
    propDefaultNarration || activeConfig.defaultNarration
  );

  // Defer the date to client mount
  useEffect(() => {
    setEntryDate(toISODateString());
  }, [activeMode]);

  // Line Items State
  const [lines, setLines] = useState<VoucherLineState[]>([
    {
      id: "line-1",
      line_number: 1,
      dr_cr: "Dr",
      account_id: "",
      party_id: initialMode === "contra" ? "self" : "",
      description: "",
      amount: "",
    },
    {
      id: "line-2",
      line_number: 2,
      dr_cr: "Cr",
      account_id: "",
      party_id: "self",
      description: "",
      amount: "",
    },
  ]);

  // Prefill from a deep link, e.g. bank reconciliation's "Create voucher" on an unmatched statement line.
  const searchParams = useSearchParams();
  useEffect(() => {
    const amount = parseAmount(searchParams.get("amount") || "");
    const date = searchParams.get("date") || "";
    const bankAccountId = searchParams.get("bank_account_id") || "";
    const bankSide = activeMode === "receipt" ? "Dr" : activeMode === "payment" ? "Cr" : null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) setEntryDate(date);
    if (searchParams.get("narration")) setNarration(searchParams.get("narration")!);
    if (searchParams.get("reference")) setReference(searchParams.get("reference")!);
    if (amount > 0) {
      setLines((prev) =>
        prev.map((l) => ({
          ...l,
          amount: String(amount),
          account_id: bankAccountId && l.dr_cr === bankSide ? bankAccountId : l.account_id,
        }))
      );
    }
  }, [searchParams, activeMode]);

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  // Builder Drafts Queue State
  const [sidebarTab, setSidebarTab] = useState<"drafts" | "ocr">("drafts");
  const [loadedBuilderDraft, setLoadedBuilderDraft] = useState<BusinessDocument | null>(null);
  const [pendingDraftsCount, setPendingDraftsCount] = useState<number>(0);

  // Document Proof & Verification State (Mandatory for final COA, P&L, and Balance Sheet posting)
  const [documentProof, setDocumentProof] = useState<DocumentProofAttachment | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"digital" | "cash">("digital");
  const [contraSlipType, setContraSlipType] = useState<"deposit" | "withdrawal">("deposit");
  const [journalProofType, setJournalProofType] = useState<"adjustment" | "depreciation">("adjustment");
  const [proofRefInput, setProofRefInput] = useState<string>("");
  const proofFileInputRef = useRef<HTMLInputElement>(null);

  // Open Sales Invoices for Settlement
  const [openInvoices, setOpenInvoices] = useState<SalesInvoice[]>([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>("");

  // Document Extraction State
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionProgressText, setExtractionProgressText] = useState("");
  const [extractedData, setExtractedData] = useState<ExtractedVoucherData | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load masters from PostgreSQL
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("deku_active_org_id");
      if (saved) setOrgId(saved);
      const savedName = localStorage.getItem("deku_active_org_name");
      if (savedName) setActiveCompanyName(savedName);
    }
  }, []);

  useEffect(() => {
    if (!orgId) return;
    organisationsApi
      .get(orgId)
      .then((res) => {
        setOrgGstin(res.data?.[0]?.gstin ?? null);
        setRequireApproval(res.data?.[0]?.require_journal_approval ?? false);
      })
      .catch(() => setOrgGstin(null));
    Promise.all([
      accountingApi.listAccounts(orgId),
      partiesApi.list(orgId),
      accountingApi.listFiscalPeriods(orgId),
    ])
      .then(([accRes, partRes, fpRes]) => {
        const loadedAccounts = (accRes.data || []).filter((a) => a.is_postable);
        const loadedParties = partRes.data || [];
        setAccounts(loadedAccounts);
        setParties(loadedParties);
        setFiscalPeriods(fpRes.data || []);

        if (!extractedData) {
          setLines((prev) =>
            prev.map((l, idx) => ({
              ...l,
              party_id: l.party_id || getDefaultPartyForMode(activeMode, idx, loadedParties),
            }))
          );
        }
      })
      .catch((err) => {
        setApiError(err.message || "Failed to load accounting masters");
      });
  }, [orgId]);

  useEffect(() => {
    if (!orgId) return;
    invoicesApi
      .list(orgId)
      .then((res) => setOpenInvoices((res.data || []).filter((inv) => inv.status === "issued")))
      .catch(() => setOpenInvoices([]));
  }, [orgId]);

  const customerNameOf = (inv: SalesInvoice) =>
    inv.parties?.legal_name || parties.find((p) => p.id === inv.customer_id)?.legal_name || "Customer";

  // Pre-fill a purchase voucher from a purchase order saved in the Document Builder.
  const handleSelectBuilderDraft = (doc: BusinessDocument) => {
    setLoadedBuilderDraft(doc);
    setExtractedData(null); // Clear OCR if any

    const mapped = mapPurchaseOrderToVoucher(doc, accounts);
    setActiveMode(mapped.mode);
    setReference(mapped.reference);
    setEntryDate(mapped.date);
    setNarration(mapped.narration);
    setLines(mapped.lines);
    // A PO is not proof of a purchase: the supplier's bill must still be attached.
    setDocumentProof(null);

    setSubmissionSuccess(null);
    setApiError(null);
  };

  const handleSelectInvoiceToSettle = (invNumber: string) => {
    setSelectedInvoiceId(invNumber);
    const target = openInvoices.find((i) => i.invoice_number === invNumber);
    if (!target) return;

    setReference(`RCP-${target.invoice_number}`);
    setNarration(`Customer settlement received against Sales Invoice #${target.invoice_number} (${customerNameOf(target)})`);

    const matchedParty = parties.find((p) => p.id === target.customer_id);

    const amountStr = String(target.total_amount || 0);
    setLines((prev) => [
      {
        ...prev[0],
        dr_cr: "Dr",
        amount: amountStr,
        description: `Bank collection for Inv #${target.invoice_number}`,
      },
      {
        ...prev[1],
        dr_cr: "Cr",
        party_id: matchedParty?.id || prev[1]?.party_id || "self",
        amount: amountStr,
        description: `Customer settlement for Inv #${target.invoice_number}`,
      },
    ]);

    setDocumentProof({
      id: `proof-settle-${target.id || Date.now()}`,
      proofType: "receipt_bill_matching",
      categoryLabel: "Sales Invoice Settlement",
      title: `Matched Open Sales Invoice #${target.invoice_number}`,
      refNumber: target.invoice_number,
      uploadedAt: new Date().toISOString(),
      verified: false,
      linkedInvoiceNumber: target.invoice_number,
      notes: `Direct settlement for ${customerNameOf(target)} (Amount: ₹${target.total_amount?.toLocaleString("en-IN")})`,
    });
  };

  const handleProofFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_DOCUMENT_BYTES) {
      setApiError("That file is over the 10 MB limit.");
      if (proofFileInputRef.current) proofFileInputRef.current.value = "";
      return;
    }

    let pType: ProofType = "receipt_vendor_invoice";
    let cat = "Attached Proof Document";

    if (activeMode === "sales") {
      pType = "sales_external_invoice";
      cat = "External Sales Invoice";
    } else if (activeMode === "contra") {
      pType = contraSlipType === "deposit" ? "contra_bank_deposit_slip" : "contra_cash_withdrawal_slip";
      cat = contraSlipType === "deposit" ? "Bank Deposit Slip" : "Cash Withdrawal Slip";
    } else if (activeMode === "payment") {
      pType = paymentMethod === "digital" ? "payment_digital_screenshot" : "payment_cash_cfo_approval";
      cat = paymentMethod === "digital" ? "Digital Payment Screenshot" : "CFO Cash Approval Memo";
    } else if (activeMode === "receipt") {
      pType = "receipt_vendor_invoice";
      cat = "Inward Remittance Advice / Invoice Copy";
    } else if (activeMode === "journal") {
      pType = journalProofType === "adjustment" ? "journal_adjustment_bill" : "journal_depreciation_memo";
      cat = journalProofType === "adjustment" ? "Bill of Purchase / Adjustment Bill" : "Depreciation Schedule";
    } else if (activeMode === "purchase") {
      pType = "purchase_vendor_bill";
      cat = "Vendor Tax Invoice";
    }

    setDocumentProof({
      id: `proof-${Date.now()}`,
      proofType: pType,
      categoryLabel: cat,
      title: `${cat} (${file.name})`,
      fileName: file.name,
      fileSize: `${(file.size / 1024).toFixed(1)} KB`,
      refNumber: proofRefInput.trim() || undefined,
      uploadedAt: new Date().toISOString(),
      file,
      // Stored with the voucher. Nothing checks what the document says.
      verified: false,
      notes: "Saved with the voucher when you submit it.",
    });

    if (proofFileInputRef.current) proofFileInputRef.current.value = "";
  };

  // A purchase order opened from the Document Builder (?source=builder&docId=...)
  useEffect(() => {
    if (typeof window === "undefined" || !orgId || accounts.length === 0) return;
    const docId = new URLSearchParams(window.location.search).get("docId");
    if (!docId) return;
    setSidebarTab("drafts");
    businessDocumentsApi
      .get(orgId, docId)
      .then((res) => {
        const doc = res.data?.[0];
        if (doc?.doc_type === "purchase_order") handleSelectBuilderDraft(doc);
      })
      .catch((err) => setApiError(err.message || "Couldn't load the purchase order"));
  }, [orgId, accounts]);

  // Switch voucher type
  const handleSwitchMode = (newMode: VoucherMode) => {
    setActiveMode(newMode);
    const cfg = VOUCHER_CONFIGS[newMode];
    if (!extractedData) {
      // Replace only the previous mode's default, never something the user typed.
      setNarration((prev) =>
        !prev.trim() || prev === VOUCHER_CONFIGS[activeMode].defaultNarration ? cfg.defaultNarration : prev
      );
      setLines((prev) =>
        prev.map((l, idx) => ({
          ...l,
          party_id: getDefaultPartyForMode(newMode, idx, parties),
        }))
      );
    }
  };

  // The server issues the next number. If it can't, the field stays blank for the user rather than inventing one.
  useEffect(() => {
    if (!orgId) return;
    const now = new Date();
    const fyStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    let stale = false;
    accountingApi
      .nextVoucherNumber(orgId, `${activeConfig.prefix}-${fyStart}`)
      .then((res) => {
        if (!stale) setVoucherNumber(res.data ?? "");
      })
      .catch(() => {
        if (!stale) setVoucherNumber("");
      });
    return () => {
      stale = true;
    };
  }, [orgId, activeConfig.prefix, numberRequest]);

  // Keyboard shortcut listener for F4 - F9 inside this voucher page. Through a ref, so the
  // single listener always switches with the current parties and narration.
  const switchModeRef = useRef(handleSwitchMode);
  useEffect(() => {
    switchModeRef.current = handleSwitchMode;
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mode = VOUCHER_MODE_KEYS[e.key];
      if (!mode || !isPlainKey(e)) return;
      e.preventDefault();
      if (e.repeat || isTargetInteractive(e.target) || [...document.querySelectorAll('[role="dialog"], [aria-modal="true"]')].some((d) => d.getClientRects().length > 0)) return;
      switchModeRef.current(mode);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Compute live Debit/Credit totals
  let totalDebit = 0;
  let totalCredit = 0;

  lines.forEach((line) => {
    const amt = parseAmount(line.amount);
    if (line.dr_cr === "Dr") totalDebit += amt;
    else totalCredit += amt;
  });

  totalDebit = Math.round(totalDebit * 100) / 100;
  totalCredit = Math.round(totalCredit * 100) / 100;
  const difference = Math.round(Math.abs(totalDebit - totalCredit) * 100) / 100;
  const isBalanced = totalDebit > 0 && totalDebit === totalCredit;

  const handleAddLine = () => {
    const nextLineNum = lines.length + 1;
    const defaultDrCr = nextLineNum % 2 === 0 ? "Cr" : "Dr";
    const defaultParty = getDefaultPartyForMode(activeMode, lines.length, parties);
    setLines((prev) => [
      ...prev,
      {
        id: `line-${Date.now()}`,
        line_number: nextLineNum,
        dr_cr: defaultDrCr,
        account_id: "",
        party_id: defaultParty,
        description: "",
        amount: difference > 0 ? String(difference) : "",
      },
    ]);
  };

  const handleRemoveLine = (index: number) => {
    if (lines.length <= 2) {
      alert("A double-entry accounting voucher requires at least two lines.");
      return;
    }
    setLines((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleLineChange = (index: number, field: keyof VoucherLineState, value: any) => {
    setLines((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleLineKeyDown = (
    e: React.KeyboardEvent,
    index: number,
    field: string
  ) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (field === "amount" && index === lines.length - 1 && difference > 0) {
        handleAddLine();
      }
    }
  };

  // Apply extracted data to the active form
  const applyExtractedData = (data: ExtractedVoucherData) => {
    setExtractedData(data);
    setActiveMode(data.detectedType);
    // Keep the form's own voucher number and date unless the document gave us real ones.
    setReference(data.reference ?? "");
    if (data.date) setEntryDate(data.date);
    setNarration(data.narration);

    if (data.lines && data.lines.length > 0) {
      const mappedLines: VoucherLineState[] = data.lines.map((l, idx) => ({
        id: `extracted-${idx}-${Date.now()}`,
        line_number: idx + 1,
        dr_cr: l.dr_cr,
        account_id: l.accountId,
        party_id: l.partyId || data.partyId || "",
        description: l.description,
        amount: l.amount,
      }));
      setLines(mappedLines);
    }
  };

  // Clear / Reset extracted data
  const handleClearExtracted = () => {
    setExtractedData(null);
    const cfg = VOUCHER_CONFIGS[activeMode];
    setNumberRequest((n) => n + 1);
    setReference("");
    setNarration(cfg.defaultNarration);
    setLines([
      {
        id: `line-${Date.now()}-1`,
        line_number: 1,
        dr_cr: "Dr",
        account_id: "",
        party_id: getDefaultPartyForMode(activeMode, 0, parties),
        description: "",
        amount: "",
      },
      {
        id: `line-${Date.now()}-2`,
        line_number: 2,
        dr_cr: "Cr",
        account_id: "",
        party_id: getDefaultPartyForMode(activeMode, 1, parties),
        description: "",
        amount: "",
      },
    ]);
  };

  // Read a file into the voucher form
  const triggerDocumentExtraction = async (
    extractFn: () => Promise<ExtractedVoucherData> | ExtractedVoucherData
  ) => {
    setIsExtracting(true);
    setApiError(null);
    setSubmissionSuccess(null);

    setExtractionProgressText("Reading the document on this device (nothing is uploaded)...");

    try {
      const result = await extractFn();
      applyExtractedData(result);
    } catch (err: any) {
      setApiError(err.message || "Failed to extract details from document");
    } finally {
      setIsExtracting(false);
      setExtractionProgressText("");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    triggerDocumentExtraction(() => extractFromFile(file, accounts, parties, orgGstin));
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    triggerDocumentExtraction(() => extractFromFile(file, accounts, parties, orgGstin));
  };

  // Submit Voucher (Draft or Post)
  const handleSaveAndPost = async (shouldPost: boolean) => {
    setApiError(null);
    setSubmissionSuccess(null);

    if (!voucherNumber.trim()) {
      setApiError("Voucher Number is required.");
      return;
    }
    if (!narration.trim()) {
      setApiError("Narration memo is required for audit trail.");
      return;
    }

    for (let i = 0; i < lines.length; i++) {
      if (!lines[i].account_id) {
        setApiError(`Line ${i + 1}: Please select a valid postable account.`);
        return;
      }
      if (parseAmount(lines[i].amount) <= 0) {
        setApiError(`Line ${i + 1}: Amount must be strictly positive.`);
        return;
      }
    }

    if (shouldPost) {
      if (!isBalanced) {
        setApiError(
          `Voucher is out of balance. Total Debits (₹ ${totalDebit.toFixed(
            2
          )}) must equal Total Credits (₹ ${totalCredit.toFixed(
            2
          )}). Difference: ₹ ${difference.toFixed(2)}`
        );
        return;
      }

      // MANDATORY STATUTORY CHECK: Document Proof Enforcement
      const proofCheck = validateProofForVoucher(activeMode, documentProof, paymentMethod);
      if (!proofCheck.isValid) {
        setApiError(
          proofCheck.message ||
            "Mandatory Document Proof Missing: attach the supporting document before this voucher can be posted to the Chart of Accounts, P&L, or Balance Sheet."
        );
        return;
      }
    }

    const activeFp = fiscalPeriods.find(
      (fp) => fp.status === "open" && fp.start_date <= entryDate && entryDate <= fp.end_date
    );
    if (!activeFp) {
      setApiError(`No open fiscal period covers ${entryDate}. Add or reopen one in Settings.`);
      return;
    }

    const payload: CreateJournalRequest = {
      fiscal_period_id: activeFp.id,
      entry_number: voucherNumber,
      entry_date: entryDate,
      narration: `[${activeMode.toUpperCase()}] ${narration}`,
      reference: reference || undefined,
      lines: lines.map((l, idx) => ({
        line_number: idx + 1,
        account_id: l.account_id,
        party_id: l.party_id && l.party_id !== "self" ? l.party_id : undefined,
        description: l.description || narration,
        debit: l.dr_cr === "Dr" ? parseAmount(l.amount) : 0,
        credit: l.dr_cr === "Cr" ? parseAmount(l.amount) : 0,
      })),
    };

    setIsSubmitting(true);
    try {
      const draftRes = await accountingApi.createJournal(orgId, payload);
      const createdEntryId = draftRes.entry?.[0]?.id;

      // Before posting, so a voucher doesn't reach the ledger without its document.
      if (createdEntryId && documentProof?.file) {
        try {
          await filesApi.upload(orgId, documentProof.file, {
            journal_entry_id: createdEntryId,
            category: documentProof.categoryLabel,
            reference: documentProof.refNumber,
          });
        } catch (uploadErr: any) {
          setApiError(
            `Voucher ${voucherNumber} was saved as a draft, but its document didn't upload: ${uploadErr?.message || "unknown error"}. Attach it again from the Day Book, then post.`
          );
          window.dispatchEvent(new CustomEvent("deku_ledger_updated", { detail: { voucherNumber } }));
          return;
        }
      }

      const posted = shouldPost && !requireApproval;
      if (shouldPost && requireApproval && createdEntryId) {
        await accountingApi.submitJournal(orgId, createdEntryId);
        setSubmissionSuccess(
          `Voucher ${voucherNumber} submitted for approval. It reaches the ledger once another approver signs it off in Approvals.`
        );
      } else if (posted && createdEntryId) {
        await accountingApi.postJournal(orgId, createdEntryId);
        setSubmissionSuccess(
          `Voucher ${voucherNumber} posted to General Ledger & Financial Reports!`
        );
      } else {
        setSubmissionSuccess(
          `Draft voucher ${voucherNumber} saved successfully. (Drafts don't reach the ledger or reports until they're posted.)`
        );
      }

      // Record in comprehensive user activity logs
      logUserActivity({
        category: "VOUCHER",
        crud_type: "CREATE",
        action: posted ? "Voucher Posted" : shouldPost ? "Voucher Submitted for Approval" : "Voucher Draft Saved",
        description: `${posted ? "Posted" : shouldPost ? "Submitted for approval" : "Saved draft"} ${activeMode.toUpperCase()} voucher #${voucherNumber} for ₹${totalDebit.toLocaleString("en-IN", { minimumFractionDigits: 2 })} (${narration})`,
        entity_type: "voucher",
        entity_id: voucherNumber,
        organisation_id: orgId,
        status: "success",
        metadata: {
          voucherType: activeMode,
          amount: totalDebit,
          entryDate,
          lineCount: lines.length,
          fKey: activeConfig.fKey,
          hasProof: !!documentProof,
          proofType: documentProof?.proofType,
        },
      });

      // Day Book and reports re-read the ledger from the server.
      window.dispatchEvent(new CustomEvent("deku_ledger_updated", { detail: { voucherNumber, mode: activeMode } }));

      // Reset for next voucher entry
      setTimeout(() => {
        setLoadedBuilderDraft(null);
        setExtractedData(null);
        setDocumentProof(null);
        setSelectedInvoiceId("");
        setProofRefInput("");
        setNumberRequest((n) => n + 1);
        setLines([
          {
            id: `line-${Date.now()}-1`,
            line_number: 1,
            dr_cr: "Dr",
            account_id: "",
            party_id: getDefaultPartyForMode(activeMode, 0, parties),
            description: "",
            amount: "",
          },
          {
            id: `line-${Date.now()}-2`,
            line_number: 2,
            dr_cr: "Cr",
            account_id: "",
            party_id: getDefaultPartyForMode(activeMode, 1, parties),
            description: "",
            amount: "",
          },
        ]);
        setNarration(activeConfig.defaultNarration);
      }, 2500);
    } catch (err: any) {
      setApiError(err.message || "Backend double-entry validation failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const ActiveIcon = activeConfig.icon;

  return (
    <div className="flex flex-col lg:flex-row gap-5 text-[13.5px] text-ink select-none">
      {/* Side column: voucher type and document intake */}
      <div className="w-full lg:w-72 shrink-0 space-y-4 lg:sticky lg:top-0 lg:self-start">
        {/* Voucher type selector */}
        <div data-tour="voucher-types" className="rounded-panel border border-line bg-surface">
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <h3 className="text-[15px] font-semibold tracking-tight text-ink">Voucher type</h3>
            <span className="text-[12.5px] text-ink-muted">F4 to F9</span>
          </div>

          <div className="px-2 pb-2 space-y-0.5">
            {(
              [
                "contra",
                "payment",
                "receipt",
                "journal",
                "sales",
                "purchase",
              ] as VoucherMode[]
            ).map((vMode) => {
              const cfg = VOUCHER_CONFIGS[vMode];
              const IconComponent = cfg.icon;
              const isCurrent = activeMode === vMode;

              return (
                <button
                  key={vMode}
                  suppressHydrationWarning
                  onClick={() => handleSwitchMode(vMode)}
                  aria-pressed={isCurrent}
                  className={`w-full flex items-center gap-3 px-2 py-2 rounded-ctl text-left transition-colors ${
                    isCurrent
                      ? "bg-brand-wash shadow-[inset_3px_0_0_var(--color-brand)]"
                      : "hover:bg-canvas"
                  }`}
                >
                  <span
                    className={`h-8 w-8 rounded-[8px] grid place-items-center shrink-0 ${
                      isCurrent ? "bg-surface text-brand-strong" : "bg-canvas-sunken text-ink-soft"
                    }`}
                  >
                    <IconComponent className="h-4 w-4" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className={`block text-[14px] font-[550] ${isCurrent ? "text-ink" : "text-ink-soft"}`}>
                      {cfg.shortLabel}
                    </span>
                    <span className="block text-[12.5px] text-ink-muted line-clamp-1">
                      {cfg.subtitle}
                    </span>
                  </span>
                  <kbd
                    className={`${KEYCAP} ${
                      isCurrent ? "border-brand-wash-strong text-brand-strong" : "border-line-strong text-ink-muted"
                    }`}
                  >
                    {cfg.fKey}
                  </kbd>
                </button>
              );
            })}
          </div>
        </div>

        {/* Purchase orders / Smart OCR switch */}
        <div className="flex items-center gap-0.5 p-0.5 rounded-ctl bg-canvas-sunken">
          <button
            type="button"
            onClick={() => setSidebarTab("drafts")}
            className={`${SEG} ${sidebarTab === "drafts" ? SEG_ON : SEG_OFF}`}
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            <span>Purchase orders</span>
            {pendingDraftsCount > 0 && (
              <span className="inline-flex items-center h-[18px] px-1.5 rounded-chip bg-warn-wash text-warn text-xs font-medium tabular-nums">
                {pendingDraftsCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setSidebarTab("ocr")}
            className={`${SEG} ${sidebarTab === "ocr" ? SEG_ON : SEG_OFF}`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Smart OCR</span>
          </button>
        </div>

        {/* Tab 1: Builder Drafts Inbox */}
        {sidebarTab === "drafts" ? (
          <BuilderDraftsInbox
            orgId={orgId}
            onSelectDraft={handleSelectBuilderDraft}
            selectedDraftId={loadedBuilderDraft?.id}
            onCountChange={setPendingDraftsCount}
          />
        ) : (
          /* Tab 2: Document Auto-Extraction (OCR) */
          <div className="rounded-panel border border-line bg-surface p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-[15px] font-semibold tracking-tight text-ink flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-brand-strong" />
                Smart extraction
              </h3>
              <span className="inline-flex items-center h-[22px] px-2 rounded-chip text-xs font-medium bg-brand-wash text-brand-strong">
                On this device
              </span>
            </div>

            <p className="text-[12.5px] text-ink-muted leading-snug">
              Drop a GST invoice to pre-fill the voucher. It is read on this device and never
              uploaded. Anything it can&apos;t read is left blank for you.
            </p>

            {/* Hidden File Input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp,.txt"
              onChange={handleFileUpload}
              className="hidden"
            />

            {/* Drag & Drop Zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border border-dashed rounded-ctl px-3 py-4 text-center cursor-pointer transition-colors ${
                isDragOver
                  ? "border-brand bg-brand-wash"
                  : "border-line-strong hover:border-brand hover:bg-canvas"
              }`}
            >
              <UploadCloud className="h-5 w-5 text-ink-subtle mx-auto mb-1.5" />
              <div className="text-[13.5px] font-medium text-ink">Upload invoice or bill</div>
              <div className="text-[12.5px] text-ink-muted mt-0.5">
                PDF, PNG or JPG. Drag and drop, or click
              </div>
            </div>

            {/* Extracting Progress State */}
            {isExtracting && (
              <div className="p-3 rounded-ctl bg-canvas-sunken space-y-1">
                <div className="flex items-center gap-2 text-[13px] font-medium text-ink">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-strong" />
                  <span>Extracting document…</span>
                </div>
                <div className="text-[12.5px] text-ink-muted">{extractionProgressText}</div>
              </div>
            )}

            {/* Extracted Document Info Card */}
            {extractedData && !isExtracting && (
              <div
                className={`p-3 rounded-ctl space-y-2 text-ink ${
                  extractedData.missingFields.length || extractedData.warnings.length
                    ? "bg-warn-wash"
                    : "bg-ok-wash"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-[13px] font-medium min-w-0">
                    <FileCheck2 className="h-3.5 w-3.5 text-ok shrink-0" />
                    <span className="truncate">{extractedData.documentName}</span>
                  </div>
                  <button
                    suppressHydrationWarning
                    onClick={handleClearExtracted}
                    className="text-ink-muted hover:text-bad p-0.5 rounded-chip"
                    title="Remove extracted data"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[12.5px] pt-2 border-t border-line">
                  <div>
                    <dt className="text-ink-muted">Mode</dt>
                    <dd className="font-medium capitalize">{extractedData.detectedType}</dd>
                  </div>
                  <div className="text-right">
                    <dt className="text-ink-muted">Invoice</dt>
                    <dd className="font-mono text-[12.5px]">{extractedData.reference ?? "not read"}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-ink-muted">Total</dt>
                    <dd className="font-medium tabular-nums">
                      {extractedData.totalAmount === null ? "not read" : formatINR(extractedData.totalAmount)}
                    </dd>
                  </div>
                </dl>

                {extractedData.missingFields.length > 0 && (
                  <div className="text-[12.5px] bg-surface px-2.5 py-2 rounded-chip">
                    <span className="font-medium">Not found, please fill in:</span>
                    <ul className="list-disc pl-4 text-ink-soft">
                      {extractedData.missingFields.map((f) => (
                        <li key={f}>{f}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {extractedData.warnings.map((w) => (
                  <div key={w} role="alert" className="text-[12.5px] font-medium text-bad bg-bad-wash px-2.5 py-1.5 rounded-chip">
                    {w}
                  </div>
                ))}
                <div className="text-[12.5px] text-ink-muted">
                  Filled into the voucher form. Review every line before posting.
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main column: the double-entry voucher form */}
      <div className="flex-1 space-y-4 min-w-0">
        {/* Banner when a purchase order from the builder is loaded */}
        {loadedBuilderDraft && (
          <div className="p-4 rounded-panel border border-line bg-surface flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="h-8 w-8 rounded-[8px] bg-warn-wash text-warn grid place-items-center shrink-0">
                <FileSpreadsheet className="h-4 w-4" />
              </span>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[14px] font-[550] text-ink">
                    Purchase order <span className="font-mono text-[13px]">{loadedBuilderDraft.doc_number}</span>
                  </span>
                  <span className="inline-flex items-center h-[22px] px-2 rounded-chip text-xs font-medium bg-warn-wash text-warn capitalize">
                    {loadedBuilderDraft.status}
                  </span>
                </div>
                <p className="text-[12.5px] text-ink-muted mt-0.5">
                  Supplier: <strong className="font-medium text-ink">{loadedBuilderDraft.parties?.legal_name ?? loadedBuilderDraft.party_snapshot?.name ?? "–"}</strong> · PO value: <strong className="font-medium text-ink tabular-nums">{formatINR(Number(loadedBuilderDraft.total_amount))}</strong>. Lines pre-filled from the PO; check them against the supplier&apos;s bill, attach the bill, then post.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setLoadedBuilderDraft(null);
                  handleClearExtracted();
                }}
              >
                Clear draft
              </Button>
            </div>
          </div>
        )}
        {/* Notice when document details were read into the form */}
        {extractedData && (
          <div className="px-3.5 py-2.5 rounded-ctl bg-ok-wash text-ink flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[13px]">
              <Sparkles className="h-4 w-4 text-ok shrink-0" />
              <span>
                <span className="font-medium">Read from the document:</span>{" "}
                <span className="font-mono text-[12.5px]">{extractedData.documentName}</span>{" "}
                ({extractedData.documentSize}). Form fields and balanced lines filled in.
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                suppressHydrationWarning
                variant="ghost"
                size="sm"
                onClick={handleClearExtracted}
                className="text-bad hover:text-bad hover:bg-bad-wash"
              >
                Reset
              </Button>
            </div>
          </div>
        )}

        {/* Voucher header */}
        <div className="rounded-panel border border-line bg-surface">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between px-5 pt-4 gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="h-8 w-8 rounded-[8px] bg-brand-wash text-brand-strong grid place-items-center shrink-0">
                <ActiveIcon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <h2 className="text-[15px] font-semibold tracking-tight text-ink flex items-center gap-2">
                  <span>{activeConfig.title}</span>
                  <kbd className={`${KEYCAP} border-line-strong text-ink-muted`}>{activeConfig.fKey}</kbd>
                </h2>
                <p className="text-[13px] text-ink-muted truncate">{activeConfig.subtitle}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-[12.5px] text-ink-muted shrink-0">
              {demo && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  data-tour="voucher-autofill"
                  onClick={() => {
                    const byCode = (code: string) =>
                      accounts.find((a) => a.is_postable && a.code === code)?.id ||
                      accounts.find((a) => a.is_postable)?.id ||
                      "";
                    const bankId = byCode("1020");
                    const cashId = byCode("1010");
                    const arId = byCode("1030");
                    const apId = byCode("2010");
                    const revId = byCode("4010");
                    const cogsId = byCode("5010");
                    const opexId = byCode("5020");
                    const custId = parties.find((p) => p.type === "customer")?.id || "";
                    const vendId = parties.find((p) => p.type === "vendor")?.id || "";

                    let drAcc = opexId;
                    let crAcc = bankId;
                    let drParty = "self";
                    let crParty = "self";
                    let amt = "25000";

                    if (activeMode === "contra") {
                      drAcc = cashId || bankId;
                      crAcc = bankId;
                      amt = "15000";
                    } else if (activeMode === "payment") {
                      drAcc = apId || opexId;
                      crAcc = bankId;
                      drParty = vendId || "self";
                      amt = "45000";
                    } else if (activeMode === "receipt") {
                      drAcc = bankId;
                      crAcc = arId;
                      crParty = custId || "self";
                      amt = "60000";
                    } else if (activeMode === "sales") {
                      drAcc = arId;
                      crAcc = revId;
                      drParty = custId || "self";
                      amt = "50000";
                    } else if (activeMode === "purchase") {
                      drAcc = cogsId || opexId;
                      crAcc = apId;
                      crParty = vendId || "self";
                      amt = "35000";
                    }

                    setReference(`DEMO-${activeMode.toUpperCase()}-101`);
                    setNarration(`Sample ${activeMode} entry in ${demo.dataset.org.name} (review & submit/post)`);
                    setLines([
                      { id: `demo-1-${Date.now()}`, line_number: 1, dr_cr: "Dr", account_id: drAcc, party_id: drParty, description: `Debit allocation (${activeMode})`, amount: amt },
                      { id: `demo-2-${Date.now()}`, line_number: 2, dr_cr: "Cr", account_id: crAcc, party_id: crParty, description: `Credit allocation (${activeMode})`, amount: amt },
                    ]);
                  }}
                >
                  <Sparkles className="h-3.5 w-3.5 text-brand-strong" />
                  <span>Autofill sample</span>
                </Button>
              )}
              <span>Double-entry · postable accounts only</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-5">
            <Input
              label="Voucher / entry number"
              value={voucherNumber}
              onChange={(e) => setVoucherNumber(e.target.value)}
              className="font-mono"
              required
            />
            <Input
              label="Date"
              type="date"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
              required
            />
            <Input
              label="Reference, cheque, UTR or bill no."
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="e.g. INV-9041 or NEFT-88219"
            />
          </div>
        </div>

        {/* Line items */}
        <div data-tour="voucher-lines" className="rounded-panel border border-line bg-surface overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
            <div>
              <h3 className="text-[15px] font-semibold tracking-tight text-ink">Accounting lines</h3>
              <p className="text-[13px] text-ink-muted">{activeConfig.shortLabel} voucher</p>
            </div>
            <span className="text-[12.5px] text-ink-muted flex items-center gap-1.5">
              <kbd className={`${KEYCAP} border-line-strong text-ink-muted`}>Enter</kbd>
              on the last amount adds a row
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr>
                  <th className="deku-table-th w-24">Dr / Cr</th>
                  <th className="deku-table-th">Account</th>
                  <th className="deku-table-th w-52">Counterparty (optional)</th>
                  <th className="deku-table-th text-right! w-40">Debit (₹)</th>
                  <th className="deku-table-th text-right! w-40">Credit (₹)</th>
                  <th className="deku-table-th w-12"><span className="sr-only">Remove</span></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, idx) => (
                  <tr key={line.id} className="border-b border-line hover:bg-canvas/60">
                    {/* Dr / Cr Selector */}
                    <td className="py-2 px-3.5">
                      <select
                        suppressHydrationWarning
                        value={line.dr_cr}
                        onChange={(e) =>
                          handleLineChange(idx, "dr_cr", e.target.value as "Dr" | "Cr")
                        }
                        className={`${CTL} w-full font-semibold text-brand-strong`}
                      >
                        <option value="Dr">Dr</option>
                        <option value="Cr">To (Cr)</option>
                      </select>
                    </td>

                    {/* Account Selector */}
                    <td className="py-2 px-3.5">
                      <select
                        suppressHydrationWarning
                        value={line.account_id}
                        onChange={(e) =>
                          handleLineChange(idx, "account_id", e.target.value)
                        }
                        className={`${CTL} w-full text-ink`}
                      >
                        <option value="">Select a postable account</option>
                        {accounts.map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.code} · {acc.name} ({acc.account_group})
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Party Selector */}
                    <td className="py-2 px-3.5">
                      <select
                        suppressHydrationWarning
                        value={line.party_id || ""}
                        onChange={(e) =>
                          handleLineChange(idx, "party_id", e.target.value)
                        }
                        className={`${CTL} w-full text-ink-soft`}
                      >
                        <option value="self">Self ({activeCompanyName})</option>
                        <option value="">None / general</option>
                        {parties.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.legal_name}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Debit Input */}
                    <td className="py-2 px-3.5 text-right">
                      {line.dr_cr === "Dr" ? (
                        <input
                          suppressHydrationWarning
                          type="number"
                          value={line.amount}
                          onChange={(e) =>
                            handleLineChange(idx, "amount", e.target.value)
                          }
                          onKeyDown={(e) => handleLineKeyDown(e, idx, "amount")}
                          placeholder="0.00"
                          aria-label={`Line ${idx + 1} debit amount`}
                          className={`${CTL} w-full text-right tabular-nums font-medium text-ink`}
                        />
                      ) : (
                        <span className="text-ink-subtle select-none">–</span>
                      )}
                    </td>

                    {/* Credit Input */}
                    <td className="py-2 px-3.5 text-right">
                      {line.dr_cr === "Cr" ? (
                        <input
                          suppressHydrationWarning
                          type="number"
                          value={line.amount}
                          onChange={(e) =>
                            handleLineChange(idx, "amount", e.target.value)
                          }
                          onKeyDown={(e) => handleLineKeyDown(e, idx, "amount")}
                          placeholder="0.00"
                          aria-label={`Line ${idx + 1} credit amount`}
                          className={`${CTL} w-full text-right tabular-nums font-medium text-ink`}
                        />
                      ) : (
                        <span className="text-ink-subtle select-none">–</span>
                      )}
                    </td>

                    {/* Remove Line */}
                    <td className="py-2 px-2 text-center">
                      <button
                        suppressHydrationWarning
                        onClick={() => handleRemoveLine(idx)}
                        className="text-ink-subtle hover:text-bad hover:bg-bad-wash p-1.5 rounded-chip transition-colors"
                        title="Remove line"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="text-[13.5px] font-semibold text-ink">
                  <td colSpan={3} className="py-3 px-3.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddLine}
                    >
                      <Plus className="h-3.5 w-3.5" /> Add row
                    </Button>
                  </td>
                  <td className="py-3 px-3.5 text-right tabular-nums">
                    <span className={isBalanced ? "ledger-total" : ""}>{formatINR(totalDebit)}</span>
                  </td>
                  <td className="py-3 px-3.5 text-right tabular-nums">
                    <span className={isBalanced ? "ledger-total" : ""}>{formatINR(totalCredit)}</span>
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Balance status */}
          <div
            data-tour="voucher-balance"
            className={`px-5 py-3 flex items-center justify-between gap-3 text-[13px] border-t border-line ${
              isBalanced ? "bg-ok-wash text-ok" : "bg-bad-wash text-bad"
            }`}
          >
            <div className="flex items-center gap-2 font-medium">
              {isBalanced ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertTriangle className="h-4 w-4" />
              )}
              <span>
                {isBalanced
                  ? "Balanced: debits equal credits"
                  : <>Out of balance by <span className="tabular-nums">{formatINR(difference)}</span></>}
              </span>
            </div>
            <span className="text-[12.5px]">
              {isBalanced ? "Ready to post" : "Must balance before posting"}
            </span>
          </div>
        </div>

        {/* Supporting document */}
        <div data-tour="voucher-document" className="rounded-panel border border-line bg-surface">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between px-5 pt-4 gap-3">
            <div className="flex items-start gap-3">
              <span
                className={`h-8 w-8 rounded-[8px] grid place-items-center shrink-0 ${
                  documentProof ? "bg-ok-wash text-ok" : "bg-warn-wash text-warn"
                }`}
              >
                <Paperclip className="h-4 w-4" />
              </span>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-[15px] font-semibold tracking-tight text-ink">
                    Supporting document
                  </h3>
                  {documentProof ? (
                    <span className={`${CHIP} bg-ok-wash text-ok`}>
                      <ShieldCheck className="h-3 w-3" />
                      Document attached
                    </span>
                  ) : (
                    <span className={`${CHIP} bg-warn-wash text-warn`}>
                      <ShieldAlert className="h-3 w-3" />
                      Needed before posting
                    </span>
                  )}
                </div>
                <p className="text-[13px] text-ink-muted">
                  Attach the supporting document. It&apos;s stored with the voucher; nothing checks what it says.
                </p>
              </div>
            </div>

            {documentProof && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDocumentProof(null);
                  setSelectedInvoiceId("");
                }}
                className="text-bad hover:text-bad hover:bg-bad-wash shrink-0"
              >
                <X className="h-3.5 w-3.5" /> Detach
              </Button>
            )}
          </div>

          {/* Hidden File Input for Document Proof */}
          <input
            ref={proofFileInputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp"
            onChange={handleProofFileUpload}
            className="hidden"
          />

          <div className="p-5">
          {documentProof ? (
            /* Attached document */
            <div className="p-3.5 rounded-ctl bg-ok-wash flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="h-8 w-8 rounded-[8px] bg-surface text-ok grid place-items-center shrink-0">
                  <FileCheck className="h-4 w-4" />
                </span>
                <div>
                  <span className="text-[14px] font-[550] text-ink block">
                    {documentProof.title}
                  </span>
                  <div className="flex items-center gap-3 text-[12.5px] text-ink-muted mt-0.5 flex-wrap">
                    <span>
                      Category: <span className="text-ink">{documentProof.categoryLabel}</span>
                    </span>
                    {documentProof.refNumber && (
                      <span>
                        Ref: <span className="font-mono text-ink">{documentProof.refNumber}</span>
                      </span>
                    )}
                    {documentProof.fileSize && (
                      <span>
                        Size: <span className="text-ink tabular-nums">{documentProof.fileSize}</span>
                      </span>
                    )}
                    {documentProof.approvedBy && (
                      <span className={`${CHIP} bg-surface text-ok`}>
                        <Check className="h-3 w-3" /> {documentProof.approvedBy}
                      </span>
                    )}
                  </div>
                  {documentProof.notes && (
                    <p className="text-[12.5px] text-ink-muted mt-1">
                      {documentProof.notes}
                    </p>
                  )}
                </div>
              </div>

              <span className={`${CHIP} bg-surface text-ok shrink-0 self-end sm:self-center`}>
                <Check className="h-3 w-3" /> Ready to post
              </span>
            </div>
          ) : (
            /* Proof input for the active voucher type */
            <div className="space-y-3">
              {/* Mode: Sales (F8) */}
              {activeMode === "sales" && (
                <div className="space-y-3">
                  <div className={NOTE}>
                    <FileText className="h-4 w-4 text-brand-strong shrink-0 mt-px" />
                    <span>
                      <span className="font-medium text-ink">Sales voucher proof:</span> upload the sales invoice. Invoices raised in the GST hub post their own journal when issued.
                    </span>
                  </div>

                  <div className={SUBPANEL}>
                    <span className="text-[13.5px] font-medium text-ink flex items-center gap-1.5">
                      <UploadCloud className="h-4 w-4 text-brand-strong" /> Upload sales invoice
                    </span>
                    <p className="text-[12.5px] text-ink-muted">
                      Upload the invoice copy (PDF, PNG or JPG) from your external billing or ERP.
                    </p>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={proofRefInput}
                        onChange={(e) => setProofRefInput(e.target.value)}
                        placeholder="External invoice no. (e.g. EXT-8819)"
                        className={`${CTL} flex-1`}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => proofFileInputRef.current?.click()}
                        className="shrink-0"
                      >
                        Upload invoice file
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Mode: Contra (F4) */}
              {activeMode === "contra" && (
                <div className="space-y-3">
                  <div className={NOTE}>
                    <Landmark className="h-4 w-4 text-brand-strong shrink-0 mt-px" />
                    <span>
                      <span className="font-medium text-ink">Contra voucher proof:</span> a cash and bank transfer needs a bank deposit slip or a cash withdrawal slip.
                    </span>
                  </div>

                  <div className={SUBPANEL}>
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                      <label className={RADIO}>
                        <input
                          type="radio"
                          name="contraSlipType"
                          checked={contraSlipType === "deposit"}
                          onChange={() => setContraSlipType("deposit")}
                          className="accent-brand"
                        />
                        <span>Bank deposit slip (cash deposited into bank)</span>
                      </label>
                      <label className={RADIO}>
                        <input
                          type="radio"
                          name="contraSlipType"
                          checked={contraSlipType === "withdrawal"}
                          onChange={() => setContraSlipType("withdrawal")}
                          className="accent-brand"
                        />
                        <span>Cash withdrawal slip or cheque leaf (cash withdrawn)</span>
                      </label>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={proofRefInput}
                        onChange={(e) => setProofRefInput(e.target.value)}
                        placeholder={
                          contraSlipType === "deposit"
                            ? "Deposit ack no. (e.g. HDFC-DEP-99482)"
                            : "Cheque or slip no. (e.g. CHQ-004921)"
                        }
                        className={`${CTL} flex-1`}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => proofFileInputRef.current?.click()}
                        className="shrink-0"
                      >
                        Upload slip scan or photo
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Mode: Payment (F5) */}
              {activeMode === "payment" && (
                <div className="space-y-3">
                  <div className={NOTE}>
                    <Banknote className="h-4 w-4 text-brand-strong shrink-0 mt-px" />
                    <span>
                      <span className="font-medium text-ink">Payment proof:</span> if paid digitally, upload the bank payment screenshot or UTR confirmation. If paid in cash, the CFO&apos;s approval memo is mandatory.
                    </span>
                  </div>

                  <div className={SUBPANEL}>
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                      <label className={RADIO}>
                        <input
                          type="radio"
                          name="paymentMethod"
                          checked={paymentMethod === "digital"}
                          onChange={() => setPaymentMethod("digital")}
                          className="accent-brand"
                        />
                        <span>Digital payment (NEFT, RTGS, UPI, netbanking)</span>
                      </label>
                      <label className={RADIO}>
                        <input
                          type="radio"
                          name="paymentMethod"
                          checked={paymentMethod === "cash"}
                          onChange={() => setPaymentMethod("cash")}
                          className="accent-brand"
                        />
                        <span>Cash disbursement (CFO approval mandatory)</span>
                      </label>
                    </div>

                    {paymentMethod === "digital" ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={proofRefInput}
                          onChange={(e) => setProofRefInput(e.target.value)}
                          placeholder="Bank UTR or transaction ID (e.g. UTR-HDFC261023941)"
                          className={`${CTL} flex-1`}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => proofFileInputRef.current?.click()}
                          className="shrink-0"
                        >
                          Upload payment screenshot or advice
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2.5 bg-warn-wash p-3 rounded-ctl">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-[13px] font-medium text-ink">
                          <span>Cash disbursement sanction</span>
                          <span className={`${CHIP} bg-surface text-warn`}>
                            Signatory: Chief Financial Officer (CFO)
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={proofRefInput}
                            onChange={(e) => setProofRefInput(e.target.value)}
                            placeholder="CFO sanction memo ref (e.g. CFO-AUTH-2026-081)"
                            className={`${CTL} flex-1`}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => proofFileInputRef.current?.click()}
                            className="shrink-0 bg-surface"
                          >
                            Upload signed CFO memo
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Mode: Receipt (F6) */}
              {activeMode === "receipt" && (
                <div className="space-y-3">
                  <div className={NOTE}>
                    <FileCheck className="h-4 w-4 text-brand-strong shrink-0 mt-px" />
                    <span>
                      <span className="font-medium text-ink">Receipt proof:</span> attach the customer&apos;s remittance advice or invoice copy, or settle directly against an open sales invoice.
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Bill-wise Matching */}
                    <div className={SUBPANEL}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[13.5px] font-medium text-ink flex items-center gap-1.5">
                          <CheckCircle2 className="h-4 w-4 text-brand-strong" /> Settle an open sales invoice
                        </span>
                        <Badge variant="teal">{openInvoices.length} open</Badge>
                      </div>
                      <p className="text-[12.5px] text-ink-muted">
                        Match against an open customer invoice to clear the receivable.
                      </p>
                      {openInvoices.length > 0 ? (
                        <select
                          value={selectedInvoiceId}
                          onChange={(e) => handleSelectInvoiceToSettle(e.target.value)}
                          className={`${CTL} w-full`}
                        >
                          <option value="">Choose an open invoice to settle</option>
                          {openInvoices.map((inv) => (
                            <option key={inv.id || inv.invoice_number} value={inv.invoice_number}>
                              {inv.invoice_number} · {customerNameOf(inv)} (Invoice total: ₹{inv.total_amount?.toLocaleString("en-IN")})
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="text-[12.5px] text-ink-muted">No open customer invoices right now.</div>
                      )}
                    </div>

                    {/* Remittance Advice Upload */}
                    <div className={SUBPANEL}>
                      <span className="text-[13.5px] font-medium text-ink flex items-center gap-1.5">
                        <UploadCloud className="h-4 w-4 text-brand-strong" /> Upload remittance advice or invoice copy
                      </span>
                      <p className="text-[12.5px] text-ink-muted">
                        Attach the invoice or the customer&apos;s remittance slip.
                      </p>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={proofRefInput}
                          onChange={(e) => setProofRefInput(e.target.value)}
                          placeholder="Remittance ref (e.g. REMIT-8832)"
                          className={`${CTL} flex-1 min-w-0`}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => proofFileInputRef.current?.click()}
                          className="shrink-0"
                        >
                          Upload advice
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Mode: Journal (F7) */}
              {activeMode === "journal" && (
                <div className="space-y-3">
                  <div className={NOTE}>
                    <FileSpreadsheet className="h-4 w-4 text-brand-strong shrink-0 mt-px" />
                    <span>
                      <span className="font-medium text-ink">Journal voucher proof:</span> attach the bill of purchase for adjustments, the depreciation schedule, or the amortisation memo.
                    </span>
                  </div>

                  <div className={SUBPANEL}>
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                      <label className={RADIO}>
                        <input
                          type="radio"
                          name="journalProofType"
                          checked={journalProofType === "adjustment"}
                          onChange={() => setJournalProofType("adjustment")}
                          className="accent-brand"
                        />
                        <span>Bill of purchase for adjustment or capitalisation</span>
                      </label>
                      <label className={RADIO}>
                        <input
                          type="radio"
                          name="journalProofType"
                          checked={journalProofType === "depreciation"}
                          onChange={() => setJournalProofType("depreciation")}
                          className="accent-brand"
                        />
                        <span>Depreciation or amortisation schedule</span>
                      </label>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={proofRefInput}
                        onChange={(e) => setProofRefInput(e.target.value)}
                        placeholder={
                          journalProofType === "adjustment"
                            ? "Purchase bill or docket no. (e.g. PUR-ASSET-7721)"
                            : "Schedule ref (e.g. DEP-SCHED-FY26-Q3)"
                        }
                        className={`${CTL} flex-1`}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => proofFileInputRef.current?.click()}
                        className="shrink-0"
                      >
                        Upload supporting document
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Mode: Purchase (F9) */}
              {activeMode === "purchase" && (
                <div className="space-y-3">
                  <div className={NOTE}>
                    <ShoppingCart className="h-4 w-4 text-brand-strong shrink-0 mt-px" />
                    <span>
                      <span className="font-medium text-ink">Purchase voucher proof:</span> upload the supplier&apos;s tax invoice or inward bill.
                    </span>
                  </div>

                  <div className={SUBPANEL}>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={proofRefInput}
                        onChange={(e) => setProofRefInput(e.target.value)}
                        placeholder="Supplier tax invoice no. (e.g. SUPP-INV-2026-904)"
                        className={`${CTL} flex-1`}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => proofFileInputRef.current?.click()}
                        className="shrink-0"
                      >
                        Upload supplier invoice
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          </div>
        </div>

        {/* Narration */}
        <div className="rounded-panel border border-line bg-surface p-5">
          <label htmlFor="voucher-narration" className="block text-[13px] font-medium text-ink-soft mb-1.5">
            Narration (required for the audit trail)
          </label>
          <textarea
            id="voucher-narration"
            rows={2}
            value={narration}
            onChange={(e) => setNarration(e.target.value)}
            placeholder="What the transaction was and why"
            className="w-full rounded-ctl border border-line-strong bg-surface px-3 py-2 text-[13.5px] text-ink placeholder:text-ink-subtle focus:border-brand focus:outline-none focus:ring-3 focus:ring-brand/20"
            required
          />
        </div>

        {/* Feedback Messages */}
        {apiError && (
          <div className="px-3.5 py-3 rounded-ctl bg-bad-wash text-[13px] text-bad flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{apiError}</span>
          </div>
        )}

        {submissionSuccess && (
          <div className="px-3.5 py-3 rounded-ctl bg-ok-wash text-[13px] text-ink flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 font-medium">
              <CheckCircle2 className="h-4 w-4 text-ok shrink-0" />
              <span>{submissionSuccess}</span>
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => router.push("/day-book")}
              className="self-end sm:self-center shrink-0"
            >
              Open in Day Book
            </Button>
          </div>
        )}

        {/* Action Toolbar */}
        <div data-tour="voucher-actions" className="flex items-center justify-between gap-3 pt-1">
          <Button
            variant="outline"
            onClick={() => router.push("/day-book")}
          >
            View Day Book
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => handleSaveAndPost(false)}
              isLoading={isSubmitting}
            >
              <Save className="h-4 w-4" /> Save draft
            </Button>
            <Button
              variant="tally"
              onClick={() => handleSaveAndPost(true)}
              isLoading={isSubmitting}
              disabled={!isBalanced}
            >
              {loadedBuilderDraft ? (
                <>
                  <Check className="h-4 w-4" />{" "}
                  {requireApproval ? "Confirm and submit for approval" : "Confirm and post to Day Book and ledger"}
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" /> {requireApproval ? "Submit for approval" : "Post voucher"}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
