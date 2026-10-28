"use client";

import React from "react";
import { AppShell } from "@/layouts/AppShell";
import { WorkspaceLayout } from "@/layouts/WorkspaceLayout";
import { ApprovalsView } from "@/modules/approvals/ApprovalsView";
import { Badge } from "@/components/ui/Badge";

export default function ApprovalsPage() {
  return (
    <AppShell>
      <WorkspaceLayout
        title="Voucher Approvals"
        subtitle="Maker-checker review: vouchers reach the ledger only after a second person approves them"
        badge={<Badge variant="teal">Internal Control</Badge>}
        breadcrumbs={[{ label: "Approvals", href: "/approvals" }]}
      >
        <ApprovalsView />
      </WorkspaceLayout>
    </AppShell>
  );
}
