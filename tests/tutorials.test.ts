import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TUTORIAL_PATHS } from "@/lib/tutorials/paths";
import {
  EMPTY_PROGRESS,
  currentIndex,
  isComplete,
  nextStep,
  pausePath,
  previousStep,
  restartPath,
  startPath,
} from "@/lib/tutorials/progress";

const path = { id: "p", steps: [{ id: "a" }, { id: "b" }] };

describe("tutorial progress", () => {
  it("moves through a path and finishes", () => {
    let p = startPath(EMPTY_PROGRESS, "p");
    expect(p.active).toBe("p");
    p = nextStep(p, path);
    expect(currentIndex(p, path)).toBe(1);
    expect(isComplete(p, path)).toBe(false);
    p = nextStep(p, path);
    expect(p.active).toBeNull();
    expect(isComplete(p, path)).toBe(true);
  });

  it("pauses and resumes at the same step", () => {
    const paused = pausePath(nextStep(startPath(EMPTY_PROGRESS, "p"), path));
    expect(paused.active).toBeNull();
    expect(currentIndex(startPath(paused, "p"), path)).toBe(1);
  });

  it("restart clears a completed path", () => {
    const done = nextStep(nextStep(startPath(EMPTY_PROGRESS, "p"), path), path);
    const again = restartPath(done, "p");
    expect(isComplete(again, path)).toBe(false);
    expect(currentIndex(again, path)).toBe(0);
    expect(again.active).toBe("p");
  });

  it("stays in range at both ends, including after steps are removed", () => {
    expect(currentIndex(previousStep(startPath(EMPTY_PROGRESS, "p"), path), path)).toBe(0);
    expect(currentIndex({ ...EMPTY_PROGRESS, positions: { p: 99 } }, path)).toBe(1);
  });

  it("reopens the page for each new step", () => {
    const opened = { ...startPath(EMPTY_PROGRESS, "p"), routeOpened: true };
    expect(nextStep(opened, path).routeOpened).toBe(false);
    expect(previousStep(opened, path).routeOpened).toBe(false);
  });
});

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.tsx$/.test(name) ? [full] : [];
  });
}

describe("tutorial content matches the app", () => {
  const steps = TUTORIAL_PATHS.flatMap((p) => p.steps);
  const source = sourceFiles("src").map((f) => readFileSync(f, "utf8")).join("\n");

  it("has the nine required paths", () => {
    expect(TUTORIAL_PATHS.map((p) => p.id)).toEqual([
      "first-setup",
      "accounting-fundamentals",
      "sales-invoicing",
      "purchases-expenses",
      "banking-reconciliation",
      "reports-control",
      "documents-operations",
      "administrator",
      "implementer",
    ]);
  });

  it("keeps step ids unique within each path, and no path is empty", () => {
    for (const p of TUTORIAL_PATHS) {
      expect(p.steps.length).toBeGreaterThan(0);
      expect(new Set(p.steps.map((s) => s.id)).size).toBe(p.steps.length);
    }
  });

  it("only sends people to pages that exist", () => {
    const missing = steps.filter((s) => s.route && !existsSync(join("src/app", s.route, "page.tsx"))).map((s) => s.route);
    expect(missing).toEqual([]);
  });

  it("only points at elements that exist in the source, on a step with a page", () => {
    const missing = steps.filter((s) => s.target && !source.includes(`data-tour="${s.target}"`)).map((s) => s.target);
    expect(missing).toEqual([]);
    expect(steps.filter((s) => s.target && !s.route).map((s) => s.id)).toEqual([]);
  });

  it("keeps implementer guidance out of the screens", () => {
    const implementer = TUTORIAL_PATHS.find((p) => p.id === "implementer");
    expect(implementer?.audience).toBe("implementer");
    expect(implementer?.steps.every((s) => !s.route)).toBe(true);
  });
});
