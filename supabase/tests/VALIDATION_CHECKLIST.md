# Deku Finance — Database Validation & Security Test Checklist

This checklist defines the validation verification protocols for the Deku Finance database schema, Row-Level Security policies, and double-entry accounting guarantees.

---

## 1. Tenancy & Access Control (RLS)

- [ ] **Unauthenticated Access**: Verify that anonymous requests (`anon` key with no user token) cannot read or write to `organisations`, `parties`, `catalogue_items`, `accounts`, `journal_entries`, or `sales_invoices`.
- [ ] **Cross-Organisation Isolation**: User authenticated in Organisation Alpha must receive empty result sets when querying entities belonging to Organisation Beta.
- [ ] **Viewer Role Enforcement**: Users with `role = 'viewer'` can execute `SELECT` queries across all financial tables, but any `INSERT`, `UPDATE`, or `DELETE` attempt throws an RLS policy violation.
- [ ] **Role Privilege Escalation Protection**:
  - Regular members cannot insert or update rows in `organisation_members`.
  - Admins cannot elevate any member or themselves to `owner`.
  - Users cannot alter their own membership role.
  - The sole owner of an organisation cannot be deleted or leave without transferring ownership.

---

## 2. Double-Entry Accounting Engine

- [ ] **Zero-Line / Single-Line Prevention**: `post_journal_entry()` rejects entries with fewer than 2 lines.
- [ ] **Equilibrium Enforcement**: `post_journal_entry()` enforces `SUM(debit) = SUM(credit)` and rejects out-of-balance entries with exact error messages.
- [ ] **Closed Fiscal Period Lock**: Entries cannot be posted into a fiscal period where `status = 'closed'`.
- [ ] **Date-Period Consistency**: Posting rejects entries where `entry_date` is outside the bounds of the assigned fiscal period.
- [ ] **Permanent Immutability**:
  - `UPDATE` or `DELETE` on a `posted` or `reversed` journal entry raises an immutability violation.
  - Modifying or deleting lines of a posted journal entry is rejected at the database trigger level.
- [ ] **Atomic Reversal**: `reverse_journal_entry()` creates an inverse journal entry, swaps debits and credits, links back to `reversal_of_id`, and posts it within a single database transaction.

---

## 3. GST Sales Invoicing

- [ ] **Tax Split Parity**:
  - Intra-state invoices reject non-zero IGST lines and enforce `CGST = SGST`.
  - Inter-state invoices reject non-zero CGST or SGST lines and require all tax in IGST.
  - Exempt and export supplies enforce zero tax across all lines.
- [ ] **Line-Header Synchronization**: `issue_sales_invoice()` recalculates and verifies that header totals equal the sum of line items.
- [ ] **Double-Entry Ledger Synchronization**: When `p_create_journal = true`, `issue_sales_invoice()` creates a balanced journal entry (Debiting Accounts Receivable, Crediting Revenue and Output Taxes) and binds `journal_entry_id` atomically.
- [ ] **Invoice Immutability**: Once `status = 'issued'`, direct modifications to invoice headers or lines are prohibited.

---

## 4. Audit Trail & Document Storage

- [ ] **Append-Only Auditing**: `UPDATE` and `DELETE` on `audit_events` are permanently blocked by database trigger.
- [ ] **Storage Vault Security**: Supabase Storage bucket `invoice-vault` is private; object download policies verify organisation membership from the file's path prefix.

---

## 5. How to Run Verification

### Method A: Local Supabase CLI
```bash
# 1. Start Docker Desktop and initialize local Supabase stack
supabase start

# 2. Reset database and run all sequential migrations
supabase db reset

# 3. Execute test suite
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/tests/database_test.sql
```

### Method B: Remote Supabase SQL Editor
1. Open the [Supabase Dashboard](https://supabase.com/dashboard/project/jylsaqqblbpwwxdkmlzd).
2. Navigate to the **SQL Editor**.
3. Open or paste `supabase/tests/database_test.sql` and run. All tests run inside a self-contained transaction that automatically rolls back upon completion.
