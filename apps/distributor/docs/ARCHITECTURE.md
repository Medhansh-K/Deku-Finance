# DEKU DISTRIBUTOR PORTAL — ARCHITECTURE SPECIFICATION
## Interface 2: Franchise Operations & Client Onboarding

**Service Port:** `http://localhost:3002`  
**Container Name:** `deku-frontend-distributor`  
**Backend Port:** `http://localhost:8082` (`deku-backend-distributor`)  
**Access Model:** Regional Franchise Partners & Authorized Distributors  
**Security Tier:** Level 2 Partner Workspace  

---

## 1. System Responsibility & Purpose

The **Distributor Portal** provides regional franchise partners with an independent commercial interface to sell Deku Finance software licenses, provision customer seat expansions, log CA-assisted onboarding services, and manage inbound territory leads.

### Core Responsibilities:
1. **Commercial Two-Condition Protocol**:
   - **Condition 1 (Client Metadata)**: Company Name, Contact Person, Authorized Login Email, Phone, Optional GSTIN, and Requested Plan Tier (`GO`, `PRO`, `ENTERPRISE`).
   - **Condition 2 (Document Proof)**: Mandatory attachment of an issued Tax Invoice, signed MoU, or Customer Quote with document number and commercial amount. A license key cannot be minted without verifiable commercial proof.
2. **Quota & Scope Tracking**:
   - Real-time visibility into the distributor's allocated seat bank (e.g. 50 remaining seats) and prepaid CA onboarding service credits (e.g. 100 hrs).
3. **Territory Lead Pipeline**:
   - Exclusively displays prospective client leads assigned to the partner's designated state and PIN codes.
4. **Self-Service Provisions**:
   - Immediate seat expansion and onboarding service allocation for active client accounts.

---

## 2. Boundary Isolation & Security Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                     DEKU DISTRIBUTOR PORTAL (:3002)                    │
│                                                                        │
│  ┌───────────────────────┐  ┌──────────────────────┐  ┌─────────────┐  │
│  │ Partner Profile/Quota │  │ New Client Request   │  │ Territory   │  │
│  │ (Maharashtra Tech)    │  │ (Dual-Gate Protocol) │  │ Leads Desk  │  │
│  └───────────────────────┘  └──────────────────────┘  └─────────────┘  │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │ Direct Partner API (:8082)
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   DEKU BACKEND DISTRIBUTOR SERVICE                     │
│                Isolated Rust Axum Microservice (:8082)                 │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │ Authenticated SQL
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      SHARED POSTGRESQL PERSISTENCE                     │
│               Schema: public • Port: 5433 (deku-postgres)              │
└────────────────────────────────────────────────────────────────────────┘
```

### Security Invariants:
1. **Territory Data Isolation**: A distributor in Maharashtra (`DIST-MH-01`) cannot see leads or clients belonging to a Gujarat or Karnataka partner.
2. **No Direct License Minting**: Distributors cannot unilaterally mint license keys. All requests queue into Deku Admin (`:3001`) for commercial verification.
3. **Zero ERP Cross-Pollination**: Customer financial records (general ledgers, vouchers, P&L statements) are never exposed to the distributor portal.

