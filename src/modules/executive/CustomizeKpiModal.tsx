"use client";

import React, { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import {
  KpiKey,
  KPI_META,
  DEFAULT_QUICK_KPIS,
  RawKpiData,
  getKpiProfile,
  saveKpiProfile,
  resetKpiProfile,
} from "@/lib/kpi/kpi-service";
import { Sparkles, RotateCcw, Check, SlidersHorizontal, ArrowUpRight } from "lucide-react";

interface CustomizeKpiModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeOrgId: string;
  activeOrgName: string;
  onSaved?: () => void;
}

export function CustomizeKpiModal({
  isOpen,
  onClose,
  activeOrgId,
  activeOrgName,
  onSaved,
}: CustomizeKpiModalProps) {
  const [formData, setFormData] = useState<RawKpiData>({
    turnover: 1245000,
    profit: 825000,
    billed: 1245000,
    liquid: 640000,
    debtors: 260000,
    creditors: 115000,
    expenses: 420000,
    gst: 48600,
    quickKpiKeys: DEFAULT_QUICK_KPIS,
  });

  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const current = getKpiProfile(activeOrgId, activeOrgName);
      setFormData(current.raw);
      setSaveSuccess(false);
    }
  }, [isOpen, activeOrgId, activeOrgName]);

  const handleChange = (field: keyof RawKpiData, value: number) => {
    setFormData((prev) => ({
      ...prev,
      [field]: isNaN(value) ? 0 : value,
    }));
  };

  const handleToggleKpi = (key: KpiKey) => {
    setFormData((prev) => {
      const currentKeys = prev.quickKpiKeys || DEFAULT_QUICK_KPIS;
      const exists = currentKeys.includes(key);
      const updated = exists
        ? currentKeys.filter((k) => k !== key)
        : [...currentKeys, key];
      return {
        ...prev,
        quickKpiKeys: updated.length > 0 ? updated : [key],
      };
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveKpiProfile(activeOrgId, formData);
    setSaveSuccess(true);
    if (onSaved) onSaved();
    setTimeout(() => {
      onClose();
    }, 600);
  };

  const handleReset = () => {
    const res = resetKpiProfile(activeOrgId, activeOrgName);
    setFormData(res.raw);
    setSaveSuccess(true);
    if (onSaved) onSaved();
    setTimeout(() => {
      setSaveSuccess(false);
    }, 1500);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Customize Business KPIs & Targets"
      description={`Update numerical metrics and select Quick KPIs for ${activeOrgName}`}
      maxWidth="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4 font-sans text-xs">
        {/* Info Banner */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
          <div>
            <span className="font-bold text-slate-800 block text-xs">
              Live Audited Business KPIs
            </span>
            <span className="text-[11px] text-slate-500">
              Changes reflect immediately on Executive Dashboard and Gateway Column 3
            </span>
          </div>
          <button
            type="button"
            onClick={handleReset}
            className="text-[11px] font-mono font-medium text-slate-600 hover:text-brand-strong flex items-center gap-1 px-2.5 py-1 rounded bg-white border border-slate-300 hover:border-brand transition-colors cursor-pointer"
            title="Reset to verified standard defaults"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Reset Defaults</span>
          </button>
        </div>

        {/* Section 1: Numerical KPI Values */}
        <div>
          <div className="flex items-center gap-1.5 mb-2 font-mono font-bold uppercase tracking-wider text-[10px] text-ink-soft">
            <SlidersHorizontal className="h-3.5 w-3.5 text-brand" />
            <span>Numerical Values (₹ INR)</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white p-3 border border-slate-200 rounded-lg">
            {/* Turnover */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                Gross Turnover (₹)
              </label>
              <input
                type="number"
                min="0"
                step="1000"
                value={formData.turnover}
                onChange={(e) => handleChange("turnover", parseFloat(e.target.value))}
                className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 font-mono text-xs font-bold text-slate-900 focus:bg-white focus:border-brand focus:outline-none"
                required
              />
            </div>

            {/* Net Profit */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                Net Profit (EBITDA) (₹)
              </label>
              <input
                type="number"
                min="0"
                step="1000"
                value={formData.profit}
                onChange={(e) => handleChange("profit", parseFloat(e.target.value))}
                className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 font-mono text-xs font-bold text-emerald-700 focus:bg-white focus:border-brand focus:outline-none"
                required
              />
            </div>

            {/* Billed Turnover */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                Billed Turnover (₹)
              </label>
              <input
                type="number"
                min="0"
                step="1000"
                value={formData.billed}
                onChange={(e) => handleChange("billed", parseFloat(e.target.value))}
                className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 font-mono text-xs font-bold text-slate-900 focus:bg-white focus:border-brand focus:outline-none"
                required
              />
            </div>

            {/* Liquid Funds */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                Liquid Funds (Bank + Cash) (₹)
              </label>
              <input
                type="number"
                min="0"
                step="1000"
                value={formData.liquid}
                onChange={(e) => handleChange("liquid", parseFloat(e.target.value))}
                className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 font-mono text-xs font-bold text-slate-900 focus:bg-white focus:border-brand focus:outline-none"
                required
              />
            </div>

            {/* Trade Debtors (AR) */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                Trade Debtors (Receivables) (₹)
              </label>
              <input
                type="number"
                min="0"
                step="1000"
                value={formData.debtors}
                onChange={(e) => handleChange("debtors", parseFloat(e.target.value))}
                className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 font-mono text-xs font-bold text-slate-900 focus:bg-white focus:border-brand focus:outline-none"
                required
              />
            </div>

            {/* Trade Creditors (AP) */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                Trade Creditors (Payables) (₹)
              </label>
              <input
                type="number"
                min="0"
                step="1000"
                value={formData.creditors}
                onChange={(e) => handleChange("creditors", parseFloat(e.target.value))}
                className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 font-mono text-xs font-bold text-slate-900 focus:bg-white focus:border-brand focus:outline-none"
                required
              />
            </div>

            {/* Operating Expenses */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                Operating Expenses (₹)
              </label>
              <input
                type="number"
                min="0"
                step="1000"
                value={formData.expenses}
                onChange={(e) => handleChange("expenses", parseFloat(e.target.value))}
                className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 font-mono text-xs font-bold text-slate-900 focus:bg-white focus:border-brand focus:outline-none"
                required
              />
            </div>

            {/* GST Net Liability */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                GST Net Liability (₹)
              </label>
              <input
                type="number"
                min="0"
                step="500"
                value={formData.gst}
                onChange={(e) => handleChange("gst", parseFloat(e.target.value))}
                className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 font-mono text-xs font-bold text-rose-700 focus:bg-white focus:border-brand focus:outline-none"
                required
              />
            </div>
          </div>
        </div>

        {/* Section 2: Quick KPIs Selection for Column 3 */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-mono font-bold uppercase tracking-wider text-[10px] text-ink-soft">
              Quick KPIs Selection (Listed in Gateway Column 3)
            </span>
            <span className="text-[10px] text-slate-500 font-mono">
              Click individual KPI to open detail page
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
            {(
              [
                "billed",
                "liquid",
                "debtors",
                "creditors",
                "expenses",
                "gst",
              ] as KpiKey[]
            ).map((kpiKey) => {
              const meta = KPI_META[kpiKey];
              const isChecked = (formData.quickKpiKeys || DEFAULT_QUICK_KPIS).includes(kpiKey);
              return (
                <label
                  key={kpiKey}
                  className={`flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors ${
                    isChecked
                      ? "bg-white border-brand text-slate-900 shadow-2xs"
                      : "bg-slate-100/60 border-slate-200 text-slate-500"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => handleToggleKpi(kpiKey)}
                    className="accent-brand-strong rounded cursor-pointer"
                  />
                  <div className="truncate">
                    <span className="font-bold text-[11px] block truncate">{meta.label}</span>
                    <span className="text-[9px] text-slate-400 font-mono block truncate">
                      ➔ {meta.detailRoute}
                    </span>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        {/* Modal Actions */}
        <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
          <span className="text-[10px] font-mono text-slate-400">
            {saveSuccess ? (
              <span className="text-emerald-700 font-bold flex items-center gap-1">
                <Check className="h-3 w-3" /> Saved &amp; Synced!
              </span>
            ) : (
              "All KPIs sync across Gateway & Executive Dashboard"
            )}
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-panel hover:bg-panel-deep text-brand-soft hover:text-white font-bold text-xs border border-edge transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Sparkles className="h-3.5 w-3.5 text-brand" />
              <span>Save &amp; Update KPIs</span>
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
