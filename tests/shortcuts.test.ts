import { describe, it, expect } from 'vitest';
import { STANDARD_SHORTCUTS } from '@/lib/keyboard/shortcuts';

describe('Standard Keyboard Shortcuts Registry', () => {
  it('contains all essential Tally F-keys from F1 to F9', () => {
    const fKeys = STANDARD_SHORTCUTS.filter(s => s.key.startsWith('F'));
    expect(fKeys.map(k => k.key)).toEqual([
      'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9'
    ]);
  });

  it('correctly maps voucher routes to appropriate F-keys', () => {
    const payment = STANDARD_SHORTCUTS.find(s => s.key === 'F5');
    const receipt = STANDARD_SHORTCUTS.find(s => s.key === 'F6');
    const contra = STANDARD_SHORTCUTS.find(s => s.key === 'F4');
    const journal = STANDARD_SHORTCUTS.find(s => s.key === 'F7');
    const sales = STANDARD_SHORTCUTS.find(s => s.key === 'F8');
    const purchase = STANDARD_SHORTCUTS.find(s => s.key === 'F9');

    expect(payment?.actionRoute).toBe('/vouchers/payment');
    expect(receipt?.actionRoute).toBe('/vouchers/receipt');
    expect(contra?.actionRoute).toBe('/vouchers/contra');
    expect(journal?.actionRoute).toBe('/vouchers/journal');
    expect(sales?.actionRoute).toBe('/vouchers/sales');
    expect(purchase?.actionRoute).toBe('/vouchers/purchase');
  });

  it('maps Escape key to Gateway navigation', () => {
    const esc = STANDARD_SHORTCUTS.find(s => s.key === 'Escape');
    expect(esc?.actionRoute).toBe('/gateway');
  });

  it('includes Go To global search shortcut', () => {
    const goto = STANDARD_SHORTCUTS.find(s => s.label.includes('Go To'));
    expect(goto).toBeDefined();
    expect(goto?.category).toBe('navigation');
  });

  it('maps L key to Activity Logs & Audit Trail', () => {
    const logs = STANDARD_SHORTCUTS.find(s => s.key === 'l' || s.key === 'L');
    expect(logs).toBeDefined();
    expect(logs?.label).toContain('Activity Logs');
    expect(logs?.actionRoute).toBe('/audit');
  });
});
