"use client";

import React from "react";
import { AppShell } from "@/layouts/AppShell";
import { WorkspaceLayout } from "@/layouts/WorkspaceLayout";
import { GstTaxHubView } from "@/modules/gst/GstTaxHubView";
import { Badge } from "@/components/ui/Badge";

export default function GstPage() {
  return (
    <AppShell>
      <WorkspaceLayout
        title="GST & invoicing"
        subtitle="GST compliance, intra-state and inter-state tax, and sales invoices"
        badge={<Badge variant="teal">GST rules & invoicing</Badge>}
        breadcrumbs={[
          { label: "Statutory" },
          { label: "GST & invoicing", href: "/gst" },
        ]}
      >
        <GstTaxHubView />
      </WorkspaceLayout>
    </AppShell>
  );
}
