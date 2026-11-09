/**
 * Deku Finance — Accounting Date Formatters
 * Standard Tally / GAAP display format: DD-MMM-YYYY (e.g. 20-Oct-2026)
 */

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

export function formatDateTally(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return "—";

  const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return String(dateInput);

  const day = String(d.getDate()).padStart(2, "0");
  const month = MONTHS[d.getMonth()];
  const year = d.getFullYear();

  return `${day}-${month}-${year}`;
}

export function toISODateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
