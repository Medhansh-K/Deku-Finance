"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useOptionalLearnDemo } from "@/context/LearnDemoContext";
import { Button } from "@/components/ui/Button";
import { TUTORIAL_PATHS } from "@/lib/tutorials/paths";
import { WORKFLOW_TUTORIAL_PATHS, type WorkflowStep, type WorkflowTutorialPath } from "@/lib/tutorials/workflows";
import { getDemoPlanConfig } from "@/lib/learn/demo-plans";
import {
  EMPTY_PROGRESS,
  currentIndex,
  loadProgress,
  nextStep,
  onProgressChanged,
  pausePath,
  previousStep,
  saveProgress,
  startPath,
  type TutorialProgress,
} from "@/lib/tutorials/progress";

const FIRST_PATH = "first-setup";

const ALL_PATHS = [...TUTORIAL_PATHS, ...WORKFLOW_TUTORIAL_PATHS];

/** Floating guide card. It explains and points; it never fills in or submits anything. */
export function TutorialCoach() {
  const { user } = useAuth();
  const demo = useOptionalLearnDemo();
  const router = useRouter();
  const rawPathname = usePathname();
  const pathname = demo ? demo.activeRoute : rawPathname;
  const userId = demo ? "public-learn-demo" : user?.id;
  const [progress, setProgress] = useState<TutorialProgress>(EMPTY_PROGRESS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!userId) return;
    const read = () => {
      setProgress(loadProgress(userId));
      setLoaded(true);
    };
    read();
    return onProgressChanged(read);
  }, [userId]);

  const update = (next: TutorialProgress) => {
    if (userId) saveProgress(userId, next);
  };

  const path = ALL_PATHS.find((p) => p.id === progress.active);
  const index = path ? currentIndex(progress, path) : 0;
  const step = path?.steps[index] as WorkflowStep | undefined;
  const workflowPath = path as WorkflowTutorialPath | undefined;

  // Opens each step's page once, so someone who wanders off to look around isn't dragged back.
  useEffect(() => {
    if (!step?.route || progress.routeOpened) return;
    if (pathname !== step.route) {
      if (demo) demo.navigateTo(step.route);
      else router.push(step.route);
    }
    update({ ...progress, routeOpened: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step?.id, step?.route, progress.routeOpened, pathname]);

  // The page may still be loading its data, so the target is looked for a few times.
  useEffect(() => {
    if (!step?.target || (step.route && pathname !== step.route)) return;
    let el: Element | null = null;
    let tries = 0;
    const timer = setInterval(() => {
      // Next keeps earlier pages mounted but hidden, so the shell's elements can appear more than once.
      el = [...document.querySelectorAll(`[data-tour="${step.target}"]`)].find((e) => e.getClientRects().length > 0) ?? null;
      if (el || ++tries > 20) clearInterval(timer);
      if (el) {
        el.classList.add("tour-highlight");
        el.scrollIntoView({ block: "center" });
      }
    }, 150);
    return () => {
      clearInterval(timer);
      el?.classList.remove("tour-highlight");
    };
  }, [step?.target, step?.route, pathname]);

  const cardClass =
    "fixed z-40 bottom-14 left-4 right-4 sm:left-auto sm:w-96 rounded-xl border border-line-strong bg-surface shadow-lg p-4 space-y-2 text-xs text-ink-soft";

  if ((!user && !demo) || !loaded) return null;

  if (!path || !step) {
    if (progress.welcomed || progress.active) return null;
    return (
      <section aria-label="Welcome" className={cardClass}>
        <h2 className="text-sm font-bold text-ink">
          {demo ? `Interactive Tour: ${demo.dataset.org.name}` : "Welcome to Deku Finance"}
        </h2>
        <p>
          {demo
            ? "Explore live company books with zero login. Switch Roles (7), Plans (GO/PRO/Enterprise), or launch any of the 8 Business Workflows anytime."
            : "A short guided tour covers setting up your company. It only points things out and never saves anything for you."}
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button size="sm" onClick={() => update(startPath(progress, FIRST_PATH))}>
            Start the tour
          </Button>
          {demo && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                update({ ...progress, welcomed: true });
                demo.setWorkflowDrawerOpen(true);
              }}
            >
              Browse 8 Workflows
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => update({ ...progress, welcomed: true })}>
            Dismiss
          </Button>
        </div>
        <p className="text-ink-muted">
          You can find every tutorial any time under{" "}
          <Link href="/help" className="underline">
            Help &amp; Tutorials
          </Link>
          .
        </p>
      </section>
    );
  }

  const isLast = index === path.steps.length - 1;
  return (
    <section aria-label={`Tutorial: ${path.title}`} className={cardClass}>
      <div className="flex items-center justify-between gap-2 text-[10px] font-mono uppercase tracking-wider text-ink-muted">
        <span className="truncate">{path.title}</span>
        <span className="shrink-0">
          Step {index + 1} of {path.steps.length}
        </span>
      </div>
      <div aria-live="polite" className="space-y-1.5">
        <h2 className="text-sm font-bold text-ink">{step.title}</h2>
        <p className="leading-relaxed">{step.body}</p>
        {step.accountingImpact && (
          <div className="rounded-lg border border-brand/25 bg-brand/5 px-2.5 py-1.5 text-[11px] font-mono text-ink">
            {step.accountingImpact}
          </div>
        )}
      </div>
      {demo ? (
        <div className="rounded-lg border border-line bg-canvas px-2.5 py-1.5 text-[10px] text-ink-muted space-y-0.5">
          <div>
            Role: <strong className="text-ink">{demo.roleConfig.label}</strong> &middot; Plan:{" "}
            <strong className="text-ink">{getDemoPlanConfig(demo.plan).name}</strong>
          </div>
          {workflowPath?.roleGuidance && <div>{workflowPath.roleGuidance}</div>}
        </div>
      ) : (
        <p className="text-[10px] text-ink-muted">
          {user?.is_demo
            ? "Demo company: everything here is fictional."
            : "This is your real company. Nothing is saved unless you press save or post yourself."}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button size="sm" variant="outline" disabled={index === 0} onClick={() => update(previousStep(progress, path))}>
          Back
        </Button>
        <Button size="sm" onClick={() => update(nextStep(progress, path))}>
          {isLast ? "Finish" : "Next"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => update(pausePath(progress))} className="ml-auto">
          {demo ? "Skip / Exit" : "Pause"}
        </Button>
      </div>
    </section>
  );
}
