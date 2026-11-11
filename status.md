# Deku Finance — System Development Status & Module Completion Matrix

> **Last Updated**: November 2026  
> **Platform Version**: `0.2.0-preview` (Next.js 16.4.2 Turbopack • Rust Axum 0.8 • PostgreSQL 16)  
> **Active Branch**: `fix/data-integrity-privacy-demo`  
> **Multi-Interface Architecture**: 3 Independent Isolated Portals (`:3000`, `:3001`, `:3002`)  
> **Docker Container Health**: 8 / 8 Containers Healthy & Running  
> **Database Migrations**: 51 / 51 Idempotent Migrations Executed (`supabase/migrations/`)  
> **Type Safety**: TypeScript (`tsc --noEmit`) passes with 0 errors  

---

## 1. Executive Architecture Snapshot

Deku Finance operates as India's desktop-first accounting operating system and financial engine. The platform is architected around three independent interfaces powered by a single PostgreSQL database and three isolated backend services:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 DEKU 3-INTERFACE TOPOLOGY                               │
├───────────────────────────────┬───────────────────────────────┬────────────────────────┤
│ Interface 1: Admin Console    │ Interface 2: Distributor      │ Interface 3: Platform  │
│ Port: http://localhost:3001   │ Port: http://localhost:3002   │ Port: http://localhost:3000│
│ Backend: http://localhost:8081│ Backend: http://localhost:8082│ Backend: http://localhost:8080│
│ Target: Internal Platform Ops │ Target: Regional Partners     │ Target: Customer ERP   │
└───────────────────────────────┴───────────────────────────────┴────────────────────────┘
                                               │
                       ┌───────────────────────┴───────────────────────┐
                       │   SHARED CORE ENGINE (PERSISTENCE & RULES)    │
                       │   • PostgreSQL 16 (Port 5433 -> 5432)         │
                       │   • PostgREST Data API (Port 3000 internal)   │
                       │   • 51 Schema Migrations (db/migrate.sh)      │
                       └───────────────────────────────────────────────┘
```

---

## 2. High-Level Module Completion Matrix

| # | Module / Capability | DB Schema & Migrations | Rust Backend Route (`backend/src/routes/`) | Frontend Screen / UI | Wireup Status | Overall Status |
|---|---|:---:|:---:|:---:|:---:|:---:|
| **1** | **Multi-Tenancy & Organisations** | ✅ Migrations `001-002, 047` | ✅ `organisations.rs` | ✅ `CompaniesView.tsx` (`/companies`) | Direct API | **100% Complete** |
| **2** | **Core Identity & Authentication** | ✅ Migrations `001, 047, 051` | ✅ `auth.rs` + SSR cookies | ✅ `(auth)/login`, `signup`, `reset` | Direct API | **100% Complete** |
| **3** | **ALERX 4-Tier Chart of Accounts** | ✅ Migrations `005, 011, 050` | ✅ `accounting.rs` | ✅ `ChartOfAccountsView.tsx` | Direct API | **100% Complete** |
| **4** | **Fiscal Accounting Periods** | ✅ Migrations `005, 050` | ✅ `accounting.rs` | ✅ `SettingsView.tsx` (`/settings`) | Direct API | **100% Complete** |
| **5** | **Parties (Customers & Vendors)** | ✅ Migration `003` | ✅ `parties.rs` | ✅ `PartiesView.tsx` (`/masters/parties`) | Direct API | **100% Complete** |
| **6** | **Catalogue & HSN/SAC Engine** | ✅ Migrations `004, 038` | ✅ `catalogue.rs`, `hsn.rs` | ✅ `ProductsServicesView.tsx` | Direct API | **100% Complete** |
| **7** | **Voucher Workspace (F4 to F9)** | ✅ Migrations `005-006, 050` | ✅ `accounting.rs` | ✅ `VoucherWorkspace.tsx` (`/vouchers`) | Direct API | **100% Complete** |
| **8** | **Day Book & Ledger Reversals** | ✅ Migrations `006, 045` | ✅ `accounting.rs` | ✅ `DayBookView.tsx` (`/day-book`) | Direct API | **100% Complete** |
| **9** | **GST Invoicing & Tax Splits** | ✅ Migrations `007, 010` | ✅ `invoices.rs`, `gst.rs` | ✅ `GstTaxHubView.tsx` (`/gst`) | Direct API | **100% Complete** |
| **10**| **Financial Reports (P&L, BS, TB)**| ✅ Migrations `006, 017, 045` | ✅ `accounting.rs` (RPCs) | ✅ `ProfitLossView.tsx`, `BalanceSheetView.tsx`, `TrialBalanceView.tsx` | Direct API | **100% Complete** |
| **11**| **Cash Flow (Working Capital Method)**| ✅ Migrations `017, 046` | ✅ `accounting.rs` (`cash_flow_wcm`) | ✅ `CashFlowView.tsx` (`/reports/cash-flow`) | Direct API | **100% Complete** |
| **12**| **Bank Statement Reconciliation** | ✅ Migration `024` | ✅ `banking.rs` | ✅ `ReconciliationWorkspace.tsx` | Direct API | **100% Complete** |
| **13**| **Maker-Checker Dual-Gate Approvals**| ✅ Migrations `016, 032` | ✅ `organisations.rs`, `accounting.rs` | ✅ `ApprovalsQueueView.tsx` (`/approvals`) | Direct API | **100% Complete** |
| **14**| **Departments, Members & Payroll** | ✅ Migration `013` | ✅ `departments.rs` | ✅ `DepartmentsMembersView.tsx` | Direct API | **100% Complete** |
| **15**| **Audit Trail & Activity Logging** | ✅ Migrations `009, 014` | ✅ `audit.rs` | ✅ `AuditTrailView.tsx` (`/audit`) | Direct API | **100% Complete** |
| **16**| **WYSIWYG Document Builder** | ✅ Database Stored Drafts | ✅ `documents_builder.rs` | ✅ `DocumentBuilderView.tsx` (`/builder`) | Direct API | **100% Complete** |
| **17**| **Document Storage Vault & Files** | ✅ Migration `048` | ✅ `files.rs`, `documents.rs` | ✅ Vault Upload, SHA-256 Checksum | Direct API | **100% Complete** |
| **18**| **Desktop Gateway & Omni-Palette** | ✅ SQL Live Rollup Views | ✅ Via Report RPCs | ✅ `GatewayLanding.tsx` (`Alt+G`, `Ctrl+K`) | Direct API | **100% Complete** |
| **19**| **Tiered Licensing (GO / PRO / Ent)**| ✅ Migrations `012, 047` | ✅ `subscriptions.rs` | ✅ `LicenseSettingsView.tsx`, Modals | Direct API | **100% Complete** |
| **20**| **Distributor Partner Portal** | ✅ Database Seed & Mappings | ✅ Interface 2 (`:8082`) | ✅ `src/app/distributor/page.tsx` (`:3002`) | Direct API | **100% Complete** |
| **21**| **Deku Admin Console** | ✅ Superadmin Schema & Watches | ✅ Interface 1 (`:8081`) | ✅ `src/app/admin/page.tsx` (`:3001`) | Direct API | **100% Complete** |
| **22**| **Landing Page & 12-Question FAQ** | ✅ N/A (Public Static + Client) | ✅ Next.js App Router | ✅ `src/app/page.tsx` (`:3000`) | Standalone | **100% Complete** |
| **23**| **Features Hub (Dedicated Deep-Dive)**| ✅ N/A (Public Static + Client) | ✅ Next.js App Router | ✅ `src/app/features/page.tsx` | Standalone | **100% Complete** |
| **24**| **GST Compliance & Exemption Hub** | ✅ N/A (Public Static + Client) | ✅ Next.js App Router | ✅ `src/app/gst-compliance/page.tsx` | Standalone | **100% Complete** |
| **25**| **Public Learn Centre & 9 Tours** | ✅ N/A (Public Static + Client) | ✅ Next.js App Router | ✅ `src/app/learn/page.tsx` (76 lessons) | Standalone | **100% Complete** |
| **26**| **GSTN Offline JSON Exporters** | ✅ Outward / Inward Tax Schema | ✅ `gst.rs` | ✅ `GstTaxHubView.tsx` (GSTR-1 & GSTR-3B) | Direct API | **100% Complete** |
| **27**| **Live GSP e-Invoicing & e-Way Bill**| ✅ `gsp_connections` (AES-256) | ⚠️ `gsp.rs` trait seam (`Sandbox`) | ⚠️ Status indicator on `/gst-compliance` | Trait Seam | **In Development (Target Architecture)** |
| **28**| **DigiLocker KYC Integration** | ✅ `kyc_requests` schema | ⚠️ `kyc.rs` trait seam (`Sandbox`) | ⚠️ KYC settings tab | Trait Seam | **In Development (Target Architecture)** |
| **29**| **Razorpay Payment Gateway API** | ✅ `payment_orders` schema | ✅ `payments.rs` (Webhooks + OAuth) | ✅ Invoice QR / Online Payment Links | Direct API | **Config-Ready** |

---

## 3. The Three Interface Architecture (Verified Live)

### Interface 1: Internal Deku Admin Console
- **Frontend Port**: `http://localhost:3001/admin` (`deku-frontend-admin`)
- **Backend Port**: `http://localhost:8081` (`deku-backend-admin`)
- **Primary Purpose**: Master platform administration, superadmin authority oversight, distributor creation, commercial invoice proof verification, and territory allocations.
- **UI Design System**: Clean light-mode bento grid with dark header chrome, status indicators, and single unified footer.
- **Server-Side Isolation**: Enforced via `DEKU_INTERFACE=admin` environment flag in `src/proxy.ts`.

### Interface 2: Distributor Partner Portal
- **Frontend Port**: `http://localhost:3002/distributor` (`deku-frontend-distributor`)
- **Backend Port**: `http://localhost:8082` (`deku-backend-distributor`)
- **Primary Purpose**: Regional franchise operations, client onboarding, commercial license requests with document proof attachments, seat rank provisions, and territory lead management.
- **UI Design System**: Clean light-mode bento grid matching the signature Deku design system with zero double footers.
- **Server-Side Isolation**: Enforced via `DEKU_INTERFACE=distributor` in `src/proxy.ts`.

### Interface 3: Deku Platform ERP Client App
- **Frontend Port**: `http://localhost:3000/gateway` (`deku-frontend-platform`)
- **Backend Port**: `http://localhost:8080` (`deku-backend-platform`)
- **Primary Purpose**: The core double-entry accounting application for business owners, accountants, CFOs, and bookkeepers.
- **Public Entry Points**:
  - Main Landing Page: `http://localhost:3000/`
  - Features Hub: `http://localhost:3000/features`
  - GST Compliance: `http://localhost:3000/gst-compliance`
  - Public Learn Centre: `http://localhost:3000/learn`

---

## 4. Public Educational & Marketing Surfaces (Recently Added)

1. **Features Hub (`/features`)**:
   - Comprehensive matrix covering Dual Modes (Section 22 CGST Exemption vs GST Registered Enterprise), ALERX 4-Tier COA, Voucher Suite (F4 Contra to F9 Purchase), Automated Bank Reconciliation, Real-Time Financial Statements, and RBAC / Maker-Checker governance.
2. **GST Compliance Hub (`/gst-compliance`)**:
   - Details Section 22 CGST Act turnover thresholds (₹20L service / ₹40L goods / ₹10L special states), interactive intra-state (CGST+SGST) vs inter-state (IGST) split calculator, GSTR-1 & GSTR-3B offline JSON schema exporters, and the GSP integration roadmap.
3. **Public Learn Centre (`/learn`)**:
   - Dual-experience hub:
     - **Option A — Interactive Tutorials**: 9 learning paths with 76 lessons loaded dynamically from `src/lib/tutorials/paths.ts`.
     - **Option B — Technical Documentation**: 6-category structured knowledge base (Understanding Deku, Accounting Mechanics, GST Compliance, Banking & Operations, Governance & Security, Deployment/DevOps).
     - Incorporates the **5-Dimension Learning Framework** (Concept, Importance, Use Cases, Operation, Consequences).
     - Operates in a safe public sandbox context with zero account creation or login required.
4. **Expanded FAQ (Landing Page `/`)**:
   - Expanded from 5 to 12 questions covering multi-tenancy, data privacy, GSP API integration, Maker-Checker authorization, Document Builder, bank reconciliation, data export portability, and the public learn sandbox.

---

## 5. Core Accounting Invariants & Business Logic

Deku Finance strictly enforces these transactional rules across all entries:

1. **Mathematical Conservation ($\sum D = \sum C$)**:
   - Database trigger `trg_verify_journal_entry_lines_parity` blocks any journal entry where total debits do not equal total credits.
2. **Statutory Immutability**:
   - Database trigger `trg_guard_posted_journal_entry` makes posted vouchers immutable. Posted errors must be corrected with an equal-and-opposite reversal voucher via `reverse_journal_entry()`.
3. **ALERX 4-Tier Hierarchy**:
   - Accounts are divided into: `Account Group ➔ Ledger ➔ Sub-Ledger ➔ Postable Leaf`.
   - Vouchers can only post to leaf accounts. Group headers automatically rollup balances in real-time.
4. **Zero Single Point of Failure (SPOF) Document Attachments**:
   - Vouchers require proof document attachments (bills, receipts, invoices), stored with SHA-256 hashes in PostgreSQL to prevent duplicate processing.
5. **Maker-Checker Dual-Gate Authorization**:
   - Subordinate bookkeepers create draft vouchers. Only authorized Approvers (Owner, CFO, Admin) commit them to the General Ledger.

---

## 6. Live Integrations Status & Reality Disclosure

To maintain absolute technical transparency:

- **Bharat UPI QR Code**: **100% Live & Functional**. Dynamically generated on all sales invoices using the business's verified VPA for instant payment collection via Google Pay, PhonePe, and Paytm.
- **Offline GST Returns**: **100% Live & Functional**. Generates valid GSTR-1 and GSTR-3B offline JSON files ready for manual upload to `gst.gov.in`.
- **Live GSP e-Invoicing (IRN) & Live e-Way Bill**: **Trait Seam Built (Not Live Network Connection)**.
  - Rust trait `GspProvider` in `backend/src/integrations/gsp.rs` defines the interface.
  - Default mode is `NotConfigured` (`GSP_PROVIDER=""` in Docker).
  - A local `Sandbox` mock exists for offline UI development (returns `SANDBOX-` prefixed simulated strings).
  - Connecting live network calls to an official GSP (e.g. NIC e-Way, Cygnet, Masters India, Clear, IRIS) is planned for the next development phase once credentials are configured.
- **Razorpay Integration**: **Scaffolded & Config-Ready**. Supports Razorpay OAuth, payment link generation, and HMAC webhook verification.
- **DigiLocker KYC**: **Scaffolded**. Trait seam exists for company identity verification.

---

## 7. Active Container Infrastructure Status

```text
NAMES                       STATUS                    PORTS
deku-frontend-platform      Up (healthy)              127.0.0.1:3000->3000/tcp
deku-frontend-admin         Up (healthy)              127.0.0.1:3001->3000/tcp
deku-frontend-distributor   Up (healthy)              127.0.0.1:3002->3000/tcp
deku-backend-platform       Up (healthy)              127.0.0.1:8080->8080/tcp
deku-backend-admin          Up (healthy)              127.0.0.1:8081->8080/tcp
deku-backend-distributor    Up (healthy)              127.0.0.1:8082->8080/tcp
deku-postgres               Up (healthy)              127.0.0.1:5433->5432/tcp
deku-postgrest              Up                        3000/tcp
```

All 8 containers build cleanly via `docker compose up -d --build` with zero exit errors and pass their respective health checks.
