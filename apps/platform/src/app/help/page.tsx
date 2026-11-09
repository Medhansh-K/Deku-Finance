"use client";

import React, { Suspense } from "react";
import { AppShell } from "@/layouts/AppShell";
import { WorkspaceLayout } from "@/layouts/WorkspaceLayout";
import { HelpCentreView } from "@/modules/help/HelpCentreView";

export default function HelpPage() {
  return (
    <AppShell>
      <WorkspaceLayout
        title="Help & Tutorials"
        subtitle="Guided walkthroughs of setup, accounting, sales, purchases, banking, reports and administration"
        breadcrumbs={[{ label: "Help & Tutorials", href: "/help" }]}
      >
        <Suspense fallback={null}>
          <HelpCentreView />
        </Suspense>
      </WorkspaceLayout>
    </AppShell>
  );
}
