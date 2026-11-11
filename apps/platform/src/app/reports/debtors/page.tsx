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
        title="Trade debtors and DSO"
        subtitle="Accounts receivable ageing, customer exposure, outstanding invoices and collection speed"
        badge={<Badge variant="teal">Receivables</Badge>}
        breadcrumbs={[
          { label: "Reports" },
          { label: "Trade debtors (DSO)", href: "/reports/debtors" },
        ]}
      >
        <DebtorsDsoView />
      </WorkspaceLayout>
    </AppShell>
  );
}
