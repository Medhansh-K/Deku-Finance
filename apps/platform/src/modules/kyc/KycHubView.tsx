"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/context/AuthContext";
import {
  integrationErrorText,
  kycApi,
  latestByMethod,
  TRUST_LABELS,
  type KycMethod,
  type KycStatus,
  type KycVerification,
} from "@/api/integrations";
import { SandboxBanner } from "@/modules/integrations/SandboxBanner";
import { KYC_SHARED_TEXT } from "@/modules/settings/KycCard";

const PENDING_KEY = "deku_kyc_pending_id";

const METHOD_LABELS: Record<KycMethod, string> = {
  pan: "PAN",
  udyam: "Udyam registration",
  gstin: "GSTIN",
  digilocker: "DigiLocker",
  entitylocker: "EntityLocker",
};

const STATUS_BADGE: Record<KycVerification["status"], "success" | "warning" | "danger" | "default"> = {
  verified: "success",
  pending: "warning",
  failed: "danger",
  expired: "default",
};

const isExpired = (row: KycVerification) =>
  row.status === "verified" && !!row.expires_at && new Date(row.expires_at).getTime() <= Date.now();

function MethodStatus({ row }: { row?: KycVerification }) {
  if (!row) return <Badge variant="outline">Not checked</Badge>;
  const expired = isExpired(row);
  return (
    <span className="flex flex-wrap items-center gap-2">
      <Badge variant={expired ? "default" : STATUS_BADGE[row.status]}>{expired ? "expired" : row.status}</Badge>
      {row.provider === "sandbox" && <Badge variant="warning">SANDBOX</Badge>}
      {row.verified_name && <span className="text-xs text-ink-soft">{row.verified_name}</span>}
      {row.verified_at && <span className="text-xs text-ink-muted">{new Date(row.verified_at).toLocaleDateString("en-IN")}</span>}
      {row.failure_reason && <span className="text-xs text-rose-700">{row.failure_reason}</span>}
    </span>
  );
}

export function KycHubView() {
  const { user } = useAuth();
  const [orgId] = useState(() => {
    try {
      return typeof window === "undefined" ? "" : localStorage.getItem("deku_active_org_id") ?? "";
    } catch {
      return "";
    }
  });
  const [status, setStatus] = useState<KycStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [bizPan, setBizPan] = useState("");
  const [udyam, setUdyam] = useState("");
  const [myPan, setMyPan] = useState("");
  const [myName, setMyName] = useState("");

  const load = useCallback(
    () =>
      kycApi
        .status(orgId)
        .then((r) => setStatus(r.data))
        .catch((e) => setMessage({ ok: false, text: integrationErrorText(e) })),
    [orgId],
  );

  const run = useCallback(
    async (action: () => Promise<unknown>, done: string) => {
      setBusy(true);
      setMessage(null);
      try {
        await action();
        setMessage({ ok: true, text: done });
      } catch (e) {
        setMessage({ ok: false, text: integrationErrorText(e) });
      } finally {
        setBusy(false);
        await load();
      }
    },
    [load],
  );

  useEffect(() => {
    if (!orgId) return;
    load();
    // Back from DigiLocker / EntityLocker consent: finish the pending request once.
    const code = new URLSearchParams(window.location.search).get("code");
    let pending: string | null = null;
    try {
      pending = sessionStorage.getItem(PENDING_KEY);
      sessionStorage.removeItem(PENDING_KEY);
    } catch {
      pending = null;
    }
    if (code && pending) {
      window.history.replaceState(null, "", "/kyc");
      kycApi
        .completeDigilocker(orgId, pending, code)
        .then(() => setMessage({ ok: true, text: "Consent recorded." }))
        .catch((e) => setMessage({ ok: false, text: integrationErrorText(e) }))
        .finally(load);
    }
  }, [orgId, load]);

  const startConsent = (subject: "person" | "business") =>
    run(async () => {
      const r = await kycApi.startDigilocker(orgId, subject);
      try {
        sessionStorage.setItem(PENDING_KEY, r.data.id);
      } catch {
        throw new Error("This browser blocks session storage, which the consent flow needs.");
      }
      window.location.assign(r.data.authorize_url);
    }, "Opening the consent page…");

  const rows = status?.verifications ?? [];
  const business = latestByMethod(rows, "business");
  const mine = latestByMethod(rows, "person", user?.id);
  const level = status?.trust?.trust_level ?? 0;
  const off = !status?.configured;

  return (
    <div className="mx-auto max-w-4xl space-y-5 text-sm">
      {status?.sandbox && <SandboxBanner what="KYC" />}

      <section aria-labelledby="trust-title" className="rounded-xl border border-line bg-surface p-5 shadow-card space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h2 id="trust-title" className="text-base font-semibold text-ink">Trust level</h2>
          <Badge variant={level > 0 ? "success" : "default"}>
            Level {level}: {TRUST_LABELS[level].label}
          </Badge>
        </div>
        <p className="text-ink-muted">{TRUST_LABELS[level].detail} Sandbox checks never count.</p>
        <p className="text-xs text-ink-muted">{KYC_SHARED_TEXT}</p>
        {status && off && (
          <p className="rounded border border-line bg-canvas p-3 text-ink-soft">
            No KYC provider is configured on this server (KYC_PROVIDER is unset). Checks below are disabled until one is.
          </p>
        )}
      </section>

      <section aria-labelledby="biz-title" className="rounded-xl border border-line bg-surface p-5 shadow-card space-y-4">
        <h2 id="biz-title" className="text-base font-semibold text-ink">Business</h2>
        <p className="text-xs text-ink-muted">Owners, CFOs and admins can run these.</p>
        <ul className="divide-y divide-line">
          <li className="flex flex-wrap items-end justify-between gap-3 py-3">
            <div className="space-y-1">
              <p className="font-medium text-ink">{METHOD_LABELS.gstin}</p>
              <MethodStatus row={business.gstin} />
            </div>
            <Button size="sm" variant="secondary" disabled={off || busy} onClick={() => run(() => kycApi.verifyGstin(orgId), "GSTIN checked.")}>
              Check company GSTIN
            </Button>
          </li>
          <li className="flex flex-wrap items-end justify-between gap-3 py-3">
            <div className="space-y-1">
              <p className="font-medium text-ink">{METHOD_LABELS.pan}</p>
              <MethodStatus row={business.pan} />
            </div>
            <div className="flex items-end gap-2">
              <div className="w-40">
                <Input label="Company PAN" id="kyc-biz-pan" maxLength={10} value={bizPan} onChange={(e) => setBizPan(e.target.value.toUpperCase())} />
              </div>
              <Button size="sm" variant="secondary" disabled={off || busy || bizPan.length !== 10} onClick={() => run(() => kycApi.verifyPan(orgId, "business", bizPan), "PAN checked.")}>
                Check
              </Button>
            </div>
          </li>
          <li className="flex flex-wrap items-end justify-between gap-3 py-3">
            <div className="space-y-1">
              <p className="font-medium text-ink">{METHOD_LABELS.udyam}</p>
              <MethodStatus row={business.udyam} />
            </div>
            <div className="flex items-end gap-2">
              <div className="w-56">
                <Input label="Udyam number" id="kyc-udyam" placeholder="UDYAM-MH-01-0000001" value={udyam} onChange={(e) => setUdyam(e.target.value.toUpperCase())} />
              </div>
              <Button size="sm" variant="secondary" disabled={off || busy || !udyam.trim()} onClick={() => run(() => kycApi.verifyUdyam(orgId, udyam.trim()), "Udyam checked.")}>
                Check
              </Button>
            </div>
          </li>
          <li className="flex flex-wrap items-end justify-between gap-3 py-3">
            <div className="space-y-1">
              <p className="font-medium text-ink">{METHOD_LABELS.entitylocker}</p>
              <MethodStatus row={business.entitylocker} />
            </div>
            <Button size="sm" variant="secondary" disabled={off || busy} onClick={() => startConsent("business")}>
              Connect EntityLocker
            </Button>
          </li>
        </ul>
      </section>

      <section aria-labelledby="me-title" className="rounded-xl border border-line bg-surface p-5 shadow-card space-y-4">
        <h2 id="me-title" className="text-base font-semibold text-ink">You{user?.full_name ? ` (${user.full_name})` : ""}</h2>
        <ul className="divide-y divide-line">
          <li className="flex flex-wrap items-end justify-between gap-3 py-3">
            <div className="space-y-1">
              <p className="font-medium text-ink">{METHOD_LABELS.pan}</p>
              <MethodStatus row={mine.pan} />
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div className="w-40">
                <Input label="Your PAN" id="kyc-my-pan" maxLength={10} value={myPan} onChange={(e) => setMyPan(e.target.value.toUpperCase())} />
              </div>
              <div className="w-48">
                <Input label="Name as on PAN" id="kyc-my-name" value={myName} onChange={(e) => setMyName(e.target.value)} />
              </div>
              <Button size="sm" variant="secondary" disabled={off || busy || myPan.length !== 10} onClick={() => run(() => kycApi.verifyPan(orgId, "person", myPan, myName.trim() || undefined), "PAN checked.")}>
                Check
              </Button>
            </div>
          </li>
          <li className="flex flex-wrap items-end justify-between gap-3 py-3">
            <div className="space-y-1">
              <p className="font-medium text-ink">{METHOD_LABELS.digilocker}</p>
              <MethodStatus row={mine.digilocker} />
            </div>
            <Button size="sm" variant="secondary" disabled={off || busy} onClick={() => startConsent("person")}>
              Connect DigiLocker
            </Button>
          </li>
        </ul>
      </section>

      {message && (
        <p role={message.ok ? "status" : "alert"} className={message.ok ? "text-emerald-700" : "text-rose-700"}>
          {message.text}
        </p>
      )}
    </div>
  );
}
