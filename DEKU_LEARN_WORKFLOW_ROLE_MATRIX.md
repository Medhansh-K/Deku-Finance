# Deku Learn workflow role matrix

Which of the 7 roles can do each of the 18 workflows, and the real rule behind it. The rules are the database's (`has_role` checks in `supabase/migrations`), which the demo engine copies in `lib/learn/engine/rbac.ts` and must never loosen.

## Legend

- **P** primary: the role the workflow is written for; Start opens it in this role.
- **S** supporting: the workflow switches to this role for one or more steps.
- **R** read along: the role can open every screen in the workflow but its action steps are refused for it (it can still follow the read steps).
- **B** blocked: the workflow's main action is refused for this role, so it can't be completed in it.
- For read-only workflows every member can read (RLS `is_org_member`), so the other roles are **R**.

## Matrix

| Workflow | Owner | CFO | Admin | Accountant | Analyst | Auditor | Viewer |
|---|---|---|---|---|---|---|---|
| WF-01 Sales invoice | S | B | S | P | B | B | B |
| WF-02 Purchase bill | R | S | R | P | B | B | B |
| WF-03 Receipts and payments | R | S | R | P | B | B | B |
| WF-04 Vouchers | R | S | R | P | B | B | B |
| WF-05 Stock adjustment | R | S | R | P | B | B | B |
| WF-06 Bank reconciliation | R | S | R | P | B | B | B |
| WF-07 Set up a company | S | B | P | B | B | B | B |
| WF-08 Set up the team | S | S | P | B | B | B | B |
| WF-09 Financial performance | S | P | R | R | S | R | R |
| WF-10 Working capital | S | P | R | R | S | R | R |
| WF-11 Department budgets | S | P | S | R | R | R | R |
| WF-12 Business health | P | S | R | R | R | R | S |
| WF-13 Business transactions | P | S | R | R | R | R | R |
| WF-14 Revenue and expenses | R | S | R | R | P | R | R |
| WF-15 Deku Consultant | S | S | R | R | P | R | R |
| WF-16 Trace a transaction | S | S | R | R | R | P | R |
| WF-17 Accounting integrity | S | S | R | R | R | P | R |
| WF-18 Business-to-close cycle | S | S | P | S | S | S | B |

"R" for Owner and Admin on WF-02 to WF-06 means they *may* do every step except approving their own voucher; the workflow is written for the accountant as maker so the checker step can be done by someone else.

## The rules behind each action step

| Action | Allowed roles | Source |
|---|---|---|
| Save a draft sales invoice | Owner, Admin, Accountant | RLS `sales_invoices_insert_draft`, mig 7 |
| Issue (or cancel) a sales invoice | Owner, Admin | `issue_sales_invoice` allows Owner, Admin, Accountant (mig 41) but posts its journal through `post_journal_entry` (Owner, CFO, Admin, mig 20); the intersection applies |
| Save a purchase bill | Owner, CFO, Admin, Accountant | `purchase_bills` policies, mig 24 |
| Save a draft voucher | Owner, Admin, Accountant | journal draft insert, mig 5 and 55 |
| Submit a voucher for approval | Owner, CFO, Admin, Accountant | `submit_journal_for_approval`, mig 20 |
| Approve and post, or send back | Owner, CFO, Admin, and never the voucher's maker or submitter | `post_journal_entry`, `reject_journal_entry`, mig 20 |
| Reverse a posted voucher | Owner, Admin | `reverse_journal_entry` (Owner, Admin, Accountant) ∩ `post_journal_entry` |
| Stock adjustment | Owner, Admin, Accountant; its journal posts at once for Owner/Admin, otherwise waits for approval | `record_stock_adjustment`, mig 42 |
| Match a statement line, complete a reconciliation | Owner, CFO, Admin, Accountant | `bank_reconciliations` (mig 19, 52), `reconciliation_statements` (mig 56) |
| Company settings | Owner, Admin | `organisations_update_admins`, mig 2 |
| Ledger accounts, parties, catalogue items | Owner, Admin, Accountant | mig 3, 4, 5 |
| Invite a member | Owner, CFO, Admin; seats permitting | `invite_user_to_organisation`, mig 16 and 49 |
| Change a member's role | Owner, Admin; only the Owner grants Owner | `protect_membership_changes`, mig 41 |
| Add or change a department | Owner, Admin | `departments` policies, mig 13 |
| Ask Deku Consultant | any member | `backend/src/routes/consultant.rs` (no role check) |
| Read reports, Day Book, invoices, bills | any member | `is_org_member` select policies |
| Read `audit_events` | Owner, Admin, Accountant | `audit_events_select`, mig 9 |

## Findings the matrix exposes

1. **Accountants cannot issue invoices in the real database.** The app's own role summary (`lib/learn/demo-roles.ts`, `DEMO_ROLES`) lists `issue_invoice` for Accountant and CFO, which is looser than the SQL. The engine's `rbac.ts` follows the SQL; the role cards in `demo-roles.ts` should be corrected by whoever owns them so the demo never tells a visitor they can do something the product refuses. WF-01 and WF-18 have the Accountant prepare the invoice and the Admin issue it.
2. **The CFO cannot save a draft voucher or a sales invoice** (mig 5, 7), even though `DEMO_ROLES` gives CFO `create_draft`. No workflow asks the CFO to make one.
3. **Auditors cannot read `audit_events`** (mig 9). In production the audit log shows an Auditor the user activity log only. WF-16 and WF-17 read the log as Auditor and claim nothing more. This is a product gap worth fixing in SQL (add `auditor` to `audit_events_select`), not something the demo should paper over.
4. **Seats:** each demo company has 7 members and one pending invitation. GO allows 2 seats and PRO 5, so WF-08 needs Enterprise; GO also offers only the Admin and Accountant seats, so every workflow with a CFO, Analyst or Auditor step is PRO or higher.
5. **Maker-checker in the demo needs per-role user ids.** See the audit (WF-18): with one shared demo user id, the self-approval check in `ApprovalsView` cannot tell the accountant from the CFO.

## Minimum plan per workflow

| Plan | Workflows | Why |
|---|---|---|
| GO | WF-01, WF-07, WF-12, WF-13 | Owner, Admin and Accountant only; no approval step |
| PRO | WF-02 to WF-06, WF-09 to WF-11, WF-14 to WF-18 | CFO, Analyst or Auditor role; maker-checker; ITC tracking; bank reconciliation and inventory (PRO in `DEMO_PLAN_FEATURES`) |
| Enterprise | WF-08 | the companies' 8 used seats exceed PRO's 5 |
