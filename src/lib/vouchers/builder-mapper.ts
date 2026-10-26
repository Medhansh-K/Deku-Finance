import { Account, Party } from "@/types/accounting";
import { BuilderLedgerDraft } from "./builder-drafts";
import { VoucherLineState, VoucherMode } from "@/modules/vouchers/VoucherWorkspace";
import { formatINR } from "@/lib/formatters/currency";

export interface MappedVoucherData {
  mode: VoucherMode;
  voucherNumber: string;
  reference: string;
  date: string;
  narration: string;
  partyId?: string;
  lines: VoucherLineState[];
  totalDebit: number;
  totalCredit: number;
}

/**
 * Helper to find an account by code, keyword in name, or account type.
 */
function matchAccount(
  accounts: Account[],
  code?: string,
  nameKeyword?: string,
  fallbackType?: string
): Account | undefined {
  if (code) {
    const byCode = accounts.find((a) => a.code === code && a.is_postable !== false);
    if (byCode) return byCode;
  }
  if (nameKeyword) {
    const kw = nameKeyword.toLowerCase();
    const byName = accounts.find(
      (a) => a.name.toLowerCase().includes(kw) && a.is_postable !== false
    );
    if (byName) return byName;
  }
  if (fallbackType) {
    const byType = accounts.find(
      (a) => a.type.toLowerCase() === fallbackType.toLowerCase() && a.is_postable !== false
    );
    if (byType) return byType;
  }
  return accounts[0];
}

/**
 * Maps a BuilderLedgerDraft into a double-entry balanced voucher for the Voucher Desk.
 */
export function mapBuilderDraftToVoucher(
  draft: BuilderLedgerDraft,
  accounts: Account[],
  parties: Party[]
): MappedVoucherData {
  const isInterstate = draft.isInterstate || false;
  const taxable = draft.calculations.taxableAmount || 0;
  const grandTotal = draft.calculations.roundedTotal || 0;
  const cgst = draft.calculations.totalCgst || 0;
  const sgst = draft.calculations.totalSgst || 0;
  const igst = draft.calculations.totalIgst || 0;

  // Match or resolve counterparty
  const matchedParty = parties.find(
    (p) =>
      (p.legal_name && p.legal_name.toLowerCase().includes(draft.partyName.toLowerCase())) ||
      (p.display_name && p.display_name.toLowerCase().includes(draft.partyName.toLowerCase())) ||
      (draft.partyGSTIN && p.gstin === draft.partyGSTIN)
  ) || parties[0];
  const partyId = matchedParty?.id || "self";

  // Determine mode
  let mode: VoucherMode = "sales";
  let modePrefix = "SAL";

  if (draft.documentType === "purchase_order") {
    mode = "purchase";
    modePrefix = "PUR";
  } else if (draft.documentType === "credit_note" || draft.documentType === "debit_note") {
    mode = "journal";
    modePrefix = "JRN";
  }

  // Suffix from docNumber (e.g. INV-2026-089 -> 089)
  const docNumParts = draft.docNumber.split("-");
  const suffix = docNumParts[docNumParts.length - 1] || Math.floor(1000 + Math.random() * 9000).toString();
  const voucherNumber = `${modePrefix}-2026-${suffix}`;

  // Find relevant ledger accounts
  const debtorAcc =
    matchAccount(accounts, "1030", "Debtors", "asset") || accounts[0];
  const creditorAcc =
    matchAccount(accounts, "2010", "Creditors", "liability") || accounts[0];
  const revenueAcc =
    matchAccount(accounts, "4010", "Sales", "income") ||
    matchAccount(accounts, "4020", "Revenue", "income") ||
    accounts[0];
  const expenseAcc =
    matchAccount(accounts, "5010", "Cost of Goods", "expense") ||
    matchAccount(accounts, "5030", "Cloud", "expense") ||
    accounts[0];

  const outCgstAcc = matchAccount(accounts, "2081", "Output CGST", "liability") || accounts[0];
  const outSgstAcc = matchAccount(accounts, "2082", "Output SGST", "liability") || accounts[0];
  const outIgstAcc = matchAccount(accounts, "2083", "Output IGST", "liability") || accounts[0];

  const inCgstAcc = matchAccount(accounts, "1081", "Input CGST", "asset") || accounts[0];
  const inSgstAcc = matchAccount(accounts, "1082", "Input SGST", "asset") || accounts[0];
  const inIgstAcc = matchAccount(accounts, "1083", "Input IGST", "asset") || accounts[0];

  const lines: VoucherLineState[] = [];
  const now = Date.now();

  if (mode === "sales") {
    // SALES INVOICE ALLOCATION:
    // Line 1: Dr Debtors (Receivable) [Grand Total]
    lines.push({
      id: `bld-line-1-${now}`,
      line_number: 1,
      dr_cr: "Dr",
      account_id: debtorAcc?.id || "",
      party_id: partyId,
      description: `Trade Receivable • ${draft.partyName} (Ref ${draft.docNumber})`,
      amount: grandTotal.toFixed(2),
    });

    // Line 2: Cr Sales Revenue [Taxable]
    lines.push({
      id: `bld-line-2-${now}`,
      line_number: 2,
      dr_cr: "Cr",
      account_id: revenueAcc?.id || "",
      party_id: "self",
      description: `Sales Revenue • ${draft.items[0]?.description || "Goods / Service delivery"}`,
      amount: taxable.toFixed(2),
    });

    // Tax Lines
    if (isInterstate && igst > 0) {
      lines.push({
        id: `bld-line-3-${now}`,
        line_number: 3,
        dr_cr: "Cr",
        account_id: outIgstAcc?.id || "",
        party_id: "self",
        description: `Output IGST @ 18% interstate tax liability`,
        amount: igst.toFixed(2),
      });
    } else {
      if (cgst > 0) {
        lines.push({
          id: `bld-line-3-${now}`,
          line_number: 3,
          dr_cr: "Cr",
          account_id: outCgstAcc?.id || "",
          party_id: "self",
          description: `Output Central GST (CGST) liability`,
          amount: cgst.toFixed(2),
        });
      }
      if (sgst > 0) {
        lines.push({
          id: `bld-line-4-${now}`,
          line_number: lines.length + 1,
          dr_cr: "Cr",
          account_id: outSgstAcc?.id || "",
          party_id: "self",
          description: `Output State GST (SGST) liability`,
          amount: sgst.toFixed(2),
        });
      }
    }
  } else if (mode === "purchase") {
    // PURCHASE ORDER ALLOCATION:
    // Line 1: Dr Expense / COGS [Taxable]
    lines.push({
      id: `bld-line-1-${now}`,
      line_number: 1,
      dr_cr: "Dr",
      account_id: expenseAcc?.id || "",
      party_id: "self",
      description: `Direct procurement • ${draft.items[0]?.description || "Vendor supply"}`,
      amount: taxable.toFixed(2),
    });

    // Tax Input Credits
    if (isInterstate && igst > 0) {
      lines.push({
        id: `bld-line-2-${now}`,
        line_number: 2,
        dr_cr: "Dr",
        account_id: inIgstAcc?.id || "",
        party_id: "self",
        description: `Input IGST input tax credit`,
        amount: igst.toFixed(2),
      });
    } else {
      if (cgst > 0) {
        lines.push({
          id: `bld-line-2-${now}`,
          line_number: 2,
          dr_cr: "Dr",
          account_id: inCgstAcc?.id || "",
          party_id: "self",
          description: `Input Central GST (CGST) tax credit`,
          amount: cgst.toFixed(2),
        });
      }
      if (sgst > 0) {
        lines.push({
          id: `bld-line-3-${now}`,
          line_number: lines.length + 1,
          dr_cr: "Dr",
          account_id: inSgstAcc?.id || "",
          party_id: "self",
          description: `Input State GST (SGST) tax credit`,
          amount: sgst.toFixed(2),
        });
      }
    }

    // Line Last: Cr Accounts Payable (Creditors) [Grand Total]
    lines.push({
      id: `bld-line-creditor-${now}`,
      line_number: lines.length + 1,
      dr_cr: "Cr",
      account_id: creditorAcc?.id || "",
      party_id: partyId,
      description: `Vendor Payable • ${draft.partyName} (Ref ${draft.docNumber})`,
      amount: grandTotal.toFixed(2),
    });
  } else {
    // JOURNAL / ADJUSTMENT (Credit Note / Debit Note)
    lines.push({
      id: `bld-line-1-${now}`,
      line_number: 1,
      dr_cr: "Dr",
      account_id: revenueAcc?.id || "",
      party_id: "self",
      description: `Downward sales adjustment / rebate (${draft.docNumber})`,
      amount: grandTotal.toFixed(2),
    });
    lines.push({
      id: `bld-line-2-${now}`,
      line_number: 2,
      dr_cr: "Cr",
      account_id: debtorAcc?.id || "",
      party_id: partyId,
      description: `Rebate credit passed to ${draft.partyName}`,
      amount: grandTotal.toFixed(2),
    });
  }

  // Calculate totals
  let totalDebit = 0;
  let totalCredit = 0;
  lines.forEach((l) => {
    const val = parseFloat(l.amount) || 0;
    if (l.dr_cr === "Dr") totalDebit += val;
    else totalCredit += val;
  });

  const narration = `[${mode.toUpperCase()}] ${draft.documentType.replace("_", " ").toUpperCase()} ${draft.docNumber} issued to ${draft.partyName} — Taxable: ₹ ${taxable.toLocaleString("en-IN")}, GST: ₹ ${(cgst + sgst + igst).toLocaleString("en-IN")}. Total: ₹ ${grandTotal.toLocaleString("en-IN")}.`;

  return {
    mode,
    voucherNumber,
    reference: draft.docNumber,
    date: draft.docDate,
    narration,
    partyId,
    lines,
    totalDebit,
    totalCredit,
  };
}
