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
        title="GST & Invoicing Hub"
        subtitle="GST compliance, intra-state & inter-state tax engine, and sales invoice generation"
        badge={<Badge variant="teal">GST Rules & Invoicing</Badge>}
        breadcrumbs={[
          { label: "Statutory" },
          { label: "GST & Invoicing", href: "/gst" },
        ]}
      >
        <GstTaxHubView />
      </WorkspaceLayout>
    </AppShell>
  );
}
