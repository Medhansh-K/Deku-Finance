"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useOptionalLearnDemo } from "@/context/LearnDemoContext";
import { Button } from "@/components/ui/Button";
import { WorkflowCoach } from "@/components/learn/WorkflowCoach";
import { TUTORIAL_PATHS } from "@/lib/tutorials/paths";
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
import { TourPointer, TourTail, useTourHighlight } from "./tour-highlight";

const FIRST_PATH = "first-setup";
const DEMO_WELCOME_ID = "public-learn-demo";

/**
 * The on-screen guide. In the Learn Centre demo, a running workflow gets the workflow coach;
 * otherwise (and in the signed-in app) it follows the core tutorial paths from the Help Centre.
 */
export function TutorialCoach() {
  const demo = useOptionalLearnDemo();
  if (demo?.workflowState.active) return <WorkflowCoach />;
  return <CorePathCoach />;
}

const cardClass = "rounded-panel border border-line-strong bg-surface shadow-pop p-4 space-y-3 text-[13.5px] text-ink-soft";
const fallbackClass = `fixed z-40 bottom-14 left-4 right-4 sm:left-auto sm:w-96 ${cardClass}`;

function CorePathCoach() {
  const { user } = useAuth();
  const demo = useOptionalLearnDemo();
  const router = useRouter();
  const rawPathname = usePathname();
  const pathname = demo ? demo.activeRoute : rawPathname;
  // In the demo, user.id is the seeded member for the previewed role, as the Help Centre saves it.
  const userId = user?.id;
  // The demo's welcome is shown once per browser, not once per previewed role.
  const welcomeId = demo ? DEMO_WELCOME_ID : userId;
  const [progress, setProgress] = useState<TutorialProgress>(EMPTY_PROGRESS);
  const [welcomed, setWelcomed] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!userId || !welcomeId) return;
    const read = () => {
      setProgress(loadProgress(userId));
      setWelcomed(loadProgress(welcomeId).welcomed);
      setLoaded(true);
    };
    read();
    return onProgressChanged(read);
  }, [userId, welcomeId]);

  const dismissWelcome = () => {
    if (welcomeId) saveProgress(welcomeId, { ...loadProgress(welcomeId), welcomed: true });
  };

  const update = (next: TutorialProgress) => {
    if (userId) saveProgress(userId, next);
  };

  const path = TUTORIAL_PATHS.find((p) => p.id === progress.active);
  const index = path ? currentIndex(progress, path) : 0;
  const step = path?.steps[index];

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

  const layout = useTourHighlight(step?.target, !!step && (!step.route || pathname === step.route));

  if ((!user && !demo) || !loaded) return null;

  if (!path || !step) {
    if (welcomed || progress.welcomed || progress.active) return null;
    return (
      <section aria-label="Welcome" className={fallbackClass}>
        <h2 className="text-[15px] font-semibold tracking-tight text-ink">
          {demo ? `Welcome to ${demo.dataset.org.name}` : "Welcome to Deku Finance"}
        </h2>
        <p>
          {demo
            ? "Follow a guided workflow on the real screens: each step completes only when you have actually done it, and the books change as you go."
            : "A short guided tour covers setting up your company. It only points things out and never saves anything for you."}
        </p>
        <div className="flex flex-wrap gap-2">
          {demo ? (
            <Button
              size="sm"
              onClick={() => {
                dismissWelcome();
                demo.setWorkflowDrawerOpen(true);
              }}
            >
              Choose a workflow
            </Button>
          ) : (
            <Button size="sm" onClick={() => update(startPath(progress, FIRST_PATH))}>
              Start the tour
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={dismissWelcome}>
            Dismiss
          </Button>
        </div>
        {!demo && (
          <p className="text-[12.5px] text-ink-muted">
            You can find every tutorial any time under{" "}
            <Link href="/help" className="underline">
              Help &amp; tutorials
            </Link>
            .
          </p>
        )}
      </section>
    );
  }

  const isLast = index === path.steps.length - 1;
  const pctDone = Math.round(((index + 1) / path.steps.length) * 100);

  return (
    <>
      {layout && <TourPointer layout={layout} />}
      <section
        aria-label={`Tutorial: ${path.title}`}
        style={layout ? { top: layout.top, left: layout.left, width: "min(380px, calc(100vw - 24px))" } : undefined}
        className={layout ? `fixed z-40 transition-all duration-200 ${cardClass}` : fallbackClass}
      >
        {layout && <TourTail side={layout.tailSide} />}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2 text-[12.5px] text-ink-muted">
            <span className="truncate font-medium text-brand-strong">{path.title}</span>
            <span className="shrink-0 tabular-nums">
              Step {index + 1} of {path.steps.length}
            </span>
          </div>
          <div className="h-1 w-full rounded-full bg-canvas-sunken overflow-hidden">
            <div className="h-full bg-brand transition-all duration-300" style={{ width: `${pctDone}%` }} />
          </div>
        </div>

        <div aria-live="polite" className="space-y-1.5">
          <h2 className="text-[15px] font-semibold tracking-tight text-ink leading-snug">{step.title}</h2>
          <p className="leading-relaxed">{step.body}</p>
          {demo && step.route && pathname !== step.route && (
            <button type="button" onClick={() => demo.navigateTo(step.route!)} className="text-[13px] font-medium text-brand-strong hover:underline">
              Go back to the highlighted screen
            </button>
          )}
        </div>

        <p className="text-[12.5px] text-ink-muted">
          {demo
            ? "Demo company: sample books in your browser."
            : user?.is_demo
              ? "Demo company: everything here is fictional."
              : "This is your real company. Nothing is saved unless you press save or post yourself."}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" disabled={index === 0} onClick={() => update(previousStep(progress, path))}>
            Back
          </Button>
          <Button size="sm" onClick={() => update(nextStep(progress, path))}>
            {isLast ? "Finish" : "Next"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => update(pausePath(progress))} className="ml-auto">
            Pause
          </Button>
        </div>
      </section>
    </>
  );
}
