"use client";

import React from "react";
import { AppShell } from "@/layouts/AppShell";
import { WorkspaceLayout } from "@/layouts/WorkspaceLayout";
import { DayBookView } from "@/modules/day-book/DayBookView";

export default function DayBookPage() {
  return (
    <AppShell>
      <WorkspaceLayout
        title="Day Book"
        subtitle="Every voucher in date order, posted and draft"
        breadcrumbs={[
          { label: "Transactions" },
          { label: "Day Book", href: "/day-book" },
        ]}
      >
        <DayBookView />
      </WorkspaceLayout>
    </AppShell>
  );
}
