import React from 'react';
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { PaymentLink } from '@/api/payments';
import { reminderMessage } from '@/lib/collect/whatsapp';

const api = vi.hoisted(() => ({ status: vi.fn(), links: vi.fn(), connect: vi.fn(), disconnect: vi.fn(), createLink: vi.fn() }));
vi.mock('@/api/payments', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/payments')>()),
  paymentsApi: api,
}));

import { linkForInvoice, SHARED_WITH_RAZORPAY } from '@/api/payments';
import { PaymentsCard } from '@/modules/settings/PaymentsCard';
import { InvoicePaymentLink } from '@/modules/gst/InvoicePaymentLink';

const link = (over: Partial<PaymentLink>): PaymentLink => ({
  id: 'l', invoice_id: 'i1', link_id: 'plink_1', short_url: 'https://rzp.io/i/a', amount_paise: 100, status: 'created', ...over,
});
const off = { success: true, data: { configured: false, reason: 'Switched off here.', connection: null } };
const notConnected = { success: true, data: { configured: true, connection: null } };
const connected = {
  success: true,
  data: {
    configured: true,
    connection: { razorpay_account_id: 'acc_123', mode: 'live', status: 'connected', expires_at: null, created_at: '2026-10-01T00:00:00Z', updated_at: '' },
  },
};

beforeEach(() => Object.values(api).forEach((f) => f.mockReset()));

describe('payment link helpers', () => {
  it('prefers the open link, then the paid one, for the right invoice only', () => {
    const links = [link({ id: 'p', status: 'paid' }), link({ id: 'c' }), link({ id: 'x', invoice_id: 'i2' })];
    expect(linkForInvoice(links, 'i1')?.id).toBe('c');
    expect(linkForInvoice([links[0]], 'i1')?.id).toBe('p');
    expect(linkForInvoice([link({ status: 'expired' })], 'i1')).toBeNull();
    expect(linkForInvoice([link({ short_url: 'javascript:alert(1)' })], 'i1')).toBeNull();
  });

  it('adds the link to the WhatsApp reminder only when it is https', () => {
    const base = { customerName: 'Acme', invoiceNumber: 'INV-1', amountDuePaise: 1000, dueDate: null, msme45: false };
    expect(reminderMessage({ ...base, paymentLink: 'https://rzp.io/i/a' })).toContain('Pay online: https://rzp.io/i/a');
    expect(reminderMessage({ ...base, paymentLink: 'http://rzp.io/i/a' })).not.toContain('Pay online');
    expect(reminderMessage(base)).not.toContain('Pay online');
  });
});

describe('PaymentsCard', () => {
  it('lists exactly what is shared and explains why it is off', async () => {
    api.status.mockResolvedValue(off);
    render(<PaymentsCard orgId="o1" />);
    expect(await screen.findByText('Switched off here.')).toBeInTheDocument();
    expect(SHARED_WITH_RAZORPAY).toHaveLength(3);
    for (const f of SHARED_WITH_RAZORPAY) expect(screen.getByText(f)).toBeInTheDocument();
    expect(screen.getByText(/Nothing else is sent/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Connect Razorpay' })).toBeDisabled();
  });

  it('needs consent before connecting and refuses a foreign authorise URL', async () => {
    api.status.mockResolvedValue(notConnected);
    api.connect.mockResolvedValue({ success: true, data: { authorize_url: 'https://evil.example/authorize' } });
    render(<PaymentsCard orgId="o1" />);
    const btn = await screen.findByRole('button', { name: 'Connect Razorpay' });
    await waitFor(() => expect(screen.getByRole('checkbox', { name: /I agree/ })).toBeEnabled());
    expect(btn).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: /I agree/ }));
    expect(btn).toBeEnabled();
    fireEvent.click(btn);
    expect(await screen.findByRole('alert')).toHaveTextContent('Unexpected authorisation address');
    expect(api.connect).toHaveBeenCalledWith('o1', 'live');
  });

  it('shows the connected account with a disconnect button', async () => {
    api.status.mockResolvedValue(connected);
    render(<PaymentsCard orgId="o1" />);
    expect(await screen.findByText('acc_123')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Disconnect' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Connect Razorpay' })).toBeNull();
  });
});

describe('InvoicePaymentLink', () => {
  it('shows the reason and no button when payments are off', async () => {
    api.status.mockResolvedValue(off);
    render(<InvoicePaymentLink orgId="o1" invoiceId="i1" issued />);
    expect(await screen.findByText('Switched off here.')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
    expect(api.links).not.toHaveBeenCalled();
  });

  it('asks to connect first, and to issue drafts first', async () => {
    api.status.mockResolvedValue(notConnected);
    api.links.mockResolvedValue({ success: true, data: [] });
    const { unmount } = render(<InvoicePaymentLink orgId="o1" invoiceId="i1" issued />);
    expect(await screen.findByText(/Connect your Razorpay account/)).toBeInTheDocument();
    unmount();
    api.status.mockResolvedValue(connected);
    render(<InvoicePaymentLink orgId="o1" invoiceId="i1" issued={false} />);
    expect(await screen.findByText(/Issue the invoice/)).toBeInTheDocument();
  });

  it('creates a link and offers to copy it', async () => {
    api.status.mockResolvedValue(connected);
    api.links.mockResolvedValue({ success: true, data: [] });
    api.createLink.mockResolvedValue({ success: true, data: link({ short_url: 'https://rzp.io/i/new' }) });
    render(<InvoicePaymentLink orgId="o1" invoiceId="i1" issued />);
    fireEvent.click(await screen.findByRole('button', { name: /Create payment link/ }));
    expect(await screen.findByRole('link', { name: 'https://rzp.io/i/new' })).toBeInTheDocument();
    expect(api.createLink).toHaveBeenCalledWith('o1', 'i1');
    expect(screen.getByRole('button', { name: /Copy link/ })).toBeInTheDocument();
  });
});
