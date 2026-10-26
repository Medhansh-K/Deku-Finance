"use client";

import React, { Suspense } from "react";
import { AppShell } from "@/layouts/AppShell";
import { WorkspaceLayout } from "@/layouts/WorkspaceLayout";
import { VoucherWorkspace } from "@/modules/vouchers/VoucherWorkspace";
import { Badge } from "@/components/ui/Badge";

export default function PurchaseVoucherPage() {
  return (
    <AppShell>
      <WorkspaceLayout
        title="Purchase Voucher"
        subtitle="Record inward purchases, inventory delivery, and supplier payable credits"
        badge={<Badge variant="teal">F9: Purchase</Badge>}
        breadcrumbs={[
          { label: "Transactions" },
          { label: "Vouchers", href: "/vouchers" },
          { label: "Purchase (F9)", href: "/vouchers/purchase" },
        ]}
      >
        <Suspense
          fallback={
            <div className="p-6 text-xs font-mono text-slate-500">
              Loading purchase voucher desk...
            </div>
          }
        >
          <VoucherWorkspace initialMode="purchase" />
        </Suspense>
      </WorkspaceLayout>
    </AppShell>
  );
}
