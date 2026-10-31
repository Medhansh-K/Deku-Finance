import type { Entitlements } from "@/lib/subscription/entitlements";

const LIMIT_TEXT: Record<string, (n: number | null) => string> = {
  seats: (n) => (n === null ? "Your plan's member seats are all in use." : `Your plan allows ${n} seat${n === 1 ? "" : "s"}.`),
  max_monthly_invoices: (n) =>
    n === null ? "Your plan's invoice limit for this month is reached." : `Your plan allows ${n} invoices a month.`,
};

/**
 * A readable message for a failed API call. Understands the backend's structured codes
 * ({error:"plan_limit", limit}, {error:"stock_insufficient", item}, 403) and the same codes
 * inside raw database text. Returns null when there is nothing better than the server's own text.
 */
export function friendlyError(body: unknown, status?: number, limits?: Entitlements | null): string | null {
  const obj = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const text = typeof body === "string" ? body : JSON.stringify(body ?? "");

  const limit = obj.error === "plan_limit" ? String(obj.limit ?? "") : text.match(/plan_limit:(\w+)/)?.[1];
  if (limit !== undefined) {
    const n = limits?.[limit as keyof Entitlements];
    const describe = LIMIT_TEXT[limit];
    const base = describe ? describe(typeof n === "number" ? n : null) : "This needs a higher plan.";
    return `${base} Upgrade in Settings → Licence to continue.`;
  }

  const item = obj.error === "stock_insufficient" ? String(obj.item ?? "") : text.match(/stock_insufficient:([\w.\-/]+)/)?.[1];
  if (item !== undefined) return `Not enough stock of ${item || "this item"}.`;

  if (status === 403 || /permission denied/i.test(text)) {
    const reason = typeof obj.error === "string" ? obj.error.replace(/^permission denied:?\s*/i, "") : "";
    return reason && !/not permitted:/.test(reason)
      ? `You don't have permission: ${reason.charAt(0).toLowerCase()}${reason.slice(1)}`
      : "You don't have permission to do this.";
  }
  return null;
}
