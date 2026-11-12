import React from "react";
import Link from "next/link";
import { Check, Minus } from "lucide-react";
import { DEMO_PLANS, type DemoPlanId } from "@/lib/learn/demo-plans";
import Reveal from "./Reveal";

/**
 * Prices, seats and limits come from DEMO_PLANS (the config the demo enforces), and each row below
 * follows that file's plan gates, so the page, the demo and the plan rules say the same thing.
 */
const P = DEMO_PLANS;
const ORDER: DemoPlanId[] = ["go", "pro", "enterprise"];

const PLANS: Record<DemoPlanId, { idea: string; forWho: string; plusLabel?: string; adds: string[] }> = {
  go: {
    idea: "Clean books to start",
    forWho: "Freelancers, studios and young businesses that want proper bills, UPI collections and books that are always up to date.",
    adds: [
      "Non-GST mode with a registration limit tracker",
      "Bills of supply and GST tax invoices",
      "UPI QR on every bill",
      "Double-entry vouchers from the keyboard (F4 to F9)",
      "Day Book, Profit & Loss, Balance Sheet and Trial Balance",
      "GSTR-1 and GSTR-3B summary view",
      "Collections with WhatsApp reminder links",
    ],
  },
  pro: {
    idea: "GST with a team",
    forWho: "Growing businesses that bill other businesses, file GST every month and want a second person to check entries before they post.",
    plusLabel: "Everything in GO, plus",
    adds: [
      "GSTR-1 and GSTR-3B offline JSON for the portal",
      "Input tax credit register with section 17(5) blocked credit",
      "Bank reconciliation from a statement CSV",
      "All 7 roles and maker-checker approvals",
      "Payroll figures hidden from roles that shouldn't see them",
      "Marketplace settlement sheet import",
      "Payment links, once a payment provider is connected",
    ],
  },
  enterprise: {
    idea: "Every branch, every warehouse",
    forWho: "Organisations with more people, several locations and stock in more than one warehouse, who want the whole suite.",
    plusLabel: "Everything in PRO, plus",
    adds: [
      "Unlimited seats",
      "Multi-warehouse stock with FIFO valuation and transfers",
      "Deku Consultant across every department, answered from your ledger",
      "Marketplace settlements across channels",
      "Direct GST filing, e-invoice and e-way bill through a GSP connection",
      "Cloud or on-premises deployment",
      "Dedicated account manager and accountant-led onboarding",
    ],
  },
};

const fmt = (n: number) => n.toLocaleString("en-IN");
const perMonth = (yearly: number) => `about ₹${fmt(Math.round(yearly / 12))} a month, billed yearly`;
const LIMITS: { label: string; value: (id: DemoPlanId) => string }[] = [
  { label: "Seats", value: (id) => (P[id].seatsLimit === null ? "Unlimited" : String(P[id].seatsLimit)) },
  { label: "Bills a year", value: (id) => (P[id].annualBillsLimit === null ? "Unlimited" : fmt(P[id].annualBillsLimit!)) },
  { label: "Catalogue items", value: (id) => (P[id].catalogueItemsLimit === null ? "Unlimited" : fmt(P[id].catalogueItemsLimit!)) },
];

type Cell = string | boolean;
interface MatrixRow {
  name: string;
  description: string;
  go: Cell;
  pro: Cell;
  enterprise: Cell;
}

const limit = (n: number | null, unit: string) => (n === null ? "Unlimited" : `Up to ${fmt(n)} ${unit}`);

const MATRIX: { category: string; rows: MatrixRow[] }[] = [
  {
    category: "Scale and people",
    rows: [
      { name: "User seats", description: "People who can sign in to the company.", go: `${P.go.seatsLimit}`, pro: `${P.pro.seatsLimit}`, enterprise: "Unlimited" },
      { name: "Bills per year", description: "Bills of supply, tax invoices and credit or debit notes.", go: limit(P.go.annualBillsLimit, "a year"), pro: "Unlimited", enterprise: "Unlimited" },
      { name: "Catalogue items", description: "Products and services with HSN/SAC codes and tax rates.", go: limit(P.go.catalogueItemsLimit, "items"), pro: "Unlimited", enterprise: "Unlimited" },
      { name: "Roles", description: "Owner, CFO, admin, accountant, analyst, auditor and viewer.", go: "Admin and accountant", pro: "All 7 roles", enterprise: "All 7 roles" },
      { name: "Maker-checker approvals", description: "A second person approves a voucher before it posts.", go: false, pro: true, enterprise: true },
      { name: "Payroll privacy", description: "Salary figures hidden from roles that shouldn't see them.", go: false, pro: true, enterprise: true },
    ],
  },
  {
    category: "Invoicing and collections",
    rows: [
      { name: "Bills of supply and tax invoices", description: "Non-GST bills below the limit, GST invoices once registered.", go: true, pro: true, enterprise: true },
      { name: "UPI QR on bills", description: "QR from your UPI ID with the amount filled in.", go: true, pro: true, enterprise: true },
      { name: "Payment links", description: "Collect through a payment provider, once one is connected.", go: false, pro: true, enterprise: true },
      { name: "Collections and WhatsApp reminders", description: "Who owes what, and a reminder link to send from your WhatsApp.", go: true, pro: true, enterprise: true },
      { name: "Marketplace settlements", description: "Sales, commission and TCS from marketplace settlement sheets.", go: "Manual journal", pro: "Settlement sheet import", enterprise: "Across channels" },
    ],
  },
  {
    category: "GST",
    rows: [
      { name: "Non-GST mode (section 22)", description: "Run without GST while below the registration limit, with a tracker.", go: true, pro: true, enterprise: true },
      { name: "Tax by place of supply", description: "CGST and SGST within the state, IGST across states.", go: true, pro: true, enterprise: true },
      { name: "GSTR-1 and GSTR-3B", description: "Prepared from your invoices and purchases.", go: "Summary view", pro: "Offline JSON for the portal", enterprise: "Offline JSON; direct filing through a GSP" },
      { name: "Input tax credit register", description: "Eligible credit kept apart from section 17(5) blocked credit.", go: "Purchase register", pro: true, enterprise: true },
      { name: "E-invoice and e-way bill", description: "IRN, signed QR and e-way bills through a GST Suvidha Provider.", go: false, pro: false, enterprise: "Needs a GSP connection" },
    ],
  },
  {
    category: "Books, stock and banking",
    rows: [
      { name: "Double-entry ledger", description: "Debits must equal credits; server-issued voucher numbers.", go: true, pro: true, enterprise: true },
      { name: "Vouchers from the keyboard", description: "Contra, payment, receipt, journal, sales and purchase (F4 to F9).", go: true, pro: true, enterprise: true },
      { name: "Bank reconciliation", description: "Match a statement CSV against the bank ledger.", go: "Cash and bank book", pro: "Statement CSV matching", enterprise: "Statement CSV matching" },
      { name: "Inventory", description: "Stock valued first-in, first-out.", go: "One location", pro: "One warehouse", enterprise: "Multiple warehouses and transfers" },
    ],
  },
  {
    category: "Reports and Deku Consultant",
    rows: [
      { name: "Statements", description: "Profit & Loss, Balance Sheet, Trial Balance and Cash Flow from posted vouchers.", go: true, pro: true, enterprise: true },
      { name: "Ageing, DSO and DPO", description: "Who owes you, whom you owe, and for how long.", go: true, pro: true, enterprise: true },
      { name: "Deku Consultant", description: "Answers from your ledger with fixed logic, not an outside AI service.", go: false, pro: false, enterprise: "Every department" },
    ],
  },
  {
    category: "Deployment and support",
    rows: [
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
      <div className="mx-auto max-w-[1200px] px-4 py-10 sm:px-8 sm:py-16 lg:py-24">
        <Reveal className="max-w-[680px]">
          <h2 id="pricing-title" className="text-[26px] font-semibold leading-[1.12] tracking-[-0.03em] text-ink sm:text-[34px] lg:text-[40px]">
            One yearly licence for each stage of growth
          </h2>
          <p className="mt-3 text-[15.5px] leading-[1.55] text-ink-soft sm:mt-5 sm:text-[18px]">
            Every plan is an annual licence with setup by a partner near you, product and tax updates, and your
            company&apos;s data kept to itself. No charge per invoice or per transaction.
          </p>
        </Reveal>

        <div className="mt-8 grid gap-4 sm:mt-14 sm:gap-5 lg:grid-cols-3">
          {ORDER.map((id, i) => {
            const plan = P[id];
            const info = PLANS[id];
            const featured = id === "pro";
            return (
              <Reveal key={id} delay={i * 80}>
                <div
                  className={`group/plan relative flex h-full flex-col rounded-panel border p-5 transition-[border-color,box-shadow,transform] duration-300 hover:-translate-y-0.5 sm:p-8 ${
                    featured
                      ? "border-brand bg-surface shadow-[inset_0_3px_0_var(--color-brand),0_28px_70px_-34px_rgb(5_184_165/0.55)]"
                      : id === "enterprise"
                        ? "border-panel-deep bg-panel-deep text-white"
                        : "border-line bg-surface hover:border-line-strong hover:shadow-[0_24px_60px_-40px_rgb(14_27_25/0.35)]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <h3 className={`text-[20px] font-semibold tracking-[-0.02em] sm:text-[22px] ${id === "enterprise" ? "text-white" : "text-ink"}`}>{plan.name}</h3>
                    {featured && (
                      <span className="inline-flex h-[24px] items-center rounded-chip bg-brand-wash px-2.5 text-xs font-medium text-brand-strong">
                        Most popular
                      </span>
                    )}
                  </div>
                  <p className={`mt-1 text-[14.5px] font-medium sm:text-[15px] ${id === "enterprise" ? "text-brand-soft" : "text-brand-strong"}`}>{info.idea}</p>
                  <p className={`mt-2 text-[14px] leading-[1.5] sm:mt-3 sm:text-[14.5px] sm:leading-[1.55] lg:min-h-[92px] ${id === "enterprise" ? "text-white/70" : "text-ink-muted"}`}>{info.forWho}</p>

                  <p className="mt-4 flex items-baseline gap-2 sm:mt-6">
                    <span className={`text-[32px] font-semibold tabular-nums leading-none tracking-[-0.035em] sm:text-[40px] ${id === "enterprise" ? "text-white" : "text-ink"}`}>
                      ₹{fmt(plan.priceInrYearly)}
                    </span>
                    <span className={`text-[13.5px] sm:text-[14px] ${id === "enterprise" ? "text-white/60" : "text-ink-muted"}`}>a year</span>
                  </p>
                  <p className={`mt-1 text-[12.5px] tabular-nums sm:mt-1.5 sm:text-[13px] ${id === "enterprise" ? "text-white/55" : "text-ink-muted"}`}>{perMonth(plan.priceInrYearly)}</p>

                  <dl className={`mt-4 grid grid-cols-3 overflow-hidden rounded-ctl border sm:mt-6 ${id === "enterprise" ? "border-white/10 bg-white/5" : "border-line bg-canvas"}`}>
                    {LIMITS.map((l, li) => (
                      <div key={l.label} className={`px-2.5 py-2.5 sm:px-3 sm:py-3 ${li ? (id === "enterprise" ? "border-l border-white/10" : "border-l border-line") : ""}`}>
                        <dt className={`text-[11px] sm:text-[12px] ${id === "enterprise" ? "text-white/55" : "text-ink-muted"}`}>{l.label}</dt>
                        <dd className={`mt-0.5 text-[13.5px] font-semibold tabular-nums sm:text-[15px] ${id === "enterprise" ? "text-white" : "text-ink"}`}>{l.value(id)}</dd>
                      </div>
                    ))}
                  </dl>

                  {info.plusLabel && (
                    <p className={`mt-4 text-[12.5px] font-medium sm:mt-6 sm:text-[13px] ${id === "enterprise" ? "text-white/70" : "text-ink-soft"}`}>{info.plusLabel}</p>
                  )}
                  <ul className={`${info.plusLabel ? "mt-2 sm:mt-3" : "mt-4 sm:mt-6"} flex-1 space-y-2 sm:space-y-3`}>
                    {info.adds.map((h) => (
                      <li key={h} className={`flex gap-2.5 text-[13.5px] leading-[1.4] sm:gap-3 sm:text-[14.5px] sm:leading-[1.45] ${id === "enterprise" ? "text-white/80" : "text-ink-soft"}`}>
                        <Check aria-hidden="true" className={`mt-[2px] h-4 w-4 shrink-0 ${id === "enterprise" ? "text-brand" : "text-brand-strong"}`} />
                        <span>{h}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/request-setup"
                    className={`mt-5 inline-flex h-11 items-center justify-center rounded-ctl text-[14.5px] font-medium transition-[background-color,transform] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 sm:mt-8 ${
                      featured
                        ? "bg-brand text-ink hover:bg-brand-hover"
                        : id === "enterprise"
                          ? "bg-white text-ink hover:bg-white/90"
                          : "border border-line-strong bg-surface text-ink hover:bg-canvas"
                    }`}
                  >
                    {id === "enterprise" ? "Talk to us" : "Request a setup"}
                  </Link>
                </div>
              </Reveal>
            );
          })}
        </div>

        <details className="group mt-5 rounded-panel border border-line sm:mt-6">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-panel px-6 py-5 transition-colors hover:bg-canvas/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand [&::-webkit-details-marker]:hidden">
            <span>
              <span className="block text-[16px] font-medium text-ink">Compare every plan, line by line</span>
              <span className="mt-0.5 block text-[14px] text-ink-muted">Scale, invoicing, GST, books, reports and support across GO, PRO and Enterprise.</span>
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
                  {ORDER.map((id) => (
                    <th
                      key={id}
                      scope="col"
                      className={`px-5 py-4 font-semibold text-ink ${id === "pro" ? "bg-brand-wash" : ""}`}
                    >
                      {P[id].name}
                      <span className="block text-[12.5px] font-normal tabular-nums text-ink-muted">
                        ₹{fmt(P[id].priceInrYearly)} a year
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
