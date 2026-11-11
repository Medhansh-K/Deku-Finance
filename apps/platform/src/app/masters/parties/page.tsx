"use client";

import React from "react";
import { AppShell } from "@/layouts/AppShell";
import { WorkspaceLayout } from "@/layouts/WorkspaceLayout";
import { PartiesView } from "@/modules/masters/parties/PartiesView";
import { Badge } from "@/components/ui/Badge";

export default function PartiesPage() {
  return (
    <AppShell>
      <WorkspaceLayout
        title="Parties & counterparties"
        subtitle="Debtors (customers) and creditors (vendors) with GSTIN and billing addresses"
        badge={<Badge variant="teal">Customer & vendor master</Badge>}
        breadcrumbs={[
          { label: "Masters" },
          { label: "Parties", href: "/masters/parties" },
        ]}
      >
        <React.Suspense fallback={<div className="p-4 text-[13.5px] text-ink-muted">Loading counterparty directory…</div>}>
          <PartiesView />
        </React.Suspense>
      </WorkspaceLayout>
    </AppShell>
  );
}
