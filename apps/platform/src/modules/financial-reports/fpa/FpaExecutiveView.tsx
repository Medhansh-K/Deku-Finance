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
import { ReportError, ui } from "@/modules/financial-reports/report-ui";

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
    <div className={`${ui.page} space-y-5 max-w-7xl mx-auto`}>
      {error && <ReportError title="FP&A figures unavailable" message={`${error}. The figures below are unavailable until this loads.`} />}

      {/* Top Action & Control Bar */}
      <div className={`${ui.toolbar} sm:items-center`}>
        <div className="flex items-start gap-3">
          <span className="h-8 w-8 rounded-[8px] bg-canvas-sunken text-ink-soft grid place-items-center shrink-0">
            <Activity className="h-4 w-4" />
          </span>
          <div>
            <h3 className={ui.panelTitle}>FP&amp;A and business health</h3>
            <p className={ui.panelSub}>
              Profitability margins, liquidity ratios, working capital and department budget variances
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={fetchFpaData} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button variant="secondary" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            Print report
          </Button>
        </div>
      </div>

      {/* KPI Section 1: Margins & Profitability */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3.5">
        {/* Topline Revenue */}
        <div className={ui.kpi}>
          <div className={ui.kpiLabel}>
            Total revenue <span className="ml-auto text-[12.5px] text-ink-subtle">Gross</span>
          </div>
          <div className={ui.kpiValue}>{formatINR(prof.total_revenue)}</div>
          <div className={`${ui.kpiNote} flex items-center`}>
            <TrendingUp className="h-3.5 w-3.5 mr-1 shrink-0 text-ok" /> Recognised billings
          </div>
        </div>

        {/* Gross Margin */}
        <div className={ui.kpi}>
          <div className={ui.kpiLabel}>
            Gross margin <Badge variant="teal" className="ml-auto">{num(prof.gross_margin_pct, "%")}</Badge>
          </div>
          <div className={ui.kpiValue}>{formatINR(prof.gross_profit)}</div>
          <div className={ui.kpiNote}>Revenue minus direct cost of goods sold</div>
        </div>

        {/* Operating Expenses */}
        <div className={ui.kpi}>
          <div className={ui.kpiLabel}>
            Operating expenses <Badge className="ml-auto">Opex</Badge>
          </div>
          <div className={ui.kpiValue}>{formatINR(prof.opex)}</div>
          <div className={ui.kpiNote}>SG&amp;A, payroll and department spend</div>
        </div>

        {/* Net Profit Margin */}
        <div className={ui.kpi}>
          <div className={ui.kpiLabel}>
            Net profit margin
            <Badge variant={prof.net_profit >= 0 ? "success" : "danger"} className="ml-auto">
              {num(prof.net_margin_pct, "%")}
            </Badge>
          </div>
          <div className={`${ui.kpiValue} ${prof.net_profit >= 0 ? "text-ok" : "text-bad"}`}>
            {formatINR(prof.net_profit)}
          </div>
          <div className={ui.kpiNote}>Net surplus to retained earnings</div>
        </div>
      </div>

      {/* KPI Section 2: Liquidity, Working Capital & Runway */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {/* Working Capital Box */}
        <div className={`${ui.kpi} px-5`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="h-8 w-8 rounded-[8px] bg-canvas-sunken text-ink-soft grid place-items-center">
                <Briefcase className="h-4 w-4" />
              </span>
              <h4 className={ui.panelTitle}>Working capital</h4>
            </div>
            <Badge>Net gap</Badge>
          </div>
          <div className={ui.kpiValue}>{formatINR(liq.working_capital)}</div>
          <div className="mt-3 space-y-2 border-t border-line pt-3">
            <div className="flex justify-between items-center">
              <span className="text-ink-muted">Current assets (AR, cash, bank)</span>
              <span className="tabular-nums font-medium">{formatINR(liq.current_assets)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-ink-muted">Current liabilities (AP, taxes)</span>
              <span className="tabular-nums font-medium">{formatINR(liq.current_liabilities)}</span>
            </div>
          </div>
        </div>

        {/* Corporate Health Ratios */}
        <div className={`${ui.kpi} px-5`}>
          <div className="flex items-center gap-2 mb-2">
            <span className="h-8 w-8 rounded-[8px] bg-canvas-sunken text-ink-soft grid place-items-center">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <h4 className={ui.panelTitle}>Solvency ratios</h4>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div className="bg-canvas-sunken/60 p-3 rounded-ctl">
              <div className="text-[13px] text-ink-muted">Current ratio</div>
              <div className="text-[22px] font-semibold tracking-[-0.03em] tabular-nums mt-1">
                {num(liq.current_ratio, "x")}
              </div>
            </div>
            <div className="bg-canvas-sunken/60 p-3 rounded-ctl">
              <div className="text-[13px] text-ink-muted">Quick ratio</div>
              <div className="text-[22px] font-semibold tracking-[-0.03em] tabular-nums mt-1">
                {num(liq.quick_ratio, "x")}
              </div>
            </div>
          </div>
        </div>

        {/* Runway & Burn Engine */}
        <div className={`${ui.kpi} px-5`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="h-8 w-8 rounded-[8px] bg-canvas-sunken text-ink-soft grid place-items-center">
                <Clock className="h-4 w-4" />
              </span>
              <h4 className={ui.panelTitle}>Cash runway</h4>
            </div>
            <Badge variant="warning">{num(runway.cash_runway_months, " months")}</Badge>
          </div>
          <div className={ui.kpiValue}>{formatINR(runway.cash_and_bank_reserves)}</div>
          <div className="mt-3 space-y-2 border-t border-line pt-3">
            <div className="flex justify-between items-center">
              <span className="text-ink-muted">Trailing monthly burn</span>
              <span className="tabular-nums font-medium">{formatINR(runway.estimated_monthly_burn)} / mo</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-ink-muted">Runway</span>
              <span className="tabular-nums font-medium">{num(runway.cash_runway_months, " months")}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Section 3: Departmental Budget vs. Actual Variance Rollup */}
      <div className={ui.panel}>
        <div className={`${ui.panelHead} flex-col sm:flex-row sm:items-center`}>
          <h4 className={ui.panelTitle}>Department budget against actual</h4>
          <div className="flex items-center gap-4 text-[13px]">
            <span className="text-ink-muted">
              Total allocated <strong className="font-semibold tabular-nums text-ink">{budgetVariance?.total_budget_allocated == null ? "–" : formatINR(budgetVariance.total_budget_allocated)}</strong>
            </span>
            <span className="text-ink-muted">
              Total utilised <strong className="font-semibold tabular-nums text-ink">{budgetVariance?.total_budget_utilized == null ? "–" : formatINR(budgetVariance.total_budget_utilized)}</strong>
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr>
                <th className={ui.th}>Department</th>
                <th className={ui.th}>Code</th>
                <th className={`${ui.th} text-right`}>Allocated budget</th>
                <th className={`${ui.th} text-right`}>Utilised to date</th>
                <th className={`${ui.th} text-right`}>Remaining</th>
                <th className={ui.th}>Burn</th>
                <th className={`${ui.th} text-center`}>Headcount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
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
                    <tr key={d.id} className="hover:bg-brand-wash/60 transition-colors">
                      <td className={`${ui.td} font-medium`}>{d.name}</td>
                      <td className={`${ui.td} ${ui.code}`}>{d.code}</td>
                      <td className={`${ui.td} text-right tabular-nums`}>{formatINR(d.budget_allocated)}</td>
                      <td className={`${ui.td} text-right tabular-nums`}>{formatINR(d.budget_utilized)}</td>
                      <td className={`${ui.td} text-right tabular-nums`}>{formatINR(d.budget_remaining)}</td>
                      <td className={ui.td}>
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-canvas-sunken rounded-[3px] h-1.5 overflow-hidden">
                            <div
                              className={`h-full rounded-[3px] ${isHighBurn ? "bg-bad" : "bg-brand"}`}
                              style={{ width: `${Math.min(100, burnPct)}%` }}
                            />
                          </div>
                          <span className={`tabular-nums text-[12.5px] font-medium ${isHighBurn ? "text-bad" : "text-ink"}`}>
                            {burnPct}%
                          </span>
                        </div>
                      </td>
                      <td className={`${ui.td} text-center`}>
                        <span className={`${ui.chip} bg-canvas-sunken text-ink-soft`}>
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
