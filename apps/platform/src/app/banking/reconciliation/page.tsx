"use client";

import React from "react";
import { AppShell } from "@/layouts/AppShell";
import { WorkspaceLayout } from "@/layouts/WorkspaceLayout";
import { ReconciliationView } from "@/modules/banking/ReconciliationView";
import { Badge } from "@/components/ui/Badge";

export default function BankReconciliationPage() {
  return (
    <AppShell>
      <WorkspaceLayout
        title="Bank Reconciliation"
        subtitle="Match bank statement lines to vouchers already in the books"
        badge={<Badge variant="teal">Banking</Badge>}
        breadcrumbs={[
          { label: "Banking" },
          { label: "Reconciliation", href: "/banking/reconciliation" },
        ]}
      >
        <ReconciliationView />
      </WorkspaceLayout>
    </AppShell>
  );
}
