"use client";

import React, { Suspense } from "react";
import Link from "next/link";
import { AppShell } from "@/layouts/AppShell";
import { WorkspaceLayout } from "@/layouts/WorkspaceLayout";
import { VoucherWorkspace } from "@/modules/vouchers/VoucherWorkspace";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FileText, ArrowRight } from "lucide-react";

export default function SalesVoucherPage() {
  return (
    <AppShell>
      <WorkspaceLayout
        title="Sales voucher"
        subtitle="Record outward sales transactions and credit customer receivables"
        badge={<Badge variant="teal">F8: Sales</Badge>}
        actions={
          <Link href="/gst">
            <Button variant="outline" size="sm" className="gap-1.5">
              <FileText className="h-3.5 w-3.5 text-brand-strong" />
              GST invoicing hub <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        }
        breadcrumbs={[
          { label: "Transactions" },
          { label: "Vouchers", href: "/vouchers" },
          { label: "Sales (F8)", href: "/vouchers/sales" },
        ]}
      >
        <Suspense
          fallback={
            <div className="p-6 text-[13px] text-ink-muted">
              Loading sales voucher desk...
            </div>
          }
        >
          <VoucherWorkspace initialMode="sales" />
        </Suspense>
      </WorkspaceLayout>
    </AppShell>
  );
}
