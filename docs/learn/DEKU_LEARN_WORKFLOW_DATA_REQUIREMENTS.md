# Deku Learn workflow data requirements

What each workflow needs in a demo company's books before it starts, whether each of the four companies has it, and what the demo engine must provide. Checked against `apps/platform/src/lib/learn/sample-data.ts` as the engine agent rewrote it on 11 Nov 2026 (the seed was being changed while this was written; re-check the ✓ marks if it changes again).

All four companies are fictional, GST registered, on FY 2026-27 (open), with maker-checker approval switched on and the same seven people holding the seven roles.

## Seed at a glance

| | Aster Trading Co. | Northstar Consulting | UrbanNest Retail | Meridian Retail |
|---|---|---|---|---|
| Business | Wholesale goods, Maharashtra | Services, Karnataka | D2C goods, Delhi | Retail goods, 2 warehouses, Maharashtra |
| Open customer invoice | AST/26-27/002, Kaveri Infra, ₹4,72,000, due 17 Nov | NSC/26-27/012, Apex Cloud (inter-state IGST) | UN/26-27/103, Casa Verde, due 4 Dec | MR/26-27/201, Westside Metro, part collected, credit note CN/26-27/004 |
| Open supplier balance | Deccan Cables, DC-INV-908, ₹5,03,600 after part payment | Indiranagar CoWork, ICW/26-27/402, unpaid | Jaipur Homecrafts, JH-4410, after part payment | Sahyadri Supply, SS-2627-881, after part payment |
| Tracked stock | 2 items, Bhiwandi Main Hub | none (services) | 2 items, Okhla Fulfilment Centre | 2 items across Mumbai Central and Pune Chakan |
| Voucher waiting for approval | PAY-2026-0003 (calibration fee) | none | none | none |
| Bank statement for reconciliation | Oct to 10 Nov, with bank charges and a Kaveri part payment not in the books | with account charges and an Apex part payment | with gateway charges and an unidentified credit | with card machine rental and a Westside part payment |
| Completed reconciliation | 31 Oct 2026 | 31 Oct 2026 | 31 Oct 2026 | 31 Oct 2026 |
| Departments with budgets | 5 (Procurement over budget) | 5 | 5 | 5 |
| Members / pending invitations | 7 / 1 | 7 / 1 | 7 / 1 | 7 / 1 |
| Payroll | no | October run posted | no | no |
| Marketplace settlement | no | no | yes (posted) | no |
| Reversed voucher | none | none | none | none |

## Per workflow

✓ has what the workflow needs · ◐ works with a note · ✗ does not fit (the card's industry note says what to do)

| Workflow | Needs | Aster | Northstar | UrbanNest | Meridian |
|---|---|---|---|---|---|
| WF-01 Sales invoice | a customer, a catalogue item with HSN/SAC and GST rate, the company GSTIN and state, an open period | ✓ | ✓ services (SAC), inter-state customer shows IGST | ✓ | ✓ |
| WF-02 Purchase bill | a GST-registered supplier, Inventory 1050, Input GST 1081-1083, Accounts Payable 2010 | ✓ | ◐ bills are expenses (debit 5040/5030, not Inventory) | ✓ | ✓ |
| WF-03 Receipts and payments | an issued, unpaid invoice (or WF-01's), a supplier with an open balance, bank ledger 1020 | ✓ | ✓ | ✓ | ✓ |
| WF-04 Vouchers | 1010 Cash on hand, 1020 bank, 5030 and 2010 ledgers | ✓ | ✓ | ✓ | ✓ |
| WF-05 Stock adjustment | a tracked goods item with stock on hand and FIFO layers, Inventory 1050 and Inventory adjustment 5015 | ✓ | ✗ services only | ✓ | ✓ (two warehouses; Enterprise view) |
| WF-06 Bank reconciliation | posted bank lines with line ids, a statement whose lines match them plus some that don't | ✓ | ✓ | ✓ | ✓ |
| WF-07 Set up a company | a company profile, a fiscal period, the chart | ✓ | ✓ | ✓ | ✓ |
| WF-08 Set up the team | members, departments; Enterprise for a free seat | ✓ | ✓ | ✓ | ✓ |
| WF-09 Financial performance | posted revenue, expenses, assets and liabilities in two months | ✓ | ✓ | ✓ | ✓ |
| WF-10 Working capital | open receivables and payables with due dates | ✓ | ✓ | ✓ | ✓ |
| WF-11 Department budgets | departments with allocated and used amounts | ✓ | ✓ | ✓ | ✓ |
| WF-12 Business health | posted books; a pending voucher for the exceptions step | ✓ | ◐ no pending voucher, the queue is empty | ◐ same | ◐ same |
| WF-13 Business transactions | invoices, bills, receipts and payments | ✓ | ✓ | ✓ | ✓ |
| WF-14 Revenue and expenses | revenue and expenses in October and November | ✓ | ✓ | ✓ | ✓ |
| WF-15 Deku Consultant | posted ledger balances | ✓ | ✓ | ✓ | ✓ |
| WF-16 Trace a transaction | an issued invoice linked to its posted voucher (`journal_entry_id`), with an approval trail | ✓ | ✓ | ✓ | ✓ |
| WF-17 Accounting integrity | posted vouchers, a pending voucher, a completed reconciliation, invoices and bills for returns | ✓ | ◐ no pending voucher | ◐ no pending voucher | ◐ no pending voucher |
| WF-18 Close cycle | as WF-07 + WF-01 + WF-03 | ✓ | ✓ | ✓ | ✓ |

Every workflow recommends Aster Trading, the only company that has everything, including the pending voucher.

## What the engine must provide

Data (in `sample-data.ts`):

1. **Journal line ids on every seeded line.** `ReconciliationView` skips book lines without an `id`, so without them nothing can be matched in WF-06. The new seed's `je()` helper appears to assign them; keep it that way.
2. **`journal_entry_id` on every issued invoice, bill and credit note**, pointing to a posted voucher. The Day Book drawer finds an invoice through it (WF-01 last step, WF-16, WF-18). The earlier seed had Northstar's NSC/26-27/012 issued with no journal; the rewrite fixes that.
3. **Invoice date equals its voucher date.** The earlier seed had AST/26-27/002 dated 20 Sep with its voucher on 2 Nov; the rewrite uses one date. Keep them equal, or GSTR-1 and the ledger disagree on the month.
4. **A downloadable demo bank statement per company** (`demoStatementCsv`), in a format `parseStatement` reads (a header row with date, narration and amount or debit/credit columns), whose lines equal posted bank lines plus a few statement-only lines. The runtime must offer it for download (see the tutorial spec).
5. **The chart the steps name:** 1010, 1020, 1030, 1050, 1081-1083, 2010, 2081-2083, 3030, 4010, 5015, 5030, 5040, 5090 as in migration 35 plus `add_inventory_accounts` (mig 42). Step text quotes these codes and names.
6. **Seat usage that blocks PRO invitations honestly** (7 members + 1 pending = 8 > 5) and leaves Enterprise unlimited. The seeded viewer invitation expires 12 Nov 2026 (`expires_at: 2026-11-12T10:00`); after that date `inviteStatus` shows it as expired and seat usage drops to 7. That is correct behaviour, but it changes the seat count a visitor sees from 12 Nov onwards; consider a later expiry.
7. **Optional:** a voucher waiting for approval in Northstar, UrbanNest and Meridian too, so WF-12 and WF-17's exception step has something to show in every company.

Behaviour (writes the workflows trigger, each recording the activity listed in the implementation audit):

8. `POST /invoices` and `/invoices/:id/issue`: issuing posts Dr 1030 / Cr 4010 and output GST (CGST+SGST same state, IGST otherwise), sets `journal_entry_id`, moves tracked stock out at FIFO; refused for Accountant and CFO.
9. `POST /purchases` (+ journal, submit, `PATCH /purchases/:id` link).
10. `POST /journals`, `/submit`, `/post`, `/reject`: drafts never in reports; post refused for the maker or submitter and for roles other than Owner, CFO, Admin; debits must equal credits; date inside an open period.
11. `POST /files`: accept the proof file in the browser, attach it to the voucher, record `document.attached`; never upload.
12. `POST /inventory/adjustments`: FIFO cost for outs, refuse an out above stock unless negative stock is allowed, journal Dr 5015 / Cr 1050 (or the reverse for an in), posted for Owner/Admin, submitted otherwise.
13. `POST /banking/reconciliations`, `DELETE /banking/reconciliations/:id`, `POST /banking/statements` (immutable once recorded).
14. `PATCH /settings`, `POST /accounts`, `/parties`, `/catalogue`, `/invitations`, `/departments`.
15. `POST /consultant/chat`: answer from the ledger and return `{ response, model_used }`, the fields the screen reads.
16. Every activity recorded with the role being previewed, and `created_by` / `submitted_by` / `posted_by` stamped with that role's member user id (`u-acc`, `u-cfo`, …) so the approval trail and maker-checker show real people.

## Reset

Reset (`demo.reset`) must restore the seed above exactly and clear the activity log; workflow progress for that company is cleared with it (`clearWorkflowState`). A workflow that relied on the visitor's own record (the WF-01 invoice in WF-03 and WF-16) then falls back to the seeded record its step text names.
