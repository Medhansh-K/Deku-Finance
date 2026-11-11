import { fyStart } from "@/lib/reports/ledger";

/** Today in India as yyyy-mm-dd. toISOString would still give yesterday until 05:30 IST. */
export const indiaToday = (now = new Date()) => now.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

/** 1 April of the current Indian financial year up to today. */
export function currentFyRange(now = new Date()) {
  const to = indiaToday(now);
  return { from: fyStart(to), to };
}

/** Why a report can't load for these dates, or null if it can. */
export function rangeProblem(from: string, to: string) {
  if (!from || !to) return "Choose both dates to load this report.";
  return from > to ? "From must be on or before To." : null;
}
