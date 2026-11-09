"use client";

import React from "react";
import { AppShell } from "@/layouts/AppShell";
import { WorkspaceLayout } from "@/layouts/WorkspaceLayout";
import { SettingsView } from "@/modules/settings/SettingsView";
import { Badge } from "@/components/ui/Badge";

export default function SettingsPage() {
  return (
    <AppShell>
      <WorkspaceLayout
        title="Settings & Accounting Governance"
        subtitle="Manage fiscal periods, ALERX chart parameters and operating preferences"
        badge={<Badge variant="teal">Governance</Badge>}
        breadcrumbs={[
          { label: "Utilities" },
          { label: "Settings", href: "/settings" },
        ]}
      >
        <SettingsView />
      </WorkspaceLayout>
    </AppShell>
  );
}
