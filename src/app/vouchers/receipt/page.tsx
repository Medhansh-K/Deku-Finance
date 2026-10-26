"use client";

import React, { Suspense } from "react";
import { AppShell } from "@/layouts/AppShell";
import { WorkspaceLayout } from "@/layouts/WorkspaceLayout";
import { VoucherWorkspace } from "@/modules/vouchers/VoucherWorkspace";
import { Badge } from "@/components/ui/Badge";

export default function ReceiptVoucherPage() {
  return (
    <AppShell>
      <WorkspaceLayout
        title="Receipt Voucher"
        subtitle="Record funds received into Cash or Bank accounts from Customers, Debtors, or Capital Inflows"
        badge={<Badge variant="teal">F6: Receipt</Badge>}
        breadcrumbs={[
          { label: "Transactions" },
          { label: "Vouchers", href: "/vouchers" },
          { label: "Receipt (F6)", href: "/vouchers/receipt" },
        ]}
      >
        <Suspense
          fallback={
            <div className="p-6 text-xs font-mono text-slate-500">
              Loading receipt voucher desk...
            </div>
          }
        >
          <VoucherWorkspace initialMode="receipt" />
        </Suspense>
      </WorkspaceLayout>
    </AppShell>
  );
}
