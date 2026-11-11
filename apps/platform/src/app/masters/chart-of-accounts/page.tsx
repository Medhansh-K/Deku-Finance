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
        title="Chart of accounts"
        subtitle="Four-level ledger hierarchy: assets, liabilities, equity, revenue and expense"
        badge={<Badge variant="teal">ALERX hierarchy</Badge>}
        breadcrumbs={[
          { label: "Masters" },
          { label: "Chart of accounts", href: "/masters/chart-of-accounts" },
        ]}
      >
        <Suspense fallback={<div className="p-8 text-center text-[13.5px] text-ink-muted">Loading chart of accounts…</div>}>
          <ChartOfAccountsView />
        </Suspense>
      </WorkspaceLayout>
    </AppShell>
  );
}
