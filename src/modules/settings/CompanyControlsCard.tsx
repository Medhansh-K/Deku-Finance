"use client";

import React, { useEffect, useState } from "react";
import { Building2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { organisationsApi } from "@/api/endpoints";
import { isValidGstin } from "@/lib/vouchers/invoice-text-parser";

/** Company GSTIN (used on invoices and GST returns) and the maker-checker switch. */
export function CompanyControlsCard({ orgId }: { orgId: string }) {
  const [gstin, setGstin] = useState("");
  const [savedGstin, setSavedGstin] = useState("");
  const [requireApproval, setRequireApproval] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!orgId) return;
    organisationsApi
      .get(orgId)
      .then((res) => {
        const org = res.data?.[0];
        setGstin(org?.gstin ?? "");
        setSavedGstin(org?.gstin ?? "");
        setRequireApproval(org?.require_journal_approval ?? false);
      })
      .catch((e) => setMessage({ ok: false, text: e.message }));
  }, [orgId]);

  const cleanGstin = gstin.trim().toUpperCase();
  const gstinError = cleanGstin && !isValidGstin(cleanGstin) ? "This GSTIN is not valid (check the 15 characters)." : null;

  const save = async (payload: { gstin?: string; require_journal_approval?: boolean }, done: string) => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await organisationsApi.updateSettings(orgId, payload);
      const org = res.data?.[0];
      setSavedGstin(org?.gstin ?? "");
      setRequireApproval(org?.require_journal_approval ?? false);
      setMessage({ ok: true, text: done });
    } catch (e) {
      setMessage({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-surface border border-line-strong rounded-lg p-5 shadow-xs space-y-4">
      <div className="flex items-center gap-2 border-b border-line pb-3">
        <Building2 className="h-4 w-4 text-ink-soft" />
        <h3 className="text-sm font-bold uppercase text-ink font-mono">Company Controls</h3>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="company-gstin" className="block font-semibold text-ink-soft">
            Company GSTIN
          </label>
          <Input
            id="company-gstin"
            value={gstin}
            onChange={(e) => setGstin(e.target.value)}
            placeholder="15-character GSTIN, blank if unregistered"
            maxLength={15}
            className="font-mono uppercase"
          />
          {gstinError && <p className="text-rose-700">{gstinError}</p>}
          <p className="text-ink-muted">Printed on invoices and used to build GSTR-1 and GSTR-3B.</p>
          <Button
            size="sm"
            disabled={busy || !!gstinError || cleanGstin === savedGstin}
            onClick={() => save({ gstin: cleanGstin }, "GSTIN saved.")}
          >
            Save GSTIN
          </Button>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 font-semibold text-ink-soft">
            <ShieldCheck className="h-4 w-4" /> Maker-checker approvals
          </div>
          <p className="text-ink-muted">
            When on, a voucher reaches the ledger only after a second person (owner, CFO or admin) approves it.
            Nobody can approve their own voucher.
          </p>
          <label className="inline-flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              role="switch"
              checked={requireApproval}
              disabled={busy}
              onChange={(e) =>
                save(
                  { require_journal_approval: e.target.checked },
                  e.target.checked ? "Approvals turned on." : "Approvals turned off."
                )
              }
              className="h-4 w-4 accent-brand"
            />
            <span className="font-semibold">{requireApproval ? "On" : "Off"}</span>
          </label>
        </div>
      </div>

      {message && (
        <p role={message.ok ? "status" : "alert"} className={message.ok ? "text-emerald-700" : "text-rose-700"}>
          {message.text}
        </p>
      )}
    </div>
  );
}
