/**
 * Keeps each demo company's books and activity log in this browser's localStorage, so work
 * carries from one workflow to the next and survives a reload. Reset clears it.
 * Every read and write is guarded: private windows or blocked storage simply start fresh.
 */
import type { DemoCompanySlug } from "./companies";
import type { DemoDataset } from "./sample-data";

// Bump when the dataset shape changes; older saves are discarded and the company reseeds.
export const DEMO_STORE_VERSION = 2;

const keyFor = (slug: DemoCompanySlug) => `deku-learn:v${DEMO_STORE_VERSION}:${slug}`;

interface StoredDemo {
  version: number;
  savedAt: string;
  dataset: DemoDataset;
}

export function loadStoredDataset(slug: DemoCompanySlug): DemoDataset | null {
  try {
    const raw = window.localStorage.getItem(keyFor(slug));
    if (!raw) return null;
    const stored = JSON.parse(raw) as StoredDemo;
    if (stored.version !== DEMO_STORE_VERSION || !stored.dataset?.org || !Array.isArray(stored.dataset.activity)) return null;
    return stored.dataset;
  } catch {
    return null;
  }
}

export function saveStoredDataset(slug: DemoCompanySlug, dataset: DemoDataset): void {
  try {
    const stored: StoredDemo = { version: DEMO_STORE_VERSION, savedAt: new Date().toISOString(), dataset };
    window.localStorage.setItem(keyFor(slug), JSON.stringify(stored));
  } catch {
    // Storage full or blocked: the session still works, it just won't survive a reload.
  }
}

export function clearStoredDataset(slug: DemoCompanySlug): void {
  try {
    window.localStorage.removeItem(keyFor(slug));
  } catch {
    // nothing to clear
  }
}
