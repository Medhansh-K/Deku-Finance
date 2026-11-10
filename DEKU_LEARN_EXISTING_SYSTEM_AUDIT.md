# Deku Learn Centre — Phase 1: Existing System Audit

**Generated:** 2026-11-10  
**Repository Branch / Commit:** `fix/data-integrity-privacy-demo` (`9565d48`)  
**Scope:** Full verification of frontend routes, Rust backend, authentication, multi-tenancy/RLS, 7-role RBAC, plan entitlements, demo/tutorial infrastructure, module availability, tests, and deployment topology.

---

## 1. Critical Architecture Verification (Discrepancies Resolved)

Before building the Learn Centre, historical assumptions were checked directly against the current source code and SQL migrations.

### 1.1 Supabase Auth vs. Custom Rust Authentication
* **Actual Runtime:** Deku no longer uses external Supabase Cloud / GoTrue authentication.
* **Implementation:**
  * [`supabase/migrations/20261018000000_platform_auth.sql`](file:///c:/Users/Medhansh%20Pc/Desktop/Deku%20Finance/supabase/migrations/20261018000000_platform_auth.sql) creates a self-hosted `auth` schema (`auth.users`, `auth.identities`, `auth.refresh_tokens`) plus `auth.jwt()`, `auth.uid()`, `auth.role()`, and `public.auth_*` `SECURITY DEFINER` RPCs.
  * [`backend/src/auth.rs`](file:///c:/Users/Medhansh%20Pc/Desktop/Deku%20Finance/backend/src/auth.rs) and [`backend/src/routes/auth.rs`](file:///c:/Users/Medhansh%20Pc/Desktop/Deku%20Finance/backend/src/routes/auth.rs) verify bcrypt hashes (cost 12), issue short-lived HS256 JWTs (`aud = "deku"`, `role = "authenticated"`, 3600s TTL), and rotate opaque SHA-256 hashed 30-day refresh tokens.
  * Next.js API routes (`/api/auth/*`) store tokens in `httpOnly`, `SameSite=Lax` cookies (`deku_at`, `deku_rt`) via [`apps/platform/src/lib/auth/session.ts`](file:///c:/Users/Medhansh%20Pc/Desktop/Deku%20Finance/apps/platform/src/lib/auth/session.ts). Browsers never receive raw JWTs; [`/api/backend/[...path]`](file:///c:/Users/Medhansh%20Pc/Desktop/Deku%20Finance/apps/platform/src/app/api/backend/%5B...path%5D/route.ts) attaches `Authorization: Bearer <deku_at>` server-side.

### 1.2 Supabase RLS vs. Current Tenancy Model
* **Actual Runtime:** PostgreSQL **Row-Level Security (RLS) is active and strictly enforced**. PostgREST switches into PostgreSQL role `authenticated` per request using claims from the Rust-issued HS256 JWT.
* **Single-Customer Lock (`migration 047`):** [`supabase/migrations/20261104000047_single_customer_runtime.sql`](file:///c:/Users/Medhansh%20Pc/Desktop/Deku%20Finance/supabase/migrations/20261104000047_single_customer_runtime.sql) locks customer deployments to one organisation (`single_organisation`), **except** users with `raw_user_meta_data->>'is_demo' = 'true'` (`public.is_demo_user(v_user_id)`), who bypass the single-organisation lock and cannot block real tenant creation.
* **Current Demo Security Gap:** [`apps/platform/src/app/api/auth/demo/route.ts`](file:///c:/Users/Medhansh%20Pc/Desktop/Deku%20Finance/apps/platform/src/app/api/auth/demo/route.ts) currently signs all demo visitors into **3 shared hardcoded accounts** (`demo-owner@deku.finance`, `demo-accountant@deku.finance`, `demo-freelancer@deku.finance` seeded in [`supabase/seed.sql`](file:///c:/Users/Medhansh%20Pc/Desktop/Deku%20Finance/supabase/seed.sql)). Visitors share and mutate the same two shared demo companies (`Demo Traders Pvt Ltd`, `Demo Creative Studio`) with **no per-visitor isolation, no expiry, no cleanup, and no reset**.

### 1.3 Enterprise vs. Ultra Plan Naming
* **Actual Runtime:** Marketing UI ([`apps/platform/src/components/landing/PricingPlansSection.tsx`](file:///c:/Users/Medhansh%20Pc/Desktop/Deku%20Finance/apps/platform/src/components/landing/PricingPlansSection.tsx)) and [`supabase/migrations/20261107000059_distributor_and_license_ecosystem.sql`](file:///c:/Users/Medhansh%20Pc/Desktop/Deku%20Finance/supabase/migrations/20261107000059_distributor_and_license_ecosystem.sql) use **GO**, **PRO**, and **Enterprise**. No `ultra` plan identifier exists in `apps/`, `docs/`, or `supabase/`.

### 1.4 Marketing Plan Limits vs. Database Entitlement Records
Significant mismatches exist between landing-page marketing copy and [`public.plans`](file:///c:/Users/Medhansh%20Pc/Desktop/Deku%20Finance/supabase/migrations/20261031000039_subscriptions.sql):

| Dimension | Marketing (`PricingPlansSection.tsx`) | Database (`public.plans` — `039` & `047`) |
| :--- | :--- | :--- |
| **Plan Codes** | `go`, `pro`, `enterprise` | `'go'`, `'pro'`, `'single_org'` (**`'enterprise'` row does not exist**) |
| **GO Price** | ₹24,999 / year | `price_paise_monthly = 149900` (₹1,499/mo), `price_paise_yearly = 1438800` (₹14,388/yr) |
| **GO Limits** | 2,000 bills/yr, 2 seats, 2 standard roles, 100 catalogue items | `max_monthly_invoices: 150`, `seats: 2`, `gstn_json: false`, `direct_filing: false`, `payments: false` |
| **PRO Price** | ₹49,999 / year | `price_paise_monthly = 499900` (₹4,999/mo), `price_paise_yearly = 4798800` (₹47,988/yr) |
| **PRO Limits** | Unlimited bills, **5 seats**, 7 roles, GSTN offline JSON (no direct GSP/webhooks) | `max_monthly_invoices: null`, **`seats: null`**, `gstn_json: true`, **`direct_filing: true`**, **`payments: true`** |
| **Enterprise** | ₹1,19,999 / year, Unlimited bills & seats, custom roles, AI CFO 10 depts, Direct IRP/GSP, multi-warehouse, on-prem | **No row in `public.plans`**; `047` adds `'single_org'` (all limits `null`/unlimited, features `true`) |
| **Enforced Keys** | Multiple operational/reporting differentiators | Triggers/RPCs only inspect `read_only`, `max_monthly_invoices`, `seats`, `gstn_json`, `direct_filing`, `payments` |

*Constraint:* Existing production plan rows (`go`, `pro`, `single_org`) and prices must NOT be silently modified to satisfy demo logic.

### 1.5 In-Memory Ecosystem Components vs. Persistent Database
* Migration [`20261107000059_distributor_and_license_ecosystem.sql`](file:///c:/Users/Medhansh%20Pc/Desktop/Deku%20Finance/supabase/migrations/20261107000059_distributor_and_license_ecosystem.sql) defines persistent tables (`platform_admins`, `distributors`, `distributor_license_requests`, `platform_licenses`, `client_onboarding_requests`).
* However, [`apps/platform/src/lib/ecosystem/store.ts`](file:///c:/Users/Medhansh%20Pc/Desktop/Deku%20Finance/apps/platform/src/lib/ecosystem/store.ts), [`apps/admin/src/lib/store.ts`](file:///c:/Users/Medhansh%20Pc/Desktop/Deku%20Finance/apps/admin/src/lib/store.ts), and [`apps/distributor/src/lib/store.ts`](file:///c:/Users/Medhansh%20Pc/Desktop/Deku%20Finance/apps/distributor/src/lib/store.ts) read/write an **in-memory `globalThis.__deku_ecosystem_store`** rather than querying Postgres or Rust APIs.
* **Architectural Decision:** The public Learn Centre and Interactive Demo must NOT depend on the Admin/Distributor in-memory stores. Docs and tutorial definitions will live in structured, version-controlled TypeScript/Markdown modules within `apps/platform`.

---

## 2. Inventory of Existing Components & Routes

### 2.1 Frontend Routes (`apps/platform`, Next.js `16.4.2`, React `19.3.0`)
* **Public Routes (`PUBLIC_PATHS` in [`session.ts`](file:///c:/Users/Medhansh%20Pc/Desktop/Deku%20Finance/apps/platform/src/lib/auth/session.ts#L9-L21)):**
  `/`, `/login`, `/signup`, `/join`, `/reset-password`, `/request-setup`, `/api/auth`, `/features`, `/gst-compliance`, `/gst-returns`, `/learn`, `/api/learn`.
* **Existing `/learn` Page ([`apps/platform/src/app/learn/page.tsx`](file:///c:/Users/Medhansh%20Pc/Desktop/Deku%20Finance/apps/platform/src/app/learn/page.tsx)):**
  * Currently a single page toggling between Option A (cards for 9 tutorial paths linking directly to `/gateway?tour=<id>`, which redirects unauthenticated users to `/login`) and Option B (6 static doc category cards whose `"Read Documentation"` label has no target page or article viewer).
* **Protected Workspace Routes (wrapped in [`AppShell.tsx`](file:///c:/Users/Medhansh%20Pc/Desktop/Deku%20Finance/apps/platform/src/layouts/AppShell.tsx)):**
  `/gateway`, `/executive`, `/consultant`, `/vouchers`, `/vouchers/[type]`, `/day-book`, `/gst`, `/gst/file`, `/gst/returns`, `/gst/guide`, `/purchases`, `/collect`, `/builder`, `/approvals`, `/banking/reconciliation`, `/reconciliation`, `/inventory`, `/import`, `/export`, `/masters/{chart-of-accounts,parties,products-services}`, `/reports/{trial-balance,profit-loss,balance-sheet,cash-flow,debtors,creditors,operating-expenses,general-ledger,fpa}`, `/audit`, `/logs`, `/departments-members`, `/companies`, `/settings`, `/settings/license`, `/help`, `/kyc`, `/onboarding`.

### 2.2 Backend API (`backend/Cargo.toml` — Axum 0.7)
* [`backend/src/routes/mod.rs`](file:///c:/Users/Medhansh%20Pc/Desktop/Deku%20Finance/backend/src/routes/mod.rs) mounts 25 functional route modules under `/api/v1`:
  `auth`, `organisations`, `parties`, `catalogue`, `accounting`, `invoices`, `audit`, `departments`, `subscriptions`, `documents`, `documents_builder`, `consultant`, `banking`, `purchases`, `gst`, `gsp`, `kyc`, `inventory`, `imports`, `files`, `hsn`, `notifications`, `notes`, `marketplace`, `payments`.

### 2.3 Role-Based Access Control (7 Roles)
* [`supabase/migrations/20261018000016_superadmin_and_7_role_rbac_matrix.sql`](file:///c:/Users/Medhansh%20Pc/Desktop/Deku%20Finance/supabase/migrations/20261018000016_superadmin_and_7_role_rbac_matrix.sql) defines the 7 `organisation_role` enum values: `owner`, `cfo`, `admin`, `accountant`, `analyst`, `auditor`, `viewer` (plus legacy `'member'`).
* Enforced in Postgres RLS/RPCs via `public.has_role(p_org_id, p_roles)` and in Rust via `require_role()` ([`backend/src/integrations/mod.rs`](file:///c:/Users/Medhansh%20Pc/Desktop/Deku%20Finance/backend/src/integrations/mod.rs#L85-L115)).
* Frontend permission helpers currently exist only in [`apps/platform/src/modules/departments-members/team.ts`](file:///c:/Users/Medhansh%20Pc/Desktop/Deku%20Finance/apps/platform/src/modules/departments-members/team.ts) (`canInvite`, `canRunPayroll`, `canManageMembers`, `canManageDepartments`). General ERP screens rely on backend 403 rejection rather than role-aware UI explanation banners.

### 2.4 Existing Tutorial & Help Infrastructure
* **Framework:** [`apps/platform/src/lib/tutorials/paths.ts`](file:///c:/Users/Medhansh%20Pc/Desktop/Deku%20Finance/apps/platform/src/lib/tutorials/paths.ts) (9 paths), [`progress.ts`](file:///c:/Users/Medhansh%20Pc/Desktop/Deku%20Finance/apps/platform/src/lib/tutorials/progress.ts) (`localStorage` per `userId`), [`components/tutorial/TutorialCoach.tsx`](file:///c:/Users/Medhansh%20Pc/Desktop/Deku%20Finance/apps/platform/src/components/tutorial/TutorialCoach.tsx) (floating card highlighting `[data-tour="<target>"]` with `.tour-highlight`), and [`modules/help/HelpCentreView.tsx`](file:///c:/Users/Medhansh%20Pc/Desktop/Deku%20Finance/apps/platform/src/modules/help/HelpCentreView.tsx).
* **Existing Constraint:** [`tests/tutorials.test.ts`](file:///c:/Users/Medhansh%20Pc/Desktop/Deku%20Finance/tests/tutorials.test.ts) asserts exact 9-path IDs, valid page routes, and `data-tour` presence in `apps/platform/src`.
* **Missing:** Step completion by actual user action, spotlight backdrop, prerequisite/role/plan awareness, and server-side/session tutorial tracking inside demo sessions.

### 2.5 Module Reality & Integration Safety
* **Multi-Warehouse (`042_inventory.sql` + `inventory.rs` + `InventoryView.tsx`):** Supported (`warehouses` CRUD, per-warehouse stock adjustments, FIFO per item + warehouse). *Constraint:* Sales invoices deduct stock only from the company's default warehouse (`is_default = true`), and separate warehouse-to-warehouse transfer vouchers do not exist (transfers use paired out/in stock adjustments).
* **Document Builder (`044_business_documents.sql` + `documents_builder.rs`):** Supports Quotations, Proforma Invoices, Purchase Orders, Delivery Challans, and converting to Sales Invoices.
* **Departments & Budgets (`departments.rs` + `consultant.rs`):** Departments include `budget_allocated` / `budget_utilized`, `department_tasks`, payroll runs (`058_payroll_posts_to_ledger.sql`), and employee pay privacy (`057_employee_pay_privacy.sql`).
* **External Integration Seams:**
  * **GSP (`gsp.rs` / `integrations/gsp.rs`) & KYC (`kyc.rs` / `integrations/kyc.rs`):** Only `NotConfigured` and `Sandbox` exist; returns `503 *_not_configured` unless `GSP_PROVIDER` / `KYC_PROVIDER` is configured (and `Sandbox` is blocked when `DEKU_ENV=production`).
  * **Razorpay (`payments.rs`):** Returns `503 payments_not_configured` unless `RAZORPAY_*` & `DATA_ENCRYPTION_KEY` are configured.
  * **WhatsApp (`apps/platform/src/lib/collect/whatsapp.ts`):** Client-side `wa.me` deep links only (no server dispatch).
  * **Deku Konsultant (`consultant.rs`):** Deterministic on-premise SQL/RPC ledger analyst (no external LLM).
* **Keyboard Navigation ([`shortcuts.ts`](file:///c:/Users/Medhansh%20Pc/Desktop/Deku%20Finance/apps/platform/src/lib/keyboard/shortcuts.ts) & [`ShortcutBar.tsx`](file:///c:/Users/Medhansh%20Pc/Desktop/Deku%20Finance/apps/platform/src/components/keyboard/ShortcutBar.tsx)):** `F1` Executive, `F2` Konsultant, `F3` Vouchers, `F4–F9` Voucher types (Contra, Payment, Receipt, Journal, Sales, Purchase), `F10` Bank Rec, `F11` GST File, `Ctrl+K`/`Alt+G` Go To, `Esc` Gateway, plus Gateway A–W letter keys. Learn Centre Demo Bar must NOT override or collide with any of these keys.

### 2.6 Deployment & Baseline Tests
* **Docker Topology ([`docker-compose.yml`](file:///c:/Users/Medhansh%20Pc/Desktop/Deku%20Finance/docker-compose.yml)):** 9 services (`postgres`, `migrate`, `postgrest`, `backend-admin`, `backend-distributor`, `backend-platform`, `frontend-admin`, `frontend-distributor`, `frontend-platform`). Next.js 16 docs confirmed in `node_modules/next/dist/docs/`.
* **Baseline Test Run (2026-11-10):**
  * **Rust (`cargo test --manifest-path backend/Cargo.toml`):** **67 passed, 0 failed**.
  * **Vitest (`npm test`):** **36 files passed (319 tests), 1 file timed out (`tests/company-switch.test.tsx` timed out on 2 `GatewayLanding` tests under full-suite parallel jsdom load; passes 11/11 in 2.1s when executed standalone via `npx vitest run tests/company-switch.test.tsx`)**.
  * **E2E (`tests/e2e/`):** Node scripts (`stack.mjs`, `workflows.mjs`, `browser.mjs`, `banking.mjs`, `editing.mjs`, `reports.mjs`) available for running against live Docker Compose.

---

## 3. Gaps Required for Deku Learn Centre

| Area | Current State | Required Extension |
| :--- | :--- | :--- |
| **Learn Landing & Routing** | Single `/learn` page linking unauthenticated users to `/gateway?tour=...` and non-interactive docs cards. | Public `/learn` hub, `/learn/demo` (+ `/companies`, `/workspace` redirector), and full `/learn/docs` + category/article viewer with search, TOC, prev/next, and deep links into Demo workflows. |
| **Anonymous Demo Sessions** | 3 shared `demo-*` users mutating 2 shared orgs; no isolation, expiry, reset, or cleanup. | Isolated per-visitor demo sessions (`public.demo_sessions` + per-session ephemeral `auth.users` & cloned demo companies from 4 industry templates), strict rate/resource limits, TTL expiry + automated cleanup, and 1-click Reset. |
| **4 Industry Companies** | Only 2 sparse seed orgs (`Demo Traders`, `Demo Creative Studio`) with no invoices, inventory, bank lines, or payroll. | 4 complete, algebraically reconciled industry templates seeded deterministically (Wholesale: *Aster Trading Co.*, Services: *Northstar Consulting Pvt. Ltd.*, E-Commerce: *UrbanNest Retail Pvt. Ltd.*, Multi-Warehouse Retail: *Meridian Retail Pvt. Ltd.*). |
| **7-Role Switching** | Fixed user-to-role rows; switching role requires re-login as a different shared user. | Demo session role-switch endpoint (`owner`, `cfo`, `admin`, `accountant`, `analyst`, `auditor`, `viewer`) updating the visitor's active demo membership in Postgres/Rust + instant role/UI refresh + clear restriction explanations. |
| **Plan Switching (`GO` / `PRO` / `Enterprise`)** | Demo orgs pinned to `pro` or `go`; no `enterprise` row in `plans`; no plan simulation switcher. | Non-destructive demo entitlement simulation supporting `go`, `pro`, and `enterprise` (keeping commercial `plans` untouched or demo-scoped) + upgrade explanations + feature restriction banners in UI & backend checks. |
| **Demo Control Bar** | Simple static text banner when `user.is_demo` (`AppShell.tsx:508`). | Unobtrusive persistent Demo Control Bar inside `AppShell` when in a Learn Demo session: Company switcher, Role switcher (7), Plan switcher (`GO` / `PRO` / `Enterprise`), Learn/Tutorials drawer, Workflows drawer, Reset, Exit Demo, plus `DEMO ENVIRONMENT — NO REAL FINANCIAL TRANSACTIONS` badge. |
| **Tutorial Engine** | `TutorialCoach` highlights static `data-tour` elements only on `Next`. | Action-aware step verification, spotlight overlay, role/plan prerequisites, contextual help, workflow presets, and server/session progress persistence. |
| **External Safety** | Sandbox blocked in prod via `DEKU_ENV`; Razorpay/WhatsApp/email could still be misconfigured if env vars existed on a demo stack. | Hard block in backend routes (`gsp`, `kyc`, `payments`, `notifications`) + UI badges/modals when the authenticated caller is a demo session (`is_demo` claim / demo user), guaranteeing zero real external network calls or side effects. |

