import React, { useState } from 'react';
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { comboboxKey, hsnCodeError } from '@/modules/hsn/hsn';

const search = vi.fn();
vi.mock('@/api/endpoints', () => ({ hsnApi: { search: (...a: unknown[]) => search(...a) } }));

import { HsnCombobox } from '@/modules/hsn/HsnCombobox';

describe('hsnCodeError', () => {
  it('accepts blank and 4/6/8-digit codes', () => {
    for (const ok of ['', '  ', '8471', '847130', '84713010', ' 9983 ']) expect(hsnCodeError(ok)).toBeNull();
  });
  it('rejects other lengths and non-digits', () => {
    for (const bad of ['84', '847', '84713', '8471301', '847130101', '84A1', '8471.30']) expect(hsnCodeError(bad)).not.toBeNull();
  });
});

describe('comboboxKey', () => {
  const closed = { open: false, active: -1 };
  it('ArrowDown opens on the first option and wraps', () => {
    expect(comboboxKey('ArrowDown', closed, 3)).toMatchObject({ open: true, active: 0, handled: true });
    expect(comboboxKey('ArrowDown', { open: true, active: 2 }, 3)).toMatchObject({ active: 0 });
  });
  it('ArrowUp wraps to the last option', () => {
    expect(comboboxKey('ArrowUp', { open: true, active: 0 }, 3)).toMatchObject({ active: 2 });
    expect(comboboxKey('ArrowUp', { open: true, active: -1 }, 3)).toMatchObject({ active: 2 });
  });
  it('Enter selects only with a highlighted option, otherwise passes through', () => {
    expect(comboboxKey('Enter', { open: true, active: 1 }, 3)).toMatchObject({ select: true, open: false, handled: true });
    expect(comboboxKey('Enter', { open: true, active: -1 }, 3)).toMatchObject({ select: false, handled: false });
    expect(comboboxKey('Enter', closed, 3)).toMatchObject({ handled: false });
  });
  it('Escape closes an open list and passes through when closed', () => {
    expect(comboboxKey('Escape', { open: true, active: 1 }, 3)).toMatchObject({ open: false, handled: true });
    expect(comboboxKey('Escape', closed, 3)).toMatchObject({ handled: false });
  });
  it('no options means no highlight', () => {
    expect(comboboxKey('ArrowDown', { open: true, active: -1 }, 0)).toMatchObject({ active: -1 });
  });
});

function Harness() {
  const [v, setV] = useState('');
  return <HsnCombobox label="HSN" value={v} onChange={setV} />;
}

describe('HsnCombobox', () => {
  beforeEach(() => search.mockReset());

  it('picks a suggestion with the keyboard and never touches anything but the code', async () => {
    search.mockResolvedValue({
      success: true,
      loaded: true,
      data: [
        { code: '0012', description: 'First', kind: 'goods', chapter: '00', match: 'code' },
        { code: '001234', description: 'Second', kind: 'goods', chapter: '00', match: 'code' },
      ],
    });
    render(<Harness />);
    const input = screen.getByRole('combobox', { name: 'HSN' });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '0012' } });
    await screen.findByRole('option', { name: /Second/ });
    expect(input).toHaveAttribute('aria-expanded', 'true');

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input.getAttribute('aria-activedescendant')).toBe(screen.getByRole('option', { name: /Second/ }).id);
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(input).toHaveValue('001234');
    expect(input).toHaveAttribute('aria-expanded', 'false');
  });

  it('Escape closes the list without stopping free typing', async () => {
    search.mockResolvedValue({ success: true, loaded: true, data: [{ code: '0012', description: 'First', kind: 'goods', chapter: '00', match: 'code' }] });
    render(<Harness />);
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '00' } });
    await screen.findByRole('option');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(input).toHaveValue('00');
  });

  it('says so when the master is empty', async () => {
    search.mockResolvedValue({ success: true, loaded: false, data: [] });
    render(<Harness />);
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '8471' } });
    expect(await screen.findByText(/HSN master not loaded yet; ask an admin to import it/)).toBeInTheDocument();
  });

  it('flags an invalid typed code after leaving the field', async () => {
    search.mockResolvedValue({ success: true, loaded: true, data: [] });
    render(<Harness />);
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '847' } });
    fireEvent.blur(input);
    await waitFor(() => expect(input).toHaveAttribute('aria-invalid', 'true'));
    expect(screen.getByText('HSN/SAC must be 4, 6 or 8 digits.')).toBeInTheDocument();
  });
});
