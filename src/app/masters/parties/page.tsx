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
        title="Parties & Counterparties"
        subtitle="Manage Debtors (Customers) and Creditors (Vendors) with GSTIN and Billing Addresses"
        badge={<Badge variant="teal">Customer & Vendor Master</Badge>}
        breadcrumbs={[
          { label: "Masters" },
          { label: "Parties", href: "/masters/parties" },
        ]}
      >
        <React.Suspense fallback={<div className="p-4 text-xs text-slate-500 font-mono">Loading counterparty directory...</div>}>
          <PartiesView />
        </React.Suspense>
      </WorkspaceLayout>
    </AppShell>
  );
}
