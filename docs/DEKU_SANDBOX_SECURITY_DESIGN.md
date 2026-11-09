# DEKU FINANCE — SANDBOX SECURITY DESIGN

**Document Identifier:** `DEKU_SANDBOX_SECURITY_DESIGN.md`  
**Security Classification:** Critical Infrastructure Standard  
**Target:** Anonymous Public Learn Centre & Isolated Interactive Sandbox  

---

## 1. Security Objectives & Threat Model

The Public Learn Centre allows anonymous, unregistered visitors to interact with a live Deku Financial OS runtime. This creates specific threat vectors that must be mitigated by design:

```
                            ANONYMOUS PUBLIC VISITOR
                                       │
                      ┌────────────────┴────────────────┐
                      ▼                                 ▼
             POTENTIAL THREATS                  PROTECTIVE CONTROLS
             1. Access Real Customer Data       ➜ Isolated Demo Tenant IDs Only
             2. Pollute Shared Demo State       ➜ Ephemeral In-Browser State Overrides
             3. Cross-Session Data Leakage      ➜ Device-Scoped Anonymous Session Tokens
             4. Trigger External Side Effects   ➜ Strict Sandbox-Only Mock Adapters
             5. Escalate to Admin/Distributor   ➜ Server-Side Proxy Route Traps
             6. Denial of Service / Memory Blow ➜ In-Memory Size Caps & Rate Limits
```

---

## 2. Six Mandatory Sandbox Security Invariants

### Invariant 1: Complete Isolation from Real Customer Databases
* Anonymous public learn sessions operate strictly within designated, read-only demo organization IDs:
  * `d0000000-0000-4000-8000-000000000001` (`Demo Traders Pvt Ltd` — PRO Trading)
  * `d0000000-0000-4000-8000-000000000002` (`Demo Creative Studio` — GO Services)
* Any query containing an `organisation_id` outside the demo set is rejected at the API proxy layer with HTTP 403 Forbidden.

### Invariant 2: Zero External Side Effects (No Live Gateways or Portals)
* **GST Filing:** The live GSP client ([`backend/src/integrations/gsp.rs`](../backend/src/integrations/gsp.rs)) operates in `Choice::Sandbox`. Calls to `/gst/:period/:type/file` generate synthetic, verifiable legal ARNs without contacting `gst.gov.in`.
* **Payments:** Razorpay webhook and link creation operate in labelled sandbox mode. Real UPI money cannot be collected or transferred.
* **Email & Invites:** Invitation links generated during the user management tutorial are rendered directly in the UI as shareable links; no SMTP or background email is dispatched.

### Invariant 3: Interface Isolation (No Admin or Distributor Boundary Leaks)
* The public learn session runs under `DEKU_INTERFACE=platform`.
* [`src/proxy.ts`](../src/proxy.ts) traps and rejects any attempt from a public learn route to reach `/admin`, `/distributor`, `/api/ecosystem/admin`, or `/api/ecosystem/distributor`.

### Invariant 4: Ephemeral State Isolation Across Concurrent Anonymous Users
To prevent Visitor A's newly created invoice from appearing on Visitor B's screen:
1. **Baseline Database Seed:** The Postgres demo tables serve as the immutable baseline snapshot.
2. **Ephemeral Session Layer:** Any mutations executed during an interactive tutorial (e.g. creating a new party or saving a draft voucher) are stored in the user's `sessionStorage` under `deku_sandbox_mutations`.
3. **Virtual Query Interceptor:** The client-side API layer merges the baseline data with the session's ephemeral mutations before rendering tables or calculating totals.
4. **Concurrent Multi-User Safety:** Concurrent anonymous users never see or modify each other's sandbox transactions.

### Invariant 5: 1-Click State Reset & Session Teardown
* Every interactive tutorial header features a prominent **"Reset Sandbox"** button.
* Clicking reset executes:
  1. Clears `sessionStorage.removeItem("deku_sandbox_mutations")`.
  2. Resets tutorial step progress back to step 1.
  3. Reloads the clean baseline company state in < 50ms.
* Closing the browser tab automatically garbage-collects all session mutations.

### Invariant 6: Strict Non-Privileged Access
* Public learn endpoints expose zero secret keys (`DATA_ENCRYPTION_KEY`, `JWT_SECRET`, or `CRON_SECRET`) to the browser bundle.
* All client requests to the public learn documentation and tutorials run unauthenticated without requiring authorization cookies or tokens.

