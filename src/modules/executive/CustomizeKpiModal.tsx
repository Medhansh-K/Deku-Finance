"use client";

import React, { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import {
  KpiKey,
  KPI_META,
  DEFAULT_QUICK_KPIS,
  getQuickKpiKeys,
  saveQuickKpiKeys,
} from "@/lib/kpi/kpi-service";
import { Sparkles, RotateCcw, Check } from "lucide-react";

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
  const [keys, setKeys] = useState<KpiKey[]>(DEFAULT_QUICK_KPIS);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setKeys(getQuickKpiKeys(activeOrgId));
      setSaveSuccess(false);
    }
  }, [isOpen, activeOrgId]);

  const handleToggleKpi = (key: KpiKey) => {
    setKeys((prev) => {
      const updated = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
      return updated.length > 0 ? updated : [key];
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveQuickKpiKeys(activeOrgId, keys);
    setSaveSuccess(true);
    if (onSaved) onSaved();
    setTimeout(() => {
      onClose();
    }, 600);
  };

  const handleReset = () => {
    saveQuickKpiKeys(activeOrgId, null);
    setKeys(DEFAULT_QUICK_KPIS);
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
      title="Customize Business KPIs"
      description={`Choose which Quick KPIs to list for ${activeOrgName}`}
      maxWidth="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4 font-sans text-xs">
        {/* Info Banner */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
          <div>
            <span className="font-bold text-slate-800 block text-xs">
              KPI values come from your posted entries
            </span>
            <span className="text-[11px] text-slate-500">
              Pick which ones the Gateway lists. Values can&apos;t be edited here.
            </span>
          </div>
          <button
            type="button"
            onClick={handleReset}
            className="text-[11px] font-mono font-medium text-slate-600 hover:text-brand-strong flex items-center gap-1 px-2.5 py-1 rounded bg-white border border-slate-300 hover:border-brand transition-colors cursor-pointer"
            title="Show the default KPI list"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Reset Defaults</span>
          </button>
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
              const isChecked = keys.includes(kpiKey);
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
              "Saved in this browser"
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
              <span>Save KPI List</span>
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
