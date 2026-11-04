"use client";

import React, { useState, useEffect } from "react";
import {
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Printer,
  Calendar,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Layers,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { reportsApi } from "@/api/endpoints";
import { formatINR } from "@/lib/formatters/currency";

export function CashFlowView() {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string>("");

  const [startDate, setStartDate] = useState("2026-04-01");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    setEndDate(new Date().toISOString().split("T")[0]);
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("deku_active_org_id");
      if (saved) setOrgId(saved);
    }
  }, []);

  const fetchCashFlow = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await reportsApi.getCashFlow(orgId, {
        start_date: startDate,
        end_date: endDate,
      });
      setData(res.data);
    } catch (err: any) {
      setError(err.message || "Failed to load Cash Flow Statement");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!orgId || !endDate) return;
    fetchCashFlow();
    const handleUpdate = () => fetchCashFlow();
    window.addEventListener("deku_ledger_updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener("deku_ledger_updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, [orgId, startDate, endDate]);

  const operating = data?.cash_flows?.operating || {
    inflows: 0,
    outflows: 0,
    net_operating_cash: 0,
  };
  const investing = data?.cash_flows?.investing || { net_investing_cash: 0 };
  const financing = data?.cash_flows?.financing || { net_financing_cash: 0 };
  const summary = data?.summary || {
    opening_cash: 0,
    net_cash_flow: 0,
    closing_cash: 0,
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* Top Action & Control Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-surface p-4 rounded-xl border border-line shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-brand/10 border border-brand/20 rounded-lg text-brand-strong">
            <Wallet className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-ink">
              Universal Cash Flow Rollup (Direct Method)
            </h3>
            <p className="text-xs text-ink-muted">
              Operating, Investing, and Financing activities computed dynamically from posted ledger journals
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 bg-canvas-sunken px-3 py-1.5 rounded-lg border border-line text-xs font-mono text-ink-soft">
            <Calendar className="h-3.5 w-3.5 text-ink-subtle" />
            <span>{startDate}</span>
            <span className="text-ink-subtle">to</span>
            <span>{endDate}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchCashFlow}
            disabled={isLoading}
            className="gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="gap-1.5"
          >
            <Printer className="h-3.5 w-3.5" />
            Print
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingDown className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={fetchCashFlow} className="font-bold underline hover:no-underline">
            Retry
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: Opening */}
        <div className="bg-surface border border-line rounded-xl p-4 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-mono uppercase tracking-wider text-ink-muted">Opening Cash &amp; Bank</span>
              <span className="text-[11px] font-mono text-ink-subtle bg-canvas-sunken px-1.5 py-0.5 rounded">Reserves</span>
            </div>
            <div className="text-2xl font-black font-mono text-ink tracking-tight">
              {formatINR(summary.opening_cash)}
            </div>
          </div>
          <div className="text-[11px] text-ink-muted mt-2 pt-2 border-t border-line/60">
            Cash &amp; bank balance at period start
          </div>
        </div>

        {/* Card 2: Operating */}
        <div className="bg-surface border border-line rounded-xl p-4 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-mono uppercase tracking-wider text-ink-muted">Operating Cash Flow</span>
              {operating.net_operating_cash >= 0 ? (
                <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded flex items-center gap-0.5 font-bold">
                  <ArrowUpRight className="h-3 w-3" /> Positive
                </span>
              ) : (
                <span className="text-[11px] font-mono text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded flex items-center gap-0.5 font-bold">
                  <ArrowDownRight className="h-3 w-3" /> Negative
                </span>
              )}
            </div>
            <div className={`text-2xl font-black font-mono tracking-tight ${operating.net_operating_cash >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
              {formatINR(operating.net_operating_cash)}
            </div>
          </div>
          <div className="text-[11px] text-ink-muted mt-2 pt-2 border-t border-line/60">
            Core business operations yield
          </div>
        </div>

        {/* Card 3: Net Change */}
        <div className="bg-surface border border-line rounded-xl p-4 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-mono uppercase tracking-wider text-ink-muted">Net Cash Change</span>
              <span className="text-[11px] font-mono text-brand-strong bg-brand/10 border border-brand/20 px-1.5 py-0.5 rounded font-bold">
                Δ Movement
              </span>
            </div>
            <div className={`text-2xl font-black font-mono tracking-tight ${summary.net_cash_flow >= 0 ? "text-brand-strong" : "text-amber-700"}`}>
              {formatINR(summary.net_cash_flow)}
            </div>
          </div>
          <div className="text-[11px] text-ink-muted mt-2 pt-2 border-t border-line/60">
            Operating + Investing + Financing
          </div>
        </div>

        {/* Card 4: Closing */}
        <div className="bg-gradient-to-br from-emerald-500/10 via-surface to-brand/5 border border-brand/40 rounded-xl p-4 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-mono uppercase tracking-wider text-emerald-800 font-bold">Closing Cash &amp; Bank</span>
              <Badge variant="teal" size="sm">Active Reserves</Badge>
            </div>
            <div className="text-2xl font-black font-mono text-emerald-800 tracking-tight">
              {formatINR(summary.closing_cash)}
            </div>
          </div>
          <div className="text-[11px] text-emerald-800/80 font-medium mt-2 pt-2 border-t border-emerald-500/20">
            Live liquid treasury balance available
          </div>
        </div>
      </div>

      {/* Main Statement Breakdown Table */}
      <div className="bg-surface border border-line rounded-xl overflow-hidden shadow-2xs">
        <div className="px-5 py-3.5 bg-canvas-sunken border-b border-line flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-brand-strong" />
            <h4 className="font-bold text-ink text-sm">
              Statement of Cash Flows (Direct Method)
            </h4>
          </div>
          <Badge variant="outline" className="text-xs font-mono">
            Ind AS 7 / AS 3 Compliant
          </Badge>
        </div>

        <div className="divide-y divide-line text-xs font-sans">
          {/* 1. Operating Activities */}
          <div className="p-4 sm:p-5 hover:bg-canvas-sunken/40 transition-colors">
            <div className="flex items-center justify-between font-bold text-ink text-sm mb-3">
              <span className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0"></span>
                <span>A. Cash Flows from Operating Activities</span>
              </span>
              <span className={`font-mono text-base ${operating.net_operating_cash >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                {formatINR(operating.net_operating_cash)}
              </span>
            </div>
            <div className="space-y-2 pl-4 border-l-2 border-emerald-500/30">
              <div className="flex justify-between items-center py-1">
                <span className="text-ink-soft">Cash receipts from customers &amp; debtors (Receivables collected)</span>
                <span className="text-emerald-700 font-bold font-mono">+{formatINR(operating.inflows)}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-t border-line/40">
                <span className="text-ink-soft">Cash paid to suppliers, vendors, and operating expenditures</span>
                <span className="text-rose-700 font-bold font-mono">-{formatINR(operating.outflows)}</span>
              </div>
            </div>
          </div>

          {/* 2. Investing Activities */}
          <div className="p-4 sm:p-5 hover:bg-canvas-sunken/40 transition-colors">
            <div className="flex items-center justify-between font-bold text-ink text-sm mb-3">
              <span className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-500 shrink-0"></span>
                <span>B. Cash Flows from Investing Activities</span>
              </span>
              <span className="font-mono text-base text-ink">
                {formatINR(investing.net_investing_cash)}
              </span>
            </div>
            <div className="space-y-2 pl-4 border-l-2 border-teal-500/30">
              <div className="flex justify-between items-center py-1">
                <span className="text-ink-soft">Capital expenditures, office equipment, and fixed asset additions</span>
                <span className="text-ink font-semibold font-mono">{formatINR(investing.net_investing_cash)}</span>
              </div>
            </div>
          </div>

          {/* 3. Financing Activities */}
          <div className="p-4 sm:p-5 hover:bg-canvas-sunken/40 transition-colors">
            <div className="flex items-center justify-between font-bold text-ink text-sm mb-3">
              <span className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 shrink-0"></span>
                <span>C. Cash Flows from Financing Activities</span>
              </span>
              <span className="font-mono text-base text-ink">
                {formatINR(financing.net_financing_cash)}
              </span>
            </div>
            <div className="space-y-2 pl-4 border-l-2 border-cyan-500/30">
              <div className="flex justify-between items-center py-1">
                <span className="text-ink-soft">Capital contributions, partner drawings, debt financing, and bank borrowings</span>
                <span className="text-ink font-semibold font-mono">{formatINR(financing.net_financing_cash)}</span>
              </div>
            </div>
          </div>

          {/* Reconciliation Footers */}
          <div className="p-5 bg-canvas-sunken/70 border-t-2 border-line space-y-3">
            <div className="flex justify-between items-center font-bold text-xs text-ink">
              <span>Net Increase / (Decrease) in Cash &amp; Cash Equivalents (A + B + C)</span>
              <span className={`font-mono text-sm ${summary.net_cash_flow >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                {formatINR(summary.net_cash_flow)}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs text-ink-muted">
              <span>Cash &amp; Cash Equivalents at Beginning of Period</span>
              <span className="font-mono text-ink-soft font-semibold">{formatINR(summary.opening_cash)}</span>
            </div>
            <div className="pt-3 border-t border-line flex justify-between items-center font-black text-sm text-emerald-800 bg-brand/10 p-3 rounded-lg border border-brand/20">
              <span>Cash &amp; Cash Equivalents at End of Period</span>
              <span className="font-mono text-base text-emerald-900">{formatINR(summary.closing_cash)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
