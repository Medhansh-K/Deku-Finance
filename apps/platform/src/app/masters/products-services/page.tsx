"use client";

import React from "react";
import { AppShell } from "@/layouts/AppShell";
import { WorkspaceLayout } from "@/layouts/WorkspaceLayout";
import { ProductsServicesView } from "@/modules/masters/products-services/ProductsServicesView";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

export default function ProductsServicesPage() {
  return (
    <AppShell>
      <WorkspaceLayout
        title="Stock & services catalogue"
        subtitle="Product SKUs, HSN/SAC classification and default GST rates"
        badge={<Badge variant="teal">Goods & services master</Badge>}
        actions={
          <Link href="/inventory">
            <Button variant="outline" size="sm">
              Stock levels &amp; warehouses
            </Button>
          </Link>
        }
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
