# Deku Learn Centre: final test report

Date: 11 Nov 2026. Scope: the 18 Learn Centre workflows. They run frontend-only, on the in-browser demo engine (`apps/platform/src/lib/learn/demo-api.ts` and `engine/*`), the catalogue (`lib/learn/workflows/catalogue.ts`) and the runtime (`runner.ts`, `WorkflowCoach.tsx`, `LearnDemoContext.tsx`).

Trade-off: the demo engine is a browser copy of the real accounting rules, not the database itself. It is kept faithful by tests that check it against the same rules: the SQL `has_role` table in `engine/rbac.ts`, maker-checker, balanced journals and FIFO. Nothing in this report was checked against Supabase.

## How the workflows were tested

**Engine playthrough** (`tests/learn-playthrough.test.ts`). Each workflow starts from fresh books for its recommended company, at its minimum plan. The test then plays every step the way `WorkflowCoach` does:

- It switches to the step's role when the role differs, recording `role.switched`.
- It opens the step's screen when the visitor isn't already on it, recording `route.visited`.
- For action steps, it makes the same API calls the screen makes, in the same order. Where the screens have their own helpers, the test uses them: `billPayload`, `purchaseVoucherLines`, `adjustmentPayload`, `settingsFromForm`, `parseStatement`, `matchStatement` and `summariseStatement`.

At each step, the runner's own `checkStep` must be unsatisfied before the action and satisfied after it, and `nextStep` must succeed. At the end, the workflow must be finished with every step completed and none skipped. Accounting outcomes are then asserted:

- the Trial Balance balances;
- receivables and payables move by the exact amounts;
- the ledger, stock and reconciliation results are as claimed.

Two more tests check that:

- every action step names its role, so the coach switches to it;
- the WF-01 invoice is the same one settled by the WF-03 receipt and traced through its posted journal, all in one set of books.

**Browser** (headless Chrome over CDP, on the existing dev server at http://localhost:3622). Scripts are in the session scratchpad: `wf01-browser.mjs`, `wf03-browser.mjs`, `wf06-browser.mjs` and `wf18-browser.mjs`, run with `learn-cdp.mjs`. Each one starts from `/learn/demo` with a fresh browser profile, clicks Start on the workflow card, fills the real screens and waits for the coach's status line to read "Done: …" before clicking Next.

Screenshots are in `C:\Users\Parth\AppData\Local\Temp\claude\c--Users-Parth-OneDrive-Desktop-deku\c7c1ffd0-cb5c-4f7a-8cfb-0bd10f9fa177\scratchpad\`.

## Status per workflow

| WF | Status | Evidence | Known gaps |
|---|---|---|---|
| WF-01 Sales invoice | Implemented and tested (engine playthrough + browser) | Engine test `WF-01 Create a sales invoice: every step completes…`: the Trial Balance balances, 1030 rises by ₹70,800 and the voucher links back to the invoice. **Browser:** all 7 steps. The Accountant saves AST/26-27/101; the coach switches to Admin, who issues it; "Open invoice" in the Day Book reopens the issued invoice; the run ends with "Workflow complete". Screenshots: `wf01-step2-filled.png`, `wf01-step3-running.png`, `wf01-step3-done.png`, `wf01-step7-drawer.png`, `wf01-step7-reopened.png`, `wf01-complete.png` | The invoice date defaults to the real date (the screen's behaviour). |
| WF-02 Purchase bill | Implemented and tested (engine playthrough only) | Engine test WF-02: the bill is linked to its PUR voucher, which is posted by the CFO. Deccan's payable rises by ₹1,18,000, 1083 rises by ₹18,000 and the Trial Balance balances. | The purchase screen sends no item lines, so quantities don't move; the stock step says so and points to WF-05. Two screen texts still say purchase bills move stock: the Track inventory help and the Stock summary empty state. That is true only for bills that carry lines through the API. |
| WF-03 Receipts and payments | Implemented and tested (engine playthrough + browser) | Engine test WF-03: Kaveri's receivable falls by ₹4,72,000, Deccan's payable by ₹5,03,600, and both vouchers appear in the 1020 ledger. **Browser:** all 8 steps, including settling AST/26-27/002 (RCT-2026-0002) and paying with an advice attached (PAY-2026-0004), each approved by the CFO. Screenshots: `wf03-step2-receipt.png`, `wf03-step4-payment.png`, `wf03-complete.png` | The approval step accepts any voucher the CFO posts, so approving the seeded PAY-2026-0003 instead would also tick it. |
| WF-04 Vouchers | Implemented and tested (engine playthrough only) | Engine test WF-04: the contra is posted and the journal stays a draft. 1010 rises by ₹15,000, and the 1010 ledger shows the contra but not the draft. | Same approval caveat as WF-03. |
| WF-05 Inventory | Implemented and tested (engine playthrough only) | Engine test WF-05: the item drops by 2, 1050 falls by the FIFO value, the STK journal is posted after CFO approval, and the stock ledger shows the reason. | None found. |
| WF-06 Bank reconciliation | Implemented and tested (engine playthrough + browser) | Engine test WF-06: a completed reconciliation is saved for the statement date, `bank.statement_imported` is recorded, and the charge voucher stays pending. **Browser:** all 6 steps. Download demo statement, load the CSV, confirm the suggested match (PAY-2026-0002), create a payment voucher from the unmatched SMS/NEFT charge (amount and bank prefilled; submitted as PAY-2026-0004), then complete the reconciliation to 08-Nov-2026 with ₹49,410 statement-only and ₹0 unexplained. Screenshots: `wf06-step2-loaded.png`, `wf06-step2-done.png`, `wf06-step3-voucher.png`, `wf06-step4-ready.png`, `wf06-complete.png` | The screen forgets the loaded CSV when you leave it, so the step text now says to choose the file again. The charge voucher isn't approved in this workflow. When the payment voucher opens from reconciliation, the voucher screen pre-selects a counterparty (Bharat Switchgear) on the debit line; this was seen in the browser, and the voucher still submits. |
| WF-07 Onboard a company | Implemented and tested (engine playthrough only) | Engine test WF-07, on the GO plan: the profile (Udyam) is saved and a ledger, a customer and an item are added. | The Parties screen accepts a GSTIN with a wrong check digit; the invoice screen rejects it later (seen in the browser during WF-18). |
| WF-08 Team | Implemented and tested (engine playthrough only) | Engine test WF-08, on Enterprise: a pending Analyst invitation is created, then the role is switched to Analyst and back. | None found. |
| WF-09 Financial performance | Implemented and tested (engine playthrough only) | Engine test WF-09 (read steps complete on arrival). | Read steps prove the visit only. |
| WF-10 Working capital | Implemented and tested (engine playthrough only) | Engine test WF-10 | FP&A has no DSO or DPO; the step text now points to the Debtors and Creditors reports. |
| WF-11 Budgets | Implemented and tested (engine playthrough only) | Engine test WF-11: the Admin creates department MKT with a ₹5,00,000 budget and nothing used. | None found. |
| WF-12 Business health | Implemented and tested (engine playthrough only) | Engine test WF-12, on GO | Read-only |
| WF-13 Business transactions | Implemented and tested (engine playthrough only) | Engine test WF-13, on GO | Read-only |
| WF-14 Revenue and expenses | Implemented and tested (engine playthrough only) | Engine test WF-14 | Read-only |
| WF-15 Deku Consultant | Implemented and tested (engine playthrough only) | Engine test WF-15: the answer comes from the demo books and mentions revenue. | No AI model is called; the answer is rule-based, by design. |
| WF-16 Trace a transaction | Implemented and tested (engine playthrough only) | Engine test WF-16: AST/26-27/002 has a `journal_entry_id`, and that journal is posted and listed in Day Book data. The cross-workflow test traces the WF-01 invoice the same way. The "Open invoice" fix was checked in the browser through WF-01. | In the real database, `audit_events` can be read only by owner, admin and accountant. The audit screen also reads `user_activity_logs`, which every member can read. The demo returns its activity rows to every role, which matches `user_activity_logs` but not `audit_events`. |
| WF-17 Accounting integrity | Implemented and tested (engine playthrough only) | Engine test WF-17 (read-only) | Approve & post is not disabled for the Auditor; the engine refuses it with a 403. |
| WF-18 Business-to-close cycle | Implemented and tested (engine playthrough only) | Engine test WF-18, all 12 steps: the Admin's customer is invoiced by the Accountant, issued by the Admin, settled by an Accountant receipt and approved by the CFO. Its receivable is 0, 1030 is back to its starting balance, and the Trial Balance balances. **Browser:** steps 1-4 only (Save profile, add a customer, Accountant draft AST/26-27/118, Admin issue), each ticked "Done". Screenshots: `wf18-step2-party.png`, `wf18-step3-done.png`, `wf18-step4-done.png` | Steps 5-12 were not run in the browser. Their screens are the same ones covered by the WF-03 browser run. |

## Fixes made

**Runtime:** `apps/platform/src/context/LearnDemoContext.tsx:229-238` (`syncUrl`).

- The demo now copies the screen's own query (`?invoice=…`, `?amount=…&date=…&bank_account_id=…`) onto the page URL, because the reused screens read it from there.
- Before the fix, "Open invoice" in the Day Book drawer (WF-01, WF-16) landed on the register without opening the invoice. Reconciliation's "Create payment voucher" (WF-06) opened an empty voucher.
- Both now work; checked in the browser (`wf01-step7-reopened.png`, `wf06-step3-voucher.png`).

**Engine:** no changes. Every write the 18 workflows make was accepted for the role the step names, recorded the expected activity with the expected refs, and kept the books balanced.

**Catalogue** (`apps/platform/src/lib/learn/workflows/catalogue.ts`), checked against `rbac.ts` and the screens:

- **Roles on action steps.** The coach only switches role when `step.role` is set. Explicit roles were added to WF-01 save-draft (:85), WF-02 save-bill (:164), WF-06 load-and-match (:440) and complete (:460), and WF-15 ask (:1064). Before this, starting from another workflow's role could block these steps.
- **WF-01:**
  - The step now says to type an invoice number; the screen requires one, and the old text left it out.
  - The item names now match the seed.
  - The tax summary text now matches the screen ("CGST" / "SGST", no rate shown).
  - The GSTR-1 text now says "B2B (4A) totals".
  - The ledger names in the impact text now match the chart of accounts.
- **WF-02:**
  - The Register tab is named.
  - "Blocked u/s 17(5)" now matches the screen.
  - The text says the voucher checkbox is already ticked.
  - The ITC text now names 4(A)(5) / 4(B)(1).
  - The ledger names are the seeded ones.
- **WF-03 and WF-18 receipt:**
  - Choosing an invoice doesn't set the accounts, so the step now says to choose 1020 on line 1 and 1030 on line 2.
  - The payment step names the "Upload payment screenshot or advice" button.
  - The approval step now quotes RCT-… instead of RCP-… (seen in the browser).
- **WF-04:** the steps now say to choose "Cash withdrawal slip or cheque leaf" (the proof defaults to a deposit slip) and use the seeded ledger names.
- **WF-05:** the Type defaults to Opening stock, which locks Direction to In. The step now says to set Type to Adjustment, and to click Record (it said "save").
- **WF-06:**
  - The file name is now "Download demo statement" (the old name didn't exist).
  - "Create payment voucher" prefills the voucher.
  - The visitor has to reload the CSV after leaving the screen.
  - The summary labels now match the screen.
- **WF-07:** the profile text drops the legal name, which the form doesn't have. Steps now name the buttons: Add account / Save account, New party / Save counterparty, New catalogue item / Save item.
- **WF-08:** "Members & roles" tab.
- **WF-09, WF-14, WF-16:** seeded ledger names; "Revenue and income".
- **WF-10:** FP&A has no DSO or DPO, so the text was reworded. The FP&A screen subtitle in `components/learn/LearnDemoWorkspace.tsx:228` made the same claim and was corrected. Reminders are blocked in the demo, not simulated.
- **WF-11:** Departments tab and "Create department".
- **WF-13:** the Register tab.
- **WF-17:** the Auditor's Approve & post is refused for the role; ITC comes from purchase bills.
- **WF-18:** invoice number; the customer needs a valid GSTIN starting with 27 (the invoice screen checks the check digit).

**UI string:** `modules/financial-reports/balance-sheet/BalanceSheetView.tsx:130` changed from "Balance Sheet Equated" to "Balance sheet balances" (sentence case). The tutorial in `lib/tutorials/paths.ts:385` that quotes it was updated to match.

**Tests:**

- New file: `tests/learn-playthrough.test.ts` (20 tests).
- `tests/learn-workflows.test.ts`: the test that scans the screen source now has a 30 s timeout. It took 5.6 s and hit the default 5 s limit under the full parallel run; it passes alone in 9.5 s total.
- `tests/fixtures/learn-engine-ctx.ts`: a lint directive for its existing `any`.

## Commands run (real results)

| Command | Result |
|---|---|
| `npx vitest run tests/learn-playthrough.test.ts tests/learn-workflows.test.ts tests/learn-runner.test.ts` | 37 passed |
| `npx tsc --noEmit -p apps/platform` | exit 0, no errors |
| `npx vitest run` (full) | 46 files, 417 tests passed. The first full run had 1 failure: the source-scan test timed out at 5 s. Its timeout was raised and the rerun was green. |
| `npx eslint apps/platform/src/lib/learn apps/platform/src/components/learn apps/platform/src/context/LearnDemoContext.tsx tests/learn-playthrough.test.ts tests/learn-workflows.test.ts tests/fixtures/learn-engine-ctx.ts` | exit 0: 0 errors, 1 existing warning (`LearnDemoContext.tsx:378`, unnecessary useMemo dependency) |
| `npx eslint apps/platform/src/modules/financial-reports/balance-sheet` | 3 existing errors (`react-hooks/set-state-in-effect`) and 1 warning. They are not in the changed line and were not fixed here. |
| `npx next build` (from apps/platform, `NEXT_PUBLIC_SUPABASE_URL=http://localhost NEXT_PUBLIC_SUPABASE_ANON_KEY=x`) | exit 0. 1 existing Turbopack warning (`process.exit` in the env check is not supported in the Edge runtime). |
| Browser: `node learn-cdp.mjs wf01-browser.mjs` / `wf03-browser.mjs` / `wf06-browser.mjs` / `wf18-browser.mjs` against http://localhost:3622 | WF-01, WF-03 and WF-06 complete. WF-18 steps 1-4 done. The first WF-18 run failed at step 3 because the test GSTIN had a wrong check digit; with a valid GSTIN it passed. |

Port 3631 was not used: Next reported an existing dev server for this folder on 3622 (PID 254440). That server was used and left running.
