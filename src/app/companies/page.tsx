"use client";

import React from "react";
import { AppShell } from "@/layouts/AppShell";
import { WorkspaceLayout } from "@/layouts/WorkspaceLayout";
import { CompaniesView } from "@/modules/companies/CompaniesView";
import { Badge } from "@/components/ui/Badge";

export default function CompaniesPage() {
  return (
    <AppShell>
      <WorkspaceLayout
        title="Select Company / Multi-Tenancy"
        subtitle="Manage business entities, financial year periods and active enterprise workspace"
        badge={<Badge variant="teal">F3: Company</Badge>}
        breadcrumbs={[
          { label: "Utilities" },
          { label: "Companies", href: "/companies" },
        ]}
      >
        <CompaniesView />
      </WorkspaceLayout>
    </AppShell>
  );
}
