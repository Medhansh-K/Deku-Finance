import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isPublicPath } from "@/lib/auth/session";
import { DEMO_COMPANIES, getDemoCompany } from "@/lib/learn/companies";
import { DEMO_ROLES, canDemoRolePerform, getDemoRoleConfig } from "@/lib/learn/demo-roles";
import { DEMO_PLANS, buildDemoSubscription } from "@/lib/learn/demo-plans";
import { createInitialDemoDataset } from "@/lib/learn/sample-data";
import { dispatchDemoApi } from "@/lib/learn/demo-api";
import { PRODUCT_WALKTHROUGH_PATH, WORKFLOW_TUTORIAL_PATHS } from "@/lib/tutorials/workflows";
import {
  DOC_ARTICLES,
  DOC_CATEGORIES,
  getAdjacentArticles,
  getArticlesForCategory,
  getDocArticle,
  searchDocArticles,
} from "@/lib/learn/docs-data";

function walkFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return walkFiles(full);
    return /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

describe("Learn Centre public routing & safety", () => {
  it("allows unauthenticated public access to all /learn subpaths", () => {
    const paths = [
      "/learn",
      "/learn/demo",
      "/learn/demo/companies",
      "/learn/demo/workspace",
      "/learn/docs",
      "/learn/docs/accounting",
      "/learn/docs/accounting/alerx-chart-of-accounts",
    ];
    for (const p of paths) {
      expect(isPublicPath(p)).toBe(true);
    }
  });

  it("never exposes shared demo credentials or legacy /api/auth/demo in Learn Centre modules", () => {
    const learnFiles = [
      ...walkFiles("apps/platform/src/app/learn"),
      ...walkFiles("apps/platform/src/components/learn"),
      ...walkFiles("apps/platform/src/lib/learn"),
    ];
    expect(learnFiles.length).toBeGreaterThan(0);
    for (const file of learnFiles) {
      const content = readFileSync(file, "utf8");
      expect(content).not.toContain("demo-owner@deku.finance");
      expect(content).not.toContain("demo-accountant@deku.finance");
      expect(content).not.toContain("demo-freelancer@deku.finance");
      expect(content).not.toContain("DekuDemo#2026");
      expect(content).not.toContain("/api/auth/demo");
    }
  });
});

describe("Learn Centre 4 demo companies & frontend sample ledger parity", () => {
  it("defines all four industry templates with valid routes and balanced double-entry journals", async () => {
    expect(DEMO_COMPANIES.map((c) => c.slug)).toEqual([
      "aster-trading",
      "northstar-consulting",
      "urbannest-retail",
      "meridian-retail",
    ]);

    for (const c of DEMO_COMPANIES) {
      expect(getDemoCompany(c.slug)?.tradeName).toBe(c.tradeName);
      expect(existsSync(join("apps/platform/src/app", c.defaultLandingRoute, "page.tsx"))).toBe(true);

      let ds = createInitialDemoDataset(c.slug);
      for (const je of ds.journals) {
        const dr = je.journal_entry_lines.reduce((s, l) => s + l.debit, 0);
        const cr = je.journal_entry_lines.reduce((s, l) => s + l.credit, 0);
        expect(dr).toBe(cr);
        expect(dr).toBeGreaterThan(0);
      }

      const tbRes = (await dispatchDemoApi(
        {
          getDataset: () => ds,
          updateDataset: (fn) => {
            ds = fn(ds);
          },
          getRole: () => "owner",
          getPlan: () => c.recommendedPlan,
          notifyAction: () => {},
        },
        `/api/v1/organisations/${ds.org.id}/reports/trial-balance`
      )) as { data: { total_debit: number; total_credit: number }[] };

      const sumDr = tbRes.data.reduce((s, r) => s + r.total_debit, 0);
      const sumCr = tbRes.data.reduce((s, r) => s + r.total_credit, 0);
      expect(sumDr).toBe(sumCr);
      expect(sumDr).toBeGreaterThan(0);

      const gstr1Res = (await dispatchDemoApi(
        {
          getDataset: () => ds,
          updateDataset: (fn) => {
            ds = fn(ds);
          },
          getRole: () => "owner",
          getPlan: () => "pro",
          notifyAction: () => {},
        },
        `/api/v1/organisations/${ds.org.id}/gst/102026/gstr1`
      )) as { data: { errors: string[]; json: unknown } };
      expect(gstr1Res.data.errors).toEqual([]);
      expect(gstr1Res.data.json).not.toBeNull();

      const kpiRes = (await dispatchDemoApi(
        {
          getDataset: () => ds,
          updateDataset: (fn) => {
            ds = fn(ds);
          },
          getRole: () => "owner",
          getPlan: () => c.recommendedPlan,
          notifyAction: () => {},
        },
        `/api/v1/organisations/${ds.org.id}/reports/kpis`
      )) as { data: { has_entries: boolean; turnover: number; liquid: number; balanced: boolean } };
      expect(kpiRes.data.has_entries).toBe(true);
      expect(kpiRes.data.turnover).toBeGreaterThan(0);
      expect(kpiRes.data.liquid).toBeGreaterThan(0);
      expect(kpiRes.data.balanced).toBe(true);
    }
  });
});

describe("Learn Centre 7 roles & 3 commercial plans", () => {
  it("models all 7 RBAC roles and Maker-Checker / read-only / salary-masking rules", () => {
    expect(DEMO_ROLES.map((r) => r.role)).toEqual([
      "owner",
      "cfo",
      "admin",
      "accountant",
      "analyst",
      "auditor",
      "viewer",
    ]);

    expect(canDemoRolePerform("owner", "post_voucher").allowed).toBe(true);
    expect(canDemoRolePerform("accountant", "create_draft").allowed).toBe(true);
    expect(canDemoRolePerform("accountant", "approve_voucher").allowed).toBe(false);
    expect(canDemoRolePerform("auditor", "create_draft").allowed).toBe(false);
    expect(canDemoRolePerform("viewer", "post_voucher").allowed).toBe(false);
    expect(getDemoRoleConfig("accountant").salaryMasked).toBe(true);
    expect(getDemoRoleConfig("owner").salaryMasked).toBe(false);
  });

  it("models GO, PRO, and Enterprise entitlement limits accurately", () => {
    expect(DEMO_PLANS.go.seatsLimit).toBe(2);
    expect(DEMO_PLANS.go.catalogueItemsLimit).toBe(100);
    expect(DEMO_PLANS.go.annualBillsLimit).toBe(2000);
    expect(DEMO_PLANS.go.gstnJsonEnabled).toBe(false);

    expect(DEMO_PLANS.pro.seatsLimit).toBe(5);
    expect(DEMO_PLANS.pro.gstnJsonEnabled).toBe(true);
    expect(DEMO_PLANS.pro.makerCheckerEnabled).toBe(true);

    expect(DEMO_PLANS.enterprise.seatsLimit).toBeNull();
    expect(DEMO_PLANS.enterprise.aiCfoWorkflowsEnabled).toBe(true);
    expect(DEMO_PLANS.enterprise.multiWarehouseEnabled).toBe(true);

    const sub = buildDemoSubscription("pro");
    expect(sub.entitlements.seats).toBe(5);
    expect(sub.entitlements.gstn_json).toBe(true);
  });
});

describe("Learn Centre 8 guided workflows & 8 doc categories", () => {
  it("validates all 8 business workflows point to real pages and data-tour attributes", () => {
    expect(WORKFLOW_TUTORIAL_PATHS.map((w) => w.id)).toEqual([
      "purchase-to-payment",
      "order-to-collection",
      "financial-close",
      "gst-compliance",
      "bank-reconciliation",
      "team-governance",
      "marketplace-settlement",
      "financial-intelligence",
    ]);

    const source = walkFiles("apps/platform/src").map((f) => readFileSync(f, "utf8")).join("\n");
    for (const wf of [PRODUCT_WALKTHROUGH_PATH, ...WORKFLOW_TUTORIAL_PATHS]) {
      expect(wf.steps.length).toBeGreaterThan(2);
      for (const step of wf.steps) {
        if (step.route) {
          expect(existsSync(join("apps/platform/src/app", step.route, "page.tsx"))).toBe(true);
        }
        if (step.target) {
          expect(source).toContain(`data-tour="${step.target}"`);
        }
      }
    }
  });

  it("provides 8 structured documentation categories with articles, search, adjacency, and valid demo links", () => {
    expect(DOC_CATEGORIES.map((c) => c.slug)).toEqual([
      "getting-started",
      "accounting",
      "operations",
      "gst-compliance",
      "roles-and-governance",
      "financial-intelligence",
      "plans-and-utilisation",
      "technical",
    ]);

    for (const cat of DOC_CATEGORIES) {
      expect(getArticlesForCategory(cat.slug).length).toBeGreaterThan(0);
    }

    for (const article of DOC_ARTICLES) {
      expect(getDocArticle(article.category, article.slug)?.title).toBe(article.title);
      if (article.demoLink) {
        expect(getDemoCompany(article.demoLink.companySlug)).toBeDefined();
        expect(existsSync(join("apps/platform/src/app", article.demoLink.targetRoute, "page.tsx"))).toBe(true);
      }
    }

    expect(searchDocArticles("Rule 88A").some((a) => a.slug === "gst-pos-itc-and-returns")).toBe(true);
    expect(searchDocArticles("nonexistent-xyz-term")).toEqual([]);
    const adj = getAdjacentArticles(DOC_ARTICLES[0]);
    expect(adj.prev).toBeNull();
    expect(adj.next?.slug).toBe(DOC_ARTICLES[1].slug);
  });
});
