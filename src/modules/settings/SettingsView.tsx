"use client";

import React, { useState, useEffect } from "react";
import { Settings, Plus, Calendar, ShieldCheck, RefreshCw, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { accountingApi, organisationsApi } from "@/api/endpoints";
import { FiscalPeriod } from "@/types/accounting";
import { formatDateTally, toISODateString } from "@/lib/formatters/date";
import { logUserActivity } from "@/lib/logging/activity-logger";
import { CompanyControlsCard } from "./CompanyControlsCard";

export function SettingsView() {
  const [fiscalPeriods, setFiscalPeriods] = useState<FiscalPeriod[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isFpModalOpen, setIsFpModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fpName, setFpName] = useState("FY 2027-28 Annual");
  const [fpStart, setFpStart] = useState("2027-04-01");
  const [fpEnd, setFpEnd] = useState("2028-03-31");

  const [orgId, setOrgId] = useState<string>("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("deku_active_org_id");
      if (saved) setOrgId(saved);
    }
  }, []);

  const loadFiscalPeriods = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await accountingApi.listFiscalPeriods(orgId);
      setFiscalPeriods(res.data || []);
    } catch (err: any) {
      setError(err.message || "Failed to load fiscal periods");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!orgId) return;
    loadFiscalPeriods();
  }, [orgId]);

  const handleCreateFp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await accountingApi.createFiscalPeriod(orgId, {
        name: fpName,
        start_date: fpStart,
        end_date: fpEnd,
      });

      logUserActivity({
        category: "SETTING",
        action: "Fiscal Period Created",
        description: `Created new fiscal period '${fpName}' (${fpStart} to ${fpEnd})`,
        entity_type: "fiscal_period",
        entity_id: fpName,
        organisation_id: orgId,
        status: "success",
        metadata: { name: fpName, startDate: fpStart, endDate: fpEnd },
      });

      setIsFpModalOpen(false);
      await loadFiscalPeriods();
    } catch (err: any) {
      alert(err.message || "Failed to create fiscal period");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 font-sans text-xs">
      {orgId && <CompanyControlsCard orgId={orgId} />}

      {/* Fiscal Periods Management */}
      <div className="bg-white border border-[#CBD5E1] rounded-lg p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div>
            <h3 className="text-sm font-bold uppercase text-[#0A0A0A] font-mono">
              Fiscal Accounting Periods
            </h3>
            <p className="text-[11px] text-slate-500">
              Only open fiscal periods permit journal posting and financial allocations
            </p>
          </div>
          <Button
            variant="tally"
            size="sm"
            onClick={() => setIsFpModalOpen(true)}
            className="gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" /> New Fiscal Period
          </Button>
        </div>

        {error && (
          <div className="p-3 rounded bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        )}

        <div className="rounded border border-slate-200 overflow-hidden">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#1F2324] text-white font-mono text-[11px]">
                <th className="py-2 px-3">Period Title</th>
                <th className="py-2 px-3">Start Date</th>
                <th className="py-2 px-3">End Date</th>
                <th className="py-2 px-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {fiscalPeriods.map((fp) => (
                <tr key={fp.id} className="hover:bg-slate-50">
                  <td className="py-2 px-3 font-bold text-slate-900">{fp.name}</td>
                  <td className="py-2 px-3 font-mono text-slate-600">
                    {formatDateTally(fp.start_date)}
                  </td>
                  <td className="py-2 px-3 font-mono text-slate-600">
                    {formatDateTally(fp.end_date)}
                  </td>
                  <td className="py-2 px-3 text-right">
                    <Badge variant={fp.status === "open" ? "success" : "default"}>
                      {fp.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Accounting Standards & Engine Info */}
      <div className="bg-white border border-[#CBD5E1] rounded-lg p-5 shadow-xs space-y-3">
        <h3 className="text-sm font-bold uppercase text-[#0A0A0A] font-mono border-b border-slate-200 pb-2">
          Accounting Standard & Enforcement
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-3 bg-slate-50 rounded border border-slate-200">
            <span className="font-bold text-slate-900 block mb-1">
              ALERX 4-Tier Hierarchy
            </span>
            <p className="text-slate-600 text-[11px]">
              Vouchers are strictly restricted to postable leaf accounts. Group summaries roll up naturally without manual balance cache corruptions.
            </p>
          </div>
          <div className="p-3 bg-slate-50 rounded border border-slate-200">
            <span className="font-bold text-slate-900 block mb-1">
              Immutable Reversal Integrity
            </span>
            <p className="text-slate-600 text-[11px]">
              Posted vouchers cannot be silently modified or dropped. Controlled reversals create symmetric counter-entries for full statutory compliance.
            </p>
          </div>
        </div>
      </div>

      {/* New Fiscal Period Modal */}
      <Modal
        isOpen={isFpModalOpen}
        onClose={() => setIsFpModalOpen(false)}
        title="Open New Fiscal Accounting Period"
        description="Establish non-overlapping financial year dates"
      >
        <form onSubmit={handleCreateFp} className="space-y-3 font-sans text-xs">
          <Input
            label="Fiscal Period Title"
            value={fpName}
            onChange={(e) => setFpName(e.target.value)}
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Start Date (YYYY-MM-DD)"
              type="date"
              value={fpStart}
              onChange={(e) => setFpStart(e.target.value)}
              required
            />
            <Input
              label="End Date (YYYY-MM-DD)"
              type="date"
              value={fpEnd}
              onChange={(e) => setFpEnd(e.target.value)}
              required
            />
          </div>

          <div className="pt-3 flex justify-end gap-2 border-t border-slate-200">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIsFpModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="tally"
              size="sm"
              isLoading={isSubmitting}
            >
              Establish Period
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
