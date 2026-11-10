"use client";

import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { LearnDemoWorkspace } from "@/components/learn/LearnDemoWorkspace";
import { DEMO_COMPANIES, getDemoCompany, type DemoCompanySlug } from "@/lib/learn/companies";
import { getDemoPlanConfig, type DemoPlanId } from "@/lib/learn/demo-plans";
import { getDemoRoleConfig } from "@/lib/learn/demo-roles";
import type { OrgRole } from "@/modules/departments-members/team";

function WorkspaceRunner() {
  const params = useSearchParams();
  const rawCompany = params.get("company");
  const companySlug: DemoCompanySlug =
    getDemoCompany(rawCompany)?.slug ?? DEMO_COMPANIES[0].slug;

  const rawRole = params.get("role");
  const role: OrgRole = getDemoRoleConfig(rawRole).role;

  const rawPlan = params.get("plan");
  const plan: DemoPlanId | undefined =
    rawPlan === "go" || rawPlan === "pro" || rawPlan === "enterprise"
      ? getDemoPlanConfig(rawPlan).id
      : undefined;

  const route = params.get("route") ?? "/gateway";
  const tour = params.get("tour");

  return (
    <LearnDemoWorkspace
      initialCompany={companySlug}
      initialRole={role}
      initialPlan={plan}
      initialRoute={route}
      initialTour={tour}
    />
  );
}

export default function LearnDemoWorkspacePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-canvas text-xs font-mono text-ink-muted">
          Loading Deku Interactive Demo Workspace…
        </div>
      }
    >
      <WorkspaceRunner />
    </Suspense>
  );
}
