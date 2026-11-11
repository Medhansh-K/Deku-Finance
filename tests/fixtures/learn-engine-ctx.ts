/* eslint-disable @typescript-eslint/no-explicit-any -- reads the engine's untyped JSON responses, as the screens do */
/** A fake LearnDemoContext for driving dispatchDemoApi in tests: same record() semantics as the real one. */
import { nextActivity, type DemoActivityRefs, type DemoActivityType } from "@/lib/learn/activity";
import type { DemoCompanySlug } from "@/lib/learn/companies";
import { dispatchDemoApi, type DemoApiRuntimeContext } from "@/lib/learn/demo-api";
import type { DemoPlanId } from "@/lib/learn/demo-plans";
import { createInitialDemoDataset, type DemoDataset } from "@/lib/learn/sample-data";
import type { OrgRole } from "@/modules/departments-members/team";

export function demo(slug: DemoCompanySlug = "aster-trading", role: OrgRole = "owner", plan: DemoPlanId = "enterprise") {
  const state = { ds: createInitialDemoDataset(slug), role, plan, notices: [] as string[] };
  const ctx: DemoApiRuntimeContext = {
    getDataset: () => state.ds,
    updateDataset: (fn) => {
      state.ds = fn(state.ds);
    },
    getRole: () => state.role,
    getPlan: () => state.plan,
    notifyAction: (title) => {
      state.notices.push(title);
    },
    record: (type: DemoActivityType, summary: string, refs?: DemoActivityRefs) => {
      state.ds = { ...state.ds, activity: [...state.ds.activity, nextActivity(state.ds.activity, type, state.role, summary, refs)] };
    },
  };
  const base = () => `/api/v1/organisations/${state.ds.org.id}`;
  const call = <T = any>(method: string, path: string, body?: unknown) =>
    dispatchDemoApi(ctx, `${base()}${path}`, { method, body: body === undefined ? undefined : JSON.stringify(body) }) as Promise<T>;
  return {
    state,
    ctx,
    get ds(): DemoDataset {
      return state.ds;
    },
    as(r: OrgRole) {
      state.role = r;
      return this;
    },
    get: <T = any>(path: string) => call<T>("GET", path),
    post: <T = any>(path: string, body?: unknown) => call<T>("POST", path, body ?? {}),
    put: <T = any>(path: string, body?: unknown) => call<T>("PUT", path, body ?? {}),
    patch: <T = any>(path: string, body?: unknown) => call<T>("PATCH", path, body ?? {}),
    del: <T = any>(path: string) => call<T>("DELETE", path),
    acc: (code: string) => state.ds.accounts.find((a) => a.code === code)!.id,
    /** Natural balance of an account from the engine's own trial balance. */
    async bal(code: string) {
      const tb = (await call<{ data: { account_code: string; account_type: string; total_debit: number; total_credit: number }[] }>("GET", "/reports/trial-balance")).data;
      const r = tb.find((x) => x.account_code === code)!;
      const v = r.account_type === "asset" || r.account_type === "expense" ? r.total_debit - r.total_credit : r.total_credit - r.total_debit;
      return Math.round(v * 100) / 100;
    },
    /** Latest business event (report visits from the helpers above are skipped). */
    last: () => state.ds.activity.filter((a) => a.type !== "report.viewed").at(-1),
  };
}
