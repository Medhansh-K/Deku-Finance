"use client";

import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { apiClient } from "@/api/client";
import type { ApiResponse } from "@/api/endpoints";
import { useAuth } from "@/context/AuthContext";
import { AppNotification, badgeLabel, bellAriaLabel, markRead, unreadIds } from "./unread";

const POLL_MS = 60_000;

const listNotifications = (orgId: string) =>
  apiClient<ApiResponse<AppNotification[]>>(`/api/v1/organisations/${orgId}/notifications`);

const postRead = (orgId: string, ids: string[]) =>
  apiClient<ApiResponse<{ marked: number }>>(`/api/v1/organisations/${orgId}/notifications/read`, {
    method: "POST",
    body: JSON.stringify({ ids }),
  });

const formatWhen = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

export function NotificationBell() {
  const { organisation } = useAuth();
  const orgId = organisation?.id ?? "";
  const [items, setItems] = useState<AppNotification[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const dialogId = useId();
  const headingId = useId();

  const load = useCallback(async () => {
    if (!orgId) return;
    try {
      const res = await listNotifications(orgId);
      setItems(res.data || []);
      setError(null);
    } catch (e) {
      setError((e as Error).message || "Could not load notifications");
    }
  }, [orgId]);

  // Poll only while the tab is visible; refresh as soon as it becomes visible again.
  useEffect(() => {
    if (!orgId) return;
    const tick = () => {
      if (document.visibilityState === "visible") load();
    };
    tick();
    const timer = window.setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [orgId, load]);

  const close = useCallback(() => {
    setOpen(false);
    buttonRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const onPointer = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!dialogRef.current?.contains(t) && !buttonRef.current?.contains(t)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open, close]);

  const read = async (ids: string[]) => {
    if (!orgId || ids.length === 0) return;
    setItems((prev) => markRead(prev, ids));
    try {
      await postRead(orgId, ids);
    } catch (e) {
      setError((e as Error).message || "Could not mark as read");
      load();
    }
  };

  const unread = unreadIds(items);
  const badge = badgeLabel(unread.length);

  if (!orgId) return null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        className="relative rounded-md p-1.5 text-ink-subtle hover:bg-panel hover:text-brand-soft focus-visible:ring-2 focus-visible:ring-brand"
        aria-label={bellAriaLabel(unread.length)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? dialogId : undefined}
        title="Notifications"
      >
        <Bell className="h-4 w-4" />
        {badge && (
          <span
            aria-hidden="true"
            className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-semibold leading-none text-panel-deep"
          >
            {badge}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={dialogRef}
          id={dialogId}
          role="dialog"
          aria-labelledby={headingId}
          tabIndex={-1}
          className="fixed bottom-16 left-3 z-50 flex max-h-[min(28rem,70vh)] w-[min(22rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-xl border border-line bg-surface text-ink shadow-pop outline-none"
        >
          <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
            <h2 id={headingId} className="text-sm font-semibold">
              Notifications
            </h2>
            {unread.length > 0 && (
              <button
                type="button"
                onClick={() => read(unread)}
                className="rounded text-xs font-medium text-brand-strong hover:underline focus-visible:ring-2 focus-visible:ring-brand"
              >
                Mark all read
              </button>
            )}
          </div>

          {error && (
            <p role="alert" className="border-b border-line px-4 py-2 text-xs text-ink-muted">
              {error}
            </p>
          )}

          {items.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-ink-muted">You&apos;re all caught up.</p>
          ) : (
            <ul className="overflow-y-auto">
              {items.map((n) => (
                <li key={n.id} className="flex gap-3 border-b border-line px-4 py-3 last:border-b-0">
                  <span
                    aria-hidden="true"
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read_at ? "bg-transparent" : "bg-brand"}`}
                  />
                  <div className="min-w-0 flex-1">
                    {n.link ? (
                      <Link
                        href={n.link}
                        onClick={() => {
                          if (!n.read_at) read([n.id]);
                          setOpen(false);
                        }}
                        className={`block text-sm hover:underline ${n.read_at ? "text-ink-soft" : "font-medium text-ink"}`}
                      >
                        {n.title}
                      </Link>
                    ) : (
                      <p className={`text-sm ${n.read_at ? "text-ink-soft" : "font-medium text-ink"}`}>{n.title}</p>
                    )}
                    {n.body && <p className="mt-0.5 text-xs text-ink-muted">{n.body}</p>}
                    <div className="mt-1 flex items-center gap-3 text-[11px] text-ink-subtle">
                      <time dateTime={n.created_at}>{formatWhen(n.created_at)}</time>
                      {!n.read_at && (
                        <button
                          type="button"
                          onClick={() => read([n.id])}
                          className="rounded font-medium text-brand-strong hover:underline focus-visible:ring-2 focus-visible:ring-brand"
                          aria-label={`Mark "${n.title}" as read`}
                        >
                          Mark read
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  );
}
