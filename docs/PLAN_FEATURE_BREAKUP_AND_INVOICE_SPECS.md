# Deku Finance — Plan Feature Breakup & Invoice Customization Architecture

> **Document Status**: Production Specification  
> **Contact / Helpline**: `+91 7506461004`  
> **Target Release**: Future Phase (Prepared for buildout)

---

## 1. Executive Summary & Subscription Strategy

Deku Finance operates a transparent, dual-tier pricing model tailored specifically to the Indian commercial and FinTech landscape:

| Plan | Monthly Billing | Annual Billing (Save 20%) | Target Audience | Trial & Onboarding |
| :--- | :--- | :--- | :--- | :--- |
| **GO** | **₹1,499** / month | **₹1,199** / month (₹14,388/yr) | Freelancers, Solo Creators, Micro-Enterprises, Non-GST businesses under ₹20L/₹40L | **15-Day Free Trial** on signup • No credit card required • Full feature access |
| **PRO** | **₹4,999** / month | **₹3,999** / month (₹47,988/yr) | High-volume B2B vendors, multi-state GST enterprises, marketplace sellers (Amazon, Meesho, Flipkart) | Instant upgrade • Dedicated onboarding engineer • VIP Priority Support |

---

## 2. Complete Plan Feature Breakup Matrix

### 2.1 Invoicing, Billing & Payment Collection

| Capability / Feature | GO Plan (₹1,499/mo) | PRO Plan (₹4,999/mo) | Regulatory / Technical Notes |
| :--- | :---: | :---: | :--- |
| **Monthly Bill Volume** | Up to 150 bills / mo | **Unlimited** bills / mo | Invoices & Bills of Supply |
| **Direct Payment QR on Invoice** | **✓ Standard Bharat UPI** | **✓ Advanced UPI + Webhook Reconcile** | Encodes dynamic amount, VPA, and invoice ID |
| **Custom Invoice Fields** | **Standard Custom Fields** (PO, Terms, Notes) | **Full Dynamic Field Builder** (Unlimited metadata) | Stored as `JSONB` in PostgreSQL |
| **Custom Line-Item Fields** | — | **✓ Batch, Serial #, Mfg Date, Expiry** | Essential for pharma, FMCG & electronics |
| **Brand Identity & White-label** | Business Logo & Address | **Full Custom Theme, Stamp & Signature** | High-DPI Vector PDF export |
| **Multi-Currency Invoicing** | — | **✓ USD, EUR, GBP, AED, SGD** | Auto-converted to INR with RBI exchange rates |
| **MSME 45-Day Payment Chaser** | Manual WhatsApp Link | **Automated WhatsApp & Email Schedule** | Compliant with Section 15 of MSMED Act 2006 |
| **Recurring Subscriptions** | Up to 10 active clients | **Unlimited recurring invoices** | Auto-generates on 1st of every month |

---

### 2.2 GST & Statutory Compliance

| Capability / Feature | GO Plan (₹1,499/mo) | PRO Plan (₹4,999/mo) | Regulatory / Technical Notes |
| :--- | :---: | :---: | :--- |
| **Section 22 Non-GST Mode** | **✓ Full Support** | **✓ Full Support** | Exempt under Section 22 of the CGST Act |
| **Turnover Exemption Tracker** | **✓ Real-time Tracker** | **✓ Multi-Entity Tracker** | Visual progress against ₹20L / ₹40L limit |
| **Auto Tax Splitting (CGST/SGST/IGST)** | **✓ Included** | **✓ Included** | Based on Place of Supply (POS) state codes |
| **Official GSTN Offline JSON Export** | Tax Summary View | **✓ 1-Click GSTR-1 & 3B Offline JSON** | Direct upload to `gst.gov.in` |
| **Input Tax Credit (ITC) Reconciliation** | Basic Purchase Log | **✓ Automated GSTR-2B Matching** | Rule 36(4) compliance & Sec 17(5) blocked ITC |
| **E-Commerce ECO Section 14 Reporting** | Manual classification | **✓ Automated Marketplace Sync** | Table 3.1.1 reporting (Amazon, Meesho, etc.) |
| **E-Way Bill Generation** | Manual link | **✓ Direct API Generation** | Required for consignments > ₹50,000 |

---

### 2.3 ALERX Double-Entry General Ledger

| Capability / Feature | GO Plan (₹1,499/mo) | PRO Plan (₹4,999/mo) | Regulatory / Technical Notes |
| :--- | :---: | :---: | :--- |
| **ALERX 4-Tier Hierarchy** | **✓ Standard GAAP Hierarchy** | **✓ Custom Sub-Ledgers & Branches** | Group ➔ Ledger ➔ Sub-Ledger ➔ Leaf Label |
| **Leaf Label Trigger Enforcement** | **✓ Strict Trigger** | **✓ Strict Trigger** | `guard_journal_line_postable_label()` trigger |
| **Units & INR Dual Metric** | **✓ Included** | **✓ Included** | Discrete event counting + financial magnitude |
| **Real-time P&L & Balance Sheet** | **✓ Real-Time** | **✓ Real-Time + Multi-Period Compare** | Dynamically computed from posted vouchers |
| **Trial Balance & General Ledger Drilldown**| **✓ Standard** | **✓ Multi-Dimensional Audit Filter** | Filter by cost center, project, or channel |
| **Tamper-Evident Journal Trail** | **✓ Append-Only** | **✓ Cryptographic Hash Chaining** | Meets MCA 2023 audit trail regulations |

---

### 2.4 Masters, Collaboration & Infrastructure

| Capability / Feature | GO Plan (₹1,499/mo) | PRO Plan (₹4,999/mo) | Details |
| :--- | :---: | :---: | :--- |
| **User Seats & Roles** | 2 Seats (Admin + Accountant) | **Unlimited Seats with Custom RBAC** | Founder, Accountant, Billing Clerk, Viewer |
| **Customer & Vendor Directory** | Up to 500 contacts | **Unlimited contacts** | With credit limits & TDS/TCS flags |
| **Inventory & HSN Master** | Up to 250 items | **Unlimited items + Multi-Warehouse** | Auto-lookup from 12,000+ official HSN codes |
| **API & Webhook Access** | — | **✓ Full REST & Webhook APIs** | Connect with Shopify, WooCommerce, ERPs |
| **Helpline & SLA** | Standard Email & Knowledgebase | **VIP Priority Helpline (+91 7506461004)** | 1-hour SLA response during business hours |

---

## 3. Deep-Dive Specification: Option to Customise Invoice Fields

### 3.1 Data Architecture (`custom_fields` JSONB)
In Deku Finance, both the `invoices` table and the `invoice_items` table feature a flexible, indexable `custom_fields JSONB` column.

```sql
-- PostgreSQL / Supabase Schema Definition
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}'::jsonb;

ALTER TABLE invoice_items 
ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}'::jsonb;

-- Gin Index for high-speed indexing across custom attributes
CREATE INDEX IF NOT EXISTS idx_invoices_custom_fields 
ON invoices USING gin (custom_fields);
```

### 3.2 Supported Field Schemas

```json
{
  "header_fields": {
    "po_number": {
      "type": "string",
      "label": "PO / Order Reference #",
      "value": "PO-2026-OCT-892",
      "required": false,
      "show_on_pdf": true
    },
    "po_date": {
      "type": "date",
      "label": "PO Date",
      "value": "2026-10-15",
      "show_on_pdf": true
    },
    "eway_bill_no": {
      "type": "string",
      "label": "E-Way Bill Number",
      "value": "2819-4820-9182",
      "show_on_pdf": true
    },
    "vehicle_no": {
      "type": "string",
      "label": "Transporter Vehicle #",
      "value": "MH-02-EE-4501",
      "show_on_pdf": true
    },
    "payment_terms": {
      "type": "select",
      "label": "Payment Terms",
      "options": ["Immediate", "Net 7 Days", "Net 15 Days", "Net 30 Days", "Net 45 Days"],
      "value": "Net 15 Days",
      "due_date": "2026-11-03",
      "show_on_pdf": true
    }
  },
  "line_item_fields": {
    "batch_no": "B-4091",
    "expiry_date": "2028-09-30",
    "serial_number": "SN-DEKU-8921-X"
  }
}
```

### 3.3 UI Field Customizer Experience
1. **Interactive Toggle Bar**: Users can toggle PO Number, E-Way Bill, Payment Terms, and Bank Notes with single-click pills.
2. **Settings Modal (`/settings/invoicing`)**: Businesses can define default custom fields that automatically attach to every newly created invoice.
3. **Template Designer**: Preview how custom fields render on both compact A4 formats and thermal roll prints.

---

## 4. Deep-Dive Specification: Payment QR Directly in Invoice

### 4.1 NPCI Bharat UPI Deep-Link Format
Deku Finance generates a standard, high-interoperability Bharat UPI QR Code compliant with the National Payments Corporation of India (NPCI) specification:

```
upi://pay?pa={VPA}&pn={PAYEE_NAME}&am={TOTAL_AMOUNT}&cu=INR&tn={TRANSACTION_NOTE}&tr={TRANSACTION_REF}
```

#### Example Payload:
- **Payee VPA (`pa`)**: `7506461004@paytm` (or custom verified handle e.g. `deku.enterprise@icici`)
- **Payee Name (`pn`)**: `Datalis Infoedge Pvt Ltd`
- **Amount (`am`)**: `50000.00` (or `59000.00` in GST Mode)
- **Currency (`cu`)**: `INR`
- **Transaction Note (`tn`)**: `Bill BOS/2026-27/0014`
- **Transaction Ref (`tr`)**: `INV-TXN-20261019-0014`

### 4.2 Visual Placement on Invoice
- **Location**: Bottom-left or bottom-center of the invoice, adjacent to Bank Account details.
- **Visual Design**: High-contrast, scannable QR matrix with 4-dot quiet margin, Deku/UPI security badge, and instant scan-to-pay instructions.
- **Multi-App Compatibility**: Compatible with Google Pay, PhonePe, Paytm, BHIM, CRED, Navi, and all Indian mobile banking apps.
- **Zero MDR**: Direct peer-to-merchant UPI carries 0% Merchant Discount Rate (MDR), ensuring businesses keep 100% of receipts.

### 4.3 Automated Reconciliation Mechanism
1. **Payer Scan**: Customer scans the QR code; payee details and exact amount auto-populate on their smartphone.
2. **Settlement**: Funds settle into the merchant's linked Indian current account.
3. **Reconciliation**:
   - **GO Plan**: 1-click ledger reconciliation upon entering the UPI UTR (12-digit reference number).
   - **PRO Plan**: Automated webhook / Bank Open API synchronization that posts balancing debit to `Bank (1102)` and credit to `Trade Debtors (1103)`.

---

## 5. 15-Day Free Trial Mechanics on GO Plan

1. **Frictionless Signup**:
   - Any user who signs up automatically receives **15 days of unrestricted GO access**.
   - **No credit card or upfront deposit required**.
2. **Transparent In-App Countdown**:
   - Top banner clearly shows: `15-Day Free Trial Active • X Days Remaining`.
3. **Graceful Post-Trial Behavior**:
   - Invoices generated during the trial remain permanently accessible and legally valid.
   - When the trial ends, workspace enters read-only archive mode until subscription renewal.
   - Zero aggressive popups or account lockouts; users can export their complete data and ledger anytime.

---

## 6. Implementation Readiness & Future Build Roadmap

When ready to connect live subscription billing, the following modules will be linked:
1. **Razorpay Subscriptions / Cashfree Autopay**: For automated recurring UPI Autopay / e-Mandate billing.
2. **Webhook Listener (`/api/webhooks/billing`)**: Listens for subscription renewals, invoice settlements, and upgrades.
3. **Plan Guard Middleware (`src/proxy.ts` / server routes)**: Enforces limits (e.g. 150 invoices/mo on GO vs unlimited on PRO).
