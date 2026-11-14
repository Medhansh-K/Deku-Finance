# DEKU FINANCE ERP — MODULE, FEATURE & IMPLEMENTATION CATALOGUE

**Authoritative Technical & Operational Reference**  
*Platform Domain: `deku.datalis.in` | Monorepo Package: `@deku/platform`*

---

## 01. General Ledger & Core Accounting

- **Chart of Accounts (COA)**
  - *Usage / Implementation:* Hierarchical 5-tier ledger structure categorized into Assets, Liabilities, Equity, Revenue, and Expenses with Indian corporate accounting codes (1000–5000 series). Implemented via `public.accounts` table, `is_postable` flag, and parent account tree traversal (`/masters/chart-of-accounts`).
- **Accounting Vouchers (<kbd>F4</kbd>–<kbd>F9</kbd>)**
  - *Usage / Implementation:* Real-time double-entry voucher entry workspace implementing Indian keyboard standards (F4 Contra, F5 Payment, F6 Receipt, F7 Journal, F8 Sales, F9 Purchase). Auto-validates $\sum \text{Dr} \equiv \sum \text{Cr}$ at keystroke level (`/vouchers`).
- **Journal Immutability & Reversals**
  - *Usage / Implementation:* Posted vouchers cannot be silently modified or dropped. Audit alterations are strictly executed via symmetric reversal vouchers (`guard_journal_lines_immutability` trigger and `reverseJournal` RPC), complying with Companies (Accounts) Rules, 2014.
- **Trial Balance & Ledger Extract**
  - *Usage / Implementation:* Real-time debit/credit verification with period slicing, debit/credit balance grouping, and instant drill-down to underlying transactional journal entry lines (`/reports/trial-balance`, `/reports/general-ledger`).

---

## 02. Accounts Receivable (AR) & Credit Control

- **Customer Aging & Overdue Tracking**
  - *Usage / Implementation:* FIFO-based aging buckets (0–30, 31–60, 61–90, 90+ days) computed dynamically across outstanding digital invoices. Implemented via `arApAgeing` engine and `view_party_aging` (`/collect`).
- **Automated WhatsApp Payment Links & UPI Reminders**
  - *Usage / Implementation:* 1-click collection messaging with pre-configured WhatsApp intent URLs (`wa.me`) embedding dynamic NPCI UPI QR strings and direct invoice payment links.
- **Customer Advances & Receipt Settlement**
  - *Usage / Implementation:* Advance receipts booked to customer liability ledgers with subsequent 1-click allocation and reconciliation against final tax invoices upon supply delivery.
- **Credit Limit & Credit Period Controls**
  - *Usage / Implementation:* Enforces maximum credit balances and credit periods per customer master profile, generating warnings or blocking order confirmations upon breach.

---

## 03. Accounts Payable (AP) & Vendor Management

- **Purchase Bill Inward Register**
  - *Usage / Implementation:* Captures vendor tax invoices with GSTIN verification, Place of Supply determination, and automatic HSN tax splitting (`/purchases`).
- **AP Cash Outflow Payment Calendar**
  - *Usage / Implementation:* Visual weekly and monthly timeline of upcoming vendor payables grouped by due date, allowing treasury teams to schedule cash disbursements (`/purchases` tab "calendar").
- **Section 43B(h) MSME 45-Day Statutory Clock**
  - *Usage / Implementation:* Automatically detects MSME vendors via UDYAM registration and starts a non-negotiable 45-day payment countdown (`trg_compute_bill_msme_due_date`). Displays critical amber/red status badges to prevent statutory income tax expense disallowances.
- **Debit Notes & Purchase Returns**
  - *Usage / Implementation:* Adjustment vouchers raised against vendor bills for returned goods or rate differences, reducing accounts payable and reversing input tax credit.

---

## 04. Sales & Revenue Accounting

- **GST Tax Invoices & Bills of Supply**
  - *Usage / Implementation:* Statutory invoice editor with automatic inter-state (IGST) vs intra-state (CGST + SGST) tax splitting, rounding adjustments, and instant general ledger voucher posting (`/gst`).
- **Sales Orders Pipeline**
  - *Usage / Implementation:* Customer order commitment workflow capturing quotation references, line items, and delivery schedules with 1-click conversion into final posted tax invoices (`/builder`).
- **Recurring Invoicing & Subscription Schedules**
  - *Usage / Implementation:* Automated periodic billing profiles (Monthly, Quarterly, Annual) with scheduled execution dates and customer recurring terms.
- **Early-Payment Cash Discounts**
  - *Usage / Implementation:* Configurable prompt-payment incentive terms (e.g., "2% discount if paid within 10 days, Net 30") automatically computed on invoices and settlement receipts.

---

## 05. Purchase & Procurement Pipeline

- **Material Requisitions (Indents)**
  - *Usage / Implementation:* Internal requisition workflow allowing shop-floor or department heads to raise purchase requests with urgency flags (`normal`, `high`, `critical`) and HOD approval tracking (`/purchases` tab "requisitions").
- **Purchase Orders (PO)**
  - *Usage / Implementation:* Commercial procurement document generation with vendor selection, unit rates, delivery milestones, and tax summary previews (`/builder` and `/purchases` tab "orders").
- **1-Click PO-to-Bill Conversion**
  - *Usage / Implementation:* Converts approved vendor purchase orders into inward purchase bills with automatic quantity variance verification and zero re-entry.

---

## 06. Payment & Cash Management

- **Contra Vouchers (<kbd>F4</kbd>)**
  - *Usage / Implementation:* Internal liquidity transfers between bank accounts and petty cash chests with zero impact on P&L or tax ledgers.
- **Payment Vouchers (<kbd>F5</kbd>) & Receipt Vouchers (<kbd>F6</kbd>)**
  - *Usage / Implementation:* Fast cash/bank disbursement and customer receipt booking with party sub-ledger tagging and unallocated receipt tracking.
- **Multiple-Invoice Settlement**
  - *Usage / Implementation:* Single consolidated cheque/NEFT payout allocated across multiple vendor bills with automated TDS deduction booking.

---

## 07. Banking & Statement Reconciliation

- **Bank Account Masters & IFSC Registry**
  - *Usage / Implementation:* Comprehensive bank account configuration with IFSC, branch details, account types, and GL ledger linkage.
- **CSV & OFX Bank Statement Import**
  - *Usage / Implementation:* High-performance parser extracting transaction dates, narration strings, reference numbers, and debit/credit amounts (`/banking`).
- **Automated Rule-Based Transaction Matching**
  - *Usage / Implementation:* Deterministic reconciliation engine matching bank transaction references and amounts against ledger vouchers, isolating unreconciled transit items.

---

## 08. GST & Indian Tax Compliance

- **GSTR-1 Return JSON Generation**
  - *Usage / Implementation:* Compliant aggregation of Table 4 (B2B), Table 5 (B2C Large), Table 7 (B2C Small), Table 9 (Credit/Debit Notes), and Table 12 (HSN Summary), downloadable as standard GST portal JSON (`/gst/returns`).
- **GSTR-3B Computation & Table 4 ITC Slicing**
  - *Usage / Implementation:* Auto-segregates inward ITC into Table 4(A)(5) All Other ITC, Table 4(B)(1) Ineligible Rule 38/42/43, and Table 4(B)(2) Section 17(5) Blocked Credits.
- **Live GSP Gateway (Sandbox.co.in / ClearTax / Masters India)**
  - *Usage / Implementation:* Direct government Suvidha Provider gateway configuration with environment selector (Sandbox simulation vs Production NIC portal) (`/settings`).
- **E-Invoicing IRN & E-Way Bill Engine**
  - *Usage / Implementation:* Generates encrypted QR codes and 64-character IRNs. Features a configurable user decision toggle and automatic statutory threshold detection for invoices $\ge$ ₹50,000.

---

## 09. Budgeting & Departmental Expense Control

- **Annual & Monthly Budgets**
  - *Usage / Implementation:* Granular spending allocations configured per department and cost centre profile (`/departments-members`).
- **Real-Time Budget Burn Tracking**
  - *Usage / Implementation:* Dynamic comparison of allocated budget vs actual general ledger expenses with visual progress gauges.
- **Hard Transaction Spending Blocks**
  - *Usage / Implementation:* Database trigger `validate_department_budget_on_posting()` automatically blocks or rejects vouchers that would cause a department to exceed its authorized ceiling when the hard block flag is enabled.

---

## 10. Cost Centres & Financial Dimensions

- **Hierarchical Cost Trees**
  - *Usage / Implementation:* Multi-tier parent-child nesting of cost centres and departments (`parent_department_id`), allowing roll-up reporting across subsidiaries and divisions.
- **Cost Centre Types**
  - *Usage / Implementation:* Categorization into Operating Units (Direct Production), Cost Centres (Overhead), Profit Centres (Revenue Generating), and Shared Services (Support).
- **Voucher Level Financial Tagging**
  - *Usage / Implementation:* Optional `department_id` and `project_id` dimension fields on journal entry lines, sales lines, and purchase bills.

---

## 11. Fixed Asset Accounting & Depreciation

- **Asset Register & Capitalization**
  - *Usage / Implementation:* Tracks asset codes, acquisition dates, capitalization costs, salvage values, and useful life across Plant & Machinery, IT Hardware, Vehicles, Buildings, and Furniture (`/fixed-assets`).
- **Automated SLM & WDV Depreciation Schedules**
  - *Usage / Implementation:* Database engine computing month-by-month Straight Line (SLM) or Written Down Value (WDV) depreciation trajectories.
- **1-Click General Ledger Depreciation Run**
  - *Usage / Implementation:* Stored procedure `post_depreciation_run()` posts balanced monthly compound vouchers ($\sum \text{Dr} \text{ Depreciation Expense} = \sum \text{Cr} \text{ Accumulated Depreciation}$) directly into the General Ledger.

---

## 12. Project & Job Costing Finance

- **Project Master Registry**
  - *Usage / Implementation:* Tracks contract budgets, customer entities, start/end timelines, and project scopes (`/projects`).
- **Direct & Indirect Cost Allocation**
  - *Usage / Implementation:* Inward purchase bills and journal vouchers tagged with `project_id` allocate material and labor expenses directly to the project ledger.
- **Real-Time Project Profitability Engine**
  - *Usage / Implementation:* Stored procedure `get_project_profitability()` aggregates invoiced revenue against actual costs, displaying net project profit margin, margin %, and budget burn rate.

---

## 13. Inventory & Multi-Warehouse Management

- **Multi-Godown Tracking**
  - *Usage / Implementation:* Maintains stock balances across distinct physical warehouses with transfer delivery challans (`/inventory`).
- **FIFO Batch Valuation**
  - *Usage / Implementation:* Calculates Cost of Goods Sold (COGS) and closing stock valuation strictly on a First-In, First-Out basis.
- **Negative Stock Prevention Gate**
  - *Usage / Implementation:* Database constraint preventing sales invoices from dispatching inventory quantities that exceed physical on-hand stock.

---

## 14. Payroll & Statutory HR Engine

- **Indian Statutory Deductions**
  - *Usage / Implementation:* Automated calculation of Employee PF (12% capped at ₹1,800), Employer PF (12%), Employee ESIC (0.75%), Employer ESIC (3.25%), State Professional Tax (PT), and Section 192 TDS (`/departments-members`).
- **Compound Compound Ledger Posting**
  - *Usage / Implementation:* Stored procedure `compute_and_post_statutory_payroll()` generates balanced journal vouchers (Gross Salary Dr vs EPF Payable, ESIC Payable, PT Payable, TDS Payable, and Net Salaries Disbursed Cr).
- **Official PDF Payslips & Form 16 Summary**
  - *Usage / Implementation:* Self-service payslip generation with company branding, statutory UAN/ESIC numbers, earnings, deductions, and net amount in words.

---

## 15. Financial Statements & Period Closing

- **Balance Sheet & Profit & Loss**
  - *Usage / Implementation:* Indian Schedule III compliant Balance Sheet and P&L with horizontal and vertical formats, comparative previous-period figures, and working capital ratios (`/reports`).
- **Cash Flow Statement**
  - *Usage / Implementation:* Indirect method cash flow statement classifying cash movements into Operating, Investing, and Financing activities (`/reports/cash-flow`).
- **Hard Accounting Period & Year-End Closing**
  - *Usage / Implementation:* Stored procedure `close_fiscal_period()` locks reporting periods; `close_fiscal_year()` automatically zeroes nominal income/expense accounts and transfers net profit to Retained Earnings (`/settings`).
- **Frozen Accounting Dates**
  - *Usage / Implementation:* Administrative date lockout enforcing an immutable audit cutoff date (`trg_check_frozen_accounting_date`).

---

## 16. FP&A Multi-Scenario Financial Forecasting

- **12-Month Rolling Cash Runway**
  - *Usage / Implementation:* Cash flow projections plotting 12-month liquidity balance trajectories (`/fpa-forecast`).
- **Interactive CFO Sensitivity Levers**
  - *Usage / Implementation:* Real-time sliders for Revenue Growth % (-30% to +50%), OPEX Inflation % (0% to +30%), and Debtor Collection Turnaround Delay (0 to 60 days).
- **Multi-Scenario Comparison**
  - *Usage / Implementation:* Side-by-side evaluation of Base Case (Expected), Best Case (Bullish), and Stress Test (Worst Case) to identify cash runway insolvency thresholds.

---

## 17. Deku Consultant (AI Ledger Intelligence)

- **Context-Aware Financial Advisory**
  - *Usage / Implementation:* Natural language query interface analyzing general ledger trends, DSO/DPO metrics, debtor concentrations, and margin leaks (`/consultant`).
- **Auditable Ledger Facts**
  - *Usage / Implementation:* Answers strictly grounded in actual posted journal numbers, citing specific account codes and voucher totals.

---

## 18. Enterprise Governance, Maker-Checker & Security Audit

- **7-Tier Role-Based Access Control (RBAC)**
  - *Usage / Implementation:* Granular duty matrix: `Owner`, `CFO`, `Admin`, `Accountant`, `Analyst`, `Auditor`, `Viewer` with database Row Level Security (RLS) enforcement.
- **Maker-Checker Approval Queue**
  - *Usage / Implementation:* When enabled, vouchers drafted by accountants remain in a pending queue until approved by an independent manager or CFO (`/approvals`). Self-approval is strictly prevented.
- **Tamper-Evident Security Audit Log**
  - *Usage / Implementation:* Comprehensive audit trail recording user ID, IP address, timestamp, category, entity ID, and before/after metadata snapshots for every system event (`/audit`).
