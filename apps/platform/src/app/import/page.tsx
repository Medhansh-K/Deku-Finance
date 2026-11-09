"use client";

import React from "react";
import { AppShell } from "@/layouts/AppShell";
import { WorkspaceLayout } from "@/layouts/WorkspaceLayout";
import { ImportView } from "@/modules/import/ImportView";
import { Badge } from "@/components/ui/Badge";

export default function ImportPage() {
  return (
    <AppShell>
      <WorkspaceLayout
        title="Import data"
        subtitle="Move in from Tally ERP 9 / TallyPrime (XML export) or a spreadsheet (CSV): masters, opening balances and vouchers"
        badge={<Badge variant="teal">Read in your browser</Badge>}
        breadcrumbs={[{ label: "Import data", href: "/import" }]}
      >
        <ImportView />
      </WorkspaceLayout>
    </AppShell>
  );
}
