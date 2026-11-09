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
        title="FP&A Intelligence & Strategic Analytics"
        subtitle="Gross & net margins, solvency ratios, working capital gap, treasury runway, and departmental budget variances"
        badge={<Badge variant="teal">FP&A Executive Suite</Badge>}
        breadcrumbs={[
          { label: "Reports" },
          { label: "FP&A Intelligence", href: "/reports/fpa" },
        ]}
      >
        <FpaExecutiveView />
      </WorkspaceLayout>
    </AppShell>
  );
}
