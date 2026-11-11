"use client";

import React from "react";
import { useAuth } from "@/context/AuthContext";
import { ShieldCheck, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { GSTR1_NOT_COVERED, GSTR3B_NOT_COVERED } from "@/lib/gst/returns";
import { useReturnPeriod } from "@/lib/gst/period";
import { useReturnBooks } from "@/lib/gst/useReturnBooks";
import { downloadJson } from "@/lib/download";
import { ReturnCard } from "@/modules/gst/ReturnCard";
import { AppShell } from "@/layouts/AppShell";
import { WorkspaceLayout } from "@/layouts/WorkspaceLayout";
import { Table6Card } from "@/modules/gst/Table6Card";

export default function ReturnsHubPage() {
  const { operatingMode } = useAuth();
  const { month, setMonth, fy, retPeriod } = useReturnPeriod();
  const { orgId, gstin, loading, loadError, gstr1, gstr3b } = useReturnBooks(retPeriod);

  const isPure = operatingMode === "pure_accounting";

  return (
    <AppShell>
      <WorkspaceLayout
        title="GST returns: GSTR-1 & GSTR-3B"
        subtitle="Offline JSON built by the server from your issued sales invoices and purchase bills (or Input GST ledgers when no bills are registered). Exports stay locked until every check passes."
        breadcrumbs={[{ label: "GST", href: "/gst" }, { label: "Returns", href: "/gst/returns" }]}
        actions={
          <div className="w-44">
            <Input label={fy ? `Return period (FY ${fy})` : "Return period"} id="return-period" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </div>
        }
      >
    <div className="max-w-5xl mx-auto space-y-6 font-sans">
      {/* Section 22 Advisory if in Pure Accounting */}
      {isPure && (
        <div className="rounded-panel bg-ok-wash border border-ok/25 p-5 flex items-start gap-3.5 text-[13px] text-ok">
          <ShieldCheck className="h-5 w-5 text-ok shrink-0 mt-0.5" />
          <div className="space-y-1">
            <strong className="block text-ok text-[14px] font-semibold">
              Accounting-only mode, no GST registration
            </strong>
            <p className="text-ok leading-relaxed">
              This company is set to Pure Accounting, so Deku prepares no GST returns for it. That assumes it's under the Section 22 registration limit: ₹40 lakh for most goods suppliers, ₹20 lakh for services, and lower in some states. Check which limit applies to you.
            </p>
          </div>
        </div>
      )}

      {!orgId && <p className="text-[13px] text-ink-muted">Select a company first.</p>}
      {loading && <p className="text-[13px] text-ink-muted">Loading invoices and ledgers…</p>}
      {loadError && (
        <div className="p-4 rounded-panel bg-bad-wash border border-bad/25 text-[13px] text-bad flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-bad shrink-0" />
          <span className="font-medium">{loadError}. Nothing can be exported.</span>
        </div>
      )}

      {gstr1 && gstr3b && (
        <div className="grid grid-cols-1 gap-5">
          <ReturnCard
            title="GSTR-1"
            result={gstr1}
            notCovered={GSTR1_NOT_COVERED}
            onDownload={() => downloadJson(`GSTR1_${gstin}_${retPeriod}.json`, gstr1.json)}
          />
          <ReturnCard
            title="GSTR-3B"
            result={gstr3b}
            notCovered={GSTR3B_NOT_COVERED}
            onDownload={() => downloadJson(`GSTR3B_${gstin}_${retPeriod}.json`, gstr3b.json)}
          />
          <Table6Card table6={gstr3b.table6} />
        </div>
      )}
    </div>
      </WorkspaceLayout>
    </AppShell>
  );
}
