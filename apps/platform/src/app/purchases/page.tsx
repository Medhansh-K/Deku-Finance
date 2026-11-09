"use client";

import React from "react";
import { AppShell } from "@/layouts/AppShell";
import { WorkspaceLayout } from "@/layouts/WorkspaceLayout";
import { PurchasesView } from "@/modules/purchases/PurchasesView";
import { Badge } from "@/components/ui/Badge";

export default function PurchasesPage() {
  return (
    <AppShell>
      <WorkspaceLayout
        title="Purchase register"
        subtitle="Supplier bills with their input tax credit: eligible, blocked under section 17(5) or ineligible"
        badge={<Badge variant="teal">GSTR-3B Table 4</Badge>}
        breadcrumbs={[{ label: "Purchases", href: "/purchases" }]}
      >
        <PurchasesView />
      </WorkspaceLayout>
    </AppShell>
  );
}
