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
  ArrowUpRight,
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

  // Missing figures stay missing ("–"); never substitute benchmark ratios.
  const prof = fpaMetrics?.profitability ?? {};
  const liq = fpaMetrics?.liquidity_and_balance_sheet ?? {};
  const runway = fpaMetrics?.treasury_and_runway ?? {};
  const num = (v: number | null | undefined, suffix: string) => (v == null ? "–" : `${v}${suffix}`);

  const depts = budgetVariance?.departments || [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {error && (
        <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800">
          {error}. The figures below are unavailable until this loads.
        </div>
      )}

      {/* Top Action & Control Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-surface p-4 rounded-xl border border-line shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-brand/10 border border-brand/20 rounded-lg text-brand-strong">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-ink">
              FP&A Strategic Intelligence &amp; Corporate Health
            </h3>
            <p className="text-xs text-ink-muted">
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
            className="text-xs font-semibold"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="text-xs font-semibold"
          >
            <Printer className="h-3.5 w-3.5 mr-1.5" />
            Print Report
          </Button>
        </div>
      </div>

      {/* KPI Section 1: Margins & Profitability */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Topline Revenue */}
        <div className="bg-surface border border-line rounded-xl p-4 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">Total Topline Revenue</span>
            <span className="text-[11px] font-semibold text-ink-subtle">Gross</span>
          </div>
          <div className="text-2xl font-black font-mono text-ink">
            {formatINR(prof.total_revenue)}
          </div>
          <div className="text-xs text-emerald-700 flex items-center mt-2 font-medium">
            <TrendingUp className="h-3.5 w-3.5 mr-1 shrink-0" /> Recognized billings
          </div>
        </div>

        {/* Gross Margin */}
        <div className="bg-surface border border-line rounded-xl p-4 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">Gross Margin %</span>
            <Badge variant="teal" size="sm">{num(prof.gross_margin_pct, "%")}</Badge>
          </div>
          <div className="text-2xl font-black font-mono text-brand-strong">
            {formatINR(prof.gross_profit)}
          </div>
          <div className="text-xs text-ink-muted mt-2">Revenue minus COGS direct cost</div>
        </div>

        {/* Operating Expenses */}
        <div className="bg-surface border border-line rounded-xl p-4 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">Operating Expenses</span>
            <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">OPEX</span>
          </div>
          <div className="text-2xl font-black font-mono text-amber-700">
            {formatINR(prof.opex)}
          </div>
          <div className="text-xs text-ink-muted mt-2">SG&amp;A, payroll, departmental burns</div>
        </div>

        {/* Net Profit Margin */}
        <div className="bg-surface border border-line rounded-xl p-4 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">Net Profit Margin</span>
            <Badge variant={prof.net_profit >= 0 ? "teal" : "danger"} size="sm">
              {num(prof.net_margin_pct, "%")}
            </Badge>
          </div>
          <div className={`text-2xl font-black font-mono ${prof.net_profit >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
            {formatINR(prof.net_profit)}
          </div>
          <div className="text-xs text-ink-muted mt-2">Net surplus to retained earnings</div>
        </div>
      </div>

      {/* KPI Section 2: Liquidity, Working Capital & Runway */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Working Capital Box */}
        <div className="bg-surface border border-line rounded-xl p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-blue-50 text-blue-700 rounded-md">
                <Briefcase className="h-4 w-4" />
              </div>
              <h4 className="text-sm font-bold text-ink">Working Capital Buffer</h4>
            </div>
            <span className="text-[11px] font-semibold text-ink-soft bg-canvas-sunken px-2 py-0.5 rounded border border-line">
              Net Gap
            </span>
          </div>
          <div className="text-2xl font-black font-mono text-ink">
            {formatINR(liq.working_capital)}
          </div>
          <div className="mt-4 space-y-2 text-xs border-t border-line pt-3">
            <div className="flex justify-between items-center">
              <span className="text-ink-muted">Current Assets (AR, Cash, Bank):</span>
              <span className="text-ink font-mono font-semibold">{formatINR(liq.current_assets)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-ink-muted">Current Liabilities (AP, Taxes):</span>
              <span className="text-rose-700 font-mono font-semibold">{formatINR(liq.current_liabilities)}</span>
            </div>
          </div>
        </div>

        {/* Corporate Health Ratios */}
        <div className="bg-surface border border-line rounded-xl p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-emerald-50 text-emerald-700 rounded-md">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <h4 className="text-sm font-bold text-ink">Solvency Ratios</h4>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div className="bg-canvas-sunken p-3 rounded-lg border border-line/60">
              <div className="text-xs text-ink-muted font-medium">Current Ratio</div>
              <div className="text-xl font-black font-mono text-emerald-700 mt-1">
                {num(liq.current_ratio, "x")}
              </div>
            </div>
            <div className="bg-canvas-sunken p-3 rounded-lg border border-line/60">
              <div className="text-xs text-ink-muted font-medium">Quick Ratio</div>
              <div className="text-xl font-black font-mono text-blue-700 mt-1">
                {num(liq.quick_ratio, "x")}
              </div>
            </div>
          </div>
        </div>

        {/* Runway & Burn Engine */}
        <div className="bg-surface border border-line rounded-xl p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-amber-50 text-amber-700 rounded-md">
                <Clock className="h-4 w-4" />
              </div>
              <h4 className="text-sm font-bold text-ink">Treasury Runway</h4>
            </div>
            <span className="text-xs text-amber-700 font-semibold flex items-center bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
              <Flame className="h-3.5 w-3.5 mr-1" />
              {num(runway.cash_runway_months, " months")}
            </span>
          </div>
          <div className="text-2xl font-black font-mono text-amber-700">
            {formatINR(runway.cash_and_bank_reserves)}
          </div>
          <div className="mt-4 space-y-2 text-xs border-t border-line pt-3">
            <div className="flex justify-between items-center">
              <span className="text-ink-muted">Trailing Monthly Burn:</span>
              <span className="text-ink font-mono font-semibold">{formatINR(runway.estimated_monthly_burn)} / mo</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-ink-muted">Runway Horizon:</span>
              <span className="text-ink font-mono font-semibold">{num(runway.cash_runway_months, " months")}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Section 3: Departmental Budget vs. Actual Variance Rollup */}
      <div className="bg-surface border border-line rounded-xl overflow-hidden shadow-2xs">
        <div className="px-5 py-4 border-b border-line flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-canvas-sunken/40">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-brand-strong" />
            <h4 className="font-bold text-ink text-sm">
              Departmental Budget vs. Actual Utilization Rollup
            </h4>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="text-ink-muted">
              Total Allocated: <strong className="font-mono text-ink">{budgetVariance?.total_budget_allocated == null ? "–" : formatINR(budgetVariance.total_budget_allocated)}</strong>
            </span>
            <span className="text-ink-muted">
              Total Utilized: <strong className="font-mono text-amber-700">{budgetVariance?.total_budget_utilized == null ? "–" : formatINR(budgetVariance.total_budget_utilized)}</strong>
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-canvas-sunken border-b border-line text-ink-muted uppercase tracking-wider font-semibold text-[11px]">
              <tr>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4 font-mono">Code</th>
                <th className="py-3 px-4 text-right">Allocated Budget</th>
                <th className="py-3 px-4 text-right">Utilized to Date</th>
                <th className="py-3 px-4 text-right">Remaining Headroom</th>
                <th className="py-3 px-4">Burn %</th>
                <th className="py-3 px-4 text-center">Headcount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {depts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-ink-muted">
                    No departments created yet. Seed departments in Settings to track budget variances.
                  </td>
                </tr>
              ) : (
                depts.map((d: any) => {
                  const burnPct = Number(d.burn_percentage) || 0;
                  const isHighBurn = burnPct > 80;
                  return (
                    <tr key={d.id} className="hover:bg-canvas-sunken/50 transition-colors">
                      <td className="py-3 px-4 font-medium text-ink flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-brand"></span>
                        {d.name}
                      </td>
                      <td className="py-3 px-4 text-ink-muted font-mono">{d.code}</td>
                      <td className="py-3 px-4 text-right font-mono font-medium text-ink">
                        {formatINR(d.budget_allocated)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-medium text-amber-700">
                        {formatINR(d.budget_utilized)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-medium text-emerald-700">
                        {formatINR(d.budget_remaining)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-canvas-sunken rounded-full h-2 overflow-hidden border border-line/60">
                            <div
                              className={`h-full rounded-full ${
                                isHighBurn ? "bg-rose-500" : "bg-brand"
                              }`}
                              style={{ width: `${Math.min(100, burnPct)}%` }}
                            />
                          </div>
                          <span className={`font-mono text-[11px] font-semibold ${isHighBurn ? "text-rose-700" : "text-ink"}`}>
                            {burnPct}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center gap-1 bg-canvas-sunken px-2 py-0.5 rounded text-[11px] text-ink border border-line font-medium">
                          <Users className="h-3 w-3 text-ink-muted" />
                          {d.headcount ?? "–"}
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
