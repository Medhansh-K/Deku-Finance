"use client";

import React from "react";
import { AppShell } from "@/layouts/AppShell";
import { WorkspaceLayout } from "@/layouts/WorkspaceLayout";
import { TrialBalanceView } from "@/modules/financial-reports/trial-balance/TrialBalanceView";
import { Badge } from "@/components/ui/Badge";

export default function TrialBalancePage() {
  return (
    <AppShell>
      <WorkspaceLayout
        title="Trial Balance"
        subtitle="Verification of debit and credit equilibrium across all ALERX chart of accounts"
        badge={<Badge variant="teal">Authoritative Statement</Badge>}
        breadcrumbs={[
          { label: "Reports" },
          { label: "Trial Balance", href: "/reports/trial-balance" },
        ]}
      >
        <TrialBalanceView />
      </WorkspaceLayout>
    </AppShell>
  );
}
