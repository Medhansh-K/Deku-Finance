"use client";

import React from "react";
import { AppShell } from "@/layouts/AppShell";
import { WorkspaceLayout } from "@/layouts/WorkspaceLayout";
import { InventoryView } from "@/modules/inventory/InventoryView";
import { Badge } from "@/components/ui/Badge";

export default function InventoryPage() {
  return (
    <AppShell>
      <WorkspaceLayout
        title="Inventory"
        subtitle="Stock on hand at FIFO cost, moved by issued invoices, linked purchase bills, sales returns and adjustments"
        badge={<Badge variant="teal">FIFO</Badge>}
        breadcrumbs={[{ label: "Inventory", href: "/inventory" }]}
      >
        <InventoryView />
      </WorkspaceLayout>
    </AppShell>
  );
}
