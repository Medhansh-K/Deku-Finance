"use client";

import React from "react";
import { AppShell } from "@/layouts/AppShell";
import { WorkspaceLayout } from "@/layouts/WorkspaceLayout";
import { FpaExecutiveView } from "@/modules/financial-reports/fpa/FpaExecutiveView";
import { Badge } from "@/components/ui/Badge";

export default function FpaReportsPage() {
  return (
    <AppShell>
      <WorkspaceLayout
        title="FP&A intelligence"
        subtitle="Gross and net margins, solvency ratios, working capital, cash runway and department budget variances"
        badge={<Badge variant="teal">Executive view</Badge>}
        breadcrumbs={[
          { label: "Reports" },
          { label: "FP&A intelligence", href: "/reports/fpa" },
        ]}
      >
        <FpaExecutiveView />
      </WorkspaceLayout>
    </AppShell>
  );
}
