"use client";

import React from "react";
import { AppShell } from "@/layouts/AppShell";
import { WorkspaceLayout } from "@/layouts/WorkspaceLayout";
import { CollectView } from "@/modules/collect/CollectView";
import { Badge } from "@/components/ui/Badge";

export default function CollectPage() {
  return (
    <AppShell>
      <WorkspaceLayout
        title="Collect payments"
        subtitle="What each customer still owes, settled against the debtors ledger, with WhatsApp reminders you send yourself"
        badge={<Badge variant="teal">MSME Collect</Badge>}
        breadcrumbs={[{ label: "Collect", href: "/collect" }]}
      >
        <CollectView />
      </WorkspaceLayout>
    </AppShell>
  );
}
