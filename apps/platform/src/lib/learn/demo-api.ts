/**
 * The Learn Centre's in-browser accounting engine. Every apiClient call the reused screens make
 * in the public demo lands here instead of the backend. Writes apply the same rules as the SQL
 * functions and Rust routes they stand in for (see lib/learn/engine/*), change this browser's
 * copy of the demo books, and record the visitor's activity. A write the demo doesn't model
 * fails with "… isn't available in the demo"; it never pretends to succeed.
 */
import type { DemoActivityRefs, DemoActivityType } from "./activity";
import type { RequestOptions } from "@/api/client";
import type { OrgRole } from "@/modules/departments-members/team";
import type { DemoPlanId } from "./demo-plans";
import type { DemoDataset } from "./sample-data";
import { notInDemo } from "./engine/books";
import type { Handler, Req } from "./engine/context";
import { adminHandler } from "./engine/admin";
import { bankingHandler } from "./engine/banking";
import { insightHandler } from "./engine/insight";
import { journalHandler } from "./engine/journals";
import { salesHandler } from "./engine/sales";
import { stockHandler } from "./engine/stock";
import { teamHandler } from "./engine/team";

export interface DemoApiRuntimeContext {
  getDataset: () => DemoDataset;
  updateDataset: (updater: (prev: DemoDataset) => DemoDataset) => void;
  getRole: () => OrgRole;
  getPlan: () => DemoPlanId;
  notifyAction: (title: string, body: string, tone?: "info" | "warning" | "blocked") => void;
  /** Append a business event to the activity log (lib/learn/activity.ts). Call once per applied write. */
  record: (type: DemoActivityType, summary: string, refs?: DemoActivityRefs) => void;
}

const HANDLERS: Handler[] = [journalHandler, salesHandler, stockHandler, bankingHandler, teamHandler, insightHandler, adminHandler];

const HSN = [
  { code: "853620", description: "Electrical apparatus / circuit breakers", kind: "goods", chapter: "85" },
  { code: "854460", description: "Insulated electric conductors and cables", kind: "goods", chapter: "85" },
  { code: "998313", description: "IT consulting and support services", kind: "service", chapter: "99" },
  { code: "998314", description: "IT design and development services", kind: "service", chapter: "99" },
  { code: "691200", description: "Ceramic tableware and kitchenware", kind: "goods", chapter: "69" },
  { code: "630492", description: "Furnishing articles of textile", kind: "goods", chapter: "63" },
  { code: "150910", description: "Olive oil, virgin", kind: "goods", chapter: "15" },
  { code: "090121", description: "Coffee, roasted, not decaffeinated", kind: "goods", chapter: "09" },
];

function parseBody(options: RequestOptions): Record<string, unknown> {
  if (typeof options.body !== "string") return {};
  try {
    return JSON.parse(options.body);
  } catch {
    return {};
  }
}

export async function dispatchDemoApi(ctx: DemoApiRuntimeContext, rawPath: string, options: RequestOptions = {}): Promise<unknown> {
  const method = (options.method || "GET").toUpperCase();
  const [pathname, queryStr = ""] = rawPath.split("?");
  const query = new URLSearchParams(queryStr);

  if (pathname === "/health") return { engine: "deku-demo-runtime", service: "learn-demo", status: "ok", version: "learn-public" };

  if (pathname === "/api/v1/hsn") {
    const q = (query.get("q") || "").toLowerCase();
    const data = HSN.filter((h) => !q || h.code.includes(q) || h.description.toLowerCase().includes(q)).map((h) => ({ ...h, match: h.code.includes(q) ? "code" : "description" }));
    return { success: true, data, loaded: true };
  }

  if (pathname === "/api/v1/organisations") {
    if (method === "GET") return { success: true, data: [ctx.getDataset().org] };
    notInDemo("Creating another company", "the demo has four fixed sample companies; switch between them in the demo bar");
  }

  const m = pathname.match(/^\/api\/v1\/organisations\/([^/]+)(\/.*)?$/);
  if (m && m[1] !== "invitations") {
    const ds = ctx.getDataset();
    // Every demo company answers only for itself; a stale or foreign org id gets nothing.
    if (m[1] !== ds.org.id) return method === "GET" ? { success: true, data: [] } : notInDemo("Changing another company's books", "only the active demo company can be changed");
    const req: Req = { ctx, method, sub: m[2] || "", query, body: parseBody(options), raw: options.body ?? null, ds, role: ctx.getRole(), plan: ctx.getPlan() };
    for (const h of HANDLERS) {
      const res = h(req);
      if (res !== undefined) return res;
    }
  }

  // Nothing above handled it. Reads with no demo data return an empty list; writes say so plainly.
  if (method === "GET") return { success: true, data: [] };
  const what = (m?.[2] || pathname).replace(/\/[0-9a-z-]{8,}(?=\/|$)/gi, "/…");
  return notInDemo(`${method} ${what}`);
}
