# Deku Learn Centre — Documentation Structure

**Source Module:** [`apps/platform/src/lib/learn/docs-data.ts`](file:///c:/Users/Medhansh%20Pc/Desktop/Deku%20Finance/apps/platform/src/lib/learn/docs-data.ts)  
**Design Principle:** Structured, version-controlled content in TypeScript data modules inside `apps/platform` so public manuals load reliably without requiring Admin Portal persistence (`apps/admin` currently stores state in memory).

---

## Categories & Initial Articles

| Order | Category Slug | Category Title | Seeded Articles (Phase 2 Foundation) | Demo Cross-Link Target |
| :---: | :--- | :--- | :--- | :--- |
| `01` | `getting-started` | Getting Started | `introduction-to-deku`, `gateway-and-keyboard-shortcuts` | `aster-trading` → `/gateway` |
| `02` | `accounting` | Financial & Accounting Manuals | `alerx-chart-of-accounts`, `vouchers-and-day-book` | `aster-trading` → `/masters/chart-of-accounts`, `/vouchers` |
| `03` | `operations` | Operational Manuals | `sales-invoicing-and-collections`, `inventory-and-multi-warehouse`, `banking-and-marketplace-recon` | `northstar-consulting` → `/gst`, `meridian-retail` → `/inventory`, `urbannest-retail` → `/reconciliation` |
| `04` | `gst-compliance` | GST & Compliance | `gst-pos-itc-and-returns` | `aster-trading` → `/gst/returns` |
| `05` | `roles-and-governance` | Roles & Governance | `seven-roles-and-maker-checker` | `northstar-consulting` → `/approvals` |
| `06` | `financial-intelligence` | Financial Intelligence | `reports-fpa-and-deku-konsultant` | `northstar-consulting` → `/consultant` |
| `07` | `plans-and-utilisation` | Plans & Utilisation | `go-pro-enterprise-entitlements` | `aster-trading` → `/settings/license` |
| `08` | `technical` | Technical Documentation | `core-kernel-shell-architecture` | `aster-trading` → `/audit` |

## Documentation Features Implemented
* Full-text search across article titles, summaries, tags, headings, paragraphs, and bullets (`searchDocArticles`).
* Tag chip filtering (`#rbac`, `#alerx`, `#gst`, `#fifo`, etc.).
* Article sticky Table of Contents (`#section-id` anchor navigation), reading time estimate, version (`2.0`), last updated date (`2026-11-10`), Previous/Next links, and Related Articles.
* Static parameter pre-generation (`generateStaticParams`) for Next.js 16 App Router.

