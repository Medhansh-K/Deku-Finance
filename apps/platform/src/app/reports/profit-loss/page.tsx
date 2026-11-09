"use client";

import React from "react";
import { AppShell } from "@/layouts/AppShell";
import { WorkspaceLayout } from "@/layouts/WorkspaceLayout";
import { ProfitLossView } from "@/modules/financial-reports/profit-loss/ProfitLossView";
import { Badge } from "@/components/ui/Badge";

export default function ProfitLossPage() {
  return (
    <AppShell>
      <WorkspaceLayout
        title="Profit & Loss Account"
        subtitle="Real-time financial statement of operating revenue, direct costs and net profit"
        badge={<Badge variant="teal">Authoritative Statement</Badge>}
        breadcrumbs={[
          { label: "Reports" },
          { label: "Profit & Loss", href: "/reports/profit-loss" },
        ]}
      >
        <ProfitLossView />
      </WorkspaceLayout>
    </AppShell>
  );
}
