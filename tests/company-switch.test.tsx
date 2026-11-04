import React from 'react';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { clearActiveOrg, setActiveOrg } from '@/lib/organisation/active-org';

const list = vi.fn();
vi.mock('@/api/endpoints', () => ({
  organisationsApi: { list: (...a: unknown[]) => list(...a) },
  subscriptionApi: { get: vi.fn().mockResolvedValue({ data: null }) },
}));
vi.mock('next/navigation', () => ({
  usePathname: () => '/gateway',
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));
vi.mock('@/lib/kpi/kpi-service', () => ({
  emptyKpis: () => ({}),
  getQuickKpiKeys: () => [],
  loadKpis: () => Promise.resolve({}),
}));

import { AuthProvider, useAuth } from '@/context/AuthContext';
import { CompaniesView } from '@/modules/companies/CompaniesView';
import { GatewayLanding } from '@/modules/gateway/GatewayLanding';

const row = (id: string, name: string) => ({ id, name, slug: id, currency: 'INR', timezone: 'Asia/Kolkata', onboarded_at: '2026-01-01', operating_mode: 'gst_registered' });
const A = row('org-a', 'Alpha');
const B = row('org-b', 'Beta');

function Probe() {
  const { organisation, logout } = useAuth();
  return (
    <>
      <span data-testid="org">{organisation?.name ?? 'none'}</span>
      <button onClick={() => void logout()}>out</button>
    </>
  );
}

const mount = async () => {
  render(<AuthProvider><Probe /></AuthProvider>);
  await waitFor(() => expect(screen.getByTestId('org')).not.toHaveTextContent('none'));
};

describe('AuthContext follows the active company', () => {
  beforeEach(() => {
    localStorage.clear();
    list.mockReset();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ user: { id: 'u1', email: 'a@b.c' } }), { status: 200 })));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('a switch from any screen reaches the context, without a reload of the list', async () => {
    list.mockResolvedValue({ data: [A, B] });
    await mount();
    expect(screen.getByTestId('org')).toHaveTextContent('Alpha');
    await waitFor(() => expect(list).toHaveBeenCalledTimes(1));

    act(() => setActiveOrg(B));
    expect(screen.getByTestId('org')).toHaveTextContent('Beta');
    expect(localStorage.getItem('deku_active_org_id')).toBe('org-b');
    expect(list).toHaveBeenCalledTimes(1);
  });

  it('a company just joined, not yet in the list, is loaded and selected', async () => {
    list.mockResolvedValue({ data: [A] });
    await mount();
    list.mockResolvedValue({ data: [A, B] });
    act(() => setActiveOrg({ id: 'org-b', name: 'Organisation' }));
    await waitFor(() => expect(screen.getByTestId('org')).toHaveTextContent('Beta'));
    expect(localStorage.getItem('deku_active_org_name')).toBe('Beta');
    expect(list).toHaveBeenCalledTimes(2);
  });

  it("an id the user can't reach settles on one they can, and doesn't loop", async () => {
    list.mockResolvedValue({ data: [A, B] });
    await mount();
    act(() => setActiveOrg({ id: 'org-gone', name: 'Gone' }));
    await waitFor(() => expect(localStorage.getItem('deku_active_org_id')).toBe('org-a'));
    await new Promise((r) => setTimeout(r, 20));
    expect(list).toHaveBeenCalledTimes(2);
    expect(localStorage.getItem('deku_active_org_name')).toBe('Alpha');
  });

  it('sign-out clears the keys', async () => {
    list.mockResolvedValue({ data: [A, B] });
    await mount();
    await act(async () => screen.getByText('out').click());
    expect(screen.getByTestId('org')).toHaveTextContent('none');
    expect(localStorage.getItem('deku_active_org_id')).toBeNull();
    expect(localStorage.getItem('deku_active_org_name')).toBeNull();
  });
});

describe('401 from the API', () => {
  const realLocation = window.location;
  afterEach(() => {
    vi.unstubAllGlobals();
    Object.defineProperty(window, 'location', { configurable: true, value: realLocation });
  });

  it('clears the active company before sending the user to sign in', async () => {
    vi.resetModules();
    const { apiClient } = await import('@/api/client');
    Object.defineProperty(window, 'location', { configurable: true, value: { href: '', pathname: '/day-book' } });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'unauthorised' }), { status: 401, headers: { 'content-type': 'application/json' } })));
    setActiveOrg(A);
    localStorage.setItem('deku_operating_mode', 'gst_registered');

    await expect(apiClient('/x')).rejects.toBeDefined();

    expect(window.location.href).toBe('/login?next=%2Fday-book');
    for (const key of ['deku_active_org_id', 'deku_active_org_name', 'deku_operating_mode']) expect(localStorage.getItem(key)).toBeNull();
  });

  it('other errors leave the company selected', async () => {
    vi.resetModules();
    const { apiClient } = await import('@/api/client');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 500, headers: { 'content-type': 'application/json' } })));
    setActiveOrg(A);
    await expect(apiClient('/x')).rejects.toBeDefined();
    expect(localStorage.getItem('deku_active_org_id')).toBe('org-a');
    clearActiveOrg();
  });
});

describe('adding a company, with one company per deployment', () => {
  beforeEach(() => {
    localStorage.clear();
    list.mockReset();
  });

  it('Companies offers it only to a user with no company', async () => {
    list.mockResolvedValue({ data: [] });
    const { unmount } = render(<CompaniesView />);
    expect(screen.queryByRole('button', { name: /New Company/ })).toBeNull();
    expect(await screen.findByRole('button', { name: /New Company/ })).toBeInTheDocument();
    unmount();

    list.mockResolvedValue({ data: [A] });
    render(<CompaniesView />);
    await screen.findByText('Alpha');
    expect(screen.queryByRole('button', { name: /New Company/ })).toBeNull();
  });

  it("Companies doesn't offer it when the list couldn't be read", async () => {
    list.mockRejectedValue(new Error('down'));
    render(<CompaniesView />);
    await screen.findByText('down');
    expect(screen.queryByRole('button', { name: /New Company/ })).toBeNull();
  });

  it('the gateway offers it only to a user with no company', async () => {
    list.mockResolvedValue({ data: [] });
    const { unmount } = render(<GatewayLanding />);
    expect(await screen.findByRole('link', { name: '+ Add company' })).toHaveAttribute('href', '/companies');
    unmount();

    list.mockResolvedValue({ data: [A] });
    render(<GatewayLanding />);
    expect(await screen.findByRole('link', { name: 'Switch' })).toHaveAttribute('href', '/companies');
    expect(screen.queryByRole('link', { name: '+ Add company' })).toBeNull();
  });

  it("the gateway stays quiet when the list couldn't be read", async () => {
    list.mockRejectedValue(new Error('down'));
    render(<GatewayLanding />);
    await waitFor(() => expect(list).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByRole('link', { name: '+ Add company' })).toBeNull();
  });
});

describe('one path for the active company', () => {
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? files(path) : /\.tsx?$/.test(name) ? [path] : [];
    });

  it('nothing else writes the keys or fires the event', () => {
    const offenders = files('src').filter((f) => {
      if (f.replace(/\\/g, '/').endsWith('lib/organisation/active-org.ts')) return false;
      const text = readFileSync(f, 'utf8');
      return /setItem\(\s*["']deku_active_org/.test(text) || /new Event\(\s*["']deku_active_org_changed/.test(text);
    });
    expect(offenders).toEqual([]);
  });
});
