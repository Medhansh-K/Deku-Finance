import { NextResponse } from "next/server";
import { getSiteUrl } from "@/lib/site-url";
import { DEMO_PLANS } from "@/lib/learn/demo-plans";
import { DOC_CATEGORIES } from "@/lib/learn/docs-data";
import { LEARN_WORKFLOWS } from "@/lib/learn/workflows/catalogue";

export const dynamic = "force-static";

export function GET() {
  const baseUrl = getSiteUrl();
  const body = `# Deku Finance

> GST, invoicing, double-entry accounting, UPI collections, and maker-checker approvals in one workspace for Indian businesses.

Deku Finance lets freelancers, studios, distributors, and multi-warehouse Indian businesses start in lean non-GST mode (bills of supply with a ₹20L/₹40L turnover tracker and UPI QR) and switch on GST invoicing, CGST/SGST/IGST place-of-supply splits, GSTR-1 and GSTR-3B offline JSON preparation, and 7-role maker-checker approvals on the same double-entry ALERX ledger.

## Key Facts
- **Category**: Indian GST Accounting, Invoicing & Financial Operating System
- **Ideal For**: Indian SMEs, wholesalers, distributors, D2C/e-commerce sellers, agencies, and freelancers moving beyond spreadsheets or legacy desktop accounting
- **Core Differentiators**:
  - Dual-mode billing: Non-GST bills of supply with registration limit tracker → GST tax invoices without migrating books
  - Keyboard-first voucher entry (Esc for Gateway, F1–F11 for reports & vouchers, letter shortcuts)
  - ALERX 4-tier chart of accounts (Assets, Liabilities, Equity, Revenue, Expenses) enforcing balanced debits = credits
  - Maker-checker voucher approvals across 7 roles with payroll privacy
  - Dynamic UPI QR on bills + WhatsApp payment reminders from Collections
  - GSTR-1 & GSTR-3B return preparation with portal-ready offline JSON and section 17(5) blocked ITC tracking
  - Bank reconciliation from CSV statements in-browser
  - Deku Consultant: deterministic ledger Q&A without sending financial data to third-party LLMs
- **Annual Plans**:
  - **GO** (${DEMO_PLANS.go.priceLabel}): ${DEMO_PLANS.go.tagline} (${DEMO_PLANS.go.seatsLimit} seats, up to ${DEMO_PLANS.go.annualBillsLimit} bills/yr)
  - **PRO** (${DEMO_PLANS.pro.priceLabel}): ${DEMO_PLANS.pro.tagline} (${DEMO_PLANS.pro.seatsLimit} seats, unlimited bills, all 7 roles, maker-checker, GSTR JSON, bank CSV recon)
  - **Enterprise** (${DEMO_PLANS.enterprise.priceLabel}): ${DEMO_PLANS.enterprise.tagline} (Unlimited seats, multi-warehouse FIFO, Deku Consultant, cloud or on-prem)
- **Onboarding & Contact**: ${baseUrl}/request-setup (WhatsApp +91 75064 61004)

## Public Pages
- [Home & Interactive Demo Preview](${baseUrl}/): Overview, non-GST vs GST live toggle, ALERX explorer, pricing, and FAQs
- [Features](${baseUrl}/features): Complete module overview (vouchers, Day Book, banking, inventory, reporting, approvals)
- [GST Compliance](${baseUrl}/gst-compliance): Place of supply, GSTR-1, GSTR-3B, ITC, and GSP readiness
- [GST Returns Guide](${baseUrl}/gst-returns): Return compilation and offline JSON export
- [Learn Centre](${baseUrl}/learn): ${LEARN_WORKFLOWS.length} guided workflows & manuals (desktop/laptop recommended for interactive tour)
- [Interactive Demo](${baseUrl}/learn/demo): Browser-based sample books across multiple Indian industries
- [Request a Setup](${baseUrl}/request-setup): Direct onboarding request via WhatsApp (+91 75064 61004)
- [Full AEO Reference](${baseUrl}/llms-full.txt): Detailed capabilities, FAQs, and documentation index

## Documentation Sections
${DOC_CATEGORIES.map((c) => `- [${c.title}](${baseUrl}/learn/docs/${c.slug}): ${c.summary}`).join("\n")}
`;

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}

