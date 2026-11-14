"use client";

import React, { useState, useMemo } from "react";
import {
  TrendingUp,
  TrendingDown,
  Sliders,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowRight,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatINR } from "@/lib/formatters/currency";

export function FpaScenarioDashboard() {
  // Baseline initial financial numbers (from ledger)
  const [baselineRevenue, setBaselineRevenue] = useState(2500000); // 25 Lakhs / month
  const [baselineOpex, setBaselineOpex] = useState(1800000); // 18 Lakhs / month
  const [currentCash, setCurrentCash] = useState(8500000); // 85 Lakhs opening cash

  // Interactive CFO Sensitivity Levers
  const [customRevGrowth, setCustomRevGrowth] = useState(10); // %
  const [customExpInflation, setCustomExpInflation] = useState(5); // %
  const [customCollectionDelay, setCustomCollectionDelay] = useState(15); // days
  const [activeScenario, setActiveScenario] = useState<"base" | "best" | "worst" | "custom">("base");

  // Compute 12-month projections
  const projections = useMemo(() => {
    const months: Array<{
      month: string;
      baseRev: number;
      baseCash: number;
      bestRev: number;
      bestCash: number;
      worstRev: number;
      worstCash: number;
      customRev: number;
      customCash: number;
    }> = [];

    let bCash = currentCash;
    let bestCash = currentCash;
    let wCash = currentCash;
    let cCash = currentCash;

    let bRev = baselineRevenue;
    let bOpex = baselineOpex;

    let bestRev = baselineRevenue;
    let bestOpex = baselineOpex;

    let wRev = baselineRevenue;
    let wOpex = baselineOpex;

    let cRev = baselineRevenue;
    let cOpex = baselineOpex;

    const monthNames = [
      "Dec 2026", "Jan 2027", "Feb 2027", "Mar 2027",
      "Apr 2027", "May 2027", "Jun 2027", "Jul 2027",
      "Aug 2027", "Sep 2027", "Oct 2027", "Nov 2027",
    ];

    for (let i = 0; i < 12; i++) {
      // Base: +5% rev, +3% exp per annum
      bRev *= 1 + 0.05 / 12;
      bOpex *= 1 + 0.03 / 12;
      bCash += bRev - bOpex;

      // Best: +20% rev, +2% exp per annum
      bestRev *= 1 + 0.20 / 12;
      bestOpex *= 1 + 0.02 / 12;
      bestCash += bestRev - bestOpex;

      // Worst: -15% rev, +8% exp per annum
      wRev *= 1 - 0.15 / 12;
      wOpex *= 1 + 0.08 / 12;
      wCash += wRev - wOpex;

      // Custom
      cRev *= 1 + customRevGrowth / 100 / 12;
      cOpex *= 1 + customExpInflation / 100 / 12;
      cCash += cRev - cOpex;

      months.push({
        month: monthNames[i],
        baseRev: Math.round(bRev),
        baseCash: Math.round(bCash),
        bestRev: Math.round(bestRev),
        bestCash: Math.round(bestCash),
        worstRev: Math.round(wRev),
        worstCash: Math.round(wCash),
        customRev: Math.round(cRev),
        customCash: Math.round(cCash),
      });
    }

    return months;
  }, [baselineRevenue, baselineOpex, currentCash, customRevGrowth, customExpInflation, customCollectionDelay]);

  // Calculate Cash Runway
  const worstCaseRunwayMonths = useMemo(() => {
    const idx = projections.findIndex((p) => p.worstCash <= 0);
    return idx === -1 ? "> 12" : `${idx + 1}`;
  }, [projections]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans text-[13.5px]">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-[20px] font-semibold tracking-tight text-ink flex items-center gap-2">
            <Sliders className="h-5 w-5 text-brand-strong" /> FP&amp;A Multi-Scenario Financial Forecasting
          </h2>
          <p className="text-[13px] text-ink-muted mt-0.5">
            12-month rolling P&amp;L and cash runway sensitivity modelling across Best, Base, and Stress Test scenarios
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="teal" className="text-[12px] px-2.5 py-1">
            Opening Liquidity: {formatINR(currentCash)}
          </Badge>
        </div>
      </div>

      {/* Runway Alert Banner */}
      <div className="p-4 rounded-panel border border-line bg-surface flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <div className="font-semibold text-ink text-[14.5px]">
              Stress Test Cash Runway: {worstCaseRunwayMonths} Months
            </div>
            <p className="text-[12.5px] text-ink-muted">
              Under a simulated 15% revenue downturn and 8% inflationary cost shock, the company maintains continuous
              solvency.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={activeScenario === "base" ? "tally" : "secondary"}
            size="sm"
            onClick={() => setActiveScenario("base")}
          >
            Base Case
          </Button>
          <Button
            variant={activeScenario === "best" ? "tally" : "secondary"}
            size="sm"
            onClick={() => setActiveScenario("best")}
          >
            Best Case
          </Button>
          <Button
            variant={activeScenario === "worst" ? "tally" : "secondary"}
            size="sm"
            onClick={() => setActiveScenario("worst")}
          >
            Stress Test
          </Button>
          <Button
            variant={activeScenario === "custom" ? "tally" : "secondary"}
            size="sm"
            onClick={() => setActiveScenario("custom")}
          >
            Custom Levers
          </Button>
        </div>
      </div>

      {/* CFO Sensitivity Levers Controls */}
      {activeScenario === "custom" && (
        <div className="bg-canvas border border-line rounded-panel p-5 space-y-4">
          <span className="font-semibold text-ink block">Dynamic CFO Sensitivity Levers</span>
          <div className="grid sm:grid-cols-3 gap-6">
            <div className="space-y-1.5">
              <div className="flex justify-between text-[13px]">
                <span className="text-ink-soft">Annual Revenue Growth</span>
                <span className="font-semibold text-ink tabular-nums">{customRevGrowth}%</span>
              </div>
              <input
                type="range"
                min={-30}
                max={50}
                value={customRevGrowth}
                onChange={(e) => setCustomRevGrowth(Number(e.target.value))}
                className="w-full accent-brand"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-[13px]">
                <span className="text-ink-soft">OPEX / COGS Inflation</span>
                <span className="font-semibold text-bad tabular-nums">+{customExpInflation}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={30}
                value={customExpInflation}
                onChange={(e) => setCustomExpInflation(Number(e.target.value))}
                className="w-full accent-bad"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-[13px]">
                <span className="text-ink-soft">Debtor Collection Delay</span>
                <span className="font-semibold text-amber-600 tabular-nums">{customCollectionDelay} Days</span>
              </div>
              <input
                type="range"
                min={0}
                max={60}
                value={customCollectionDelay}
                onChange={(e) => setCustomCollectionDelay(Number(e.target.value))}
                className="w-full accent-amber-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* 12-Month Projections Table */}
      <div className="bg-surface border border-line rounded-panel overflow-hidden">
        <div className="px-5 py-3 border-b border-line flex items-center justify-between">
          <span className="font-semibold text-ink">12-Month Rolling Forecast Trajectory</span>
          <span className="text-[12.5px] text-ink-muted">Amounts in INR (₹)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr>
                <th className="deku-table-th">Forecast Month</th>
                <th className="deku-table-th !text-right">Base Revenue</th>
                <th className="deku-table-th !text-right">Base Ending Cash</th>
                <th className="deku-table-th !text-right">Best Case Cash</th>
                <th className="deku-table-th !text-right">Stress Test Cash</th>
                {activeScenario === "custom" && (
                  <th className="deku-table-th !text-right text-brand">Custom Ending Cash</th>
                )}
              </tr>
            </thead>
            <tbody>
              {projections.map((p, idx) => (
                <tr key={idx} className="hover:bg-canvas">
                  <td className="deku-table-td font-medium text-ink">{p.month}</td>
                  <td className="deku-table-td text-right tabular-nums text-ink-soft">{formatINR(p.baseRev)}</td>
                  <td className="deku-table-td text-right tabular-nums font-semibold text-ink">
                    {formatINR(p.baseCash)}
                  </td>
                  <td className="deku-table-td text-right tabular-nums font-semibold text-ok">
                    {formatINR(p.bestCash)}
                  </td>
                  <td className="deku-table-td text-right tabular-nums font-semibold text-amber-600">
                    {formatINR(p.worstCash)}
                  </td>
                  {activeScenario === "custom" && (
                    <td className="deku-table-td text-right tabular-nums font-bold text-brand">
                      {formatINR(p.customCash)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
