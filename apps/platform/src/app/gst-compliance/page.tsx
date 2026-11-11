import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Check, FileBadge, Truck } from "lucide-react";
import LandingNavbar from "@/components/landing/LandingNavbar";
import LandingFooter from "@/components/landing/LandingFooter";
import { Reveal } from "@/components/marketing/Reveal";
import { card, chip, container, h1, h2, lead, primaryCta, secondaryCta, table } from "@/components/marketing/styles";
import { Shot } from "@/components/marketing/Shot";
import { ItcClassifier } from "./ItcClassifier";
import { TaxSplit } from "./TaxSplit";

export const metadata: Metadata = {
  title: "GST compliance | Deku Finance",
  description:
    "How Deku Finance handles GST: section 22 thresholds, place of supply, input tax credit, GSTR-1 and GSTR-3B prepared as offline JSON, and the GST Suvidha Provider connection.",
};

const body = "max-w-[64ch] text-[16px] leading-[1.6] text-ink-soft";

const IN_DEKU = [
  "Tax invoices and bills of supply",
  "CGST and SGST, or IGST, from the place of supply",
  "Input tax credit marked eligible, blocked or ineligible",
  "GSTR-1 and GSTR-3B summaries with offline JSON",
];
const NEEDS_GSP = ["Filing returns directly on the portal", "E-invoice IRN and signed QR", "E-way bills"];

const THRESHOLDS = [
  {
    who: "Service providers",
    limit: "₹20 lakh",
    applies: "Professionals, consultants, designers, software and other service businesses in most states.",
  },
  {
    who: "Goods suppliers",
    limit: "₹40 lakh",
    applies: "Traders and manufacturers of goods in states that adopted the higher limit (Notification 10/2019-Central Tax).",
  },
  {
    who: "Special category states",
    limit: "₹10 lakh",
    applies: "Manipur, Mizoram, Nagaland and Tripura, under the proviso to section 22.",
  },
];


const GSP_STEPS = [
  {
    title: "Connect your GST portal",
    body: "Once the server is set up with a licensed GSP, you add your GST portal username in Settings and verify it with an OTP. Your portal password is never asked for.",
  },
  {
    title: "E-invoice (IRN)",
    body: "From an issued invoice, Deku sends the invoice to the GSP and keeps the IRN, acknowledgement number and signed QR code with it.",
  },
  {
    title: "E-way bill from the same invoice",
    body: "Add the vehicle number, transporter ID and distance. The invoice details aren't typed again on another portal.",
  },
];

const GSTR1 = [
  "Table 4: B2B invoices, by the buyer's GSTIN and place of supply",
  "Table 7: B2C small supplies, by place of supply and rate",
  "Table 8: exempt supplies",
  "Table 12: HSN summary, split into B2B and B2C",
  "Table 13: documents issued, by invoice series",
];
const GSTR3B = [
  "3.1: outward supplies and the tax on them",
  "3.2: inter-state supplies to unregistered persons",
  "4: input tax credit from posted purchase bills, with 17(5) credit reversed",
  "6: set-off of this period's credit, shown for reference while you pay on the portal",
];

const STEPS = [
  { title: "Period", body: "Pick the month." },
  { title: "Readiness", body: "See anything that blocks the return, with a link to fix it." },
  { title: "Review", body: "Check the summary, and what the return doesn't cover yet." },
  { title: "Download", body: "Save the JSON and upload it on the GST portal." },
];

function CheckList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-3">
      {items.map((t) => (
        <li key={t} className="flex gap-3 text-[15.5px] leading-[1.5] text-ink-soft">
          <Check className="mt-[3px] h-4 w-4 shrink-0 text-brand-strong" strokeWidth={2.25} aria-hidden />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

function Section({
  id,
  title,
  intro,
  label,
  children,
  tone = "surface",
}: {
  id: string;
  title: string;
  intro?: React.ReactNode;
  label?: string;
  children: React.ReactNode;
  tone?: "surface" | "canvas";
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={`scroll-mt-20 border-t border-line ${tone === "surface" ? "bg-surface" : "bg-canvas"}`}
    >
      <div className={`${container} py-16 lg:py-20`}>
        <Reveal>
          {label && <p className="mb-3 text-[15px] font-medium text-brand-strong">{label}</p>}
          <h2 id={`${id}-title`} className={`${h2} max-w-[30ch]`}>
            {title}
          </h2>
          {intro && <p className={`mt-4 ${lead}`}>{intro}</p>}
        </Reveal>
        {children}
      </div>
    </section>
  );
}

export default function GstCompliancePage() {
  return (
    <div className="flex min-h-screen flex-col bg-canvas font-sans text-ink">
      <LandingNavbar />

      <main className="flex-1">
        <section className={`${container} pb-20 pt-20 sm:pt-20 lg:pb-20`}>
          <Reveal>
            <p className="text-[15px] font-medium text-brand-strong">GST engine and GSP roadmap</p>
            <h1 className={`mt-4 max-w-[24ch] ${h1}`}>GST built into every invoice, and a clear path to the portal.</h1>
            <p className={`mt-6 ${lead} sm:text-[18px]`}>
              From section 22 turnover exemptions to CGST, SGST and IGST splits, Deku prepares GSTR-1 and GSTR-3B as
              offline JSON for you to upload. Direct filing, e-invoices and e-way bills go through a GST Suvidha
              Provider; that connection is built, but none is connected yet.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/learn/demo" className={primaryCta}>
                Try the demo
              </Link>
              <Link href="/learn" className={secondaryCta}>
                Learn the GST workflows
              </Link>
            </div>
          </Reveal>

          <Reveal delay={120}>
            <div className="mt-16 grid gap-px overflow-hidden rounded-panel border border-line bg-line md:grid-cols-2">
              {[
                { title: "Done in Deku", status: "Available", tone: "bg-ok-wash text-ok", items: IN_DEKU },
                { title: "Needs a GST Suvidha Provider", status: "Not connected", tone: "bg-warn-wash text-warn", items: NEEDS_GSP },
              ].map((col) => (
                <div key={col.title} className="bg-surface p-6 sm:p-8">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-[17px] font-semibold tracking-[-0.01em]">{col.title}</h2>
                    <span className={`${chip} ${col.tone}`}>{col.status}</span>
                  </div>
                  <ul className="mt-5 space-y-3 text-[15.5px] leading-[1.5] text-ink-soft">
                    {col.items.map((t) => (
                      <li key={t} className="border-t border-line pt-3 first:border-t-0 first:pt-0">
                        {t}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Reveal>
        </section>

        <Section
          id="registration"
          label="Statutory thresholds"
          title="Section 22 of the CGST Act: know when to register"
          intro="Below the turnover limit, a business doesn't have to register for GST. Deku lets it work in pure accounting mode, issuing bills of supply, without a GSTIN."
        >
          <Reveal>
            <div className={`mt-12 ${table.wrap}`}>
              <table className="w-full min-w-[560px]">
                <thead className={table.head}>
                  <tr>
                    <th scope="col" className={table.th}>Supplier</th>
                    <th scope="col" className={`${table.th} whitespace-nowrap text-right`}>Annual turnover limit</th>
                    <th scope="col" className={table.th}>Applies to</th>
                  </tr>
                </thead>
                <tbody>
                  {THRESHOLDS.map((t) => (
                    <tr key={t.who} className="transition-colors hover:bg-brand-wash/50">
                      <th scope="row" className={`${table.td} text-left font-medium text-ink`}>
                        {t.who}
                      </th>
                      <td className={`${table.td} whitespace-nowrap text-right text-[17px] font-semibold tracking-[-0.01em] text-ink`}>
                        {t.limit}
                      </td>
                      <td className={table.td}>{t.applies}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-5 max-w-[70ch] text-[14px] leading-[1.55] text-ink-muted">
              General guidance only. The limit depends on what you supply and where, and Deku doesn&apos;t work out your
              own position; check it with your tax adviser.
            </p>
          </Reveal>
        </Section>

        <Section id="place-of-supply" label="Tax engine" title="Place of supply decides the tax: intra-state or inter-state" tone="canvas">
          <div className="mt-8 grid gap-12 lg:grid-cols-[6fr_5fr] lg:gap-20">
            <Reveal className="space-y-5">
              <p className={body}>
                When you sell within your own state, the tax is split in half: CGST to the centre and SGST to the state.
                When the buyer&apos;s place of supply is another state, the whole rate is charged as IGST. The total the
                buyer pays is the same either way.
              </p>
              <p className={body}>
                Deku reads the state code from the place of supply and compares it with your company&apos;s registered
                state, so each line gets the right split. If an invoice&apos;s tax type and place of supply disagree,
                the returns flag it before anything is exported.
              </p>
              <p className={body}>In pure accounting mode, the same sale is a bill of supply with no tax lines.</p>
            </Reveal>
            <Reveal delay={120} className="self-start">
              <TaxSplit />
            </Reveal>
          </div>
          <Reveal>
            <div className="mt-16">
              <Shot
                src="/landing/gst-invoice-register.webp"
                alt="Sales and GST invoice register in the demo, each invoice showing its supply type, intra-state CGST and SGST"
                width={2880}
                height={940}
              />
              <p className="mt-4 text-[14px] text-ink-muted">
                The invoice register on the demo&apos;s sample books: every invoice carries its supply type.
              </p>
            </div>
          </Reveal>
        </Section>

        <Section id="itc" label="Input tax credit" title="Input tax credit, and credit you can't claim">
          <div className="mt-8 grid gap-12 lg:grid-cols-2 lg:gap-20">
            <Reveal className="space-y-5">
              <p className={body}>
                The GST you pay on purchases can usually be set off against the GST you collect on sales. That is input
                tax credit. Some credit is blocked by section 17(5) of the CGST Act, for example on food and beverages
                or on goods for personal use, and some is ineligible for other reasons, such as a late claim.
              </p>
              <p className={body}>
                In Deku each purchase bill is marked eligible, blocked under 17(5) or ineligible. Blocked and ineligible
                credit needs a reason and is added to the cost of the purchase, and GSTR-3B reports each kind in its own
                table.
              </p>
              <p className={body}>
                Nothing in Deku matches your credit against GSTR-2B yet; it comes from your purchase register, so check
                it against the portal before you file.
              </p>
            </Reveal>
            <Reveal delay={120} className="self-start">
              <ItcClassifier />
            </Reveal>
          </div>
        </Section>

        <section id="gsp" aria-labelledby="gsp-title" className="scroll-mt-20 bg-panel-deep text-white">
          <div className={`${container} py-16 lg:py-20`}>
            <Reveal>
              <p className="text-[15px] font-medium text-brand">GST Suvidha Provider</p>
              <h2 id="gsp-title" className={`mt-4 max-w-[26ch] ${h2} text-white`}>
                Direct filing and e-invoicing go through a licensed GSP.
              </h2>
              <p className="mt-4 max-w-[64ch] text-[17px] leading-[1.55] text-white/70">
                Deku doesn&apos;t file on the government portal with scrapers or shared passwords. Filing, e-invoices
                and e-way bills go through a GST Suvidha Provider. The connection is built into Deku, but no GSP is
                connected in this deployment and it hasn&apos;t yet been run against a real provider, so those buttons
                stay disabled and say why.
              </p>
            </Reveal>

            <ol className="mt-12 grid gap-5 md:grid-cols-3">
              {GSP_STEPS.map((s, i) => (
                <li key={s.title} className="h-full">
                  <Reveal delay={i * 80} className="h-full">
                    <div className="h-full rounded-panel border border-white/10 bg-white/[0.03] p-6 transition-colors duration-200 hover:border-white/25 sm:p-7">
                      <span className="grid h-8 w-8 place-items-center rounded-full border border-white/20 font-mono text-[13px] text-white/70">
                        {i + 1}
                      </span>
                      <h3 className="mt-5 text-[17px] font-semibold tracking-[-0.01em] text-white">{s.title}</h3>
                      <p className="mt-2"><span className={`${chip} bg-white/10 text-white/80`}>Built, not connected</span></p>
                      <p className="mt-1.5 text-[15px] leading-[1.55] text-white/65">{s.body}</p>
                    </div>
                  </Reveal>
                </li>
              ))}
            </ol>

            <Reveal>
              <div className="mt-12 grid items-center gap-8 lg:grid-cols-[6fr_5fr] lg:gap-14">
                <section aria-label="E-invoice and e-way bill, as on an issued invoice" className="rounded-panel border border-line bg-surface p-5 text-ink sm:p-6">
                  <p className="text-[13px] text-ink-muted">On an issued invoice</p>
                  <p className="mt-1 text-[15px] font-semibold tracking-[-0.01em]">E-invoice and e-way bill</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span aria-disabled="true" className="inline-flex h-8 cursor-not-allowed items-center gap-1.5 rounded-ctl border border-line-strong bg-surface px-3 text-[13px] font-medium text-ink opacity-50">
                      <FileBadge className="h-3.5 w-3.5" aria-hidden /> Generate IRN
                    </span>
                    <span aria-disabled="true" className="inline-flex h-8 cursor-not-allowed items-center gap-1.5 rounded-ctl border border-line-strong bg-surface px-3 text-[13px] font-medium text-ink opacity-50">
                      <Truck className="h-3.5 w-3.5" aria-hidden /> Generate e-way bill
                    </span>
                  </div>
                  <p className="mt-3 text-[12.5px] text-ink-muted">No GST Suvidha Provider is configured on this server.</p>
                </section>
                <p className="text-[16px] leading-[1.6] text-white/70">
                  This is what an issued invoice shows today: the buttons are there, disabled, with the reason beside
                  them. Once a GSP is configured and your portal is connected, the same block shows the IRN,
                  acknowledgement number, signed QR code and e-way bill number.
                </p>
              </div>
            </Reveal>

            <Reveal>
              <div className="mt-8 flex flex-col gap-3 rounded-panel border border-white/10 px-5 py-4 text-[14.5px] text-white/70 sm:flex-row sm:items-center sm:justify-between">
                <p>Your portal username and GSP session are stored encrypted with AES-256-GCM.</p>
                <p className="flex flex-wrap gap-2">
                  <span className={`${chip} bg-white/10 text-white`}>Offline JSON available</span>
                  <span className={`${chip} bg-warn-wash text-warn`}>GSP not connected</span>
                </p>
              </div>
            </Reveal>
          </div>
        </section>

        <Section
          id="returns"
          label="Return exports"
          title="GSTR-1 and GSTR-3B, prepared from your books"
          intro="If you file on the GST portal yourself, Deku builds both returns from posted invoices and purchase bills for the month, in the portal's offline JSON format. You review them, download the JSON and upload it."
        >
          <Reveal>
            <Shot
              className="mt-12"
              src="/landing/gst-returns.webp"
              alt="GSTR-1 and GSTR-3B summaries in Deku for a sample company, each marked validated with a JSON download"
              width={2120}
              height={1340}
            />
          </Reveal>

          <div className="mt-12 grid gap-6 md:grid-cols-2">
            {[
              { name: "GSTR-1", sub: "Outward supplies: invoices you issued", items: GSTR1 },
              { name: "GSTR-3B", sub: "Monthly summary of tax and credit", items: GSTR3B },
            ].map((r, i) => (
              <Reveal key={r.name} delay={i * 80} className="h-full">
                <article className={`${card} h-full p-6 sm:p-8`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-[21px] font-semibold tracking-[-0.02em]">{r.name}</h3>
                      <p className="mt-1 text-[14px] text-ink-muted">{r.sub}</p>
                    </div>
                    <span className={`${chip} bg-ok-wash text-ok`}>Available</span>
                  </div>
                  <div className="mt-6 border-t border-line pt-6">
                    <CheckList items={r.items} />
                  </div>
                </article>
              </Reveal>
            ))}
          </div>

          <ol className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.title}>
                <Reveal delay={i * 60}>
                  <div className="border-t border-line-strong pt-4">
                    <p className="font-mono text-[13px] text-ink-muted">{i + 1}</p>
                    <h3 className="mt-2 text-[17px] font-semibold tracking-[-0.01em]">{s.title}</h3>
                    <p className="mt-1.5 text-[15px] leading-[1.55] text-ink-soft">{s.body}</p>
                  </div>
                </Reveal>
              </li>
            ))}
          </ol>

          <p className="mt-12 max-w-[64ch] text-[15px] leading-[1.6] text-ink-muted">
            Each return also lists what it doesn&apos;t cover yet, such as B2C large invoices, amendments, advances and
            reverse-charge inward supplies, so you know what to add on the portal.
          </p>
        </Section>

        <section className="border-t border-line bg-canvas">
          <div className={`${container} py-16 lg:py-24`}>
            <Reveal>
              <h2 className={`${h2} max-w-[24ch]`}>Ready to explore GST invoicing in Deku?</h2>
              <p className={`mt-4 ${lead}`}>
                Raise a sample GST invoice, record a purchase bill and find both in the returns, in the demo. No account
                or login needed.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Link href="/learn/demo" className={primaryCta}>
                  Try the demo
                </Link>
                <Link href="/learn" className={secondaryCta}>
                  Explore the Learn Centre
                </Link>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
