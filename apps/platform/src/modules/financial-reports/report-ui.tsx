import React from "react";
import { AlertTriangle } from "lucide-react";

// Shared class strings so every statement screen reads the same.
export const ui = {
  page: "space-y-4 text-[13.5px] text-ink",
  toolbar: "flex flex-col sm:flex-row sm:items-end justify-between gap-3 rounded-panel border border-line bg-surface px-5 py-4",
  note: "text-[12.5px] text-ink-muted",
  panel: "rounded-panel border border-line bg-surface overflow-hidden",
  panelHead: "flex items-center justify-between gap-3 px-5 pt-4 pb-3",
  panelTitle: "text-[15px] font-semibold tracking-tight text-ink",
  panelSub: "text-[13px] text-ink-muted",
  th: "px-3.5 py-2.5 text-[12.5px] font-medium text-ink-muted bg-canvas-sunken/50 border-b border-line whitespace-nowrap",
  td: "px-3.5 py-2.5",
  band: "px-3.5 py-2 text-[13px] font-semibold text-ink bg-canvas-sunken/50 border-y border-line",
  total: "px-3.5 py-3 font-semibold text-ink border-t border-line-strong",
  rowLink: "hover:bg-brand-wash cursor-pointer",
  code: "font-mono text-[12.5px] text-ink-soft",
  kpi: "rounded-panel border border-line bg-surface px-[18px] py-4",
  kpiLabel: "flex items-center gap-2 text-[13px] text-ink-muted",
  kpiValue: "mt-1.5 mb-1 text-[26px] font-semibold leading-tight tracking-[-0.035em] text-ink tabular-nums",
  kpiNote: "text-[12.5px] text-ink-muted",
  chip: "inline-flex items-center gap-1 h-[22px] px-2 rounded-chip text-xs font-medium",
  select: "h-9 rounded-ctl border border-line-strong bg-surface px-3 text-[13.5px] text-ink focus:border-brand focus:outline-none focus:ring-3 focus:ring-brand/20",
};

export function ReportError({ title, message, onRetry }: { title: string; message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-center justify-between gap-3 rounded-panel border border-bad/25 bg-bad-wash px-5 py-3.5 text-[13.5px] text-bad">
      <div className="flex items-center gap-2.5">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <div>
          <p className="font-semibold">{title}</p>
          <p>{message}</p>
        </div>
      </div>
      {onRetry && (
        <button onClick={onRetry} className="font-medium underline underline-offset-2 hover:no-underline">
          Retry
        </button>
      )}
    </div>
  );
}
