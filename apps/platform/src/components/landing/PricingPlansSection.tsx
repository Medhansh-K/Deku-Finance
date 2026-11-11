import React from "react";
import Link from "next/link";
import { Check, Minus } from "lucide-react";
import { DEMO_PLANS, type DemoPlanId } from "@/lib/learn/demo-plans";
import Reveal from "./Reveal";

/** Prices, seats and limits come from DEMO_PLANS, the config the demo enforces, so the page and the demo can't drift. */
const PLANS: { id: DemoPlanId; forWho: string; highlights: string[] }[] = [
  {
    id: "go",
    forWho: "For freelancers, solo studios and young businesses that want clean bills, UPI collections and books kept up to date.",
    highlights: [
      "Annual licence, set up in your own deployment",
      "Non-GST mode with a registration limit tracker",
      "Bills of supply and commercial invoices",
      "UPI QR on every bill",
      "ALERX double-entry ledger; debits must equal credits",
      "Balance Sheet, Profit & Loss and Trial Balance",
      "Day Book, cash and bank book, server-issued voucher numbers",
      "Draft vouchers you review before posting",
    ],
  },
  {
    id: "pro",
    forWho: "For growing teams that bill other businesses, file GST every month and want a second pair of eyes on entries.",
    highlights: [
      "Everything in GO, with no limit on bills",
      "GST mode with place-of-supply tax split",
      "GSTR-1 and GSTR-3B offline JSON for the portal",
      "ITC register with section 17(5) blocked credit and Rule 88A set-off",
      "Bank reconciliation from a statement CSV",
      "All 7 roles and maker-checker approvals",
      "Payroll figures hidden from roles that shouldn't see them",
      "HSN/SAC catalogue with rates filled in",
    ],
  },
  {
    id: "enterprise",
    forWho: "For multi-branch organisations that need more people, warehouses and Deku Consultant's full set of workflows.",
    highlights: [
      "Everything in PRO, with unlimited seats",
      "Multi-entity and multi-branch setup",
      "Deku Consultant across every department, answered from your ledger",
      "Multi-warehouse stock with FIFO valuation",
      "Marketplace settlement import across channels",
      "Direct filing, e-invoice and e-way bill once a GSP is connected",
      "Cloud or on-premises deployment",
      "Dedicated account manager and accountant-led onboarding",
    ],
  },
];

type Cell = string | boolean;
interface MatrixRow {
  name: string;
  description: string;
  go: Cell;
  pro: Cell;
  enterprise: Cell;
}

const limit = (n: number | null, unit: string) => (n === null ? "Unlimited" : `Up to ${n.toLocaleString("en-IN")} ${unit}`);
const P = DEMO_PLANS;

const MATRIX: { category: string; rows: MatrixRow[] }[] = [
  {
    category: "Invoicing, billing and collections",
    rows: [
      { name: "Bills per year", description: "Bills of supply, tax invoices and credit or debit notes.", go: limit(P.go.annualBillsLimit, "a year"), pro: "Unlimited", enterprise: "Unlimited" },
      { name: "UPI QR on bills", description: "QR from your UPI ID with the amount and bill reference filled in.", go: true, pro: "Plus payment links, once a provider is connected", enterprise: "Plus payment links, once a provider is connected" },
      { name: "Invoice fields", description: "PO number, vehicle, transporter, delivery terms and dispatch details.", go: "Standard fields (PO, terms)", pro: "More fields", enterprise: "Custom fields" },
      { name: "Products and services catalogue", description: "HSN/SAC codes, units and linked revenue accounts.", go: limit(P.go.catalogueItemsLimit, "items"), pro: "Unlimited", enterprise: "Unlimited, multi-warehouse" },
      { name: "MSME 45-day follow-up (section 43B(h))", description: "Spot amounts owed to micro and small enterprises for more than 45 days.", go: "WhatsApp reminder by hand", pro: "Ageing alerts and WhatsApp reminders", enterprise: "Ageing alerts and WhatsApp reminders" },
      { name: "Marketplace settlements", description: "Turn marketplace settlement sheets into sales, commission and TCS entries.", go: "Manual journal", pro: "Settlement sheet CSV import", enterprise: "Import across channels" },
    ],
  },
  {
    category: "GST and statutory compliance",
    rows: [
      { name: "Non-GST mode (section 22)", description: "Run without GST while below the registration limit.", go: true, pro: true, enterprise: true },
      { name: "Registration limit tracker", description: "Turnover against the ₹20 lakh and ₹40 lakh limits, as general guidance.", go: true, pro: true, enterprise: true },
      { name: "Tax by place of supply", description: "CGST and SGST within the state, IGST across states, GSTIN check digit.", go: "Intra and inter-state split", pro: "Place-of-supply rules and GSTIN check", enterprise: "Place-of-supply rules and GSTIN check" },
      { name: "GSTR-1 and GSTR-3B", description: "Prepared from your invoices and purchases, with offline JSON for the portal.", go: "Summary view", pro: "Offline JSON", enterprise: "Offline JSON; direct filing needs a GSP" },
      { name: "Input tax credit register", description: "Eligible credit kept apart from section 17(5) blocked credit.", go: "Purchase register", pro: "Rule 88A set-off and blocked credit", enterprise: "Rule 88A set-off and blocked credit" },
      { name: "E-invoice and e-way bill", description: "IRN, signed QR and e-way bills through the government systems.", go: false, pro: "JSON for offline tools", enterprise: "Needs a GSP connection" },
    ],
  },
  {
    category: "ALERX double-entry ledger",
    rows: [
      { name: "Four-tier chart of accounts", description: "Group, ledger, sub-ledger and the label you post to.", go: "Standard chart", pro: "Your own hierarchy and sub-ledgers", enterprise: "A chart per entity" },
      { name: "Debits equal credits", description: "Posting refuses a voucher whose debits and credits differ.", go: true, pro: true, enterprise: true },
      { name: "Server-issued voucher numbers", description: "Sequential numbers the browser can't choose.", go: true, pro: true, enterprise: true },
      { name: "Draft review", description: "Edit a draft before it posts, with nothing left behind in the books.", go: true, pro: true, enterprise: true },
      { name: "Bank reconciliation", description: "Match a statement CSV against the bank ledger.", go: "Cash and bank book", pro: "Statement CSV matching", enterprise: "Statement CSV matching" },
      { name: "General ledger", description: "Every entry per account with running balances.", go: "Account view", pro: "Drill-down and CSV export", enterprise: "Drill-down and CSV export" },
    ],
  },
  {
    category: "Reports and Deku Consultant",
    rows: [
      { name: "Balance Sheet and Profit & Loss", description: "Computed from posted double-entry balances.", go: true, pro: "Any date range", enterprise: "Any date range" },
      { name: "Trial Balance and ratios", description: "Current, quick, debt-to-equity and net margin.", go: "Trial Balance", pro: "Trial Balance and core ratios", enterprise: "Trial Balance and core ratios" },
      { name: "Deku Consultant", description: "Answers from your ledger figures with fixed logic, not an outside AI service.", go: "Health insights", pro: "FP&A, cash and expenses", enterprise: "Every department and workflow" },
      { name: "Cash Flow statement", description: "Operating, investing and financing cash movement.", go: "Inflow and outflow", pro: "Three-part statement", enterprise: "Three-part statement" },
    ],
  },
  {
    category: "Governance, security and deployment",
    rows: [
      { name: "User seats", description: "People who can sign in to the company.", go: `${P.go.seatsLimit} (1 admin, 1 accountant)`, pro: `${P.pro.seatsLimit}`, enterprise: "Unlimited" },
      { name: "Roles", description: "Owner, CFO, admin, accountant, analyst, auditor and viewer.", go: "2 roles", pro: "All 7 roles", enterprise: "All 7 roles" },
      { name: "Maker-checker approvals", description: "A second person approves before a voucher posts.", go: "Single person posts directly", pro: "Journals and payments", enterprise: "Journals and payments" },
      { name: "Payroll privacy", description: "Salary figures hidden from roles that shouldn't see them.", go: "Standard access", pro: true, enterprise: true },
      { name: "Audit log", description: "A record of sign-ins, entries and approvals.", go: "Activity log", pro: "Full audit log", enterprise: "Full audit log" },
      { name: "Deployment", description: "Where Deku runs.", go: "Your own deployment", pro: "Your own deployment", enterprise: "Cloud or on premises" },
      { name: "Support", description: "How to reach us.", go: "Email and help centre", pro: "Phone and WhatsApp", enterprise: "Dedicated account manager" },
    ],
  },
];

function CellValue({ v }: { v: Cell }) {
  if (v === true) return <Check aria-label="Included" className="h-[18px] w-[18px] text-brand-strong" />;
  if (v === false) return <Minus aria-label="Not included" className="h-[18px] w-[18px] text-ink-subtle" />;
  return <>{v}</>;
}

export default function PricingPlansSection() {
  return (
    <section id="pricing" aria-labelledby="pricing-title" className="scroll-mt-20 border-t border-line bg-surface">
      <div className="mx-auto max-w-[1200px] px-5 py-24 sm:px-8 lg:py-36">
        <Reveal className="max-w-[680px]">
          <h2 id="pricing-title" className="text-[32px] font-semibold leading-[1.1] tracking-[-0.03em] text-ink sm:text-[40px]">
            One yearly licence for each stage of growth
          </h2>
          <p className="mt-5 text-[17px] leading-[1.55] text-ink-soft sm:text-[18px]">
            Every plan is an annual licence with setup by a partner near you, product and tax updates, and your
            company&apos;s data kept to itself. No charge per invoice or per transaction.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-5 lg:grid-cols-3">
          {PLANS.map(({ id, forWho, highlights }, i) => {
            const plan = DEMO_PLANS[id];
            const featured = id === "pro";
            return (
              <Reveal key={id} delay={i * 80}>
                <div
                  className={`flex h-full flex-col rounded-panel border p-7 transition-[border-color,box-shadow] duration-300 sm:p-8 ${
                    featured
                      ? "border-brand bg-surface shadow-[inset_0_3px_0_var(--color-brand),0_24px_60px_-30px_rgb(5_184_165/0.45)]"
                      : "border-line bg-surface hover:border-line-strong"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-[22px] font-semibold tracking-[-0.02em] text-ink">{plan.name}</h3>
                    {featured && (
                      <span className="inline-flex h-[24px] items-center rounded-chip bg-brand-wash px-2.5 text-xs font-medium text-brand-strong">
                        Most popular
                      </span>
                    )}
                  </div>
                  <p className="mt-2.5 text-[14.5px] leading-[1.55] text-ink-muted lg:min-h-[90px]">{forWho}</p>
                  <p className="mt-6 flex items-baseline gap-2 border-b border-line pb-6">
                    <span className="text-[40px] font-semibold tabular-nums leading-none tracking-[-0.035em] text-ink">
                      ₹{plan.priceInrYearly.toLocaleString("en-IN")}
                    </span>
                    <span className="text-[14px] text-ink-muted">a year</span>
                  </p>
                  <ul className="mt-6 flex-1 space-y-3">
                    {highlights.map((h) => (
                      <li key={h} className="flex gap-3 text-[14.5px] leading-[1.45] text-ink-soft">
                        <Check aria-hidden="true" className="mt-[3px] h-4 w-4 shrink-0 text-brand-strong" />
                        <span>{h}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/request-setup"
                    className={`mt-8 inline-flex h-11 items-center justify-center rounded-ctl text-[14.5px] font-medium transition-[background-color,transform] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 ${
                      featured ? "bg-brand text-ink hover:bg-brand-hover" : "border border-line-strong bg-surface text-ink hover:bg-canvas"
                    }`}
                  >
                    Request a setup
                  </Link>
                </div>
              </Reveal>
            );
          })}
        </div>

        <details className="group mt-6 rounded-panel border border-line">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-panel px-6 py-5 transition-colors hover:bg-canvas/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand [&::-webkit-details-marker]:hidden">
            <span>
              <span className="block text-[16px] font-medium text-ink">Compare every capability</span>
              <span className="mt-0.5 block text-[14px] text-ink-muted">Billing, GST, the ledger, reports and governance across GO, PRO and Enterprise.</span>
            </span>
            <span
              aria-hidden="true"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line-strong text-[18px] leading-none text-ink-soft transition-transform duration-300 group-open:rotate-45"
            >
              +
            </span>
          </summary>
          <div className="overflow-x-auto border-t border-line">
            <table className="w-full min-w-[820px] text-left text-[14px]">
              <colgroup>
                <col className="w-[37%]" />
                <col className="w-[21%]" />
                <col className="w-[21%]" />
                <col className="w-[21%]" />
              </colgroup>
              <thead>
                <tr className="text-[13.5px]">
                  <th scope="col" className="px-6 py-4 font-medium text-ink-muted">Capability</th>
                  {PLANS.map(({ id }) => (
                    <th
                      key={id}
                      scope="col"
                      className={`px-5 py-4 font-semibold text-ink ${id === "pro" ? "bg-brand-wash" : ""}`}
                    >
                      {P[id].name}
                      <span className="block text-[12.5px] font-normal tabular-nums text-ink-muted">
                        ₹{P[id].priceInrYearly.toLocaleString("en-IN")} a year
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              {MATRIX.map((cat) => (
                <tbody key={cat.category}>
                  <tr>
                    <th colSpan={4} scope="colgroup" className="bg-canvas px-6 pb-2.5 pt-5 text-[14px] font-semibold text-ink">
                      {cat.category}
                    </th>
                  </tr>
                  {cat.rows.map((r) => (
                    <tr key={r.name} className="border-t border-line align-top">
                      <th scope="row" className="px-6 py-4 font-normal">
                        <span className="block font-medium text-ink">{r.name}</span>
                        <span className="mt-0.5 block text-[13px] leading-[1.45] text-ink-muted">{r.description}</span>
                      </th>
                      {(["go", "pro", "enterprise"] as const).map((id) => (
                        <td key={id} className={`px-5 py-4 text-ink-soft ${id === "pro" ? "bg-brand-wash/60" : ""}`}>
                          <CellValue v={r[id]} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
          </div>
          <div className="flex flex-col gap-2 border-t border-line px-6 py-4 text-[13.5px] text-ink-muted sm:flex-row sm:items-center sm:justify-between">
            <p>Every plan: balanced double-entry books, an audit log and no shared passwords.</p>
            <p>
              Licensing questions:{" "}
              <a href="tel:+917506461004" className="font-medium text-ink hover:text-brand-strong">
                +91 75064 61004
              </a>
            </p>
          </div>
        </details>
      </div>
    </section>
  );
}
