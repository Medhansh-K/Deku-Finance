# Deku Learn: workflow accounting validation

The Learn Centre runs with no backend. Every `apiClient` call a reused screen makes in the demo is answered by the in-browser engine (`apps/platform/src/lib/learn/demo-api.ts`, which routes to `lib/learn/engine/*`). The engine is a TypeScript re-implementation of the database rules. It stays faithful because the tests run each operation against the same rules the SQL functions enforce. It is not the real engine, and the differences are listed at the end.

How each operation was checked: the tests drive `dispatchDemoApi` with a fake context and assert the books, never a toast. The tests are `tests/learn-engine-seed.test.ts`, `tests/learn-engine-accounting.test.ts` and `tests/learn-engine-admin.test.ts`. The run on 2026-11-11 gave 45 test files and 397 tests passing (the whole suite), and `npx tsc --noEmit -p apps/platform` was clean.

**Reset (applies to every row below).** Every write changes only this browser's copy of the active demo company. That copy is in localStorage under `deku-learn:v2:<company>`. "Reset demo" reseeds the company from `createInitialDemoDataset` and clears its activity log. The store version was bumped from 1 to 2 because the dataset shape changed, so older saves are discarded on load.

**Activity.** Each applied write records one event with `ctx.record`, using the types and refs in `lib/learn/activity.ts`. A refused write records nothing, because every check runs before the save.

## Starting books (all four companies)

- **Chart of accounts:** the real default chart from `seed_default_chart_of_accounts` (migration 35), plus `add_inventory_accounts` (1050 Inventory, 3030 Opening Balance Equity, 5015 Inventory Adjustment).
  - Codes, names, `ledger`, `sub_ledger` and `label` are the same as in production, so every SQL lookup by code or ledger group maps one to one.
  - Examples: output GST is 2081/2082/2083, input GST is 1081/1082/1083, debtors are 1030 (sub-ledger "Trade Debtors"), cash and bank sit in the "Cash & Liquid Capital" ledger, and round-off goes to 4090.
- **Fiscal period:** FY 2026-27, open.
- **Settings:** `require_journal_approval` is on, and negative stock is not allowed.
- **Team:** seven members, one for each role: owner `u-owner`, CFO `u-cfo`, admin `u-admin`, accountant `u-acc`, analyst `u-analyst`, auditor `u-aud` and viewer `u-viewer`. All are fictional people with `.example` emails.
- **Seeded data:** one pending invitation (expires 2027-03-31), five departments with budgets, and employees with pay figures so payroll can run.
- **Bank:** a supplied bank statement. It has one line for every bank movement in the books, plus two lines the books don't have yet: a bank charge and an unidentified credit. October is already matched, and its completed reconciliation snapshot equals the book balance on 31 Oct.
- **Approvals:** one voucher is awaiting approval in each company.

| Company | Customers / suppliers | Stock (FIFO = ledger 1050) | Open receivable | Unpaid bill | Bank (1020) |
|---|---|---|---|---|---|
| Aster Trading (goods, MH) | Bharat Switchgear, Kaveri Infra / Deccan Cables (KA, IGST), Konkan Freight | 35 panels @ ₹7,000 + 15 coils @ ₹12,000 = ₹4,25,000, Bhiwandi | Kaveri Infra ₹4,72,000 (AST/26-27/002) | Deccan Cables ₹5,03,600 | ₹23,73,000 |
| Northstar Consulting (services, KA) | FinBridge, Apex Cloud (MH, IGST) / Indiranagar CoWork, Cirrus Hosting | none (services; default "Main warehouse") | Apex Cloud ₹5,90,000 | Indiranagar CoWork ₹2,12,400 | ₹21,86,800 |
| UrbanNest Retail (D2C + marketplace, DL) | D2C pool, ShopSphere marketplace buyers, Casa Verde / Jaipur Homecrafts (RJ, IGST) | 160 carafes @ ₹1,200 + 80 throws @ ₹1,400 = ₹3,04,000 | Casa Verde ₹1,34,400 | Jaipur Homecrafts ₹3,58,480 | ₹31,12,200 |
| Meridian Retail (2 warehouses, MH) | Westside Metro, Lakeview Gourmet / Sahyadri Supply | Mumbai: 300 tins @ ₹500 + 200 bags @ ₹750; Pune: 200 bags @ ₹760 (opening stock) = ₹4,52,000 | Westside Metro ₹1,77,000 (after credit note CN/26-27/004) | Sahyadri ₹3,98,000 | ₹40,70,000 |

**Reconciliation checks** (`tests/learn-engine-seed.test.ts`, run for every company):

- Every journal balances, and every line has exactly one side.
- The trial balance totals agree, and so do its closing debit and credit columns.
- The balance sheet equation holds: assets = liabilities + equity (including accumulated profit).
- The KPI `balanced` flag is true.
- FIFO stock value equals the 1050 ledger.
- Each invoice, credit note and purchase bill equals its journal.
- The supplied statement parses cleanly with the app's own CSV parser, and its running balances agree.
- Exactly two statement lines are unbooked, and closing balance = book balance + those two lines.
- The October snapshot equals `bank_reconciliation_position` on 31 Oct.

## Operations

In this table, "Rec." is the activity the operation records.

| Operation | Starting state | Action / endpoint | Data change | Accounting impact (debit = credit is enforced) | UI result | Completion check (rec.) | Mirrors |
|---|---|---|---|---|---|---|---|
| Create a sales invoice draft | Customer exists | `POST /invoices` | Draft invoice with lines; number must be unique | None (drafts never reach the ledger) | Invoice list shows the draft | `invoice.created` {invoiceId, number, total} | `create_invoice` (Rust) + RLS `sales_invoices_insert_draft` (owner/admin/accountant) |
| Issue an invoice | Draft, stock on hand | `POST /invoices/{id}/issue` | Status `issued`; header totals recomputed from the lines; `journal_entry_id` set; stock-out movement at the default warehouse | `JRN-<no>` posted: Dr 1030 (or 1040 for marketplace channels) total; Cr 4010 taxable; Cr 2081/2082 (intra-state) or 2083 (inter-state); 4090 round-off. Receivable rises. Stock leaves at FIFO cost (returned as `cost_of_goods_fifo`; **no COGS journal**, as in SQL). | Invoice shows issued; Day Book shows the journal | `invoice.issued` {invoiceId, number, journalId, total} | `issue_sales_invoice` (migration 41): tax-split rules, at least one line, export type, open period, plan invoice limit; `stock_on_sales_invoice_status` + `stock_assert_available` (migration 42) |
| Cancel an invoice | Issued | `POST /invoices/{id}/cancel` | Status `cancelled`; stock movements reversed | `REV-JRN-<no>` posted with swapped lines; original marked `reversed` | Invoice shows cancelled; Day Book shows the reversal | `invoice.cancelled` {…, reversalJournalId} | `cancel_sales_invoice`, `reverse_journal_entry`, `stock_reverse_document` |
| Credit or debit note | Issued invoice | `POST /notes`, then `/notes/{id}/issue` or `/cancel` | Draft note, then issued; a sales-return credit brings stock back at the cost it left at | `JRN-CN-<no>`: Dr 4010, Dr output tax, Cr 1030 (a debit note is the reverse); credits are capped at the invoice's taxable value and tax | Notes tab | `note.created`, `note.issued`; cancel records `journal.reversed` | `issue_sales_note` / `cancel_sales_note` (migration 31), `stock_on_sales_note_status` |
| Purchase bill | Supplier | `POST /purchases` (optional `lines` [{item_id, quantity, rate}]), then the screen's voucher and `PATCH /purchases/{id}` {journal_entry_id} | Bill saved; when linked, goods lines come in at the bill rate at the default warehouse | The screen's `PUR-<gstin>-<bill>` voucher: Dr purchase ledger, Dr input GST (if ITC eligible), Cr 2010 supplier. Payable and ITC rise. | Bill register shows "Linked" | `purchase.created` {purchaseId, number, total, itc} | `purchase_bills` RLS (migration 24); `stock_on_purchase_bill_linked` (migration 42); delete is only allowed while unlinked |
| Voucher (contra / payment / receipt / journal / sales / purchase) | Open period | `POST /journals` (draft) → `/submit` → `/post` (approver) | Draft, then submitted, then posted, with `created_by`, `submitted_by` and `posted_by` stamped with the acting member | Posting enforces at least 2 lines, debit > 0 and debit = credit, the entry date inside its open fiscal period, postable accounts, and one side per line. Receipts and payments move party balances. | Day Book and Approvals queue | `journal.created` {journalId, number, voucherType, total, status}, `journal.submitted`, `journal.posted` | RLS insert (owner/admin/accountant), `submit_journal_for_approval`, `post_journal_entry` (owner/CFO/admin; with approval on, the maker or submitter can't approve), `next_voucher_number` |
| Reject a voucher | Submitted | `POST /journals/{id}/reject` {reason} | Rejected; submission cleared | None | Back to the maker | `journal.rejected` | `reject_journal_entry` |
| Edit a draft | Unsubmitted draft, same maker | `PUT /journals/{id}` | Header and lines replaced | None | Edited draft | `journal.updated` | `edit_draft_journal` (migration 55): not submitted, maker only, not from a document, at least 2 lines, narration, open period |
| Reverse a voucher | Posted | `POST /journals/{id}/reverse` | Contra entry posted; original `reversed` | Swapped lines; net effect zero | Day Book shows both | `journal.reversed` {journalId, number, reversalJournalId} | `reverse_journal_entry` + migration 27 |
| Stock adjustment or opening stock | Tracked item | `POST /inventory/adjustments` | Movement; out-movements checked against available stock | `STK-…`: in = Dr 1050 / Cr 5015 (or 3030 for opening); out = Dr 5015 / Cr 1050, at FIFO value. Posted for owner/CFO/admin; otherwise `pending_approval`. | Stock summary, item ledger and valuation | `stock.adjusted` {itemId, warehouseId, direction, quantity, value} | `record_stock_adjustment` |
| Stock summary and ledger | – | `GET /inventory/summary`, `/inventory/items/{id}/ledger` | Computed from movements (FIFO layers) | – | – | – | `get_stock_summary`, `get_stock_ledger`, `stock_fifo_movements` |
| Warehouses | – | `POST`/`PATCH`/`DELETE /inventory/warehouses` | One default; the default can't be cleared or deleted; a warehouse with stock can't be deleted | – | – | (no activity type) | migration 42 guards and RLS |
| Bank: load statement and match | Supplied statement (`demoStatementCsv`) | `POST /banking/reconciliations` | Match row: statement line to a posted bank journal line with exactly the same amount | None | Line shows as matched | `bank.statement_imported` (first match against the supplied file), then `bank.matched` {statementId, lineId, journalId} | `bank_reconciliations` + `guard_bank_reconciliation` |
| Bank: undo match | Match | `DELETE /banking/reconciliations/{id}` | Match removed | – | – | `bank.unmatched` | RLS delete |
| Bank: resolve a difference | Unbooked line | A receipt or payment voucher (rows above), then match it | – | e.g. Dr 5090 / Cr 1020 for the bank charge | – | as for vouchers | – |
| Bank: complete | – | `POST /banking/statements` | Permanent snapshot: book balance, matched, uncleared, difference; an unexplained difference must be accepted explicitly | None | Completed list | `bank.reconciled` {reconciliationId, difference} | `guard_reconciliation_statement`, `bank_reconciliation_position` (migration 56) |
| Invite a member | Seats available | `POST /invitations` | Pending invitation; earlier pending invitations to the same email expire; **nothing is sent** (`simulated: true`) | – | Invitations list | `member.invited` {invitationId, email, role} | `invite_user_to_organisation` (owner/CFO/admin; only the owner grants owner; email format; seat limit; existing member) |
| Change a role / remove a member | – | `PATCH` / `DELETE /workbench-members/{id}` | Role changed or member removed | – | Members list | `member.role_changed` {memberId, from, to} (removal has no activity type) | `protect_membership_changes` (owner/admin; not your own role; an admin can't touch the owner; the sole owner can't leave) |
| Departments and budgets | – | `POST`/`PATCH`/`DELETE /departments`, `/departments/{id}/tasks` | Department, budget or task changed | – | Departments; FP&A budget variance | `department.updated` {departmentId, field} | RLS `departments_modify_owners` (owner/admin), `tasks_modify_permitted`; `get_departmental_budget_variance` |
| Payroll | Active employees | `POST /payroll/run` {period} | Run upserted | `PAYROLL-<period>`: Dr 5020 gross; Cr 2091 net, 2092 TDS, 2093 EPF (accounts created on first use). Submitted for approval when approval is on. | Payroll runs | `payroll.run` {runId, journalId} | `run_monthly_payroll` (migration 58): period format, not a future month, no double run, gross = net + TDS + EPF |
| Marketplace settlement | Settlement file | `POST /marketplace/settlements` → `/{id}/post` | Header must equal the sum of its lines | `MKT-<CHANNEL>-<ref>`: Dr bank net payout, 5091 fees, input GST on fees, 1084 TCS, 1085 TDS; Cr 1040 clearing. Submitted for approval when approval is on. | Settlement list | `marketplace.settlement_posted` {settlementId, journalId} | `create_marketplace_settlement`, `post_marketplace_settlement` |
| Company settings | – | `PATCH /settings` | Only the whitelisted fields, each validated (GSTIN, IFSC, UPI, state code, …); blank text clears a field; the GSTIN state must match | – | Settings cards | `settings.updated` {fields} | `settings_body` (Rust) + RLS `organisations_update_admins` |
| Masters | – | `POST /parties`, `/catalogue`, `/accounts`, `/fiscal-periods`; `PATCH /catalogue/{id}`; `PATCH`/`DELETE /accounts/{id}` | Saved | System accounts and accounts with entries can't be deleted; only goods track stock; fiscal periods can't overlap | Masters lists | `party.created`, `item.created`, `account.created` (`settings.updated` for a fiscal period) | RLS for masters; Rust `create_account`/`delete_account` |
| Business documents | – | `POST`/`PUT`/`DELETE /business-documents`, `/status`, `/convert` | Totals computed from the lines; status flow draft → sent → accepted → converted/cancelled; convert creates a draft invoice | None until the invoice is issued | Document register | `invoice.created` on convert (other document writes have no activity type) | `save_business_document`, `guard_business_document`, `convert_business_document` |
| Attach a document | Voucher | `POST /files?filename=…&journal_entry_id=…` | Name, size and link only (the file itself is not stored) | – | Day Book attachment | `document.attached` {journalId, fileName} | `document_files` RLS |
| Reports | – | `GET /reports/*`, `/gst/{period}/gstr1\|gstr3b` | Computed from posted and reversed entries: TB, P&L (range), BS (as of, with accumulated profit), GL, cash flow (direct), debtor/creditor ageing (bill by bill, aged from voucher date), KPIs including DSO/DPO, expenses, FP&A, budget variance, AR/AP | – | Report screens | `report.viewed` {report}, not twice in a row for the same report | migrations 21, 29, 45, 46, 54 |
| Consultant | – | `POST /consultant/chat` | – | – | `{response, model_used}`. The answer is computed from the books by fixed rules and names its sources; it says no AI model was called. | `consultant.asked` {question} | Not a mirror: the real consultant calls an LLM, the demo doesn't |

Any other write returns `501 "<METHOD path> isn't available in the demo"`, so the screen shows an error. A GET with no data returns an empty list.

## Role rules (the demo is never looser than the database)

`lib/learn/engine/rbac.ts` holds the matrix with a migration reference on each line. Where one function calls another, the demo uses the intersection of both role sets, because the database applies both:

- **Issue or cancel an invoice or note: owner and admin only.** `issue_sales_invoice` allows owner, admin and accountant, but it posts its journal through `post_journal_entry`, which allows owner, CFO and admin.
  - So the accountant drafts the invoice and the owner or admin issues it.
  - The CFO, who used to be allowed in the demo, is now refused.
  - The same intersection should apply in production. Please confirm it is intended.
- **Reverse: owner and admin.** `reverse_journal_entry` allows owner, admin and accountant, and its post step allows owner, CFO and admin.
- **Create a draft: owner, admin and accountant.** The CFO cannot draft; it approves.
- **Approve and post: owner, CFO and admin.**

`lib/learn/demo-roles.ts` was aligned with these rules: the CFO lost `create_draft`, `issue_invoice` and `reverse_voucher`, and the accountant lost `issue_invoice`. A test (`learn-engine-admin.test.ts`) fails if the role table ever allows something the SQL matrix denies.

**Plans:**

- The seat limit applies to invitations: members plus pending invitations must be fewer than the seats. GO has 2 seats and PRO has 5; the seven-member team already exceeds both, so inviting needs Enterprise.
- The GO plan's monthly invoice limit applies when issuing.
- The catalogue item limit applies when adding items.

## What is NOT mirrored (honest list)

- **No database atomicity or concurrency.** Each request computes the new books and saves them in one step, so a refused step leaves no partial change. Concurrent users don't exist in the demo.
- **COGS on sale.** As in SQL, issuing an invoice moves stock out at FIFO cost but posts no cost-of-goods journal. The seed posts COGS vouchers by hand, so after a visitor's sale the FIFO stock value is lower than ledger 1050 by exactly the FIFO cost until a COGS voucher is posted. This is real-product behaviour, not a demo bug.
- **Purchases screen sends no item lines.** It doesn't send `lines` today, so bills saved from that screen move no stock, which is also true in production. The engine accepts `lines` if a screen ever sends them.
- **Dates.** Ageing, cancel-reversal dates and report defaults use the books' date (the later of 2026-11-10 and the newest entry), not the visitor's clock. Screens that default to "today" use the real clock. After 31 Mar 2027 those dates fall outside FY 2026-27 and posting is refused with the real "no open fiscal period" error.
- **Sources of truth that don't exist in the browser:** the RLS layer itself, triggers that fire on direct table writes, Postgres numeric rounding (the demo rounds to paise in JavaScript), invoice-number sequences, the hash-chained activity log, notifications generated by the database (the demo derives "approval waiting" and "invoice overdue" from the books), and `employees` maintenance (no screen edits it, so those writes return "not available").
- **The consultant is rule-based, not an LLM.**
- **Not available in the demo** (each returns 501 with a reason):
  - Tally/CSV imports.
  - Document extraction and proposals.
  - Password-reset links: the members are fictional and have no logins.
  - Employee compensation, bonus and reimbursement endpoints: no demo screen uses them.
  - Creating another company.
  - Accepting an invitation.

## Reset and persistence

Per company, the books and activity log live in localStorage (`demo-store.ts`, version 2). Reset reseeds from `createInitialDemoDataset(slug)`. The seed is deterministic, so reconciliation results are identical after every reset.
