"use client";

import React from "react";
import { AppShell } from "@/layouts/AppShell";
import { WorkspaceLayout } from "@/layouts/WorkspaceLayout";
import { CreditorsDpoView } from "@/modules/financial-reports/creditors/CreditorsDpoView";
import { Badge } from "@/components/ui/Badge";

export default function CreditorsPage() {
  return (
    <AppShell>
      <WorkspaceLayout
        title="Trade Creditors (AP) & DPO Tracking"
        subtitle="Accounts payable tracking as per Days Payable Outstanding (DPO), vendor credit terms, and scheduled payouts"
        badge={<Badge variant="teal">DPO Core Engine</Badge>}
        breadcrumbs={[
          { label: "Reports" },
          { label: "Trade Creditors (DPO)", href: "/reports/creditors" },
        ]}
      >
        <CreditorsDpoView />
      </WorkspaceLayout>
    </AppShell>
  );
}
