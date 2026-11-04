// Tutorial progress. Per user, in this browser.
// shortcut: progress doesn't follow someone to another device; move to the database if that's missed.

export interface TutorialProgress {
  active: string | null; // path id being followed now
  positions: Record<string, number>; // next step index per path, kept while paused
  done: Record<string, string[]>; // step ids viewed per path
  routeOpened: boolean; // the coach has opened the current step's page, so it won't drag the user back
  welcomed: boolean;
}

export const EMPTY_PROGRESS: TutorialProgress = { active: null, positions: {}, done: {}, routeOpened: false, welcomed: false };

const CHANGED_EVENT = "deku_tutorial_changed";
const key = (userId: string) => `deku_tutorial_progress_${userId}`;

export function loadProgress(userId: string): TutorialProgress {
  try {
    const raw = localStorage.getItem(key(userId));
    return raw ? { ...EMPTY_PROGRESS, ...JSON.parse(raw) } : EMPTY_PROGRESS;
  } catch {
    return EMPTY_PROGRESS;
  }
}

export function saveProgress(userId: string, progress: TutorialProgress) {
  try {
    localStorage.setItem(key(userId), JSON.stringify(progress));
  } catch {
    // Private windows can refuse storage; the tutorial still works for this page.
  }
  window.dispatchEvent(new Event(CHANGED_EVENT));
}

export function onProgressChanged(listener: () => void) {
  window.addEventListener(CHANGED_EVENT, listener);
  return () => window.removeEventListener(CHANGED_EVENT, listener);
}

interface PathSteps {
  id: string;
  steps: { id: string }[];
}

export const startPath = (p: TutorialProgress, pathId: string): TutorialProgress => ({
  ...p,
  active: pathId,
  routeOpened: false,
  welcomed: true,
});

export const pausePath = (p: TutorialProgress): TutorialProgress => ({ ...p, active: null });

export const restartPath = (p: TutorialProgress, pathId: string): TutorialProgress =>
  startPath({ ...p, positions: { ...p.positions, [pathId]: 0 }, done: { ...p.done, [pathId]: [] } }, pathId);

/** The step to show; steps can be removed in an update, so a stored position may be past the end. */
export const currentIndex = (p: TutorialProgress, path: PathSteps): number =>
  Math.min(p.positions[path.id] ?? 0, Math.max(path.steps.length - 1, 0));

/** Marks the current step viewed and moves on. Past the last step, the path ends. */
export function nextStep(p: TutorialProgress, path: PathSteps): TutorialProgress {
  const index = currentIndex(p, path);
  const seen = new Set(p.done[path.id] ?? []);
  seen.add(path.steps[index].id);
  const finished = index >= path.steps.length - 1;
  return {
    ...p,
    active: finished ? null : p.active,
    positions: { ...p.positions, [path.id]: finished ? 0 : index + 1 },
    done: { ...p.done, [path.id]: [...seen] },
    routeOpened: false,
  };
}

export const previousStep = (p: TutorialProgress, path: PathSteps): TutorialProgress => ({
  ...p,
  positions: { ...p.positions, [path.id]: Math.max(currentIndex(p, path) - 1, 0) },
  routeOpened: false,
});

export const isComplete = (p: TutorialProgress, path: PathSteps): boolean =>
  path.steps.length > 0 && path.steps.every((s) => p.done[path.id]?.includes(s.id));
