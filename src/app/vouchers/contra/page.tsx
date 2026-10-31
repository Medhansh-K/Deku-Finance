"use client";

import React, { Suspense } from "react";
import { AppShell } from "@/layouts/AppShell";
import { WorkspaceLayout } from "@/layouts/WorkspaceLayout";
import { VoucherWorkspace } from "@/modules/vouchers/VoucherWorkspace";
import { Badge } from "@/components/ui/Badge";

export default function ContraVoucherPage() {
  return (
    <AppShell>
      <WorkspaceLayout
        title="Contra Voucher"
        subtitle="Record internal liquid capital transfers: Bank to Cash, Cash to Bank, or Inter-Bank allocations"
        badge={<Badge variant="teal">F4: Contra</Badge>}
        breadcrumbs={[
          { label: "Transactions" },
          { label: "Vouchers", href: "/vouchers" },
          { label: "Contra (F4)", href: "/vouchers/contra" },
        ]}
      >
        <Suspense
          fallback={
            <div className="p-6 text-xs font-mono text-ink-muted">
              Loading contra voucher desk...
            </div>
          }
        >
          <VoucherWorkspace initialMode="contra" />
        </Suspense>
      </WorkspaceLayout>
    </AppShell>
  );
}
