"use client";

import React, { useEffect, useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { gstApi, type GstReturnType } from "@/api/endpoints";
import { gspApi, integrationErrorText, type GspStatus } from "@/api/integrations";
import { SandboxBanner } from "./SandboxBanner";

/** Why direct filing is unavailable, or null when it can be used. */
export function directFilingBlocker(status: GspStatus | null): string | null {
  if (!status) return "Checking the GST portal connection…";
  if (!status.configured) return status.reason ?? "No GST Suvidha Provider is configured on this server.";
  if (status.connection?.status !== "connected") return "Connect the GST portal in Settings first.";
  const exp = status.connection.session_expires_at;
  if (exp && new Date(exp).getTime() <= Date.now()) return "The GST portal session expired. Verify a new OTP in Settings.";
  return null;
}

const RETURNS: { type: GstReturnType; label: string }[] = [
  { type: "gstr1", label: "GSTR-1" },
  { type: "gstr3b", label: "GSTR-3B" },
];

/** "File directly" next to the JSON downloads: records the return, then files it with EVC through the GSP. */
export function DirectFiling({ orgId, retPeriod, canFile }: { orgId: string; retPeriod: string; canFile: Record<GstReturnType, boolean> }) {
  const [status, setStatus] = useState<GspStatus | null>(null);
  const [pan, setPan] = useState("");
  const [otp, setOtp] = useState("");
  const [type, setType] = useState<GstReturnType>("gstr1");
  const label = RETURNS.find((r) => r.type === type)!.label;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!orgId) return;
    gspApi
      .status(orgId)
      .then((r) => setStatus(r.data))
      .catch((e) => setStatus({ configured: false, reason: integrationErrorText(e), provider: null, sandbox: false, connection: null }));
  }, [orgId]);

  const blocker = directFilingBlocker(status);

  const run = async (action: () => Promise<string>) => {
    setBusy(true);
    setMessage(null);
    try {
      setMessage({ ok: true, text: await action() });
    } catch (e) {
      setMessage({ ok: false, text: integrationErrorText(e) });
    } finally {
      setBusy(false);
    }
  };

  const file = (type: GstReturnType, label: string) =>
    run(async () => {
      // Files exactly what the server recomputes and freezes now, not what this page shows.
      await gstApi.record(orgId, retPeriod, type);
      const res = await gspApi.file(orgId, retPeriod, type, pan.trim(), otp);
      return `${label} filed. ARN ${res.data.arn}.`;
    });

  return (
    <div className="space-y-3 rounded-lg border border-line p-3">
      <h3 className="text-sm font-semibold text-ink">File directly</h3>
      {status?.sandbox && <SandboxBanner what="GSP" />}
      {blocker ? (
        <>
          <div className="flex flex-wrap gap-2">
            {RETURNS.map((r) => (
              <Button key={r.type} size="sm" disabled aria-describedby="direct-filing-reason">
                <Send className="h-4 w-4" aria-hidden /> File {r.label} directly
              </Button>
            ))}
          </div>
          <p id="direct-filing-reason" className="text-xs text-ink-muted">
            {blocker}
          </p>
        </>
      ) : (
        <>
          <p className="text-xs text-ink-muted">
            Filing is final. The return is recorded as computed now, then submitted and filed with EVC by the authorised
            signatory.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-xs font-medium text-ink-soft">
              Return
              <select
                value={type}
                onChange={(e) => setType(e.target.value as GstReturnType)}
                className="h-9 rounded-md border border-line-strong bg-surface px-2 text-sm text-ink"
              >
                {RETURNS.map((r) => (
                  <option key={r.type} value={r.type} disabled={!canFile[r.type]}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="w-44">
              <Input label="Signatory PAN" id="evc-pan" value={pan} maxLength={10} onChange={(e) => setPan(e.target.value.toUpperCase())} />
            </div>
            <Button
              size="sm"
              variant="secondary"
              disabled={busy || pan.trim().length !== 10}
              onClick={() =>
                run(async () => {
                  await gspApi.requestEvcOtp(orgId, retPeriod, type, pan.trim());
                  return `EVC OTP for ${label} sent to the signatory's registered mobile and email.`;
                })
              }
            >
              Send EVC OTP
            </Button>
            <div className="w-32">
              <Input label="EVC OTP" id="evc-otp" inputMode="numeric" maxLength={6} value={otp} autoComplete="one-time-code" onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} />
            </div>
            <Button size="sm" disabled={busy || !canFile[type] || pan.trim().length !== 10 || otp.length !== 6} onClick={() => file(type, label)}>
              <Send className="h-4 w-4" aria-hidden /> File {label} directly
            </Button>
          </div>
        </>
      )}
      {message && (
        <p role="status" className={`text-xs ${message.ok ? "text-emerald-800" : "text-rose-800"}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}
