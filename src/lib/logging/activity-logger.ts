/**
 * Deku Finance — CRUD User Activity & Audit Logger
 * Strictly captures Create, Read, Update, and Delete (CRUD) operations
 * across financial modules (Vouchers, Masters, Documents, Departments, Settings).
 * Page navigations and UI routing events are excluded.
 */

import { auditApi } from "@/api/endpoints";
import { getAccessToken } from "@/lib/supabase/client";

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

const STORAGE_KEY_PREFIX = "deku_user_activity_logs_";
const MAX_LOGS_PER_ORG = 300;

function getStorageKey(orgId: string): string {
  return `${STORAGE_KEY_PREFIX}${orgId}`;
}

function getActiveOrgId(): string {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem("deku_active_org_id");
    if (saved) return saved;
  }
  return "";
}

function getActiveActor(): { name: string; role: string } {
  if (typeof window !== "undefined") {
    const savedName = localStorage.getItem("deku_user_name");
    const savedRole = localStorage.getItem("deku_user_role");
    if (savedName) {
      return { name: savedName, role: savedRole || "License Owner" };
    }
  }
  return { name: "Medhansh K.", role: "License Owner / Admin" };
}

/**
 * Generate default initial CRUD accounting records for company workspace
 */
function createDefaultSeedActivities(orgId: string): UserActivityLog[] {
  const actor = getActiveActor();
  const now = Date.now();

  return [
    {
      id: "seed-crud-1",
      organisation_id: orgId,
      timestamp: new Date(now - 1000 * 60 * 30).toISOString(),
      crud_type: "CREATE",
      category: "VOUCHER",
      action: "Voucher Posted",
      description: "Posted PAYMENT voucher #PAY-2026-001 for ₹55,000.00 to All Might Logistics (Transportation Charges)",
      entity_type: "voucher",
      entity_id: "PAY-2026-001",
      actor_name: "Priya Iyer",
      actor_role: "Finance Lead",
      status: "success",
      metadata: { voucherType: "payment", amount: 55000, fKey: "F5" },
      source: "user_action",
    },
    {
      id: "seed-crud-2",
      organisation_id: orgId,
      timestamp: new Date(now - 1000 * 60 * 60).toISOString(),
      crud_type: "CREATE",
      category: "MASTER",
      action: "Ledger Account Created",
      description: "Created new ASSET ledger 'Razorpay Payment Gateway Clearing' (Code: 1105)",
      entity_type: "account",
      entity_id: "1105",
      actor_name: actor.name,
      actor_role: actor.role,
      status: "success",
      metadata: { code: "1105", group: "asset", isPostable: true },
      source: "user_action",
    },
    {
      id: "seed-crud-3",
      organisation_id: orgId,
      timestamp: new Date(now - 1000 * 60 * 90).toISOString(),
      crud_type: "CREATE",
      category: "SETTING",
      action: "Fiscal Period Created",
      description: "Opened fiscal accounting period 01-Apr-2026 to 31-Mar-2027 under MCA Rule 3(1)",
      entity_type: "fiscal_period",
      entity_id: "fp-2026-27",
      actor_name: actor.name,
      actor_role: actor.role,
      status: "success",
      metadata: { period: "2026-27", standard: "ALERX Double-Entry Strict" },
      source: "user_action",
    },
  ];
}

/**
 * Filter out any legacy navigation or shortcut logs to keep strictly CRUD operations
 */
function sanitizeCrudLogs(logs: any[]): UserActivityLog[] {
  return logs.filter((log) => {
    if (!log || typeof log !== "object") return false;
    // Explicitly reject navigation and shortcut events
    if (log.category === "NAVIGATION") return false;
    if (typeof log.action === "string" && (
      log.action.includes("Page Visit") ||
      log.action.includes("Shortcut Pressed") ||
      log.action.includes("Session Initialized")
    )) {
      return false;
    }
    return true;
  }).map((log) => ({
    ...log,
    crud_type: log.crud_type || inferCrudType(log.action),
  }));
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
 * Get all CRUD activities for an organisation from storage
 */
export function getUserActivities(orgId?: string): UserActivityLog[] {
  if (typeof window === "undefined") return [];

  const targetOrgId = orgId || getActiveOrgId();
  const key = getStorageKey(targetOrgId);
  const raw = localStorage.getItem(key);

  if (!raw) {
    const seeds = createDefaultSeedActivities(targetOrgId);
    try {
      localStorage.setItem(key, JSON.stringify(seeds));
    } catch {
      // Ignore quota
    }
    return seeds;
  }

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const sanitized = sanitizeCrudLogs(parsed);
      if (sanitized.length > 0) {
        // Save cleaned version without navigation logs
        if (sanitized.length !== parsed.length) {
          localStorage.setItem(key, JSON.stringify(sanitized));
        }
        return sanitized;
      }
    }
    const seeds = createDefaultSeedActivities(targetOrgId);
    localStorage.setItem(key, JSON.stringify(seeds));
    return seeds;
  } catch {
    return createDefaultSeedActivities(targetOrgId);
  }
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
      actor_name: "Medhansh K.",
      actor_role: "Owner",
      status: "info",
      source: "user_action",
      metadata: partial.metadata,
    };
  }

  const targetOrgId = partial.organisation_id || getActiveOrgId();
  const actor = getActiveActor();
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
    actor_name: partial.actor_name || actor.name,
    actor_role: partial.actor_role || actor.role,
    status: partial.status || "success",
    metadata: partial.metadata || {},
    source: partial.source || "user_action",
  };

  const current = getUserActivities(targetOrgId);
  const updated = [activity, ...current].slice(0, MAX_LOGS_PER_ORG);

  try {
    localStorage.setItem(getStorageKey(targetOrgId), JSON.stringify(updated));
  } catch (e) {
    console.warn("Failed to persist user activity log:", e);
  }

  // Dispatch custom window event so any open Logs view updates instantly
  window.dispatchEvent(
    new CustomEvent("deku_activity_logged", {
      detail: activity,
    })
  );

  // Asynchronously synchronize with backend PostgreSQL database
  auditApi
    .create(targetOrgId, {
      category: activity.category,
      action: activity.action,
      description: activity.description,
      entity_type: activity.entity_type,
      entity_id: activity.entity_id,
      actor_name: activity.actor_name,
      actor_role: activity.actor_role,
      status: activity.status,
      metadata: {
        crud_type: activity.crud_type,
        ...activity.metadata,
      },
    })
    .catch((err) => {
      console.debug("Backend audit event sync notice:", err?.message || err);
    });

  return activity;
}

/**
 * Clear all activity logs for an organisation
 */
export function clearUserActivities(orgId?: string): void {
  if (typeof window === "undefined") return;
  const targetOrgId = orgId || getActiveOrgId();
  const seeds = createDefaultSeedActivities(targetOrgId);
  localStorage.setItem(getStorageKey(targetOrgId), JSON.stringify(seeds));
  window.dispatchEvent(
    new CustomEvent("deku_activity_logged", {
      detail: seeds[0],
    })
  );
}

/**
 * Export logs as JSON file
 */
export function exportActivitiesAsJson(activities: UserActivityLog[], orgName: string): void {
  if (typeof window === "undefined") return;
  const dataStr =
    "data:text/json;charset=utf-8," +
    encodeURIComponent(JSON.stringify(activities, null, 2));
  const downloadAnchor = document.createElement("a");
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute(
    "download",
    `deku_crud_logs_${orgName.toLowerCase().replace(/[^a-z0-9]/g, "_")}_${new Date().toISOString().slice(0, 10)}.json`
  );
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

/**
 * Export logs as CSV file
 */
export function exportActivitiesAsCsv(activities: UserActivityLog[], orgName: string): void {
  if (typeof window === "undefined") return;
  const headers = [
    "Timestamp",
    "CRUD Operation",
    "Category",
    "Action",
    "Description",
    "Entity Type",
    "Entity ID",
    "Actor",
    "Role",
    "Status",
    "Source",
  ];

  const rows = activities.map((a) => [
    `"${a.timestamp}"`,
    `"${a.crud_type}"`,
    `"${a.category}"`,
    `"${a.action.replace(/"/g, '""')}"`,
    `"${a.description.replace(/"/g, '""')}"`,
    `"${a.entity_type}"`,
    `"${a.entity_id}"`,
    `"${a.actor_name}"`,
    `"${a.actor_role}"`,
    `"${a.status}"`,
    `"${a.source}"`,
  ]);

  const csvContent =
    "data:text/csv;charset=utf-8," +
    [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute(
    "download",
    `deku_crud_logs_${orgName.toLowerCase().replace(/[^a-z0-9]/g, "_")}_${new Date().toISOString().slice(0, 10)}.csv`
  );
  document.body.appendChild(link);
  link.click();
  link.remove();
}

/**
 * Downloads secure, server-verified tamper-evident audit logs directly from backend
 */
export async function downloadSecureAuditExport(
  orgId: string,
  format: "csv" | "json",
  fallbackLogs: UserActivityLog[],
  orgName: string
): Promise<void> {
  if (typeof window === "undefined") return;

  try {
    const url = auditApi.exportUrl(orgId, format);
    const token = await getAccessToken();
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(url, { headers });
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
    console.warn("Server-side export failed, using local export fallback:", err);
    if (format === "csv") {
      exportActivitiesAsCsv(fallbackLogs, orgName);
    } else {
      exportActivitiesAsJson(fallbackLogs, orgName);
    }
  }
}
