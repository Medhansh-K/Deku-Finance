import React from 'react';
import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { CreateInvoiceRequest, Party } from '@/types/accounting';

const create = vi.fn();
const list = vi.fn();
vi.mock('@/api/endpoints', () => ({
  invoicesApi: { create: (...a: unknown[]) => create(...a) },
  catalogueApi: { list: (...a: unknown[]) => list(...a) },
  hsnApi: { search: vi.fn().mockResolvedValue({ data: [] }) },
}));
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ organisation: { id: 'o1', name: 'Co', gstin: '27AAACR5055K1Z7', operating_mode: 'gst_registered', onboarded_at: 'x' } }),
}));
vi.mock('next/link', () => ({ default: ({ children }: { children: React.ReactNode }) => <a>{children}</a> }));

import { SalesInvoiceEditor } from '@/modules/gst/SalesInvoiceEditor';

const widget = { id: 'item-1', name: 'Widget', sku: 'WID', hsn_sac_code: '8471', unit_code: 'NOS', default_unit_price: 500, default_gst_rate: 12, is_taxable: true, track_inventory: true };
const exempt = { id: 'item-2', name: 'Exempt thing', sku: 'EXM', hsn_sac_code: null, unit_code: 'KGS', default_unit_price: '75.50', default_gst_rate: 18, is_taxable: false };
const oddRate = { id: 'item-3', name: 'Odd rate', sku: 'ODD', hsn_sac_code: '8471', unit_code: 'NOS', default_unit_price: 10, default_gst_rate: 1.5, is_taxable: true };
const retired = { id: 'item-4', name: 'Retired', sku: 'OLD', hsn_sac_code: '8471', unit_code: 'NOS', default_unit_price: 1, default_gst_rate: 18, is_taxable: true, is_active: false };

const customers = [{ id: 'c1', organisation_id: 'o1', type: 'customer', legal_name: 'Buyer', gstin: '27AAPFU0939F1ZV' }] as Party[];

const open = async (items: unknown[] = [widget, exempt, oddRate, retired]) => {
  list.mockResolvedValue({ data: items });
  render(<SalesInvoiceEditor orgId="o1" customers={customers} onCreated={vi.fn()} onCancel={vi.fn()} />);
  if (items.length) await screen.findByLabelText('Line 1 catalogue item');
};
const pick = (id: string, n = 1) => fireEvent.change(screen.getByLabelText(`Line ${n} catalogue item`), { target: { value: id } });

const save = async (): Promise<CreateInvoiceRequest> => {
  fireEvent.change(screen.getByLabelText('Customer'), { target: { value: 'c1' } });
  fireEvent.change(screen.getByLabelText('Invoice number'), { target: { value: 'INV-1' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save draft invoice' }));
  await waitFor(() => expect(create).toHaveBeenCalled());
  return create.mock.calls[0][1];
};

describe('catalogue items on an invoice line', () => {
  beforeEach(() => {
    create.mockReset().mockResolvedValue({ success: true });
    list.mockReset();
  });

  it('fills the line and sends item_id and the unit, so stock can move', async () => {
    await open();
    pick('item-1');
    expect(screen.getByLabelText('Line 1 item or service')).toHaveValue('Widget');
    expect(screen.getByLabelText('Line 1 HSN or SAC')).toHaveValue('8471');
    expect(screen.getByLabelText('Line 1 rate in rupees')).toHaveValue(500);
    expect(screen.getByLabelText('Line 1 GST rate')).toHaveValue('12');

    const payload = await save();
    expect(payload.lines[0]).toMatchObject({ item_id: 'item-1', item_name: 'Widget', hsn_sac_code: '8471', unit_code: 'NOS', unit_price: 500, gst_rate: 12 });
    expect(payload.lines[0].taxable_amount).toBe(500);
  });

  it('a line typed by hand sends no item and stays editable', async () => {
    await open();
    fireEvent.change(screen.getByLabelText('Line 1 item or service'), { target: { value: 'Consulting' } });
    fireEvent.change(screen.getByLabelText('Line 1 rate in rupees'), { target: { value: '1000' } });
    const payload = await save();
    expect(payload.lines[0]).toMatchObject({ item_id: null, item_name: 'Consulting', unit_code: 'OTH', unit_price: 1000, gst_rate: 18 });
  });

  it('retyping the name drops the link, and it shows in the selector', async () => {
    await open();
    pick('item-1');
    fireEvent.change(screen.getByLabelText('Line 1 item or service'), { target: { value: 'Something else' } });
    expect(screen.getByLabelText('Line 1 catalogue item')).toHaveValue('');
    expect((await save()).lines[0]).toMatchObject({ item_id: null, item_name: 'Something else', unit_code: 'OTH' });
  });

  it('changing the rate or quantity keeps the link', async () => {
    await open();
    pick('item-1');
    fireEvent.change(screen.getByLabelText('Line 1 rate in rupees'), { target: { value: '450' } });
    fireEvent.change(screen.getByLabelText('Line 1 quantity'), { target: { value: '3' } });
    expect((await save()).lines[0]).toMatchObject({ item_id: 'item-1', unit_price: 450, quantity: 3 });
  });

  it('choosing "by hand" again drops the link but keeps the text', async () => {
    await open();
    pick('item-1');
    pick('');
    expect(screen.getByLabelText('Line 1 item or service')).toHaveValue('Widget');
    expect((await save()).lines[0]).toMatchObject({ item_id: null, unit_code: 'OTH' });
  });

  it('handles a blank HSN, a price sent as text and an untaxed item', async () => {
    await open();
    pick('item-2');
    expect(screen.getByLabelText('Line 1 HSN or SAC')).toHaveValue('');
    expect(screen.getByLabelText('Line 1 rate in rupees')).toHaveValue(75.5);
    expect(screen.getByLabelText('Line 1 GST rate')).toHaveValue('0');
  });

  it('shows a rate outside the usual list rather than a wrong one', async () => {
    await open();
    pick('item-3');
    expect(screen.getByLabelText('Line 1 GST rate')).toHaveValue('1.5');
  });

  it('leaves out inactive items', async () => {
    await open();
    const options = Array.from(screen.getByLabelText('Line 1 catalogue item').querySelectorAll('option')).map((o) => o.textContent);
    expect(options).toEqual(['Type it by hand', 'Widget (WID)', 'Exempt thing (EXM)', 'Odd rate (ODD)']);
  });

  it('with an empty catalogue lines are typed by hand', async () => {
    await open([]);
    await waitFor(() => expect(list).toHaveBeenCalled());
    expect(screen.queryByLabelText('Line 1 catalogue item')).toBeNull();
    expect(screen.getByLabelText('Line 1 item or service')).toBeInTheDocument();
  });

  it('a catalogue that fails to load leaves the invoice usable', async () => {
    list.mockRejectedValue(new Error('down'));
    render(<SalesInvoiceEditor orgId="o1" customers={customers} onCreated={vi.fn()} onCancel={vi.fn()} />);
    await waitFor(() => expect(list).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText('Line 1 item or service'), { target: { value: 'Consulting' } });
    fireEvent.change(screen.getByLabelText('Line 1 rate in rupees'), { target: { value: '100' } });
    expect((await save()).lines[0]).toMatchObject({ item_id: null, item_name: 'Consulting' });
  });

  it('Enter on the last field starts the next line at its first field', async () => {
    await open();
    fireEvent.keyDown(screen.getByLabelText('Line 1 GST rate'), { key: 'Enter' });
    await waitFor(() => expect(screen.getByLabelText('Line 2 catalogue item')).toHaveFocus());
  });
});
