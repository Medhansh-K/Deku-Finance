/**
 * Bank statement CSV parser (runs in the browser; the file never leaves the device).
 * Handles the column layouts of HDFC, ICICI, SBI, Axis and Kotak exports by detecting
 * the header row instead of hard-coding one bank.
 */

export type Direction = "in" | "out";

export interface StatementLine {
  row: number; // 1-based line number in the file, for error messages and stable keys
  date: string; // ISO yyyy-mm-dd
  narration: string;
  reference: string;
  amountPaise: number; // always positive
  direction: Direction; // "in" = deposit/credit, "out" = withdrawal/debit
  balancePaise: number | null;
  balanceMismatch: boolean;
}

export interface StatementError {
  row: number;
  raw: string;
  reason: string;
}

export interface ParsedStatement {
  lines: StatementLine[];
  errors: StatementError[];
  headerRow: number | null;
}

/** RFC 4180: quoted fields, "" escapes, commas and newlines inside quotes. Returns rows with their starting line number. */
export function splitCsv(text: string): { row: number; cells: string[] }[] {
  const out: { row: number; cells: string[] }[] = [];
  let cells: string[] = [];
  let field = "";
  let inQuotes = false;
  let line = 1;
  let rowStart = 1;
  const src = text.replace(/^﻿/, "");

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        if (ch === "\n") line++;
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      cells.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      cells.push(field);
      out.push({ row: rowStart, cells });
      cells = [];
      field = "";
      line++;
      rowStart = line;
    } else {
      field += ch;
    }
  }
  if (field !== "" || cells.length > 0) {
    cells.push(field);
    out.push({ row: rowStart, cells });
  }
  return out;
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

/** dd/mm/yyyy, dd-mm-yy, dd-Mon-yyyy, dd Mon yyyy (optional trailing time). Returns ISO date or null. */
export function parseStatementDate(raw: string): string | null {
  const s = raw.trim().replace(/\s+\d{1,2}:\d{2}(:\d{2})?(\s*[AP]M)?$/i, "");
  let d: number, m: number, y: number;
  let match = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2}|\d{4})$/);
  if (match) {
    [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else if ((match = s.match(/^(\d{1,2})[\s\-/]([A-Za-z]{3,4})[\s\-/,]+(\d{2}|\d{4})$/))) {
    const mon = MONTHS[match[2].toLowerCase()];
    if (!mon) return null;
    [d, m, y] = [Number(match[1]), mon, Number(match[3])];
  } else if ((match = s.match(/^(\d{4})-(\d{2})-(\d{2})$/))) {
    [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else {
    return null;
  }
  if (y < 100) y += 2000;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * "1,18,000.00", "₹ 500", "-250.5", "1,000.00 Cr". Returns signed paise (Dr suffix or minus = negative),
 * null for an empty cell, or NaN when the cell has text that is not a number.
 */
export function parseMoneyPaise(raw: string): number | null {
  let s = raw.trim().replace(/₹|INR|Rs\.?/gi, "").replace(/[,\s]/g, "");
  if (s === "" || s === "-") return null;
  let sign = 1;
  const suffix = s.match(/(Cr|Dr)$/i);
  if (suffix) {
    if (suffix[1].toLowerCase() === "dr") sign = -1;
    s = s.slice(0, -2);
  }
  if (s.startsWith("-")) {
    sign = -sign;
    s = s.slice(1);
  }
  const m = s.match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!m) return NaN;
  return sign * (Number(m[1]) * 100 + Number((m[2] || "0").padEnd(2, "0")));
}

interface Columns {
  date: number;
  narration: number;
  reference: number;
  debit: number;
  credit: number;
  amount: number;
  drcr: number;
  balance: number;
  balanceDrcr: number;
}

const norm = (h: string) => h.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function findCol(headers: string[], patterns: RegExp[], after = -1): number {
  for (const p of patterns) {
    const idx = headers.findIndex((h, i) => i > after && p.test(h));
    if (idx !== -1) return idx;
  }
  return -1;
}

function detectColumns(cells: string[]): Columns | null {
  const h = cells.map(norm);
  const amount = findCol(h, [/^(transaction |txn )?amount( inr)?$/, /^amt$/]);
  const balance = findCol(h, [/balance/, /^bal$/]);
  const cols: Columns = {
    // Prefer the transaction date over the value date when both exist.
    date: findCol(h, [/^(txn|transaction|tran|trans|posting) date$/, /^date$/, /^value (date|dt)$/]),
    narration: findCol(h, [/narration|description|particulars|remarks|details/]),
    reference: findCol(h, [/chq|cheque|ref|utr/]),
    debit: findCol(h, [/withdrawal/, /^(debit|dr)( amount| amt)?( inr)?$/]),
    credit: findCol(h, [/deposit/, /^(credit|cr)( amount| amt)?( inr)?$/]),
    amount,
    // Kotak repeats "Dr / Cr" after both Amount and Balance; take the one after Amount.
    drcr: amount === -1 ? -1 : findCol(h, [/^(dr cr|cr dr|type|debit credit)$/], amount),
    balance,
    balanceDrcr: balance === -1 ? -1 : findCol(h, [/^(dr cr|cr dr)$/], balance),
  };
  const hasAmounts = (cols.debit !== -1 && cols.credit !== -1) || cols.amount !== -1;
  return cols.date !== -1 && cols.narration !== -1 && hasAmounts ? cols : null;
}

const isDecoration = (cells: string[]) => cells.every((c) => /^[\s*=\-_]*$/.test(c));

export function parseStatement(text: string): ParsedStatement {
  const rows = splitCsv(text);
  const errors: StatementError[] = [];
  const lines: StatementLine[] = [];

  const headerIdx = rows.slice(0, 50).findIndex((r) => detectColumns(r.cells) !== null);
  if (headerIdx === -1) {
    return {
      lines,
      errors: [{ row: 0, raw: "", reason: "No header row with date, narration and amount columns found" }],
      headerRow: null,
    };
  }
  const cols = detectColumns(rows[headerIdx].cells)!;
  const cell = (cells: string[], i: number) => (i === -1 ? "" : (cells[i] ?? "").trim());

  for (const { row, cells } of rows.slice(headerIdx + 1)) {
    if (isDecoration(cells)) continue;
    const raw = cells.join(",");
    const fail = (reason: string) => errors.push({ row, raw, reason });

    const date = parseStatementDate(cell(cells, cols.date));
    if (!date) {
      fail(`Unreadable date "${cell(cells, cols.date)}"`);
      continue;
    }

    let amountPaise: number;
    let direction: Direction;
    if (cols.debit !== -1 && cols.credit !== -1) {
      const dr = parseMoneyPaise(cell(cells, cols.debit));
      const cr = parseMoneyPaise(cell(cells, cols.credit));
      if (Number.isNaN(dr) || Number.isNaN(cr)) {
        fail("Unreadable withdrawal or deposit amount");
        continue;
      }
      if ((dr ?? 0) < 0 || (cr ?? 0) < 0) {
        fail("Negative amount in a withdrawal/deposit column");
        continue;
      }
      const hasDr = !!dr;
      const hasCr = !!cr;
      if (hasDr === hasCr) {
        fail(hasDr ? "Both withdrawal and deposit are filled" : "No withdrawal or deposit amount");
        continue;
      }
      amountPaise = hasDr ? dr! : cr!;
      direction = hasDr ? "out" : "in";
    } else {
      const amt = parseMoneyPaise(cell(cells, cols.amount));
      if (amt === null || Number.isNaN(amt) || amt === 0) {
        fail(`Unreadable amount "${cell(cells, cols.amount)}"`);
        continue;
      }
      const flag = cell(cells, cols.drcr).toLowerCase();
      if (/^(dr|d|debit)$/.test(flag)) direction = "out";
      else if (/^(cr|c|credit)$/.test(flag)) direction = "in";
      // No indicator column: only trust an explicit minus or Dr/Cr suffix, never a bare positive number.
      else if (flag === "" && amt < 0) direction = "out";
      else if (flag === "" && /cr$/i.test(cell(cells, cols.amount))) direction = "in";
      else {
        fail(`Cannot tell whether "${cell(cells, cols.amount)}" is a debit or credit`);
        continue;
      }
      amountPaise = Math.abs(amt);
    }

    let balancePaise = parseMoneyPaise(cell(cells, cols.balance));
    if (balancePaise !== null && Number.isNaN(balancePaise)) balancePaise = null;
    if (balancePaise !== null && /^dr$/i.test(cell(cells, cols.balanceDrcr))) balancePaise = -Math.abs(balancePaise);

    lines.push({
      row,
      date,
      narration: cell(cells, cols.narration).replace(/\s+/g, " "),
      reference: cell(cells, cols.reference),
      amountPaise,
      direction,
      balancePaise,
      balanceMismatch: false,
    });
  }

  flagBalanceBreaks(lines);
  return { lines, errors, headerRow: rows[headerIdx].row };
}

const signed = (l: StatementLine) => (l.direction === "in" ? l.amountPaise : -l.amountPaise);

/** Banks export oldest-first or newest-first; check both orders and flag breaks in whichever fits better. */
function flagBalanceBreaks(lines: StatementLine[]) {
  const breaks = (newestFirst: boolean) => {
    const bad: number[] = [];
    for (let i = 1; i < lines.length; i++) {
      const prev = lines[i - 1];
      const cur = lines[i];
      if (prev.balancePaise === null || cur.balancePaise === null) continue;
      const ok = newestFirst
        ? prev.balancePaise === cur.balancePaise + signed(prev)
        : cur.balancePaise === prev.balancePaise + signed(cur);
      if (!ok) bad.push(newestFirst ? i - 1 : i);
    }
    return bad;
  };
  const forward = breaks(false);
  const backward = breaks(true);
  for (const i of forward.length <= backward.length ? forward : backward) lines[i].balanceMismatch = true;
}
