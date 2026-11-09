# DEKU FINANCE — PUBLIC LEARN CENTRE ARCHITECTURE

**Document Identifier:** `DEKU_LEARN_CENTRE_ARCHITECTURE.md`  
**Execution Phase:** Phase 1 Architectural Design  
**Target:** Anonymous Public Learning, Interactive Hands-on Guided Tours, and Technical Documentation  

---

## 1. Architectural Principles

1. **Zero Barrier Public Access:** Anyone must be able to explore the Learn Centre, launch tutorials, and read documentation without creating an account, entering an email, logging in, or activating a license.
2. **Reusability of Core Engine:** The Learn Centre must not duplicate business logic or fake UI screens. It extends the existing 9 paths in [`src/lib/tutorials/paths.ts`](../src/lib/tutorials/paths.ts) and the battle-tested floating [`TutorialCoach`](../src/components/tutorial/TutorialCoach.tsx).
3. **Strict Sandbox Boundary:** Anonymous tutorial operations run in an isolated sandbox context that cannot read, mutate, or pollute actual customer databases, internal Admin portals, or distributor records.
4. **Independent Dual Experience:**
   * **Option A (Interactive Hands-On Tutorials):** Interactive, guided walkthroughs highlighting live UI elements, stepping through actual workflows (vouchers, invoices, GST calculations).
   * **Option B (Technical & Implementation Documentation):** Structured reference documentation organized by domain (Understanding Deku, Application Usage, Technical Architecture, Utilities, and Implementation).

---

## 2. Route Hierarchy & Navigation Architecture

```
                                  PUBLIC LANDING PAGE (/)
                                             │
                       ┌─────────────────────┴─────────────────────┐
                       ▼                                           ▼
                 [Features / Pricing]                        [Learn (/learn)]
                                                                   │
                                 ┌─────────────────────────────────┴─────────────────────────────────┐
                                 ▼                                                                   ▼
                OPTION A: INTERACTIVE TUTORIALS                               OPTION B: TECHNICAL DOCUMENTATION
                      (/learn/tutorials)                                               (/learn/docs)
                                 │                                                                   │
           ┌─────────────────────┼─────────────────────┐                       ┌─────────────────────┼─────────────────────┐
           ▼                     ▼                     ▼                       ▼                     ▼                     ▼
    [Catalog & Search]   [Scenario Select]     [Live Walkthrough]      [Understanding Deku]   [Technical Arch]     [Module Guides]
                                             (/learn/tutorials/[id])    (/learn/docs/arch)    (/learn/docs/core)   (/learn/docs/usage)
```

### 2.1 Complete Route Mapping

| Route | Role | Auth Required? | Layout Shell Used |
| :--- | :--- | :---: | :--- |
| **`/learn`** | Learn Centre Hub (Bento cards for Tutorials vs. Documentation, featured paths, quick launch) | **NO** | `PublicLearnLayout` |
| **`/learn/tutorials`** | Tutorial Catalog (Filtered by category, audience, difficulty, estimated time) | **NO** | `PublicLearnLayout` |
| **`/learn/tutorials/[id]`** | Live Guided Interactive Tour Runner (Mounts live Deku workspace with `PublicTutorialCoach`) | **NO** | `PublicSandboxShell` |
| **`/learn/docs`** | Documentation Root (5 structured categories, search bar, implementation guides) | **NO** | `PublicDocsLayout` |
| **`/learn/docs/[category]/[slug]`** | Deep Technical Reference Document (Markdown rendered with code blocks and diagrams) | **NO** | `PublicDocsLayout` |

---

## 3. Decoupled Anonymous Session & Progress Architecture

### 3.1 Anonymous Progress Storage
In the authenticated app, progress was saved per `userId`:
```typescript
localStorage.setItem(`deku_tutorial_progress_${userId}`, JSON.stringify(progress));
```
For the Public Learn Centre, we introduce an **Anonymous Client Session Manager** ([`src/lib/tutorials/anonymous-session.ts`](../src/lib/tutorials/anonymous-session.ts)):
* If no user is logged in, an anonymous device token is generated (`anon_` + UUIDv4) and stored in `localStorage`.
* Tutorial progress, completed step IDs, active path, and scenario choices are stored in browser storage under `deku_anon_tutorial_progress`.
* Zero server registration or user authentication is required.

### 3.2 Ephemeral Sandbox State Model
When an anonymous visitor runs a tutorial that modifies data (e.g. creating a sales invoice or posting a draft voucher):
1. **Client-Side Virtual Store:** Small mutating transactions (customer creation, invoice line items) are captured within the anonymous sandbox state in `sessionStorage`.
2. **1-Click Reset Control:** A floating badge or button in the sandbox header allows the user to click **"Reset Sandbox"** at any second, which immediately clears local storage overrides and re-initializes the clean baseline seed.

---

## 4. Documentation Catalog Taxonomy

The documentation catalog ([`/learn/docs`](../src/app/learn/docs)) is structured into 5 foundational categories:

```
Category A: Understanding Deku
├── 01-what-is-deku-finance.md
├── 02-product-philosophy-double-entry-strict.md
├── 03-the-gateway-mission-control.md
└── 04-how-modules-interact.md

Category B: Application Usage & Workflows
├── 01-company-and-fiscal-year-setup.md
├── 02-chart-of-accounts-alerx-model.md
├── 03-parties-customers-and-vendors.md
├── 04-sales-invoicing-and-upi-qr.md
├── 05-purchase-bills-and-itc-classification.md
├── 06-voucher-posting-desk-f4-to-f9.md
├── 07-inventory-and-multi-warehouse-fifo.md
├── 08-bank-statement-reconciliation.md
├── 09-statutory-gst-gstr1-and-gstr3b.md
├── 10-financial-statements-balance-sheet-and-pl.md
├── 11-deku-consultant-ai-cfo-metrics.md
└── 12-payroll-and-compensation-privacy.md

Category C: Technical Architecture
├── 01-core-kernel-shell-architecture.md
├── 02-application-runtime-and-module-manifests.md
├── 03-rust-axum-backend-engine.md
├── 04-single-postgres-core-and-rls-tenancy.md
├── 05-gapless-voucher-number-sequences.md
└── 06-cryptographic-secrets-and-aes-gcm.md

Category D: Utilities & Productivity
├── 01-keyboard-first-navigation-f-keys.md
├── 02-command-palette-ctrl-k.md
├── 03-document-builder-quotes-pos-challans.md
├── 04-bulk-import-tally-xml-and-csv.md
└── 05-offline-gstn-json-preparation.md

Category E: Implementation & Deployment Guidance
├── 01-single-customer-runtime-deployment.md
├── 02-docker-compose-local-stack.md
├── 03-google-cloud-run-cloudsql-deployment.md
├── 04-razorpay-payment-gateway-setup.md
├── 05-gsp-gst-suvidha-provider-integration.md
└── 06-database-backup-and-disaster-recovery.md
```

Every document adheres to the strict rule: **Clearly distinguish Verified & Implemented vs. Partially Implemented vs. Planned/Conceptual.**

---

## 5. Reverse Proxy & Route Guard Updates

In [`src/lib/auth/session.ts`](../src/lib/auth/session.ts):
```typescript
const PUBLIC_PATHS = [
  "/login", "/signup", "/join", "/reset-password", "/request-setup", 
  "/api/auth", "/distributor", "/admin",
  "/learn", "/api/learn" // Public Learn routes
];
```
This ensures that any anonymous visitor hitting `/learn`, `/learn/tutorials`, `/learn/docs`, or their sub-routes will **never be redirected to `/login`**.

