import { describe, it, expect } from 'vitest';
import { AlerxGroup } from '@/types/accounting';

interface JournalLineInput {
  account_id: string;
  debit: number;
  credit: number;
  narration?: string;
}

/**
 * Validates double-entry constraint: sum of debits must equal sum of credits.
 */
function validateDoubleEntry(lines: JournalLineInput[]): {
  isValid: boolean;
  totalDebit: number;
  totalCredit: number;
  imbalance: number;
} {
  const totalDebit = lines.reduce((sum, line) => sum + (Number(line.debit) || 0), 0);
  const totalCredit = lines.reduce((sum, line) => sum + (Number(line.credit) || 0), 0);
  const imbalance = Math.abs(totalDebit - totalCredit);
  return {
    isValid: lines.length >= 2 && imbalance < 0.0001 && totalDebit > 0,
    totalDebit,
    totalCredit,
    imbalance,
  };
}

/**
 * Calculates natural balances for ALERX structure.
 * Asset, Expense: Dr - Cr (debits are positive)
 * Liability, Equity, Revenue: Cr - Dr (credits are positive)
 */
function computeNaturalBalance(group: AlerxGroup, debitTotal: number, creditTotal: number): number {
  switch (group) {
    case 'asset':
    case 'expense':
      return debitTotal - creditTotal;
    case 'liability':
    case 'equity':
    case 'revenue':
      return creditTotal - debitTotal;
  }
}

/**
 * Calculates GST components for Intra-state vs Inter-state supply.
 */
function calculateGst(
  taxableAmount: number,
  ratePct: number,
  supplyType: 'intra_state' | 'inter_state'
) {
  const totalTax = (taxableAmount * ratePct) / 100;
  if (supplyType === 'intra_state') {
    const cgst = totalTax / 2;
    const sgst = totalTax / 2;
    return {
      supplyType,
      cgst,
      sgst,
      igst: 0,
      totalTax,
      grandTotal: taxableAmount + totalTax,
    };
  } else {
    return {
      supplyType,
      cgst: 0,
      sgst: 0,
      igst: totalTax,
      totalTax,
      grandTotal: taxableAmount + totalTax,
    };
  }
}

describe('Accounting Double-Entry Validation', () => {
  it('passes when debits equal credits with at least 2 lines', () => {
    const lines: JournalLineInput[] = [
      { account_id: 'acc-1', debit: 50000, credit: 0, narration: 'Office Rent' },
      { account_id: 'acc-2', debit: 0, credit: 50000, narration: 'HDFC Bank' },
    ];
    const result = validateDoubleEntry(lines);
    expect(result.isValid).toBe(true);
    expect(result.imbalance).toBe(0);
    expect(result.totalDebit).toBe(50000);
    expect(result.totalCredit).toBe(50000);
  });

  it('rejects an unbalanced entry (Dr != Cr)', () => {
    const lines: JournalLineInput[] = [
      { account_id: 'acc-1', debit: 50000, credit: 0 },
      { account_id: 'acc-2', debit: 0, credit: 45000 },
    ];
    const result = validateDoubleEntry(lines);
    expect(result.isValid).toBe(false);
    expect(result.imbalance).toBe(5000);
  });

  it('rejects single-line entry even if mathematically valid', () => {
    const lines: JournalLineInput[] = [
      { account_id: 'acc-1', debit: 0, credit: 0 },
    ];
    const result = validateDoubleEntry(lines);
    expect(result.isValid).toBe(false);
  });
});

describe('ALERX Natural Balance Rules', () => {
  it('computes Asset balance correctly (Dr positive)', () => {
    // Bank account with 1,00,000 deposits (Dr) and 40,000 withdrawals (Cr)
    const balance = computeNaturalBalance('asset', 100000, 40000);
    expect(balance).toBe(60000);
  });

  it('computes Liability balance correctly (Cr positive)', () => {
    // Accounts payable with 75,000 bills (Cr) and 25,000 payments (Dr)
    const balance = computeNaturalBalance('liability', 25000, 75000);
    expect(balance).toBe(50000);
  });

  it('computes Revenue balance correctly (Cr positive)', () => {
    const balance = computeNaturalBalance('revenue', 0, 250000);
    expect(balance).toBe(250000);
  });

  it('computes Expense balance correctly (Dr positive)', () => {
    const balance = computeNaturalBalance('expense', 18000, 0);
    expect(balance).toBe(18000);
  });
});

describe('GST Calculation Engine', () => {
  it('calculates Intra-State GST split 50/50 between CGST and SGST', () => {
    // ₹1,00,000 @ 18% intra-state
    const gst = calculateGst(100000, 18, 'intra_state');
    expect(gst.cgst).toBe(9000);
    expect(gst.sgst).toBe(9000);
    expect(gst.igst).toBe(0);
    expect(gst.totalTax).toBe(18000);
    expect(gst.grandTotal).toBe(118000);
  });

  it('calculates Inter-State GST with 100% assigned to IGST', () => {
    // ₹2,00,000 @ 18% inter-state
    const gst = calculateGst(200000, 18, 'inter_state');
    expect(gst.cgst).toBe(0);
    expect(gst.sgst).toBe(0);
    expect(gst.igst).toBe(36000);
    expect(gst.totalTax).toBe(36000);
    expect(gst.grandTotal).toBe(236000);
  });
});
