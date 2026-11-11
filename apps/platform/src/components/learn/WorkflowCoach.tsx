"use client";

import React, { useEffect, useReducer, useRef, useState } from "react";
import { ArrowRight, BookOpen, Check, ChevronDown, ChevronUp, CircleDashed, RotateCcw, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useLearnDemo } from "@/context/LearnDemoContext";
import { DEMO_ACTIVITY_EVENT } from "@/lib/learn/activity";
import { getDemoRoleConfig } from "@/lib/learn/demo-roles";
import { getDemoCompany } from "@/lib/learn/companies";
import { LEARN_WORKFLOWS, getLearnWorkflow } from "@/lib/learn/workflows/catalogue";
import {
  checkStep,
  currentStep,
  describeExpectation,
  exitWorkflow,
  isWorkflowComplete,
  nextStep,
  openWorkflow,
  previousStep,
  roleSwitchFor,
  runStartSeq,
  skipStep,
  summariseChanges,
} from "@/lib/learn/workflows/runner";
import type { LearnWorkflow, LearnWorkflowStep } from "@/lib/learn/workflows/types";
import { TourPointer, TourTail, useTourHighlight } from "@/components/tutorial/tour-highlight";

const base = (route: string) => route.split("?")[0];
const roleLabel = (role: string) => getDemoRoleConfig(role).label;
const cardClass = "rounded-panel border border-line-strong bg-surface shadow-pop p-4 space-y-3 text-[13.5px] text-ink-soft";
const dockedClass = `fixed z-40 bottom-14 left-3 right-3 sm:left-auto sm:right-4 sm:w-[400px] max-h-[calc(100vh-8rem)] overflow-y-auto ${cardClass}`;

/** The step card for a running Learn Centre workflow. Rendered by TutorialCoach in demo mode. */
export function WorkflowCoach() {
  const demo = useLearnDemo();
  const wf = getLearnWorkflow(demo.workflowState.active ?? "");
  const progress = wf ? demo.workflowState.progress[wf.id] : undefined;

  // A workflow removed from the catalogue (or a damaged save) just closes the coach.
  useEffect(() => {
    if (!wf || !progress) demo.updateWorkflows(exitWorkflow);
  }, [wf, progress, demo]);

  if (!wf || !progress) return null;
  const step = currentStep(wf, progress);
  return step ? <StepCard wf={wf} step={step} /> : <CompletionCard wf={wf} />;
}

function StepCard({ wf, step }: { wf: LearnWorkflow; step: LearnWorkflowStep }) {
  const demo = useLearnDemo();
  const { activity, activeRoute, role, workflowState, updateWorkflows, navigateTo, switchRole, companySlug } = demo;
  const progress = workflowState.progress[wf.id];
  const index = progress.stepIndex;
  const stepKey = `${wf.id}:${progress.startedAt}:${index}`;
  const [collapsed, setCollapsed] = useState(false);
  const [blockedReason, setBlockedReason] = useState<string | null>(null);
  const [, recheck] = useReducer((n: number) => n + 1, 0);
  const switchedFor = useRef<string | null>(null);
  const openedFor = useRef<string | null>(null);
  const [switchedTo, setSwitchedTo] = useState<{ key: string; role: string } | null>(null);

  // The recorder fires this for every activity; re-check immediately (the context log also re-renders us).
  useEffect(() => {
    const onActivity = () => {
      setBlockedReason(null);
      recheck();
    };
    window.addEventListener(DEMO_ACTIVITY_EVENT, onActivity);
    return () => window.removeEventListener(DEMO_ACTIVITY_EVENT, onActivity);
  }, []);

  // On arriving at a step: switch to its role first, then open its screen. Once per step, so the
  // visitor can look around (or try another role) without being dragged back.
  const neededRole = roleSwitchFor(step, role);
  useEffect(() => {
    if (neededRole && switchedFor.current !== stepKey) {
      switchedFor.current = stepKey;
      setSwitchedTo({ key: stepKey, role: neededRole });
      switchRole(neededRole);
      return;
    }
    switchedFor.current = stepKey;
    if (openedFor.current === stepKey) return;
    openedFor.current = stepKey;
    if (base(activeRoute) !== base(step.route)) navigateTo(step.route);
  }, [stepKey, neededRole, step.route, activeRoute, navigateTo, switchRole]);

  const onStepScreen = base(activeRoute) === base(step.route);
  const layout = useTourHighlight(collapsed ? undefined : step.target, onStepScreen, 420);
  const check = checkStep(wf, progress, activity, activeRoute);
  const total = wf.steps.length;
  const goal = describeExpectation(step);

  const goNext = () => {
    const res = nextStep(workflowState, wf, activity, activeRoute);
    if (res.ok) {
      setBlockedReason(null);
      updateWorkflows(() => res.state);
    } else setBlockedReason(res.reason ?? null);
  };

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        className="fixed z-40 bottom-14 right-4 inline-flex items-center gap-2 h-9 px-3 rounded-ctl border border-line-strong bg-surface shadow-pop text-[13px] text-ink"
      >
        <span className="font-mono text-brand-strong">{wf.code}</span>
        <span className="tabular-nums text-ink-muted">
          Step {index + 1} of {total}
        </span>
        {check.satisfied ? <Check className="h-3.5 w-3.5 text-ok" /> : <CircleDashed className="h-3.5 w-3.5 text-ink-muted" />}
        <ChevronUp className="h-3.5 w-3.5 text-ink-muted" />
      </button>
    );
  }

  return (
    <>
      {layout && <TourPointer layout={layout} />}
      <section
        aria-label={`Workflow ${wf.code}: ${wf.name}`}
        data-testid="workflow-coach"
        style={layout ? { top: layout.top, left: layout.left, width: "min(400px, calc(100vw - 24px))" } : undefined}
        className={layout ? `fixed z-40 transition-all duration-200 ${cardClass}` : dockedClass}
      >
        {layout && <TourTail side={layout.tailSide} />}

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2 text-[12.5px]">
            <span className="min-w-0 truncate text-ink-muted">
              <span className="font-mono text-brand-strong">{wf.code}</span> · {wf.name}
            </span>
            <span className="flex shrink-0 items-center gap-1">
              <span className="tabular-nums text-ink-muted">
                Step {index + 1} of {total}
              </span>
              <button type="button" aria-label="Minimise the guide" onClick={() => setCollapsed(true)} className="rounded-chip p-0.5 text-ink-muted hover:bg-canvas-sunken">
                <ChevronDown className="h-4 w-4" />
              </button>
            </span>
          </div>
          <div className="flex gap-0.5" aria-hidden="true">
            {wf.steps.map((s, i) => (
              <span
                key={s.id}
                className={`h-1 flex-1 rounded-full ${
                  progress.completedSteps.includes(s.id) ? "bg-brand" : progress.skippedSteps.includes(s.id) ? "bg-line-strong" : i === index ? "bg-brand-wash-strong" : "bg-canvas-sunken"
                }`}
              />
            ))}
          </div>
        </div>

        {companySlug !== wf.recommendedCompany && (
          <p className="rounded-ctl bg-canvas-sunken px-3 py-2 text-[12.5px] text-ink-muted">
            {!wf.industries.includes(companySlug) && wf.industryNote
              ? wf.industryNote
              : `The steps quote ${getDemoCompany(wf.recommendedCompany)?.tradeName}'s names and figures; in ${getDemoCompany(companySlug)?.tradeName} pick the equivalent ones.`}
          </p>
        )}
        {switchedTo?.key === stepKey && !neededRole && (
          <p className="inline-flex items-center h-[22px] px-2 rounded-chip text-xs font-medium bg-brand-wash text-brand-strong">Now as the {roleLabel(switchedTo.role)}</p>
        )}
        {neededRole && (
          <div className="rounded-ctl bg-warn-wash px-3 py-2 text-[13px] text-warn space-y-1.5">
            <p className="flex items-start gap-1.5">
              <ShieldAlert className="h-4 w-4 shrink-0 mt-px" />
              <span>
                This step is done as the {roleLabel(neededRole)}. You are previewing as {roleLabel(role)}, so the screen may block it.
              </span>
            </p>
            <Button size="sm" variant="secondary" onClick={() => switchRole(neededRole)}>
              Switch to {roleLabel(neededRole)}
            </Button>
          </div>
        )}

        <div aria-live="polite" className="space-y-1.5">
          <h2 className="text-[15px] font-semibold tracking-tight text-ink leading-snug">{step.title}</h2>
          <p className="leading-relaxed">{step.body}</p>
          {step.impact && (
            <p className="text-[13px] text-ink">
              <span className="text-ink-muted">In the books: </span>
              {step.impact}
            </p>
          )}
        </div>

        <div
          role="status"
          className={`flex items-start gap-2 rounded-ctl px-3 py-2 text-[13px] ${check.satisfied ? "bg-ok-wash text-ok" : "bg-canvas-sunken text-ink-soft"}`}
        >
          {check.satisfied ? <Check className="h-4 w-4 shrink-0 mt-px" /> : <CircleDashed className="h-4 w-4 shrink-0 mt-px text-ink-muted" />}
          <span>
            {check.satisfied ? `Done: ${check.by?.summary ?? "you are on this screen"}` : `Waiting for you to ${goal}.`}
          </span>
        </div>

        {!onStepScreen && (
          <button type="button" onClick={() => navigateTo(step.route)} className="text-[13px] font-medium text-brand-strong hover:underline">
            Go back to this step&apos;s screen
          </button>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" disabled={index === 0} onClick={() => updateWorkflows((s) => previousStep(s, wf))}>
            Back
          </Button>
          <Button size="sm" variant="tally" disabled={!check.satisfied} onClick={goNext} title={check.satisfied ? undefined : `Waiting for you to ${goal}`}>
            {index === total - 1 ? "Finish" : "Next"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => updateWorkflows((s, log) => skipStep(s, wf, log))}>
            Skip this step
          </Button>
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => updateWorkflows(exitWorkflow)}>
            Exit
          </Button>
        </div>
        {!check.satisfied && (
          <p className="text-[12.5px] text-ink-muted">
            {blockedReason ?? `Next unlocks once you ${goal}.`} Skipping records the step as skipped, not done.
          </p>
        )}
        {wf.docs[0] && (
          <a href={`/learn/docs/${wf.docs[0]}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[13px] text-ink-muted hover:text-ink">
            <BookOpen className="h-3.5 w-3.5" />
            Read about this workflow
          </a>
        )}
      </section>
    </>
  );
}

function CompletionCard({ wf }: { wf: LearnWorkflow }) {
  const { activity, workflowState, updateWorkflows, resetDemo, dataset } = useLearnDemo();
  const progress = workflowState.progress[wf.id];
  const changes = summariseChanges(activity, runStartSeq(wf, progress));
  const complete = isWorkflowComplete(wf, progress);
  const skipped = progress.skippedSteps.length;
  const order = LEARN_WORKFLOWS.findIndex((w) => w.id === wf.id);
  const suggestions = [...LEARN_WORKFLOWS.slice(order + 1), ...LEARN_WORKFLOWS.slice(0, Math.max(order, 0))]
    .filter((w) => !isWorkflowComplete(w, workflowState.progress[w.id]))
    .slice(0, 3);

  return (
    <section aria-label={`${wf.code} finished`} data-testid="workflow-complete" className={dockedClass}>
      <div className="space-y-1">
        <p className="text-[12.5px] text-ink-muted">
          <span className="font-mono text-brand-strong">{wf.code}</span> · {wf.name}
        </p>
        <h2 className="text-[17px] font-semibold tracking-tight text-ink">{complete && skipped === 0 ? "Workflow complete" : "Workflow finished"}</h2>
        <p>
          {skipped === 0
            ? `Every step was done in ${dataset.org.name}'s books. ${wf.completion}`
            : `${wf.steps.length - skipped} of ${wf.steps.length} steps done; ${skipped} skipped. Go back to finish the skipped ones.`}
        </p>
      </div>

      <div className="rounded-ctl border border-line">
        <p className="px-3 pt-2 text-[12.5px] text-ink-muted">What changed during this run</p>
        {changes.length === 0 ? (
          <p className="px-3 pb-2 pt-1 text-[13px]">No change to the books: this workflow only reads them.</p>
        ) : (
          <ul className="px-3 pb-2 pt-1 space-y-0.5 text-[13px] text-ink">
            {changes.map((c) => (
              <li key={c.type} className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-ok shrink-0" />
                {c.label}
              </li>
            ))}
          </ul>
        )}
      </div>

      {suggestions.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[12.5px] text-ink-muted">Next workflow</p>
          {suggestions.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => updateWorkflows((st, log) => openWorkflow(st, s, log))}
              className="flex w-full items-center gap-2 rounded-ctl px-2 py-1.5 text-left hover:bg-brand-wash"
            >
              <span className="font-mono text-[12.5px] text-brand-strong">{s.code}</span>
              <span className="flex-1 truncate text-[13.5px] font-medium text-ink">{s.name}</span>
              <ArrowRight className="h-3.5 w-3.5 text-ink-muted" />
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => updateWorkflows((s) => previousStep(s, wf))}>
          Back
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            if (window.confirm(`Reset ${dataset.org.name}'s books and workflow progress to the starting sample data?`)) resetDemo();
          }}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset books
        </Button>
        <Button size="sm" className="ml-auto" onClick={() => updateWorkflows(exitWorkflow)}>
          Close
        </Button>
      </div>
    </section>
  );
}
