"use client";

import React from "react";
import { AppShell } from "@/layouts/AppShell";
import { WorkspaceLayout } from "@/layouts/WorkspaceLayout";
import { CashFlowView } from "@/modules/financial-reports/cash-flow/CashFlowView";
import { Badge } from "@/components/ui/Badge";

export default function CashFlowPage() {
  return (
    <AppShell>
      <WorkspaceLayout
        title="Cash Flow Statement"
        subtitle="Operating, investing, and financing liquid cash movements across all bank and treasury accounts"
        badge={<Badge variant="teal">WCM Core Engine</Badge>}
        breadcrumbs={[
          { label: "Reports" },
          { label: "Cash Flow", href: "/reports/cash-flow" },
        ]}
      >
        <CashFlowView />
      </WorkspaceLayout>
    </AppShell>
  );
}
