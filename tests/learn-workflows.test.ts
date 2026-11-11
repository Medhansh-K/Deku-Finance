import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEMO_ACTIVITY_TYPES } from "@/lib/learn/activity";
import { DEMO_COMPANIES } from "@/lib/learn/companies";
import { DEMO_PLANS } from "@/lib/learn/demo-plans";
import { DOC_ARTICLES, getDocArticle } from "@/lib/learn/docs-data";
import { LEARN_WORKFLOWS, getLearnWorkflow } from "@/lib/learn/workflows/catalogue";
import { ROLES } from "@/modules/departments-members/team";

const SRC = "apps/platform/src";
const WORKSPACE = readFileSync(join(SRC, "components/learn/LearnDemoWorkspace.tsx"), "utf8");

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  if (statSync(dir).isFile()) return [dir];
  return readdirSync(dir).flatMap((name) => walk(join(dir, name)));
}
const read = (paths: string[]) => paths.flatMap((p) => walk(join(SRC, p))).filter((f) => /\.tsx?$/.test(f)).map((f) => readFileSync(f, "utf8")).join("\n");

/** Routes the demo workspace renders: every `basePath === "…"` branch, plus the voucher modes. */
const voucherModes = /validModes: VoucherMode\[\] = \[([^\]]+)\]/.exec(WORKSPACE)?.[1].match(/"([a-z]+)"/g)?.map((m) => m.slice(1, -1)) ?? [];
const RENDERED = new Set([...[...WORKSPACE.matchAll(/basePath === "([^"]+)"/g)].map((m) => m[1]), ...voucherModes.map((m) => `/vouchers/${m}`)]);

/** Source the workspace renders for a route (module code), plus the shell around every screen. */
const SHELL = ["layouts", "components/learn/DemoControlBar.tsx"];
function screenSource(route: string): string {
  const base = route.split("?")[0];
  const reports = /^\/reports\/(.+)$/.exec(base);
  const dirs: Record<string, string[]> = {
    "/gateway": ["modules/gateway"],
    "/day-book": ["modules/day-book"],
    "/approvals": ["modules/approvals"],
    "/gst": ["modules/gst"],
    "/gst/returns": ["modules/gst/ReturnCard.tsx", "modules/gst/Table6Card.tsx"],
    "/purchases": ["modules/purchases"],
    "/collect": ["modules/collect"],
    "/inventory": ["modules/inventory"],
    "/banking/reconciliation": ["modules/banking"],
    "/departments-members": ["modules/departments-members"],
    "/audit": ["modules/audit"],
    "/consultant": ["modules/consultant"],
    "/settings": ["modules/settings"],
    "/executive": ["modules/executive"],
    "/masters/chart-of-accounts": ["modules/masters/chart-of-accounts"],
    "/masters/parties": ["modules/masters/parties"],
    "/masters/products-services": ["modules/masters/products-services"],
  };
  const own = base.startsWith("/vouchers/")
    ? ["modules/vouchers"]
    : reports
      ? [`modules/financial-reports/${reports[1]}`, "modules/financial-reports/ReportDateRange.tsx", "modules/financial-reports/report-ui.tsx"]
      : dirs[base] ?? [];
  expect(own.length, `no screen mapping for ${route}`).toBeGreaterThan(0);
  return read([...own, ...SHELL]);
}

const roles = new Set<string>(ROLES.map((r) => r.value));
const companies = new Set<string>(DEMO_COMPANIES.map((c) => c.slug));
const activityTypes = new Set<string>(DEMO_ACTIVITY_TYPES);

describe("Learn workflows catalogue", () => {
  it("has WF-01 to WF-18 with unique ids and codes", () => {
    expect(LEARN_WORKFLOWS.map((w) => w.code)).toEqual(Array.from({ length: 18 }, (_, i) => `WF-${String(i + 1).padStart(2, "0")}`));
    expect(new Set(LEARN_WORKFLOWS.map((w) => w.id)).size).toBe(18);
    for (const w of LEARN_WORKFLOWS) expect(w.id.startsWith(w.code.toLowerCase() + "-")).toBe(true);
    expect(getLearnWorkflow("wf-03-receipts-payments")?.code).toBe("WF-03");
    expect(getLearnWorkflow("WF-18")?.id).toBe("wf-18-close-cycle");
    expect(getLearnWorkflow("nope")).toBeUndefined();
  });

  it("fills every card field with real values", () => {
    for (const w of LEARN_WORKFLOWS) {
      expect(w.steps.length, w.code).toBeGreaterThanOrEqual(3);
      expect(new Set(w.steps.map((s) => s.id)).size, w.code).toBe(w.steps.length);
      expect(w.name && w.description && w.startingData && w.completion, w.code).toBeTruthy();
      expect(w.estimatedMinutes).toBeGreaterThan(0);
      expect(w.modules.length).toBeGreaterThan(0);
      expect(Object.keys(DEMO_PLANS)).toContain(w.minPlan);
      expect(companies.has(w.recommendedCompany), w.code).toBe(true);
      expect(w.industries).toContain(w.recommendedCompany);
      for (const c of w.industries) expect(companies.has(c), `${w.code} ${c}`).toBe(true);
      // A company left out must be explained.
      if (w.industries.length < companies.size) expect(w.industryNote, w.code).toBeTruthy();
      expect(roles.has(w.primaryRole), w.code).toBe(true);
      for (const r of w.supportingRoles) expect(roles.has(r), `${w.code} ${r}`).toBe(true);
      expect(w.supportingRoles).not.toContain(w.primaryRole);
    }
  });

  it("starts and runs only on routes the demo workspace renders", () => {
    expect(RENDERED.has("/gst")).toBe(true);
    expect(RENDERED.has("/vouchers/receipt")).toBe(true);
    for (const w of LEARN_WORKFLOWS) {
      expect(RENDERED.has(w.startRoute), `${w.code} start ${w.startRoute}`).toBe(true);
      expect(w.steps[0].route, `${w.code} first step is the start route`).toBe(w.startRoute);
      for (const s of w.steps) {
        expect(RENDERED.has(s.route.split("?")[0]), `${w.code}/${s.id} ${s.route}`).toBe(true);
        if (s.expect?.kind === "visit") expect(RENDERED.has(s.expect.route), `${w.code}/${s.id} expects ${s.expect.route}`).toBe(true);
      }
    }
  });

  it("highlights only elements that exist on the step's own screen", () => {
    const missing: string[] = [];
    for (const w of LEARN_WORKFLOWS) {
      for (const s of w.steps) {
        if (!s.target) continue;
        if (!screenSource(s.route).includes(`data-tour="${s.target}"`)) missing.push(`${w.code}/${s.id}: ${s.target} on ${s.route}`);
      }
    }
    expect(missing).toEqual([]);
  }, 30_000); // reads every screen's source; slow when the full suite runs in parallel

  it("waits only for activities the recorder knows, as valid roles", () => {
    for (const w of LEARN_WORKFLOWS) {
      for (const s of w.steps) {
        if (s.role) expect(roles.has(s.role), `${w.code}/${s.id}`).toBe(true);
        if (s.expect?.kind !== "event") continue;
        expect(activityTypes.has(s.expect.type), `${w.code}/${s.id} ${s.expect.type}`).toBe(true);
        if (s.expect.role) {
          expect(roles.has(s.expect.role)).toBe(true);
          // The tour switches to step.role; an event that must come from a role has to say so on the step too.
          expect(s.role, `${w.code}/${s.id}`).toBe(s.expect.role);
        }
        if (s.expect.type === "role.switched") expect(roles.has(String(s.expect.match?.role)), `${w.code}/${s.id}`).toBe(true);
        // Action steps say what changes in the books, unless they only switch the preview.
        if (!s.expect.type.startsWith("role.")) expect(s.impact, `${w.code}/${s.id} impact`).toBeTruthy();
      }
    }
  });

  it("puts checker steps on checker roles (journal_approvals: owner, cfo, admin)", () => {
    for (const w of LEARN_WORKFLOWS) {
      for (const s of w.steps) {
        if (s.expect?.kind === "event" && s.expect.type === "journal.posted") expect(["owner", "cfo", "admin"]).toContain(s.role);
        // issue_sales_invoice (owner, admin, accountant) posts through post_journal_entry (owner, cfo, admin): owner or admin
        if (s.expect?.kind === "event" && s.expect.type === "invoice.issued") expect(["owner", "admin"]).toContain(s.role);
      }
    }
  });

  it("is read-only for the auditor and analyst workflows apart from asking Deku Consultant", () => {
    for (const w of LEARN_WORKFLOWS.filter((x) => ["auditor", "analyst"].includes(x.primaryRole))) {
      const writes = w.steps.filter((s) => s.expect?.kind === "event" && s.expect.type !== "consultant.asked");
      expect(writes.map((s) => s.id), w.code).toEqual([]);
    }
  });

  it("links every workflow to docs that exist, and the docs link back", () => {
    for (const w of LEARN_WORKFLOWS) {
      expect(w.docs.length).toBeGreaterThan(0);
      for (const ref of w.docs) {
        const [category, slug] = ref.split("/");
        expect(getDocArticle(category, slug), `${w.code} ${ref}`).toBeDefined();
      }
    }
    const documented = DOC_ARTICLES.flatMap((a) => a.workflowIds ?? []);
    expect([...documented].sort()).toEqual(LEARN_WORKFLOWS.map((w) => w.id).sort());
    for (const a of DOC_ARTICLES.filter((x) => x.workflowIds)) {
      expect(a.demoLink?.workflowHint && a.workflowIds).toContain(a.demoLink?.workflowHint);
    }
  });
});
