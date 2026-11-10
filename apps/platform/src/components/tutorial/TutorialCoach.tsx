"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CheckCircle2, MousePointer2, Sparkles, TrendingUp } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useOptionalLearnDemo } from "@/context/LearnDemoContext";
import { Button } from "@/components/ui/Button";
import { TUTORIAL_PATHS } from "@/lib/tutorials/paths";
import {
  PRODUCT_WALKTHROUGH_PATH,
  WORKFLOW_TUTORIAL_PATHS,
  type WorkflowStep,
} from "@/lib/tutorials/workflows";
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
import { getDemoPlanConfig } from "@/lib/learn/demo-plans";

const FIRST_PATH = "first-setup";
const ALL_PATHS = [PRODUCT_WALKTHROUGH_PATH, ...TUTORIAL_PATHS, ...WORKFLOW_TUTORIAL_PATHS];

interface CloudBoxLayout {
  top: number;
  left: number;
  tailSide: "top" | "bottom" | "left" | "right" | "none";
  cursorX: number;
  cursorY: number;
}

function computeCloudLayout(rect: DOMRect, vw: number, vh: number): CloudBoxLayout {
  const cardW = Math.min(380, vw - 24);
  const estCardH = 310;
  const gap = 16;

  // Prefer placing adjacent to highlighted region without covering it
  const spaceBelow = vh - rect.bottom - 36;
  const spaceAbove = rect.top - 12;
  const spaceRight = vw - rect.right - 12;
  const spaceLeft = rect.left - 12;

  let top = vh - estCardH - 56;
  let left = vw - cardW - 16;
  let tailSide: CloudBoxLayout["tailSide"] = "none";

  if (vw >= 768) {
    if (rect.height < 130 && spaceBelow >= estCardH) {
      top = rect.bottom + gap;
      left = Math.max(12, Math.min(vw - cardW - 12, rect.left + rect.width / 2 - cardW / 2));
      tailSide = "top";
    } else if (rect.height < 130 && spaceAbove >= estCardH) {
      top = Math.max(12, rect.top - estCardH - gap);
      left = Math.max(12, Math.min(vw - cardW - 12, rect.left + rect.width / 2 - cardW / 2));
      tailSide = "bottom";
    } else if (spaceRight >= cardW + gap) {
      left = rect.right + gap;
      top = Math.max(16, Math.min(vh - estCardH - 48, rect.top + 24));
      tailSide = "left";
    } else if (spaceLeft >= cardW + gap) {
      left = rect.left - cardW - gap;
      top = Math.max(16, Math.min(vh - estCardH - 48, rect.top + 24));
      tailSide = "right";
    } else {
      top = Math.max(16, Math.min(vh - estCardH - 48, rect.top + 24));
      left = Math.max(12, vw - cardW - 20);
      tailSide = "none";
    }
  } else {
    top = Math.max(16, vh - estCardH - 52);
    left = Math.max(12, (vw - cardW) / 2);
  }

  const cursorX = Math.max(16, Math.min(vw - 36, rect.left + Math.min(rect.width - 28, Math.max(24, rect.width * 0.72))));
  const cursorY = Math.max(16, Math.min(vh - 36, rect.top + Math.min(rect.height - 20, Math.max(16, Math.min(44, rect.height * 0.3)))));

  return { top, left, tailSide, cursorX, cursorY };
}

/** Floating cloud guide card with target highlight & animated cursor pointer. */
export function TutorialCoach() {
  const { user } = useAuth();
  const demo = useOptionalLearnDemo();
  const router = useRouter();
  const rawPathname = usePathname();
  const pathname = demo ? demo.activeRoute : rawPathname;
  const userId = demo ? "public-learn-demo" : user?.id;
  const [progress, setProgress] = useState<TutorialProgress>(EMPTY_PROGRESS);
  const [loaded, setLoaded] = useState(false);
  const [completedStepId, setCompletedStepId] = useState<string | null>(null);
  const [layout, setLayout] = useState<CloudBoxLayout | null>(null);

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
  const stepActionDone = !!step?.id && completedStepId === step.id;

  // Detect live on-screen ledger mutations so user actions mark the step completed.
  useEffect(() => {
    if (!step?.id) return;
    const onLedgerAction = () => setCompletedStepId(step.id);
    window.addEventListener("deku_ledger_updated", onLedgerAction);
    return () => window.removeEventListener("deku_ledger_updated", onLedgerAction);
  }, [step?.id]);

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

  // Locate target element, highlight it, bind action click listener, and position cloud dialog + cursor.
  useEffect(() => {
    if (!step?.target || (step.route && pathname !== step.route)) {
      const clearId = requestAnimationFrame(() => setLayout(null));
      return () => cancelAnimationFrame(clearId);
    }

    let el: Element | null = null;
    let boundEl: Element | null = null;
    const onTargetInteract = () => {
      if (step?.id) setCompletedStepId(step.id);
    };

    const syncPosition = () => {
      if (!el || typeof window === "undefined") return;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      setLayout(computeCloudLayout(rect, window.innerWidth, window.innerHeight));
    };

    let tries = 0;
    const timer = setInterval(() => {
      el =
        [...document.querySelectorAll(`[data-tour="${step.target}"]`)].find(
          (e) => e.getClientRects().length > 0
        ) ?? null;
      if (el || ++tries > 25) clearInterval(timer);
      if (el) {
        el.classList.add("tour-highlight");
        el.scrollIntoView({ block: "nearest", inline: "nearest" });
        syncPosition();
        if (boundEl !== el) {
          el.addEventListener("click", onTargetInteract, { capture: true });
          boundEl = el;
        }
      }
    }, 150);

    window.addEventListener("resize", syncPosition);
    window.addEventListener("scroll", syncPosition, true);

    return () => {
      clearInterval(timer);
      window.removeEventListener("resize", syncPosition);
      window.removeEventListener("scroll", syncPosition, true);
      el?.classList.remove("tour-highlight");
      boundEl?.removeEventListener("click", onTargetInteract, { capture: true });
    };
  }, [step?.id, step?.target, step?.route, pathname]);

  const fallbackClass =
    "fixed z-40 bottom-14 left-4 right-4 sm:left-auto sm:w-96 rounded-2xl border-2 border-brand/50 bg-surface shadow-2xl p-4 space-y-2.5 text-xs text-ink-soft";

  if ((!user && !demo) || !loaded) return null;

  if (!path || !step) {
    if (progress.welcomed || progress.active) return null;
    return (
      <section aria-label="Welcome" className={fallbackClass}>
        <h2 className="text-sm font-bold text-ink">
          {demo ? `Interactive Tour: ${demo.dataset.org.name}` : "Welcome to Deku Finance"}
        </h2>
        <p>
          {demo
            ? "Let Deku guide you step-by-step across the Gateway, Quick KPIs, Vouchers, GST, and Business Value — or explore freely."
            : "A short guided tour covers setting up your company. It only points things out and never saves anything for you."}
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            size="sm"
            onClick={() => update(startPath(progress, demo ? PRODUCT_WALKTHROUGH_PATH.id : FIRST_PATH))}
          >
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
  const pctDone = Math.round(((index + 1) / path.steps.length) * 100);
  const inlinePos: React.CSSProperties | undefined = layout
    ? { top: layout.top, left: layout.left, width: "min(380px, calc(100vw - 24px))" }
    : undefined;

  return (
    <>
      {/* Animated Cursor Direction Pointer hovering beside highlighted target */}
      {layout && (
        <div
          aria-hidden="true"
          className="fixed z-50 pointer-events-none transition-all duration-300"
          style={{ top: layout.cursorY, left: layout.cursorX }}
        >
          <span className="relative flex h-9 w-9 items-center justify-center">
            <span className="absolute inline-flex h-full w-full rounded-full bg-brand/40 animate-ping" />
            <span className="relative inline-flex h-7 w-7 items-center justify-center rounded-full bg-panel-deep border-2 border-brand shadow-lg text-brand">
              <MousePointer2 className="h-4 w-4 -rotate-12 fill-brand" />
            </span>
          </span>
        </div>
      )}

      {/* Floating Cloud Callout Dialog anchored next to the highlighted element */}
      <section
        aria-label={`Tutorial: ${path.title}`}
        style={inlinePos}
        className={
          layout
            ? "fixed z-40 rounded-2xl border-2 border-brand/60 bg-surface shadow-2xl p-4 space-y-2.5 text-xs text-ink-soft transition-all duration-200"
            : fallbackClass
        }
      >
        {/* Speech-Bubble Cloud Tail */}
        {layout?.tailSide === "top" && (
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 h-3.5 w-3.5 rotate-45 border-l-2 border-t-2 border-brand/60 bg-surface" />
        )}
        {layout?.tailSide === "bottom" && (
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 h-3.5 w-3.5 rotate-45 border-r-2 border-b-2 border-brand/60 bg-surface" />
        )}
        {layout?.tailSide === "left" && (
          <div className="absolute top-8 -left-2 h-3.5 w-3.5 rotate-45 border-l-2 border-b-2 border-brand/60 bg-surface" />
        )}
        {layout?.tailSide === "right" && (
          <div className="absolute top-8 -right-2 h-3.5 w-3.5 rotate-45 border-r-2 border-t-2 border-brand/60 bg-surface" />
        )}

        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2 text-[10px] font-mono uppercase tracking-wider text-brand-strong font-bold">
            <span className="inline-flex items-center gap-1 truncate">
              <Sparkles className="h-3 w-3 shrink-0" />
              {path.title}
            </span>
            <span className="shrink-0">
              {index + 1} / {path.steps.length}
            </span>
          </div>
          <div className="h-1 w-full rounded-full bg-canvas-sunken overflow-hidden">
            <div className="h-full bg-brand transition-all duration-300" style={{ width: `${pctDone}%` }} />
          </div>
        </div>

        <div aria-live="polite" className="space-y-2">
          <h2 className="text-sm font-bold text-ink leading-snug">{step.title}</h2>
          <p className="leading-relaxed text-ink-soft">{step.body}</p>

          {step.actionPrompt && (
            <div
              className={`rounded-xl border px-2.5 py-2 text-[11px] font-medium ${
                stepActionDone
                  ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                  : "border-amber-300 bg-amber-50 text-amber-950"
              }`}
            >
              <div className="flex items-center gap-1 font-bold uppercase text-[10px] tracking-wider">
                {stepActionDone && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
                <span>{stepActionDone ? "Action Completed — Great!" : "Your Turn on Screen"}</span>
              </div>
              <span className="block mt-0.5">{step.actionPrompt}</span>
            </div>
          )}

          {step.accountingImpact && (
            <div className="rounded-lg border border-brand/25 bg-brand/5 px-2.5 py-1.5 text-[11px] font-mono text-ink">
              {step.accountingImpact}
            </div>
          )}

          {step.businessValuePoints && step.businessValuePoints.length > 0 && (
            <div className="rounded-xl border border-emerald-300 bg-emerald-50/90 p-2.5 space-y-1.5 text-[11px] text-emerald-950">
              <div className="flex items-center gap-1.5 font-bold uppercase text-[10px] tracking-wider text-emerald-800">
                <TrendingUp className="h-3.5 w-3.5" />
                <span>Value for Your Business</span>
              </div>
              <ul className="space-y-1">
                {step.businessValuePoints.map((pt) => (
                  <li key={pt} className="leading-snug flex items-start gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{pt}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {demo && step.route && pathname !== step.route && (
            <button
              type="button"
              onClick={() => demo.navigateTo(step.route!)}
              className="text-[11px] font-bold text-brand-strong hover:underline cursor-pointer"
            >
              &rarr; Jump back to highlighted screen ({step.route})
            </button>
          )}
        </div>

        {demo ? (
          <div className="rounded-lg border border-line bg-canvas px-2.5 py-1 text-[10px] text-ink-muted flex items-center justify-between gap-2">
            <span>
              Role: <strong className="text-ink">{demo.roleConfig.label}</strong> &middot; Plan:{" "}
              <strong className="text-ink">{getDemoPlanConfig(demo.plan).name}</strong>
            </span>
          </div>
        ) : (
          <p className="text-[10px] text-ink-muted">
            {user?.is_demo
              ? "Demo company: everything here is fictional."
              : "This is your real company. Nothing is saved unless you press save or post yourself."}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          <Button size="sm" variant="outline" disabled={index === 0} onClick={() => update(previousStep(progress, path))}>
            Back
          </Button>
          <Button size="sm" onClick={() => update(nextStep(progress, path))}>
            {isLast ? "Finish Tour" : "Next →"}
          </Button>
          {demo && isLast && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                update(nextStep(progress, path));
                demo.setWorkflowDrawerOpen(true);
              }}
            >
              8 Workflows
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => update(pausePath(progress))} className="ml-auto">
            {demo ? "Skip" : "Pause"}
          </Button>
        </div>
      </section>
    </>
  );
}
