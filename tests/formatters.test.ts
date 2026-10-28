import { describe, it, expect } from 'vitest';
import { formatINR, parseAmount } from '@/lib/formatters/currency';
import { formatDateTally, toISODateString } from '@/lib/formatters/date';

describe('Currency and Accounting Formatters', () => {
  it('formats positive numbers in Indian Lakhs and Crores grouping', () => {
    expect(formatINR(1000)).toBe('₹ 1,000.00');
    expect(formatINR(100000)).toBe('₹ 1,00,000.00');
    expect(formatINR(1234567.89)).toBe('₹ 12,34,567.89');
    expect(formatINR(10000000)).toBe('₹ 1,00,00,000.00');
  });

  it('formats zero amounts correctly', () => {
    expect(formatINR(0)).toBe('₹ 0.00');
  });

  it('formats amounts with Dr/Cr notation', () => {
    expect(formatINR(50000, { showDrCr: true })).toBe('₹ 50,000.00 Dr');
    expect(formatINR(-50000, { showDrCr: true })).toBe('₹ 50,000.00 Cr');
  });

  it('handles negative amounts', () => {
    expect(formatINR(-2500)).toBe('-₹ 2,500.00');
  });

  it('parses formatted numeric strings cleanly', () => {
    expect(parseAmount('1,00,000.50')).toBe(100000.5);
    expect(parseAmount('₹ 45,678')).toBe(45678);
    expect(parseAmount('')).toBe(0);
    expect(parseAmount('invalid')).toBe(0);
  });
});

describe('Date Formatters', () => {
  it('formats dates in Tally style (DD-MMM-YYYY)', () => {
    const formatted = formatDateTally('2026-10-20');
    expect(formatted).toBe('20-Oct-2026');
  });

  it('produces valid YYYY-MM-DD ISO string format', () => {
    const d = new Date(2026, 9, 20); // October is month 9 (0-indexed)
    expect(toISODateString(d)).toBe('2026-10-20');
  });
});

it("shows a missing amount as a dash, not a zero", () => {
  expect(formatINR(null)).toBe("–");
  expect(formatINR(undefined)).toBe("–");
  expect(formatINR(0)).toContain("0.00");
});
