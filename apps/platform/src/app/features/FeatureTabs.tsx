"use client";

import React, { useRef, useState } from "react";
import { Check, ChevronRight } from "lucide-react";
import { Reveal } from "@/components/marketing/Reveal";
import { Shot } from "@/components/marketing/Shot";
import { card, chip, container, h2, lead, table } from "@/components/marketing/styles";
import { ModeInvoice, ReconMatch, VoucherExplorer } from "./MiniUis";
import { SQL_ROLES } from "@/lib/learn/engine/rbac";
import { ROLES } from "@/modules/departments-members/team";

/** Rows of the role matrix; who may do each comes from the database's own role checks (SQL_ROLES). */
const ROLE_ACTIONS: { label: string; roles: readonly string[] }[] = [
  { label: "Draft vouchers", roles: SQL_ROLES.createDraft },
  { label: "Submit for approval", roles: SQL_ROLES.submitVoucher },
  { label: "Approve and post", roles: SQL_ROLES.approveVoucher },
  { label: "Issue sales invoices", roles: SQL_ROLES.issueInvoice },
  { label: "Record purchase bills", roles: SQL_ROLES.purchaseBill },
  { label: "Reconcile the bank", roles: SQL_ROLES.reconcileBank },
  { label: "Invite people", roles: SQL_ROLES.invite },
  { label: "Change settings", roles: SQL_ROLES.settings },
];

type TabId = "modes" | "alerx" | "vouchers" | "banking" | "reports" | "governance";

const TABS: { id: TabId; label: string }[] = [
  { id: "modes", label: "Two modes" },
  { id: "alerx", label: "ALERX ledger" },
  { id: "vouchers", label: "Vouchers F4–F9" },
  { id: "banking", label: "Bank reconciliation" },
  { id: "reports", label: "Financial reports" },
  { id: "governance", label: "Governance and roles" },
];

function CheckList({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="space-y-3">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3 text-[15.5px] leading-[1.5] text-ink-soft">
          <Check className="mt-[3px] h-4 w-4 shrink-0 text-brand-strong" strokeWidth={2.25} aria-hidden />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function PanelHeader({ label, title, children }: { label: string; title: string; children: React.ReactNode }) {
  return (
    <div className="max-w-[760px]">
      <p className="text-[15px] font-medium text-brand-strong">{label}</p>
      <h2 className={`mt-3 ${h2}`}>{title}</h2>
      <p className={`mt-4 ${lead}`}>{children}</p>
    </div>
  );
}

function ModesPanel() {
  const modes = [
    {
      key: "pure" as const,
      name: "Pure accounting mode",
      title: "Turnover below the registration threshold",
      body: "For freelancers, professionals and small suppliers who don't need GST registration under section 22 of the CGST Act.",
      items: [
        "Bills of supply and commercial invoices with no tax lines.",
        "A UPI QR code on the invoice, so customers can pay you directly.",
        "Full double-entry books for income tax and your financial statements.",
      ],
      note: "CGST Act 2017, section 22(1): the registration threshold.",
    },
    {
      key: "gst" as const,
      name: "GST mode",
      title: "Registered businesses and B2B tax invoices",
      body: "For businesses over the threshold or registered voluntarily. The full tax engine is on.",
      items: [
        "CGST and SGST within your state, IGST across states, split automatically.",
        "HSN and SAC codes on every line, with suggestions from the HSN master; you choose the rate.",
        "GSTR-1 and GSTR-3B prepared as offline JSON for upload on the GST portal.",
      ],
      note: "E-invoices (IRN) and e-way bills go through a GSP connection, which isn't connected yet.",
    },
  ];
  return (
    <>
      <PanelHeader label="Regulatory flexibility" title="Two operating modes, no forced overhead">
        A business below the registration threshold shouldn&apos;t have to deal with tax lines from day one. Deku has a
        pure accounting mode for it under section 22 of the CGST Act, and a GST mode for registered businesses. You
        choose the mode when the company is set up.
      </PanelHeader>
      <div className="mt-12 grid gap-6 md:grid-cols-2">
        {modes.map((m) => (
          <article key={m.name} className={`${card} flex flex-col p-6 sm:p-8`}>
            <span className={`${chip} w-fit bg-brand-wash text-brand-strong`}>{m.name}</span>
            <h3 className="mt-5 text-[21px] font-semibold tracking-[-0.02em] text-ink">{m.title}</h3>
            <p className="mt-2 text-[15.5px] leading-[1.55] text-ink-soft">{m.body}</p>
            <div className="mt-6 flex-1">
              <CheckList items={m.items} />
            </div>
            <div className="mt-6">
              <ModeInvoice mode={m.key} />
            </div>
            <p className="mt-8 border-t border-line pt-4 text-[13.5px] leading-[1.5] text-ink-muted">{m.note}</p>
          </article>
        ))}
      </div>
    </>
  );
}

function AlerxPanel() {
  const rows = [
    { l: "A", name: "Assets", code: "1000", holds: "What the business owns or is owed: cash, bank, debtors and stock.", normal: "Debit" },
    { l: "L", name: "Liabilities", code: "2000", holds: "What the business owes to suppliers, lenders and the GST department.", normal: "Credit" },
    { l: "E", name: "Equity", code: "3000", holds: "Capital invested, retained earnings and drawings.", normal: "Credit" },
    { l: "R", name: "Revenue", code: "4000", holds: "Income from invoices, services and products.", normal: "Credit" },
    { l: "X", name: "Expenses", code: "5000", holds: "Operating costs such as rent, salaries and fees.", normal: "Debit" },
  ];
  const tiers = [
    { tier: "Group header", example: "Cash & liquid capital" },
    { tier: "Ledger", example: "Operating bank accounts" },
    { tier: "Sub-ledger", example: "Bank current account" },
    { tier: "Postable account", example: "1020 Operating bank account" },
  ];
  return (
    <>
      <PanelHeader label="Double-entry rigour" title="The ALERX double-entry ledger">
        Deku isn&apos;t an invoice generator with a spreadsheet attached. Every account belongs to one of five classes,
        and a voucher can&apos;t post until its debits equal its credits.
      </PanelHeader>

      <div className={`mt-12 ${table.wrap}`}>
        <table className="w-full min-w-[620px]">
          <thead className={table.head}>
            <tr>
              <th scope="col" className={table.th}>Class</th>
              <th scope="col" className={table.th}>Code</th>
              <th scope="col" className={table.th}>What it holds</th>
              <th scope="col" className={`${table.th} text-right`}>Normal balance</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.code} className="transition-colors hover:bg-brand-wash/50">
                <th scope="row" className={`${table.td} text-left font-medium text-ink`}>
                  <span className="flex items-center gap-3">
                    <span className="grid h-7 w-7 place-items-center rounded-[7px] bg-canvas-sunken font-mono text-[13px] text-ink-soft">
                      {r.l}
                    </span>
                    {r.name}
                  </span>
                </th>
                <td className={`${table.td} font-mono text-[14px]`}>{r.code}</td>
                <td className={table.td}>{r.holds}</td>
                <td className={`${table.td} text-right text-ink`}>{r.normal}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-16 grid gap-10 lg:grid-cols-[4fr_7fr] lg:gap-16">
        <div>
          <h3 className="text-[21px] font-semibold tracking-[-0.02em]">Four tiers, posting only at the last</h3>
          <p className="mt-3 text-[15.5px] leading-[1.6] text-ink-soft">
            Accounts sit in four tiers. Vouchers post only to the last one; the database refuses a posting to a group or
            ledger. Groups add up the accounts beneath them, so no entry is left orphaned.
          </p>
        </div>
        <ol className="grid gap-3 sm:grid-cols-4">
          {tiers.map((t, i) => (
            <li
              key={t.tier}
              className={`relative rounded-panel border p-4 ${
                i === tiers.length - 1 ? "border-brand/40 bg-brand-wash" : "border-line bg-surface"
              }`}
            >
              <p className="text-[13px] text-ink-muted">Tier {i + 1}</p>
              <p className="mt-1 text-[15px] font-semibold text-ink">{t.tier}</p>
              <p className="mt-2 text-[13.5px] leading-[1.45] text-ink-soft">{t.example}</p>
              {i < tiers.length - 1 && (
                <ChevronRight
                  className="absolute -right-[13px] top-1/2 z-10 hidden h-4 w-4 -translate-y-1/2 text-ink-subtle sm:block"
                  aria-hidden
                />
              )}
            </li>
          ))}
        </ol>
      </div>
    </>
  );
}

function VouchersPanel() {
  return (
    <>
      <PanelHeader label="Keyboard-driven speed" title="The complete voucher suite, F4 to F9">
        Experienced bookkeepers work from the keyboard. Each function key opens its voucher directly, without reaching
        for the mouse, and the balance is checked before anything posts.
      </PanelHeader>
      <VoucherExplorer cardClass={card} />
    </>
  );
}

function BankingPanel() {
  const steps = [
    { title: "Import the statement", body: "Download your statement from your bank as a CSV file and upload it." },
    {
      title: "Review proposed matches",
      body: "Deku proposes a voucher for each line by amount, date (within five days), reference and party name. You confirm each one.",
    },
    {
      title: "Complete the reconciliation",
      body: "Confirm the matched lines, record any difference you accept, and close the statement for that date.",
    },
  ];
  return (
    <>
      <PanelHeader label="Cash certainty" title="Bank statement reconciliation">
        Bank accounts in Deku are ledgers like any other; the default chart starts with 1020 Operating bank account. No
        more ticking off a printed statement with a pencil.
      </PanelHeader>
      <div className="mt-12 grid items-start gap-10 lg:grid-cols-[5fr_7fr] lg:gap-14">
      <ol className="grid gap-4">
        {steps.map((s, i) => (
          <li key={s.title} className={`${card} p-6`}>
            <span className="grid h-8 w-8 place-items-center rounded-full border border-line-strong font-mono text-[13px] text-ink-soft">
              {i + 1}
            </span>
            <h3 className="mt-5 text-[17px] font-semibold tracking-[-0.01em]">{s.title}</h3>
            <p className="mt-1.5 text-[15px] leading-[1.55] text-ink-soft">{s.body}</p>
          </li>
        ))}
      </ol>
      <ReconMatch />
      </div>
    </>
  );
}

function ReportsPanel() {
  const reports = [
    { name: "Day Book", body: "Every voucher in date order, with filters for date, voucher type and status." },
    { name: "Trial balance", body: "Checks that total debits equal total credits across every account." },
    { name: "Profit and loss", body: "Revenue, cost of goods sold, operating expenses and net profit for a period." },
    { name: "Balance sheet", body: "Assets, liabilities and equity as of any date." },
    { name: "Cash flow", body: "Cash from operating, investing and financing activities." },
    { name: "Open formats", body: "CSV downloads, and print or save as PDF from the browser, for your tax consultant or auditor." },
  ];
  return (
    <>
      <PanelHeader label="Clarity for owners and auditors" title="Financial reports and registers">
        Reports aren&apos;t stored copies. Each one is worked out from the posted vouchers when you open it.
      </PanelHeader>
      <div className={`mt-12 ${table.wrap}`}>
        <table className="w-full">
          <thead className={table.head}>
            <tr>
              <th scope="col" className={table.th}>Report</th>
              <th scope="col" className={table.th}>What it shows</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((r) => (
              <tr key={r.name} className="transition-colors hover:bg-brand-wash/50">
                <th scope="row" className={`${table.td} w-[34%] text-left font-medium text-ink`}>
                  <span className="flex items-start gap-3">
                    <Check className="mt-[3px] h-4 w-4 shrink-0 text-brand-strong" strokeWidth={2.25} aria-hidden />
                    {r.name}
                  </span>
                </th>
                <td className={table.td}>{r.body}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-12">
        <Shot
          src="/landing/balance-sheet.webp"
          alt="Balance sheet in Deku for a sample company, with assets equal to liabilities plus equity"
          width={2800}
          height={810}
        />
      </div>
    </>
  );
}

function GovernancePanel() {
  const items = [
    {
      title: "Maker-checker approval",
      body: "An accountant drafts the voucher and attaches the receipt. It stays out of the ledger until an owner, CFO or admin approves it.",
    },
    {
      title: "Row-level security",
      body: "The database itself checks which company each row belongs to, so a company's books are visible only to its own members.",
    },
    {
      title: "Append-only audit log",
      body: "User actions and voucher changes are written to an audit log that the database won't let anyone edit or delete.",
    },
  ];
  return (
    <>
      <PanelHeader label="Integrity and control" title="Maker-checker approval and data isolation">
        Guard against posting mistakes and unauthorised payments with an approval step and access by role: owner, CFO,
        admin, accountant, analyst, auditor and viewer.
      </PanelHeader>
      <div className="mt-12 grid items-start gap-10 lg:grid-cols-[5fr_6fr] lg:gap-16">
        <dl className="divide-y divide-line border-y border-line">
          {items.map((it) => (
            <div key={it.title} className="py-6">
              <dt className="flex items-center gap-3 text-[17px] font-semibold tracking-[-0.01em]">
                <Check className="h-4 w-4 shrink-0 text-brand-strong" strokeWidth={2.25} aria-hidden />
                {it.title}
              </dt>
              <dd className="mt-2 pl-7 text-[15.5px] leading-[1.55] text-ink-soft">{it.body}</dd>
            </div>
          ))}
        </dl>
        <div className="mx-auto w-full max-w-[520px]">
          <Shot
            src="/landing/day-book-approval.webp"
            alt="A voucher in the Day Book with its approval trail, from draft to approval"
            width={1450}
            height={1820}
          />
        </div>
      </div>

      <h3 className="mt-16 text-[21px] font-semibold tracking-[-0.02em]">Seven roles, checked by the database</h3>
      <p className="mt-2 max-w-[64ch] text-[15.5px] leading-[1.55] text-ink-soft">
        Analysts, auditors and viewers read the books but can&apos;t change them.
      </p>
      <div className={`mt-6 ${table.wrap}`}>
        <table className="w-full min-w-[760px]">
          <thead className={table.head}>
            <tr>
              <th scope="col" className={table.th}>Action</th>
              {ROLES.map((r) => (
                <th key={r.value} scope="col" className={`${table.th} text-center`}>{r.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROLE_ACTIONS.map((a) => (
              <tr key={a.label} className="transition-colors hover:bg-brand-wash/50">
                <th scope="row" className={`${table.td} whitespace-nowrap py-3 text-left font-medium text-ink !align-middle`}>{a.label}</th>
                {ROLES.map((r) => {
                  const yes = a.roles.includes(r.value);
                  return (
                    <td key={r.value} className={`${table.td} py-3 text-center !align-middle`}>
                      {yes ? (
                        <><Check className="mx-auto h-4 w-4 text-brand-strong" strokeWidth={2.25} aria-hidden /><span className="sr-only">Yes</span></>
                      ) : (
                        <><span className="text-ink-subtle" aria-hidden>–</span><span className="sr-only">No</span></>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

const PANELS: Record<TabId, () => React.ReactElement> = {
  modes: ModesPanel,
  alerx: AlerxPanel,
  vouchers: VouchersPanel,
  banking: BankingPanel,
  reports: ReportsPanel,
  governance: GovernancePanel,
};

export function FeatureTabs() {
  const [active, setActive] = useState<TabId>("modes");
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const Panel = PANELS[active];

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    const last = TABS.length - 1;
    const next =
      e.key === "ArrowRight" ? (index === last ? 0 : index + 1)
      : e.key === "ArrowLeft" ? (index === 0 ? last : index - 1)
      : e.key === "Home" ? 0
      : e.key === "End" ? last
      : null;
    if (next === null) return;
    e.preventDefault();
    setActive(TABS[next].id);
    tabRefs.current[next]?.focus();
  };

  return (
    <section aria-label="Capabilities in detail" className="border-t border-line bg-surface">
      <div className="sticky top-16 z-30 border-b border-line bg-surface/90 backdrop-blur-md">
        <div className={container}>
          <div role="tablist" aria-label="Capability areas" className="-mx-3 flex overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {TABS.map((t, i) => {
              const selected = t.id === active;
              return (
                <button
                  key={t.id}
                  ref={(el) => {
                    tabRefs.current[i] = el;
                  }}
                  role="tab"
                  id={`tab-${t.id}`}
                  aria-selected={selected}
                  aria-controls={`panel-${t.id}`}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setActive(t.id)}
                  onKeyDown={(e) => onKeyDown(e, i)}
                  // Inset the focus ring: the scrolling tab strip would clip one drawn outside.
                  style={{ outlineOffset: -2 }}
                  className={`relative shrink-0 whitespace-nowrap px-3 py-4 text-[14.5px] transition-colors duration-150 ${
                    selected ? "font-medium text-ink" : "text-ink-muted hover:text-ink"
                  }`}
                >
                  {t.label}
                  <span
                    aria-hidden
                    className={`absolute inset-x-3 bottom-0 h-0.5 origin-left rounded-full bg-brand transition-transform duration-300 ease-out motion-reduce:transition-none ${
                      selected ? "scale-x-100" : "scale-x-0"
                    }`}
                  />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div
        role="tabpanel"
        id={`panel-${active}`}
        aria-labelledby={`tab-${active}`}
        className={`${container} min-h-[640px] py-16 lg:py-20`}
      >
        <Reveal key={active}>
          <Panel />
        </Reveal>
      </div>
    </section>
  );
}
