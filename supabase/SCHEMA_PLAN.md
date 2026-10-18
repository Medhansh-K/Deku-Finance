# Deku Finance — Database Architecture & Schema Plan

## 1. Executive Architecture Summary

Deku Finance is an enterprise-grade multi-tenant financial platform engineered on Supabase PostgreSQL. This document defines the structural blueprint, entity relationships, security barriers (Row-Level Security), double-entry accounting guarantees, and GST invoicing lifecycle.

---

## 2. Module Boundaries

```
┌────────────────────────────────────────────────────────────────────────┐
│                          Core Identity & Tenancy                       │
│     profiles ────────► organisations ◄──────── organisation_members   │
└────────┬──────────────────────┬──────────────────────┬─────────────────┘
         │                      │                      │
         ▼                      ▼                      ▼
┌──────────────────┐  ┌───────────────────┐  ┌───────────────────────────┐
│     Parties      │  │  Catalogue Items  │  │   Fiscal Periods & CoA    │
│ (Customers/      │  │ (Goods/Services   │  │ accounts, fiscal_periods  │
│  Vendors/Both)   │  │  HSN/SAC & Rates) │  └─────────────┬─────────────┘
└────────┬─────────┘  └─────────┬─────────┘                │
         │                      │                          ▼
         │                      │             ┌──────────────────────────┐
         │                      │             │ Double-Entry Bookkeeping │
         │                      │             │ journal_entries, lines   │
         │                      │             └────────────▲─────────────┘
         ▼                      ▼                          │ (Linked on Issue)
┌─────────────────────────────────────────┐                │
│             GST Invoicing               ├────────────────┘
│ sales_invoices, sales_invoice_lines     │
└────────────────────┬────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────┐  ┌───────────────────────────┐
│            Invoice Documents            │  │        Audit Trail        │
│ invoice_documents (PDF metadata/vault)  │  │ audit_events (append-only)│
└─────────────────────────────────────────┘  └───────────────────────────┘
```

---

## 3. Entity Relationships & Tenant Integrity

### Tenant Isolation Rule
Every tenant-owned table features `organisation_id uuid NOT NULL`. Composite unique constraints `UNIQUE (organisation_id, id)` are established on parent entities to enable composite foreign keys `FOREIGN KEY (organisation_id, parent_id) REFERENCES parent_table(organisation_id, id)`. This mathematically eliminates cross-tenant data corruption at the database engine level.

### Entities Overview
1. **`profiles`**: Tied 1:1 with `auth.users(id)`. Contains display name, email, avatar.
2. **`organisations`**: Multi-tenant boundary. Holds base currency, timezone, GSTIN, PAN, and financial year start month.
3. **`organisation_members`**: Junction between `organisations` and `auth.users`. Defines role (`owner`, `admin`, `accountant`, `member`, `viewer`).
4. **`parties`**: Counterparties (customers, vendors, both, other) with address snapshots, GSTIN, PAN, and active state.
5. **`catalogue_items`**: Goods and services with HSN/SAC codes, default unit prices, unit codes, and tax rates.
6. **`fiscal_periods`**: Accounting year/quarter/month periods with non-overlapping constraints and strict open/closed status.
7. **`accounts`**: Standard Chart of Accounts (Assets, Liabilities, Equity, Income, Expense) supporting hierarchical parent accounts within the same organization.
8. **`journal_entries`**: Header for financial transactions, recording date, fiscal period, status (`draft`, `posted`, `reversed`), and reference.
9. **`journal_entry_lines`**: Individual debits and credits. Constrained to non-negative amounts where exactly one side is positive.
10. **`sales_invoices`**: GST-compliant sales invoice headers featuring party snapshots, tax breakdowns (CGST, SGST, IGST, cess), totals, and optional link to a generated journal entry.
11. **`sales_invoice_lines`**: Line-item details with item snapshots, HSN/SAC, quantities, taxable amounts, and computed tax splits.
12. **`invoice_documents`**: Metadata records for rendered PDF documents stored in private Supabase Storage buckets.
13. **`audit_events`**: Append-only compliance log capturing security, membership, posting, and invoicing events.

---

## 4. Migration Sequence

| Migration File | Module | Primary Tables & Functions |
|---|---|---|
| `20261018000001_core_identity.sql` | Core Identity | `profiles`, `set_updated_at()`, `handle_new_user()` trigger |
| `20261018000002_organisations_tenancy.sql` | Tenancy & Access | `organisations`, `organisation_members`, `has_role()`, `is_org_member()`, `create_organisation()` |
| `20261018000003_parties.sql` | Counterparties | `parties`, GSTIN/PAN format checks, tenant composite keys |
| `20261018000004_catalogue_items.sql` | Products & Services | `catalogue_items`, org-scoped SKU uniqueness, rate bounds |
| `20261018000005_accounting_foundation.sql` | Ledger Foundation | `fiscal_periods`, `accounts`, `journal_entries`, `journal_entry_lines`, `seed_default_chart_of_accounts()` |
| `20261018000006_accounting_posting_reporting.sql` | Accounting Engine | `post_journal_entry()`, `reverse_journal_entry()`, immutability triggers, `view_general_ledger`, `view_profit_and_loss`, `view_balance_sheet` |
| `20261018000007_sales_invoices_gst.sql` | GST Invoicing | `sales_invoices`, `sales_invoice_lines`, `issue_sales_invoice()`, tax parity enforcement triggers |
| `20261018000008_invoice_documents.sql` | Storage & Documents | `invoice_documents`, storage vault RLS policies |
| `20261018000009_audit_events_and_performance.sql` | Audit & Indexing | `audit_events`, immutability triggers, composite performance indexes |

---

## 5. Row-Level Security (RLS) Permission Matrix

RLS is enabled on every public table. Helper functions `is_org_member(org_id)` and `has_role(org_id, roles[])` run as `SECURITY DEFINER` with fixed `search_path = public` to avoid recursion and privilege escalation.

| Table | Operation | Owner | Admin | Accountant | Member | Viewer |
|---|---|:---:|:---:|:---:|:---:|:---:|
| `profiles` | SELECT | Own / Peers | Own / Peers | Own / Peers | Own / Peers | Own / Peers |
| `profiles` | UPDATE | Self only | Self only | Self only | Self only | Self only |
| `organisations` | SELECT | Member | Member | Member | Member | Member |
| `organisations` | UPDATE | Allowed | Allowed | Denied | Denied | Denied |
| `organisations` | DELETE | Allowed | Denied | Denied | Denied | Denied |
| `organisation_members` | SELECT | Org peers | Org peers | Org peers | Org peers | Org peers |
| `organisation_members` | INSERT/UPDATE | Full | Non-owner roles | Denied | Denied | Denied |
| `organisation_members` | DELETE | Full | Non-owner roles | Denied | Self (Leave) | Self (Leave) |
| `parties` | SELECT | Org | Org | Org | Org | Org |
| `parties` | INSERT/UPDATE | Allowed | Allowed | Allowed | Allowed | Denied |
| `parties` | DELETE | Allowed | Allowed | Denied | Denied | Denied |
| `catalogue_items` | SELECT | Org | Org | Org | Org | Org |
| `catalogue_items` | INSERT/UPDATE | Allowed | Allowed | Allowed | Allowed | Denied |
| `catalogue_items` | DELETE | Allowed | Allowed | Denied | Denied | Denied |
| `fiscal_periods` | SELECT | Org | Org | Org | Org | Org |
| `fiscal_periods` | INSERT/UPDATE | Allowed | Allowed | Allowed | Denied | Denied |
| `accounts` | SELECT | Org | Org | Org | Org | Org |
| `accounts` | INSERT/UPDATE | Allowed | Allowed | Allowed | Denied | Denied |
| `journal_entries` | SELECT | Org | Org | Org | Org | Org |
| `journal_entries` (Draft) | INSERT/UPDATE | Allowed | Allowed | Allowed | Denied | Denied |
| `journal_entries` (Posted) | UPDATE/DELETE | **BLOCKED** | **BLOCKED** | **BLOCKED** | **BLOCKED** | **BLOCKED** |
| `sales_invoices` | SELECT | Org | Org | Org | Org | Org |
| `sales_invoices` (Draft) | INSERT/UPDATE | Allowed | Allowed | Allowed | Allowed | Denied |
| `sales_invoices` (Issued) | UPDATE/DELETE | **BLOCKED** | **BLOCKED** | **BLOCKED** | **BLOCKED** | **BLOCKED** |
| `invoice_documents` | SELECT | Org | Org | Org | Org | Org |
| `invoice_documents` | INSERT | Allowed | Allowed | Allowed | Allowed | Denied |
| `audit_events` | SELECT | Org | Org | Org | Denied | Denied |
| `audit_events` | INSERT | Append-only | Append-only | Append-only | Append-only | Append-only |
| `audit_events` | UPDATE/DELETE | **BLOCKED** | **BLOCKED** | **BLOCKED** | **BLOCKED** | **BLOCKED** |

---

## 6. Accounting Posting Model

### Fundamental Principles
- **No Manual Aggregates**: Profit & Loss and Balance Sheets are computed directly from atomic journal entry lines via SQL aggregation.
- **Double-Entry Equilibrium**: Total debits MUST equal total credits (`SUM(debit) = SUM(credit)`). Minimum 2 lines per entry.
- **Controlled Posting**: Status transition from `draft` to `posted` occurs strictly via the database function `post_journal_entry(p_org_id, p_entry_id)`. Direct client writes to `status = 'posted'` are blocked by trigger constraints.
- **Immutability**: Once an entry is `posted` or `reversed`, triggers permanently prohibit `UPDATE` or `DELETE` on the entry and its lines.
- **Reversal Pattern**: Corrections require `reverse_journal_entry()`, creating an explicit mirrored entry with inverse debits/credits, linking back via `reversal_of_id`.
- **Fiscal Period Lock**: Entries cannot be posted into a `closed` fiscal period or dated outside the period's bounds.

### Reporting Sign Conventions & Natural Balances
| Account Category | Natural Balance Type | Reporting Formula |
|---|---|---|
| **Asset** | Debit | `Debit - Credit` |
| **Liability** | Credit | `Credit - Debit` |
| **Equity** | Credit | `Credit - Debit` |
| **Income** | Credit | `Credit - Debit` |
| **Expense** | Debit | `Debit - Credit` |

---

## 7. GST Invoicing Lifecycle

```
[Draft Created] ──► [Lines Added & Calculated] ──► [issue_sales_invoice()] ──► [Issued & Immutable]
                                                            │
                                                            ▼ (Optional auto-journal)
                                              [Balanced Accounting Journal Created]
```

### Calculations & GST Rules
1. **Intra-State Supply**: When seller state matches place of supply:
   - `CGST Rate = GST Rate / 2`, `CGST Amount = Taxable * CGST Rate`
   - `SGST Rate = GST Rate / 2`, `SGST Amount = Taxable * SGST Rate`
   - `IGST = 0`
2. **Inter-State Supply**: When seller state differs from place of supply:
   - `IGST Rate = GST Rate`, `IGST Amount = Taxable * IGST Rate`
   - `CGST = 0`, `SGST = 0`
3. **Exempt / Nil Rated**:
   - `CGST = SGST = IGST = Cess = 0`
4. **Historical Immutability**: On creation/issue, party addresses, GSTIN, legal names, and catalogue items are snapshotted into JSONB/denormalized columns so subsequent master data edits do not mutate historical tax documents.
5. **Atomic Journal Sync**: `issue_sales_invoice()` can post the exact double-entry journal (Debiting Accounts Receivable, Crediting Revenue and Output GST accounts) within the same database transaction.

---

## 8. Known Limitations & Future Extension Points

1. **Credit / Debit Notes**: Planned for Phase 2 as an extension to `sales_invoices` referencing `original_invoice_id`.
2. **E-Way Bill & E-Invoice QR (IRN)**: Schema includes metadata placeholders; live NIC portal integration will be added in Phase 2.
3. **Multi-Currency Hedging**: Currency conversions currently default to tenant base currency (`INR`); exchange rate snapshots can be attached to journal lines in future iterations.
4. **Inventory Valuation**: Catalogue items intentionally exclude warehouse stock tracking in this foundation phase.
