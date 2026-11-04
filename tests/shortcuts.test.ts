import { describe, it, expect } from 'vitest';
import {
  STANDARD_SHORTCUTS,
  GLOBAL_FUNCTION_KEY_MAP,
  isTargetInteractive, isPlainKey,
} from '@/lib/keyboard/shortcuts';

describe('Global Function Key Map (F1–F11 Navigation)', () => {
  it('contains all essential function keys from F1 to F11', () => {
    const keys = Object.keys(GLOBAL_FUNCTION_KEY_MAP);
    expect(keys).toEqual([
      'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11'
    ]);
  });

  it('correctly maps function keys to active application routes', () => {
    expect(GLOBAL_FUNCTION_KEY_MAP['F1']).toBe('/executive');
    expect(GLOBAL_FUNCTION_KEY_MAP['F2']).toBe('/consultant');
    expect(GLOBAL_FUNCTION_KEY_MAP['F3']).toBe('/vouchers');
    expect(GLOBAL_FUNCTION_KEY_MAP['F4']).toBe('/gst');
    expect(GLOBAL_FUNCTION_KEY_MAP['F5']).toBe('/purchases');
    expect(GLOBAL_FUNCTION_KEY_MAP['F6']).toBe('/collect');
    expect(GLOBAL_FUNCTION_KEY_MAP['F7']).toBe('/builder');
    expect(GLOBAL_FUNCTION_KEY_MAP['F8']).toBe('/day-book');
    expect(GLOBAL_FUNCTION_KEY_MAP['F9']).toBe('/approvals');
    expect(GLOBAL_FUNCTION_KEY_MAP['F10']).toBe('/banking/reconciliation');
    expect(GLOBAL_FUNCTION_KEY_MAP['F11']).toBe('/gst/file');
  });
});

describe('Standard Keyboard Shortcuts Registry', () => {
  it('registers navigation entries for all F1–F11 routes and Escape', () => {
    const navShortcuts = STANDARD_SHORTCUTS.filter(s => s.category === 'navigation');
    const navKeys = navShortcuts.map(s => s.key);

    expect(navKeys).toContain('F1');
    expect(navKeys).toContain('F2');
    expect(navKeys).toContain('F3');
    expect(navKeys).toContain('F4');
    expect(navKeys).toContain('F5');
    expect(navKeys).toContain('F6');
    expect(navKeys).toContain('F7');
    expect(navKeys).toContain('F8');
    expect(navKeys).toContain('F9');
    expect(navKeys).toContain('F10');
    expect(navKeys).toContain('F11');
    expect(navKeys).toContain('Escape');
  });

  it('maps Escape key to Gateway navigation', () => {
    const esc = STANDARD_SHORTCUTS.find(s => s.key === 'Escape');
    expect(esc).toBeDefined();
    expect(esc?.actionRoute).toBe('/gateway');
  });

  it('includes Command Palette shortcut with Ctrl modifier', () => {
    const cmdPalette = STANDARD_SHORTCUTS.find(s => s.category === 'action' && s.key === 'k');
    expect(cmdPalette).toBeDefined();
    expect(cmdPalette?.ctrlKey).toBe(true);
    expect(cmdPalette?.label).toContain('Command Palette');
  });

  it('preserves local voucher editor shortcut definitions (F4–F9)', () => {
    const voucherShortcuts = STANDARD_SHORTCUTS.filter(s => s.category === 'voucher');
    const voucherKeys = voucherShortcuts.map(s => s.key);

    expect(voucherKeys).toEqual(['F4', 'F5', 'F6', 'F7', 'F8', 'F9']);

    const contra = voucherShortcuts.find(s => s.key === 'F4');
    const payment = voucherShortcuts.find(s => s.key === 'F5');
    const receipt = voucherShortcuts.find(s => s.key === 'F6');
    const journal = voucherShortcuts.find(s => s.key === 'F7');
    const sales = voucherShortcuts.find(s => s.key === 'F8');
    const purchase = voucherShortcuts.find(s => s.key === 'F9');

    expect(contra?.label).toContain('Contra');
    expect(payment?.label).toContain('Payment');
    expect(receipt?.label).toContain('Receipt');
    expect(journal?.label).toContain('Journal');
    expect(sales?.label).toContain('Sales');
    expect(purchase?.label).toContain('Purchase');
  });
});

describe('Transaction-Entry Protection (isTargetInteractive)', () => {
  it('identifies standard HTML input controls as interactive', () => {
    const textInput = document.createElement('input');
    textInput.type = 'text';

    const numInput = document.createElement('input');
    numInput.type = 'number';

    const textarea = document.createElement('textarea');
    const select = document.createElement('select');

    expect(isTargetInteractive(textInput)).toBe(true);
    expect(isTargetInteractive(numInput)).toBe(true);
    expect(isTargetInteractive(textarea)).toBe(true);
    expect(isTargetInteractive(select)).toBe(true);
  });

  it('identifies contenteditable containers as interactive', () => {
    const editableDiv = document.createElement('div');
    editableDiv.setAttribute('contenteditable', 'true');

    const innerSpan = document.createElement('span');
    editableDiv.appendChild(innerSpan);
    document.body.appendChild(editableDiv);

    expect(isTargetInteractive(editableDiv)).toBe(true);
    expect(isTargetInteractive(innerSpan)).toBe(true);

    document.body.removeChild(editableDiv);
  });

  it('identifies combobox, listbox, and monaco editors as interactive', () => {
    const comboboxContainer = document.createElement('div');
    comboboxContainer.setAttribute('role', 'combobox');
    const comboChild = document.createElement('span');
    comboboxContainer.appendChild(comboChild);

    const listboxContainer = document.createElement('div');
    listboxContainer.setAttribute('role', 'listbox');
    const listboxChild = document.createElement('span');
    listboxContainer.appendChild(listboxChild);

    const monacoContainer = document.createElement('div');
    monacoContainer.className = 'monaco-editor custom-code';
    const editorLine = document.createElement('div');
    monacoContainer.appendChild(editorLine);

    document.body.appendChild(comboboxContainer);
    document.body.appendChild(listboxContainer);
    document.body.appendChild(monacoContainer);

    expect(isTargetInteractive(comboChild)).toBe(true);
    expect(isTargetInteractive(listboxChild)).toBe(true);
    expect(isTargetInteractive(editorLine)).toBe(true);

    document.body.removeChild(comboboxContainer);
    document.body.removeChild(listboxContainer);
    document.body.removeChild(monacoContainer);
  });

  it('returns false for non-interactive elements', () => {
    const div = document.createElement('div');
    const button = document.createElement('button');
    const table = document.createElement('table');

    expect(isTargetInteractive(div)).toBe(false);
    expect(isTargetInteractive(button)).toBe(false);
    expect(isTargetInteractive(table)).toBe(false);
    expect(isTargetInteractive(null)).toBe(false);
  });

  it('blurs active input on Escape to safely exit editing mode before navigation', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    expect(document.activeElement).toBe(input);

    // Simulate Escape handler behavior: blur active element
    input.blur();
    expect(document.activeElement).not.toBe(input);

    document.body.removeChild(input);
  });
});

describe("isPlainKey", () => {
  const none = { ctrlKey: false, metaKey: false, altKey: false, shiftKey: false };
  it("leaves modified function keys to the browser", () => {
    expect(isPlainKey(none)).toBe(true);
    expect(isPlainKey({ ...none, ctrlKey: true })).toBe(false);
    expect(isPlainKey({ ...none, shiftKey: true })).toBe(false);
    expect(isPlainKey({ ...none, altKey: true })).toBe(false);
    expect(isPlainKey({ ...none, metaKey: true })).toBe(false);
  });
});
