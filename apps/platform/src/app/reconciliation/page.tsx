"use client";

import React, { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/layouts/AppShell";
import { WorkspaceLayout } from "@/layouts/WorkspaceLayout";
import { ReconciliationView } from "@/modules/banking/ReconciliationView";
import { MarketplaceView } from "@/modules/marketplace/MarketplaceView";

const TABS = [
  { id: "bank", label: "Bank reconciliation" },
  { id: "marketplace", label: "Marketplace settlements" },
];

function ReconciliationTabs() {
  const router = useRouter();
  const active = useSearchParams().get("tab") === "marketplace" ? "marketplace" : "bank";

  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="Reconciliation and settlements" className="flex gap-1 border-b border-line text-[13.5px]">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active === tab.id}
            onClick={() => router.replace(`/reconciliation?tab=${tab.id}`)}
            className={`px-3 py-2.5 -mb-px border-b-2 transition-colors ${
              active === tab.id ? "border-brand text-ink font-medium" : "border-transparent text-ink-muted hover:text-ink"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div role="tabpanel">{active === "marketplace" ? <MarketplaceView /> : <ReconciliationView />}</div>
    </div>
  );
}

export default function ReconciliationPage() {
  return (
    <AppShell>
      <WorkspaceLayout
        title="Reconciliation & settlements"
        subtitle="Match bank statements to your vouchers, and post marketplace payout reports"
        breadcrumbs={[{ label: "Reconciliation & settlements", href: "/reconciliation" }]}
      >
        <Suspense fallback={null}>
          <ReconciliationTabs />
        </Suspense>
      </WorkspaceLayout>
    </AppShell>
  );
}
