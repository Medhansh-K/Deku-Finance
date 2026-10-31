"use client";

import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/layouts/AppShell";
import { WorkspaceLayout } from "@/layouts/WorkspaceLayout";
import { VoucherWorkspace, VoucherMode } from "@/modules/vouchers/VoucherWorkspace";
import { Badge } from "@/components/ui/Badge";

function VoucherContent() {
  const searchParams = useSearchParams();
  const rawType = searchParams.get("type");

  const validModes: VoucherMode[] = [
    "contra",
    "payment",
    "receipt",
    "journal",
    "sales",
    "purchase",
  ];

  const initialMode: VoucherMode = validModes.includes(rawType as VoucherMode)
    ? (rawType as VoucherMode)
    : "payment";

  return <VoucherWorkspace initialMode={initialMode} />;
}

export default function CommonVouchersPage() {
  return (
    <AppShell>
      <WorkspaceLayout
        title="Accounting Vouchers"
        subtitle="Unified double-entry transaction desk with direct document auto-extraction & ALERX parity"
        badge={<Badge variant="teal">Voucher Desk • F4—F9</Badge>}
        breadcrumbs={[
          { label: "Transactions" },
          { label: "Vouchers", href: "/vouchers" },
        ]}
      >
        <Suspense
          fallback={
            <div className="p-6 text-xs font-mono text-ink-muted">
              Loading accounting voucher desk...
            </div>
          }
        >
          <VoucherContent />
        </Suspense>
      </WorkspaceLayout>
    </AppShell>
  );
}
