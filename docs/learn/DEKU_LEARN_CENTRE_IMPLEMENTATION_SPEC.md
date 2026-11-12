# Deku Learn Centre — Implementation Specification (Simplified Public Architecture)

**Status:** Active & Implemented  
**Access:** 100% public under `/learn/**` — zero login, zero registration, zero licence purchase, and zero backend/database session provisioning.

---

## 1. Architecture Summary

The public Deku Learn Centre reuses Deku's actual `AppShell`, keyboard navigation (`F1–F11`, `ESC`, `Ctrl+K`), guided tour engine (`TutorialCoach`, `TUTORIAL_PATHS`, `progress.ts`), and module views on top of deterministic, mathematically balanced in-browser datasets for four industry demonstration companies.

- **Zero backend / DB demo infrastructure:** No `demo_sessions` table, no Rust `demo_access_token`, and no `/api/learn/demo/*` cookie routes.
- **No exposure of shared internal demo accounts:** `/api/auth/demo` (`demo-owner@deku.finance`, etc.) is never referenced, linked, or invoked anywhere in the Learn Centre.
- **Role (7) & Plan (GO / PRO / Enterprise) switchers** are frontend demonstration controls managed inside `LearnDemoProvider` (`apps/platform/src/context/LearnDemoContext.tsx`). They never mutate customer accounts, database roles, or `public.plans`.

---

## 2. Public Routes & Key Modules

| Route | Purpose | Key Files |
|---|---|---|
| `/learn` | Public Learn Hub (Interactive Demo entry + Manuals & Documentation) | `apps/platform/src/app/learn/page.tsx` |
| `/learn/demo` | Tally-style instant Demo Centre: 4 company cards, 8 workflow guided-tour cards with search & plan filters, 7-role preview, plan matrix | `apps/platform/src/app/learn/demo/page.tsx`, `WorkflowDemoExplorer.tsx` |
| `/learn/demo/companies` | Industry demonstration company comparison catalogue | `apps/platform/src/app/learn/demo/companies/page.tsx`, `DemoCompanyGrid.tsx` |
| `/learn/demo/workspace` | Reused `AppShell` + existing ERP screens backed by in-browser sample data (`?company=...&role=...&plan=...&route=...&tour=...`) | `apps/platform/src/app/learn/demo/workspace/page.tsx`, `LearnDemoWorkspace.tsx`, `DemoControlBar.tsx` |
| `/learn/docs` | Public Manuals & Documentation Centre across 8 structured categories with search, ToC, metadata & *"Try in Demo"* deep links | `apps/platform/src/app/learn/docs/page.tsx`, `[category]/page.tsx`, `[category]/[slug]/page.tsx`, `DocsExplorer.tsx` |

---

## 3. Authoritative Demonstration Components

1. **Four Fictional Industry Companies (`apps/platform/src/lib/learn/companies.ts` & `sample-data.ts`):**
   - **Aster Trading Co.** (`aster-trading`, Wholesale & Distribution, GSTIN `27AAZFA0001A1Z2`)
   - **Northstar Consulting Pvt. Ltd.** (`northstar-consulting`, Professional Services, GSTIN `29AABCN0002B1ZC`)
   - **UrbanNest Retail Pvt. Ltd.** (`urbannest-retail`, D2C & E-Commerce, GSTIN `07AABCU0003C1Z8`)
   - **Meridian Retail Pvt. Ltd.** (`meridian-retail`, Retail & Multi-Warehouse, GSTIN `27AABCM0004D1ZB`)
   - All posted journal entries satisfy strict ALERX double-entry parity (`Σ debits === Σ credits`) and dynamically feed Trial Balance, Profit & Loss, Balance Sheet, Party Ageing, Cash Flow, and `GSTR-1` / `GSTR-3B` previews (`demo-api.ts`).
2. **Seven User Roles (`apps/platform/src/lib/learn/demo-roles.ts`):**
   - `owner`, `cfo`, `admin`, `accountant`, `analyst`, `auditor`, `viewer` matching `team.ts` RBAC and enforcing Maker-Checker approvals, salary privacy masking, and read-only inspection rules.
3. **Three Commercial Plans (`apps/platform/src/lib/learn/demo-plans.ts`):**
   - `go` (₹24,999/yr), `pro` (₹49,999/yr), `enterprise` (₹1,19,999/yr) aligned with `PricingPlansSection.tsx`, with honest status labels (`Available in demo`, `Simulated`, `Requires external provider`, `Not yet available`).
4. **Eight End-to-End Business Workflows (`apps/platform/src/lib/tutorials/workflows.ts`):**
   - Purchase-to-Payment, Order-to-Collection, Financial Close, GST Workflow, Bank Reconciliation, Team Governance, Marketplace Settlement, and Financial Intelligence.
