"use client";

import React, { Suspense } from "react";
import { AppShell } from "@/layouts/AppShell";
import { WorkspaceLayout } from "@/layouts/WorkspaceLayout";
import { ChartOfAccountsView } from "@/modules/masters/chart-of-accounts/ChartOfAccountsView";
import { Badge } from "@/components/ui/Badge";

export default function ChartOfAccountsPage() {
  return (
    <AppShell>
      <WorkspaceLayout
        title="Chart of Accounts"
        subtitle="ALERX 4-Tier Hierarchical Ledger Architecture (Assets, Liabilities, Equity, Revenue, Expense)"
        badge={<Badge variant="teal">ALERX Hierarchical</Badge>}
        breadcrumbs={[
          { label: "Masters" },
          { label: "Chart of Accounts", href: "/masters/chart-of-accounts" },
        ]}
      >
        <Suspense fallback={<div className="p-8 text-center text-xs font-mono text-slate-400">Loading Chart of Accounts...</div>}>
          <ChartOfAccountsView />
        </Suspense>
      </WorkspaceLayout>
    </AppShell>
  );
}
