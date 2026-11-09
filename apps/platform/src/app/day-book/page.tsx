"use client";

import React from "react";
import { AppShell } from "@/layouts/AppShell";
import { WorkspaceLayout } from "@/layouts/WorkspaceLayout";
import { DayBookView } from "@/modules/day-book/DayBookView";
import { Badge } from "@/components/ui/Badge";

export default function DayBookPage() {
  return (
    <AppShell>
      <WorkspaceLayout
        title="Day Book"
        subtitle="Chronological register of daily financial transactions from source documents (invoices, receipts, vouchers) before totals are posted to the ledger"
        badge={<Badge variant="teal">Book of Prime Entry</Badge>}
        breadcrumbs={[
          { label: "Transactions" },
          { label: "Day Book", href: "/day-book" },
        ]}
      >
        <DayBookView />
      </WorkspaceLayout>
    </AppShell>
  );
}
