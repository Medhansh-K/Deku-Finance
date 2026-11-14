"use client";

import React, { useEffect, useState } from "react";
import { Lock, Calendar, AlertOctagon, CheckCircle2, Clock } from "lucide-react";
import { organisationsApi, accountingApi } from "@/api/endpoints";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { formatDateTally } from "@/lib/formatters/date";

interface AccountingControlsCardProps {
  orgId: string;
}

export function AccountingControlsCard({ orgId }: { orgId: string }) {
  const [frozenDate, setFrozenDate] = useState<string>("");
  const [savedFrozenDate, setSavedFrozenDate] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!orgId) return;
    organisationsApi
      .get(orgId)
      .then((res) => {
        const dateVal = (res.data?.[0] as any)?.frozen_accounting_date ?? null;
        setSavedFrozenDate(dateVal);
        if (dateVal) setFrozenDate(dateVal);
      })
      .catch((e) => setMessage({ ok: false, text: e.message }));
  }, [orgId]);

  const handleSaveFrozenDate = async (clear = false) => {
    setBusy(true);
    setMessage(null);
    try {
      const nextDate = clear ? null : (frozenDate || null);
      await organisationsApi.updateSettings(orgId, {
        frozen_accounting_date: nextDate,
      } as any);
      setSavedFrozenDate(nextDate);
      if (clear) setFrozenDate("");
      setMessage({
        ok: true,
        text: clear
          ? "Accounting date lockout removed."
          : `Hard lockout active. Transactions on or before ${nextDate} cannot be entered, altered, or deleted.`,
      });
    } catch (e: any) {
      setMessage({ ok: false, text: e.message || "Failed to update frozen date" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-tour="settings-frozen-date" className="bg-surface border border-line rounded-panel p-5 space-y-4">
      <div className="flex items-center justify-between gap-2 border-b border-line pb-3">
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-brand-strong" />
          <h3 className="text-[15px] font-semibold tracking-tight text-ink">
            Frozen Accounting Dates &amp; Statutory Lockouts
          </h3>
        </div>
        {savedFrozenDate ? (
          <Badge variant="warning">
            <Clock className="h-3 w-3 mr-1 inline" />
            Locked through {formatDateTally(savedFrozenDate)}
          </Badge>
        ) : (
          <Badge variant="outline">No date lock</Badge>
        )}
      </div>

      <p className="text-[13px] text-ink-muted leading-relaxed">
        Statutory pre-closing lockout enforced by database kernel triggers. When a frozen date is set, no user
        (including administrators) can post, backdate, edit, or reverse journal entries or vouchers on or before this
        date. This ensures audit compliance under the Companies (Accounts) Rules.
      </p>

      <div className="flex flex-wrap items-end gap-3 pt-1">
        <div className="w-52">
          <Input
            label="Lock entries on or before"
            type="date"
            value={frozenDate}
            onChange={(e) => setFrozenDate(e.target.value)}
          />
        </div>
        <Button
          type="button"
          variant="tally"
          size="sm"
          isLoading={busy}
          disabled={!frozenDate || frozenDate === savedFrozenDate}
          onClick={() => handleSaveFrozenDate(false)}
        >
          Enforce Lockout
        </Button>
        {savedFrozenDate && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => handleSaveFrozenDate(true)}
          >
            Clear lockout
          </Button>
        )}
      </div>

      {message && (
        <p role={message.ok ? "status" : "alert"} className={`text-[13px] ${message.ok ? "text-ok" : "text-bad"}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}
