"use client";

import React, { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { organisationsApi } from "@/api/endpoints";

/** The maker-checker switch. The GSTIN and the rest of the profile live in CompanyProfileCard. */
export function CompanyControlsCard({ orgId }: { orgId: string }) {
  const [requireApproval, setRequireApproval] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!orgId) return;
    organisationsApi
      .get(orgId)
      .then((res) => setRequireApproval(res.data?.[0]?.require_journal_approval ?? false))
      .catch((e) => setMessage({ ok: false, text: e.message }));
  }, [orgId]);

  const save = async (on: boolean) => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await organisationsApi.updateSettings(orgId, { require_journal_approval: on });
      setRequireApproval(res.data?.[0]?.require_journal_approval ?? false);
      setMessage({ ok: true, text: on ? "Approvals turned on." : "Approvals turned off." });
    } catch (e) {
      setMessage({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-surface border border-line-strong rounded-lg p-5 shadow-xs space-y-3">
      <div className="flex items-center gap-2 border-b border-line pb-3">
        <ShieldCheck className="h-4 w-4 text-ink-soft" />
        <h3 className="text-sm font-bold uppercase text-ink font-mono">Maker-checker approvals</h3>
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
          onChange={(e) => save(e.target.checked)}
          className="h-4 w-4 accent-brand"
        />
        <span className="font-semibold">{requireApproval ? "On" : "Off"}</span>
      </label>
      {message && (
        <p role={message.ok ? "status" : "alert"} className={message.ok ? "text-emerald-700" : "text-rose-700"}>
          {message.text}
        </p>
      )}
    </div>
  );
}
