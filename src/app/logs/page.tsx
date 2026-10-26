"use client";

import React from "react";
import { AppShell } from "@/layouts/AppShell";
import { WorkspaceLayout } from "@/layouts/WorkspaceLayout";
import { AuditTrailView } from "@/modules/audit/AuditTrailView";
import { Badge } from "@/components/ui/Badge";

export default function LogsPage() {
  return (
    <AppShell>
      <WorkspaceLayout
        title="User Activity Logs & Audit Trail"
        subtitle="Real-time chronological log of every user action, transaction lifecycle, and immutable compliance records"
        badge={<Badge variant="teal">Shortcut: L</Badge>}
        breadcrumbs={[
          { label: "Utilities" },
          { label: "Logs", href: "/logs" },
        ]}
      >
        <AuditTrailView />
      </WorkspaceLayout>
    </AppShell>
  );
}
