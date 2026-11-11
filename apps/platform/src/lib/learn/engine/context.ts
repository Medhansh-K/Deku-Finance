/**
 * What every engine handler receives, and the few side effects they share: saving the new books,
 * appending the activity log row the real database writes (record_user_activity), telling open
 * screens the ledger changed, and recording the visitor's activity for the workflows.
 */
import type { OrgRole } from "@/modules/departments-members/team";
import type { DemoApiRuntimeContext } from "../demo-api";
import type { DemoPlanId } from "../demo-plans";
import type { DemoAuditItem, DemoDataset } from "../sample-data";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Body = Record<string, any>;

export interface Req {
  ctx: DemoApiRuntimeContext;
  method: string;
  /** Path after /api/v1/organisations/{org}, e.g. "/journals/abc/post". */
  sub: string;
  query: URLSearchParams;
  body: Body;
  /** Raw request body, for uploads. */
  raw: unknown;
  ds: DemoDataset;
  role: OrgRole;
  plan: DemoPlanId;
}

/** A handler returns its response, or undefined when the path isn't its own. */
export type Handler = (req: Req) => unknown;

/** The demo member holding the acting role (every role has one in the seed). */
export function actor(ds: DemoDataset, role: OrgRole) {
  const m = ds.members.find((x) => x.role === role);
  return { id: m?.user_id ?? null, name: m?.profiles?.full_name ?? role, email: m?.profiles?.email ?? null, memberId: m?.id ?? null };
}

export function save(req: Req, next: DemoDataset) {
  req.ctx.updateDataset(() => next);
}

/** Appends a user_activity_logs row, newest first, as record_user_activity does. */
export function withAudit(
  ds: DemoDataset,
  role: OrgRole,
  category: DemoAuditItem["category"],
  action: string,
  description: string,
  entityType: string,
  entityId: string,
  metadata: Record<string, unknown> = {},
  status: DemoAuditItem["status"] = "success"
): DemoDataset {
  const who = actor(ds, role);
  const row: DemoAuditItem = {
    id: `${ds.org.id}-aud-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    organisation_id: ds.org.id,
    created_at: new Date().toISOString(),
    actor_id: who.id,
    actor_name: who.name,
    actor_role: role,
    category,
    action,
    description,
    entity_type: entityType,
    entity_id: entityId,
    status,
    metadata,
  };
  return { ...ds, auditEvents: [row, ...ds.auditEvents] };
}

/** The window event Day Book and other open screens already listen for. */
export function ledgerUpdated(detail: Record<string, unknown>) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("deku_ledger_updated", { detail }));
}

/** Label for a journal's voucher type, from its number prefix (lib/reports/vouchers.ts rules). */
export function voucherTypeOf(entryNumber: string): string {
  const p = (entryNumber || "").split("-")[0].toUpperCase();
  if (/SLS|SAL|INV/.test(p)) return "sales";
  if (/PAY/.test(p)) return "payment";
  if (/RCT|RCP|REC/.test(p)) return "receipt";
  if (/PUR/.test(p)) return "purchase";
  if (/CNT/.test(p)) return "contra";
  return "journal";
}
