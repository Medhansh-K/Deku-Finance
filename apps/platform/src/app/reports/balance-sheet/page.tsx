"use client";

import React from "react";
import { AppShell } from "@/layouts/AppShell";
import { WorkspaceLayout } from "@/layouts/WorkspaceLayout";
import { BalanceSheetView } from "@/modules/financial-reports/balance-sheet/BalanceSheetView";
import { Badge } from "@/components/ui/Badge";

export default function BalanceSheetPage() {
  return (
    <AppShell>
      <WorkspaceLayout
        title="Balance Sheet"
        subtitle="Statement of Financial Position: Assets, Liabilities, and Equity Capital Parity"
        badge={<Badge variant="teal">Authoritative Statement</Badge>}
        breadcrumbs={[
          { label: "Reports" },
          { label: "Balance Sheet", href: "/reports/balance-sheet" },
        ]}
      >
        <BalanceSheetView />
      </WorkspaceLayout>
    </AppShell>
  );
}
