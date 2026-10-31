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
import { accountingApi, businessDocumentsApi, invoicesApi, organisationsApi, partiesApi } from "@/api/endpoints";
import { Account, CreateJournalRequest, FiscalPeriod, Party, SalesInvoice } from "@/types/accounting";
import { formatINR, parseAmount } from "@/lib/formatters/currency";
import { toISODateString } from "@/lib/formatters/date";
import {
  extractFromFile,
  extractFromSample,
  ExtractedVoucherData,
  SAMPLE_DOCUMENTS,
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
    title: "Contra Voucher Entry",
    shortLabel: "Contra",
    prefix: "CNT",
    subtitle: "Internal transfers between Cash and Bank accounts",
    defaultNarration: "Internal cash/bank contra transfer",
    icon: ArrowRightLeft,
    accentColor: "#3B82F6",
  },
  payment: {
    mode: "payment",
    fKey: "F5",
    title: "Payment Voucher Entry",
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
    title: "Receipt Voucher Entry",
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
    title: "Journal Voucher Entry",
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
    title: "Sales Voucher Entry",
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
    title: "Purchase Voucher Entry",
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

export function VoucherWorkspace({
  mode: propMode,
  initialMode = "payment",
  defaultNarration: propDefaultNarration,
}: VoucherWorkspaceProps) {
  const router = useRouter();

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
  const [voucherNumber, setVoucherNumber] = useState<string>(
    `${activeConfig.prefix}-2026-0001`
  );
  const [entryDate, setEntryDate] = useState<string>("2026-10-21");
  const [reference, setReference] = useState<string>("");
  const [narration, setNarration] = useState<string>(
    propDefaultNarration || activeConfig.defaultNarration
  );

  // Defer dynamic date and unique voucher number computation to client mount
  useEffect(() => {
    setVoucherNumber(
      `${activeConfig.prefix}-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`
    );
    setEntryDate(toISODateString());
  }, [activeMode, activeConfig.prefix]);

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
      verified: true,
      linkedInvoiceNumber: target.invoice_number,
      notes: `Direct settlement for ${customerNameOf(target)} (Amount: ₹${target.total_amount?.toLocaleString("en-IN")})`,
    });
  };

  const handleProofFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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

    const generatedRef =
      proofRefInput.trim() ||
      (pType === "payment_digital_screenshot"
        ? `UTR-${Math.floor(1000000000 + Math.random() * 9000000000)}`
        : pType === "payment_cash_cfo_approval"
        ? `CFO-MEMO-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`
        : pType.startsWith("contra")
        ? `SLIP-${Math.floor(10000 + Math.random() * 90000)}`
        : `${activeConfig.prefix}-DOC-${Math.floor(1000 + Math.random() * 9000)}`);

    setDocumentProof({
      id: `proof-${Date.now()}`,
      proofType: pType,
      categoryLabel: cat,
      title: `${cat} (${file.name})`,
      fileName: file.name,
      fileSize: `${(file.size / 1024).toFixed(1)} KB`,
      refNumber: generatedRef,
      approvedBy: pType === "payment_cash_cfo_approval" ? "Chief Financial Officer (Finance Head)" : undefined,
      uploadedAt: new Date().toISOString(),
      verified: true,
      notes: `Verified statutory document uploaded on ${new Date().toLocaleDateString()}`,
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
    setVoucherNumber(
      `${cfg.prefix}-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`
    );
    if (!extractedData) {
      setNarration(cfg.defaultNarration);
      setLines((prev) =>
        prev.map((l, idx) => ({
          ...l,
          party_id: getDefaultPartyForMode(newMode, idx, parties),
        }))
      );
    }
  };

  // Keyboard shortcut listener for F4 - F9 inside this voucher page
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      if (e.key === "F4") {
        e.preventDefault();
        handleSwitchMode("contra");
      } else if (e.key === "F5") {
        e.preventDefault();
        handleSwitchMode("payment");
      } else if (e.key === "F6") {
        e.preventDefault();
        handleSwitchMode("receipt");
      } else if (e.key === "F7") {
        e.preventDefault();
        handleSwitchMode("journal");
      } else if (e.key === "F8") {
        e.preventDefault();
        handleSwitchMode("sales");
      } else if (e.key === "F9") {
        e.preventDefault();
        handleSwitchMode("purchase");
      }
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
    setVoucherNumber(
      `${cfg.prefix}-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`
    );
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

  // Read a file or sample bill into the voucher form
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

  const handleSampleSelect = (sampleId: string) => {
    triggerDocumentExtraction(() => extractFromSample(sampleId, accounts, parties, orgGstin));
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
            "Mandatory Document Proof Missing: Indian GAAP compliance requires verified document proof before this voucher can be posted to the Chart of Accounts, P&L, or Balance Sheet."
        );
        return;
      }
    }

    const activeFp =
      fiscalPeriods.find((fp) => fp.status === "open") || fiscalPeriods[0];
    if (!activeFp) {
      setApiError("No active open fiscal period found for organisation.");
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

      const posted = shouldPost && !requireApproval;
      if (shouldPost && requireApproval && createdEntryId) {
        await accountingApi.submitJournal(orgId, createdEntryId);
        setSubmissionSuccess(
          `Voucher ${voucherNumber} submitted for approval. It reaches the ledger once another approver signs it off in Approvals.`
        );
      } else if (posted && createdEntryId) {
        await accountingApi.postJournal(orgId, createdEntryId);
        setSubmissionSuccess(
          `Voucher ${voucherNumber} successfully verified by [${documentProof?.title || "Document Proof"}] and posted to General Ledger & Financial Reports!`
        );
      } else {
        setSubmissionSuccess(
          `Draft voucher ${voucherNumber} saved successfully. (Note: Drafts are unposted and do not update COA, P&L, or Balance Sheet until statutory document proof is verified.)`
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
        setVoucherNumber(
          `${activeConfig.prefix}-${new Date().getFullYear()}-${Math.floor(
            1000 + Math.random() * 9000
          )}`
        );
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
    <div className="flex flex-col lg:flex-row gap-4 font-sans text-xs select-none">
      {/* ============================================================ */}
      {/* SIDE COLUMN: Voucher Type Selection & Document Auto-Extraction */}
      {/* ============================================================ */}
      <div className="w-full lg:w-72 shrink-0 space-y-3 lg:sticky lg:top-0 lg:self-start">
        {/* Card 1: Voucher Types Selector */}
        <div className="bg-surface border border-line-strong rounded-lg p-3 shadow-xs">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-line">
            <span className="text-[11px] font-bold uppercase tracking-wider text-ink">
              Voucher Type
            </span>
            <span className="text-[10px] font-mono text-ink-muted font-bold">
              F4 — F9
            </span>
          </div>

          <div className="space-y-1.5">
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
                  className={`w-full flex items-center justify-between p-2 rounded transition-all text-left ${
                    isCurrent
                      ? "bg-panel text-white shadow-sm ring-1 ring-brand"
                      : "bg-canvas hover:bg-canvas-sunken text-ink-soft border border-line"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-mono font-bold text-[10px] px-1.5 py-0.5 rounded ${
                        isCurrent
                          ? "bg-brand text-panel-deep"
                          : "bg-surface border border-line-strong text-ink-soft"
                      }`}
                    >
                      {cfg.fKey}
                    </span>
                    <div>
                      <div className="font-bold text-xs flex items-center gap-1.5">
                        <IconComponent className="h-3 w-3 shrink-0" />
                        <span>{cfg.shortLabel}</span>
                      </div>
                      <div
                        className={`text-[10px] line-clamp-1 ${
                          isCurrent ? "text-slate-300" : "text-ink-muted"
                        }`}
                      >
                        {cfg.subtitle}
                      </div>
                    </div>
                  </div>
                  {isCurrent && (
                    <div className="h-2 w-2 rounded-full bg-brand shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Sidebar Sub-Tabs: Builder Drafts vs Smart OCR */}
        <div className="flex items-center bg-line/90 p-0.5 rounded-lg border border-line-strong">
          <button
            type="button"
            onClick={() => setSidebarTab("drafts")}
            className={`flex-1 py-1.5 px-2 rounded-md font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
              sidebarTab === "drafts"
                ? "bg-panel text-white shadow-xs"
                : "text-ink-soft hover:text-ink"
            }`}
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-brand" />
            <span>Purchase orders</span>
            {pendingDraftsCount > 0 && (
              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-amber-400 text-black font-black">
                {pendingDraftsCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setSidebarTab("ocr")}
            className={`flex-1 py-1.5 px-2 rounded-md font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
              sidebarTab === "ocr"
                ? "bg-panel text-white shadow-xs"
                : "text-ink-soft hover:text-ink"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5 text-brand" />
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
          <div className="bg-surface border border-edge rounded-lg p-3 shadow-xs">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-line">
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-brand" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-ink">
                  Smart Extraction
                </span>
              </div>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-brand/15 text-ink border border-brand/30">
                ALERX OCR
              </span>
            </div>

            <p className="text-[11px] text-ink-muted mb-2.5 leading-snug">
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
              className={`border-2 border-dashed rounded-lg p-3 text-center cursor-pointer transition-colors ${
                isDragOver
                  ? "border-brand bg-brand/10"
                  : "border-line-strong hover:border-brand hover:bg-canvas"
              }`}
            >
              <UploadCloud className="h-6 w-6 text-ink-subtle mx-auto mb-1" />
              <div className="font-semibold text-ink text-[11px]">
                Upload Invoice or Bill
              </div>
              <div className="text-[10px] text-ink-subtle mt-0.5">
                PDF, PNG, JPG (Drag & drop or click)
              </div>
            </div>

            {/* Extracting Progress State */}
            {isExtracting && (
              <div className="mt-2.5 p-2.5 rounded bg-panel text-white border border-edge space-y-1.5 animate-pulse">
                <div className="flex items-center gap-2 text-xs font-semibold text-brand-soft">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-brand" />
                  <span>Extracting Document...</span>
                </div>
                <div className="text-[10px] font-mono text-slate-300">
                  {extractionProgressText}
                </div>
              </div>
            )}

            {/* Extracted Document Info Card */}
            {extractedData && !isExtracting && (
              <div className={`mt-2.5 p-2 rounded border space-y-1.5 ${
                extractedData.missingFields.length || extractedData.warnings.length
                  ? "bg-amber-50 border-amber-300 text-amber-950"
                  : "bg-emerald-50 border-emerald-200 text-emerald-900"
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-[11px]">
                    <FileCheck2 className="h-3.5 w-3.5 text-emerald-600" />
                    <span className="truncate max-w-[150px]">
                      {extractedData.documentName}
                    </span>
                  </div>
                  <button
                    suppressHydrationWarning
                    onClick={handleClearExtracted}
                    className="text-ink-subtle hover:text-rose-600 p-0.5"
                    title="Remove extracted data"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-1 text-[10px] font-mono pt-1 border-t border-emerald-200/70">
                  <div>
                    <span className="text-ink-muted">Mode: </span>
                    <span className="font-bold text-ink uppercase">
                      {extractedData.detectedType}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-ink-muted">Invoice: </span>
                    <span className="font-bold text-ink">
                      {extractedData.reference ?? "not read"}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-ink-muted">Total: </span>
                    <span className="font-bold text-ink">
                      {extractedData.totalAmount === null ? "not read" : formatINR(extractedData.totalAmount)}
                    </span>
                  </div>
                </div>

                {extractedData.missingFields.length > 0 && (
                  <div className="text-[10px] bg-white/70 px-1.5 py-1 rounded border border-amber-300">
                    <span className="font-bold">Not found, please fill in:</span>
                    <ul className="list-disc pl-4">
                      {extractedData.missingFields.map((f) => (
                        <li key={f}>{f}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {extractedData.warnings.map((w) => (
                  <div key={w} role="alert" className="text-[10px] font-semibold text-rose-700 bg-white/70 px-1.5 py-1 rounded border border-rose-200">
                    {w}
                  </div>
                ))}
                <div className="text-[9px] bg-white/70 px-1.5 py-0.5 rounded border border-line text-ink-soft">
                  Filled into the voucher form. Review every line before posting.
                </div>
              </div>
            )}

            {/* Quick Sample Invoices */}
            <div className="mt-3 pt-2.5 border-t border-line">
              <div className="text-[10px] font-bold uppercase tracking-wider text-ink-muted mb-1.5">
                Try a sample (fictional data)
              </div>
              <div className="space-y-1">
                {SAMPLE_DOCUMENTS.map((sample) => (
                  <button
                    key={sample.id}
                    suppressHydrationWarning
                    onClick={() => handleSampleSelect(sample.id)}
                    disabled={isExtracting}
                    className="w-full flex items-center justify-between px-2 py-1.5 rounded bg-canvas hover:bg-canvas-sunken border border-line text-left text-[10px] transition-colors disabled:opacity-50"
                  >
                    <div className="truncate pr-1">
                      <span className="font-bold text-ink block">
                        {sample.title}
                      </span>
                      <span className="text-ink-muted font-mono text-[9px]">
                        {sample.type.toUpperCase()} • {sample.amountFormatted}
                      </span>
                    </div>
                    <Sparkles className="h-3 w-3 text-brand shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* MAIN WORKSPACE AREA: Double-Entry Voucher Form */}
      {/* ============================================================ */}
      <div className="flex-1 space-y-4 min-w-0">
        {/* Banner when Builder Draft is Loaded */}
        {loadedBuilderDraft && (
          <div className="p-3.5 rounded-xl bg-amber-50/90 border border-amber-300 text-amber-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-start gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-panel-deep text-brand flex items-center justify-center shrink-0 font-bold mt-0.5">
                <FileSpreadsheet className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-xs text-amber-950">
                    Purchase order: <span className="font-mono">{loadedBuilderDraft.doc_number}</span>
                  </span>
                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-amber-200 text-amber-900 border border-amber-300">
                    {loadedBuilderDraft.status.toUpperCase()}
                  </span>
                </div>
                <p className="text-[11px] text-amber-900 mt-0.5">
                  Supplier: <strong>{loadedBuilderDraft.parties?.legal_name ?? loadedBuilderDraft.party_snapshot?.name ?? "–"}</strong> • PO value: <strong>{formatINR(Number(loadedBuilderDraft.total_amount))}</strong>. Lines pre-filled from the PO; check them against the supplier&apos;s bill, attach the bill, then post.
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
                className="text-[11px] h-7 px-2 border-amber-300 text-amber-900 hover:bg-amber-100"
              >
                Clear Draft
              </Button>
            </div>
          </div>
        )}
        {/* Notification Banner when Document Details were Auto-Extracted */}
        {extractedData && (
          <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-900 flex items-center justify-between gap-2 shadow-xs">
            <div className="flex items-center gap-2 text-xs">
              <Sparkles className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>
                <strong>Document Auto-Extracted:</strong> Loaded from{" "}
                <span className="font-mono font-semibold">
                  {extractedData.documentName}
                </span>{" "}
                ({extractedData.documentSize}). Form fields and balanced lines
                populated.
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                suppressHydrationWarning
                onClick={handleClearExtracted}
                className="text-[11px] font-bold text-rose-700 hover:underline px-2 py-0.5 rounded hover:bg-rose-100"
              >
                Reset
              </button>
            </div>
          </div>
        )}

        {/* Voucher Header Strip */}
        <div className="bg-surface border border-line-strong rounded-lg p-4 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-line gap-2">
            <div className="flex items-center gap-2">
              <Badge variant="teal">{activeConfig.fKey}</Badge>
              <h2 className="text-sm font-bold uppercase tracking-wider text-ink flex items-center gap-1.5">
                <ActiveIcon className="h-4 w-4 text-brand" />
                <span>{activeConfig.title}</span>
              </h2>
            </div>
            <div className="flex items-center gap-2 text-ink-muted font-mono text-[11px]">
              <span>Double-Entry Strict</span>
              <span>•</span>
              <span className="text-brand font-bold">ALERX Postable Only</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
            <Input
              label="Voucher / Entry Number"
              value={voucherNumber}
              onChange={(e) => setVoucherNumber(e.target.value)}
              required
            />
            <Input
              label="Date (YYYY-MM-DD)"
              type="date"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
              required
            />
            <Input
              label="Reference / Cheque / UTR / Bill No"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="e.g. INV-9041 or NEFT-88219"
            />
          </div>
        </div>

        {/* Line Items Table */}
        <div className="bg-surface border border-edge rounded-lg overflow-hidden shadow-xs">
          <div className="bg-panel px-4 py-2 border-b border-edge text-white flex items-center justify-between font-mono text-[11px]">
            <div className="flex items-center gap-2">
              <span>Accounting Allocation Table</span>
              <span className="text-[10px] text-ink-subtle">
                ({activeConfig.shortLabel} Mode)
              </span>
            </div>
            <span className="text-brand-soft">Press Enter to advance</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-canvas-sunken border-b border-line-strong font-mono text-[11px] text-ink-soft">
                  <th className="py-2 px-3 w-16 text-center">Type</th>
                  <th className="py-2 px-3">Particulars / Account Label</th>
                  <th className="py-2 px-3 w-48">Counterparty (Optional)</th>
                  <th className="py-2 px-3 text-right w-36">Debit (INR)</th>
                  <th className="py-2 px-3 text-right w-36">Credit (INR)</th>
                  <th className="py-2 px-2 w-10 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {lines.map((line, idx) => (
                  <tr key={line.id} className="hover:bg-canvas/70">
                    {/* Dr / Cr Selector */}
                    <td className="py-2 px-3 text-center">
                      <select
                        suppressHydrationWarning
                        value={line.dr_cr}
                        onChange={(e) =>
                          handleLineChange(idx, "dr_cr", e.target.value as "Dr" | "Cr")
                        }
                        className="font-mono font-bold text-xs bg-canvas-sunken border border-line-strong rounded px-1.5 py-1 text-ink focus:border-brand focus:outline-none"
                      >
                        <option value="Dr">Dr</option>
                        <option value="Cr">To (Cr)</option>
                      </select>
                    </td>

                    {/* Account Selector */}
                    <td className="py-2 px-3">
                      <select
                        suppressHydrationWarning
                        value={line.account_id}
                        onChange={(e) =>
                          handleLineChange(idx, "account_id", e.target.value)
                        }
                        className="w-full bg-surface border border-line-strong rounded px-2 py-1 text-xs text-ink focus:border-brand focus:outline-none"
                      >
                        <option value="">— Select Postable Leaf Account —</option>
                        {accounts.map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.code} • {acc.name} ({acc.account_group})
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Party Selector */}
                    <td className="py-2 px-3">
                      <select
                        suppressHydrationWarning
                        value={line.party_id || ""}
                        onChange={(e) =>
                          handleLineChange(idx, "party_id", e.target.value)
                        }
                        className="w-full bg-surface border border-line-strong rounded px-2 py-1 text-xs text-ink-soft focus:border-brand focus:outline-none"
                      >
                        <option value="self">🏢 Self ({activeCompanyName})</option>
                        <option value="">(None / General)</option>
                        {parties.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.legal_name}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Debit Input */}
                    <td className="py-2 px-3 text-right">
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
                          className="w-full text-right font-mono font-semibold text-xs border border-line-strong rounded px-2 py-1 focus:border-brand focus:outline-none"
                        />
                      ) : (
                        <span className="text-ink-subtle font-mono select-none">—</span>
                      )}
                    </td>

                    {/* Credit Input */}
                    <td className="py-2 px-3 text-right">
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
                          className="w-full text-right font-mono font-semibold text-xs border border-line-strong rounded px-2 py-1 focus:border-brand focus:outline-none"
                        />
                      ) : (
                        <span className="text-ink-subtle font-mono select-none">—</span>
                      )}
                    </td>

                    {/* Remove Line */}
                    <td className="py-2 px-2 text-center">
                      <button
                        suppressHydrationWarning
                        onClick={() => handleRemoveLine(idx)}
                        className="text-ink-subtle hover:text-rose-600 p-1"
                        title="Remove line"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-canvas border-t-2 border-line-strong font-mono font-bold text-xs">
                  <td colSpan={3} className="py-2.5 px-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddLine}
                      className="gap-1 font-sans"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add Row
                    </Button>
                  </td>
                  <td className="py-2.5 px-3 text-right text-ink">
                    {formatINR(totalDebit)}
                  </td>
                  <td className="py-2.5 px-3 text-right text-ink">
                    {formatINR(totalCredit)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Balance Status Indicator */}
          <div
            className={`p-2.5 flex items-center justify-between font-mono text-xs border-t ${
              isBalanced
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : "bg-amber-50 text-amber-800 border-amber-200"
            }`}
          >
            <div className="flex items-center gap-2">
              {isBalanced ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-amber-600" />
              )}
              <span>
                {isBalanced
                  ? "Double-Entry Parity Verified: Debits = Credits"
                  : `Out of Balance: Difference of ${formatINR(difference)}`}
              </span>
            </div>
            <span className="text-[11px]">
              {isBalanced ? "Ready to Post" : "Must balance before posting"}
            </span>
          </div>
        </div>

        {/* ============================================================ */}
        {/* MANDATORY DOCUMENT PROOF & STATUTORY VERIFICATION */}
        {/* ============================================================ */}
        <div className="bg-surface border border-line-strong rounded-lg p-4 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2.5 border-b border-line gap-2">
            <div className="flex items-center gap-2">
              <div
                className={`h-7 w-7 rounded-lg flex items-center justify-center font-bold ${
                  documentProof
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                <Paperclip className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-xs uppercase tracking-wider text-ink">
                    Statutory Document Proof &amp; Verification
                  </h3>
                  {documentProof ? (
                    <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300 flex items-center gap-1">
                      <ShieldCheck className="h-3 w-3 text-emerald-700" />
                      Verified Proof Attached
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-300 flex items-center gap-1">
                      <ShieldAlert className="h-3 w-3 text-amber-700" />
                      Proof Required for COA &amp; P&amp;L Post
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-ink-muted font-mono">
                  Indian GAAP compliance: final COA posting and financial statements (P&amp;L, Balance Sheet) require verifiable proof.
                </p>
              </div>
            </div>

            {documentProof && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setDocumentProof(null);
                  setSelectedInvoiceId("");
                          }}
                className="text-[11px] h-7 px-2 border-line-strong text-rose-700 hover:bg-rose-50"
              >
                <X className="h-3 w-3 mr-1" /> Detach Proof
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

          {documentProof ? (
            /* ACTIVE PROOF ATTACHED CARD */
            <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-start gap-2.5">
                <div className="p-2 rounded bg-emerald-100 text-emerald-800 shrink-0 mt-0.5">
                  <FileCheck className="h-4 w-4" />
                </div>
                <div>
                  <span className="font-mono font-bold text-emerald-950 text-xs block">
                    {documentProof.title}
                  </span>
                  <div className="flex items-center gap-3 text-[11px] text-emerald-800 mt-0.5 flex-wrap font-mono">
                    <span>
                      Category: <strong>{documentProof.categoryLabel}</strong>
                    </span>
                    {documentProof.refNumber && (
                      <span>
                        Ref / Ack #: <strong>{documentProof.refNumber}</strong>
                      </span>
                    )}
                    {documentProof.fileSize && (
                      <span>
                        Size: <strong>{documentProof.fileSize}</strong>
                      </span>
                    )}
                    {documentProof.approvedBy && (
                      <span className="text-emerald-900 bg-emerald-200/80 px-1.5 py-0.2 rounded font-bold">
                        ✓ {documentProof.approvedBy}
                      </span>
                    )}
                  </div>
                  {documentProof.notes && (
                    <p className="text-[10px] text-emerald-700 mt-1 italic">
                      {documentProof.notes}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                <span className="text-[10px] font-mono text-emerald-700 font-bold bg-surface px-2 py-1 rounded border border-emerald-300">
                  ✓ READY FOR COA POSTING
                </span>
              </div>
            </div>
          ) : (
            /* PROOF INPUT INTERFACE ACCORDING TO ACTIVE MODE */
            <div className="space-y-3">
              {/* Mode: Sales (F8) */}
              {activeMode === "sales" && (
                <div className="space-y-3">
                  <div className="p-2.5 rounded bg-blue-50/70 border border-blue-200 text-blue-900 text-xs flex items-center gap-2">
                    <FileText className="h-4 w-4 text-blue-600 shrink-0" />
                    <span>
                      <strong>Sales Voucher Proof:</strong> Upload the sales invoice. Invoices raised in the GST hub post their own journal when issued.
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    {/* Upload External Invoice */}
                    <div className="p-3 bg-canvas border border-line rounded-lg space-y-2">
                      <span className="font-bold text-ink text-xs flex items-center gap-1.5">
                        <UploadCloud className="h-3.5 w-3.5 text-brand" /> Upload Sales Invoice
                      </span>
                      <p className="text-[11px] text-ink-muted">
                        Upload invoice copy (PDF/PNG/JPG) generated from external billing/ERP.
                      </p>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={proofRefInput}
                          onChange={(e) => setProofRefInput(e.target.value)}
                          placeholder="External Invoice No (e.g. EXT-8819)"
                          className="flex-1 bg-surface border border-line-strong rounded px-2 py-1 text-xs"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => proofFileInputRef.current?.click()}
                          className="text-xs shrink-0"
                        >
                          Upload Invoice File
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Mode: Contra (F4) */}
              {activeMode === "contra" && (
                <div className="space-y-3">
                  <div className="p-2.5 rounded bg-blue-50/70 border border-blue-200 text-blue-900 text-xs flex items-center gap-2">
                    <Landmark className="h-4 w-4 text-blue-600 shrink-0" />
                    <span>
                      <strong>Contra Voucher Proof:</strong> Cash ↔ Bank transfer requires an authoritative Bank Deposit Slip or Cash Withdrawal Slip.
                    </span>
                  </div>

                  <div className="p-3 bg-canvas border border-line rounded-lg space-y-2.5">
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-xs text-ink">
                        <input
                          type="radio"
                          name="contraSlipType"
                          checked={contraSlipType === "deposit"}
                          onChange={() => setContraSlipType("deposit")}
                          className="text-brand"
                        />
                        <span>Bank Deposit Slip (Cash Deposited into Bank)</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-xs text-ink">
                        <input
                          type="radio"
                          name="contraSlipType"
                          checked={contraSlipType === "withdrawal"}
                          onChange={() => setContraSlipType("withdrawal")}
                          className="text-brand"
                        />
                        <span>Cash Withdrawal Slip / Cheque Leaf (Cash Withdrawn)</span>
                      </label>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={proofRefInput}
                        onChange={(e) => setProofRefInput(e.target.value)}
                        placeholder={
                          contraSlipType === "deposit"
                            ? "Deposit Ack No. (e.g. HDFC-DEP-99482)"
                            : "Cheque / Slip No. (e.g. CHQ-004921)"
                        }
                        className="flex-1 bg-surface border border-line-strong rounded px-2 py-1 text-xs"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => proofFileInputRef.current?.click()}
                        className="text-xs shrink-0"
                      >
                        Upload Slip Scan / Photo
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Mode: Payment (F5) */}
              {activeMode === "payment" && (
                <div className="space-y-3">
                  <div className="p-2.5 rounded bg-blue-50/70 border border-blue-200 text-blue-900 text-xs flex items-center gap-2">
                    <Banknote className="h-4 w-4 text-blue-600 shrink-0" />
                    <span>
                      <strong>Payment Disbursement Proof:</strong> If paid digitally, upload bank payment screenshot / UTR confirmation. If paid in cash, CFO's approval memo is mandatory.
                    </span>
                  </div>

                  <div className="p-3 bg-canvas border border-line rounded-lg space-y-2.5">
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-xs text-ink">
                        <input
                          type="radio"
                          name="paymentMethod"
                          checked={paymentMethod === "digital"}
                          onChange={() => setPaymentMethod("digital")}
                          className="text-brand"
                        />
                        <span>Digital Payment (NEFT / RTGS / UPI / Netbanking)</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-xs text-ink">
                        <input
                          type="radio"
                          name="paymentMethod"
                          checked={paymentMethod === "cash"}
                          onChange={() => setPaymentMethod("cash")}
                          className="text-brand"
                        />
                        <span>Cash Disbursement (CFO Approval Mandatory)</span>
                      </label>
                    </div>

                    {paymentMethod === "digital" ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={proofRefInput}
                          onChange={(e) => setProofRefInput(e.target.value)}
                          placeholder="Bank UTR / Transaction ID (e.g. UTR-HDFC261023941)"
                          className="flex-1 bg-surface border border-line-strong rounded px-2 py-1 text-xs"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => proofFileInputRef.current?.click()}
                          className="text-xs shrink-0"
                        >
                          Upload Payment Screenshot / Advice
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2 bg-amber-50/80 p-2.5 rounded border border-amber-300">
                        <div className="flex items-center justify-between text-amber-950 font-bold text-xs">
                          <span>Physical Cash Disbursement Sanction</span>
                          <span className="text-[10px] bg-amber-200 px-2 py-0.5 rounded text-amber-900 border border-amber-400">
                            Signatory: Chief Financial Officer (CFO)
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={proofRefInput}
                            onChange={(e) => setProofRefInput(e.target.value)}
                            placeholder="CFO Sanction Memo Ref # (e.g. CFO-AUTH-2026-081)"
                            className="flex-1 bg-surface border border-line-strong rounded px-2 py-1 text-xs"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => proofFileInputRef.current?.click()}
                            className="text-xs shrink-0 border-amber-400 text-amber-950"
                          >
                            Upload Signed CFO Memo
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
                  <div className="p-2.5 rounded bg-blue-50/70 border border-blue-200 text-blue-900 text-xs flex items-center gap-2">
                    <FileCheck className="h-4 w-4 text-blue-600 shrink-0" />
                    <span>
                      <strong>Receipt Proof Requirement:</strong> Attach customer remittance advice / vendor invoice copy, OR settle directly against an open sales invoice.
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Bill-wise Matching */}
                    <div className="p-3 bg-canvas border border-line rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-ink text-xs flex items-center gap-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5 text-brand" /> Option 1: Settle Open Sales Invoice
                        </span>
                        <Badge variant="teal">{openInvoices.length} Open Invoices</Badge>
                      </div>
                      <p className="text-[11px] text-ink-muted">
                        Directly match against an open customer invoice to clear receivables and update DSO balances.
                      </p>
                      {openInvoices.length > 0 ? (
                        <div className="space-y-1.5">
                          <select
                            value={selectedInvoiceId}
                            onChange={(e) => handleSelectInvoiceToSettle(e.target.value)}
                            className="w-full bg-surface border border-line-strong rounded px-2 py-1 text-xs"
                          >
                            <option value="">— Choose Open Invoice to Settle —</option>
                            {openInvoices.map((inv) => (
                              <option key={inv.id || inv.invoice_number} value={inv.invoice_number}>
                                {inv.invoice_number} • {customerNameOf(inv)} (Due: ₹{inv.total_amount?.toLocaleString("en-IN")})
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <div className="text-[11px] text-ink-subtle italic">No open customer invoices currently found.</div>
                      )}
                    </div>

                    {/* Remittance Advice Upload */}
                    <div className="p-3 bg-canvas border border-line rounded-lg space-y-2">
                      <span className="font-bold text-ink text-xs flex items-center gap-1.5">
                        <UploadCloud className="h-3.5 w-3.5 text-brand" /> Option 2: Upload Remittance Advice / Invoice Copy
                      </span>
                      <p className="text-[11px] text-ink-muted">
                        Attach invoice received from vendor or customer remittance slip.
                      </p>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={proofRefInput}
                          onChange={(e) => setProofRefInput(e.target.value)}
                          placeholder="Remittance Ref # (e.g. REMIT-8832)"
                          className="flex-1 bg-surface border border-line-strong rounded px-2 py-1 text-xs"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => proofFileInputRef.current?.click()}
                          className="text-xs shrink-0"
                        >
                          Upload Advice
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Mode: Journal (F7) */}
              {activeMode === "journal" && (
                <div className="space-y-3">
                  <div className="p-2.5 rounded bg-blue-50/70 border border-blue-200 text-blue-900 text-xs flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4 text-blue-600 shrink-0" />
                    <span>
                      <strong>Journal Voucher Proof:</strong> Attach bill of purchase for adjustments, depreciation computation schedule, or amortization memo.
                    </span>
                  </div>

                  <div className="p-3 bg-canvas border border-line rounded-lg space-y-2.5">
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-xs text-ink">
                        <input
                          type="radio"
                          name="journalProofType"
                          checked={journalProofType === "adjustment"}
                          onChange={() => setJournalProofType("adjustment")}
                          className="text-brand"
                        />
                        <span>Bill of Purchase for Adjustment / Capitalization</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-xs text-ink">
                        <input
                          type="radio"
                          name="journalProofType"
                          checked={journalProofType === "depreciation"}
                          onChange={() => setJournalProofType("depreciation")}
                          className="text-brand"
                        />
                        <span>Depreciation / Amortization Computation Schedule</span>
                      </label>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={proofRefInput}
                        onChange={(e) => setProofRefInput(e.target.value)}
                        placeholder={
                          journalProofType === "adjustment"
                            ? "Purchase Bill / Docket # (e.g. PUR-ASSET-7721)"
                            : "Schedule Ref # (e.g. DEP-SCHED-FY26-Q3)"
                        }
                        className="flex-1 bg-surface border border-line-strong rounded px-2 py-1 text-xs"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => proofFileInputRef.current?.click()}
                        className="text-xs shrink-0"
                      >
                        Upload Supporting Document
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Mode: Purchase (F9) */}
              {activeMode === "purchase" && (
                <div className="space-y-3">
                  <div className="p-2.5 rounded bg-blue-50/70 border border-blue-200 text-blue-900 text-xs flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4 text-blue-600 shrink-0" />
                    <span>
                      <strong>Purchase Voucher Proof:</strong> Upload supplier's original vendor tax invoice or inward commercial bill.
                    </span>
                  </div>

                  <div className="p-3 bg-canvas border border-line rounded-lg space-y-2.5">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={proofRefInput}
                        onChange={(e) => setProofRefInput(e.target.value)}
                        placeholder="Vendor Tax Invoice No. (e.g. SUPP-INV-2026-904)"
                        className="flex-1 bg-surface border border-line-strong rounded px-2 py-1 text-xs"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => proofFileInputRef.current?.click()}
                        className="text-xs shrink-0"
                      >
                        Upload Vendor Invoice
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Narration Memo Field */}
        <div className="bg-surface border border-line-strong rounded-lg p-3">
          <label className="block text-[10px] font-bold uppercase text-ink-muted mb-1">
            Narration (Mandatory Accounting Memo)
          </label>
          <textarea
            rows={2}
            value={narration}
            onChange={(e) => setNarration(e.target.value)}
            placeholder="Detailed transaction memo and business purpose..."
            className="w-full rounded border border-line-strong p-2 text-xs text-ink focus:border-brand focus:outline-none"
            required
          />
        </div>

        {/* Feedback Messages */}
        {apiError && (
          <div className="p-3 rounded bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{apiError}</span>
          </div>
        )}

        {submissionSuccess && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 text-xs text-emerald-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2 font-medium">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>{submissionSuccess}</span>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/day-book")}
              className="text-xs h-7 px-2.5 font-bold border-emerald-400 bg-surface hover:bg-emerald-100 text-emerald-900 self-end sm:self-center shrink-0"
            >
              Open in Day Book →
            </Button>
          </div>
        )}

        {/* Action Toolbar */}
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/day-book")}
          >
            View Day Book
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleSaveAndPost(false)}
              isLoading={isSubmitting}
              className="gap-1.5"
            >
              <Save className="h-3.5 w-3.5" /> Save Draft
            </Button>
            <Button
              variant="tally"
              size="sm"
              onClick={() => handleSaveAndPost(true)}
              isLoading={isSubmitting}
              className="gap-1.5 font-bold"
              disabled={!isBalanced}
            >
              {loadedBuilderDraft ? (
                <>
                  <Check className="h-3.5 w-3.5" />{" "}
                  {requireApproval ? "Confirm & Submit for Approval" : "Confirm & Post to Day Book & Ledger"}
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" /> {requireApproval ? "Submit for Approval" : "Post & Validate Voucher"}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
