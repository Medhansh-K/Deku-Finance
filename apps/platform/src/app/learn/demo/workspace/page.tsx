"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import LandingNavbar from "@/components/landing/LandingNavbar";
import LandingFooter from "@/components/landing/LandingFooter";
import { LearnDemoWorkspace } from "@/components/learn/LearnDemoWorkspace";
import { LearnMobileNotice } from "@/components/learn/LearnMobileNotice";
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
  const workflow = params.get("workflow");

  return (
    <LearnDemoWorkspace
      initialCompany={companySlug}
      initialRole={role}
      initialPlan={plan}
      initialRoute={route}
      initialTour={tour}
      initialWorkflow={workflow}
    />
  );
}

export default function LearnDemoWorkspacePage() {
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  if (isDesktop === false) {
    return (
      <div className="flex min-h-screen flex-col bg-canvas font-sans text-ink">
        <LandingNavbar />
        <main className="flex-1">
          <LearnMobileNotice title="Switch to a laptop for the interactive demo tour" />
        </main>
        <LandingFooter />
      </div>
    );
  }

  return (
    <>
      <div className="flex min-h-screen flex-col bg-canvas font-sans text-ink md:hidden">
        <LandingNavbar />
        <main className="flex-1">
          <LearnMobileNotice title="Switch to a laptop for the interactive demo tour" />
        </main>
        <LandingFooter />
      </div>
      <div className="hidden md:block">
        {isDesktop ? (
          <Suspense
            fallback={
              <div className="min-h-screen flex items-center justify-center bg-canvas text-[13.5px] text-ink-muted">
                Loading the demo workspace…
              </div>
            }
          >
            <WorkspaceRunner />
          </Suspense>
        ) : (
          <div className="min-h-screen flex items-center justify-center bg-canvas text-[13.5px] text-ink-muted">
            Loading the demo workspace…
          </div>
        )}
      </div>
    </>
  );
}
