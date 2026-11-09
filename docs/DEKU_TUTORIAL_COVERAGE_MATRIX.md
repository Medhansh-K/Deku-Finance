# DEKU FINANCE — TUTORIAL COVERAGE MATRIX

**Document Identifier:** `DEKU_TUTORIAL_COVERAGE_MATRIX.md`  
**Scope:** Specification and Verification of all 17 Prioritized Interactive Hands-on Workflows.  

---

## 1. Overview

Every interactive tutorial in the Public Learn Centre guides the user through live, real Deku application interfaces rather than static popups or video recordings.

The matrix below maps each of the **17 core workflows** to its learning objective, real Deku route, target element markers (`data-tour`), user actions, and completion validation criteria.

---

## 2. Interactive Tutorial Matrix

| # | Tutorial Name | Target Route | `data-tour` Target | Prerequisites | User Action & Steps | Completion Verification Criteria |
| :-: | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **Getting Started with Deku** | `/gateway` | `gateway-topbar` | None | 1. Introduction to Deku OS<br>2. Top bar inspection<br>3. Company switcher preview<br>4. Quick help shortcuts | User advances through welcome card; triggers `Alt+G` or clicks next. |
| **2** | **Understanding the Gateway** | `/gateway` | `gateway-menu` | None | 1. Explore Masters<br>2. Explore Transactions<br>3. Explore Reports<br>4. Inspect Quick KPIs column | User highlights all 4 gateway sections and clicks on any module item. |
| **3** | **Setting Up an Organisation** | `/settings` | `settings-company-profile` | None | 1. Inspect Company Legal Name<br>2. Enter trade name & GSTIN<br>3. Configure State of Registration<br>4. Save preferences | Input field change is validated in sandbox state; profile badge updates. |
| **4** | **Configuring Company Info** | `/settings` | `settings-fiscal-periods` | #3 | 1. Inspect Fiscal Periods<br>2. Define start/end dates (FY 2026-27)<br>3. Toggle Maker-Checker approvals | Fiscal period row established in sandbox store. |
| **5** | **Chart of Accounts (ALERX)** | `/masters/chart-of-accounts` | `coa-tabs` | None | 1. Browse Assets, Liabilities, Equity, Revenue, Expense<br>2. Differentiate Group Headers vs. Postable Leaves<br>3. Inspect running account balance | User switches through all 5 ALERX tabs and expands at least one tree leaf. |
| **6** | **Creating Customers & Suppliers** | `/masters/parties` | `parties-new` | None | 1. Click "New Party"<br>2. Select Customer vs. Vendor<br>3. Enter GSTIN & verify check digit<br>4. Save counterparty | Party appears in parties table with valid GSTIN / state code. |
| **7** | **Creating Products & Services** | `/masters/products-services` | `catalogue-new` | None | 1. Open Item Catalogue<br>2. Choose Goods vs. Services<br>3. Pick 6-digit HSN/SAC code<br>4. Set default GST rate (18%) | Catalogue item created with unit of measure and tax rate. |
| **8** | **Creating a Sales Invoice** | `/builder` | `builder-invoice-form` | #6, #7 | 1. Select Customer<br>2. Add product line with Qty & Rate<br>3. Verify CGST+SGST vs. IGST math<br>4. Review dynamic UPI QR<br>5. Click "Issue Invoice" | Invoice status changes to `issued`; atomic debit/credit journal created. |
| **9** | **Recording a Purchase Bill** | `/purchases` | `purchases-new-bill` | #6 | 1. Select Vendor<br>2. Input Vendor Bill # & Taxable value<br>3. Select ITC Eligibility (Table 4A5)<br>4. Save & post voucher | Purchase bill posted; vendor account credited; Input Tax Credit ledger debited. |
| **10**| **Creating Accounting Vouchers** | `/vouchers` | `voucher-workspace` | #5 | 1. Select voucher type (F4 Contra / F5 Payment / F6 Receipt / F7 Journal)<br>2. Add Debit & Credit ledger legs<br>3. Verify $\sum \text{Dr} = \sum \text{Cr}$<br>4. Post voucher | Journal entry recorded with gapless sequence number. |
| **11**| **Double-Entry Accounting** | `/day-book` | `daybook-table` | #10 | 1. Inspect chronological day book<br>2. View voucher debit/credit balance<br>3. Edit draft line item<br>4. Test 1-click voucher reversal | Countervailing reversal entry posted; net ledger position neutralizes. |
| **12**| **Bank Reconciliation** | `/banking` | `bank-upload-zone` | None | 1. Upload sample CSV bank statement<br>2. Algorithmic auto-match against ledger<br>3. Manually match remaining line<br>4. Generate signed monthly statement | Reconciliation statement generated with zero ledger variance. |
| **13**| **Inventory Management** | `/inventory` | `inventory-table` | #7 | 1. Inspect FIFO stock ledger<br>2. View multi-warehouse stock distribution<br>3. Observe stock decrement from invoice #8<br>4. Record manual stock adjustment | Stock balance updates in selected godown with FIFO valuation audit. |
| **14**| **GST Calculations & Returns** | `/gst/returns` | `gst-gstr1-compile` | #8, #9 | 1. Open Returns Hub<br>2. Inspect B2B Table 4A outward supplies<br>3. Review Rule 88A ITC set-off optimization<br>4. Export official GSTR-1 offline JSON | GSTR-1 JSON generated matching GSTN schema; Table 3.1 & 4 compiled. |
| **15**| **Financial Statements** | `/reports/balance-sheet` | `report-date-filters` | #10, #11 | 1. Open Balance Sheet & P&L<br>2. Apply custom fiscal date range<br>3. Drill down into General Ledger<br>4. Verify Assets = Liabilities + Equity | Drill-down modal loads transaction lines; mathematical parity confirmed. |
| **16**| **User Roles & Permissions** | `/departments-members` | `members-tabs` | None | 1. Inspect 7-role RBAC matrix<br>2. Review permission boundaries (Owner vs. Accountant vs. Approver)<br>3. Observe payroll compensation masking | User reviews role permissions and generates a sample invite link. |
| **17**| **Module Management** | `/settings/license` | `license-entitlements` | None | 1. Inspect active modules<br>2. Review GO vs. PRO vs. Enterprise feature gates<br>3. View available add-on modules | Entitlement matrix verified with plan capability highlights. |

---

## 3. Progression & Learning Hierarchy

```
LEVEL 1: FOUNDATIONS (Tours 1–5)
└── Getting Started ➔ Gateway Navigation ➔ Company Setup ➔ Fiscal Periods ➔ ALERX Chart of Accounts

LEVEL 2: TRADE & COMMERCIAL TRANSACTIONS (Tours 6–9)
└── Counterparty Masters ➔ Item Catalogue ➔ Sales Tax Invoicing ➔ Vendor Purchase Bills

LEVEL 3: LEDGER OPERATIONS & CONTROLS (Tours 10–13)
└── Double-Entry Vouchers ➔ Day Book Reversals ➔ Bank Reconciliation ➔ FIFO Inventory

LEVEL 4: STATUTORY & EXECUTIVE INTELLIGENCE (Tours 14–17)
└── GST Returns ➔ Balance Sheet / P&L ➔ 7-Role RBAC ➔ Module Entitlements
```

