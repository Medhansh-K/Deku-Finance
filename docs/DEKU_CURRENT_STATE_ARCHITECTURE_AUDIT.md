# DEKU FINANCE — CODEBASE ARCHITECTURE & IMPLEMENTATION READINESS AUDIT

**Document Identifier:** `DEKU_CURRENT_STATE_ARCHITECTURE_AUDIT.md`  
**Audit Execution Date:** 2026-11-08  
**Audit Mode:** Inspection & Verification Only (Zero application code modified)  
**Target Repository:** `c:\Users\Medhansh Pc\Desktop\Deku Finance`  
**Git Branch:** `fix/data-integrity-privacy-demo` (Commit `76c4b7c`)  

---

## 1. Executive Summary

This technical audit examines the existing codebase of Deku Finance to verify what has actually been implemented versus what exists only as documentation, schema definitions, or intended architecture.

### Key Audit Findings

1. **The Three Interfaces (`:3001` Admin, `:3002` Distributor, `:3000` Platform):**
   * **Separation Status:** *Partially Separated / Environment-Isolated.*
   * All three frontend interfaces share a **single Next.js 16 codebase** and a single Docker build context, isolated at runtime via environment variables (`DEKU_INTERFACE=admin|distributor|platform`) and route rewrites in [`src/proxy.ts`](../src/proxy.ts).
   * All three backend instances compile the **same single Rust/Axum binary** (`backend/Cargo.toml`), deployed in 3 separate Docker containers on ports `8081`, `8082`, and `8080`.
   * **Critical Decoupling Gap:** The ecosystem state (distributors, admins, dual-gate license requests, and client leads) is currently operated through Next.js Route Handlers in [`src/app/api/ecosystem/`](../src/app/api/ecosystem/) that read/write to an **in-memory JavaScript global object** (`globalThis.__deku_ecosystem_store` in [`src/lib/ecosystem/store.ts`](../src/lib/ecosystem/store.ts)), despite migration `000059` having already created the corresponding PostgreSQL tables. Changes are volatile across Node.js restarts.

2. **Database & Tenancy Topology:**
   * **Current State:** *Single PostgreSQL Core with Shared Schemas and RLS.*
   * There is **no Supabase hosted control plane** and **no database-per-customer** routing in the running stack.
   * A single PostgreSQL 16 database (`deku`) serves all data (control plane records, distributor registry, and customer business ledgers). Isolation is enforced at the query level via PostgreSQL Row-Level Security (`RLS`) tied to `organisation_id`.
   * Migration [`supabase/migrations/20261104000047_single_customer_runtime.sql`](../supabase/migrations/20261104000047_single_customer_runtime.sql) explicitly locks the database to a single customer organisation per runtime instance.

3. **Redis, Caching, and Background Workers:**
   * **Current State:** *Completely Absent.*
   * There is **zero Redis code or dependency** anywhere in the repository (`package.json`, `Cargo.toml`, or `docker-compose.yml`).
   * There are no background job queues (no Celery, BullMQ, Sidekiq, or Tokio task pools). All accounting, invoicing, tax calculation, and ledger operations are **100% synchronous HTTP request-response workflows**.
   * There is **no debounced autosave**; drafts are saved only when a user explicitly submits the form.

4. **Core Financial & Accounting Engine:**
   * **Current State:** *Production-Grade & Fully Implemented in Rust/PostgreSQL.*
   * Double-entry bookkeeping ($\sum \text{Dr} - \sum \text{Cr} = 0$), ALERX 4-tier Chart of Accounts, F4–F9 voucher desks, gapless sequence numbers, atomic invoice issuance, draft voucher in-line editing, 1-click reversals, Maker-Checker approvals, and real-time GAAP financial statements (Balance Sheet, P&L, Trial Balance, General Ledger) are fully implemented and verified in Rust and SQL.
   * GST computation (Intra vs Inter-State, Rule 88A optimal ITC set-off, GSTR-1 offline JSON, GSTR-3B) and perpetual FIFO inventory with multi-warehouse tracking are verified and operational.

---

## 2. Actual Repository Structure

The workspace is a monorepo containing the Next.js frontend, Rust backend, PostgreSQL migration pipeline, and deployment configurations.

```
c:\Users\Medhansh Pc\Desktop\Deku Finance\
├── backend/                         # Rust Axum Web Backend
│   ├── Cargo.toml                   # Axum 0.7, Tokio 1, Tower, Serde, JsonWebToken, Reqwest
│   ├── Cargo.lock
│   ├── Dockerfile                   # Multi-stage Rust build (debian:bookworm-slim runner)
│   └── src/
│       ├── main.rs                  # Axum router bootstrap, TCP listener, graceful shutdown
│       ├── config.rs                # Env loader (PORT, POSTGREST_URL, JWT_SECRET, etc.)
│       ├── auth.rs                  # JWT HS256 verification, Bcrypt password hashing
│       ├── crypto.rs                # AES-256-GCM cipher for third-party credentials
│       ├── error.rs                 # Strongly-typed AppError enum with HTTP status mapping
│       ├── postgrest.rs             # HTTP tunnel to PostgREST with user Bearer token forwarding
│       ├── razorpay.rs              # Razorpay dynamic UPI link and HMAC-SHA256 webhook client
│       ├── gst/mod.rs               # Statutory GST engine: Place of Supply & Rule 88A ITC math
│       ├── integrations/
│       │   ├── gsp.rs               # GspProvider trait, Sandbox and NotConfigured implementations
│       │   ├── kyc.rs               # KycProvider trait, Sandbox PAN/GSTIN validation
│       │   └── mod.rs               # Provider dispatcher and factory
│       ├── models/                  # Serde request/response structs (accounting, invoice, etc.)
│       └── routes/                  # 22 Axum route handler modules
│           ├── accounting.rs        # Ledger posting, drafts, reversals, financial reports
│           ├── audit.rs             # Append-only security audit trail & user activity logs
│           ├── auth.rs              # Login, signup, password reset, session refresh
│           ├── banking.rs           # Bank statement parsing & reconciliation match engine
│           ├── catalogue.rs         # Item master catalogue
│           ├── consultant.rs        # Virtual AI CFO metric rollups across 10 departments
│           ├── departments.rs       # Org chart, employee directory, payroll runs
│           ├── documents.rs         # PDF storage & high-DPI rendering
│           ├── documents_builder.rs # Quotations, proposals, purchase orders
│           ├── files.rs             # Byte-blob voucher proof storage (receipts, UTRs)
│           ├── gsp.rs               # GSP API endpoints: sessions, OTP, filing, IRN, E-Way bills
│           ├── gst.rs               # GSTR-1 and GSTR-3B offline computation endpoints
│           ├── health.rs            # /healthz and /ready probes
│           ├── hsn.rs               # 15,000+ HSN/SAC tariff code search
│           ├── imports.rs           # Tally XML and bulk CSV staged ETL engine
│           ├── inventory.rs         # FIFO stock ledgers, warehouses, adjustments
│           ├── invoices.rs          # B2B Tax invoice issuance & Bharat UPI QR generation
│           ├── kyc.rs               # Party statutory KYC verification
│           ├── marketplace.rs       # Amazon/Flipkart/Meesho TCS settlement parser
│           ├── notes.rs             # Credit Notes & Debit Notes outward adjustments
│           ├── notifications.rs     # In-app notifications & cron trigger endpoint
│           ├── organisations.rs     # Tenant configuration, trade names, single-org bootstrap
│           ├── parties.rs           # Customers & vendors directory, GSTIN check-digit
│           ├── payments.rs          # Razorpay payment collection links & webhooks
│           ├── purchases.rs         # Vendor purchase bills & ITC eligibility classification
│           └── subscriptions.rs     # Plan entitlements & feature gate checks
├── db/
│   ├── Dockerfile                   # postgres:16-alpine runner for migrations
│   └── migrate.sh                   # Advisory-locked sequential psql runner for migrations
├── deploy/
│   └── gcp/
│       ├── cloudbuild.yaml          # Google Cloud Build pipeline (Cloud Run + Cloud SQL)
│       └── README.md                # Cloud Run deployment runbook
├── docs/                            # Architectural specifications & baseline audits
├── public/                          # Static assets, fonts, icons, manifest
├── src/                             # Next.js 16 Frontend Application
│   ├── app/                         # App Router pages and API routes
│   │   ├── (auth)/                  # Login, signup, reset-password, join
│   │   ├── admin/                   # Deku Admin Portal (Medhansh authority view)
│   │   ├── api/                     # Route handlers (auth, backend proxy, ecosystem store)
│   │   ├── approvals/               # Maker-Checker voucher review desk
│   │   ├── audit/                   # Security audit logs view
│   │   ├── banking/                 # Bank statement upload & matching
│   │   ├── builder/                 # Document Builder (Invoices, Quotes, POs, Challans)
│   │   ├── collect/                 # Payment links & UPI collection
│   │   ├── companies/               # Multi-entity switcher & single-tenant runtime lock
│   │   ├── consultant/              # Deku Consultant AI CFO dashboard
│   │   ├── day-book/                # Chronological transaction register with reversals
│   │   ├── departments-members/     # 10 departments, employee directory, payroll runs
│   │   ├── distributor/             # Regional Distributor Portal (franchise view)
│   │   ├── executive/               # FP&A high-level executive dashboard
│   │   ├── gateway/                 # Gateway of Deku (core ERP mission control)
│   │   ├── gst/                     # GST returns hub (GSTR-1, GSTR-3B, filings)
│   │   ├── help/                    # Help Centre & learning documentation
│   │   ├── import/                  # Tally XML & CSV bulk data migration desk
│   │   ├── inventory/               # Multi-warehouse stock tracking at FIFO cost
│   │   ├── kyc/                     # Statutory PAN/GSTIN verification desk
│   │   ├── masters/                 # Chart of accounts, parties master, item catalogue
│   │   ├── purchases/               # Vendor bill entry & ITC classification
│   │   ├── reconciliation/          # Monthly bank reconciliation statements
│   │   ├── reports/                 # Balance Sheet, P&L, Trial Balance, General Ledger
│   │   ├── request-setup/           # Prospective client onboarding lead form
│   │   ├── settings/                # Organisation preferences & license controls
│   │   └── vouchers/                # F4–F9 double-entry voucher posting desk
│   ├── components/                  # Reusable UI components (DataTable, Modal, Buttons)
│   ├── context/                     # React Contexts (AuthContext, KeyboardNavContext)
│   ├── layouts/                     # Shell layouts (AppShell, GatewayLayout, WorkspaceLayout)
│   ├── lib/                         # Client utilities, formatters, calculators, ecosystem store
│   ├── modules/                     # Domain view modules (gateway, vouchers, gst, etc.)
│   ├── proxy.ts                     # Next.js 16 root proxy (replaces middleware.ts)
│   └── types/                       # Shared TypeScript definitions
├── supabase/
│   ├── config.toml                  # Supabase CLI local configuration
│   ├── migrations/                  # 60 sequential idempotent SQL migrations
│   └── seed.sql                     # Development seed data (demo companies & users)
├── tests/                           # Vitest unit and integration test suites
├── docker-compose.yml               # Local 8-container multi-interface development stack
├── Dockerfile                       # Multi-stage Next.js standalone container build
├── next.config.ts                   # Turbopack, standalone output, proxyClientMaxBodySize: 12mb
├── package.json                     # Next.js 16.4.2, React 19.2.0, Tailwind CSS 4.0.0
└── tsconfig.json                    # Strict TypeScript configuration
```

---

## 3. Existing Three-Interface Architecture Audit

The user requirement specifies three independent interfaces:
1. **Deku Admin** (Medhansh / platform owner)
2. **Distributor Portal** (Franchise partners / territory onboarding)
3. **Application Runtime** (End-client ERP application)

### Architectural Audit Matrix

| Architecture Dimension | Deku Admin (`:3001`) | Distributor Portal (`:3002`) | Application Runtime (`:3000`) | Current Coupling Status |
| :--- | :--- | :--- | :--- | :--- |
| **Frontend Source** | `src/app/admin/page.tsx` | `src/app/distributor/page.tsx` | `src/app/gateway/page.tsx` + modules | **Shared Codebase** (Single Next.js project) |
| **Frontend Build Config** | Built from root `Dockerfile` | Built from root `Dockerfile` | Built from root `Dockerfile` | **Shared Build** (Same container image) |
| **Runtime Boundary** | `DEKU_INTERFACE=admin` | `DEKU_INTERFACE=distributor` | `DEKU_INTERFACE=platform` | **Env-Variable Partitioning** in `src/proxy.ts` |
| **Authentication Boundary** | Bypasses client login (`/admin` in `PUBLIC_PATHS`) | Bypasses client login (`/distributor` in `PUBLIC_PATHS`) | Requires `Activation Key` + Email + Password | **Partially Decoupled** (No JWT/session for Admin/Distributor yet) |
| **Backend API Service** | `deku-backend-admin` (`:8081`) | `deku-backend-distributor` (`:8082`) | `deku-backend-platform` (`:8080`) | **Separately Deployed Containers** running identical Rust binary |
| **Server-Side Enforcement** | `src/proxy.ts` redirects `/distributor` to `/admin` | `src/proxy.ts` redirects `/admin` to `/distributor` | Normal ERP route guards | **Enforced at Reverse Proxy** |
| **State Storage Layer** | In-Memory `__deku_ecosystem_store` | In-Memory `__deku_ecosystem_store` | PostgreSQL `deku` via PostgREST | **Architectural Disconnect** (Ecosystem in Node RAM; ERP in Postgres) |
| **Independent Restart** | Yes (`docker restart deku-frontend-admin`) | Yes (`docker restart deku-frontend-distributor`) | Yes (`docker restart deku-frontend-platform`) | **Independently Operable Containers** |

### Verified Boundary Findings

1. **Route Isolation in Reverse Proxy:**
   [`src/proxy.ts`](../src/proxy.ts) lines 8–24 enforces:
   ```typescript
   if (dekuInterface === "admin") {
     if (pathname === "/") return NextResponse.redirect(new URL("/admin", request.url));
     if (pathname.startsWith("/distributor")) return NextResponse.redirect(new URL("/admin", request.url));
   }
   if (dekuInterface === "distributor") {
     if (pathname === "/") return NextResponse.redirect(new URL("/distributor", request.url));
     if (pathname.startsWith("/admin")) return NextResponse.redirect(new URL("/distributor", request.url));
   }
   ```
   Admin cannot navigate to Distributor routes, and Distributor cannot navigate to Admin routes.

2. **The Ecosystem In-Memory Volatility Risk:**
   While the UI and route boundaries are isolated, the API endpoints for Admin and Distributor (`/api/ecosystem/admin` and `/api/ecosystem/distributor`) do not execute SQL against PostgreSQL or Supabase. They read from and write to [`src/lib/ecosystem/store.ts`](../src/lib/ecosystem/store.ts) (`globalThis.__deku_ecosystem_store`).
   *Because each container runs an isolated Node.js process, a license approved in `frontend-admin` is stored in `frontend-admin`'s RAM and is NOT visible inside `frontend-distributor` or `frontend-platform`.*

---

## 4. Docker and Deployment Status

### Services Defined in [`docker-compose.yml`](../docker-compose.yml)

The local stack defines 8 containers across 3 functional tiers:

| Tier | Container Name | Base Image / Build Context | Port Mapping | Healthcheck |
| :--- | :--- | :--- | :--- | :--- |
| **Persistence Core** | `deku-postgres` | `postgres:16-alpine` | `127.0.0.1:5433:5432` | `pg_isready -h 127.0.0.1 -U postgres -d deku` |
| **Migration Runner** | `deku-migrate` | `db/Dockerfile` (postgres:16-alpine) | None (one-shot exit) | Waits for `deku-postgres` healthy |
| **REST Engine** | `deku-postgrest` | `postgrest/postgrest:latest` | Internal `3000` | Waits for `deku-migrate` exit 0 |
| **Backend: Admin** | `deku-backend-admin` | `./backend` (debian:bookworm-slim) | `127.0.0.1:8081:8080` | `curl -fsS http://127.0.0.1:8080/ready` |
| **Backend: Distributor** | `deku-backend-distributor` | `./backend` (debian:bookworm-slim) | `127.0.0.1:8082:8080` | `curl -fsS http://127.0.0.1:8080/ready` |
| **Backend: Platform** | `deku-backend-platform` | `./backend` (debian:bookworm-slim) | `127.0.0.1:8080:8080` | `curl -fsS http://127.0.0.1:8080/ready` |
| **Frontend: Admin** | `deku-frontend-admin` | `.` (Node 22 standalone) | `127.0.0.1:3001:3000` | Node fetch check to `/admin` |
| **Frontend: Distributor** | `deku-frontend-distributor` | `.` (Node 22 standalone) | `127.0.0.1:3002:3000` | Node fetch check to `/distributor` |
| **Frontend: Platform** | `deku-frontend-platform` | `.` (Node 22 standalone) | `127.0.0.1:3000:3000` | Node fetch check to `/login` |

### Deployment Characteristics
* **Networks & IP Binding:** All host port bindings are strictly bound to `127.0.0.1` (`127.0.0.1:3000:3000`), preventing accidental exposure on public network interfaces.
* **Persistent Volumes:** Exactly one volume exists: `pgdata` bound to `/var/lib/postgresql/data`.
* **GCP Cloud Run Deployment:** [`deploy/gcp/cloudbuild.yaml`](../deploy/gcp/cloudbuild.yaml) builds only 3 images (`deku-migrate`, `deku-backend`, `deku-frontend`) for a single-customer deployment on Cloud Run connected to Google Cloud SQL. It does **not** deploy the three-interface architecture.

---

## 5. Backend Architecture (Rust / Axum / Tokio)

The backend is written in Rust (`edition = "2021"`) compiled with Axum 0.7 and Tokio 1.

### Structural Breakdown
* **Crate Dependencies ([`backend/Cargo.toml`](../backend/Cargo.toml)):**
  `axum`, `tokio` (full), `tower`, `tower-http` (cors, trace, limit), `tracing`, `serde`, `serde_json`, `reqwest` (rustls-tls), `dotenvy`, `chrono`, `jsonwebtoken`, `bcrypt`, `sha2`, `rand`, `base64`, `aes-gcm`.
* **Architecture Style:** Monolithic async HTTP gateway communicating with PostgreSQL via PostgREST.
* **Authentication Pipeline ([`backend/src/auth.rs`](../backend/src/auth.rs)):**
  * Issues HS256 JWT tokens with `aud: "deku"`.
  * Claims include `sub` (User ID), `email`, `role`, `exp` (1 hour), and `org_id`.
  * Extracts Bearer tokens from `Authorization` header and forwards them to PostgREST to activate PostgreSQL Row-Level Security (`RLS`).
* **Statutory Engine ([`backend/src/gst/mod.rs`](../backend/src/gst/mod.rs)):**
  * Implements Indian Goods & Services Tax (GST) mathematical rules.
  * Handles Place of Supply determination (CGST + SGST vs. IGST).
  * Implements Rule 88A Input Tax Credit utilization sequencing.

---

## 6. Supabase Control Plane Status

The target architecture calls for Supabase to manage the central platform control plane (distributors, licenses, customer DB routing, billing).

### Verification Findings
* **Is a Supabase Control Plane currently running?** **NO.**
* **Is the Supabase Client SDK in use?** **NO.** Neither `@supabase/supabase-js` nor `@supabase/ssr` is installed in `package.json`.
* **Why does the `supabase/` directory exist?** The project uses the local Supabase CLI directory convention (`supabase/migrations/`, `supabase/config.toml`, `supabase/seed.sql`) as its migration storage format.
* **How are migrations actually applied?** They are executed by a custom shell script ([`db/migrate.sh`](../db/migrate.sh)) running native `psql` against raw PostgreSQL.

---

## 7. Customer PostgreSQL Data Plane Status

### Current Database Topology
* **Database Count:** Exactly **1** physical database named `deku`.
* **Database-per-Customer Routing:** **DOES NOT EXIST.**
* **Current Multi-Tenancy Model:**
  * Multi-tenancy is implemented via **Shared Tables + Row-Level Security (RLS)** in PostgreSQL.
  * Every table (`journal_entries`, `sales_invoices`, `parties`, `catalogue_items`) has an `organisation_id UUID NOT NULL REFERENCES public.organisations(id)` column.
  * RLS policies ensure that authenticated queries can only access rows where `organisation_id` matches the user's active membership in `auth.users` / `organisation_members`.
* **Single Customer Runtime Lock:**
  Migration [`20261104000047_single_customer_runtime.sql`](../supabase/migrations/20261104000047_single_customer_runtime.sql) restricts the instance to a single company, enforcing a dedicated single-tenant runtime.

---

## 8. Migration System Status

### Migration Directory & Execution Mechanism
* **Location:** [`supabase/migrations/`](../supabase/migrations/)
* **Total Migration Files:** **60 SQL files** (from `20261018000000_platform_auth.sql` to `20261107000059_distributor_and_license_ecosystem.sql`).
* **Tracking Table:** `public.schema_migrations(version text primary key, applied_at timestamptz)`.
* **Concurrency Protection:** [`db/migrate.sh`](../db/migrate.sh) acquires a PostgreSQL advisory lock (`lock_id=7274261`) to prevent concurrent runner collisions.

### Key Deficiencies Against Target Architecture
1. **No Separation between Control Plane and Data Plane Migrations:** Control plane tables (`platform_admins`, `distributors`, `platform_licenses`) and business accounting tables (`ledgers`, `journal_entries`) reside in the same migration folder and run against the same database.
2. **No Rollback / Down Migrations:** All migration files are forward-only (`.sql`). There are no `.down.sql` scripts or automated rollback mechanisms.
3. **No Module-Specific Migrations:** Migrations are monolithic. A customer purchasing only the "GO" tier still receives tables for AI CFO memory (`000015`), marketplace settlements (`000035`), and GSP integration (`000037`).

---

## 9. Customer Database Provisioning Status

* **Automated Customer DB Provisioning:** **DOES NOT EXIST.**
* There is no database catalog, connection pool router, or orchestration script (Terraform, Cloud SQL API, or Docker socket automation) to spawn a new PostgreSQL database when a client activation key is minted.
* New organizations are created via the stored procedure `public.create_organisation(...)` inside the single shared database.

---

## 10. GO / PRO / Enterprise Infrastructure Readiness

The target specification defines:
* **GO:** Separate customer database + Shared runtime.
* **PRO:** Separate customer database + Allocated runtime.
* **Enterprise:** Separate customer database + Allocated runtime + Separate physical server.

### Current Readiness Assessment: **NOT READY**

| Required Capability | Current Implementation Status | Evidence / File Path |
| :--- | :--- | :--- |
| **Dynamic DB Connection Routing** | Not Implemented | `backend/src/postgrest.rs`: Hardcoded single `POSTGREST_URL` |
| **Tenant Compute Allocation** | Not Implemented | All tenants execute on same Docker containers |
| **License-to-Compute Mapping** | In-Memory Only | `src/lib/ecosystem/store.ts`: `planTier` string stored in RAM |
| **Automated DB Spawning** | Not Implemented | No database creation orchestration exists |
| **Resource Quota Enforcement** | Partially Implemented in SQL | `supabase/migrations/20261031000039_subscriptions.sql` checks seat limits |

---

## 11. Redis and Caching Status

### Current Implementation Status: **COMPLETELY ABSENT**

* **Redis Client:** None (`package.json` and `backend/Cargo.toml` contain no Redis drivers).
* **Caching Layer:** There is no Redis caching layer. Cache control relies on React Query client-side cache (`staleTime: 30000` in [`src/layouts/AppShell.tsx`](../src/layouts/AppShell.tsx)) and HTTP `Cache-Control` headers.
* **Draft Autosave Audit:**
  * There is **no debounced autosave** to Redis, PostgreSQL, or LocalStorage.
  * Vouchers and Invoices are saved only when the user explicitly clicks "Save as Draft".
  * If a user refreshes or closes the browser tab before clicking save, unsaved form input is caught only by an in-memory `dirtyRef` trigger that displays a native `window.confirm` dialog.

---

## 12. Worker and Job Scheduling Status

### Current Implementation Status: **SYNCHRONOUS ONLY**

* **Worker Pool:** None. There are no asynchronous job processors (no Celery, BullMQ, or Tokio worker pool).
* **Scheduling:** The only scheduled task hook is `POST /api/v1/internal/notifications/generate` in [`backend/src/routes/notifications.rs`](../backend/src/routes/notifications.rs), guarded by `X-Deku-Cron-Secret`. It requires an external HTTP scheduler (e.g. Cloud Scheduler) to trigger it.
* **Transaction Consistency in Financial Operations:**
  * Financial postings (`issue_sales_invoice`, `post_journal_entry`, `reverse_journal_entry`) are **synchronous PostgreSQL ACID transactions**.
  * They run within atomic PostgreSQL stored procedures (`ON_ERROR_STOP=1`).
  * If a transaction does not balance ($\sum \text{Dr} \neq \sum \text{Cr}$), PostgreSQL aborts the transaction immediately. This design guarantees ledger integrity without relying on an asynchronous queue.

---

## 13. Learning Centre & Interactive Demo Audit

### 1. Learning Centre
* **Status:** *Implemented & Functional.*
* **Location:** [`src/app/help/page.tsx`](../src/app/help/page.tsx) and [`src/modules/help/HelpCentreView.tsx`](../src/modules/help/HelpCentreView.tsx).
* Contains 9 structured learning paths (Double-entry accounting, GST compliance, banking reconciliation, keyboard navigation, and invoice issuance).

### 2. Interactive Demo Mode
* **Status:** *Partially Implemented.*
* **Components:**
  * [`src/components/tutorial/InteractivePlanTutorialModal.tsx`](../src/components/tutorial/InteractivePlanTutorialModal.tsx): Interactive plan comparator modal (GO Freelancer vs PRO Enterprise).
  * [`src/components/tutorial/TutorialCoach.tsx`](../src/components/tutorial/TutorialCoach.tsx): Floating walkthrough coach with step-by-step pointers.
  * [`src/app/api/auth/demo/route.ts`](../src/app/api/auth/demo/route.ts): Logs demo visitors into pre-seeded accounts using `DEKU_SEED_DEMO=true`.
* **Deficiencies:**
  * **No Demo Reset Functionality:** There is no endpoint or button to reset a demo account after testing. Modifications persist in the database.
  * **No Demo Expiry / Ephemeral Teardown:** Demo accounts exist permanently in `auth.users` alongside real accounts.

---

## 14. Industry Demo Readiness

The target architecture specifies 5 industry demo templates:
1. Professional Services / Consultancy
2. Trading and Distribution
3. Retail
4. E-commerce
5. Project-based Services

### Current Status in [`supabase/seed.sql`](../supabase/seed.sql)

| Industry Category | Status in Codebase | Existing Seed Entity |
| :--- | :---: | :--- |
| **Trading and Distribution** | **SEEDED** | `Demo Traders Pvt Ltd` (GST B2B wholesale trading company, PRO tier) |
| **Professional Services** | **PARTIAL** | `Demo Creative Studio` (Freelance/consultancy services, GO tier) |
| **Retail** | **NOT SEEDED** | None (Fictional Retail LLP is seeded only as a customer, not as an active company) |
| **E-commerce** | **NOT SEEDED** | None (Marketplace TCS settlement schemas exist, but no seeded e-commerce company) |
| **Project-based Services** | **NOT SEEDED** | None |

---

## 15. Current Product Module Verification

| Module Name | Verification Classification | Frontend File | Backend API Route | Migration File |
| :--- | :---: | :--- | :--- | :--- |
| **Identity & Auth** | **VERIFIED IN CODE** | `src/app/(auth)/login/` | `backend/src/routes/auth.rs` | `000000`, `000049` |
| **Organisation Tenancy** | **VERIFIED IN CODE** | `src/modules/companies/` | `routes/organisations.rs` | `000002`, `000030` |
| **7-Role RBAC** | **VERIFIED IN CODE** | `src/context/AuthContext.tsx` | `backend/src/auth.rs` | `000016` |
| **Chart of Accounts** | **VERIFIED IN CODE** | `src/modules/masters/chart-of-accounts/` | `routes/accounting.rs` | `000005`, `000011` |
| **Vouchers & Ledgers** | **VERIFIED IN CODE** | `src/modules/vouchers/` | `routes/accounting.rs` | `000006`, `000010`, `000027` |
| **Sales Invoicing** | **VERIFIED IN CODE** | `src/modules/builder/` | `routes/invoices.rs` | `000007`, `000008`, `000032` |
| **Purchase Accounting** | **VERIFIED IN CODE** | `src/modules/purchases/` | `routes/purchases.rs` | `000024` |
| **GST Computation** | **VERIFIED IN CODE** | `src/modules/gst/` | `backend/src/gst/mod.rs` | `000007`, `000028`, `000033` |
| **Inventory (FIFO)** | **VERIFIED IN CODE** | `src/modules/inventory/` | `routes/inventory.rs` | `000042` |
| **Bank Reconciliation** | **VERIFIED IN CODE** | `src/modules/reconciliation/` | `routes/banking.rs` | `000019`, `000056` |
| **Financial Reporting** | **VERIFIED IN CODE** | `src/modules/reports/` | `routes/accounting.rs` | `000045`, `000046`, `000054` |
| **Payroll (Finance-HR)** | **PARTIAL** | `src/modules/departments-members/` | `routes/departments.rs` | `000013`, `000057`, `000058` |
| **Procurement (POs)** | **PARTIAL** | `src/modules/builder/` | `routes/documents_builder.rs` | `000044` |
| **CRM / Quotes** | **PARTIAL** | `src/modules/builder/` | `routes/documents_builder.rs` | `000044` |
| **Maker-Checker Approvals**| **VERIFIED IN CODE** | `src/modules/approvals/` | `routes/accounting.rs` | `000020` |
| **Audit Logging** | **VERIFIED IN CODE** | `src/modules/audit/` | `routes/audit.rs` | `000009`, `000014` |
| **Deku Consultant AI CFO** | **VERIFIED IN CODE** | `src/modules/consultant/` | `routes/consultant.rs` | `000015`, `000017`, `000023` |
| **GSP Integration** | **MOCK / SANDBOX** | `src/app/gst/returns/` | `backend/src/integrations/gsp.rs`| `000037` |
| **Razorpay Payments** | **VERIFIED IN CODE** | `src/modules/collect/` | `backend/src/razorpay.rs` | `000036` |
| **Distributor Ecosystem** | **PARTIAL (IN-MEMORY)** | `src/app/admin/`, `src/app/distributor/` | `src/app/api/ecosystem/` | `000059` (DB tables disconnected) |

---

## 16. Security and Isolation Findings

1. **Row-Level Security (RLS) is Robust:** In the core ERP data plane, all queries pass through PostgREST carrying the user's JWT. PostgreSQL verifies `organisation_id` via `auth.uid()`, preventing cross-tenant data leakage.
2. **Missing Token Validation on Ecosystem API Routes:** [`src/app/api/ecosystem/admin/route.ts`](../src/app/api/ecosystem/admin/route.ts) and [`distributor/route.ts`](../src/app/api/ecosystem/distributor/route.ts) currently lack server-side authorization headers. Any internal client reaching port 3001 or 3002 can execute admin actions without verifying a cryptographic signature.
3. **Third-Party Secret Encryption:** The Rust engine uses AES-256-GCM ([`backend/src/crypto.rs`](../backend/src/crypto.rs)) to encrypt Razorpay tokens and GSP credentials at rest.

---

## 17. Technical Debt and Risks

| Severity | Risk Title | Architectural Impact & Evidence |
| :---: | :--- | :--- |
| **CRITICAL** | **In-Memory Ecosystem State** | Admin and Distributor ecosystem state is stored in `globalThis.__deku_ecosystem_store` ([`src/lib/ecosystem/store.ts`](../src/lib/ecosystem/store.ts)). Data is lost on container restart and is not synchronized across containers. |
| **HIGH** | **Co-located Control & Data Planes** | Control plane records (admins, distributors, licenses) share the exact same PostgreSQL database instance (`deku`) as customer accounting records, violating control-plane data isolation. |
| **HIGH** | **No Dynamic DB-per-Customer Routing** | Rust backend (`backend/src/postgrest.rs`) has a single static `POSTGREST_URL`. It cannot route requests dynamically to separate customer databases. |
| **HIGH** | **Missing Autosave & Redis Queue** | No Redis infrastructure or background workers exist. In-flight invoice or voucher drafts are lost if the user navigates away or disconnects. |
| **MEDIUM** | **Single Codebase Running 3 Roles** | All three interfaces run the same Next.js bundle and Rust binary, relying on runtime environment variables for separation. A misconfiguration could expose routes across interfaces. |
| **MEDIUM** | **Forward-Only Migrations** | The 60 SQL migrations have no rollback or failure recovery mechanisms. If a migration fails mid-stream, manual database intervention is required. |
| **LOW** | **GSP Live Filing UI Unexposed** | Rust GSP trait and routes exist, but end-users have no UI card in Settings to enter their own GSP API credentials. |

---

## 18. Existing Components We Should Reuse

Do **NOT** rebuild the following components; they are production-tested and functionally complete:
1. **Double-Entry Ledger Core:** [`backend/src/routes/accounting.rs`](../backend/src/routes/accounting.rs) and migrations `000005`, `000006`, `000010`, `000011`, `000027`, `000055`.
2. **Statutory GST Tax Engine:** [`backend/src/gst/mod.rs`](../backend/src/gst/mod.rs) (intra/inter-state logic and Rule 88A set-off sequencing).
3. **Bento Grid Gateway & Design System:** [`src/modules/gateway/GatewayLanding.tsx`](../src/modules/gateway/GatewayLanding.tsx) and the unified Light Mode Bento layout tokens.
4. **Voucher & Billing Desks:** [`src/modules/vouchers/VoucherWorkspace.tsx`](../src/modules/vouchers/VoucherWorkspace.tsx) and [`src/modules/builder/DocumentBuilderView.tsx`](../src/modules/builder/DocumentBuilderView.tsx).
5. **Bank Reconciliation Match Engine:** [`backend/src/routes/banking.rs`](../backend/src/routes/banking.rs) and [`src/modules/reconciliation/ReconciliationView.tsx`](../src/modules/reconciliation/ReconciliationView.tsx).
6. **FIFO Inventory Engine:** [`backend/src/routes/inventory.rs`](../backend/src/routes/inventory.rs) and [`src/modules/inventory/InventoryView.tsx`](../src/modules/inventory/InventoryView.tsx).
7. **Maker-Checker Approvals:** [`backend/src/routes/accounting.rs`](../backend/src/routes/accounting.rs) and [`src/modules/approvals/ApprovalsView.tsx`](../src/modules/approvals/ApprovalsView.tsx).

---

## 19. Missing Components (Required for Target Architecture)

1. **Supabase Control Plane Database Connection:** A dedicated control plane store replacing `src/lib/ecosystem/store.ts` to persist platform admins, distributors, license requests, and database connection strings.
2. **Dynamic Database Router in Rust:** An HTTP connection pool manager in `backend/src/postgrest.rs` that reads the customer's database reference and routes requests to their specific PostgreSQL instance.
3. **Automated Tenant Database Provisioning Engine:** A service/script to provision fresh customer databases, run customer-plane migrations, and register the connection string in the Control Plane upon license approval.
4. **Redis Infrastructure & Worker Pool:** Redis container, connection manager, debounced draft autosave endpoint, and a priority task scheduler (PRO prioritized over GO).
5. **Finance-HR Expense Reimbursement Desk:** An employee expense claims and approval sub-module in [`DepartmentsMembersView.tsx`](../src/modules/departments-members/DepartmentsMembersView.tsx).
6. **GSP Credential Configuration UI:** A settings card allowing taxpayers to connect their own GSP API Client ID/Secret and initiate OTP authentication.
7. **Demo Reset Engine & Industry Seeds:** Automated demo reset endpoint and seed files for Retail, E-commerce, and Project-based Services.

---

## 20. Recommended Implementation Sequence

```
  Phase 1: Persistence Fix        Phase 2: Database Partitioning      Phase 3: Redis & Workers
┌───────────────────────────┐    ┌───────────────────────────────┐    ┌───────────────────────────┐
│ Connect Ecosystem APIs to │    │ Separate Control Plane from   │    │ Add Redis container,      │
│ PostgreSQL Migration 0059 ├───►│ Customer Data Plane; build    ├───►│ debounced draft autosave, │
│ (Eliminate In-Memory RAM) │    │ dynamic DB connection router  │    │ and background job queues │
└───────────────────────────┘    └───────────────────────────────┘    └───────────────────────────┘
                                                 │
                                                 ▼
                                  Phase 4: Functional Enhancements
                                 ┌───────────────────────────────┐
                                 │ 1. GSP Credential Config Card │
                                 │ 2. Employee Reimbursement Desk│
                                 │ 3. Demo Reset & Industry Seeds│
                                 └───────────────────────────────┘
```

1. **Step 1 (Immediate - High Priority): Wire Ecosystem to PostgreSQL**
   Replace `src/lib/ecosystem/store.ts` in-memory mocks with actual SQL queries against the tables created in `20261107000059_distributor_and_license_ecosystem.sql`. This prevents data loss across restarts.
2. **Step 2: Segregate Control Plane and Data Plane Migrations**
   Split `supabase/migrations/` into `migrations/control-plane/` and `migrations/customer-data-plane/`.
3. **Step 3: Implement Dynamic Customer DB Routing in Rust**
   Update `backend/src/postgrest.rs` to dynamically route requests based on tenant credentials rather than a single static URL.
4. **Step 4: Deploy Redis & Implement Debounced Autosave**
   Introduce Redis service in `docker-compose.yml`, attach a debounced autosave handler for invoice and voucher drafts, and establish the background worker pool.
5. **Step 5: Introduce Finance-HR Reimbursements & GSP Settings Card**
   Complete the remaining business workflows: employee expense claims in `/departments-members` and GSP API connector in `/settings`.

---

## 21. Questions Requiring Architectural Decisions

1. **Control Plane Technology:** Will the Supabase Control Plane be hosted on Supabase Cloud (managed platform) or self-hosted via Docker alongside Deku?
2. **Database Provisioning Orchestration:** What infrastructure mechanism will trigger the provisioning of a customer's database upon license issuance (e.g. Kubernetes Operator, Cloud SQL Admin API, Docker socket, or a custom migration worker)?
3. **Compute Allocation for PRO vs GO:** Should PRO tenants receive isolated Docker/Cloud Run compute instances, or should compute separation be handled via resource limits (CPU/Memory cgroups) within a shared cluster?
4. **Worker Priority Strategy:** Should Redis background jobs use separate queues (`queue:pro` vs `queue:go`) with weighted worker concurrency, or a single priority queue with numeric job weights?

