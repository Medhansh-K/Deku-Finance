"use client";

import React from "react";
import { AppShell } from "@/layouts/AppShell";
import { WorkspaceLayout } from "@/layouts/WorkspaceLayout";
import { Badge } from "@/components/ui/Badge";
import { KycHubView } from "@/modules/kyc/KycHubView";

export default function KycPage() {
  return (
    <AppShell>
      <WorkspaceLayout
        title="KYC & identity"
        subtitle="Verify the company and its people through a KYC provider, and see the resulting trust level"
        badge={<Badge variant="teal">KYC</Badge>}
        breadcrumbs={[{ label: "Utilities" }, { label: "KYC", href: "/kyc" }]}
      >
        <KycHubView />
      </WorkspaceLayout>
    </AppShell>
  );
}
