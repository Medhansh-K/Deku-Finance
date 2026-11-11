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
        title="Departments and members"
        subtitle="Organisational structure, departmental leads, inter/intra tasks, budgets, license owner governance, and employee compensation tracking"
        badge={<Badge variant="teal">Shortcut M</Badge>}
        breadcrumbs={[
          { label: "Utilities" },
          { label: "Departments & Members", href: "/departments-members" },
        ]}
      >
        <Suspense
          fallback={
            <div className="p-6 text-[13.5px] text-ink-muted">
              Loading departments and members…
            </div>
          }
        >
          <DepartmentsMembersView />
        </Suspense>
      </WorkspaceLayout>
    </AppShell>
  );
}
