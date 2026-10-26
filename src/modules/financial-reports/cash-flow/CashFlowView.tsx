"use client";

import React, { useState, useEffect } from "react";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Printer,
  Download,
  Calendar,
  CheckCircle2,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { reportsApi } from "@/api/endpoints";
import { formatINR } from "@/lib/formatters/currency";

export function CashFlowView() {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string>("b127e064-5da8-437f-94c4-b8d6a0c12927");

  const [startDate, setStartDate] = useState("2026-04-01");
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);

  useEffect(() => {
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
    <div className="space-y-6">
      {/* Top Action & Control Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400">
            <Wallet className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-100">
              Universal Cash Flow Rollup (Direct Method)
            </h3>
            <p className="text-xs text-slate-400">
              Operating, Investing, and Financing activities computed from posted journal lines
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-xs text-slate-300">
            <Calendar className="h-3.5 w-3.5 text-slate-500" />
            <span>{startDate}</span>
            <span className="text-slate-600">to</span>
            <span>{endDate}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchCashFlow}
            disabled={isLoading}
            className="border-slate-800 hover:bg-slate-800"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="border-slate-800 hover:bg-slate-800"
          >
            <Printer className="h-3.5 w-3.5 mr-1.5" />
            Print
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-400">Opening Cash & Bank</span>
            <span className="text-xs text-slate-500">Reserves</span>
          </div>
          <div className="text-xl font-bold text-slate-100">
            {formatINR(summary.opening_cash)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Cash balance at period start</div>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-400">Operating Cash Flow</span>
            {operating.net_operating_cash >= 0 ? (
              <span className="text-xs text-emerald-400 flex items-center">
                <ArrowUpRight className="h-3.5 w-3.5 mr-0.5" /> Positive
              </span>
            ) : (
              <span className="text-xs text-rose-400 flex items-center">
                <ArrowDownRight className="h-3.5 w-3.5 mr-0.5" /> Negative
              </span>
            )}
          </div>
          <div className={`text-xl font-bold ${operating.net_operating_cash >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {formatINR(operating.net_operating_cash)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Core business operations yield</div>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-400">Net Period Cash Change</span>
            <span className="text-xs text-teal-400">Δ Cash</span>
          </div>
          <div className={`text-xl font-bold ${summary.net_cash_flow >= 0 ? "text-teal-400" : "text-amber-400"}`}>
            {formatINR(summary.net_cash_flow)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Operating + Investing + Financing</div>
        </div>

        <div className="bg-gradient-to-br from-emerald-950/40 via-slate-900/80 to-slate-900/70 border border-emerald-500/30 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-emerald-300">Closing Cash & Bank</span>
            <Badge variant="teal" size="sm">Active Reserves</Badge>
          </div>
          <div className="text-xl font-bold text-emerald-400">
            {formatINR(summary.closing_cash)}
          </div>
          <div className="text-[11px] text-emerald-400/70 mt-1">Live liquid balance available</div>
        </div>
      </div>

      {/* Main Statement Breakdown Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-emerald-400" />
            <h4 className="font-semibold text-slate-100 text-sm">
              Statement of Cash Flows
            </h4>
          </div>
          <Badge variant="outline" className="border-slate-700 text-slate-400 text-xs">
            Ind AS 7 / AS 3 Compliant
          </Badge>
        </div>

        <div className="divide-y divide-slate-800/80 text-sm">
          {/* 1. Operating Activities */}
          <div className="p-5 bg-slate-950/30">
            <div className="flex items-center justify-between font-semibold text-slate-200 mb-3">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                A. Cash Flows from Operating Activities
              </span>
              <span className={operating.net_operating_cash >= 0 ? "text-emerald-400" : "text-rose-400"}>
                {formatINR(operating.net_operating_cash)}
              </span>
            </div>
            <div className="space-y-2 pl-4 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Cash receipts from customers & debtors (Receivables collected)</span>
                <span className="text-slate-200 font-medium">+{formatINR(operating.inflows)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Cash paid to suppliers, vendors, and operating expenses</span>
                <span className="text-rose-400 font-medium">-{formatINR(operating.outflows)}</span>
              </div>
            </div>
          </div>

          {/* 2. Investing Activities */}
          <div className="p-5 bg-slate-950/20">
            <div className="flex items-center justify-between font-semibold text-slate-200 mb-3">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-teal-400"></span>
                B. Cash Flows from Investing Activities
              </span>
              <span className="text-slate-300">
                {formatINR(investing.net_investing_cash)}
              </span>
            </div>
            <div className="space-y-2 pl-4 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Capital expenditures, office equipment, and fixed asset additions</span>
                <span className="text-slate-200 font-medium">{formatINR(investing.net_investing_cash)}</span>
              </div>
            </div>
          </div>

          {/* 3. Financing Activities */}
          <div className="p-5 bg-slate-950/30">
            <div className="flex items-center justify-between font-semibold text-slate-200 mb-3">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                C. Cash Flows from Financing Activities
              </span>
              <span className="text-slate-300">
                {formatINR(financing.net_financing_cash)}
              </span>
            </div>
            <div className="space-y-2 pl-4 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Capital contributions, debt financing, and bank borrowings</span>
                <span className="text-slate-200 font-medium">{formatINR(financing.net_financing_cash)}</span>
              </div>
            </div>
          </div>

          {/* Reconciliation Footers */}
          <div className="p-5 bg-slate-900">
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between font-semibold text-slate-300">
                <span>Net Increase / (Decrease) in Cash & Cash Equivalents (A + B + C)</span>
                <span className={summary.net_cash_flow >= 0 ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                  {formatINR(summary.net_cash_flow)}
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Cash & Cash Equivalents at Beginning of Period</span>
                <span className="text-slate-200">{formatINR(summary.opening_cash)}</span>
              </div>
              <div className="pt-2 border-t border-slate-800 flex justify-between font-bold text-sm text-emerald-400">
                <span>Cash & Cash Equivalents at End of Period</span>
                <span>{formatINR(summary.closing_cash)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
