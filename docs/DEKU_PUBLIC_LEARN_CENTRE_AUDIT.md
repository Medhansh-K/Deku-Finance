# DEKU FINANCE — PUBLIC LEARN CENTRE AUDIT

**Document Identifier:** `DEKU_PUBLIC_LEARN_CENTRE_AUDIT.md`  
**Audit Execution Date:** 2026-11-08  
**Audit Scope:** Phase 0 Baseline Audit of Landing Page, Learning Centre, Tutorial Engine, Demo Environment, and Public API Boundaries.  
**Auditor:** Antigravity (Advanced Agentic Architecture Team)  

---

## 1. Landing Page Routes & Navigation Audit

### 1.1 Existing Landing Page Implementation
* **File Path:** [`src/app/page.tsx`](file:///c:/Users/Medhansh%20Pc/Desktop/Deku%20Finance/src/app/page.tsx)
* **Structure:**
  * Top Navigation: [`src/components/landing/LandingNavbar.tsx`](file:///c:/Users/Medhansh%20Pc/Desktop/Deku%20Finance/src/components/landing/LandingNavbar.tsx)
  * Hero Section with Dual-Mode toggle preview
  * Interactive Mode Preview: `src/components/landing/InteractiveModePreview.tsx`
  * ALERX Ledger Pillar Explanation: `src/components/landing/AlerxLedgerSection.tsx`
  * GST Returns Offline Preparation Section
  * Pricing Plans Matrix: `src/components/landing/PricingPlansSection.tsx`
  * FAQ Accordion (Section 22 exemption, UPI QR, ALERX)
  * Footer: `src/components/landing/LandingFooter.tsx`

### 1.2 Current Navbar Links
In [`src/components/landing/LandingNavbar.tsx`](file:///c:/Users/Medhansh%20Pc/Desktop/Deku%20Finance/src/components/landing/LandingNavbar.tsx) lines 34–57:
* `#modes` (Dual Modes)
* `#features` (Features)
* `#alerx` (ALERX Ledger)
* `#gstn` (GST Returns)
* `#pricing` (Plans & Pricing)
* `#faq` (FAQ)
* Action Buttons: `Sign In` (`/login`) and `Start Free Setup` (`/request-setup`), or `Gateway of Deku` (`/gateway`) if signed in.

**Gap Identified:** There is currently **no `Learn` entry point** in the public landing page navigation. Prospective users have no discovery path into tutorials or documentation without attempting to log in.

---

## 2. Existing Learning Centre Audit

### 2.1 Route and Shell Wrapping
* **File Path:** [`src/app/help/page.tsx`](file:///c:/Users/Medhansh%20Pc/Desktop/Deku%20Finance/src/app/help/page.tsx)
* **Implementation:**
  ```tsx
  export default function HelpPage() {
    return (
      <AppShell>
        <WorkspaceLayout title="Help & Tutorials" ...>
          <HelpCentreView />
        </WorkspaceLayout>
      </AppShell>
    );
  }
  ```
* **Critical Finding:** `HelpPage` is mounted inside `<AppShell>`, which enforces authentication. If an unauthenticated user navigates to `/help`, `updateSession()` in [`src/lib/auth/session.ts`](file:///c:/Users/Medhansh%20Pc/Desktop/Deku%20Finance/src/lib/auth/session.ts) intercepts the request and issues a 307 redirect to `/login?next=%2Fhelp`.

### 2.2 Learning Centre Component (`HelpCentreView`)
* **File Path:** [`src/modules/help/HelpCentreView.tsx`](file:///c:/Users/Medhansh%20Pc/Desktop/Deku%20Finance/src/modules/help/HelpCentreView.tsx)
* **Capabilities:**
  * Real-time search across titles, summaries, and step bodies.
  * Role-based filtering (`everyone`, `admin`, `implementer`).
  * Step progress tracking (completed vs. in-progress badges).
  * Direct action buttons to Start, Continue, or Restart a tutorial path.
* **Limitation:** Tightly bound to `useAuth()` (`const userId = user?.id; if (!userId) return;`). Progress is saved per authenticated `userId`. Anonymous visitors cannot save progress or view role-agnostic paths without encountering null user errors.

---

## 3. Existing Learning Paths & Lessons Catalog

The codebase contains an exhaustive, high-quality repository of **9 structured learning paths** spanning **76 step-by-step lessons** in [`src/lib/tutorials/paths.ts`](file:///c:/Users/Medhansh%20Pc/Desktop/Deku%20Finance/src/lib/tutorials/paths.ts):

| Path ID | Path Title | Target Audience | Steps Count | Key Workflows & Routes Covered |
| :--- | :--- | :---: | :---: | :--- |
| **`first-setup`** | First-time setup | Everyone | 10 | Gateway (`/gateway`), Profile (`/settings`), Fiscal Period, CoA (`/masters/chart-of-accounts`), Parties (`/masters/parties`), Users (`/departments-members`). |
| **`accounting-fundamentals`** | Accounting fundamentals | Everyone | 11 | Chart of Accounts, Debit/Credit rules, Double-entry, Draft vouchers, Balance checking, Proof attachments, Posting, Maker-Checker (`/approvals`), Day Book (`/day-book`), Trial Balance (`/reports/trial-balance`). |
| **`sales-invoicing`** | Sales and invoicing | Everyone | 8 | Customer creation, Product/service catalog, Invoice builder (`/builder`), Place-of-Supply GST math, Rounding, Issue & Print, Payment recording (`/collect`), Trade Debtors (`/reports/debtors`). |
| **`purchases-expenses`** | Purchases and expenses | Everyone | 6 | Supplier creation, Purchase bill recording (`/purchases`), Purchase voucher lines, ITC eligibility classification, Trade Creditors (`/reports/creditors`), Day Book verification. |
| **`banking-reconciliation`** | Banking and reconciliation | Everyone | 6 | Bank ledgers, Statement CSV upload (`/banking`), Algorithmic match engine, Unmatched resolution, Monthly signed statements (`/reconciliation`). |
| **`reports-financial-control`** | Reports and financial control | Everyone | 8 | Day Book chronological audit, General Ledger running balances (`/reports/general-ledger`), Trial Balance, P&L (`/reports/profit-loss`), Balance Sheet (`/reports/balance-sheet`), Cash Flow WCM, Custom Date Range filters (`000054`). |
| **`documents-operations`** | Documents and operations | Everyone | 7 | File attachments (`000048`), Document Builder (Quotes, POs, Delivery Challans), Immutable audit trail (`/audit`), Notification triggers. |
| **`admin-management`** | Administrator & system management | Admin | 10 | User invites, 7-role RBAC matrix (`000016`), Operating mode preferences, Master CoA lock, Sandbox vs. live toggles, Security audit logs, Health probes. |
| **`developer-guide`** | Developer & implementation guide | Implementer | 10 | Local setup, `.env` parameters, Docker stack (`docker-compose.yml`), PostgREST tunnel, Migration runner (`db/migrate.sh`), Troubleshooting. |

**Verdict:** This content is production-grade, highly specific to Deku Finance, and must be **100% preserved and reused** in the public Learn Centre.

---

## 4. Existing TutorialCoach Capabilities

* **File Path:** [`src/components/tutorial/TutorialCoach.tsx`](file:///c:/Users/Medhansh%20Pc/Desktop/Deku%20Finance/src/components/tutorial/TutorialCoach.tsx)
* **Architecture:**
  * Floating persistent UI card: Fixed at `bottom-14 left-4 right-4 sm:w-96`, rendered in [`src/layouts/AppShell.tsx`](file:///c:/Users/Medhansh%20Pc/Desktop/Deku%20Finance/src/layouts/AppShell.tsx).
  * Automated Navigation: Reads `step.route` and automatically navigates via `router.push(step.route)`.
  * Target Highlighting: Scans DOM for `[data-tour="${step.target}"]`, applies the CSS class `.tour-highlight`, and scrolls the target element into view (`scrollIntoView({ block: "center" })`).
* **Critical Blocking Condition:**
  Line 82: `if (!user || !loaded) return null;`  
  Because it requires an authenticated `user` object from `useAuth()`, anonymous visitors cannot see or run the coach.

---

## 5. Existing Tutorial Modal Capabilities

* **File Path:** [`src/components/tutorial/InteractivePlanTutorialModal.tsx`](file:///c:/Users/Medhansh%20Pc/Desktop/Deku%20Finance/src/components/tutorial/InteractivePlanTutorialModal.tsx)
* **Capabilities:**
  * **Plan Comparison Tab:** Full feature comparison matrix comparing GO Freelancer (₹24,999/yr), PRO Business (₹49,999/yr), and Enterprise (₹1,19,999/yr).
  * **Interactive Tax Simulator Tab:** Live dynamic calculator demonstrating CGST/SGST vs IGST Place-of-Supply tax math and Pure Accounting mode.
  * **Workflow Simulator Tab:** Visual step-by-step interactive workflow walkthrough showing how Quotes convert to Invoices and post to Ledgers.
  * **1-Click Demo Launcher Tab:** Calls `onLaunchDemo("owner" | "freelancer")` which calls `POST /api/auth/demo`.

---

## 6. Existing Demo Authentication & Data Dependencies

### 6.1 Demo Authentication Route
* **File Path:** [`src/app/api/auth/demo/route.ts`](file:///c:/Users/Medhansh%20Pc/Desktop/Deku%20Finance/src/app/api/auth/demo/route.ts)
* **Mechanics:** When `DEKU_SEED_DEMO=true`, it authenticates against hardcoded seed accounts:
  * `demo-owner@deku.finance` (Demo Owner, password `DekuDemo#2026`)
  * `demo-freelancer@deku.finance` (Demo Freelancer, password `DekuDemo#2026`)
  * `demo-accountant@deku.finance` (Demo Accountant, password `DekuDemo#2026`)

### 6.2 Seeded Database Entities ([`supabase/seed.sql`](file:///c:/Users/Medhansh%20Pc/Desktop/Deku%20Finance/supabase/seed.sql))
* `Demo Traders Pvt Ltd` (`d0000000-0000-4000-8000-000000000001`): GST Registered Trading Enterprise (PRO tier).
* `Demo Creative Studio` (`d0000000-0000-4000-8000-000000000002`): Pure Accounting Freelancer/Service Studio (GO tier).

### 6.3 Critical Demo Risks
1. **Shared State Pollution:** All demo visitors share the **exact same company ID** in PostgreSQL. If Visitor A posts a voucher or modifies a ledger in Demo Traders, Visitor B immediately sees that transaction.
2. **Missing Reset API:** There is no endpoint or UI control to reset demo data back to clean seed state without running a full database container wipe.
3. **Permanent Retention:** Demo transactions remain permanently in the database alongside real business records.

---

## 7. Public vs. Authenticated API Boundaries

In [`src/lib/auth/session.ts`](file:///c:/Users/Medhansh%20Pc/Desktop/Deku%20Finance/src/lib/auth/session.ts):
```typescript
const PUBLIC_PATHS = [
  "/login", "/signup", "/join", "/reset-password", "/request-setup", 
  "/api/auth", "/distributor", "/admin"
];
```
* **Current Boundary:** Any route starting with `/learn`, `/tutorials`, or `/docs` is currently treated as **private**. Unauthenticated visitors are redirected to `/login`.
* **Required Change:** `/learn` and its sub-paths (`/learn/tutorials`, `/learn/docs`, `/api/learn`) must be registered as **public paths**.

---

## 8. Summary of Gaps & Technical Action Items

| Category | Existing Codebase State | Required State for Public Learn Centre |
| :--- | :--- | :--- |
| **Landing Navigation** | No link to Learn | Add prominent `Learn` navigation item in `LandingNavbar.tsx` |
| **Public Routing** | `/learn` redirects to `/login` | Add `/learn` and `/learn/**` to `PUBLIC_PATHS` in `session.ts` |
| **Learning Hub** | Private `/help` behind `AppShell` | Create public `/learn` portal with Tutorials and Docs sections |
| **Tutorial Content** | 9 paths / 76 lessons in `paths.ts` | Reuse 100% of existing paths and lessons |
| **Tutorial Coach** | Requires authenticated `user.id` | Refactor coach to support anonymous browser session progress |
| **Documentation** | Scattered across modal & in-app tips | Create public categorized documentation catalog (`/learn/docs`) |
| **Demo Isolation** | Shared single Postgres company | Implement isolated anonymous sandbox session context with 1-click reset |

