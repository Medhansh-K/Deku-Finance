"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Circle } from "lucide-react";
import { organisationsApi } from "@/api/endpoints";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/context/AuthContext";
import { TUTORIAL_PATHS, type TutorialPath } from "@/lib/tutorials/paths";
import {
  EMPTY_PROGRESS,
  isComplete,
  loadProgress,
  onProgressChanged,
  restartPath,
  saveProgress,
  startPath,
  type TutorialProgress,
} from "@/lib/tutorials/progress";

const ADMIN_ROLES = ["owner", "admin"];

export function HelpCentreView() {
  const { user, organisation } = useAuth();
  const fromRoute = useSearchParams().get("route");
  const [query, setQuery] = useState("");
  const [progress, setProgress] = useState<TutorialProgress>(EMPTY_PROGRESS);
  const [role, setRole] = useState<string | null>(null);
  const userId = user?.id;
  const orgId = organisation?.id;

  useEffect(() => {
    if (!userId) return;
    const read = () => setProgress(loadProgress(userId));
    read();
    return onProgressChanged(read);
  }, [userId]);

  useEffect(() => {
    if (!orgId || !userId) return;
    organisationsApi
      .listMembers(orgId)
      .then((res) => setRole(res.data?.find((m: { user_id: string }) => m.user_id === userId)?.role ?? null))
      .catch(() => setRole(null));
  }, [orgId, userId]);

  // Only guidance is hidden here; the server enforces what each role can actually do.
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const allowed = TUTORIAL_PATHS.filter((p) => p.audience === "everyone" || (role !== null && ADMIN_ROLES.includes(role)));
    const matching = q
      ? allowed.filter((p) => [p.title, p.summary, ...p.steps.flatMap((s) => [s.title, s.body])].join(" ").toLowerCase().includes(q))
      : allowed;
    const forPage = (p: TutorialPath) => p.steps.some((s) => s.route === fromRoute);
    return [...matching].sort((a, b) => Number(forPage(b)) - Number(forPage(a)));
  }, [query, role, fromRoute]);

  const save = (next: TutorialProgress) => {
    if (userId) saveProgress(userId, next);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4 text-[13.5px]">
      <div>
        <label htmlFor="tutorial-search" className="block text-[13px] text-ink-muted mb-1.5">
          Search tutorials
        </label>
        <input
          id="tutorial-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="For example: trial balance, invite, credit note"
          className="w-full h-9 px-3 rounded-ctl border border-line-strong bg-surface text-ink placeholder:text-ink-subtle focus:border-brand focus:outline-none"
        />
      </div>

      <p className="text-ink-muted">
        Tutorials explain and point things out on the real screens. They never save anything: entries only happen when you press save or post yourself.
      </p>

      {visible.length === 0 && <p className="text-ink-soft py-6 text-center">No tutorial matches that search.</p>}

      {visible.map((path) => {
        const seen = progress.done[path.id] ?? [];
        const complete = isComplete(progress, path);
        const started = seen.length > 0 || (progress.positions[path.id] ?? 0) > 0;
        const isActive = progress.active === path.id;
        return (
          <section key={path.id} className="bg-surface border border-line rounded-panel p-5 space-y-2.5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="text-[15px] font-semibold tracking-tight text-ink">{path.title}</h2>
                <p className="text-ink-soft mt-0.5">{path.summary}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {path.audience !== "everyone" && <Badge variant="default">{path.audience === "admin" ? "Administrators" : "Implementers"}</Badge>}
                {complete && <Badge variant="success">Completed</Badge>}
                <span className="tabular-nums text-[13px] text-ink-muted">
                  {seen.length}/{path.steps.length}
                </span>
              </div>
            </div>
            <p className="text-ink-muted">
              <strong className="font-medium text-ink-soft">You&apos;ll be able to:</strong> {path.outcome} <strong className="font-medium text-ink-soft">Before you start:</strong> {path.prerequisites}
            </p>
            <div className="flex flex-wrap gap-2">
              {isActive ? (
                <Badge variant="teal">In progress, see the guide card</Badge>
              ) : (
                <Button size="sm" onClick={() => save(startPath(progress, path.id))}>
                  {started && !complete ? "Resume" : "Start"}
                </Button>
              )}
              {(started || complete) && (
                <Button size="sm" variant="outline" onClick={() => save(restartPath(progress, path.id))}>
                  Restart
                </Button>
              )}
            </div>
            <details>
              <summary className="cursor-pointer font-medium text-ink-soft">Steps</summary>
              <ol className="mt-2 space-y-1">
                {path.steps.map((s) => (
                  <li key={s.id} className="flex items-start gap-1.5 text-ink-soft">
                    {seen.includes(s.id) ? (
                      <CheckCircle2 aria-label="Viewed" className="h-3.5 w-3.5 mt-0.5 shrink-0 text-ok" />
                    ) : (
                      <Circle aria-label="Not viewed" className="h-3.5 w-3.5 mt-0.5 shrink-0 text-ink-subtle" />
                    )}
                    <span>{s.title}</span>
                  </li>
                ))}
              </ol>
            </details>
          </section>
        );
      })}
    </div>
  );
}
