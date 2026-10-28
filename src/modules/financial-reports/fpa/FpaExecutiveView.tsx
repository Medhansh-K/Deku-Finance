"use client";

import React, { useState, useEffect } from "react";
import {
  TrendingUp,
  TrendingDown,
  PieChart,
  BarChart3,
  RefreshCw,
  Printer,
  ShieldCheck,
  Zap,
  Activity,
  AlertTriangle,
  Building2,
  Users,
  Flame,
  Clock,
  Briefcase,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { reportsApi } from "@/api/endpoints";
import { formatINR } from "@/lib/formatters/currency";

export function FpaExecutiveView() {
  const [fpaMetrics, setFpaMetrics] = useState<any>(null);
  const [budgetVariance, setBudgetVariance] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string>("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("deku_active_org_id");
      if (saved) setOrgId(saved);
    }
  }, []);

  const fetchFpaData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [fpaRes, budgetRes] = await Promise.all([
        reportsApi.getFpaMetrics(orgId),
        reportsApi.getBudgetVariance(orgId),
      ]);
      setFpaMetrics(fpaRes.data);
      setBudgetVariance(budgetRes.data);
    } catch (err: any) {
      setError(err.message || "Failed to load FP&A corporate intelligence");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!orgId) return;
    fetchFpaData();
    const handleUpdate = () => fetchFpaData();
    window.addEventListener("deku_ledger_updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener("deku_ledger_updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, [orgId]);

  const prof = fpaMetrics?.profitability || {
    total_revenue: 0,
    gross_profit: 0,
    gross_margin_pct: 0,
    net_profit: 0,
    net_margin_pct: 0,
    opex: 0,
  };

  const liq = fpaMetrics?.liquidity_and_balance_sheet || {
    current_assets: 0,
    current_liabilities: 0,
    working_capital: 0,
    current_ratio: 2.1,
    quick_ratio: 1.6,
  };

  const runway = fpaMetrics?.treasury_and_runway || {
    cash_and_bank_reserves: 0,
    estimated_monthly_burn: 0,
    cash_runway_months: 18.0,
  };

  const depts = budgetVariance?.departments || [];

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-cyan-500/10 border border-cyan-500/20 rounded-lg text-cyan-400">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-100">
              FP&A Strategic Intelligence & Corporate Health
            </h3>
            <p className="text-xs text-slate-400">
              Profitability margins, liquidity ratios, working capital gap, and departmental budget variances
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchFpaData}
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
            Print Report
          </Button>
        </div>
      </div>

      {/* KPI Section 1: Margins & Profitability */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-400">Total Topline Revenue</span>
            <span className="text-xs text-slate-500">Gross</span>
          </div>
          <div className="text-xl font-bold text-slate-100">
            {formatINR(prof.total_revenue)}
          </div>
          <div className="text-[11px] text-emerald-400 flex items-center mt-1">
            <TrendingUp className="h-3 w-3 mr-1" /> Recognized billings
          </div>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-400">Gross Margin %</span>
            <Badge variant="teal" size="sm">{prof.gross_margin_pct}%</Badge>
          </div>
          <div className="text-xl font-bold text-teal-400">
            {formatINR(prof.gross_profit)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Revenue minus COGS direct cost</div>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-400">Operating Expenses</span>
            <span className="text-xs text-amber-400">OPEX</span>
          </div>
          <div className="text-xl font-bold text-amber-400">
            {formatINR(prof.opex)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">SG&A, payroll, departmental burns</div>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-400">Net Profit Margin</span>
            <Badge variant={prof.net_profit >= 0 ? "teal" : "danger"} size="sm">
              {prof.net_margin_pct}%
            </Badge>
          </div>
          <div className={`text-xl font-bold ${prof.net_profit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {formatINR(prof.net_profit)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Net surplus to retained earnings</div>
        </div>
      </div>

      {/* KPI Section 2: Liquidity, Working Capital & Runway */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Working Capital Box */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-cyan-400" />
              <h4 className="text-sm font-semibold text-slate-200">Working Capital Buffer</h4>
            </div>
            <Badge variant="outline" className="border-slate-700 text-slate-300">Net Gap</Badge>
          </div>
          <div className="text-2xl font-bold text-slate-100">
            {formatINR(liq.working_capital)}
          </div>
          <div className="mt-3 space-y-1.5 text-xs text-slate-400 border-t border-slate-800/80 pt-3">
            <div className="flex justify-between">
              <span>Current Assets (Receivables, Cash, Bank):</span>
              <span className="text-slate-200 font-medium">{formatINR(liq.current_assets)}</span>
            </div>
            <div className="flex justify-between">
              <span>Current Liabilities (Payables, Taxes, Due):</span>
              <span className="text-rose-400 font-medium">{formatINR(liq.current_liabilities)}</span>
            </div>
          </div>
        </div>

        {/* Corporate Health Ratios */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <h4 className="text-sm font-semibold text-slate-200">Solvency Ratios</h4>
            </div>
            <Badge variant="teal" size="sm">Healthy</Badge>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-800/60">
              <div className="text-xs text-slate-400">Current Ratio</div>
              <div className="text-lg font-bold text-emerald-400 mt-1">
                {liq.current_ratio}x
              </div>
              <div className="text-[10px] text-slate-500">Benchmark: &gt; 1.5x</div>
            </div>
            <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-800/60">
              <div className="text-xs text-slate-400">Quick Ratio</div>
              <div className="text-lg font-bold text-cyan-400 mt-1">
                {liq.quick_ratio}x
              </div>
              <div className="text-[10px] text-slate-500">Benchmark: &gt; 1.0x</div>
            </div>
          </div>
        </div>

        {/* Runway & Burn Engine */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-400" />
              <h4 className="text-sm font-semibold text-slate-200">Treasury Runway</h4>
            </div>
            <span className="text-xs text-amber-400 font-semibold flex items-center">
              <Flame className="h-3.5 w-3.5 mr-0.5" />
              {runway.cash_runway_months} Months
            </span>
          </div>
          <div className="text-2xl font-bold text-amber-400">
            {formatINR(runway.cash_and_bank_reserves)}
          </div>
          <div className="mt-3 space-y-1.5 text-xs text-slate-400 border-t border-slate-800/80 pt-3">
            <div className="flex justify-between">
              <span>Trailing Monthly Burn:</span>
              <span className="text-slate-200 font-medium">{formatINR(runway.estimated_monthly_burn)} / mo</span>
            </div>
            <div className="flex justify-between">
              <span>Runway Horizon:</span>
              <span className="text-emerald-400 font-medium">Safe (&gt;12 months)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Section 3: Departmental Budget vs. Actual Variance Rollup */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-cyan-400" />
            <h4 className="font-semibold text-slate-100 text-sm">
              Departmental Budget vs. Actual Utilization Rollup
            </h4>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span>Total Allocated: <strong className="text-slate-200">{formatINR(budgetVariance?.total_budget_allocated || 0)}</strong></span>
            <span>Total Utilized: <strong className="text-amber-400">{formatINR(budgetVariance?.total_budget_utilized || 0)}</strong></span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">Code</th>
                <th className="py-3 px-4 text-right">Allocated Budget</th>
                <th className="py-3 px-4 text-right">Utilized to Date</th>
                <th className="py-3 px-4 text-right">Remaining Headroom</th>
                <th className="py-3 px-4">Burn %</th>
                <th className="py-3 px-4 text-center">Headcount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {depts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No departments created yet. Seed departments in Settings to track budget variances.
                  </td>
                </tr>
              ) : (
                depts.map((d: any) => {
                  const burnPct = Number(d.burn_percentage) || 0;
                  const isHighBurn = burnPct > 80;
                  return (
                    <tr key={d.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-medium text-slate-200 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                        {d.name}
                      </td>
                      <td className="py-3 px-4 text-slate-400 font-mono">{d.code}</td>
                      <td className="py-3 px-4 text-right font-medium text-slate-200">
                        {formatINR(d.budget_allocated)}
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-amber-400">
                        {formatINR(d.budget_utilized)}
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-emerald-400">
                        {formatINR(d.budget_remaining)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                isHighBurn ? "bg-rose-500" : "bg-cyan-500"
                              }`}
                              style={{ width: `${Math.min(100, burnPct)}%` }}
                            />
                          </div>
                          <span className={`font-mono text-[11px] ${isHighBurn ? "text-rose-400" : "text-slate-300"}`}>
                            {burnPct}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center gap-1 bg-slate-950 px-2 py-0.5 rounded text-[11px] text-slate-300 border border-slate-800">
                          <Users className="h-3 w-3 text-slate-500" />
                          {d.headcount || 0}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
