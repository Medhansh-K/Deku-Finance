# Deku Learn workflow catalogue

The 18 Learn Centre workflows, as defined in `apps/platform/src/lib/learn/workflows/catalogue.ts` (`LEARN_WORKFLOWS`, `getLearnWorkflow(id)`). This file is generated from that data, so the cards, the tour and this page say the same thing. Regenerate it after changing the catalogue.

How to read it:

- **Completes on** is what the activity recorder (`lib/learn/activity.ts`) must log after the step starts. `visit` steps are read steps: they complete when the visitor is on that screen. Event steps complete only when the demo engine records that business event (with the role, when one is given).
- **Role** is the role the tour switches to before the step. "any" means the step works in the role the visitor is previewing.
- Seeded figures quoted in steps are Aster Trading Co.'s, the recommended company for every workflow. Other companies are listed under **Companies** when the workflow works there; an **Industry note** explains any company that doesn't fit.
- Catalogue categories (cards filter on these): Daily accounting, Sales & purchases, Inventory & banking, Financial management, Business administration, Audit & compliance, Complete business workflow. Filters also work by role (primary or supporting) and by company.
- Nothing has to be set up before Start: the Start button opens the recommended company, the primary role and the minimum plan at the start page (`workspaceHref` in `workflows/runner.ts`).

## Cards

| Code | Name | Category | Primary role | Supporting | Companies | Start company | Min plan | Start page | Minutes | Difficulty | Steps |
|---|---|---|---|---|---|---|---|---|---|---|---|
| WF-01 | Create a sales invoice | Sales & purchases | Accountant | Owner, Admin | aster-trading, northstar-consulting, urbannest-retail, meridian-retail | aster-trading | GO | `/gst` | 12 | starter | 7 |
| WF-02 | Record a purchase bill | Sales & purchases | Accountant | CFO, Admin | aster-trading, northstar-consulting, urbannest-retail, meridian-retail | aster-trading | PRO | `/purchases` | 12 | intermediate | 7 |
| WF-03 | Receive from a customer, pay a supplier | Daily accounting | Accountant | CFO | aster-trading, northstar-consulting, urbannest-retail, meridian-retail | aster-trading | PRO | `/vouchers/receipt` | 15 | intermediate | 8 |
| WF-04 | Enter vouchers (F4 to F9) | Daily accounting | Accountant | CFO | aster-trading, northstar-consulting, urbannest-retail, meridian-retail | aster-trading | PRO | `/vouchers/contra` | 15 | intermediate | 6 |
| WF-05 | Adjust stock | Inventory & banking | Accountant | CFO, Admin | aster-trading, urbannest-retail, meridian-retail | aster-trading | PRO | `/masters/products-services` | 10 | intermediate | 6 |
| WF-06 | Reconcile the bank | Inventory & banking | Accountant | CFO, Admin | aster-trading, northstar-consulting, urbannest-retail, meridian-retail | aster-trading | PRO | `/banking/reconciliation` | 15 | advanced | 6 |
| WF-07 | Set up a company | Business administration | Admin | Owner | aster-trading, northstar-consulting, urbannest-retail, meridian-retail | aster-trading | GO | `/settings` | 12 | starter | 8 |
| WF-08 | Set up the team | Business administration | Admin | Owner, CFO | aster-trading, northstar-consulting, urbannest-retail, meridian-retail | aster-trading | ENTERPRISE | `/departments-members` | 8 | starter | 6 |
| WF-09 | Review financial performance | Financial management | CFO | Owner, Analyst | aster-trading, northstar-consulting, urbannest-retail, meridian-retail | aster-trading | PRO | `/reports/trial-balance` | 12 | intermediate | 6 |
| WF-10 | Manage working capital | Financial management | CFO | Owner, Analyst | aster-trading, northstar-consulting, urbannest-retail, meridian-retail | aster-trading | PRO | `/reports/debtors` | 10 | intermediate | 5 |
| WF-11 | Track department budgets | Financial management | CFO | Admin, Owner | aster-trading, northstar-consulting, urbannest-retail, meridian-retail | aster-trading | PRO | `/reports/fpa` | 10 | intermediate | 5 |
| WF-12 | Check business health | Financial management | Owner | CFO, Viewer | aster-trading, northstar-consulting, urbannest-retail, meridian-retail | aster-trading | GO | `/gateway` | 8 | starter | 8 |
| WF-13 | Follow the business's transactions | Financial management | Owner | CFO | aster-trading, northstar-consulting, urbannest-retail, meridian-retail | aster-trading | GO | `/gst` | 10 | starter | 6 |
| WF-14 | Analyse revenue and expenses | Financial management | Analyst | CFO | aster-trading, northstar-consulting, urbannest-retail, meridian-retail | aster-trading | PRO | `/reports/profit-loss` | 12 | intermediate | 6 |
| WF-15 | Ask Deku Consultant | Financial management | Analyst | Owner, CFO | aster-trading, northstar-consulting, urbannest-retail, meridian-retail | aster-trading | PRO | `/consultant` | 6 | starter | 4 |
| WF-16 | Trace a transaction | Audit & compliance | Auditor | CFO, Owner | aster-trading, northstar-consulting, urbannest-retail, meridian-retail | aster-trading | PRO | `/gst` | 10 | intermediate | 6 |
| WF-17 | Check accounting integrity | Audit & compliance | Auditor | CFO, Owner | aster-trading, northstar-consulting, urbannest-retail, meridian-retail | aster-trading | PRO | `/day-book` | 12 | advanced | 7 |
| WF-18 | Business-to-close cycle | Complete business workflow | Admin | Accountant, CFO, Analyst, Auditor, Owner | aster-trading, northstar-consulting, urbannest-retail, meridian-retail | aster-trading | PRO | `/settings` | 25 | advanced | 12 |

## WF-01 Create a sales invoice (`wf-01-sales-invoice`)

Raise a GST invoice for a customer, issue it, and see the receivable, revenue and output GST it posts.

- **Category:** Sales & purchases · **Difficulty:** starter · **Time:** 12 min · **Minimum plan:** GO
- **Roles:** Accountant (primary); Owner, Admin (supporting)
- **Modules:** sales, gst, day-book, reports
- **Companies:** aster-trading, northstar-consulting, urbannest-retail, meridian-retail; Start opens **aster-trading** at `/gst`
- **Starting data:** Customers Kaveri Infra Controls LLP and Bharat Switchgear Works (both in Maharashtra), catalogue items Industrial MCB Panel 63A (₹12,000, 18%) and Armoured Copper Cable (₹20,000, 18%), stock at Bhiwandi Main Hub, and the open FY 2026-27.
- **Done when:** The saved invoice reopens from its Day Book voucher, and its receivable, revenue and output GST lines are posted and balanced.
- **Docs:** `operations/accountant-workflows`, `operations/sales-invoicing-and-collections`, `gst-compliance/gst-pos-itc-and-returns`

| # | Step | Screen | Highlights | Role | Completes on | What changes in the books |
|---|---|---|---|---|---|---|
| 1 | Open the sales invoice register | `/gst` | `gst-tabs` | any | visit `/gst` | Read only |
| 2 | Fill in the invoice and save it as a draft | `/gst` | `gst-tabs` | any | `invoice.created` | A draft invoice for ₹70,800 (₹60,000 plus ₹10,800 GST) is added to the register. A draft posts nothing. |
| 3 | Issue the invoice as Admin | `/gst` | `invoice-issue` | Admin | `invoice.issued` | Dr 1030 Accounts Receivable (Kaveri Infra) ₹70,800; Cr 4010 Sales revenue (products) ₹60,000; Cr 2081 Output CGST ₹5,400; Cr 2082 Output SGST ₹5,400. The 5 panels leave stock at FIFO cost. |
| 4 | Inspect the accounting entry | `/day-book` | `day-book-search` | any | visit `/day-book` | Read only |
| 5 | See the customer's receivable | `/reports/debtors` | `debtors-summary` | any | visit `/reports/debtors` | Read only |
| 6 | Find it in the sales return | `/gst/returns` | `gst-return-card` | any | visit `/gst/returns` | Read only |
| 7 | Reopen the invoice from its voucher | `/day-book` | `voucher-drawer-invoice` | any | visit `/gst` | Read only |

## WF-02 Record a purchase bill (`wf-02-purchase-invoice`)

Enter a supplier bill with GST, keep the eligible input tax credit, get its voucher approved and check the payable.

- **Category:** Sales & purchases · **Difficulty:** intermediate · **Time:** 12 min · **Minimum plan:** PRO
- **Roles:** Accountant (primary); CFO, Admin (supporting)
- **Modules:** purchases, gst, approvals, inventory, day-book, reports
- **Companies:** aster-trading, northstar-consulting, urbannest-retail, meridian-retail; Start opens **aster-trading** at `/purchases`
- **Starting data:** Supplier Deccan Cables & Conductors (Karnataka GSTIN, so purchases into Maharashtra carry IGST), ledgers 1050 Inventory, 1083 Input IGST and 2010 Accounts Payable, and maker-checker approvals switched on.
- **Done when:** The bill is in the register, its voucher is posted after approval, and Accounts Payable and Input GST match the bill's totals.
- **Docs:** `operations/accountant-workflows`, `gst-compliance/gst-pos-itc-and-returns`, `roles-and-governance/seven-roles-and-maker-checker`

| # | Step | Screen | Highlights | Role | Completes on | What changes in the books |
|---|---|---|---|---|---|---|
| 1 | Open Purchases & ITC | `/purchases` | `purchases-tabs` | any | visit `/purchases` | Read only |
| 2 | Enter the bill and its voucher | `/purchases` | `purchases-itc` | any | `purchase.created` | The bill joins the register and its voucher (Dr 1050 Inventory and Dr 1083 Input IGST; Cr 2010 Accounts Payable) is submitted for approval. Nothing reaches the ledger yet. |
| 3 | Approve the purchase voucher (PUR-…) as CFO | `/approvals` | `approvals-approve` | CFO | `journal.posted` as CFO | The purchase posts: Inventory and Input IGST rise and Deccan Cables' payable grows by the bill total. |
| 4 | Check the supplier payable | `/reports/creditors` | `creditors-summary` | any | visit `/reports/creditors` | Read only |
| 5 | See the eligible ITC | `/gst/returns` | `gst-return-card` | any | visit `/gst/returns` | Read only |
| 6 | Look at stock | `/inventory` | `inventory-tabs` | any | visit `/inventory` | Read only |
| 7 | Find the posted voucher | `/day-book` | `day-book-register` | any | visit `/day-book` | Read only |

## WF-03 Receive from a customer, pay a supplier (`wf-03-receipts-payments`)

Settle an open invoice with a receipt voucher, pay a supplier with a payment voucher, and check both balances.

- **Category:** Daily accounting · **Difficulty:** intermediate · **Time:** 15 min · **Minimum plan:** PRO
- **Roles:** Accountant (primary); CFO (supporting)
- **Modules:** vouchers, approvals, reports
- **Companies:** aster-trading, northstar-consulting, urbannest-retail, meridian-retail; Start opens **aster-trading** at `/vouchers/receipt`
- **Starting data:** An open customer invoice: the one you issued in WF-01, otherwise the seeded AST/26-27/002 to Kaveri Infra (₹4,72,000). Deccan Cables' unpaid ₹5,03,600 on bill DC-INV-908. Ledger 1020 Operating Bank Account.
- **Done when:** Both vouchers are posted after approval, the customer's and supplier's outstanding balances fall by the amounts settled, and the bank ledger shows both.
- **Docs:** `operations/accountant-workflows`, `accounting/vouchers-and-day-book`, `operations/sales-invoicing-and-collections`

| # | Step | Screen | Highlights | Role | Completes on | What changes in the books |
|---|---|---|---|---|---|---|
| 1 | Open a receipt voucher | `/vouchers/receipt` | `voucher-types` | any | visit `/vouchers/receipt` | Read only |
| 2 | Settle the open invoice | `/vouchers/receipt` | `voucher-settle-invoice` | Accountant | `journal.submitted` | The receipt is saved and waits for approval. The receivable does not change until it posts. |
| 3 | Approve the receipt (RCP-…) as CFO | `/approvals` | `approvals-approve` | CFO | `journal.posted` as CFO | Dr 1020 Operating Bank Account; Cr 1030 Accounts Receivable for the customer. The invoice is no longer outstanding. |
| 4 | Pay the supplier | `/vouchers/payment` | `voucher-lines` | Accountant | `journal.submitted` | The payment waits for approval; the payable is unchanged until it posts. |
| 5 | Approve the payment as CFO | `/approvals` | `approvals-approve` | CFO | `journal.posted` as CFO | Dr 2010 Accounts Payable (Deccan Cables) ₹5,03,600; Cr 1020 Operating Bank Account ₹5,03,600. |
| 6 | Check the customer's balance | `/reports/debtors` | `debtors-summary` | any | visit `/reports/debtors` | Read only |
| 7 | Check the supplier's balance | `/reports/creditors` | `creditors-summary` | any | visit `/reports/creditors` | Read only |
| 8 | Read the bank ledger | `/reports/general-ledger` | `general-ledger-account` | any | visit `/reports/general-ledger` | Read only |

## WF-04 Enter vouchers (F4 to F9) (`wf-04-vouchers`)

Enter a contra and a journal voucher, see the debit-equals-credit check, get one approved and find both in Day Book.

- **Category:** Daily accounting · **Difficulty:** intermediate · **Time:** 15 min · **Minimum plan:** PRO
- **Roles:** Accountant (primary); CFO (supporting)
- **Modules:** vouchers, approvals, day-book, reports
- **Companies:** aster-trading, northstar-consulting, urbannest-retail, meridian-retail; Start opens **aster-trading** at `/vouchers/contra`
- **Starting data:** Ledgers 1010 Cash on hand, 1020 Operating Bank Account, 5030 Cloud infrastructure & software and 2010 Accounts Payable, and an open FY 2026-27.
- **Done when:** A contra is posted after approval and a journal is saved as a draft; both are in Day Book, and only the posted one is in the ledger.
- **Docs:** `operations/accountant-workflows`, `accounting/vouchers-and-day-book`, `accounting/alerx-chart-of-accounts`

| # | Step | Screen | Highlights | Role | Completes on | What changes in the books |
|---|---|---|---|---|---|---|
| 1 | Pick the voucher type | `/vouchers/contra` | `voucher-types` | any | visit `/vouchers/contra` | Read only |
| 2 | Enter a contra | `/vouchers/contra` | `voucher-lines` | Accountant | `journal.submitted` | The contra waits for approval. Once posted, cash rises and the bank falls by ₹15,000; total assets do not change. |
| 3 | Enter a journal and watch the balance check | `/vouchers/journal` | `voucher-balance` | Accountant | `journal.created` | A draft journal is saved. Drafts never reach the ledger or reports. |
| 4 | Approve the contra as CFO | `/approvals` | `approvals-approve` | CFO | `journal.posted` as CFO | Dr 1010 Cash on hand ₹15,000; Cr 1020 Operating Bank Account ₹15,000. The journal stays a draft because it was never submitted. |
| 5 | Find both in Day Book | `/day-book` | `day-book-filters` | any | visit `/day-book` | Read only |
| 6 | Read the ledger | `/reports/general-ledger` | `general-ledger-account` | any | visit `/reports/general-ledger` | Read only |

## WF-05 Adjust stock (`wf-05-inventory`)

Check an item's stock and FIFO value, record a stock adjustment, get its journal approved and see the movement.

- **Category:** Inventory & banking · **Difficulty:** intermediate · **Time:** 10 min · **Minimum plan:** PRO
- **Roles:** Accountant (primary); CFO, Admin (supporting)
- **Modules:** masters, inventory, approvals, reports
- **Companies:** aster-trading, urbannest-retail, meridian-retail; Start opens **aster-trading** at `/masters/products-services`
- **Industry note:** Northstar Consulting sells services only, so it has no tracked stock. Use Aster Trading, or in Northstar look at the services in Stock & services instead.
- **Starting data:** Tracked goods Industrial MCB Panel 63A (35 on hand) and Armoured Copper Cable (15 coils) at Bhiwandi Main Hub, valued at FIFO from their purchase and sales movements. Meridian Retail adds a second warehouse (Enterprise).
- **Done when:** The adjustment appears in the item's stock ledger, quantity and FIFO value fell, and its journal is posted.
- **Docs:** `operations/accountant-workflows`, `operations/inventory-and-multi-warehouse`

| # | Step | Screen | Highlights | Role | Completes on | What changes in the books |
|---|---|---|---|---|---|---|
| 1 | Find the tracked items | `/masters/products-services` | `products-new` | any | visit `/masters/products-services` | Read only |
| 2 | Check stock and value | `/inventory` | `inventory-tabs` | any | visit `/inventory` | Read only |
| 3 | Record a stock adjustment | `/inventory` | `inventory-adjust-form` | Accountant | `stock.adjusted` | Stock falls by 2 panels at their FIFO cost. The adjustment's journal (Dr 5015 Inventory adjustment; Cr 1050 Inventory) is submitted for approval because an accountant made it. |
| 4 | Approve the stock adjustment journal as CFO | `/approvals` | `approvals-approve` | CFO | `journal.posted` as CFO | The write-off posts: Inventory falls and Inventory adjustment expense rises by the FIFO cost. |
| 5 | See the stock movement | `/inventory` | `inventory-tabs` | any | visit `/inventory` | Read only |
| 6 | See the valuation in the balance sheet | `/reports/balance-sheet` | `balance-sheet-status` | any | visit `/reports/balance-sheet` | Read only |

## WF-06 Reconcile the bank (`wf-06-bank-reconciliation`)

Load a bank statement, confirm matches, deal with what's unmatched and complete the reconciliation.

- **Category:** Inventory & banking · **Difficulty:** advanced · **Time:** 15 min · **Minimum plan:** PRO
- **Roles:** Accountant (primary); CFO, Admin (supporting)
- **Modules:** banking, vouchers, reports
- **Companies:** aster-trading, northstar-consulting, urbannest-retail, meridian-retail; Start opens **aster-trading** at `/banking/reconciliation`
- **Starting data:** Ledger 1020 Operating Bank Account with posted receipts and payments, a completed reconciliation for 31 Oct 2026, and the demo's bank statement for 1 October to 10 November 2026 (demo-bank-statement-oct-nov-2026.csv). The statement also holds bank charges and a customer part payment that are not in the books yet.
- **Done when:** At least one statement line is matched and a reconciliation is completed for the statement date, with any difference recorded.
- **Docs:** `operations/accountant-workflows`, `operations/banking-and-marketplace-recon`

| # | Step | Screen | Highlights | Role | Completes on | What changes in the books |
|---|---|---|---|---|---|---|
| 1 | Choose the bank account | `/banking/reconciliation` | `recon-controls` | any | visit `/banking/reconciliation` | Read only |
| 2 | Load the statement and confirm a match | `/banking/reconciliation` | `recon-statement` | any | `bank.matched` | The statement line is tied to its ledger line. No journal is created. |
| 3 | Resolve an unmatched line | `/banking/reconciliation` | `recon-tabs` | Accountant | `journal.submitted` | A voucher for the missing bank entry waits for approval; once posted it reduces 1020 Operating Bank Account. |
| 4 | Complete the reconciliation | `/banking/reconciliation` | `recon-complete` | any | `bank.reconciled` | A completed reconciliation is saved for that date and can't be changed afterwards. The ledger does not change. |
| 5 | Check status and balances | `/banking/reconciliation` | `recon-history` | any | visit `/banking/reconciliation` | Read only |
| 6 | Compare with the bank ledger | `/reports/general-ledger` | `general-ledger-account` | any | visit `/reports/general-ledger` | Read only |

## WF-07 Set up a company (`wf-07-onboard-company`)

Check company and GST details, the financial year and approval controls, then add the first ledger, party and item.

- **Category:** Business administration · **Difficulty:** starter · **Time:** 12 min · **Minimum plan:** GO
- **Roles:** Admin (primary); Owner (supporting)
- **Modules:** settings, masters
- **Companies:** aster-trading, northstar-consulting, urbannest-retail, meridian-retail; Start opens **aster-trading** at `/settings`
- **Starting data:** The company's profile (GSTIN, state, address, bank and UPI), FY 2026-27 and the standard chart of accounts.
- **Done when:** The company profile is saved and a ledger, a customer and an item have been added.
- **Docs:** `getting-started/admin-workflows`, `accounting/alerx-chart-of-accounts`

| # | Step | Screen | Highlights | Role | Completes on | What changes in the books |
|---|---|---|---|---|---|---|
| 1 | Review the company profile | `/settings` | `settings-company-profile` | any | visit `/settings` | Read only |
| 2 | Confirm GST details and save | `/settings` | `settings-operating-mode` | Admin | `settings.updated` | The company profile is updated. No ledger change. |
| 3 | Check the financial year | `/settings` | `settings-fiscal-periods` | any | visit `/settings` | Read only |
| 4 | Check approval controls | `/settings` | `settings-approvals` | any | visit `/settings` | Read only |
| 5 | Add a ledger account | `/masters/chart-of-accounts` | `coa-add-account` | Admin | `account.created` | A new ledger with a zero balance, available on vouchers. |
| 6 | Add a customer | `/masters/parties` | `parties-new` | Admin | `party.created` | A new customer, ready to invoice. No ledger change until you invoice it. |
| 7 | Add an item or service | `/masters/products-services` | `products-new` | Admin | `item.created` | A new catalogue item that fills invoice lines. |
| 8 | Check the company is ready | `/gateway` | `gateway-company` | any | visit `/gateway` | Read only |

## WF-08 Set up the team (`wf-08-team`)

Review members, invite someone with one of the 7 roles and preview what that role can do.

- **Category:** Business administration · **Difficulty:** starter · **Time:** 8 min · **Minimum plan:** ENTERPRISE
- **Roles:** Admin (primary); Owner, CFO (supporting)
- **Modules:** team
- **Companies:** aster-trading, northstar-consulting, urbannest-retail, meridian-retail; Start opens **aster-trading** at `/departments-members`
- **Starting data:** Seven members, one for each role, and a pending Viewer invitation: 8 seats in use, more than PRO's 5, so a new invitation needs Enterprise.
- **Done when:** A pending invitation with one of the 7 roles is listed and that role's access has been previewed.
- **Docs:** `getting-started/admin-workflows`, `roles-and-governance/seven-roles-and-maker-checker`, `plans-and-utilisation/go-pro-enterprise-entitlements`

| # | Step | Screen | Highlights | Role | Completes on | What changes in the books |
|---|---|---|---|---|---|---|
| 1 | Review the team | `/departments-members` | `members-tabs` | any | visit `/departments-members` | Read only |
| 2 | Invite a member | `/departments-members` | `members-invite-form` | Admin | `member.invited` | A pending invitation that uses one seat. No ledger change. |
| 3 | Read what each role can do | `/departments-members` | `members-roles` | any | visit `/departments-members` | Read only |
| 4 | Preview the Analyst's access | `/departments-members` | `demo-control-bar` | any | `role.switched` {"role":"analyst"} | Read only |
| 5 | Open FP&A as Analyst | `/reports/fpa` | `fpa-margins` | Analyst | visit `/reports/fpa` | Read only |
| 6 | Switch back to Admin | `/departments-members` | `demo-control-bar` | any | `role.switched` {"role":"admin"} | Read only |

## WF-09 Review financial performance (`wf-09-financial-performance`)

Read the Trial Balance, P&L, Balance Sheet and Cash Flow, compare margins and trace a figure to its ledger.

- **Category:** Financial management · **Difficulty:** intermediate · **Time:** 12 min · **Minimum plan:** PRO
- **Roles:** CFO (primary); Owner, Analyst (supporting)
- **Modules:** reports, fpa
- **Companies:** aster-trading, northstar-consulting, urbannest-retail, meridian-retail; Start opens **aster-trading** at `/reports/trial-balance`
- **Starting data:** Posted vouchers for October and November 2026. Anything you posted in earlier workflows is included.
- **Done when:** The four statements were read and one P&L figure was traced to its ledger lines.
- **Docs:** `financial-intelligence/cfo-workflows`, `financial-intelligence/reports-fpa-and-deku-konsultant`, `accounting/vouchers-and-day-book`

| # | Step | Screen | Highlights | Role | Completes on | What changes in the books |
|---|---|---|---|---|---|---|
| 1 | Start with the Trial Balance | `/reports/trial-balance` | `trial-balance-table` | any | visit `/reports/trial-balance` | Read only |
| 2 | Read the P&L | `/reports/profit-loss` | `profit-loss-summary` | any | visit `/reports/profit-loss` | Read only |
| 3 | Read the Balance Sheet | `/reports/balance-sheet` | `balance-sheet-status` | any | visit `/reports/balance-sheet` | Read only |
| 4 | Read the Cash Flow | `/reports/cash-flow` | `cash-flow-period` | any | visit `/reports/cash-flow` | Read only |
| 5 | Compare margins | `/reports/fpa` | `fpa-margins` | any | visit `/reports/fpa` | Read only |
| 6 | Trace a figure to its ledger | `/reports/general-ledger` | `general-ledger-account` | any | visit `/reports/general-ledger` | Read only |

## WF-10 Manage working capital (`wf-10-working-capital`)

Read receivables and payables, DSO and DPO, and their effect on cash.

- **Category:** Financial management · **Difficulty:** intermediate · **Time:** 10 min · **Minimum plan:** PRO
- **Roles:** CFO (primary); Owner, Analyst (supporting)
- **Modules:** reports, fpa
- **Companies:** aster-trading, northstar-consulting, urbannest-retail, meridian-retail; Start opens **aster-trading** at `/reports/debtors`
- **Starting data:** Open receivable AST/26-27/002 (Kaveri Infra, ₹4,72,000, due 17 Nov 2026) and Deccan Cables' unpaid ₹5,03,600, unless you settled them in WF-03.
- **Done when:** Receivables, payables, DSO, DPO and their cash-flow effect were reviewed from the same posted books.
- **Docs:** `financial-intelligence/cfo-workflows`, `financial-intelligence/reports-fpa-and-deku-konsultant`, `operations/sales-invoicing-and-collections`

| # | Step | Screen | Highlights | Role | Completes on | What changes in the books |
|---|---|---|---|---|---|---|
| 1 | Read receivables and DSO | `/reports/debtors` | `debtors-summary` | any | visit `/reports/debtors` | Read only |
| 2 | See which customers owe | `/collect` | `collect-status-tabs` | any | visit `/collect` | Read only |
| 3 | Read payables and DPO | `/reports/creditors` | `creditors-summary` | any | visit `/reports/creditors` | Read only |
| 4 | Put DSO and DPO together | `/reports/fpa` | `fpa-working-capital` | any | visit `/reports/fpa` | Read only |
| 5 | See the effect on cash | `/reports/cash-flow` | `cash-flow-period` | any | visit `/reports/cash-flow` | Read only |

## WF-11 Track department budgets (`wf-11-budgets`)

Compare each department's budget with what it has used, add a department, and read the spending behind it.

- **Category:** Financial management · **Difficulty:** intermediate · **Time:** 10 min · **Minimum plan:** PRO
- **Roles:** CFO (primary); Admin, Owner (supporting)
- **Modules:** fpa, team, reports
- **Companies:** aster-trading, northstar-consulting, urbannest-retail, meridian-retail; Start opens **aster-trading** at `/reports/fpa`
- **Starting data:** Five departments (Finance, Sales, Procurement, Treasury, People) with annual budgets and amounts used.
- **Done when:** Budget against actual was read for every department, a department with a budget was added, and actual spending was reviewed.
- **Docs:** `financial-intelligence/cfo-workflows`, `financial-intelligence/reports-fpa-and-deku-konsultant`

| # | Step | Screen | Highlights | Role | Completes on | What changes in the books |
|---|---|---|---|---|---|---|
| 1 | Read budget against actual | `/reports/fpa` | `fpa-budgets` | any | visit `/reports/fpa` | Read only |
| 2 | Open the departments | `/departments-members` | `members-tabs` | any | visit `/departments-members` | Read only |
| 3 | Add a department with a budget | `/departments-members` | `departments-form` | Admin | `department.updated` | A new department with an annual budget and nothing used yet. No ledger change. |
| 4 | Spot the deviations | `/reports/fpa` | `fpa-budgets` | CFO | visit `/reports/fpa` | Read only |
| 5 | Read the spending behind it | `/reports/operating-expenses` | `opex-summary` | any | visit `/reports/operating-expenses` | Read only |

## WF-12 Check business health (`wf-12-business-health`)

See the company's position, revenue, receivables and cash, and what is waiting for attention.

- **Category:** Financial management · **Difficulty:** starter · **Time:** 8 min · **Minimum plan:** GO
- **Roles:** Owner (primary); CFO, Viewer (supporting)
- **Modules:** executive, reports, approvals
- **Companies:** aster-trading, northstar-consulting, urbannest-retail, meridian-retail; Start opens **aster-trading** at `/gateway`
- **Starting data:** The company's posted books and the seeded voucher PAY-2026-0003 waiting for approval.
- **Done when:** Position, revenue and expenses, receivables, cash and pending exceptions were reviewed, with the Balance Sheet behind them.
- **Docs:** `financial-intelligence/owner-workflows`, `financial-intelligence/reports-fpa-and-deku-konsultant`

| # | Step | Screen | Highlights | Role | Completes on | What changes in the books |
|---|---|---|---|---|---|---|
| 1 | Start at the Gateway | `/gateway` | `gateway-kpis` | any | visit `/gateway` | Read only |
| 2 | Read the executive summary | `/executive` | `executive-kpis` | any | visit `/executive` | Read only |
| 3 | Check balance health | `/executive` | `executive-balance-health` | any | visit `/executive` | Read only |
| 4 | Revenue and expenses | `/reports/profit-loss` | `profit-loss-summary` | any | visit `/reports/profit-loss` | Read only |
| 5 | Receivables | `/reports/debtors` | `debtors-summary` | any | visit `/reports/debtors` | Read only |
| 6 | Cash | `/reports/cash-flow` | `cash-flow-period` | any | visit `/reports/cash-flow` | Read only |
| 7 | See what is waiting | `/approvals` | `approvals-queue` | any | visit `/approvals` | Read only |
| 8 | The supporting statement | `/reports/balance-sheet` | `balance-sheet-status` | any | visit `/reports/balance-sheet` | Read only |

## WF-13 Follow the business's transactions (`wf-13-business-transactions`)

Walk from sales and purchases to collections and obligations, the accounting records behind them, and the result.

- **Category:** Financial management · **Difficulty:** starter · **Time:** 10 min · **Minimum plan:** GO
- **Roles:** Owner (primary); CFO (supporting)
- **Modules:** sales, purchases, reports, day-book
- **Companies:** aster-trading, northstar-consulting, urbannest-retail, meridian-retail; Start opens **aster-trading** at `/gst`
- **Starting data:** Seeded invoices, purchase bills and vouchers, plus anything you added in earlier workflows.
- **Done when:** Sales, purchases, collections and obligations were followed to their Day Book vouchers and the P&L.
- **Docs:** `financial-intelligence/owner-workflows`, `operations/sales-invoicing-and-collections`, `accounting/vouchers-and-day-book`

| # | Step | Screen | Highlights | Role | Completes on | What changes in the books |
|---|---|---|---|---|---|---|
| 1 | Sales | `/gst` | `gst-tabs` | any | visit `/gst` | Read only |
| 2 | Purchases | `/purchases` | `purchases-tabs` | any | visit `/purchases` | Read only |
| 3 | Collections | `/collect` | `collect-status-tabs` | any | visit `/collect` | Read only |
| 4 | Obligations | `/reports/creditors` | `creditors-summary` | any | visit `/reports/creditors` | Read only |
| 5 | The accounting records | `/day-book` | `day-book-register` | any | visit `/day-book` | Read only |
| 6 | The result | `/reports/profit-loss` | `profit-loss-summary` | any | visit `/reports/profit-loss` | Read only |

## WF-14 Analyse revenue and expenses (`wf-14-revenue-expense`)

Pick a period, break down revenue and expense ledgers, compare periods and find what drives the margin.

- **Category:** Financial management · **Difficulty:** intermediate · **Time:** 12 min · **Minimum plan:** PRO
- **Roles:** Analyst (primary); CFO (supporting)
- **Modules:** reports, fpa, day-book
- **Companies:** aster-trading, northstar-consulting, urbannest-retail, meridian-retail; Start opens **aster-trading** at `/reports/profit-loss`
- **Starting data:** Posted revenue and expenses for October and November 2026.
- **Done when:** Revenue and expenses were broken down for one period, compared with another, and traced to the vouchers behind them.
- **Docs:** `financial-intelligence/analyst-workflows`, `financial-intelligence/reports-fpa-and-deku-konsultant`

| # | Step | Screen | Highlights | Role | Completes on | What changes in the books |
|---|---|---|---|---|---|---|
| 1 | Choose a period | `/reports/profit-loss` | `profit-loss-summary` | any | visit `/reports/profit-loss` | Read only |
| 2 | Break down revenue | `/reports/general-ledger` | `general-ledger-account` | any | visit `/reports/general-ledger` | Read only |
| 3 | Break down expenses | `/reports/operating-expenses` | `opex-summary` | any | visit `/reports/operating-expenses` | Read only |
| 4 | Compare periods | `/reports/profit-loss` | `profit-loss-summary` | any | visit `/reports/profit-loss` | Read only |
| 5 | Find what drives the margin | `/reports/fpa` | `fpa-margins` | any | visit `/reports/fpa` | Read only |
| 6 | Check the supporting vouchers | `/day-book` | `day-book-search` | any | visit `/day-book` | Read only |

## WF-15 Ask Deku Consultant (`wf-15-consultant`)

Ask a question about the company, then check the answer against the reports and ledger it came from.

- **Category:** Financial management · **Difficulty:** starter · **Time:** 6 min · **Minimum plan:** PRO
- **Roles:** Analyst (primary); Owner, CFO (supporting)
- **Modules:** consultant, reports
- **Companies:** aster-trading, northstar-consulting, urbannest-retail, meridian-retail; Start opens **aster-trading** at `/consultant`
- **Starting data:** The company's posted ledger balances. Answers are computed from them in this browser; no external AI is called.
- **Done when:** A question was answered from the demo books and its figures were checked against the P&L and Trial Balance.
- **Docs:** `financial-intelligence/analyst-workflows`, `financial-intelligence/reports-fpa-and-deku-konsultant`

| # | Step | Screen | Highlights | Role | Completes on | What changes in the books |
|---|---|---|---|---|---|---|
| 1 | Open Deku Consultant | `/consultant` | `consultant-prompts` | any | visit `/consultant` | Read only |
| 2 | Ask a question | `/consultant` | `consultant-composer` | any | `consultant.asked` | Nothing changes in the books; the answer is read from them. |
| 3 | Check the figures | `/reports/profit-loss` | `profit-loss-summary` | any | visit `/reports/profit-loss` | Read only |
| 4 | See the source data | `/reports/trial-balance` | `trial-balance-table` | any | visit `/reports/trial-balance` | Read only |

## WF-16 Trace a transaction (`wf-16-trace-transaction`)

Follow an invoice to its voucher, approval trail, ledger postings and audit history, and back to its source.

- **Category:** Audit & compliance · **Difficulty:** intermediate · **Time:** 10 min · **Minimum plan:** PRO
- **Roles:** Auditor (primary); CFO, Owner (supporting)
- **Modules:** sales, day-book, reports, audit
- **Companies:** aster-trading, northstar-consulting, urbannest-retail, meridian-retail; Start opens **aster-trading** at `/gst`
- **Starting data:** The invoice you issued in WF-01, otherwise the seeded AST/26-27/002 to Kaveri Infra (its voucher is JRN-AST/26-27/002).
- **Done when:** The invoice was followed to its voucher, approval trail and ledger posting, back to its source, and to the audit log.
- **Docs:** `roles-and-governance/auditor-workflows`, `accounting/vouchers-and-day-book`, `roles-and-governance/seven-roles-and-maker-checker`

| # | Step | Screen | Highlights | Role | Completes on | What changes in the books |
|---|---|---|---|---|---|---|
| 1 | Start from the invoice | `/gst` | `gst-tabs` | any | visit `/gst` | Read only |
| 2 | Find its voucher | `/day-book` | `day-book-search` | any | visit `/day-book` | Read only |
| 3 | Read the voucher and its approval trail | `/day-book` | `voucher-drawer-trail` | any | visit `/day-book` | Read only |
| 4 | Find the ledger posting | `/reports/general-ledger` | `general-ledger-account` | any | visit `/reports/general-ledger` | Read only |
| 5 | Go back to the source | `/day-book` | `voucher-drawer-invoice` | any | visit `/gst` | Read only |
| 6 | Read the audit history | `/audit` | `audit-filters` | any | visit `/audit` | Read only |

## WF-17 Check accounting integrity (`wf-17-accounting-integrity`)

A read-only review: Day Book, debit-credit balance, pending items, reversals, audit history, bank reconciliation and GST.

- **Category:** Audit & compliance · **Difficulty:** advanced · **Time:** 12 min · **Minimum plan:** PRO
- **Roles:** Auditor (primary); CFO, Owner (supporting)
- **Modules:** day-book, reports, approvals, audit, banking, gst
- **Companies:** aster-trading, northstar-consulting, urbannest-retail, meridian-retail; Start opens **aster-trading** at `/day-book`
- **Starting data:** Seeded posted vouchers, the pending PAY-2026-0003, a completed reconciliation for 31 Oct 2026, and the company's invoices and bills.
- **Done when:** Day Book, Trial Balance parity, pending items, reversals, the audit log, bank reconciliation and GST were reviewed without changing anything.
- **Docs:** `roles-and-governance/auditor-workflows`, `gst-compliance/gst-pos-itc-and-returns`, `operations/banking-and-marketplace-recon`

| # | Step | Screen | Highlights | Role | Completes on | What changes in the books |
|---|---|---|---|---|---|---|
| 1 | Review Day Book | `/day-book` | `day-book-filters` | any | visit `/day-book` | Read only |
| 2 | Check debits equal credits | `/reports/trial-balance` | `trial-balance-table` | any | visit `/reports/trial-balance` | Read only |
| 3 | Look at what is pending | `/approvals` | `approvals-queue` | any | visit `/approvals` | Read only |
| 4 | Look for reversals | `/day-book` | `day-book-filters` | any | visit `/day-book` | Read only |
| 5 | Read the audit history | `/audit` | `audit-filters` | any | visit `/audit` | Read only |
| 6 | Check the bank reconciliation | `/banking/reconciliation` | `recon-history` | any | visit `/banking/reconciliation` | Read only |
| 7 | Check GST and ITC | `/gst/returns` | `gst-return-card` | any | visit `/gst/returns` | Read only |

## WF-18 Business-to-close cycle (`wf-18-close-cycle`)

One company, one set of records: Admin sets up and issues, Accountant invoices and collects, CFO approves and reviews, Analyst, Auditor and Owner follow it through.

- **Category:** Complete business workflow · **Difficulty:** advanced · **Time:** 25 min · **Minimum plan:** PRO
- **Roles:** Admin (primary); Accountant, CFO, Analyst, Auditor, Owner (supporting)
- **Modules:** settings, masters, sales, vouchers, approvals, reports, fpa, day-book, audit, executive
- **Companies:** aster-trading, northstar-consulting, urbannest-retail, meridian-retail; Start opens **aster-trading** at `/settings`
- **Starting data:** The company's profile, chart of accounts, catalogue, bank ledger and open FY 2026-27. Everything else is created in the workflow.
- **Done when:** In one company, the customer Admin added was invoiced and paid, the CFO approved the receipt, and the same records appear in the statements, FP&A, the audit trail and the owner's summary.
- **Docs:** `getting-started/business-to-close-cycle`, `roles-and-governance/seven-roles-and-maker-checker`, `accounting/vouchers-and-day-book`

| # | Step | Screen | Highlights | Role | Completes on | What changes in the books |
|---|---|---|---|---|---|---|
| 1 | Admin: confirm the company | `/settings` | `settings-company-profile` | Admin | `settings.updated` as Admin | Company profile saved. No ledger change. |
| 2 | Admin: add the customer | `/masters/parties` | `parties-new` | Admin | `party.created` as Admin | A new customer with no balance. |
| 3 | Accountant: create the invoice | `/gst` | `gst-tabs` | Accountant | `invoice.created` as Accountant | A draft invoice; nothing posted yet. |
| 4 | Admin: issue it | `/gst` | `invoice-issue` | Admin | `invoice.issued` as Admin | Dr 1030 Accounts Receivable; Cr 4010 Sales revenue (products) and Output GST. |
| 5 | Accountant: record the customer's payment | `/vouchers/receipt` | `voucher-settle-invoice` | Accountant | `journal.submitted` as Accountant | The receipt waits for approval. |
| 6 | Approve the receipt as CFO | `/approvals` | `approvals-approve` | CFO | `journal.posted` as CFO | Dr 1020 Operating Bank Account; Cr 1030 Accounts Receivable. The invoice is paid and the books update. |
| 7 | CFO: review the P&L | `/reports/profit-loss` | `profit-loss-summary` | CFO | visit `/reports/profit-loss` | Read only |
| 8 | CFO: review the Balance Sheet | `/reports/balance-sheet` | `balance-sheet-status` | CFO | visit `/reports/balance-sheet` | Read only |
| 9 | Analyst: revenue and working capital | `/reports/fpa` | `fpa-working-capital` | Analyst | visit `/reports/fpa` | Read only |
| 10 | Auditor: trace the invoice | `/day-book` | `voucher-drawer-trail` | Auditor | visit `/day-book` | Read only |
| 11 | Auditor: read the audit log | `/audit` | `audit-filters` | Auditor | visit `/audit` | Read only |
| 12 | Owner: review the position | `/executive` | `executive-kpis` | Owner | visit `/executive` | Read only |
