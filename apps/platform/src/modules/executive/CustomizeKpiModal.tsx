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
import { RotateCcw, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";

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
      title="Customize KPIs"
      description={`Choose which Quick KPIs to list for ${activeOrgName}`}
      maxWidth="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-[13.5px]">
        <div className="p-3.5 bg-canvas rounded-[10px] flex items-center justify-between gap-3">
          <div>
            <span className="font-semibold text-ink block">KPI values come from your posted entries</span>
            <span className="text-[12.5px] text-ink-muted">Pick which ones the Gateway lists. Values can&apos;t be edited here.</span>
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={handleReset} title="Show the default KPI list">
            <RotateCcw className="h-3.5 w-3.5" />
            Reset defaults
          </Button>
        </div>

        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 mb-2">
            <span className="text-[13px] font-medium text-ink-soft">Quick KPIs on the Gateway</span>
            <span className="text-[12.5px] text-ink-muted">Each opens its detail page</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {(["billed", "liquid", "debtors", "creditors", "expenses", "gst"] as KpiKey[]).map((kpiKey) => {
              const meta = KPI_META[kpiKey];
              const isChecked = keys.includes(kpiKey);
              return (
                <label
                  key={kpiKey}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-ctl border cursor-pointer transition-colors ${
                    isChecked ? "bg-brand-wash border-brand text-ink" : "bg-surface border-line text-ink-soft hover:bg-canvas"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => handleToggleKpi(kpiKey)}
                    className="accent-brand-strong rounded cursor-pointer"
                  />
                  <span className="min-w-0">
                    <span className="font-medium block truncate">{meta.label}</span>
                    <span className="text-[12.5px] text-ink-muted font-mono block truncate">{meta.detailRoute}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="pt-3 border-t border-line flex flex-wrap items-center justify-between gap-2">
          <span className="text-[12.5px] text-ink-muted">
            {saveSuccess ? (
              <span className="text-ok font-medium flex items-center gap-1">
                <Check className="h-3.5 w-3.5" /> Saved
              </span>
            ) : (
              "Saved in this browser"
            )}
          </span>

          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Save KPI list
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
