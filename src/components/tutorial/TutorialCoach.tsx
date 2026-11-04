"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
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

const FIRST_PATH = "first-setup";

/** Floating guide card. It explains and points; it never fills in or submits anything. */
export function TutorialCoach() {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const userId = user?.id;
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

  const path = TUTORIAL_PATHS.find((p) => p.id === progress.active);
  const index = path ? currentIndex(progress, path) : 0;
  const step = path?.steps[index];

  // Opens each step's page once, so someone who wanders off to look around isn't dragged back.
  useEffect(() => {
    if (!step?.route || progress.routeOpened) return;
    if (pathname !== step.route) router.push(step.route);
    update({ ...progress, routeOpened: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step?.id, step?.route, progress.routeOpened, pathname]);

  // The page may still be loading its data, so the target is looked for a few times.
  useEffect(() => {
    if (!step?.target || (step.route && pathname !== step.route)) return;
    let el: Element | null = null;
    let tries = 0;
    const timer = setInterval(() => {
      el = document.querySelector(`[data-tour="${step.target}"]`);
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

  if (!user || !loaded) return null;

  if (!path || !step) {
    if (progress.welcomed || progress.active) return null;
    return (
      <section aria-label="Welcome" className={cardClass}>
        <h2 className="text-sm font-bold text-ink">Welcome to Deku Finance</h2>
        <p>A short guided tour covers setting up your company. It only points things out and never saves anything for you.</p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button size="sm" onClick={() => update(startPath(progress, FIRST_PATH))}>
            Start the tour
          </Button>
          <Button size="sm" variant="ghost" onClick={() => update({ ...progress, welcomed: true })}>
            Not now
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
      <div aria-live="polite">
        <h2 className="text-sm font-bold text-ink">{step.title}</h2>
        <p className="mt-1 leading-relaxed">{step.body}</p>
      </div>
      <p className="text-[10px] text-ink-muted">
        {user.is_demo
          ? "Demo company: everything here is fictional."
          : "This is your real company. Nothing is saved unless you press save or post yourself."}
      </p>
      <div className="flex flex-wrap items-center gap-2 pt-1">
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
  );
}
