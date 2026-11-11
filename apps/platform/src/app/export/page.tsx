"use client";

import React from "react";
import { AppShell } from "@/layouts/AppShell";
import { WorkspaceLayout } from "@/layouts/WorkspaceLayout";
import { ExportView } from "@/modules/import/ExportView";
import { Badge } from "@/components/ui/Badge";

export default function ExportPage() {
  return (
    <AppShell>
      <WorkspaceLayout
        title="Export data"
        subtitle="Download your chart of accounts, parties, items, day book and trial balance as CSV"
        badge={<Badge variant="teal">CSV</Badge>}
        breadcrumbs={[{ label: "Export data", href: "/export" }]}
      >
        <ExportView />
      </WorkspaceLayout>
    </AppShell>
  );
}
