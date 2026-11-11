"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { kycApi, integrationErrorText, TRUST_LABELS, type KycStatus } from "@/api/integrations";
import { SandboxBanner } from "@/modules/integrations/SandboxBanner";

export const KYC_SHARED_TEXT =
  "Shared with the provider: only the identifier being checked (PAN and the name you type, Udyam number or GSTIN), or, for DigiLocker / EntityLocker, the consent you give on their site. Deku keeps the result and the provider's reference, never Aadhaar numbers or document images.";

/** Identity checks: status and trust level here, the forms on /kyc. */
export function KycCard({ orgId }: { orgId: string }) {
  const [status, setStatus] = useState<KycStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orgId) return;
    kycApi
      .status(orgId)
      .then((r) => setStatus(r.data))
      .catch((e) => setError(integrationErrorText(e)));
  }, [orgId]);

  const level = status?.trust?.trust_level ?? 0;

  return (
    <section aria-labelledby="kyc-card-title" className="bg-surface border border-line rounded-panel p-5 space-y-3">
      <div className="flex items-center justify-between gap-2 border-b border-line pb-3">
        <div className="flex items-center gap-2">
          <BadgeCheck className="h-4 w-4 text-ink-soft" aria-hidden />
          <h3 id="kyc-card-title" className="text-[15px] font-semibold tracking-tight text-ink">Identity (KYC)</h3>
        </div>
        <Badge variant={status?.configured ? (level > 0 ? "success" : "default") : "outline"}>
          {status?.configured ? TRUST_LABELS[level].label : "Not available"}
        </Badge>
      </div>
      {status?.sandbox && <SandboxBanner what="KYC" />}
      <p className="text-ink-muted">Optional. {KYC_SHARED_TEXT}</p>
      {status && !status.configured && (
        <p className="rounded-ctl bg-canvas px-4 py-3 text-ink-soft">
          No KYC provider is configured on this server (KYC_PROVIDER is unset), so no checks can run.
        </p>
      )}
      {error && <p role="alert" className="text-bad">{error}</p>}
      <Link href="/kyc" className="inline-block text-[13px] font-medium text-brand-strong hover:text-ink">
        Open the KYC hub
      </Link>
    </section>
  );
}
