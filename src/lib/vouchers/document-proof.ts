"use client";

export type ProofType =
  | "sales_external_invoice"
  | "sales_builder_paired"
  | "contra_bank_deposit_slip"
  | "contra_cash_withdrawal_slip"
  | "payment_digital_screenshot"
  | "payment_cash_cfo_approval"
  | "receipt_vendor_invoice"
  | "receipt_bill_matching"
  | "journal_adjustment_bill"
  | "journal_depreciation_memo"
  | "purchase_vendor_bill";

export interface DocumentProofAttachment {
  id: string;
  proofType: ProofType;
  categoryLabel: string;
  title: string;
  fileName?: string;
  fileSize?: string;
  fileData?: string; // Data URL or preview
  refNumber?: string; // UTR #, Deposit Slip #, CFO Memo #, Inv #
  approvedBy?: string; // e.g. "CFO / Finance Controller"
  uploadedAt: string;
  verified: boolean;
  notes?: string;
  linkedBuilderDraftId?: string;
  linkedInvoiceNumber?: string;
}

export interface ProofRequirementInfo {
  voucherType: string;
  fKey: string;
  label: string;
  description: string;
  acceptableProofs: {
    type: ProofType;
    label: string;
    description: string;
    requiresRef?: boolean;
    refLabel?: string;
    refPlaceholder?: string;
  }[];
}

export const PROOF_REQUIREMENTS: Record<string, ProofRequirementInfo> = {
  sales: {
    voucherType: "sales",
    fKey: "F8",
    label: "Sales Voucher Proof",
    description:
      "Required for Revenue Recognition & Output Tax in P&L & Balance Sheet. Must either pair with an invoice from Document Builder or upload an externally built/generated invoice.",
    acceptableProofs: [
      {
        type: "sales_builder_paired",
        label: "Pair with Document Builder Invoice",
        description: "Select an invoice finalized or drafted in the Document Builder desk.",
        requiresRef: true,
        refLabel: "Builder Invoice #",
        refPlaceholder: "e.g. INV-2026-0042",
      },
      {
        type: "sales_external_invoice",
        label: "Upload External Sales Invoice / Scan",
        description: "Upload generated / built invoice copy (PDF, PNG, JPG) from ERP or billing system.",
        requiresRef: true,
        refLabel: "External Invoice #",
        refPlaceholder: "e.g. EXT-INV-8891",
      },
    ],
  },
  contra: {
    voucherType: "contra",
    fKey: "F4",
    label: "Contra Transfer Proof",
    description:
      "Required for Cash ↔ Bank liquidity movements. Must attach a stamped Bank Deposit Slip or Cash Withdrawal Slip.",
    acceptableProofs: [
      {
        type: "contra_bank_deposit_slip",
        label: "Bank Deposit Slip (Cash Deposited)",
        description: "Stamped counterfoil or bank acknowledgment slip for cash deposit into current/savings account.",
        requiresRef: true,
        refLabel: "Deposit Slip Ack #",
        refPlaceholder: "e.g. HDFC-DEP-99482",
      },
      {
        type: "contra_cash_withdrawal_slip",
        label: "Cash Withdrawal Slip / Cheque Leaf",
        description: "Self cheque leaf / bank debit slip acknowledging cash withdrawal for office float / petty cash.",
        requiresRef: true,
        refLabel: "Cheque / Slip #",
        refPlaceholder: "e.g. CHQ-004921",
      },
    ],
  },
  payment: {
    voucherType: "payment",
    fKey: "F5",
    label: "Payment Disbursement Proof",
    description:
      "Required for Bank/Cash outflows & expense booking. If paid digitally, attach payment screenshot/advice. If paid in cash, CFO's approval memo is mandatory.",
    acceptableProofs: [
      {
        type: "payment_digital_screenshot",
        label: "Digital Payment Screenshot / UTR Advice",
        description: "Bank transfer confirmation (NEFT / RTGS / UPI / Corporate Banking) with visible UTR number.",
        requiresRef: true,
        refLabel: "Bank UTR / Transaction ID",
        refPlaceholder: "e.g. UTR-HDFC261023941",
      },
      {
        type: "payment_cash_cfo_approval",
        label: "CFO's Approval Slip (Cash Disbursement)",
        description: "Signed authorization memo / CFO voucher sanctioning physical cash disbursement from office chest.",
        requiresRef: true,
        refLabel: "CFO Sanction Memo #",
        refPlaceholder: "e.g. CFO-AUTH-2026-081",
      },
    ],
  },
  receipt: {
    voucherType: "receipt",
    fKey: "F6",
    label: "Customer Inward Settlement Proof",
    description:
      "Required for customer receivables clearing & bank balance update. Attach invoice received / remittance advice or link against open sales invoice.",
    acceptableProofs: [
      {
        type: "receipt_vendor_invoice",
        label: "Inward Remittance Advice / Payment Copy",
        description: "Customer remittance advice, client payment confirmation screenshot, or vendor invoice copy.",
        requiresRef: true,
        refLabel: "Remittance Reference #",
        refPlaceholder: "e.g. CLIENT-ADV-8832",
      },
      {
        type: "receipt_bill_matching",
        label: "Bill-wise Matching (Open Sales Invoice)",
        description: "Directly match and clear against an open B2B customer sales invoice in the register.",
        requiresRef: true,
        refLabel: "Settled Invoice #",
        refPlaceholder: "e.g. INV-2026-5360",
      },
    ],
  },
  journal: {
    voucherType: "journal",
    fKey: "F7",
    label: "Journal Adjustment Backing Proof",
    description:
      "Required for non-cash period-end adjustments. Attach bill of purchase, depreciation schedule, or amortization memo.",
    acceptableProofs: [
      {
        type: "journal_adjustment_bill",
        label: "Bill of Purchase / Adjustment Bill",
        description: "Original purchase bill or capitalization invoice justifying fixed asset adjustments or transfer.",
        requiresRef: true,
        refLabel: "Purchase Bill / Docket #",
        refPlaceholder: "e.g. PUR-ASSET-7721",
      },
      {
        type: "journal_depreciation_memo",
        label: "Depreciation / Amortization Schedule",
        description: "Companies Act / Income Tax Act asset block depreciation computation sheet or amortization docket.",
        requiresRef: true,
        refLabel: "Schedule Reference #",
        refPlaceholder: "e.g. DEP-SCHED-FY26-Q3",
      },
    ],
  },
  purchase: {
    voucherType: "purchase",
    fKey: "F9",
    label: "Inward Purchase Tax Bill",
    description:
      "Required for Supplier Payables & Input Tax Credit (ITC) booking. Must attach original vendor tax invoice.",
    acceptableProofs: [
      {
        type: "purchase_vendor_bill",
        label: "Vendor Tax Invoice / Inward Bill",
        description: "Supplier's original GST tax invoice or commercial inward delivery invoice copy.",
        requiresRef: true,
        refLabel: "Vendor Invoice #",
        refPlaceholder: "e.g. SUPP-INV-2026-904",
      },
    ],
  },
};

/**
 * Validates whether the attached proof satisfies the statutory rule for this voucher type.
 */
export function validateProofForVoucher(
  mode: string,
  proof: DocumentProofAttachment | null,
  paymentMethod: "digital" | "cash" = "digital"
): { isValid: boolean; message?: string } {
  if (!proof) {
    const req = PROOF_REQUIREMENTS[mode];
    if (mode === "payment") {
      return {
        isValid: false,
        message:
          paymentMethod === "digital"
            ? "Missing Proof: Digital payment requires a Payment Screenshot or Bank UTR confirmation advice."
            : "Missing Proof: Cash payment requires CFO's written Approval Slip / Sanction Memo.",
      };
    }
    return {
      isValid: false,
      message: req
        ? `Mandatory Proof Missing: ${req.label} (${req.acceptableProofs.map((p) => p.label).join(" OR ")}) is required before this voucher can be posted to the Chart of Accounts, P&L, or Balance Sheet.`
        : "Mandatory document proof must be uploaded before posting to the ledger.",
    };
  }

  // Check specific rules
  if (mode === "sales") {
    if (
      proof.proofType !== "sales_external_invoice" &&
      proof.proofType !== "sales_builder_paired"
    ) {
      return {
        isValid: false,
        message: "Sales vouchers require either an uploaded sales invoice or a paired Document Builder invoice.",
      };
    }
  } else if (mode === "contra") {
    if (
      proof.proofType !== "contra_bank_deposit_slip" &&
      proof.proofType !== "contra_cash_withdrawal_slip"
    ) {
      return {
        isValid: false,
        message: "Contra vouchers require a verified Bank Deposit Slip or Cash Withdrawal Slip.",
      };
    }
  } else if (mode === "payment") {
    if (paymentMethod === "digital" && proof.proofType !== "payment_digital_screenshot") {
      return {
        isValid: false,
        message: "For digital payments, you must attach a Payment Screenshot or Bank UTR advice.",
      };
    }
    if (paymentMethod === "cash" && proof.proofType !== "payment_cash_cfo_approval") {
      return {
        isValid: false,
        message: "For cash disbursements, CFO's approval slip is strictly mandatory.",
      };
    }
  } else if (mode === "receipt") {
    if (
      proof.proofType !== "receipt_vendor_invoice" &&
      proof.proofType !== "receipt_bill_matching"
    ) {
      return {
        isValid: false,
        message: "Receipt vouchers require customer remittance proof or bill-wise matching against an open sales invoice.",
      };
    }
  } else if (mode === "journal") {
    if (
      proof.proofType !== "journal_adjustment_bill" &&
      proof.proofType !== "journal_depreciation_memo"
    ) {
      return {
        isValid: false,
        message: "Journal entries require a purchase bill for adjustment or a depreciation/amortization schedule.",
      };
    }
  } else if (mode === "purchase") {
    if (proof.proofType !== "purchase_vendor_bill") {
      return {
        isValid: false,
        message: "Purchase vouchers require an inward vendor tax invoice.",
      };
    }
  }

  return { isValid: true };
}
