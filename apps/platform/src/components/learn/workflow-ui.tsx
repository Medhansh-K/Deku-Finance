import React from "react";
import type { WorkflowStatus } from "@/lib/learn/workflows/runner";

const chip = "inline-flex items-center h-[22px] px-2 rounded-chip text-xs font-medium whitespace-nowrap";

/** Not started / in progress, step x of n / done, as a status chip. */
export function WorkflowStatusChip({ status }: { status: WorkflowStatus }) {
  if (status.kind === "done")
    return <span className={`${chip} bg-ok-wash text-ok`}>{status.skipped ? `Done, ${status.skipped} skipped` : "Done"}</span>;
  if (status.kind === "in-progress")
    return (
      <span className={`${chip} bg-brand-wash text-brand-strong tabular-nums`}>
        In progress, step {status.step} of {status.of}
      </span>
    );
  return <span className={`${chip} bg-canvas-sunken text-ink-muted`}>Not started</span>;
}

export const startLabel = (status: WorkflowStatus) => (status.kind === "in-progress" ? "Resume" : status.kind === "done" ? "Start again" : "Start");
