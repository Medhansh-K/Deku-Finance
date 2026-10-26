"use client";

import React, { Suspense } from "react";
import { AppShell } from "@/layouts/AppShell";
import { WorkspaceLayout } from "@/layouts/WorkspaceLayout";
import { VoucherWorkspace } from "@/modules/vouchers/VoucherWorkspace";
import { Badge } from "@/components/ui/Badge";

export default function JournalVoucherPage() {
  return (
    <AppShell>
      <WorkspaceLayout
        title="Journal Voucher"
        subtitle="Record non-cash accounting adjustments, depreciation, prepaid expenses, and accruals"
        badge={<Badge variant="teal">F7: Journal</Badge>}
        breadcrumbs={[
          { label: "Transactions" },
          { label: "Vouchers", href: "/vouchers" },
          { label: "Journal (F7)", href: "/vouchers/journal" },
        ]}
      >
        <Suspense
          fallback={
            <div className="p-6 text-xs font-mono text-slate-500">
              Loading journal voucher desk...
            </div>
          }
        >
          <VoucherWorkspace initialMode="journal" />
        </Suspense>
      </WorkspaceLayout>
    </AppShell>
  );
}
