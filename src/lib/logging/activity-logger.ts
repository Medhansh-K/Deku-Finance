/**
 * Deku Finance — CRUD User Activity & Audit Logger
 * Strictly captures Create, Read, Update, and Delete (CRUD) operations
 * across financial modules (Vouchers, Masters, Documents, Departments, Settings).
 * Page navigations and UI routing events are excluded.
 */

import { auditApi } from "@/api/endpoints";

export type CrudOperation = "CREATE" | "READ" | "UPDATE" | "DELETE";

export type ActivityCategory =
  | "VOUCHER"
  | "MASTER"
  | "DOCUMENT"
  | "DEPARTMENT"
  | "SETTING";

export type ActivityStatus = "success" | "info" | "warning" | "error";

export interface UserActivityLog {
  id: string;
  organisation_id: string;
  timestamp: string; // ISO 8601 string
  crud_type: CrudOperation; // CREATE, READ, UPDATE, DELETE
  category: ActivityCategory;
  action: string;
  description: string;
  entity_type: string;
  entity_id: string;
  actor_name: string;
  actor_role: string;
  status: ActivityStatus;
  metadata?: Record<string, any>;
  source: "user_action" | "system_event";
}

function getActiveOrgId(): string {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem("deku_active_org_id");
    if (saved) return saved;
  }
  return "";
}

/**
 * Infer CRUD operation type from action string if missing
 */
export function inferCrudType(action: string): CrudOperation {
  const lower = action.toLowerCase();
  if (lower.includes("delete") || lower.includes("remove") || lower.includes("cancel") || lower.includes("discard")) {
    return "DELETE";
  }
  if (lower.includes("update") || lower.includes("edit") || lower.includes("modify") || lower.includes("activate") || lower.includes("deactivate") || lower.includes("assign") || lower.includes("status")) {
    return "UPDATE";
  }
  if (lower.includes("read") || lower.includes("view") || lower.includes("export") || lower.includes("inspect")) {
    return "READ";
  }
  return "CREATE";
}

/**
 * Log a CRUD user activity
 */
export function logUserActivity(
  partial: Omit<Partial<UserActivityLog>, "id" | "timestamp"> & {
    action: string;
    description: string;
    category: ActivityCategory;
    crud_type?: CrudOperation;
  }
): UserActivityLog {
  if (typeof window === "undefined") {
    return {
      id: "ssr",
      organisation_id: "",
      timestamp: new Date().toISOString(),
      crud_type: partial.crud_type || "CREATE",
      category: partial.category,
      action: partial.action,
      description: partial.description,
      entity_type: partial.entity_type || "general",
      entity_id: partial.entity_id || "-",
      actor_name: "",
      actor_role: "",
      status: "info",
      source: "user_action",
      metadata: partial.metadata,
    };
  }

  const targetOrgId = partial.organisation_id || getActiveOrgId();
  const crudType = partial.crud_type || inferCrudType(partial.action);

  const activity: UserActivityLog = {
    id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    organisation_id: targetOrgId,
    timestamp: new Date().toISOString(),
    crud_type: crudType,
    category: partial.category,
    action: partial.action,
    description: partial.description,
    entity_type: partial.entity_type || "general",
    entity_id: partial.entity_id || "-",
    actor_name: partial.actor_name || "",
    actor_role: partial.actor_role || "",
    status: partial.status || "success",
    metadata: partial.metadata || {},
    source: partial.source || "user_action",
  };

  // The log lives only in the database; an open Logs view refetches once the write lands.
  auditApi
    .create(targetOrgId, {
      category: activity.category,
      action: activity.action,
      description: activity.description,
      entity_type: activity.entity_type,
      entity_id: activity.entity_id,
      actor_name: activity.actor_name || undefined,
      actor_role: activity.actor_role || undefined,
      status: activity.status,
      metadata: {
        crud_type: activity.crud_type,
        ...activity.metadata,
      },
    })
    .then(() => window.dispatchEvent(new CustomEvent("deku_activity_logged", { detail: activity })))
    .catch((err) => {
      console.debug("Backend audit event sync notice:", err?.message || err);
    });

  return activity;
}

/**
 * Downloads secure, server-verified tamper-evident audit logs directly from backend
 */
export async function downloadSecureAuditExport(
  orgId: string,
  format: "csv" | "json",
  orgName: string
): Promise<void> {
  if (typeof window === "undefined") return;

  try {
    const url = auditApi.exportUrl(orgId, format);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Server returned HTTP ${res.status}`);

    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = `deku_crud_audit_trail_${orgName.toLowerCase().replace(/[^a-z0-9]/g, "_")}_${new Date().toISOString().slice(0, 10)}.${format}`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  } catch (err) {
    alert(`Export failed: ${(err as Error).message}`);
  }
}
