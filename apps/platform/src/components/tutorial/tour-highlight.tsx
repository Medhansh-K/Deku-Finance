"use client";

import React, { useEffect, useState } from "react";
import { MousePointer2 } from "lucide-react";

export interface CloudBoxLayout {
  top: number;
  left: number;
  tailSide: "top" | "bottom" | "left" | "right" | "none";
  cursorX: number;
  cursorY: number;
}

export function computeCloudLayout(rect: DOMRect, vw: number, vh: number, estCardH = 310): CloudBoxLayout {
  const cardW = Math.min(380, vw - 24);
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
    }
  } else {
    top = Math.max(16, vh - estCardH - 52);
    left = Math.max(12, (vw - cardW) / 2);
  }

  const cursorX = Math.max(16, Math.min(vw - 36, rect.left + Math.min(rect.width - 28, Math.max(24, rect.width * 0.72))));
  const cursorY = Math.max(16, Math.min(vh - 36, rect.top + Math.min(rect.height - 20, Math.max(16, Math.min(44, rect.height * 0.3)))));

  return { top, left, tailSide, cursorX, cursorY };
}

/**
 * Finds the visible `[data-tour=target]` element (getClientRects filters out hidden copies),
 * highlights it and returns where to put the card and pointer. Null when there's nothing to point at.
 */
export function useTourHighlight(target: string | undefined, enabled: boolean, estCardH?: number): CloudBoxLayout | null {
  const [layout, setLayout] = useState<CloudBoxLayout | null>(null);

  useEffect(() => {
    if (!target || !enabled) {
      const clearId = requestAnimationFrame(() => setLayout(null));
      return () => cancelAnimationFrame(clearId);
    }

    let el: Element | null = null;
    const syncPosition = () => {
      if (!el || typeof window === "undefined") return;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      setLayout(computeCloudLayout(rect, window.innerWidth, window.innerHeight, estCardH));
    };

    // Keeps looking for as long as the step is open: many targets only appear after a click (a form,
    // drawer or modal) and can disappear again. Until then the card stays unanchored.
    const find = () => {
      if (el?.isConnected && el.getClientRects().length > 0) return;
      el?.classList.remove("tour-highlight");
      el = [...document.querySelectorAll(`[data-tour="${target}"]`)].find((e) => e.getClientRects().length > 0) ?? null;
      if (el) {
        el.classList.add("tour-highlight");
        el.scrollIntoView({ block: "nearest", inline: "nearest" });
        syncPosition();
      } else setLayout(null);
    };
    find();
    const timer = setInterval(find, 400);

    window.addEventListener("resize", syncPosition);
    window.addEventListener("scroll", syncPosition, true);
    return () => {
      clearInterval(timer);
      window.removeEventListener("resize", syncPosition);
      window.removeEventListener("scroll", syncPosition, true);
      el?.classList.remove("tour-highlight");
      setLayout(null);
    };
  }, [target, enabled, estCardH]);

  return layout;
}

/** Pointer beside the highlighted element. */
export function TourPointer({ layout }: { layout: CloudBoxLayout }) {
  return (
    <div aria-hidden="true" className="fixed z-50 pointer-events-none transition-all duration-300" style={{ top: layout.cursorY, left: layout.cursorX }}>
      <span className="relative inline-flex h-7 w-7 items-center justify-center rounded-full bg-surface border-2 border-brand shadow-pop text-brand-strong">
        <MousePointer2 className="h-4 w-4 -rotate-12 fill-brand" />
      </span>
    </div>
  );
}

/** Speech-bubble tail pointing at the target. */
export function TourTail({ side }: { side: CloudBoxLayout["tailSide"] }) {
  const base = "absolute h-3 w-3 rotate-45 border-line-strong bg-surface";
  if (side === "top") return <div className={`${base} -top-1.5 left-1/2 -translate-x-1/2 border-l border-t`} />;
  if (side === "bottom") return <div className={`${base} -bottom-1.5 left-1/2 -translate-x-1/2 border-r border-b`} />;
  if (side === "left") return <div className={`${base} top-8 -left-1.5 border-l border-b`} />;
  if (side === "right") return <div className={`${base} top-8 -right-1.5 border-r border-t`} />;
  return null;
}
