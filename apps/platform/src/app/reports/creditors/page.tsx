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
        title="Trade creditors and DPO"
        subtitle="Accounts payable by days payable outstanding (DPO), vendor credit terms and scheduled payouts"
        badge={<Badge variant="teal">Payables</Badge>}
        breadcrumbs={[
          { label: "Reports" },
          { label: "Trade creditors (DPO)", href: "/reports/creditors" },
        ]}
      >
        <CreditorsDpoView />
      </WorkspaceLayout>
    </AppShell>
  );
}
