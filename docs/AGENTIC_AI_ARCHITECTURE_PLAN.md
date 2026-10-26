# Deku Finance — Agentic AI Financial Engine Architecture Plan
## 3-Layer Memory Architecture: Document Memory, Event Memory & Accounting Memory
### Evolving Dabby's Battle-Tested OCR Pipeline into a Manus AI-Style Financial Agent

> **Sovereign Foundation**: Single-engine integration with **Sarvam AI Document Intelligence API (`/doc-ai/v1`)** for printed, handwritten, and multi-lingual Indian business documents.  
> **Storage Prerequisite**: Supabase Storage Bucket `invoice-vault` (Private, RLS-secured) is active.  
> **Core Architectural Paradigm**: AI extracts facts into Canonical UFOs; deterministic compilers post balanced ledgers. Zero AI hallucinations in Accounting Memory.

---

## 1. Executive Summary & Evolution from Dabby

The previous platform version (**Dabby**) established a battle-tested pipeline for financial extraction and double-entry compilation:
- **Canonical Normalization**: Standardized raw OCR output into a Universal Financial Object (UFO).
- **Letterhead Entity Rule**: Automatically classified Sales vs Purchase by comparing the issuing letterhead against the active company identity.
- **Deterministic Compilation**: Compiled business events into balanced debits and credits using fixed role-to-account codes, preventing AI hallucinations in the general ledger.

**Deku Finance 2.0** elevates this foundation into a **Manus AI-style Autonomous Financial Agent** built around a strict **3-Layer Memory Hierarchy**:

```mermaid
graph TD
    subgraph Layer 1: Document Memory (Perception & Grounding)
        Vault["invoice-vault (Supabase Storage)"]
        Decrypt["In-Memory PDF Decrypt (PyMuPDF)"]
        Sarvam["Sarvam AI Doc Intelligence (/doc-ai/v1)"]
        Letterhead["Letterhead Issuer/Recipient Classifier"]
        UFO["Canonical UFO 2.0 Normalizer"]
        Vault --> Decrypt --> Sarvam --> Letterhead --> UFO
    end

    subgraph Layer 2: Event Memory (Episodic Staging & HITL)
        AgentKernel["Agentic Reasoning Kernel (Observe -> Think -> Plan -> Act -> Verify)"]
        TraceStream["Manus-Style Live Thought Stream (SSE)"]
        EventRegistry["Business Event Registry (VENDOR_BILLED, CUSTOMER_BILLED, etc.)"]
        VoucherProposal["Voucher Proposal (F4–F9) + Document Proof"]
        HITLState["State: WAITING_FOR_HUMAN_APPROVAL"]
        UFO --> AgentKernel
        AgentKernel --> TraceStream
        AgentKernel --> EventRegistry --> VoucherProposal --> HITLState
    end

    subgraph Layer 3: Accounting Memory (Deterministic Ledger Ground Truth)
        Approve["User 1-Click Approve / Edit"]
        Compiler["Deterministic ALERX Compiler (Debits = Credits)"]
        SuspenseGuard["Suspense Guard (Account 5999 Rounding Buffer)"]
        RPC["Atomic Stored Procedure: post_journal_entry()"]
        CoA["ALERX Chart of Accounts (Live Balances)"]
        DayBook["Day Book (Audit Trail + Document Proof)"]
        Statements["Financial Reports: Balance Sheet, P&L, Trial Balance"]
        HITLState --> Approve --> Compiler --> SuspenseGuard --> RPC
        RPC --> CoA
        RPC --> DayBook
        RPC --> Statements
    end
```

---

## 2. Comparative Matrix: Dabby vs Deku Finance 2.0

| Capability | Previous Platform (Dabby) | Deku Finance 2.0 (Manus Agentic Model) |
|---|---|---|
| **Primary OCR Engine** | Sarvam AI with PyMuPDF & Gemini fallbacks | **Unified Sarvam AI Doc Intelligence (`/doc-ai/v1`)** natively handling printed, handwritten, and 22 Indian regional languages. |
| **Document Storage** | `Doc_vault_Raw/{workbench_id}/...` | `invoice-vault/{organisation_id}/{entity_type}/{document_id}_{filename}` with RLS tenant isolation. |
| **Decryption** | PyMuPDF `doc.needs_pass` check | In-memory stream decryption preserving original file security. |
| **Classification Rule** | Regex heuristics + Groq LLM fallback | **Deterministic Letterhead Entity Rule** (Issuer vs Billed-To comparison with active `organisation.legal_name` and GSTIN). |
| **Intermediate Object** | UFO (Universal Financial Object) | **Canonical UFO 2.0** with native HSN/SAC, CGST/SGST/IGST tax splits, Bharat UPI QR, and bounding boxes. |
| **Chart of Accounts** | Flat 4-digit codes (`1000`, `1200`, `2000`, `4000`, `5000`) | **Indian GAAP ALERX 4-Tier Hierarchy** (`account_group` ➔ `ledger` ➔ `sub_ledger` ➔ `label`) with `is_postable` enforcement. |
| **Agent Reasoning** | Linear asynchronous Python workers | **Manus-Style Thought Trajectory** (`Observe -> Think -> Plan -> Act -> Verify`) streaming live thoughts to the user. |
| **User Experience** | Multi-tab UI (`VoucherEntryTab`, `FinancialImpactTab`) | **Split-Screen Interactive Agent Desk**: Left = Document Proof, Center = Agent Trace, Right = Live Voucher & Financial Statement Impact. |
| **Audit Traceability** | Isolated document logs | **Unbroken 3-Layer Lineage**: Raw file in `invoice-vault` $\leftarrow$ Event Memory approval audit $\leftarrow$ General Ledger Entry $\leftarrow$ Balance Sheet line item. |

---

## 3. Deep Dive: Layer 1 — Document Memory (Perception & Grounding)

**Document Memory** manages the ingestion, decryption, Sarvam AI transcription, and canonical data normalization of incoming documents.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       LAYER 1: DOCUMENT MEMORY                              │
│  • Storage: Supabase Storage (invoice-vault) + document_extractions         │
│  • Primary Ingestion: Single Sovereign Sarvam AI Doc OCR API                │
│  • Capabilities: Generated PDFs, Handwritten bills, Multi-lingual Indian docs│
│  • Normalization: Canonical Universal Financial Object (UFO 2.0)            │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1. Storage & Decryption Workflow
1. User drops document (PDF, PNG, JPG, JPEG, WEBP) into Deku Finance.
2. File is uploaded to Supabase Storage bucket `invoice-vault` under:
   `organisations/{org_id}/documents/{year}/{document_id}_{filename}`
3. **Decryption Check**: If the PDF is password-protected (e.g. ICICI/HDFC bank statements, official electricity bills):
   - The backend checks `needs_pass` via PyMuPDF in-memory.
   - If encrypted, the agent requests the document password from the user (or uses the organisation's default PAN/registered mobile) and decrypts the stream in-memory without saving unencrypted copies to disk.
4. An initial record is created in `public.invoice_documents` with its `sha256_hash` to mathematically prevent duplicate invoice entries.

### 2. Sarvam AI Multi-Modal Transcription
The document is dispatched to Sarvam AI Document Intelligence API:
```bash
POST https://api.sarvam.ai/doc-ai/v1/jobs
Header: "api-subscription-key: <SARVAM_API_KEY>"
Form Data:
  file: @document.pdf
  content_type: "mixed"      # Handles printed text + handwritten notes
  output_format: "md"        # Layout and table-preserving Markdown
```

**Why Sarvam excels for Indian commerce**:
- Transcribes handwritten transport biltis (LRs), local repair slips, and mandi receipts.
- Natively parses mixed-language bills (e.g. item descriptions in Hindi/Gujarati/Marathi with English amounts and GSTINs).
- Preserves tabular column alignments (HSN/SAC, quantities, rates, CGST, SGST, IGST, totals).

### 3. The Letterhead Entity Rule
Before constructing accounting entries, the classifier determines the document's commercial direction by comparing extracted names/GSTINs against the active organisation:

```typescript
// Deterministic Letterhead Rule
function classifyCommercialDirection(ufo: UFO, org: Organisation): "SALES" | "PURCHASE" | "SETTLEMENT" | "EXPENSE" {
  const issuerGstin = ufo.parties.issuer.gstin?.toUpperCase();
  const recipientGstin = ufo.parties.recipient.gstin?.toUpperCase();
  const issuerName = ufo.parties.issuer.name?.toLowerCase();
  const orgName = org.name.toLowerCase();

  // Rule 1: We are the Issuer -> Sales Invoice (Accounts Receivable)
  if (issuerGstin === org.gstin || issuerName.includes(orgName)) {
    return "SALES";
  }

  // Rule 2: External party is Issuer, We are Recipient -> Vendor Bill (Accounts Payable)
  if (recipientGstin === org.gstin || ufo.parties.recipient.name?.toLowerCase().includes(orgName)) {
    return "PURCHASE";
  }

  // Rule 3: Payment receipt / Petty cash voucher
  if (ufo.document_type.includes("receipt") || ufo.document_type.includes("petty_cash")) {
    return "EXPENSE";
  }

  return "PURCHASE"; // Default safe fallback
}
```

### 4. Canonical Universal Financial Object (UFO 2.0) Schema
Regardless of document format, Sarvam's extracted facts are normalized into the canonical UFO 2.0 schema:

```json
{
  "ufo_version": "2.0",
  "document_id": "doc_9912",
  "direction": "PURCHASE",
  "document_type": "vendor_invoice",
  "parties": {
    "issuer": {
      "name": "Apex Logistics & Transport",
      "gstin": "27AAACT1111A1Z1",
      "pan": "AAACT1111A",
      "state_code": "27",
      "address": "Bhiwandi Hub, Thane, Maharashtra 421302"
    },
    "recipient": {
      "name": "Deku Technologies Pvt Ltd",
      "gstin": "27ABCDE1234F1Z5",
      "state_code": "27",
      "address": "Andheri East, Mumbai 400069"
    }
  },
  "dates": {
    "document_date": "2026-10-24",
    "due_date": "2026-11-23"
  },
  "money": {
    "currency": "INR",
    "subtotal": 15000.00,
    "total_tax": 2700.00,
    "grand_total": 17700.00,
    "round_off": 0.00
  },
  "taxes": {
    "is_inter_state": false,
    "tax_lines": [
      { "type": "CGST", "rate": 9.0, "amount": 1350.00 },
      { "type": "SGST", "rate": 9.0, "amount": 1350.00 },
      { "type": "IGST", "rate": 0.0, "amount": 0.00 }
    ]
  },
  "line_items": [
    {
      "sr_no": 1,
      "description": "Freight & Transportation Charges (Handwritten LR #4812)",
      "hsn_sac": "996511",
      "quantity": 1,
      "unit": "TRIP",
      "unit_price": 15000.00,
      "taxable_amount": 15000.00,
      "cgst_amount": 1350.00,
      "sgst_amount": 1350.00,
      "igst_amount": 0.00,
      "total_amount": 17700.00
    }
  ],
  "payment_info": {
    "bank_name": "HDFC Bank",
    "account_number": "50200099887766",
    "ifsc_code": "HDFC0000123",
    "upi_qr_string": "upi://pay?pa=apexlogistics@hdfcbank&pn=ApexLogistics&am=17700.00"
  }
}
```

---

## 4. Deep Dive: Layer 2 — Event Memory (Voucher Proposal + Document Proof)

**Event Memory** is the agent's episodic workspace. It maps canonical UFO data to business events and synthesizes double-entry voucher proposals, pairing them with the document proof while waiting for human sign-off.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         LAYER 2: EVENT MEMORY                               │
│  • Storage: agent_sessions, agent_events, agent_voucher_proposals           │
│  • State: WAITING_FOR_HUMAN_APPROVAL                                        │
│  • Bundle: Proposed Voucher (F4–F9) + Direct Document Proof Link            │
│  • Features: Live thought streaming (SSE), tax math check, ALERX mapping    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1. Mapping Document Types to Business Events
Following the proven Dabby model, every document translates into an immutable Business Event:

| Document Type | Business Event | Default Accounting Voucher | Primary Debits & Credits |
|---|---|---|---|
| `vendor_invoice` / `purchase_bill` | `VENDOR_BILLED` | **F9 Purchase** | **Dr** Expense / Purchases<br>**Dr** Input GST (ITC)<br>**Cr** Sundry Creditors (Vendor) |
| `sales_invoice` / `tax_invoice` | `CUSTOMER_BILLED` | **F8 Sales** | **Dr** Sundry Debtors (Customer)<br>**Cr** Sales Operating Revenue<br>**Cr** Output GST Tax Payable |
| `vendor_payment_receipt` / `payment_advice` | `VENDOR_PAYMENT_MADE` | **F5 Payment** | **Dr** Sundry Creditors (Vendor)<br>**Cr** Bank / Cash Account |
| `customer_payment_receipt` | `CUSTOMER_PAYMENT_RECEIVED` | **F6 Receipt** | **Dr** Bank / Cash Account<br>**Cr** Sundry Debtors (Customer) |
| `expense_receipt` / `petty_cash` | `EXPENSE_INCURRED` | **F5 Payment / F7 Journal** | **Dr** Operating Expense<br>**Dr** Input GST (if tax bill)<br>**Cr** Cash / Director Imprest |
| `credit_note` | `CREDIT_NOTE_ISSUED` | **F7 Journal / Credit Note** | **Dr** Sales Returns / Revenue Reversal<br>**Dr** Output GST Reversal<br>**Cr** Sundry Debtors |
| `debit_note` | `DEBIT_NOTE_ISSUED` | **F7 Journal / Debit Note** | **Dr** Sundry Creditors<br>**Cr** Purchase Returns / Cost Reversal<br>**Cr** Input GST Reversal |
| `bank_statement` | `BANK_STATEMENT_RECONCILED` | **Batch F4 / F5 / F6** | Line-by-line reconciliation against open party invoices and contra transfers |

### 2. The Manus-Style Autonomous Reasoning Loop
Rather than a static script, the agent executes an observable, self-correcting loop:

1. **Observe**: Reads UFO 2.0 object + active ALERX Chart of Accounts (`accounts`) + party records (`parties`).
2. **Think**: Reasons about the commercial intent, GST Place of Supply rules (intra-state CGST/SGST vs inter-state IGST), and required double-entry legs.
3. **Plan**: Formulates an execution plan (e.g. *1. Match vendor Apex Logistics; 2. Map Freight Charges to CoA Account 5100-02; 3. Validate ₹15,000 + ₹2,700 tax = ₹17,700 total; 4. Check TDS u/s 194C*).
4. **Act**: Executes deterministic tools (`match_party`, `resolve_account`, `verify_tax`).
5. **Verify**: Confirms mathematical parity:
   $$\sum \text{Debits} - \sum \text{Credits} = 0.00$$
6. **Stage**: Bundles the proposed voucher with the document proof in state **`WAITING_FOR_HUMAN_APPROVAL`**.

---

## 5. Deep Dive: Layer 3 — Accounting Memory (Deterministic Compilation & Live Reflection)

**Accounting Memory** is the immutable mathematical ground truth. Once approved, transactions are permanently committed and immediately reflected across the entire financial suite.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       LAYER 3: ACCOUNTING MEMORY                            │
│  • Storage: journal_entries, journal_entry_lines, sales_invoices            │
│  • Compiler Invariant: Debits = Credits (D - C = 0), Suspense Guard (5999)  │
│  • Reflection: Instant live update of ALERX CoA, Day Book, Balance Sheet,   │
│                Profit & Loss, Trial Balance, and GSTR-3B Tax Registers      │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1. Role-to-Account Resolution to Deku's ALERX CoA
The deterministic compiler maps the UFO roles directly into Deku's 4-tier ALERX Chart of Accounts:

| Role Name | ALERX Group | Default Account Code | Description |
|---|---|---|---|
| `accounts_payable` | Liabilities (L) | `2100` | Sundry Creditors (Vendor Ledger) |
| `accounts_receivable` | Assets (A) | `1200` | Sundry Debtors (Customer Ledger) |
| `bank_clearing` | Assets (A) | `1110` | Primary Bank Operating Account |
| `cash_in_hand` | Assets (A) | `1120` | Petty Cash / Cash Desk |
| `operating_revenue` | Revenue (R) | `4100` | Domestic Sales & Service Revenue |
| `direct_expense` | Expense (E) | `5100` | Freight, Cartage, Direct Jobwork |
| `indirect_expense` | Expense (E) | `5200` | Rent, Electricity, Professional Fees |
| `input_tax_cgst` | Assets (A) | `1311` | Input CGST Credit Receivable |
| `input_tax_sgst` | Assets (A) | `1312` | Input SGST Credit Receivable |
| `input_tax_igst` | Assets (A) | `1313` | Input IGST Credit Receivable |
| `output_tax_cgst` | Liabilities (L) | `2211` | Output CGST Tax Payable |
| `output_tax_sgst` | Liabilities (L) | `2212` | Output SGST Tax Payable |
| `output_tax_igst` | Liabilities (L) | `2213` | Output IGST Tax Payable |
| **`suspense_rounding`** | Expense / Asset | **`5999`** | **Imbalance & Rounding Guard (₹0.01 – ₹0.99)** |

### 2. The Suspense Guard (Account 5999)
Commercial Indian invoices frequently contain 1 to 2 paisa rounding discrepancies due to different line-item rounding methods across ERPs.
- Following Dabby's battle-tested guard:
  $$\text{Discrepancy} = \left| \sum \text{Debits} - \sum \text{Credits} \right|$$
- If $\text{Discrepancy} \le ₹1.00$, the compiler automatically creates a balancing leg to **Round Off / Suspense (Account 5999)**.
- If $\text{Discrepancy} > ₹1.00$, the compiler rejects the voucher and flags a mathematical discrepancy in Event Memory, halting for user clarification.

### 3. Atomic Database Commitment & Real-Time Financial Cascade
Upon 1-click user approval:
1. Stored procedure `post_journal_entry(p_organisation_id, p_journal_id)` executes atomically.
2. The voucher transitions from `draft` to `posted` and receives a gapless sequence number.
3. Because Deku Finance's financial views calculate dynamically from posted journal lines, the transaction **immediately reflects across all screens**:

```
                              ┌────────────────────────────────────────┐
                              │  post_journal_entry() RPC Execution    │
                              └───────────────────┬────────────────────┘
                                                  │
         ┌────────────────────────┬───────────────┴───────────────┬────────────────────────┐
         ▼                        ▼                               ▼                        ▼
┌──────────────────┐    ┌──────────────────┐            ┌──────────────────┐     ┌──────────────────┐
│  ALERX Chart of  │    │  Day Book Audit  │            │  Financial Views │     │   GST Tax Hub    │
│  Accounts (COA)  │    │  (With Proof)    │            │  (P&L / BS / TB) │     │    (GSTR-3B)     │
│  Live Balances   │    │  Chronological   │            │  Instant Balance │     │  ITC Table 4     │
│  Rollup Dynamically│  │  Feed with Reversal│          │  Recalculation   │     │  Outward Table 3 │
└──────────────────┘    └──────────────────┘            └──────────────────┘     └──────────────────┘
```

---

## 6. Database Schema Plan (Migration 15: Agentic Memory System)

```sql
-- Migration 15: Agentic Memory System (Document, Event, Accounting Sandbox)

-- 1. Layer 1: Document Memory Extractions (UFO 2.0 Normalized Facts)
CREATE TABLE IF NOT EXISTS public.document_extractions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL,
  document_id uuid REFERENCES public.invoice_documents(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  sha256_hash text NOT NULL,
  sarvam_job_id text,
  document_nature text NOT NULL CHECK (document_nature IN ('printed', 'handwritten', 'mixed')),
  detected_language text DEFAULT 'en-IN',
  raw_markdown_output text NOT NULL,
  ufo_payload jsonb NOT NULL DEFAULT '{}'::jsonb, -- Canonical UFO 2.0
  confidence_score numeric(4,3) NOT NULL DEFAULT 1.000,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT uk_doc_extractions_org UNIQUE (organisation_id, id)
);

-- 2. Layer 2: Agent Sessions & Reasoning Trajectory
CREATE TABLE IF NOT EXISTS public.agent_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL,
  document_id uuid REFERENCES public.invoice_documents(id) ON DELETE SET NULL,
  goal_prompt text NOT NULL DEFAULT 'Process commercial document to ALERX voucher',
  status text NOT NULL CHECK (status IN (
    'extracting_sarvam', 
    'reasoning', 
    'waiting_human_approval', 
    'approved', 
    'rejected', 
    'posted'
  )) DEFAULT 'extracting_sarvam',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT uk_agent_sessions_org UNIQUE (organisation_id, id)
);

-- 3. Layer 2: Episodic Event Log (Manus Thought Stream)
CREATE TABLE IF NOT EXISTS public.agent_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL,
  session_id uuid NOT NULL REFERENCES public.agent_sessions(id) ON DELETE CASCADE,
  step_index int NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('thought', 'plan', 'tool_call', 'tool_result', 'human_edit', 'verification')),
  title text NOT NULL,
  content text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT uk_agent_events_step UNIQUE (session_id, step_index)
);

-- 4. Bridge to Layer 3: Staged Voucher Proposal (Voucher + Document Proof)
CREATE TABLE IF NOT EXISTS public.agent_voucher_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL,
  session_id uuid NOT NULL REFERENCES public.agent_sessions(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.invoice_documents(id),
  voucher_type text NOT NULL CHECK (voucher_type IN ('contra', 'payment', 'receipt', 'journal', 'sales', 'purchase')),
  voucher_date date NOT NULL,
  party_id uuid REFERENCES public.parties(id),
  header_memo text,
  proposed_lines jsonb NOT NULL, 
  -- Format: [{ account_id, account_code, account_name, debit, credit, description, hsn_sac, tax_rate }]
  total_debit numeric(15,2) NOT NULL,
  total_credit numeric(15,2) NOT NULL,
  is_balanced boolean GENERATED ALWAYS AS (total_debit = total_credit) STORED,
  approval_status text NOT NULL CHECK (approval_status IN ('waiting_approval', 'approved', 'rejected')) DEFAULT 'waiting_approval',
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  posted_journal_id uuid REFERENCES public.journal_entries(id), -- Points to Layer 3 once committed
  created_at timestamptz DEFAULT now() NOT NULL
);
```

---

## 7. Frontend UX: The Manus Split-Screen Agent Desk

The user interface delivers a real-time 3-panel split view (`/vouchers/ai-desk`):

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ Deku Finance — Autonomous Agentic Accounting Desk                                           │
├──────────────────────────────┬────────────────────────────────┬─────────────────────────────┤
│   DOCUMENT MEMORY (PROOF)    │      EVENT MEMORY (AGENT)      │  ACCOUNTING PROPOSAL (POST) │
│         (Left 35%)           │          (Center 30%)          │         (Right 35%)         │
├──────────────────────────────┼────────────────────────────────┼─────────────────────────────┤
│ [invoice-vault: bill_089.pdf]│ [Status: Waiting for Approval] │ [Voucher F9: Purchase]      │
│                              │                                │ Date: 24 Oct 2026           │
│ ┌──────────────────────────┐ │ ● Sarvam Multi-Lingual OCR     │ Vendor: Apex Logistics      │
│ │ Apex Logistics & Transport││   Detected: Hindi & English    │ GSTIN: 27AAACT1111A1Z1 [✓]  │
│ │ Handwritten LR Bill      │ │   Type: Mixed (Handwritten)    │                             │
│ │                          │ │   Extracted 1 line item [✓]    │ Debits:                     │
│ │ 1. Freight: ₹15,000      │ │                                │  • Freight Expense: ₹15,000 │
│ │ CGST (9%):   ₹1,350      │ │ ● Letterhead Rule            │  • Input CGST (9%):  ₹1,350 │
│ │ SGST (9%):   ₹1,350      │ │   Direction: PURCHASE (AP)     │  • Input SGST (9%):  ₹1,350 │
│ │ Total:      ₹17,700      │ │                                │ Credits:                    │
│ └──────────────────────────┘ │ ● ALERX CoA Mapping            │  • Apex Logistics AP:₹17,700│
│                              │   Mapped HSN 996511 ➔ Freight  │                             │
│ [Zoom] [Rotate] [Fullscreen] │                                │ Balance: ₹17,700 = ₹17,700  │
│                              │ ● Balance Invariant Check      │ Status: BALANCED [✓]        │
│ Click any line to highlight  │   Debits: ₹17,700.00           │ ┌─────────────────────────┐ │
│ the source Sarvam transcript │   Credits: ₹17,700.00          │ │  [✓ Approve & Post]    │ │
│ row on the original bill.    │   Discrepancy: ₹0.00 [✓]       │ │  [✎ Adjust Accounts]   │ │
│                              │                                │ └─────────────────────────┘ │
└──────────────────────────────┴────────────────────────────────┴─────────────────────────────┘
```

### The Post-Approval Instant Cascade:
When the accountant clicks **`[✓ Approve & Post]`**:
1. Stored procedure `post_journal_entry()` is invoked.
2. A success modal confirms: *"Voucher #PUR-2026-0042 posted to Accounting Memory."*
3. Live links offer immediate verification:
   - **[View in Day Book with Attached Proof]**
   - **[Inspect Balance Sheet Impact]**
   - **[View Updated ALERX Chart of Accounts]**

---

## 8. Phased Implementation Roadmap

### Phase 1: Storage & Sarvam OCR Client (Immediate)
- Connect frontend file uploader to the active `invoice-vault` bucket.
- Store the provided `SARVAM_API_KEY` in environment config.
- Create `src/lib/ai/sarvam-client.ts` implementing `https://api.sarvam.ai/doc-ai/v1/jobs` with `content_type: "mixed"`.

### Phase 2: UFO 2.0 Normalizer & Migration 15
- Run Migration 15 in Supabase (`document_extractions`, `agent_sessions`, `agent_events`, `agent_voucher_proposals`).
- Implement the UFO 2.0 transformer converting Sarvam Markdown tables into structured line items and tax splits.
- Apply the Letterhead Entity Rule to classify Sales vs Purchase direction.

### Phase 3: Event Memory & Human-In-The-Loop Agent Desk
- Build the streaming Agentic Loop (`Observe -> Think -> Plan -> Act -> Verify`).
- Bundle the Voucher Proposal with the Document Proof in state `WAITING_FOR_HUMAN_APPROVAL`.
- Implement the Suspense Guard (Account 5999) for sub-rupee rounding differences.

### Phase 4: Full Accounting Memory Cascade Verification
- Wire the "Approve & Post" button directly to the `post_journal_entry()` RPC.
- Validate that posted vouchers instantly cascade and display in:
  - Chart of Accounts (`/masters/chart-of-accounts`)
  - Day Book (`/day-book`)
  - Balance Sheet (`/reports/balance-sheet`)
  - Profit & Loss (`/reports/profit-loss`)
  - Trial Balance (`/reports/trial-balance`)
