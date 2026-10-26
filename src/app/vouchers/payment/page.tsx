"use client";

import React, { Suspense } from "react";
import { AppShell } from "@/layouts/AppShell";
import { WorkspaceLayout } from "@/layouts/WorkspaceLayout";
import { VoucherWorkspace } from "@/modules/vouchers/VoucherWorkspace";
import { Badge } from "@/components/ui/Badge";

export default function PaymentVoucherPage() {
  return (
    <AppShell>
      <WorkspaceLayout
        title="Payment Voucher"
        subtitle="Record payments made from Cash or Bank accounts to Vendors, Creditors or Expense Ledgers"
        badge={<Badge variant="teal">F5: Payment</Badge>}
        breadcrumbs={[
          { label: "Transactions" },
          { label: "Vouchers", href: "/vouchers" },
          { label: "Payment (F5)", href: "/vouchers/payment" },
        ]}
      >
        <Suspense
          fallback={
            <div className="p-6 text-xs font-mono text-slate-500">
              Loading payment voucher desk...
            </div>
          }
        >
          <VoucherWorkspace initialMode="payment" />
        </Suspense>
      </WorkspaceLayout>
    </AppShell>
  );
}
