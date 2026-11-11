/** A row from GET /organisations/:org_id/notifications (SQL list_notifications, unread first). */
export interface AppNotification {
  id: string;
  kind: "gst_due" | "invoice_overdue" | "approval_waiting" | "period_ending";
  title: string;
  body: string | null;
  link: string | null;
  payload: Record<string, unknown>;
  created_at: string;
  read_at: string | null;
}

export const unreadIds = (items: AppNotification[]): string[] =>
  items.filter((n) => !n.read_at).map((n) => n.id);

/** Badge text, or null for no badge. */
export function badgeLabel(unread: number): string | null {
  if (unread <= 0) return null;
  return unread > 9 ? "9+" : String(unread);
}

export const bellAriaLabel = (unread: number): string =>
  unread > 0 ? `Notifications, ${unread} unread` : "Notifications, none unread";

/** Optimistic local update after POST .../notifications/read. */
export function markRead(items: AppNotification[], ids: string[], now = new Date().toISOString()): AppNotification[] {
  const set = new Set(ids);
  return items.map((n) => (set.has(n.id) && !n.read_at ? { ...n, read_at: now } : n));
}
