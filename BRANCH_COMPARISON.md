# Branch Comparison: `main` vs `fix/data-integrity-privacy-demo`

| Property | `main` | `fix/data-integrity-privacy-demo` |
| :--- | :--- | :--- |
| **Branch Author** | — | Parth Parmar (`parthparmar4105@gmail.com`) |
| **Commits Ahead** | Baseline | 16 commits |
| **Net Changes** | — | 146 files changed (+12,629 / -8,088 lines) |
| **Test Suite** | Basic tests | 15 test suites, 122 tests (100% passing) |
| **Core Themes** | Prototype with mock data & external AI stub | Real ledger accounting, data privacy, maker-checker, tax compliance |

---

## 1. Executive Summary of What Changed

The `fix/data-integrity-privacy-demo` branch represents a foundational shift from a prototype application with simulated metrics to an enterprise-grade, privacy-first accounting and GST platform. 

Key pillars of this update:
1. **Elimination of Fabricated Data & Mock Screens**: All hardcoded sample figures across executive dashboards, creditors/debtors ageing, day book, and reports have been replaced with real ledger aggregations.
2. **Strict Data Privacy (Zero Third-Party AI Data Leakage)**: Removed external AI services (`sarvam-client.ts`) and fake staging endpoints. Document extraction (PDF text and OCR) now executes entirely on-device in the browser using `pdfjs-dist` and `tesseract.js`.
3. **Multi-Tenant Security & Privilege Lockdown**: Closed cross-tenant access holes in database functions, enforced user JWT authentication without service-role fallbacks, pinned function `search_path`s, and revoked public execute permissions.
4. **End-to-End Indian Tax & Accounting Compliance**: Real GSTR-1 and GSTR-3B JSON exports, purchase bill register with ITC eligibility rules (CBIC Notification 14/2022), professional sales invoice editor with QR payment generation and paise-accurate round-off journals.
5. **Maker-Checker Voucher Approval Workflow**: Configurable per-organization dual-control approval system for journal vouchers.
6. **Bank Reconciliation & MSME Collect**: Automated in-browser statement parsing (HDFC, ICICI, SBI, Axis, Kotak) with fuzzy transaction matching, and an MSME receivables settlement module with WhatsApp reminder links.
7. **Design System & UI Modernization**: Unified semantic design tokens (`ink`, `canvas`, `line`, `teal`), replaced the fragmented top-bar/sidebar with a cohesive `AppSidebar`, and polished core UI primitives.

---

## 2. Newly Created Migrations (Supabase / Postgres)

Eight new SQL migrations were added under `supabase/migrations/`:

| Migration File | Name / Purpose | Key Changes |
| :--- | :--- | :--- |
| `20261028000018_lock_down_function_access.sql` | Lock Down Function Access | • Revoked `EXECUTE` privileges on security-definer functions from `anon` and `PUBLIC`.<br>• Superadmin role check strictly verifies user ID instead of spoofable email claims. |
| `20261028000019_bank_reconciliation.sql` | Bank Reconciliation Schema | • Created `bank_reconciliations` table linking external bank transaction lines to posted journal lines.<br>• Added tenant RLS and status tracking (`matched`, `unmatched`). |
| `20261028000020_journal_approvals.sql` | Maker-Checker Approval System | • Added `require_journal_approval` setting on organizations.<br>• Added `approval_status`, `submitted_by`, `approved_by`, `rejected_reason` to journals.<br>• Created `submit_journal_for_approval` and `review_journal_approval` RPCs.<br>• Restored draft-only, fiscal period, and positive balance checks in `post_journal_entry`.<br>• Added GSTIN checksum and regex format validation. |
| `20261028000021_reports_include_reversed_entries.sql` | Reversed Entries & Report Security | • Fixed ledger aggregation logic so reversed entries and their original counterparts cancel out properly without vanishing.<br>• Enforced tenant membership checks on financial reporting RPCs. |
| `20261028000022_guard_payroll_and_licenses.sql` | Guard Payroll & License Issuance | • Restriced `run_monthly_payroll` to Owner, Admin, and CFO roles.<br>• Restricted self-serve license generation to one 14-day trial per company; paid tiers restricted to superadmin.<br>• Pinned `search_path = public` across functions to eliminate search-path hijacking. |
| `20261028000023_honest_wcm_fpa_metrics.sql` | Honest WCM, FP&A & Cash Flow SQL | • Rebuilt `get_ar_ap_aging_analysis`, `get_fpa_corporate_metrics`, and `get_cash_flow_statement` from actual journal balances.<br>• Removed fabricated DPO/DSO calculations, nonexistent account codes, and synthetic benchmark ratios.<br>• Returns `NULL` when data is unavailable rather than generating placeholders. |
| `20261028000024_purchase_bills.sql` | Purchase Bills & ITC Register | • Added `purchase_bills` table (supplier GSTIN, invoice number, place of supply, tax splits, total check constraints).<br>• Added `itc_eligibility` enum (`eligible`, `ineligible_17_5`, `ineligible_other`) and blocked reason tracking.<br>• Enforced RLS; prevents deletion or alteration of bills linked to posted vouchers. |
| `20261028000025_sales_invoice_channel.sql` | Sales Invoice Channel & Round-Off | • Added `sales_channel` column (`b2b`, `b2c_large`, `b2c_small`, `export_with_tax`, etc.).<br>• Fixed round-off journal posting to account `4090` so issued invoices balance to the exact rupee. |

---

## 3. Newly Created Modules and Frontend Views

| Component / View Path | Route / Context | Feature Description |
| :--- | :--- | :--- |
| `src/modules/purchases/PurchasesView.tsx` | `/purchases` | Complete purchase bill register with GSTIN checks, tax calculations, optional voucher generation with maker-checker support, and CSV batch import. |
| `src/modules/gst/SalesInvoiceEditor.tsx` | `/gst` (Sales Invoice) | Professional invoice editor replacing mock screens. Zero prefilled dummy numbers; real GSTIN state vs. POS validation, channel selection, live paise tax calculator, and amount in Indian words. |
| `src/modules/gst/InvoiceSettlementBlock.tsx` | Invoice Editor Component | Bank settlement details and UPI QR code generator using `qrcode` for on-invoice instant payment collection. |
| `src/modules/gst/ReturnCard.tsx` | `/gst/file`, `/dashboard/returns` | Modular GST return card displaying readiness checklist, discrepancy warnings, and JSON download actions. |
| `src/modules/collect/CollectView.tsx` | `/collect` | MSME debt collection dashboard: aged receivables breakdown, FIFO settlement against debtor accounts, and pre-formatted WhatsApp reminder links. |
| `src/modules/approvals/ApprovalsView.tsx` | `/approvals` | Maker-checker voucher inbox for CFOs and admins to inspect, approve, or reject draft journal vouchers with mandatory reason logging. |
| `src/modules/banking/ReconciliationView.tsx` | `/banking/reconciliation` | Client-side bank statement parser supporting HDFC, ICICI, SBI, Axis, and Kotak formats, with fuzzy heuristic matching against ledger entries. |
| `src/modules/settings/CompanyControlsCard.tsx` | `/settings` | Organization configuration card for toggling maker-checker rules and updating official GSTIN. |
| `src/components/navigation/AppSidebar.tsx` | Global Navigation | Consolidated, accessible application sidebar with company switcher, FY period indicator, mobile drawer, and verified route links. |

---

## 4. Newly Created App Routes (Pages)

| Route | Page File | Purpose |
| :--- | :--- | :--- |
| `/purchases` | `src/app/purchases/page.tsx` | Purchase bills entry, ITC tracking, and CSV import view |
| `/approvals` | `src/app/approvals/page.tsx` | Journal voucher maker-checker approvals inbox |
| `/collect` | `src/app/collect/page.tsx` | MSME overdue receivables & WhatsApp payment collection |
| `/gst/file` | `src/app/gst/file/page.tsx` | Step-by-step GST filing wizard (Period -> Readiness -> JSON Review) |
| `/gst/guide` | `src/app/gst/guide/page.tsx` | Official GST portal navigation and upload guide |
| `/banking/reconciliation` | `src/app/banking/reconciliation/page.tsx` | Bank statement reconciliation workspace |

---

## 5. Newly Created Libraries and Helper Utilities

| File Path | Domain | Description |
| :--- | :--- | :--- |
| `src/lib/purchases/bills.ts` | Purchases | Purchase bills CRUD, line validation, and CSV parsing logic. |
| `src/lib/gst/returns.ts` | GST Compliance | Builds compliant GSTR-1 and GSTR-3B JSON structures from ledger books and purchase bills (Notification 14/2022). |
| `src/lib/gst/period.ts` | GST | Financial year & monthly period utilities with localStorage persistence. |
| `src/lib/gst/useReturnBooks.ts` | GST | Shared hook for loading sales invoices and purchase bills for GST returns. |
| `src/lib/invoices/tax-summary.ts` | Invoicing | Integer (paise) math for CGST/SGST vs IGST calculation, cess, and round-offs. |
| `src/lib/invoices/settlement.ts` | Invoicing | Validation for IFSC codes, UPI IDs, and bank account numbers with local defaults. |
| `src/lib/collect/receivables.ts` | Collections | Receivables aging analysis, party ledger aggregation, and FIFO invoice settlement. |
| `src/lib/collect/whatsapp.ts` | Collections | Generates personalized `wa.me` links with invoice balances and payment instructions. |
| `src/lib/bank/statement-parser.ts` | Banking | Multi-format CSV parser for HDFC, ICICI, SBI, Axis, and Kotak bank statements. |
| `src/lib/bank/matcher.ts` | Banking | Auto-match algorithm matching statement dates, amounts, and reference codes to journal lines. |
| `src/lib/vouchers/approvals.ts` | Approvals | Client-side API caller for submitting and approving/rejecting vouchers. |
| `src/lib/vouchers/invoice-text-parser.ts` | Document Extraction | Offline parser using regexes and check-digit validation for PDF text layers and images. |
| `src/lib/reports/ledger.ts` | Financial Reports | Accurate paise ledger balances, trial balance, and profit/loss calculation routines. |
| `src/lib/reports/expenses.ts` | Financial Reports | Real operating expense categorization from account groups. |
| `src/lib/reports/kpis.ts` | Financial Reports | Calculates real liquidity, debt, and profitability ratios from posted transactions. |
| `src/lib/reports/vouchers.ts` | Financial Reports | Day book and recent voucher aggregations from actual journal lines. |
| `src/lib/download.ts` | Utility | Browser file-download helper for JSON returns and exports. |

---

## 6. Newly Created Backend Endpoints & Files (Rust)

| File Path | Description |
| :--- | :--- |
| `backend/src/routes/purchases.rs` | REST endpoints for purchase bills: `GET /organisations/:org_id/purchases`, `POST /organisations/:org_id/purchases`, `POST /.../purchases/:id/link-journal`, `DELETE /.../purchases/:id`. |
| `backend/src/routes/banking.rs` | Bank reconciliation backend endpoints. |
| `backend/src/models/invoice.rs` | Extended with `sales_channel` and `round_off_paise`. |

---

## 7. What Was Fixed or Removed

### A. Fabricated Data & Mock Screens Removed
- **Deleted `src/modules/invoices/InvoicesView.tsx`**: Removed the prototype invoice generator that stored mock data in `localStorage`.
- **Redirects on Mock Routes**: `/invoices`, `/dashboard/invoices`, and `/dashboard/invoices/new` now redirect straight to the production-ready editor at `/gst`.
- **Mock Constants Eliminated**: Deleted hardcoded mock datasets in `DayBookView.tsx`, `CreditorsDpoView.tsx`, `DebtorsDsoView.tsx`, `OperatingExpensesView.tsx`, `GatewayLanding.tsx`, and `CustomizeKpiModal.tsx`.
- **Honest Dash (`-`) Display**: When ledger data is absent, UI components display `-` or an empty state rather than inventing zero or default amounts.

### B. Security & Multi-Tenant Isolation
- **Closed Cross-Tenant Query Leaks**: Secured report RPCs (`get_ar_ap_aging_analysis`, `get_cash_flow_statement`, etc.) with SQL-level organization verification.
- **Removed Service-Role Fallback**: The backend now strictly requires a valid user JWT bearer token.
- **Safe Authentication Redirects**: Redirects after login are strictly restricted to local relative paths to prevent open-redirect vulnerabilities.
- **Trial Guard**: Fixed license generation so tenants cannot grant themselves indefinite enterprise subscriptions for free.

### C. Zero Third-Party AI Data Leakage
- **Removed `src/lib/ai/sarvam-client.ts`**: Financial documents and invoice images are no longer transmitted over the wire to external AI APIs.
- **On-Device OCR & Text Extraction**: Extraction runs locally in the browser utilizing `pdfjs-dist` and `tesseract.js`.

### D. Financial Math & Accounting Precision
- **Indian Number-to-Words (`number-to-words.ts`)**: Fixed floating-point errors on paise, added support for sub-rupee figures, and expanded support past 1,000 crore.
- **Round-Off Balancing**: Invoices with fractional paise are adjusted against ledger account `4090` so debits and credits balance to the integer rupee.
- **Reversal Ledger Parity**: Reversed journal entries now correctly offset original postings rather than deleting rows and unbalancing reports.

---

## 8. Test Harness & Quality Assurance

11 new test suites were added to `tests/`:

| Test Suite | Coverage Area |
| :--- | :--- |
| `tests/purchases.test.ts` | Purchase bill validation, tax split, and CSV parsing |
| `tests/sales-invoice.test.ts` | Sales channel tax summaries, round-offs, and words conversion |
| `tests/gst-returns.test.ts` | GSTR-1 and GSTR-3B JSON generation and Notification 14/2022 rules |
| `tests/bank-matcher.test.ts` | Bank reconciliation auto-matching heuristics |
| `tests/bank-statement.test.ts` | Multi-bank CSV format parsing |
| `tests/collect.test.ts` | Receivables aging, FIFO payment allocation, WhatsApp links |
| `tests/approvals.test.ts` | Maker-checker state transitions |
| `tests/reports.test.ts` | Real ledger sums, expense buckets, and KPI calculations |
| `tests/invoice-text-parser.test.ts` | Regex & GSTIN check-digit parsing from document text |
| `tests/auth-paths.test.ts` | Auth redirect safety and tenant guard tests |
| `tests/financial-year.test.ts` | FY date ranges and quarter bounds |

Also added `supabase/tests/run_local.sh` and `supabase/tests/local_supabase_stub.sql` to execute automated SQL tests against local Postgres.

**Current Test Results:**
- **15 test files passed** (15 total)
- **122 tests passed** (122 total)
