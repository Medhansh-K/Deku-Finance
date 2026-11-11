# DEKU PLATFORM ERP — ARCHITECTURE SPECIFICATION
## Interface 3: Customer ERP Runtime & Public Learn Centre

**Service Port:** `http://localhost:3000`  
**Container Name:** `deku-frontend-platform`  
**Backend Port:** `http://localhost:8080` (`deku-backend-platform`)  
**Access Model:** Public Visitors (Landing, Features, GST, Learn) & Authenticated Tenants (Gateway ERP)  
**Security Tier:** Level 3 Multi-Tenant Accounting Runtime  

---

## 1. System Responsibility & 3-Layer Abstraction

The **Deku Platform ERP** is the primary customer-facing application. It is architected across three strict layers:

```
┌────────────────────────────────────────────────────────────────────────┐
│                          SHELL (Next.js 16)                            │
│  Desktop Gateway OS • F1-F11 Keyboard Navigation • Fast Data Tables    │
│  Public Educational Hubs (/features, /gst-compliance, /learn)          │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │ JSON RPC / REST (Port 8080)
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        KERNEL (Rust Axum 0.8)                          │
│  High-Performance Financial Math • Session Cookies • Report Rollups    │
│  Banking Reconciliation • Files & Storage • Integrations Seams         │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │ Authenticated SQL (Port 5433)
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        CORE (PostgreSQL 16)                            │
│  ALERX Ledger Conservation (D=C) • Posted Immutability Triggers        │
│  Row-Level Security (RLS) • Composite Unique Keys • 51 Migrations      │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Dual Accounting Modes

Deku supports the complete commercial spectrum of Indian business:

1. **Mode A: Pure Accounting Mode (Section 22 CGST Act Exemption)**:
   - For freelancers, solo consultants, and micro-suppliers with turnover below ₹20 Lakhs (services) or ₹40 Lakhs (goods).
   - Issues clean Bills of Supply and Commercial Invoices with zero tax overhead.
   - Embeds Bharat UPI QR codes for instant payment settlement.
   - Built-in turnover tracker monitoring proximity to the statutory threshold.
2. **Mode B: GST Registered Enterprise Mode**:
   - Computes CGST, SGST, and IGST automatically based on customer Place of Supply (POS).
   - Validates HSN/SAC codes and statutory tax rate bounds.
   - Generates offline GSTR-1 and GSTR-3B JSON exports for direct upload to `gst.gov.in`.

---

## 3. Financial Invariants Enforced by Core & Kernel

1. **Double-Entry Parity ($\sum \text{Debits} \equiv \sum \text{Credits}$)**:
   - The database trigger rejects any unbalanced journal entry.
2. **Statutory Immutability**:
   - Once posted, a voucher can never be modified or deleted. Errors require an equal-and-opposite reversal voucher.
3. **ALERX 4-Tier Hierarchy**:
   - Accounts: `Group Header ➔ Ledger ➔ Sub-Ledger ➔ Postable Leaf`. Transactions only post to postable leaves.
4. **Desktop Speed (F1–F11)**:
   - Zero mouse dependency for rapid data entry.

