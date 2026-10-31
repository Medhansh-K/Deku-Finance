import React from 'react';
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ApiError } from '@/api/errors';

const apiClient = vi.fn();
vi.mock('@/api/client', () => ({ apiClient: (...a: unknown[]) => apiClient(...a) }));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1', email: 'a@b.c' } }) }));

import { integrationErrorText, isNotConfigured, latestByMethod, type GspStatus, type KycVerification } from '@/api/integrations';
import { directFilingBlocker, DirectFiling } from '@/modules/integrations/DirectFiling';
import { GspCard } from '@/modules/settings/GspCard';
import { InvoiceEInvoiceBlock } from '@/modules/gst/InvoiceEInvoiceBlock';
import { KycHubView } from '@/modules/kyc/KycHubView';

const OFF: GspStatus = {
  configured: false,
  reason: 'No GST Suvidha Provider is configured on this server (GSP_PROVIDER is unset).',
  provider: null,
  sandbox: false,
  connection: null,
};
const SANDBOX_CONNECTED: GspStatus = {
  configured: true,
  reason: null,
  provider: 'sandbox',
  sandbox: true,
  connection: {
    id: 'c1', provider: 'sandbox', gstin: '27AAAAA0000A1Z5', status: 'connected',
    session_expires_at: new Date(Date.now() + 3600_000).toISOString(), last_error: null, enabled_at: null,
  },
};

function serve(gsp: GspStatus, kyc = { configured: false, provider: null, sandbox: false, verifications: [], trust: null }) {
  apiClient.mockImplementation(async (path: string) => {
    if (path.endsWith('/gsp/status')) return { success: true, data: gsp };
    if (path.endsWith('/kyc/status')) return { success: true, data: kyc };
    if (path.includes('/gsp/invoices/')) return { success: true, data: { e_invoices: [], eway_bills: [] } };
    throw new Error(`unexpected ${path}`);
  });
}

beforeEach(() => {
  apiClient.mockReset();
  localStorage.setItem('deku_active_org_id', 'org-1');
});

describe('integration error helpers', () => {
  it('recognises the 503 not-configured codes', () => {
    const gsp = new ApiError('gsp_not_configured', 503);
    expect(isNotConfigured(gsp)).toBe(true);
    expect(isNotConfigured(new ApiError('kyc_not_configured', 503))).toBe(true);
    expect(isNotConfigured(new ApiError('gsp_not_configured', 500))).toBe(false);
    expect(isNotConfigured(new Error('gsp_not_configured'))).toBe(false);
    expect(integrationErrorText(gsp)).toMatch(/No GST Suvidha Provider/);
    expect(integrationErrorText(new ApiError('Invalid OTP', 400))).toBe('Invalid OTP');
  });

  it('direct filing explains why it is unavailable', () => {
    expect(directFilingBlocker(null)).toMatch(/Checking/);
    expect(directFilingBlocker(OFF)).toMatch(/GSP_PROVIDER is unset/);
    expect(directFilingBlocker({ ...OFF, configured: true, reason: null })).toMatch(/Connect the GST portal/);
    const expired = { ...SANDBOX_CONNECTED, connection: { ...SANDBOX_CONNECTED.connection!, session_expires_at: '2020-01-01T00:00:00Z' } };
    expect(directFilingBlocker(expired)).toMatch(/expired/);
    expect(directFilingBlocker(SANDBOX_CONNECTED)).toBeNull();
  });

  it('keeps the latest check per method', () => {
    const row = (method: KycVerification['method'], created_at: string, status: KycVerification['status']): KycVerification => ({
      id: created_at, subject: 'business', user_id: null, method, status, provider: 'x',
      verified_name: null, verified_at: null, expires_at: null, failure_reason: null, created_at,
    });
    const latest = latestByMethod([row('pan', '2026-01-01', 'verified'), row('pan', '2026-02-01', 'failed'), row('gstin', '2026-01-05', 'verified')], 'business');
    expect(latest.pan?.status).toBe('failed');
    expect(latest.gstin?.status).toBe('verified');
    expect(latestByMethod([row('pan', '2026-01-01', 'verified')], 'person', 'u1')).toEqual({});
  });
});

describe('switched-off states', () => {
  it('Settings GSP card offers no connect form and says why', async () => {
    serve(OFF);
    render(<GspCard orgId="org-1" />);
    expect(await screen.findByText(/GSP_PROVIDER is unset/)).toBeInTheDocument();
    expect(screen.getByText('Not available')).toBeInTheDocument();
    expect(screen.queryByLabelText('GST portal username')).not.toBeInTheDocument();
    expect(screen.getByText(/Shared with the provider:/)).toBeInTheDocument();
  });

  it('wizard shows File directly disabled with the reason', async () => {
    serve(OFF);
    render(<DirectFiling orgId="org-1" retPeriod="102026" canFile={{ gstr1: true, gstr3b: true }} />);
    expect(await screen.findByText(/GSP_PROVIDER is unset/)).toBeInTheDocument();
    for (const b of screen.getAllByRole('button', { name: /directly/ })) expect(b).toBeDisabled();
  });

  it('invoice IRN and e-way buttons are disabled with the reason', async () => {
    serve(OFF);
    render(<InvoiceEInvoiceBlock orgId="org-1" invoiceId="inv-1" issued />);
    expect(await screen.findByText(/GSP_PROVIDER is unset/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Generate IRN/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Generate e-way bill/ })).toBeDisabled();
  });

  it('KYC hub disables every check', async () => {
    serve(OFF);
    render(<KycHubView />);
    expect(await screen.findByText(/KYC_PROVIDER is unset/)).toBeInTheDocument();
    for (const name of [/Check company GSTIN/, /Connect EntityLocker/, /Connect DigiLocker/]) {
      expect(screen.getByRole('button', { name })).toBeDisabled();
    }
    expect(screen.getByText(/Level 0: Unverified/)).toBeInTheDocument();
  });
});

describe('sandbox', () => {
  it('shows the not-legally-valid banner and enables filing', async () => {
    serve(SANDBOX_CONNECTED);
    render(<DirectFiling orgId="org-1" retPeriod="102026" canFile={{ gstr1: true, gstr3b: true }} />);
    expect(await screen.findByText(/Sandbox, not legally valid/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('Signatory PAN')).toBeEnabled());
  });

  it('KYC hub shows the banner when the KYC sandbox is active', async () => {
    serve(OFF, { configured: true, provider: 'sandbox', sandbox: true, verifications: [], trust: null } as never);
    render(<KycHubView />);
    expect(await screen.findByText(/Sandbox, not legally valid/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Check company GSTIN/ })).toBeEnabled();
  });
});
