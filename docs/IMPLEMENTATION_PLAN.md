# Deku Finance — Implementation Plan

Status as of 31 Oct 2026 · branch `fix/data-integrity-privacy-demo` (`30d2ba3`) compared with `main` (`71acf61`).

This plan covers everything needed to complete the platform. The module list is drawn from the old BizSoKae platform (screenshots in `Media/`), but every module is built on Deku's own Rust backend, its own Postgres migrations and its own ledger. BizSoKae only supplies the list of jobs a GST business needs done; it does not supply the design or any code.

---

## 1. Ground rules for every module

1. **Business logic lives on the server.** Postgres functions and constraints decide what is allowed: posting, tax rules, approvals, access. Rust routes are the only API. The frontend only presents data and must never be the sole place a rule is enforced.
2. **Migrations are sequential.** New migrations start at `20261031000026_…`. Each one is idempotent, revokes `EXECUTE` from `PUBLIC, anon` on new functions (migration 18 rule), uses RLS through `is_org_member` / `has_role`, and pins `search_path = public` on `SECURITY DEFINER` functions.
3. **Every Rust route forwards the user's JWT.** `backend/src/supabase.rs` refuses requests without one, and there is no service-role fallback. Register new route files in `backend/src/routes/mod.rs`.
4. **No fabricated data.** Missing values are `null` / "–" with a reason. There are no sample rows, placeholder GSTINs, or fallback ratios.
5. **Privacy.** Company data goes only to Deku's backend and Supabase. Any third-party integration (Razorpay, GSP, KYC provider) is opt-in per company, shares only the fields it needs, and is listed in Settings.
6. **Money is handled in paise (integers)** in TypeScript and Rust; the database uses `numeric(15,2)`.
7. **Every module ships with tests:**
   - SQL behaviour in `supabase/tests/*_test.sql`, run with `bash supabase/tests/run_local.sh`;
   - Rust `#[cfg(test)]` tests for pure logic;
   - vitest for UI logic.
8. **Definition of done:** see §7.

---

## 2. Module inventory and current state

Score legend: **1** = implemented on real data, **0.5** = exists but is mock, broken or partial, **0** = missing, **–** = not applicable.
Each cell lists Frontend / Backend / Migrations.

| # | Area | Module | `main` F/B/M | ours F/B/M |
|---|---|---|---|---|
| 1 | Platform | Auth, sessions & tenant isolation | .5 / .5 / 1 | 1 / 1 / 1 |
| 2 | Platform | Company onboarding & business profile (GST/Pure mode, state, UPI, bank) | .5 / .5 / .5 | .5 / .5 / .5 |
| 3 | Platform | Roles, members, departments & payroll | .5 / 1 / 1 | .5 / 1 / 1 |
| 4 | Platform | Plans, trial & licence billing | .5 / .5 / .5 | .5 / .5 / .5 |
| 5 | Platform | Demo sandbox | .5 / 0 / 0 | 1 / 1 / 1 |
| 6 | Platform | KYC & identity (PAN, Udyam, DigiLocker/EntityLocker) | 0 / 0 / 0 | 0 / 0 / 0 |
| 7 | Platform | Notifications & due-date reminders | .5 / 0 / 0 | .5 / 0 / 0 |
| 8 | Masters | Chart of accounts | 1 / 1 / 1 | 1 / 1 / 1 |
| 9 | Masters | Parties (customers & vendors) | 1 / 1 / 1 | 1 / 1 / 1 |
| 10 | Masters | Products & services / item master | 1 / 1 / 1 | 1 / 1 / 1 |
| 11 | Masters | HSN/SAC lookup master | 0 / 0 / 0 | 0 / 0 / 0 |
| 12 | Masters | Inventory & stock ledger | 0 / 0 / .5 | 0 / 0 / .5 |
| 13 | Transactions | Vouchers & journal posting | .5 / 1 / .5 | 1 / 1 / 1 |
| 14 | Transactions | Document / bill reader (OCR) | .5 / .5 / 1 | .5 / 1 / 1 |
| 15 | Transactions | Sales invoicing (editor, issue, cancel, register, channel, UPI QR) | .5 / 1 / .5 | 1 / 1 / 1 |
| 16 | Transactions | Credit & debit notes | 0 / 0 / 0 | 0 / 0 / 0 |
| 17 | Transactions | Purchases & ITC register | 0 / 0 / 0 | 1 / 1 / 1 |
| 18 | Transactions | Maker-checker approvals | 0 / 0 / .5 | 1 / 1 / 1 |
| 19 | Transactions | Day book | .5 / 1 / 1 | .5 / 1 / 1 |
| 20 | Transactions | Bank reconciliation | 0 / 0 / 0 | 1 / 1 / 1 |
| 21 | Transactions | Collections (MSME Collect) | 0 / 0 / 0 | 1 / 1 / 1 |
| 22 | Transactions | Payment gateway (Razorpay links, webhooks, auto-receipts) | 0 / 0 / 0 | 0 / 0 / 0 |
| 23 | Transactions | Marketplace settlement import (Amazon/Flipkart parsers) | 0 / 0 / 0 | .5 / .5 / .5 |
| 24 | Reports | Trial balance, P&L, balance sheet | 1 / 1 / .5 | 1 / 1 / 1 |
| 25 | Reports | Cash flow statement | 1 / 1 / .5 | 1 / 1 / 1 |
| 26 | Reports | Debtors/creditors ageing (DSO/DPO) | .5 / 1 / .5 | 1 / 1 / 1 |
| 27 | Reports | Executive dashboard, KPIs & Sec 22 turnover tracker | .5 / 1 / .5 | 1 / 1 / 1 |
| 28 | Reports | FP&A, opex & budgets | .5 / 1 / .5 | 1 / 1 / 1 |
| 29 | Reports | Deku Consultant (ledger analyst) | .5 / .5 / .5 | 1 / 1 / 1 |
| 30 | Compliance | GSTR-1 / GSTR-3B computation & JSON | .5 / .5 / 1 | 1 / .5 / 1 |
| 31 | Compliance | GSTR-3B Table 6 tax payment & ITC set-off | 0 / 0 / 0 | 0 / 0 / 0 |
| 32 | Compliance | Filing wizard & GST portal guide | 0 / 0 / 0 | 1 / .5 / 1 |
| 33 | Compliance | Direct filing via GSP, e-invoice (IRN), e-way bill | 0 / 0 / 0 | 0 / 0 / 0 |
| 34 | Compliance | Audit trail & activity logs | .5 / 1 / 1 | .5 / 1 / 1 |
| 35 | Workspace | Document builder (quotes, POs, letters) | .5 / 0 / 0 | .5 / 0 / 0 |
| 36 | Workspace | Data import/export (Tally, Excel) | 0 / 0 / 0 | 0 / 0 / 0 |
| 37 | Experience | App shell, theme & dark mode, responsive | 1 / – / – | .5 / – / – |
| 38 | Experience | Public website (features, pricing, comparison, FAQ, free tools) | .5 / – / – | .5 / – / – |

### Summary

| | Frontend | Backend | Migrations | Overall | Modules fully done |
|---|---|---|---|---|---|
| `main` | 39% | 44% | 42% | **42%** | 4 / 38 |
| ours | 64% | 65% | 69% | **66%** | 17 / 38 |
| Best of either branch | 66% | 65% | 69% | **67%** | — |

By area (ours vs `main`): Reports 100% vs 69% · Transactions 74% vs 27% · Masters 63% vs 63% · Platform 57% vs 40% · Compliance 50% vs 30% · Experience 50% vs 75% · Workspace 8% vs 8%.

**Missing on both branches:** KYC, HSN/SAC master, credit/debit notes, payment gateway, GSTR-3B Table 6, GSP filing / e-invoice / e-way bill, and Tally/Excel import.

**Only `main` is ahead on the app shell:** its dark theme and responsive Gateway layout.

**How the scores were assigned:**
- Scores come from reading the code. Nothing has been run against a live backend: the Rust is uncompiled on the dev machine, and migrations 18–25 have not been applied.
- A "1" means the code path is real, not that it has been verified in production.
- `main` loses points for the issues found in review: mock screens, service-role fallback, a demo-cookie auth bypass, fake licence and signup tokens, broken report SQL, and the reversed-entry bug.

---

## 3. Phase 0 — Stabilise and converge (do first; nothing else is safe until this is done)

| Step | What | Owner check |
|---|---|---|
| 0.1 | Install the Windows SDK, then run `cargo build` and `cargo test` in `backend/` and fix any compile errors in `banking.rs`, `purchases.rs`, `organisations.rs`, `consultant.rs` and `supabase.rs`. | Builds with no warnings from new code |
| 0.2 | Run `bash supabase/tests/run_local.sh` (Docker). Fix migrations 18–25 until the harness passes, including a re-run of the seed. | Harness green |
| 0.3 | Bring `main`'s good work onto this branch by hand. Do not `git merge` `main` wholesale (25 conflicting files). Port the dark theme as dark values for the existing semantic tokens in `src/app/globals.css` plus `ThemeContext` and a toggle in `AppSidebar`. Port the responsive Gateway layout onto the real-data Gateway, and the login/signup visuals. | Every screen readable in light and dark |
| 0.4 | Explicitly reject these from `main`: the `deku_demo_session` cookie bypass in middleware, the fake `deku-license-…` / `deku-auth-…` tokens, storing the user and token in localStorage, and the "disable Confirm email" end-user message. | Covered by `tests/auth-paths.test.ts` plus a new middleware test |
| 0.5 | Remove the remaining client-side sources of truth: the localStorage day-book mirror (`deku_local_daybook_vouchers`), `SAMPLE_PROOFS`, demo company names in `builder-drafts.ts` / `DocumentBuilderView.tsx` / `activity-logger.ts`, and `AuditTrailView` sample actions. | `grep` for each returns nothing |
| 0.6 | Delete legacy routes and components: the `/dashboard/*` tree (old Header/Sidebar), the duplicate `/executive` vs `/dashboard/executive`, and the redirect pages once links are updated. | Sidebar is the only navigation |
| 0.7 | Remove `Media/` from the repository (it shows a personal browser and an OTP-like tab title), and consider rewriting history if the repo stays public. | — |
| 0.8 | Apply migrations 18–25 plus `seed.sql` to Supabase project `jylsaqqblbpwwxdkmlzd`, then set `superadmins.user_id` for the platform owner. | Demo login works; anon RPC calls fail |
| 0.9 | Open a PR from this branch into `main` and merge it, so `main` becomes the single source of truth again. Work in short-lived branches from then on. | `main` == this branch |

---

## 4. Phase 1 — Move remaining logic into Rust/SQL

Several modules compute their figures in the browser (`src/lib/gst/returns.ts`, `src/lib/reports/*`, `src/lib/collect/receivables.ts`). That works, but it breaks rule 1: anyone with API access can produce different numbers, and other clients (mobile app, CA portal) would have to duplicate the logic.

| Module | Server-side work | Migration | Rust | Frontend |
|---|---|---|---|---|
| GST returns (30, 32) | Port `buildGstr1` / `buildGstr3b` and all validations to Rust (`backend/src/gst/`) using the existing tests as the spec. Persist each prepared return. | `026_gst_return_filings` (period, type, json, status `prepared/filed`, filed_by, ARN, prepared_at). RLS member read, owner/cfo/admin/accountant write. | `routes/gst.rs`: `GET /gst/:period/gstr1`, `GET /gst/:period/gstr3b`, `POST /gst/:period/:type/record` (stores the JSON and marks it prepared), `PATCH …/filed` (ARN). | The wizard and returns page call the endpoints; delete the client-side builders once parity tests pass. |
| Ledger reports (24–28) | Move `partyBalances` (FIFO settlement) and KPI computation into SQL functions, so reports and Collections share one source. | `027_ledger_settlement_functions` (`get_party_ledger_ageing(p_org_id, p_side)`, `get_kpi_snapshot(p_org_id, p_from, p_to)`). | Expose them under `/reports/...` in `accounting.rs`. | Swap `src/lib/reports/*` for API calls; keep the vitest fixtures as Rust/SQL test cases. |
| Collections (21) | Uses the ageing function above, plus a `reminders` log. | Covered by `027` and `033`. | `routes/collect.rs` (list plus log reminder sent). | Unchanged UI. |

**Acceptance:** for the same books, the server output equals the current TS output on every existing test fixture. Write the TS fixtures as JSON and assert in both test suites.

---

## 5. Phase 2–5 — Build the missing modules

Each module below uses the same template: **Migration → Rust → Frontend → Tests → Acceptance**.

### Phase 2 — Compliance completeness

**M16 Credit & debit notes**
- Migration `028_credit_debit_notes`:
  - `sales_notes` with type `credit`/`debit`, the original invoice FK, reason code, lines and taxes, and status draft/issued/cancelled;
  - an `issue_sales_note()` function that posts the reversing journal atomically, mirroring `issue_sales_invoice`, with an immutability guard.
- Rust: `routes/notes.rs` (create/list/issue/cancel).
- Frontend: a "Credit note" action on an issued invoice in `/gst`, pre-filled from the invoice; partial quantities allowed.
- GSTR-1: CDNR (registered) and CDNUR (unregistered) sections. GSTR-3B: reduce 3.1(a).
- Tests: a note can't exceed the original value; the tax split follows the original place of supply; the period is reported correctly.

**M11 HSN/SAC master**
- Migration `029_hsn_sac_codes` (code, description, type goods/service, default rate, effective_from). Load it from the official CBIC HSN/SAC list in a seed file, citing the source and date; never type rates by hand.
- Rust: `GET /hsn?q=` (search by code or words).
- Frontend: a typeahead in the item master and invoice lines, with a rate suggestion the user confirms. Also a free public tool on the website.
- Tests: search ranking; codes of 4, 6 and 8 digits.

**M31 GSTR-3B Table 6: tax payment & ITC set-off**
- Migration: part of `026` (store the set-off on the filing record).
- Rust: compute the set-off in the statutory order (IGST credit → IGST, then CGST, then SGST; CGST credit → CGST then IGST; SGST credit → SGST then IGST; under Rule 88A) and the cash payable per head. Include the electronic cash/credit ledger balances the user enters, since the portal ledgers aren't readable without a GSP.
- Frontend: a Table 6 card in the wizard's review step.
- Tests: the published examples for Rule 88A order.

**M15+ Invoice types**
- Add Tax invoice / Bill of supply / Export (with and without payment) / SEZ as `invoice_type` on `sales_invoices` (migration `030_invoice_types`).
- Bill of supply = Pure-mode companies and exempt supplies, with no tax lines. Export and SEZ feed GSTR-1 6A/6B (currently blocked), and exports also need a shipping bill number and date.

**M33 Direct filing, e-invoice (IRN), e-way bill** (blocked on a partner decision, see §6)
- Migration `031_gsp_integration`: `gsp_connections` (provider, encrypted credentials or session, enabled_at, enabled_by), plus `e_invoices` (IRN, ack no, signed QR, status) and `eway_bills` (EWB no, validity).
- Rust: `routes/gsp.rs`: OTP session start/confirm, `POST /gst/:period/:type/file` (submit plus file with EVC), `POST /invoices/:id/irn`, `POST /invoices/:id/eway`.
- Frontend: "Connect GST portal" in Settings, "File now" in the wizard, and "Generate IRN" / "Generate e-way bill" on the invoice.
- Acceptance: tested end-to-end in the GSP sandbox; IRN QR printed on the invoice.

### Phase 3 — Money in and out

**M22 Payment gateway (Razorpay, OAuth "connect your own account")**
- Prerequisite: Razorpay Technology Partner approval (via support).
- Migration `032_payment_connections`:
  - `payment_connections` (org, provider, razorpay_account_id, encrypted access/refresh tokens, expires_at, status);
  - `invoice_payment_links` (invoice, link id, short url, status);
  - `gateway_payments` (payment id unique, invoice, amount, fee, tax_on_fee, captured_at, journal_entry_id);
  - a "Razorpay clearing" account added to the COA seed.
- Rust: `routes/payments.rs`:
  - OAuth start/callback (validate `state`), with tokens stored encrypted and never returned to the browser;
  - a refresh job before the 90-day expiry;
  - `POST /invoices/:id/payment-link`;
  - `POST /webhooks/razorpay`: verify the signature, be idempotent on payment id, create the receipt voucher (Dr Razorpay clearing / Cr Debtor; fee + GST on fee to bank charges), and respect maker-checker;
  - handle `account.app.authorization_revoked`.
- Frontend: a Settings card, a "Pay online" link on invoices / PDF / WhatsApp reminder, and payment status in Collections.
- Bank reconciliation matches the Razorpay settlement to the clearing account.
- Tests: signature verification, duplicate webhook, partial payment, revoked token.

**M23 Marketplace settlement import**
- Migration `033_marketplace_settlements` (channel, settlement id, period, gross, commission, TCS u/s 52, TDS u/s 194-O, net, lines).
- Rust: parse uploaded Amazon/Flipkart/Meesho settlement reports and post a summary journal (sales, commission expense, TCS/TDS receivable, net to bank).
- Frontend: an upload screen per channel and a mapping preview.
- GSTR-3B: ECO supplies under 3.1.1 (the wizard's marketplace question).
- Tests: a real sample report per channel (anonymised); totals reconcile.

**M14 Bill reader → purchase bill**
- Wire the on-device extractor (`src/lib/vouchers/document-extractor.ts`) into the Purchases "Add bill" form ("Scan bill"). It stays on-device, with no migration.

### Phase 4 — Platform

**M2 Business profile & onboarding**
- Migration `034_organisation_profile`: `operating_mode` (gst/pure), `state_code`, registered address, `upi_vpa`, bank details (account, IFSC, beneficiary), `udyam_number`, `composition_scheme`. Move these from localStorage to the DB; settings is owner/admin only.
- Frontend: an onboarding wizard after signup (mode → details → GSTIN check digit → first fiscal period → COA seed), plus a Settings profile.
- Collections, the invoice UPI QR and the MSMED 45-day flag then read real values.

**M7 Notifications & reminders**
- Migration `035_notifications`: `notifications` (org, user, type, payload, read_at) plus `reminder_rules`.
- Rust: a scheduled job (Supabase cron or a backend task) for GSTR-1/3B due dates, overdue invoices, approvals waiting, expiring tokens and licence expiry.
- Frontend: a bell with an unread count; an optional email.

**M4 Plans & billing (Deku's own subscription)**
- Move licence issuance fully server-side; delete client-side `createDefaultLicense`.
- Migration `036_subscriptions`: a plan catalogue, subscriptions and limits enforced in SQL (e.g. invoices/month, seats).
- Payment through Razorpay Subscriptions on Deku's own account (separate from M22).
- Frontend: the Upgrade flow and trial banner from real data.

**M6 KYC & identity** (blocked on a provider decision)
- Migration `037_kyc`: `kyc_verifications` (subject person/business, method pan/udyam/digilocker/entitylocker, status, verified_at, provider reference). Store no Aadhaar numbers: keep a verification reference only.
- Rust: a provider adapter (DigiLocker / EntityLocker / API Setu need registration as a requester entity).
- Frontend: a KYC hub with a trust level and a printable verification certificate.

**M12 Inventory & stock**
- Migration `038_inventory`: warehouses and a `stock_movements` table (item, qty, rate, source document) with FIFO/weighted-average valuation in SQL. Invoices and purchase bills create movements.
- Reports: stock summary and valuation feeding the balance sheet.

**M36 Data import/export**
- Rust: Tally XML/Excel importers for masters and opening balances, with a dry-run preview (no migration beyond import logs `039_import_jobs`).
- Exports: CSV for every register; Tally XML export of vouchers.

**M35 Document builder**
- Move the localStorage drafts to `040_business_documents` (quote, PO, delivery challan, proforma); "convert quote → invoice" via the invoice API.

### Phase 5 — Experience

- **M37:** dark mode (from Phase 0) everywhere; a responsive check at 375 px for every screen; keyboard shortcuts audited (no single-key shortcuts while form controls have focus).
- **M38:** public website pages for Features, Pricing (from the M4 plan catalogue), Comparison, FAQ, and free tools (GSTIN validator, HSN finder, GST calculator; all client-side, no data leaves the browser).
- **M34:** audit trail from `audit_events` only (no sample actions); export already exists.

---

## 6. Open decisions (need an owner before the blocked modules start)

| Decision | Blocks | Options |
|---|---|---|
| GSP partner for API filing / e-invoice / e-way | M33 | Partner with an existing GSP vs apply to become one (long, regulated). Compare price per GSTIN, sandbox quality and e-invoice support. |
| KYC provider | M6 | Direct DigiLocker/EntityLocker requester registration vs an aggregator. |
| Razorpay model | M22 | OAuth "connect own account" (recommended first) vs Partner/aggregator onboarding (commission, more compliance). |
| Third-party data policy wording | M22, M33, M6 | Per-company opt-in screen listing exactly what's shared with whom. |
| ITC timing | M17/M30 | Bill date (current) vs month received vs GSTR-2B month (needs GSP for 2B import). |
| What stays from the old platform | M21, M15 | Collections and the invoice editor were modelled on BizSoKae; confirm with the co-developer. |

---

## 7. Definition of done (per module)

- [ ] Migration applied by `run_local.sh` with a SQL test covering RLS (member vs non-member vs anon) and each business rule.
- [ ] Rust route compiles, has unit tests for pure logic, and forwards the user JWT.
- [ ] Frontend uses design tokens, works in light/dark and at 375 px, and has empty/error states with reasons.
- [ ] No fabricated values (`grep` for sample data / placeholder GSTINs is clean).
- [ ] vitest, `tsc --noEmit`, `next build`, `cargo test` and `run_local.sh` all pass in CI.
- [ ] README "Professional Controls" updated; any `shortcut:` comments listed in the PR.

---

## 8. Suggested order

1. Phase 0 (all steps), which unblocks everything.
2. Phase 1: GST returns server-side (026) → ledger functions (027).
3. Phase 2: credit/debit notes (028) → HSN master (029) → Table 6 → invoice types (030).
4. Phase 4: business profile (034), which Collections, UPI and invoices need → notifications (035).
5. Phase 3: Razorpay (032) → marketplace settlements (033) → scan bill.
6. Phase 4 rest: subscriptions (036) → inventory (038) → import/export (039) → documents (040).
7. Blocked items as their decisions land: GSP (031), KYC (037).
8. Phase 5 throughout, with each module's UI.

Migration numbers above are reservations; renumber only if two land on the same day.
