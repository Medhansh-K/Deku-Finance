"use client";

import React, { Suspense } from "react";
import { AppShell } from "@/layouts/AppShell";
import { WorkspaceLayout } from "@/layouts/WorkspaceLayout";
import { DocumentBuilderView } from "@/modules/builder/DocumentBuilderView";
import { Badge } from "@/components/ui/Badge";

export default function DocumentBuilderPage() {
  return (
    <AppShell>
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <Suspense
          fallback={
            <div className="flex-1 flex items-center justify-center p-8 text-[13px] text-ink-muted">
              Opening the document builder...
            </div>
          }
        >
          <DocumentBuilderView />
        </Suspense>
      </div>
    </AppShell>
  );
}
