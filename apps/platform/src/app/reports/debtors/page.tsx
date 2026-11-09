"use client";

import React from "react";
import { AppShell } from "@/layouts/AppShell";
import { WorkspaceLayout } from "@/layouts/WorkspaceLayout";
import { DebtorsDsoView } from "@/modules/financial-reports/debtors/DebtorsDsoView";
import { Badge } from "@/components/ui/Badge";

export default function DebtorsPage() {
  return (
    <AppShell>
      <WorkspaceLayout
        title="Trade Debtors (AR) & DSO Tracking"
        subtitle="Accounts receivable aging analysis, customer exposure, outstanding invoices, and collection velocity"
        badge={<Badge variant="teal">DSO Core Engine</Badge>}
        breadcrumbs={[
          { label: "Reports" },
          { label: "Trade Debtors (DSO)", href: "/reports/debtors" },
        ]}
      >
        <DebtorsDsoView />
      </WorkspaceLayout>
    </AppShell>
  );
}
