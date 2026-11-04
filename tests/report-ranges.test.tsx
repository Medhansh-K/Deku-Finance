import React from "react";
import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { toCsv } from "@/lib/download";
import { balanceSheetCsv, cashFlowCsv, generalLedgerCsv, profitLossCsv } from "@/lib/import/export";
import { currentFyRange, indiaToday, rangeProblem } from "@/lib/reports/date-range";
import { buildLedger } from "@/lib/reports/general-ledger";
import { reportsApi } from "@/api/endpoints";
import { TrialBalanceView } from "@/modules/financial-reports/trial-balance/TrialBalanceView";
import { ProfitLossView } from "@/modules/financial-reports/profit-loss/ProfitLossView";
import { BalanceSheetView } from "@/modules/financial-reports/balance-sheet/BalanceSheetView";
import { CashFlowView } from "@/modules/financial-reports/cash-flow/CashFlowView";
import type { BalanceSheetRow, GeneralLedgerRow, ProfitLossRow } from "@/types/accounting";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const line = (entry_date: string, entry_number: string, debit: number, credit: number, extra: Partial<GeneralLedgerRow> = {}) =>
  ({ line_id: `${entry_number}-${debit}-${credit}`, entry_date, entry_number, line_number: 1, debit, credit, ...extra }) as GeneralLedgerRow;

describe("buildLedger", () => {
  // Newest first, the order the route returns.
  const rows = [
    line("2026-06-10", "V-4", 0, 0.2),
    line("2026-05-01", "V-3", 0.1, 0),
    line("2026-05-01", "V-2", 100, 0),
    line("2026-03-15", "V-1", 0, 250.5),
  ];

  it("runs the balance oldest first, with no opening when there is no from date", () => {
    const { opening, lines } = buildLedger(rows);
    expect(opening).toBeNull();
    expect(lines.map((l) => [l.entry_number, l.balance])).toEqual([
      ["V-1", -250.5],
      ["V-2", -150.5],
      ["V-3", -150.4],
      ["V-4", -150.6],
    ]);
  });

  it("carries what came before the from date into the opening balance", () => {
    const { opening, lines } = buildLedger(rows, "2026-05-01", "2026-05-31");
    expect(opening).toBe(-250.5);
    expect(lines.map((l) => [l.entry_number, l.balance])).toEqual([
      ["V-2", -150.5],
      ["V-3", -150.4],
    ]);
  });

  it("keeps the opening balance when nothing falls in the range, and a zero opening is still a figure", () => {
    expect(buildLedger(rows, "2027-01-01")).toEqual({ opening: -150.6, lines: [] });
    expect(buildLedger(rows, "2020-01-01").opening).toBe(0);
  });

  it("orders lines of one voucher and prefers the line's description to the narration", () => {
    const { lines } = buildLedger([
      line("2026-05-01", "V-1", 2, 0, { line_id: "b", line_number: 2, narration: "voucher text" }),
      line("2026-05-01", "V-1", 1, 0, { line_id: "a", line_number: 1, description: "line text", narration: "voucher text" }),
    ]);
    expect(lines.map((l) => [l.line_id, l.text, l.balance])).toEqual([
      ["a", "line text", 1],
      ["b", "voucher text", 3],
    ]);
  });
});

describe("report dates", () => {
  it("uses the date in India, not UTC", () => {
    expect(indiaToday(new Date("2026-03-31T19:00:00Z"))).toBe("2026-04-01");
    expect(indiaToday(new Date("2026-03-31T18:00:00Z"))).toBe("2026-03-31");
  });

  it("defaults to the Indian financial year so far", () => {
    expect(currentFyRange(new Date("2026-03-31T18:00:00Z"))).toEqual({ from: "2025-04-01", to: "2026-03-31" });
    expect(currentFyRange(new Date("2026-03-31T19:00:00Z"))).toEqual({ from: "2026-04-01", to: "2026-04-01" });
  });

  it("refuses blank and reversed ranges", () => {
    expect(rangeProblem("2026-04-01", "2026-04-01")).toBeNull();
    expect(rangeProblem("", "2026-04-01")).toMatch(/both dates/);
    expect(rangeProblem("2026-04-02", "2026-04-01")).toMatch(/on or before/);
  });
});

describe("statement CSVs", () => {
  it("keeps negative amounts as numbers but still neutralises formulas", () => {
    expect(toCsv([["-100.50", "-5", "=1+1", "-1+1", "-2 cmd", "+7", "@x"]])).toBe("-100.50,-5,'=1+1,'-1+1,'-2 cmd,'+7,'@x");
  });

  it("totals the profit and loss exactly", () => {
    const row = (account_type: string, account_code: string, net_amount: number) =>
      ({ account_type, account_code, account_name: account_code, net_amount }) as ProfitLossRow;
    const csv = profitLossCsv([row("income", "4010", 0.1), row("income", "4020", 0.2), row("expense", "5040", 1)], "2026-04-01", "2026-09-30");
    expect(csv.split("\r\n")).toEqual([
      "Profit & Loss,From,2026-04-01,To,2026-09-30",
      "Section,Code,Account,Amount",
      "Income,4010,4010,0.10",
      "Income,4020,4020,0.20",
      "Total income,,,0.30",
      "Expense,5040,5040,1.00",
      "Total expenses,,,1.00",
      "Net profit / (loss),,,-0.70",
    ]);
  });

  it("puts accumulated profit in equity, so the sheet balances without adding it again", () => {
    const row = (account_type: string, account_code: string | null, account_name: string, balance: number) =>
      ({ account_type, account_code, account_name, balance }) as BalanceSheetRow;
    const csv = balanceSheetCsv(
      [row("asset", "1020", "Bank", -60.5), row("equity", null, "Accumulated profit / (loss)", -60.5)],
      "2026-03-31"
    );
    expect(csv.split("\r\n")).toEqual([
      "Balance Sheet,As of,2026-03-31",
      "Section,Code,Account,Balance",
      "Assets,1020,Bank,-60.50",
      "Total assets,,,-60.50",
      "Total liabilities,,,0.00",
      "Equity,,Accumulated profit / (loss),-60.50",
      "Total equity,,,-60.50",
    ]);
  });

  it("leaves a cash flow figure blank when the server didn't send it", () => {
    const lines = cashFlowCsv({ opening_cash_equivalents: -60.5, net_change_in_cash: 0 }, "2026-04-01", "2026-09-30").split("\r\n");
    expect(lines).toContain("Opening cash and bank,-60.50");
    expect(lines).toContain("Net change in cash,0.00");
    expect(lines).toContain("Closing cash and bank,");
  });

  it("starts the ledger CSV with the opening balance", () => {
    const csv = generalLedgerCsv(buildLedger([line("2026-05-01", "V-2", 100, 0), line("2026-03-15", "V-1", 0, 250.5)], "2026-04-01"), "2026-04-01");
    expect(csv.split("\r\n").slice(1)).toEqual([
      "2026-04-01,,Opening balance,,,,250.50,Cr",
      "2026-05-01,V-2,,,100.00,0.00,150.50,Cr",
    ]);
  });
});

describe("when a report fails to load", () => {
  beforeEach(() => {
    cleanup();
    vi.restoreAllMocks();
    localStorage.setItem("deku_active_org_id", "org-1");
    const fail = () => Promise.reject(new Error("offline"));
    vi.spyOn(reportsApi, "getTrialBalance").mockImplementation(fail);
    vi.spyOn(reportsApi, "getAccountBalances").mockImplementation(fail);
    vi.spyOn(reportsApi, "getProfitAndLoss").mockImplementation(fail);
    vi.spyOn(reportsApi, "getBalanceSheet").mockImplementation(fail);
    vi.spyOn(reportsApi, "getCashFlow").mockImplementation(fail);
  });

  it.each([
    ["Trial Balance", TrialBalanceView],
    ["Profit & Loss", ProfitLossView],
    ["Balance Sheet", BalanceSheetView],
    ["Cash Flow", CashFlowView],
  ])("%s shows the error and dashes, never a zero or a verdict", async (_name, View) => {
    const { container } = render(<View />);
    await screen.findByText("offline");
    const text = container.textContent ?? "";
    expect(text).toContain("–");
    expect(text).not.toMatch(/₹\s*0\.00|\b0\.00\b/);
    expect(text).not.toMatch(/Balanced|Equated|Net Profit:|Surplus|Positive/);
  });

  it("Trial Balance doesn't fall back to undated balances for a dated request", async () => {
    render(<TrialBalanceView />);
    await screen.findByText("offline");
    expect(reportsApi.getAccountBalances).not.toHaveBeenCalled();
  });

  it("asks for the financial year so far by default", async () => {
    render(<ProfitLossView />);
    await waitFor(() => expect(reportsApi.getProfitAndLoss).toHaveBeenCalledWith("org-1", currentFyRange()));
  });
});
