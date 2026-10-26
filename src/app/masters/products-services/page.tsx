"use client";

import React from "react";
import { AppShell } from "@/layouts/AppShell";
import { WorkspaceLayout } from "@/layouts/WorkspaceLayout";
import { ProductsServicesView } from "@/modules/masters/products-services/ProductsServicesView";
import { Badge } from "@/components/ui/Badge";

export default function ProductsServicesPage() {
  return (
    <AppShell>
      <WorkspaceLayout
        title="Stock & Services Catalogue"
        subtitle="Manage Product SKUs, HSN/SAC Classifications and Default GST Rates"
        badge={<Badge variant="teal">Goods & Services Master</Badge>}
        breadcrumbs={[
          { label: "Masters" },
          { label: "Catalogue", href: "/masters/products-services" },
        ]}
      >
        <ProductsServicesView />
      </WorkspaceLayout>
    </AppShell>
  );
}
