"use client";

import React, { useEffect, useState } from "react";
import { Landmark } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { gspApi, integrationErrorText, type GspStatus } from "@/api/integrations";
import { SandboxBanner } from "@/modules/integrations/SandboxBanner";

const STATUS_BADGE = {
  connected: { variant: "success", label: "Connected" },
  otp_pending: { variant: "warning", label: "Waiting for OTP" },
  error: { variant: "danger", label: "Error" },
  disconnected: { variant: "default", label: "Not connected" },
} as const;

/** GST portal access through a GST Suvidha Provider: off unless the server configures one. */
export function GspCard({ orgId }: { orgId: string }) {
  const [status, setStatus] = useState<GspStatus | null>(null);
  const [username, setUsername] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const load = () =>
    gspApi
      .status(orgId)
      .then((r) => setStatus(r.data))
      .catch((e) => setMessage({ ok: false, text: integrationErrorText(e) }));

  useEffect(() => {
    if (orgId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  const run = async (action: () => Promise<unknown>, done: string) => {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      setMessage({ ok: true, text: done });
      await load();
    } catch (e) {
      setMessage({ ok: false, text: integrationErrorText(e) });
    } finally {
      setBusy(false);
    }
  };

  const conn = status?.connection ?? null;
  const badge = STATUS_BADGE[conn?.status ?? "disconnected"];
  const off = !status?.configured;

  return (
    <section aria-labelledby="gsp-card-title" className="bg-surface border border-line-strong rounded-lg p-5 shadow-xs space-y-3">
      <div className="flex items-center justify-between gap-2 border-b border-line pb-3">
        <div className="flex items-center gap-2">
          <Landmark className="h-4 w-4 text-ink-soft" aria-hidden />
          <h3 id="gsp-card-title" className="text-sm font-bold uppercase text-ink font-mono">GST portal (GSP)</h3>
        </div>
        <Badge variant={off ? "outline" : badge.variant}>{off ? "Not available" : badge.label}</Badge>
      </div>

      {status?.sandbox && <SandboxBanner what="GSP" />}

      <p className="text-ink-muted">
        Optional. When connected, Deku files GSTR-1 / GSTR-3B and generates e-invoice IRNs and e-way bills through a GST
        Suvidha Provider. <span className="font-semibold text-ink-soft">Shared with the provider:</span> your GSTIN and
        GST portal username, the OTP you enter, the return JSON shown in the filing wizard, and the invoice details
        (parties, items, amounts) of invoices you choose to register. Your portal password is never asked for. Deku stores
        the username and portal session encrypted, and logs each request (what and when, never the content).
      </p>

      {status && off && (
        <p className="rounded border border-line bg-canvas p-3 text-ink-soft">
          {status.reason ?? "Not configured on this server."} Until then, download the JSON from the filing wizard and
          upload it on gst.gov.in yourself.
        </p>
      )}

      {!off && conn?.status === "connected" && (
        <p className="text-ink-soft">
          Connected as GSTIN <span className="font-mono">{conn.gstin}</span>
          {conn.session_expires_at && <> until {new Date(conn.session_expires_at).toLocaleString("en-IN")}</>}.
        </p>
      )}
      {conn?.last_error && <p className="text-rose-700">Last error: {conn.last_error}</p>}

      {!off && (
        <div className="space-y-3">
          {(!conn || conn.status === "disconnected") && (
            <form
              className="flex flex-wrap items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                run(() => gspApi.connect(orgId, username.trim()), "Saved. Now request an OTP.");
              }}
            >
              <div className="w-64">
                <Input
                  label="GST portal username"
                  id="gsp-username"
                  value={username}
                  autoComplete="off"
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" size="sm" isLoading={busy} disabled={!username.trim()}>
                Save username
              </Button>
            </form>
          )}

          {conn && conn.status !== "connected" && (
            <div className="space-y-2">
              <p className="text-ink-muted">
                First enable API access on gst.gov.in (My Profile → Manage API Access). Then request an OTP; the portal
                sends it to the registered mobile number.
              </p>
              <div className="flex flex-wrap items-end gap-2">
                <Button size="sm" variant="secondary" disabled={busy} onClick={() => run(() => gspApi.startOtp(orgId), "OTP sent by the portal.")}>
                  Request OTP
                </Button>
                {conn.status === "otp_pending" && (
                  <>
                    <div className="w-36">
                      <Input
                        label="OTP"
                        id="gsp-otp"
                        inputMode="numeric"
                        maxLength={6}
                        value={otp}
                        autoComplete="one-time-code"
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                      />
                    </div>
                    <Button size="sm" disabled={busy || otp.length !== 6} onClick={() => run(() => gspApi.verifyOtp(orgId, otp), "Connected.")}>
                      Verify OTP
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {conn && conn.status !== "disconnected" && (
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(() => gspApi.disconnect(orgId), "Disconnected. Stored credentials were deleted.")}>
          Disconnect and delete stored credentials
        </Button>
      )}

      {message && (
        <p role={message.ok ? "status" : "alert"} className={message.ok ? "text-emerald-700" : "text-rose-700"}>
          {message.text}
        </p>
      )}
    </section>
  );
}
