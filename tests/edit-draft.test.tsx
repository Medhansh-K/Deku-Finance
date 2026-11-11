import React from 'react';
import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { blankDraftLine, draftBalance, draftErrors, draftPayload, toDraftLine, DraftLine } from '@/lib/vouchers/edit-draft';
import { journalToVoucher, VoucherItem } from '@/lib/reports/vouchers';
import type { Account, JournalEntry } from '@/types/accounting';

const updateJournal = vi.fn();
vi.mock('@/api/endpoints', () => ({ accountingApi: { updateJournal: (...a: unknown[]) => updateJournal(...a) } }));

import { EditDraftModal } from '@/modules/day-book/EditDraftModal';

const line = (dr_cr: DraftLine['dr_cr'], amount: string, account_id = 'a1'): DraftLine => ({ account_id, dr_cr, amount });

const accounts = [
  { id: 'a1', code: '5090', name: 'Charges', is_postable: true, is_active: true },
  { id: 'a2', code: '1020', name: 'Bank', is_postable: true, is_active: true },
  { id: 'group', code: '5000', name: 'Expense group', is_postable: false, is_active: true },
  { id: 'old', code: '5099', name: 'Closed ledger', is_postable: true, is_active: false },
] as Account[];

const entry = (over: Partial<JournalEntry> = {}): JournalEntry => ({
  id: 'j1',
  organisation_id: 'o1',
  fiscal_period_id: 'p1',
  entry_number: 'JRN-0001',
  entry_date: '2026-10-05',
  status: 'draft',
  narration: 'Bank fee',
  journal_entry_lines: [
    { line_number: 1, account_id: 'a1', party_id: 'party-1', description: 'Fee', debit: 100, credit: 0 },
    { line_number: 2, account_id: 'a2', debit: 0, credit: 100 },
  ],
  ...over,
});

const voucher = (over: Partial<JournalEntry> = {}): VoucherItem =>
  journalToVoucher(entry(over), new Map(accounts.map((a) => [a.id, a])), new Map());

describe('draft balance', () => {
  it('compares debits and credits in paise, so decimals do not drift', () => {
    expect(draftBalance([line('Dr', '0.1'), line('Dr', '0.2'), line('Cr', '0.3')])).toMatchObject({ balanced: true, differencePaise: 0 });
    expect(draftBalance([line('Dr', '100'), line('Cr', '90.5')])).toEqual({ debitPaise: 10000, creditPaise: 9050, differencePaise: 950, balanced: false });
  });
  it('a voucher of nothing is not balanced', () => {
    expect(draftBalance([blankDraftLine('Dr'), blankDraftLine('Cr')]).balanced).toBe(false);
  });
});

describe('draft validation', () => {
  it('needs a date, a narration, two lines, accounts and amounts', () => {
    expect(draftErrors('', ' ', [line('Dr', '0', '')])).toEqual([
      'Enter the voucher date.',
      'Enter a narration.',
      'A voucher needs at least 2 lines.',
      'Line 1: choose an account.',
      'Line 1: enter an amount above zero.',
    ]);
  });
  it('lets an unbalanced draft through, because posting is what refuses it', () => {
    expect(draftErrors('2026-10-05', 'Fee', [line('Dr', '100'), line('Cr', '90')])).toEqual([]);
  });
});

describe('draft payload', () => {
  it('numbers the lines, keeps each party and rounds to the paisa', () => {
    const lines = [{ ...line('Dr', '100.005'), party_id: 'party-1', description: 'Fee' }, line('Cr', '100.01', 'a2')];
    expect(draftPayload('2026-10-05', ' Fee ', ' ', lines)).toEqual({
      entry_date: '2026-10-05',
      narration: 'Fee',
      reference: undefined,
      lines: [
        { line_number: 1, account_id: 'a1', party_id: 'party-1', description: 'Fee', debit: 100.01, credit: 0 },
        { line_number: 2, account_id: 'a2', party_id: undefined, description: undefined, debit: 0, credit: 100.01 },
      ],
    });
  });
  it('day book rows carry what the editor needs', () => {
    const [first, second] = voucher().lines.map(toDraftLine);
    expect(first).toEqual({ account_id: 'a1', party_id: 'party-1', description: 'Fee', dr_cr: 'Dr', amount: '100' });
    expect(second).toMatchObject({ account_id: 'a2', dr_cr: 'Cr', amount: '100' });
  });
});

describe('EditDraftModal', () => {
  beforeEach(() => {
    updateJournal.mockReset();
  });

  const open = (v = voucher()) => {
    const onSaved = vi.fn();
    render(<EditDraftModal orgId="o1" voucher={v} accounts={accounts} onClose={vi.fn()} onSaved={onSaved} />);
    return onSaved;
  };

  it('says whether it balances as the figures change, and saves the new figures', async () => {
    updateJournal.mockResolvedValue({ success: true });
    const onSaved = open();
    expect(screen.getByRole('status')).toHaveTextContent('Balanced');

    fireEvent.change(screen.getByLabelText('Line 1 amount in rupees'), { target: { value: '250' } });
    expect(screen.getByRole('status')).toHaveTextContent('Out of balance');
    fireEvent.change(screen.getByLabelText('Line 2 amount in rupees'), { target: { value: '250' } });
    expect(screen.getByRole('status')).toHaveTextContent('Balanced');

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const [org, id, payload] = updateJournal.mock.calls[0];
    expect([org, id]).toEqual(['o1', 'j1']);
    expect(payload.lines.map((l: { debit: number; credit: number; party_id?: string }) => [l.debit, l.credit, l.party_id])).toEqual([[250, 0, 'party-1'], [0, 250, undefined]]);
  });

  it("doesn't save the voucher number as a reference when there is none", async () => {
    updateJournal.mockResolvedValue({ success: true });
    open();
    expect(screen.getByLabelText('Reference')).toHaveValue('');
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(updateJournal).toHaveBeenCalled());
    expect(updateJournal.mock.calls[0][2].reference).toBeUndefined();
  });

  it('offers postable, active accounts, and keeps the one a line already uses', () => {
    open(voucher({ journal_entry_lines: [
      { line_number: 1, account_id: 'old', debit: 100, credit: 0 },
      { line_number: 2, account_id: 'a2', debit: 0, credit: 100 },
    ] }));
    const names = (label: string) => Array.from(screen.getByLabelText(label).querySelectorAll('option')).map((o) => o.textContent);
    expect(names('Line 1 account')).toContain('5099 Closed ledger');
    expect(names('Line 2 account')).not.toContain('5099 Closed ledger');
    expect(names('Line 2 account')).not.toContain('5000 Expense group');
  });

  it("shows the server's refusal and keeps the form", async () => {
    updateJournal.mockRejectedValue(new Error('No open fiscal period covers 2020-01-01.'));
    const onSaved = open();
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No open fiscal period');
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("doesn't call the server with a line missing its account", () => {
    open(voucher({ journal_entry_lines: [] }));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Line 1: choose an account.');
    expect(updateJournal).not.toHaveBeenCalled();
  });
});
