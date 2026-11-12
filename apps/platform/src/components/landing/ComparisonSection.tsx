import { Check } from "lucide-react";
import Reveal from "./Reveal";

const ROWS: { capability: string; deku: string; desktop: string; invoicing: string }[] = [
  {
    capability: "Start without GST, add it later",
    deku: "Bills of supply first, GST invoices once you register, same books",
    desktop: "GST set up per company, usually by an accountant",
    invoicing: "Often one invoice format",
  },
  {
    capability: "UPI QR on bills",
    deku: "On every bill, with the amount filled in",
    desktop: "Usually through an add-on",
    invoicing: "Often a static QR image",
  },
  {
    capability: "Keyboard entry and balanced books",
    deku: "A key for every voucher; debits must equal credits to post",
    desktop: "Keyboard-driven, with a learning curve",
    invoicing: "Mostly mouse-driven; often no general ledger",
  },
  {
    capability: "Live P&L and bank reconciliation",
    deku: "Reports from posted vouchers; statement CSV matched against the bank ledger",
    desktop: "Reports available; statement matching varies by edition",
    invoicing: "Often invoice lists and sales totals only",
  },
  {
    capability: "Team approvals and GST limit tracking",
    deku: "Maker-checker approvals and a registration limit tracker",
    desktop: "Varies by edition",
    invoicing: "Rarely available",
  },
];

export default function ComparisonSection() {
  return (
    <section aria-labelledby="compare-title" className="bg-canvas">
      <div className="mx-auto max-w-[1200px] px-4 py-10 sm:px-8 sm:py-16 lg:py-24">
        <Reveal className="max-w-[680px]">
          <h2 id="compare-title" className="text-[26px] font-semibold leading-[1.12] tracking-[-0.03em] text-ink sm:text-[34px] lg:text-[40px]">
            Why Indian businesses choose Deku Finance
          </h2>
          <p className="mt-3 text-[15.5px] leading-[1.55] text-ink-soft sm:mt-5 sm:text-[18px]">
            How Deku compares with the two kinds of tool most small businesses use today. Other products differ by
            edition and add-on, so treat their columns as typical, not exact.
          </p>
        </Reveal>

        <Reveal delay={80} className="mt-7 sm:mt-12">
          {/* Phones get one compact card per capability instead of a sideways-scrolling table. */}
          <ul className="space-y-3 md:hidden">
            {ROWS.map((r) => (
              <li key={r.capability} className="rounded-panel border border-line bg-surface p-4">
                <p className="text-[15px] font-semibold text-ink">{r.capability}</p>
                <p className="mt-2.5 flex gap-2 rounded-ctl bg-brand-wash p-2.5 text-[13.5px] leading-[1.45] text-ink">
                  <Check aria-hidden="true" className="mt-[2px] h-4 w-4 shrink-0 text-brand-strong" />
                  <span>
                    <span className="font-medium">Deku: </span>
                    {r.deku}
                  </span>
                </p>
                <dl className="mt-2.5 grid grid-cols-2 gap-3 text-[12.5px] leading-[1.4]">
                  <div>
                    <dt className="text-ink-muted">Desktop software</dt>
                    <dd className="mt-0.5 text-ink-soft">{r.desktop}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-muted">Invoicing apps</dt>
                    <dd className="mt-0.5 text-ink-soft">{r.invoicing}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto rounded-panel border border-line bg-surface md:block">
            <table className="w-full min-w-[820px] text-left text-[14.5px]">
              <colgroup>
                <col className="w-[22%]" />
                <col className="w-[30%]" />
                <col className="w-[24%]" />
                <col className="w-[24%]" />
              </colgroup>
              <thead>
                <tr className="text-[13.5px]">
                  <th scope="col" className="px-6 pb-4 pt-6 font-medium text-ink-muted">Capability</th>
                  <th scope="col" className="bg-brand-wash px-6 pb-4 pt-6 font-semibold text-ink shadow-[inset_0_3px_0_var(--color-brand)]">
                    Deku Finance
                  </th>
                  <th scope="col" className="px-6 pb-4 pt-6 font-medium text-ink-muted">Desktop accounting software</th>
                  <th scope="col" className="px-6 pb-4 pt-6 font-medium text-ink-muted">Invoicing apps</th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map((r) => (
                  <tr key={r.capability} className="border-t border-line align-top">
                    <th scope="row" className="px-6 py-5 font-medium text-ink">
                      {r.capability}
                    </th>
                    <td className="bg-brand-wash px-6 py-5 text-ink">
                      <span className="flex gap-2.5">
                        <Check aria-hidden="true" className="mt-[3px] h-4 w-4 shrink-0 text-brand-strong" />
                        <span>{r.deku}</span>
                      </span>
                    </td>
                    <td className="px-6 py-5 text-ink-soft">{r.desktop}</td>
                    <td className="px-6 py-5 text-ink-soft">{r.invoicing}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
