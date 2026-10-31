import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

const css = readFileSync(path.resolve(__dirname, '../src/app/globals.css'), 'utf8');

function tokens(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/--color-([a-z-]+):\s*(#[0-9a-f]{6})/gi)) out[m[1]] = m[2];
  return out;
}

const light = tokens(css.match(/@theme\s*\{([\s\S]*?)\}/)![1]);
const dark = tokens(css.match(/\.dark \.app-shell-root\s*\{([\s\S]*?)\}/)![1]);

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// [foreground, background, minimum ratio]: 4.5 is WCAG AA for body text.
const PAIRS: [string, string, number][] = [
  ['ink', 'surface', 4.5],
  ['ink', 'canvas', 4.5],
  ['ink', 'canvas-sunken', 4.5],
  ['ink-soft', 'surface', 4.5],
  ['ink-muted', 'surface', 4.5],
  ['ink-muted', 'canvas', 4.5],
  ['brand-strong', 'surface', 4.5],
  ['brand-strong', 'canvas', 4.5],
  ['panel-deep', 'brand', 4.5], // dark text on brand-filled buttons
];

describe.each([
  ['light', light],
  ['dark', dark],
])('%s theme tokens', (_name, t) => {
  it('defines every semantic token', () => {
    expect(Object.keys(t).length).toBeGreaterThanOrEqual(17);
  });

  it.each(PAIRS)('%s on %s meets %d:1', (fg, bg, min) => {
    expect(t[fg], fg).toBeDefined();
    expect(t[bg], bg).toBeDefined();
    expect(contrast(t[fg], t[bg])).toBeGreaterThanOrEqual(min);
  });
});

it('dark mode overrides every light token', () => {
  const lightTokens = Object.keys(light).filter((k) => !k.startsWith('deku-'));
  expect(lightTokens.filter((k) => !(k in dark))).toEqual([]);
});
