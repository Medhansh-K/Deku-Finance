"use client";

import { useCallback, useEffect, useState } from "react";

export const PERIOD_KEY = "deku_return_period";

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** yyyy-mm of the month before `today`: the month a return is normally filed for. */
export function defaultReturnMonth(today: Date = new Date()): string {
  const d = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Indian financial year (April-March) of a yyyy-mm month, e.g. "2026-27". */
export function fyOf(month: string): string {
  const y = Number(month.slice(0, 4));
  const start = Number(month.slice(5, 7)) >= 4 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

/** yyyy-mm -> MMYYYY as the GST portal writes it. */
export const retPeriodOf = (month: string) => `${month.slice(5, 7)}${month.slice(0, 4)}`;

/** Last calendar day of a yyyy-mm month as yyyy-mm-dd. */
export function monthEnd(month: string): string {
  const last = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
  return `${month}-${String(last).padStart(2, "0")}`;
}

export function readStoredMonth(raw: string | null): string | null {
  try {
    const m = raw ? (JSON.parse(raw) as { month?: unknown }).month : null;
    return typeof m === "string" && MONTH_RE.test(m) ? m : null;
  } catch {
    return null;
  }
}

/** Shared return period (FY + month), remembered in localStorage across screens. */
export function useReturnPeriod() {
  // Empty until mounted: "today" must be read in the browser, not frozen at prerender.
  const [month, setState] = useState("");

  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = readStoredMonth(localStorage.getItem(PERIOD_KEY));
    } catch {
      // Storage blocked: use the default.
    }
    setState(saved ?? defaultReturnMonth());
  }, []);

  const setMonth = useCallback((m: string) => {
    if (!MONTH_RE.test(m)) return;
    setState(m);
    try {
      localStorage.setItem(PERIOD_KEY, JSON.stringify({ fy: fyOf(m), month: m }));
    } catch {
      // Storage blocked: the choice lasts for this page only.
    }
  }, []);

  return { month, setMonth, fy: month ? fyOf(month) : "", retPeriod: month ? retPeriodOf(month) : "" };
}
