"use client";

import { AppShell } from "@/layouts/AppShell";
import { ExecutiveSummaryView } from "@/modules/executive/ExecutiveSummaryView";

export default function ExecutiveDashboardPage() {
  return (
    <AppShell>
      <ExecutiveSummaryView />
    </AppShell>
  );
}
