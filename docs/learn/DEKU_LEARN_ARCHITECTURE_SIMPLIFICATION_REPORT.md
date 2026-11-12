# Deku Learn Centre — Architecture Simplification & Rollback Report

**Date:** 2026-11-10  
**Scope:** Part A audit, dependency verification, safe rollback plan, and target simplified architecture for the Public Deku Learn Centre.

---

## 1. Executive Summary

Phases 2 and 3 introduced a database-backed, per-visitor isolated writable demo infrastructure (`20261110000060_learn_demo_sessions.sql`, Rust `demo_access_token` / `/api/v1/learn/demo/*` routes, Next.js `/api/learn/demo/*` cookie-setting handlers, and `auth.rs` external-endpoint demo guards).

Per the **Architecture Simplification & Implementation Directive**, that writable per-visitor session/DB architecture exceeds the actual requirement:

- The Learn Centre must be **100% public** without registration, login, backend session provisioning, or database mutations.
- **Role (7 roles)** and **Plan (GO / PRO / Enterprise)** switching must be **frontend demonstration controls** that never modify customer subscriptions, real user permissions, backend JWT claims, or PostgreSQL records.
- Deku's existing **`AppShell`**, keyboard navigation (`F1–F11`, `ESC`, `Ctrl+K`), tutorial infrastructure (`TUTORIAL_PATHS`, `TutorialCoach`, `progress.ts`), and existing application views must be reused directly on top of deterministic read-only sample datasets for the 4 industry demo companies.

---

## 2. Persistence Verification (Migration `060`)

Before rolling back any database or backend artifacts, `deku-postgres` was queried directly:

```sql
SELECT filename FROM public.schema_migrations WHERE filename LIKE '%060%';
-- Result: (0 rows)

SELECT to_regclass('public.demo_sessions');
-- Result: NULL
```

**Conclusion:** Migration `20261110000060_learn_demo_sessions.sql` was **only** ever tested against the ephemeral throwaway container `deku-phase3-sql-proof` (which was destroyed immediately after SQL verification) and was **never applied** to `deku-postgres` or any persistent environment. Therefore, no forward corrective migration is required; safely removing the un-applied migration file cleanly restores migration history (`001`–`059`).

---

## 3. Classification of All Phase 2 & Phase 3 Changes

| Artifact / Change | Classification | Reason & Action |
|---|---|---|
| `supabase/migrations/20261110000060_learn_demo_sessions.sql` | **2. Writable transactional demo only / 4. Unnecessary** | Adds `demo_sessions`, `demo_activity_events`, altered RLS/org/immutability triggers (`is_demo`, `demo_session_id`), and `cleanup_expired_demo_sessions()`. Never applied to `deku-postgres`. **Action: Remove.** |
| `supabase/tests/learn_demo_sessions_test.sql` | **2. Writable transactional demo only** | SQL proof test suite for Migration 060 only. **Action: Remove.** |
| `backend/src/routes/learn_demo.rs` | **2. Writable transactional demo only** | Provisions/resets/exits DB demo users & organisations via `/api/v1/learn/demo/session*`. **Action: Remove.** |
| `backend/src/auth.rs` (`DEMO_ACCESS_TTL_SECS`, `is_demo`, `demo_session_id`, `demo_access_token`, `is_demo_claims`, `verify_demo_request`, `reject_if_demo`) | **2. Writable demo only / 5. Production compatibility risk** | Mutates core `Claims` struct and bearer parsing purely to support ephemeral demo DB JWTs. **Action: Revert via `git checkout`.** |
| `backend/src/routes/auth.rs`, `organisations.rs`, `subscriptions.rs`, `gsp.rs`, `kyc.rs`, `payments.rs`, `mod.rs`, `integrations/mod.rs`, `postgrest.rs` | **2. Writable demo only / 5. Production risk** | Adds `reject_if_demo` middleware checks and `learn_demo` wiring to production routes. Reverting eliminates any possibility of header/claim interference with production routes. **Action: Revert via `git checkout`.** |
| `apps/platform/src/app/api/learn/demo/session/{route.ts,reset/route.ts,exit/route.ts}` | **2. Writable transactional demo only** | Calls backend `/api/v1/learn/demo/*` and sets `deku_at`/`deku_rt` cookies for anonymous visitors. Setting auth cookies for demo mode conflicts with frontend-only no-login architecture. **Action: Remove.** |
| `tests/learn-demo-isolation.test.ts` | **2. Writable transactional demo only** | Tests removed `/api/learn/demo/session/*` handlers. **Action: Remove.** |
| `DEKU_LEARN_SECURITY_AND_ISOLATION.md` | **4. Unnecessary (superseded)** | Documents deferred Phase 3 writable-session backend architecture. **Action: Remove (and document deferral in spec).** |
| `apps/platform/src/lib/auth/session.ts` (`DEMO_ACCESS_MAX_AGE`, `DEMO_REFRESH_MAX_AGE`, `setDemoSessionCookies`, `"learn"` in `proxyTarget`) | **2. Writable demo only** (`PUBLIC_PATHS` `/learn` already existed / **1. Required**) | Remove `DEMO_ACCESS_MAX_AGE`, `DEMO_REFRESH_MAX_AGE`, `setDemoSessionCookies`, and `"learn"` proxy entry unless needed; retain `/learn` and `/api/learn` in `PUBLIC_PATHS`. **Action: Revert demo cookie additions.** |
| `apps/platform/src/modules/collect/CollectView.tsx` (`isDemo` WhatsApp dispatch guard) | **3. Useful but optional** | Harmless defensive guard disabling outbound WhatsApp `wa.me` links when `user?.is_demo === true` (covering legacy `/api/auth/demo` AND frontend Learn Demo mode if wired cleanly). **Action: Retain / adapt for Learn Demo.** |
| `apps/platform/src/app/learn/page.tsx` | **1. Required for public Learn Centre** | Public Learn Centre hub linking Interactive Demo and 8-category Documentation. **Action: Retain & refine.** |
| `apps/platform/src/app/learn/demo/page.tsx` & `companies/page.tsx` | **1. Required for public Learn Centre** | Interactive Demo overview and 4-company industry switcher. **Action: Retain & wire to instant frontend Demo Mode.** |
| `apps/platform/src/app/learn/demo/workspace/page.tsx` | **1. Required (needs refactor)** | Currently POSTs to removed `/api/learn/demo/session`. **Action: Refactor into public interactive Demo Workspace reusing `AppShell` + existing screens + Demo Control Bar.** |
| `apps/platform/src/app/learn/docs/{page.tsx,[category]/page.tsx,[category]/[slug]/page.tsx}` | **1. Required for public Learn Centre** | Public 8-category Manuals & Documentation Explorer with cross-links to Demo. **Action: Retain & validate.** |
| `apps/platform/src/components/learn/{LearnShell,DemoCompanyGrid,DocsExplorer}.tsx` | **1. Required for public Learn Centre** | Learn chrome, company selector cards, documentation search & ToC. **Action: Retain & update CTA routes.** |
| `apps/platform/src/lib/learn/{companies,docs-data}.ts` | **1. Required for public Learn Centre** | Authoritative 4 fictional industry companies (`aster-trading`, `northstar-consulting`, `urbannest-retail`, `meridian-retail`) and 8 documentation categories. **Action: Retain & keep synchronized with `demo-roles`, `demo-plans`, `sample-data`, and workflow docs.** |
| `tests/learn-centre.test.ts`, `DEKU_LEARN_CENTRE_IMPLEMENTATION_SPEC.md`, `DEKU_LEARN_DOCUMENTATION_STRUCTURE.md`, `DEKU_LEARN_EXISTING_SYSTEM_AUDIT.md` | **1. Required for public Learn Centre** | Specifications & test suite. **Action: Update spec and expand tests for simplified architecture.** |
| Existing `/api/auth/demo` (`apps/platform/src/app/api/auth/demo/route.ts`) | **Untouched (internal/dev only)** | Remains gated behind `DEKU_SEED_DEMO` / not linked or exposed by public `/learn`. **Action: Keep untouched & unexposed.** |

---

## 4. Rollback Plan & Safety Verification

1. **Database Rollback:**
   - Verified `deku-postgres` does not have Migration `060` or `public.demo_sessions`.
   - Delete `supabase/migrations/20261110000060_learn_demo_sessions.sql` and `supabase/tests/learn_demo_sessions_test.sql`.
   - No customer schemas, RLS policies, org membership triggers, immutability triggers, or `public.plans` records are modified.
2. **Rust Backend Rollback:**
   - Revert all Phase 3 edits across `backend/src/` via `git checkout -- backend/src/` and delete `backend/src/routes/learn_demo.rs`.
   - Production authentication (`auth.rs`), JWT claims, GSP, KYC, payments, subscriptions, organisations, and PostgREST proxy return verbatim to baseline `HEAD`.
   - Verify with `cargo test --manifest-path backend/Cargo.toml -j 1`.
3. **Next.js API / Auth Cookie Rollback:**
   - Remove `apps/platform/src/app/api/learn/demo/` (`session`, `session/reset`, `session/exit`), `tests/learn-demo-isolation.test.ts`, and `DEKU_LEARN_SECURITY_AND_ISOLATION.md`.
   - Revert `DEMO_ACCESS_MAX_AGE`, `DEMO_REFRESH_MAX_AGE`, `setDemoSessionCookies`, and `"learn"` in `proxyTarget` in `apps/platform/src/lib/auth/session.ts` while preserving `/learn` and `/api/learn` in `PUBLIC_PATHS`.
   - Customer login, refresh cookies, and protected route redirection in `updateSession` remain untouched.

---

## 5. Resulting Simplified Target Architecture

1. **Zero Auth / Zero Backend Demo Sessions:** Visitors open `/learn`, `/learn/docs/*`, `/learn/demo`, `/learn/demo/companies`, and `/learn/demo/workspace` directly with no sign-up, no login, no cookies, and no shared writable demo DB access.
2. **Frontend Simulation Configs (No Parallel Engine):**
   - `apps/platform/src/lib/learn/demo-roles.ts` models the exact 7 RBAC roles (`owner`, `cfo`, `admin`, `accountant`, `analyst`, `auditor`, `viewer`) matching `apps/platform/src/modules/departments-members/team.ts` and database RBAC.
   - `apps/platform/src/lib/learn/demo-plans.ts` models `go`, `pro`, and `enterprise` strictly matching `PricingPlansSection.tsx`, honestly marking unbuilt/external capabilities (`Available in demo`, `Simulated`, `Requires external provider`, `Not yet available`).
3. **Reused Application Runtime (`AppShell` + Existing Views + Sample Data):**
   - `/learn/demo/workspace` wraps the real reused `AppShell` and real Deku module views inside a dedicated public `LearnDemoProvider` backed by version-controlled read-only industry sample data (`apps/platform/src/lib/learn/sample-data.ts`).
   - A compact **Demo Control Bar** sits cleanly inside the shell in demo mode with Company (4), Role (7), Plan (3), Learn, Workflows, Reset, Exit Demo, and the `DEMO ENVIRONMENT — NO REAL FINANCIAL TRANSACTIONS` badge while keeping `F1–F11`, `ESC`, and `Ctrl+K` operational.
4. **Integrated Tutorials & 8 Business Workflows:**
   - Extends existing `TUTORIAL_PATHS`, `progress.ts` (using an isolated anonymous localStorage key when in public demo mode), and `TutorialCoach.tsx` with role/plan-aware guidance across all 8 core workflows without breaking existing assertions in `tests/tutorials.test.ts`.

