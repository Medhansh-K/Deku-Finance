# Deku Finance — Desktop-First Web Accounting System

Deku Finance is an enterprise-grade accounting and financial management platform inspired by **TallyPrime's speed, keyboard navigation, and workflow familiarity**, reimagined with modern visual styling, accessible controls, and strict double-entry mathematical correctness.

---

## 🏛️ Architecture Overview

```
┌────────────────────────────────────────────────────────┐
│                   Web Desktop Client                   │
│ Next.js 16 (App Router) • React 19 • Tailwind CSS v4   │
│ Gateway Menu (Hotkeys) • Vouchers • Financial Reports  │
└───────────────────────────┬────────────────────────────┘
                            │ REST JSON API
┌───────────────────────────▼────────────────────────────┐
│                  Authoritative Backend                 │
│               Rust • Axum (Port 8080)                  │
│  Multi-tenant Auth • Double-Entry Validation • Audit   │
└───────────────────────────┬────────────────────────────┘
                            │ SQL & Triggers
┌───────────────────────────▼────────────────────────────┐
│                    Supabase PostgreSQL                 │
│   ALERX 4-Tier Hierarchy • Ledger Balances View        │
│    Atomic Journal Posting • Immutability & Reversals   │
└────────────────────────────────────────────────────────┘
```

---

## ⚡ Keyboard Navigation & Shortcuts

Deku Finance is built for keyboard-first operation. All accounting vouchers, reports, and navigation paths can be executed without touching a mouse.

### Function Keys (Vouchers & Navigation)

| Shortcut | Action | Description / Route |
| :--- | :--- | :--- |
| **`F1`** | **Help** | Opens the global keyboard cheatsheet modal |
| **`F2`** | **Date** | Change current transaction date or fiscal period |
| **`F3`** | **Company** | Switch active organisation / multi-tenant entity (`/companies`) |
| **`F4`** | **Contra** | Bank-to-cash and bank-to-bank transfers (`/vouchers/contra`) |
| **`F5`** | **Payment** | Vendor payments, operating expenses, cash outflows (`/vouchers/payment`) |
| **`F6`** | **Receipt** | Customer collections, capital inflows (`/vouchers/receipt`) |
| **`F7`** | **Journal** | Adjustments, depreciation, accruals, reclassifications (`/vouchers/journal`) |
| **`F8`** | **Sales** | Outward sales billing & GST tax invoices (`/vouchers/sales`) |
| **`F9`** | **Purchase** | Inward purchase bills & inventory intake (`/vouchers/purchase`) |
| **`Alt + G`** / **`Ctrl + K`** | **Go To** | Global command palette searching across accounts, vouchers, and reports |
| **`Esc`** | **Back / Gateway** | Close open modals/drawers or return to Gateway (`/gateway`) |

### Gateway Quick Jump Hotkeys

On the **Gateway of Deku** (`/gateway`), pressing highlighted keys instantly navigates to the corresponding module:

- **`A`** ➔ **Chart of Accounts** (`/masters/chart-of-accounts`)
- **`L`** ➔ **Parties Master** (`/masters/parties`)
- **`P`** ➔ **Products & Services** (`/masters/products-services`)
- **`V`** ➔ **Vouchers Workspace** (`/vouchers/payment`)
- **`D`** ➔ **Day Book** (`/day-book`)
- **`G`** ➔ **GST & Invoicing** (`/gst`)
- **`T`** ➔ **Trial Balance** (`/reports/trial-balance`)
- **`B`** ➔ **Balance Sheet** (`/reports/balance-sheet`)
- **`N`** ➔ **Profit & Loss** (`/reports/profit-loss`)
- **`U`** ➔ **Audit Trail** (`/audit`)
- **`S`** ➔ **Settings & Fiscal Periods** (`/settings`)
- **`C`** ➔ **Company Selection** (`/companies`)

---

## 📋 Complete Route Inventory

### 1. Gateway & Masters
- `/gateway`: Dual-pane Gateway dashboard with live company metadata, last entry date, and quick jump menu.
- `/masters/chart-of-accounts`: 4-tier ALERX tree browser (Asset, Liability, Equity, Revenue, Expense) with natural balances, postable leaf badges, and account creation drawer.
- `/masters/parties`: Customer and Vendor master with GSTIN, PAN, and billing address.
- `/masters/products-services`: Goods and services catalogue with HSN/SAC codes and default GST slabs.

### 2. Transactions & Vouchers
- `/vouchers/payment`: F5 Payment voucher with auto-calculated total debits and credits.
- `/vouchers/receipt`: F6 Receipt voucher for incoming client payments.
- `/vouchers/contra`: F4 Contra voucher for internal bank transfers and cash deposits.
- `/vouchers/journal`: F7 Multi-line general journal voucher with double-entry balance validation.
- `/vouchers/sales`: F8 Sales voucher integrated with customer accounts and GST ledger lines.
- `/vouchers/purchase`: F9 Purchase voucher for vendor bills.
- `/day-book`: Chronological transaction ledger with real-time status filtering (draft/posted/reversed), voucher drill-down modal, and atomic reversal dialog.

### 3. Financial Statements
- `/reports/trial-balance`: Real-time debit and credit balances by account with total balance equilibrium indicator.
- `/reports/profit-loss`: Revenue minus Expenses computation displaying Gross and Net Profit/Loss.
- `/reports/balance-sheet`: Accounting equation parity verification: Assets = Liabilities + Equity.

### 4. Compliance & System
- `/gst`: GST Tax Hub with sales invoices, intra-state vs inter-state tax split, invoice generation, and issuance with automatic atomic journal posting.
- `/companies`: Multi-tenant company switcher and creation.
- `/audit`: Immutable audit trail tracking all postings, reversals, and user operations.
- `/settings`: Fiscal period management (annual, quarterly, monthly) and period status controls.

---

## ✨ Professional Controls

- **Maker-checker approvals** (`/approvals`): turn on in Settings → Company controls. Vouchers are submitted, then approved and posted by a different owner/CFO/admin, or sent back with a reason. Enforced in the database (migration 20), not just the UI.
- **GST returns from the books** (`/dashboard/returns`): GSTR-1 (B2B, B2CS, exempt, HSN summary, document count) and GSTR-3B (3.1, 3.2, Table 4 ITC) built from issued invoices and the purchase register (Input GST ledgers only when a month has no bills). Any validation failure blocks the download and is listed on screen.
- **Purchase & ITC register** (`/purchases`): supplier bills with bill number, GSTIN and ITC eligibility (eligible, blocked under 17(5), other ineligible, with a reason). Add one at a time (optionally creating the purchase voucher, which goes through approvals when maker-checker is on) or import a CSV checked row by row in the browser. Eligible ITC feeds 3B Table 4(A)(5), blocked ITC 4(D). Migration 24.
- **Bank reconciliation** (`/banking/reconciliation`): import a CSV statement (HDFC, ICICI, SBI, Axis, Kotak layouts), parsed in the browser; lines are auto-matched to bank-account journal lines by amount, date window, UTR/cheque reference and party name. Matches are only saved when you confirm; unmatched lines open a pre-filled receipt or payment voucher.
- **Invoice reading on-device**: PDF text layer or local OCR; GSTIN check digits verified; unread fields left blank and flagged.

## 🧮 Double-Entry Accounting Principles

1. **Equilibrium Rule**: A journal entry must have at least 2 lines and total debits must exactly equal total credits ($\sum \text{Debits} = \sum \text{Credits}$).
2. **ALERX Natural Balances**:
   - **Assets & Expenses**: Debit increases, Credit decreases (Natural balance = $\text{Debits} - \text{Credits}$).
   - **Liabilities, Equity & Revenue**: Credit increases, Debit decreases (Natural balance = $\text{Credits} - \text{Debits}$).
3. **Immutability & Controlled Reversal**: Posted accounting vouchers cannot be modified or deleted. Errors are corrected via controlled reversals that create an offsetting journal entry and mark the original as reversed.
4. **GST Tax Engine**:
   - **Intra-State Supply**: Tax split 50/50 between Central GST (CGST) and State GST (SGST).
   - **Inter-State Supply**: 100% attributed to Integrated GST (IGST).

---

## 🚀 Development Setup

### Prerequisites
- Node.js 22+
- Rust & Cargo (1.75+)
- PostgreSQL / Supabase

### 0. Database
```bash
supabase db push     # apply migrations to your project
supabase db reset    # local only: migrations + demo sandbox from supabase/seed.sql
```
For a hosted project, run `supabase/seed.sql` once in the SQL editor to create the demo sandbox.

### 1. Start the Rust Backend
```bash
cd backend
cargo run
# Authoritative server starts on http://127.0.0.1:8080
```

### 2. Start the Frontend
```bash
# In repository root
npm install
npm run dev
# Web application starts on http://localhost:3000
```

### 3. Run Production Build
```bash
npm run build
# Compiles all 31 App Router pages with Next.js Turbopack
```

### 4. Run Automated Tests
```bash
bash supabase/tests/run_local.sh   # all migrations + seed + SQL tests on Postgres in Docker
npm test
# Executes Vitest suite testing formatters, accounting math, and UI components
```

---

## 🔒 Security & Data Integrity
- All financial balances are queried directly from authoritative PostgreSQL views and Axum endpoints (`/reports/...`, `/accounts`, `/journals`).
- Frontend performs client-side double-entry pre-validation to prevent network roundtrips for unbalanced entries while the backend enforces database transactions atomically.
- Every API call runs as the signed-in user, so Supabase row-level security decides what each person sees. The backend has no service-role fallback and rejects requests without a login.
- Database functions cannot be called with the public anon key (migration 18).
- **No financial data leaves your infrastructure.** Invoices are read in the browser (PDF text layer, or on-device OCR for scans); the Deku Consultant answers from your own ledger on your own server. Nothing is sent to a third-party AI service.
- Extracted values are never guessed: anything that cannot be read is left blank and flagged for the user.
- **Demo sandbox:** "Try demo" signs in to real sandbox accounts (`demo-owner@`, `demo-accountant@`, `demo-freelancer@deku.finance`, password `DekuDemo#2026`) that belong only to fictional companies.
- Creditors, Debtors, Operating Expenses, the Executive dashboard and Gateway KPIs are computed from posted journal entries; anything the books can't support (vendor credit terms, departments, budgets) shows "–" instead of a figure.
