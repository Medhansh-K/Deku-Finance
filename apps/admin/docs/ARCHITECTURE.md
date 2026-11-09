# DEKU ADMIN CONSOLE — ARCHITECTURE SPECIFICATION
## Interface 1: Internal Platform Administration

**Service Port:** `http://localhost:3001`  
**Container Name:** `deku-frontend-admin`  
**Backend Port:** `http://localhost:8081` (`deku-backend-admin`)  
**Access Model:** Strictly Internal (Superadmin & Authorized Platform Staff)  
**Security Tier:** Level 1 Restricted  

---

## 1. System Responsibility & Purpose

The **Deku Admin Console** is the internal authority interface of the Deku Finance platform. It is strictly segregated from both the customer-facing ERP runtime (`:3000`) and the distributor partner portal (`:3002`).

### Core Responsibilities:
1. **Master Authority Oversight**: Superadmin control across all registered tenant organisations, regional distributors, and issued software licenses.
2. **Dual-Gate Commercial Verification**: Inspecting and approving/rejecting commercial proof documents (Tax Invoices, signed MOUs, Client Purchase Orders) submitted by regional distributors before client activation keys are generated.
3. **Regional Territory Allocations**: Assigning state codes and PIN code geographic clusters to exclusive distributors to prevent partner cannibalization.
4. **Partner Quotas & Credit Management**: Managing allocated client seat pools and prepaid CA onboarding service credits for each authorized distributor.
5. **Sub-Admin Role-Based Delegation**: Provisioning platform administrators across three specialized operational roles:
   - `super_admin`: Full authority across platform parameters, distributor terminations, and sub-admin provisioning.
   - `license_manager`: Dedicated authority to inspect commercial documents and approve/reject client license requests.
   - `support_admin`: Read-only access to tenant audit logs and technical telemetry for customer troubleshooting.

---

## 2. Boundary Isolation & Security Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                        DEKU ADMIN CONSOLE (:3001)                      │
│                                                                        │
│  ┌───────────────────────┐  ┌──────────────────────┐  ┌─────────────┐  │
│  │ Master Authority Desk │  │ Dual-Gate Verifier   │  │ Territory   │  │
│  │ (medhanshk10@gmail)   │  │ (Invoice / MOU Proof)│  │ Allocations │  │
│  └───────────────────────┘  └──────────────────────┘  └─────────────┘  │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │ Direct Internal API (:8081)
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      DEKU BACKEND ADMIN SERVICE                        │
│                Isolated Rust Axum Microservice (:8081)                 │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │ Authenticated SQL
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      SHARED POSTGRESQL PERSISTENCE                     │
│               Schema: public • Port: 5433 (deku-postgres)              │
└────────────────────────────────────────────────────────────────────────┘
```

### Isolation Invariants:
1. **Zero Customer ERP Leakage**: This container bundles zero customer ERP screens (no Gateway, no Vouchers desk, no Day Book).
2. **Network Layer Boundary**: Runs on isolated internal Docker port `3001`, completely decoupled from port `3000` (Customer ERP) and port `3002` (Distributor Portal).
3. **Independent Deployment Lifecycle**: The Admin Console can be rebuilt, patched, or restarted independently without interrupting active customer bookkeeping sessions.

---

## 3. Dual-Gate Verification Workflow

```mermaid
sequenceDiagram
    autonumber
    actor Dist as Regional Distributor (:3002)
    actor Admin as Platform Admin (:3001)
    participant Store as Ecosystem Database
    actor Client as End-User Customer (:3000)

    Dist->>Store: Submits License Request + Attaches Tax Invoice / Contract PDF
    Note over Store: Request State = 'pending_verification'
    Admin->>Store: Inspects Commercial Proof (Doc #, Amount, PDF preview)
    alt Approved by Admin
        Admin->>Store: Executes 'approve_license'
        Note over Store: Generates cryptographically secure key `DEKU-PRO-XXXX-XXXX`
        Store->>Dist: License Key Issued & Visible in Partner Ledger
        Dist->>Client: Delivers Key for Gateway Activation
    else Rejected by Admin
        Admin->>Store: Executes 'reject_license' with mandatory audit memo
        Store->>Dist: Rejection memo logged; seat quota restored
    end
```

