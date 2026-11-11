"use client";

import React, { useState } from "react";
import { Plus } from "lucide-react";
import Reveal from "./Reveal";

const FAQS = [
  {
    q: "How does Deku Finance keep a growing business organised without accounting complexity?",
    a: "Invoicing, UPI collections, expenses and profit reports live in one workspace. Every invoice or payment you record is a double-entry voucher, so the Balance Sheet, Profit & Loss and cash position are always computed from the same books instead of separate spreadsheets.",
  },
  {
    q: "Can I start lean as a small business or freelancer and grow into it?",
    a: "Yes. Without GST you send clean bills of supply with a UPI QR and no tax lines. A registration limit tracker shows how close your turnover is to the ₹20 lakh or ₹40 lakh limit (general guidance; your own position can differ). When you register, switch the company to GST and turn on team workflows.",
  },
  {
    q: "How does the UPI QR on bills help me get paid?",
    a: "Each bill can carry a QR made from your UPI ID with the amount and bill reference filled in. Customers scan it with any UPI app, so there's nothing to type and less back-and-forth about how to pay.",
  },
  {
    q: "How does Deku help me follow up on unpaid invoices?",
    a: "Collections groups unpaid invoices by how long they've been due and flags amounts owed to micro and small enterprises for more than 45 days. A WhatsApp button opens your own WhatsApp with a polite reminder, the amount and your UPI ID written in. Deku doesn't send messages itself.",
  },
  {
    q: "Can I create quotations, estimates and proforma invoices before the final bill?",
    a: "Yes. The document builder makes quotations, proforma invoices, delivery challans and estimates. When the client agrees, convert the document into a sales invoice without typing the lines again.",
  },
  {
    q: "How do maker-checker approvals protect my business?",
    a: "Staff and bookkeepers draft entries; an owner, CFO or admin approves them before they post to the ledger. Each voucher keeps its trail: who created it, who submitted it and who approved it.",
  },
  {
    q: "How does bank reconciliation work?",
    a: "Choose the bank account and a statement CSV. The file is read in your browser and matched against the bank ledger by date, reference and amount. Matches are suggestions until you confirm them, and the completed reconciliation is recorded with who did it.",
  },
  {
    q: "Does Deku handle GST invoicing and returns?",
    a: "Once GST is on, Deku splits CGST and SGST or IGST from the place of supply, tracks eligible input tax credit from your purchase register, and prepares GSTR-1 and GSTR-3B summaries with offline JSON to upload on the portal. Filing directly from Deku, e-invoices and e-way bills need a GST Suvidha Provider connection.",
  },
  {
    q: "What is the ALERX chart of accounts?",
    a: "ALERX organises every account under Assets, Liabilities, Equity, Revenue and Expenses, in four tiers from group down to the label you post to. Every company starts with a standard chart, so cash, bank, receivables and expenses are structured from day one.",
  },
  {
    q: "How is our financial and employee data kept private?",
    a: "Deku runs in your own deployment, so your books stay there. Deku Consultant answers from your ledger with fixed logic and doesn't send figures to an outside AI service. Seven roles control who can see and post what, including payroll figures.",
  },
  {
    q: "Can I export my data whenever I want?",
    a: "Yes. Reports, registers and ledgers download as CSV, and GST returns as JSON. Your data belongs to you.",
  },
];

export default function FaqSection() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" aria-labelledby="faq-title" className="scroll-mt-20 bg-canvas">
      <div className="mx-auto grid max-w-[1200px] gap-12 px-5 py-24 sm:px-8 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-16 lg:py-36">
        <Reveal>
          <h2 id="faq-title" className="text-[32px] font-semibold leading-[1.1] tracking-[-0.03em] text-ink sm:text-[40px]">
            Questions, answered
          </h2>
          <p className="mt-5 max-w-[40ch] text-[17px] leading-[1.55] text-ink-soft">
            Something else on your mind? Request a setup and the partner for your area will call you.
          </p>
        </Reveal>

        <Reveal delay={80}>
          <ul className="border-t border-line-strong">
            {FAQS.map((f, i) => {
              const isOpen = open === i;
              const id = `faq-${i}`;
              return (
                <li key={f.q} className="border-b border-line-strong">
                  <h3>
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      aria-controls={id}
                      onClick={() => setOpen(isOpen ? null : i)}
                      className="flex w-full items-start justify-between gap-6 py-5 text-left text-[16.5px] font-medium leading-[1.4] text-ink transition-colors hover:text-brand-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-4 focus-visible:ring-offset-canvas"
                    >
                      {f.q}
                      <Plus
                        aria-hidden="true"
                        className={`mt-1 h-[18px] w-[18px] shrink-0 text-ink-muted transition-transform duration-300 motion-reduce:transition-none ${isOpen ? "rotate-45" : ""}`}
                      />
                    </button>
                  </h3>
                  <div
                    id={id}
                    role="region"
                    className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none ${
                      isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                    }`}
                  >
                    <div className="overflow-hidden" inert={!isOpen}>
                      <p className="max-w-[68ch] pb-6 pr-10 text-[15.5px] leading-[1.6] text-ink-soft">{f.a}</p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
