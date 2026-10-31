"use client";

import React from "react";
import { AppShell } from "@/layouts/AppShell";
import { WorkspaceLayout } from "@/layouts/WorkspaceLayout";
import { MarketplaceView } from "@/modules/marketplace/MarketplaceView";
import { Badge } from "@/components/ui/Badge";

export default function MarketplacePage() {
  return (
    <AppShell>
      <WorkspaceLayout
        title="Marketplace settlements"
        subtitle="Import payout reports from Amazon, Flipkart, Meesho and other operators, then post one summary voucher per settlement"
        badge={<Badge variant="teal">TCS s.52 · TDS s.194-O</Badge>}
        breadcrumbs={[{ label: "Marketplace", href: "/marketplace" }]}
      >
        <MarketplaceView />
      </WorkspaceLayout>
    </AppShell>
  );
}
