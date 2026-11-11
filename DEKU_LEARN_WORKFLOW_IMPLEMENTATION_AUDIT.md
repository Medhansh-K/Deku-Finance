# Deku Learn workflow implementation audit

Audit of the 18 Learn Centre workflows (`apps/platform/src/lib/learn/workflows/catalogue.ts`) against the screens they run on, the API calls those screens make, the real backend and SQL they stand in for, and what the demo can and cannot honestly do. Written 11 Nov 2026 alongside the engine and runtime work, so items marked **engine** or **runtime** are requirements on those two pieces, not statements about finished code.

## The design in one paragraph

The Learn Centre runs entirely in the browser. Every `apiClient` call made by a real screen inside the demo workspace (`components/learn/LearnDemoWorkspace.tsx`) is answered by the in-browser engine (`lib/learn/demo-api.ts` and `lib/learn/engine/*`), which keeps each demo company's books in localStorage. The engine is a browser re-implementation of the Rust routes in `backend/src/routes` and the SQL functions in `supabase/migrations`; it is kept faithful by tests against the same rules, not by sharing code. The trade-off is explicit: what a visitor does in the demo proves the screens and the accounting rules, never the production server, network or database. Workflows complete only on activities the engine or the workspace records (`lib/learn/activity.ts`); none completes on a toast.

## How each step is proved

| Step kind | Completes when | Recorded by |
|---|---|---|
| Read step (no `expect`, or `expect: visit`) | The visitor is on, or navigates to, the step's screen after the step started | Workspace: `route.visited` in `LearnDemoContext.navigateTo` |
| Action step (`expect: event`) | The engine records that business event after the step started (and by the given role, where set) | Engine: one activity per applied write |
| Role preview step | `role.switched` with the given role | Workspace: `switchRole` |

Activity types are only those in `DEMO_ACTIVITY_TYPES`. Event types each workflow waits for, and the API call that must record them (**engine** requirement, one activity per successful write, none on a refused one):

| Event | Recorded on | Workflows |
|---|---|---|
| `invoice.created` | `POST /invoices` | WF-01, WF-18 |
| `invoice.issued` | `POST /invoices/:id/issue` | WF-01, WF-18 |
| `purchase.created` | `POST /purchases` | WF-02 |
| `journal.created` | `POST /journals` | WF-04 |
| `journal.submitted` | `POST /journals/:id/submit` | WF-03, WF-04, WF-06, WF-18 |
| `journal.posted` | `POST /journals/:id/post` | WF-02, WF-03, WF-04, WF-05, WF-18 |
| `stock.adjusted` | `POST /inventory/adjustments` | WF-05 |
| `bank.matched` | `POST /banking/reconciliations` | WF-06 |
| `bank.reconciled` | `POST /banking/statements` | WF-06 |
| `settings.updated` | `PATCH /settings` | WF-07, WF-18 |
| `account.created` / `party.created` / `item.created` | `POST /accounts` / `/parties` / `/catalogue` | WF-07, WF-18 |
| `member.invited` | `POST /invitations` | WF-08 |
| `department.updated` | `POST /departments` (record with `field: "created"`), `PATCH`/`DELETE /departments/:id` | WF-11 |
| `consultant.asked` | `POST /consultant/chat` | WF-15 |

`bank.statement_imported` is deliberately not used: the reconciliation screen parses the CSV in the browser with `parseStatement` and calls no API, so the engine cannot see an import. WF-06 proves the load by the match that follows it.

## Workflows

Endpoints are relative to `/api/v1/organisations/{org}`. "SQL" names the function or policy in `supabase/migrations` the engine mirrors.

### WF-01 Create a sales invoice
- **Screens:** `/gst` → `GstTaxHubView` + `SalesInvoiceEditor`; `/day-book` → `DayBookView` + `VoucherDrawer`; `/reports/debtors` → `DebtorsDsoView`; `/gst/returns` → `GstReturnsDemoScreen` (`ReturnCard`).
- **API:** `GET /invoices`, `/parties`, `/notes`, `/catalogue`; `POST /invoices`; `POST /invoices/:id/issue`; `GET /journals`, `/accounts`, `/files`, `/members`; `GET /reports/party-ageing?side=receivable`, `/reports/kpis`; `GET /gst/{period}/gstr1`.
- **SQL:** RLS `sales_invoices_insert_draft` (mig 7: owner, admin, accountant); `issue_sales_invoice` (mig 41) which posts its journal through `post_journal_entry` (mig 20: owner, CFO, admin) and moves tracked stock out through the status trigger (mig 42).
- **Roles:** draft by Accountant; issue by Admin or Owner (the intersection of the two functions). The CFO can post journals but cannot issue invoices; the accountant can prepare but not issue.
- **Demo safety:** no IRN, e-way bill, payment link or WhatsApp is sent; those blocks on the invoice stay simulated.
- **Gaps:** none in the flow. The coach must cope with targets inside the Create tab and the invoice modal, which only exist after a click (see the tutorial spec).

### WF-02 Record a purchase bill
- **Screens:** `/purchases` → `PurchasesView`; `/approvals` → `ApprovalsView`; `/reports/creditors`; `/gst/returns`; `/inventory` → `InventoryView`; `/day-book`.
- **API:** `POST /purchases`; `POST /journals`; `POST /journals/:id/submit`; `PATCH /purchases/:id` (link the journal); `POST /journals/:id/post`.
- **SQL:** `purchase_bills` insert policy (mig 24: owner, CFO, admin, accountant); journal draft insert (mig 5/55: owner, admin, accountant); `submit_journal_for_approval` and `post_journal_entry` (mig 20, maker-checker); `stock_on_purchase_bill_linked` trigger (mig 42).
- **Roles:** Accountant enters; CFO approves (never the maker).
- **Gap (screen):** `PurchasesView` sends bill totals only, never `purchase_bill_lines`, so in the real app too a bill entered on this screen moves the Inventory ledger but not item quantities. The step says so and points to WF-05; it does not pretend stock moved. The seed's bill DC-INV-908 does carry lines and movements.

### WF-03 Receive from a customer, pay a supplier
- **Screens:** `/vouchers/receipt`, `/vouchers/payment` → `VoucherWorkspace`; `/approvals`; `/reports/debtors`, `/reports/creditors`, `/reports/general-ledger`.
- **API:** `GET /invoices` (open invoices for "Settle an open sales invoice"); `POST /journals`; `POST /files` (payment proof); `POST /journals/:id/submit`; `POST /journals/:id/post`; ageing and ledger reads.
- **SQL:** as WF-02 for vouchers; ageing from `get_party_ageing`; ledger from the ledger functions (mig 29).
- **Roles:** Accountant makes and submits; CFO approves.
- **Connection:** the receipt settles the WF-01 invoice if one was issued, otherwise the seeded AST/26-27/002 (Kaveri Infra, ₹4,72,000).
- **Gap (screen):** every voucher type requires a proof document before it can be submitted (`validateProofForVoucher`). A receipt settled against an invoice gets its proof automatically; a payment needs a file from the visitor's device. The file is read in the browser; the engine must accept `POST /files` and record `document.attached` without uploading anything.

### WF-04 Enter vouchers (F4 to F9)
- **Screens:** `/vouchers/contra`, `/vouchers/journal`; `/approvals`; `/day-book`; `/reports/general-ledger`.
- **API / SQL / roles:** as WF-03. Save draft calls only `POST /journals`.
- **Gaps:** Sales (F8) and Purchase (F9) vouchers are covered through invoices and bills in WF-01 and WF-02 rather than repeated here; posting a raw sales voucher needs a paired invoice document anyway. Contra needs a proof file, as above.

### WF-05 Adjust stock
- **Screens:** `/masters/products-services` → `ProductsServicesView`; `/inventory` → `InventoryView` (stock summary, stock ledger, adjustments); `/approvals`; `/reports/balance-sheet`.
- **API:** `GET /catalogue`, `/inventory/warehouses`, `/inventory/summary`, `/inventory/items/:id/ledger`; `POST /inventory/adjustments`; `POST /journals/:id/post`.
- **SQL:** `record_stock_adjustment` (mig 42: owner, admin, accountant; its journal posts at once for owner/CFO/admin, otherwise waits for approval); FIFO valuation from movements; `allow_negative_stock` check.
- **Roles:** Accountant adjusts; CFO approves the adjustment's journal.
- **Industries:** Northstar Consulting sells services only, so the card says to use another company.
- **Plan:** inventory is PRO in the demo plan table; multi-warehouse views (Meridian) are Enterprise.
- **Gap:** no manufacturing or BOM, by design.

### WF-06 Reconcile the bank
- **Screens:** `/banking/reconciliation` → `ReconciliationView`; voucher screens via the Unmatched tab's "Create payment voucher" link; `/reports/general-ledger`.
- **API:** `GET /journals`, `/parties`, `/banking/reconciliations`, `/banking/statements`, `/banking/statements/position`; `POST /banking/reconciliations` (match); `DELETE /banking/reconciliations/:id` (undo); `POST /banking/statements` (complete); voucher calls as WF-03.
- **SQL:** `bank_reconciliations` insert/delete (mig 19, 52: owner, CFO, admin, accountant); `reconciliation_statements` (mig 56), immutable once recorded.
- **Roles:** Accountant reconciles; CFO approves the voucher made for an unmatched line.
- **Demo data (engine):** a per-company statement (`demo-bank-statement-oct-nov-2026.csv`, built by `demoStatementCsv` in `sample-data.ts`) whose lines match posted bank lines (which need line ids) plus a few lines missing from the books.
- **Gap (runtime):** the statement is a file the visitor must choose. The demo must offer it for download (control bar, step card or the docs article); without that, WF-06 cannot be done. `bank.statement_imported` is not recordable from this screen (see above).

### WF-07 Set up a company
- **Screens:** `/settings` → `SettingsView`, `CompanyProfileCard`, `CompanyControlsCard`; `/masters/chart-of-accounts`, `/masters/parties`, `/masters/products-services`; `/gateway`.
- **API:** `PATCH /settings`; `GET /fiscal-periods`; `POST /accounts`, `/parties`, `/catalogue`.
- **SQL:** `organisations_update_admins` (mig 2: owner, admin) and the profile columns (mig 30); `accounts_manage` (mig 5); parties and catalogue policies (mig 3, 4).
- **Roles:** Admin (or Owner) for settings; Admin, Owner or Accountant for masters.
- **Gaps:** there is no readiness checklist screen, so the last step is the Gateway's company card and figures. Adding a fiscal period is possible on the screen (`POST /fiscal-periods`) but there is no activity type for it, so the workflow only reads the financial year. Creating a new company (`/companies`) is not part of the demo: each demo company is one fixed set of books.

### WF-08 Set up the team
- **Screens:** `/departments-members` → `DepartmentsMembersView`; `/reports/fpa`.
- **API:** `GET /members`, `/invitations`, `/departments`; `POST /invitations`; `PATCH /members/:id` (role change, not used).
- **SQL:** `invite_user_to_organisation` (mig 16, 49: owner, CFO, admin); `check_org_seat_availability` (members plus unexpired pending invitations); `protect_membership_changes` (mig 41: owner, admin; only the owner grants owner).
- **Plan:** Enterprise. Each demo company already has 7 members and a pending invitation (8 seats), above PRO's 5, and the screen disables Send invitation when seats are full.
- **Demo safety:** no email is sent; the invitation link is shown, never delivered.
- **Gap:** there is no revoke button on the screen, so the visitor cannot free a seat on PRO. Changing a member's role is possible but left out on purpose: it would change who can do what in every other workflow.

### WF-09 Review financial performance
- **Screens:** `/reports/trial-balance`, `/reports/profit-loss`, `/reports/balance-sheet`, `/reports/cash-flow`, `/reports/fpa`, `/reports/general-ledger`.
- **API:** `GET /reports/trial-balance`, `/reports/profit-and-loss`, `/reports/balance-sheet`, `/reports/cash-flow`, `/reports/fpa-metrics`, `/reports/general-ledger`.
- **SQL:** report functions (mig 6, 21, 45, 46, 54), FP&A metrics (mig 17, 23).
- **Roles:** any member can read (RLS `is_org_member`).
- **Gap (runtime):** row clicks on Trial Balance, P&L and Balance Sheet use `router.push("/day-book?account_code=…")`, which the demo does not intercept (it only intercepts `<a href>` clicks), so they leave the workspace. The workflow traces through General Ledger instead. The runtime should intercept `router.push` inside the workspace.

### WF-10 Manage working capital
- **Screens:** `/reports/debtors`, `/collect` → `CollectView`, `/reports/creditors`, `/reports/fpa`, `/reports/cash-flow`.
- **API:** `GET /reports/party-ageing`, `/reports/kpis`, `/invoices`, `/parties`, payment links list; report reads.
- **Demo safety:** WhatsApp reminders open `wa.me` in the visitor's own browser in production; in the demo they are simulated and labelled.

### WF-11 Track department budgets
- **Screens:** `/reports/fpa` (department budget against actual), `/departments-members` (Departments tab), `/reports/operating-expenses`.
- **API:** `GET /reports/budget-variance`, `/departments`; `POST /departments`; `GET /reports/expenses`.
- **SQL:** `departments` policies (mig 13: owner, admin); `get_department_budget_variance` (mig 21).
- **Roles:** CFO reads; adding a department needs Admin or Owner, so that step switches to Admin.
- **Gap (product):** `budget_utilized` is a stored number on the department (mig 13), not computed from the ledger, because vouchers carry no department. The workflow says so instead of implying budget-vs-actual comes from the books. No budget editing exists on the screen beyond creating a department with an annual budget.

### WF-12 Check business health
- **Screens:** `/gateway` → `GatewayLanding`; `/executive` → `ExecutiveSummaryView`; `/reports/profit-loss`, `/reports/debtors`, `/reports/cash-flow`, `/reports/balance-sheet`; `/approvals`.
- **API:** `GET /reports/kpis`, `/reports/profit-and-loss`, `/invoices`, `/journals`; report reads.
- **Roles:** Owner; read-only, so works on GO.

### WF-13 Follow the business's transactions
- **Screens:** `/gst`, `/purchases`, `/collect`, `/reports/creditors`, `/day-book`, `/reports/profit-loss`. Read-only.

### WF-14 Analyse revenue and expenses
- **Screens:** `/reports/profit-loss` (date range), `/reports/general-ledger`, `/reports/operating-expenses`, `/reports/fpa`, `/day-book`. Read-only.
- **Gap:** there is no side-by-side period comparison on one screen; the visitor changes the P&L range and compares, which the step says plainly.

### WF-15 Ask Deku Consultant
- **Screens:** `/consultant` → `DekuConsultantView`; `/reports/profit-loss`, `/reports/trial-balance`.
- **API:** `GET /consultant/context`; `POST /consultant/chat`.
- **Backend:** `backend/src/routes/consultant.rs` (`fetch_grounded_org_context`); any member may ask.
- **Demo safety:** no external AI is called; answers are computed from the demo ledger.
- **Gap (engine):** the screen reads `res.response` (and `res.model_used`); the engine's chat handler as first written returned `reply`, which would show an empty answer. The engine must return `response`.

### WF-16 Trace a transaction
- **Screens:** `/gst`; `/day-book` (search, voucher drawer with journal lines, approval trail and "Open invoice"); `/reports/general-ledger`; `/audit` → `AuditTrailView`.
- **API:** `GET /invoices`, `/journals`, `/members`, `/files`; `GET /audit-events` (backend `audit.rs` merges `user_activity_logs` and `audit_events`).
- **Connection:** traces the WF-01 invoice if issued, otherwise AST/26-27/002 and its voucher JRN-AST/26-27/002. The engine must set `journal_entry_id` on every issued invoice so the drawer's Source row and Open invoice link work.
- **Gap (product, real RLS):** `audit_events` SELECT is limited to owner, admin and accountant (mig 9), so a real Auditor sees the user activity log but not `audit_events` rows. The demo must not show the Auditor more than that. The step reads the log as Auditor and the docs do not claim more.

### WF-17 Check accounting integrity
- **Screens:** `/day-book`, `/reports/trial-balance`, `/approvals`, `/audit`, `/banking/reconciliation` (completed reconciliations), `/gst/returns`. Read-only.
- **Gaps:** the seed has no reversal, so the reversal step shows the filter and explains the pair; reversals appear once a checker reverses something. No seeded discrepancy is shown: none can be shown honestly without planting a fault in books that must reconcile. Auditor visibility of `audit_events` as in WF-16.

### WF-18 Business-to-close cycle
- **Screens and API:** the union of WF-07 (settings, parties), WF-01 (invoice), WF-03 (receipt, approval), WF-09 (P&L, balance sheet), WF-10 (FP&A), WF-16 (Day Book drawer, audit) and WF-12 (executive).
- **Roles:** Admin sets up and issues; Accountant drafts the invoice and records the receipt; CFO approves and reviews; Analyst, Auditor and Owner read. Action steps that must be done by a role check the role on the activity (`expect.role`).
- **Gap (runtime):** maker-checker in `ApprovalsView` compares the signed-in user id with the voucher's `created_by` and `submitted_by`. The demo's user is `public-learn-demo` for every role, so the runtime must give each previewed role its own user id (the seed's `u-acc`, `u-cfo`, …) and the engine must stamp `created_by`/`submitted_by` with it; otherwise the CFO's Approve button is disabled for the accountant's voucher, or (worse) nobody is ever blocked.

## data-tour targets added for these workflows

Attribute-only edits (no behaviour or styling change; every changed line differs only by the attribute):

| Target | File |
|---|---|
| `invoice-customer`, `invoice-lines`, `invoice-tax-summary`, `invoice-save` | `modules/gst/SalesInvoiceEditor.tsx` |
| `invoice-issue` | `modules/gst/GstTaxHubView.tsx` |
| `gst-return-card` | `modules/gst/ReturnCard.tsx` |
| `voucher-settle-invoice` | `modules/vouchers/VoucherWorkspace.tsx` |
| `day-book-register` | `modules/day-book/DayBookView.tsx` |
| `voucher-drawer-lines`, `voucher-drawer-trail`, `voucher-drawer-invoice` | `modules/day-book/VoucherDrawer.tsx` |
| `approvals-detail`, `approvals-approve` | `modules/approvals/ApprovalsView.tsx` |
| `inventory-tabs`, `inventory-adjust-form`, `inventory-stock-ledger` | `modules/inventory/InventoryView.tsx` |
| `recon-tabs`, `recon-complete`, `recon-history` | `modules/banking/ReconciliationView.tsx` |
| `members-invite-form`, `departments-form` | `modules/departments-members/DepartmentsMembersView.tsx` |
| `general-ledger-account` | `modules/financial-reports/general-ledger/GeneralLedgerView.tsx` |
| `debtors-summary` | `modules/financial-reports/debtors/DebtorsDsoView.tsx` |
| `fpa-margins`, `fpa-working-capital`, `fpa-budgets` | `modules/financial-reports/fpa/FpaExecutiveView.tsx` |
| `opex-summary` | `modules/financial-reports/operating-expenses/OperatingExpensesView.tsx` |
| `executive-kpis`, `executive-balance-health` | `modules/executive/ExecutiveSummaryView.tsx` |
| `consultant-prompts`, `consultant-composer` | `modules/consultant/DekuConsultantView.tsx` |
| `collect-status-tabs` | `modules/collect/CollectView.tsx` |

## Verification

`tests/learn-workflows.test.ts` checks, for all 18 workflows: unique ids and codes WF-01 to WF-18; at least three steps; every card field filled; start route and every step route (and every visit expectation) rendered by `LearnDemoWorkspace`; every `target` present as `data-tour="…"` in the source of the module that renders that route (plus the shell and demo bar); every event type in `DEMO_ACTIVITY_TYPES`; valid roles, and `step.role` equal to `expect.role` where set; approvals only by Owner, CFO or Admin; invoice issuing only by Owner or Admin; Analyst and Auditor workflows write nothing; every docs slug exists and the docs articles list every workflow. It does not run the screens; end-to-end behaviour depends on the engine recording the events in the table above.
