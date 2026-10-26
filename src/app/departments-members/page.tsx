"use client";

import React, { Suspense } from "react";
import { AppShell } from "@/layouts/AppShell";
import { WorkspaceLayout } from "@/layouts/WorkspaceLayout";
import { DepartmentsMembersView } from "@/modules/departments-members/DepartmentsMembersView";
import { Badge } from "@/components/ui/Badge";

export default function DepartmentsMembersPage() {
  return (
    <AppShell>
      <WorkspaceLayout
        title="Departments & Firm Members"
        subtitle="Organisational structure, departmental leads, inter/intra tasks, budgets, license owner governance, and employee compensation tracking"
        badge={<Badge variant="teal">M: Departments &amp; Members</Badge>}
        breadcrumbs={[
          { label: "Utilities & Statutory" },
          { label: "Departments & Members", href: "/departments-members" },
        ]}
      >
        <Suspense
          fallback={
            <div className="p-6 text-xs font-mono text-slate-500">
              Loading departments &amp; members workspace...
            </div>
          }
        >
          <DepartmentsMembersView />
        </Suspense>
      </WorkspaceLayout>
    </AppShell>
  );
}
