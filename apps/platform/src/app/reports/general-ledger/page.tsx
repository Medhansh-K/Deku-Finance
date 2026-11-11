"use client";

import React from "react";
import { AppShell } from "@/layouts/AppShell";
import { WorkspaceLayout } from "@/layouts/WorkspaceLayout";
import { GeneralLedgerView } from "@/modules/financial-reports/general-ledger/GeneralLedgerView";
import { Badge } from "@/components/ui/Badge";

export default function GeneralLedgerPage() {
  return (
    <AppShell>
      <WorkspaceLayout
        title="General Ledger"
        subtitle="Every posted line of one account, with its running balance"
        badge={<Badge variant="teal">Authoritative statement</Badge>}
        breadcrumbs={[
          { label: "Reports" },
          { label: "General Ledger", href: "/reports/general-ledger" },
        ]}
      >
        <GeneralLedgerView />
      </WorkspaceLayout>
    </AppShell>
  );
}
