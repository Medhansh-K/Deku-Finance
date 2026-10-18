# Deku Finance — Rust / Axum API Testing with cURL

All microservice endpoints run locally on **`http://localhost:8080`** and integrate directly with your Supabase PostgreSQL database.

---

## 1. System Health & Diagnostics

```bash
# Health check
curl -X GET http://localhost:8080/health
```

Expected Response:
```json
{
  "engine": "Axum / Rust",
  "service": "deku-finance-backend",
  "status": "healthy",
  "version": "0.1.0"
}
```

---

## 2. Organisations & Multi-Tenancy

```bash
# 1. List all organisations
curl -X GET http://localhost:8080/api/v1/organisations

# 2. Create a new organisation (Requires auth bearer token if authenticated, or anon key)
curl -X POST http://localhost:8080/api/v1/organisations \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Deku Technologies Private Limited",
    "slug": "deku-tech",
    "currency": "INR",
    "timezone": "Asia/Kolkata",
    "gstin": "27AAACD1234E1Z5",
    "pan": "AAACD1234E",
    "financial_year_start_month": 4
  }'

# 3. Get organisation details by ID
curl -X GET http://localhost:8080/api/v1/organisations/<ORGANISATION_ID>

# 4. List organisation members
curl -X GET http://localhost:8080/api/v1/organisations/<ORGANISATION_ID>/members
```

---

## 3. Counterparties (Parties)

```bash
# 1. Create a customer
curl -X POST http://localhost:8080/api/v1/organisations/<ORGANISATION_ID>/parties \
  -H "Content-Type: application/json" \
  -d '{
    "type": "customer",
    "legal_name": "Acme Global Solutions India Pvt Ltd",
    "display_name": "Acme Global",
    "gstin": "27ABCDE1234F1Z5",
    "pan": "ABCDE1234F",
    "email": "finance@acmeglobal.com",
    "phone": "+919876543210",
    "billing_address": {
      "line1": "Level 4, Cyber City",
      "city": "Mumbai",
      "state": "Maharashtra",
      "pincode": "400051",
      "country": "India"
    }
  }'

# 2. List all parties
curl -X GET http://localhost:8080/api/v1/organisations/<ORGANISATION_ID>/parties
```

---

## 4. Product & Service Catalogue

```bash
# 1. Create a catalogue service item
curl -X POST http://localhost:8080/api/v1/organisations/<ORGANISATION_ID>/catalogue \
  -H "Content-Type: application/json" \
  -d '{
    "type": "services",
    "name": "Cloud Architecture & Security Advisory",
    "description": "Monthly retained cloud architecture and cybersecurity retainer",
    "sku": "ADV-CLOUD-01",
    "hsn_sac_code": "998315",
    "unit_code": "OTH",
    "default_unit_price": 75000.00,
    "default_gst_rate": 18.00,
    "is_taxable": true
  }'

# 2. List all catalogue items
curl -X GET http://localhost:8080/api/v1/organisations/<ORGANISATION_ID>/catalogue
```

---

## 5. Accounting & Ledger Foundation

```bash
# 1. Seed the default Chart of Accounts (Assets, Liabilities, Equity, Income, Expenses, Tax accounts)
curl -X POST http://localhost:8080/api/v1/organisations/<ORGANISATION_ID>/accounts/seed

# 2. List Chart of Accounts
curl -X GET http://localhost:8080/api/v1/organisations/<ORGANISATION_ID>/accounts

# 3. Create a Fiscal Period
curl -X POST http://localhost:8080/api/v1/organisations/<ORGANISATION_ID>/fiscal-periods \
  -H "Content-Type: application/json" \
  -d '{
    "name": "FY 2026-27 Annual",
    "start_date": "2026-04-01",
    "end_date": "2027-03-31"
  }'

# 4. List Fiscal Periods
curl -X GET http://localhost:8080/api/v1/organisations/<ORGANISATION_ID>/fiscal-periods

# 5. Create a balanced draft Journal Entry
curl -X POST http://localhost:8080/api/v1/organisations/<ORGANISATION_ID>/journals \
  -H "Content-Type: application/json" \
  -d '{
    "fiscal_period_id": "<FISCAL_PERIOD_ID>",
    "entry_number": "JRN-2026-001",
    "entry_date": "2026-05-15",
    "narration": "Founder Capital Contribution",
    "reference": "BANK-DEP-001",
    "lines": [
      {
        "line_number": 1,
        "account_id": "<OPERATING_BANK_ACCOUNT_ID>",
        "description": "Cash injection to bank",
        "debit": 500000.00,
        "credit": 0.00
      },
      {
        "line_number": 2,
        "account_id": "<SHAREHOLDER_CAPITAL_ACCOUNT_ID>",
        "description": "Issued Equity Shares",
        "debit": 0.00,
        "credit": 500000.00
      }
    ]
  }'

# 6. Post the Journal Entry (Atomic double-entry equilibrium validation)
curl -X POST http://localhost:8080/api/v1/organisations/<ORGANISATION_ID>/journals/<JOURNAL_ENTRY_ID>/post

# 7. Reverse a Posted Journal Entry (Creates mirrored counter-entry)
curl -X POST http://localhost:8080/api/v1/organisations/<ORGANISATION_ID>/journals/<JOURNAL_ENTRY_ID>/reverse \
  -H "Content-Type: application/json" \
  -d '{
    "reversal_date": "2026-05-20",
    "narration": "Reversing incorrect bank allocation"
  }'
```

---

## 6. Financial Reporting APIs

```bash
# 1. General Ledger Audit Trail (All posted transactions)
curl -X GET http://localhost:8080/api/v1/organisations/<ORGANISATION_ID>/reports/general-ledger

# 2. Account Balances (Aggregated with natural-balance logic)
curl -X GET http://localhost:8080/api/v1/organisations/<ORGANISATION_ID>/reports/account-balances

# 3. Profit & Loss Report (Realtime Net Profit/Loss)
curl -X GET http://localhost:8080/api/v1/organisations/<ORGANISATION_ID>/reports/profit-and-loss

# 4. Balance Sheet Report (Assets, Liabilities & Equity)
curl -X GET http://localhost:8080/api/v1/organisations/<ORGANISATION_ID>/reports/balance-sheet
```

---

## 7. GST Sales Invoices

```bash
# 1. Create a draft Intra-State GST Invoice
curl -X POST http://localhost:8080/api/v1/organisations/<ORGANISATION_ID>/invoices \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "<CUSTOMER_PARTY_ID>",
    "invoice_number": "INV-2026-0001",
    "invoice_date": "2026-06-01",
    "due_date": "2026-06-15",
    "supply_type": "intra_state",
    "place_of_supply": "27-Maharashtra",
    "taxable_amount": 100000.00,
    "total_amount": 118000.00,
    "lines": [
      {
        "line_number": 1,
        "item_name": "Cloud Advisory Retainer",
        "quantity": 1.0,
        "unit_price": 100000.00,
        "taxable_amount": 100000.00,
        "gst_rate": 18.00,
        "cgst_rate": 9.00,
        "cgst_amount": 9000.00,
        "sgst_rate": 9.00,
        "sgst_amount": 9000.00,
        "igst_rate": 0.00,
        "igst_amount": 0.00,
        "total_amount": 118000.00
      }
    ]
  }'

# 2. List Invoices
curl -X GET http://localhost:8080/api/v1/organisations/<ORGANISATION_ID>/invoices

# 3. Issue the Invoice with Automatic Double-Entry Journal Creation
curl -X POST http://localhost:8080/api/v1/organisations/<ORGANISATION_ID>/invoices/<INVOICE_ID>/issue \
  -H "Content-Type: application/json" \
  -d '{
    "create_journal": true
  }'

# 4. Cancel an Issued Invoice (Reverses accounting journal atomically)
curl -X POST http://localhost:8080/api/v1/organisations/<ORGANISATION_ID>/invoices/<INVOICE_ID>/cancel \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Customer requested order cancellation before service delivery"
  }'
```

---

## 8. Audit Trail API

```bash
# Query immutable audit events
curl -X GET http://localhost:8080/api/v1/organisations/<ORGANISATION_ID>/audit-events
```
