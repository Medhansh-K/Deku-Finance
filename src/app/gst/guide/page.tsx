"use client";

import React from "react";
import { AlertTriangle } from "lucide-react";
import { AppShell } from "@/layouts/AppShell";
import { WorkspaceLayout } from "@/layouts/WorkspaceLayout";
import { Badge } from "@/components/ui/Badge";

const SECTIONS: { title: string; body: React.ReactNode }[] = [
  {
    title: "How to log in to the GST portal",
    body: (
      <ol className="list-decimal space-y-1 pl-5">
        <li>Open gst.gov.in and choose Login at the top right.</li>
        <li>Enter your username and password and the captcha. First time? Use &ldquo;First time login&rdquo; with the provisional ID sent at registration.</li>
        <li>Returns live under Services → Returns → Returns Dashboard. Pick the financial year and period there.</li>
      </ol>
    ),
  },
  {
    title: "Where to file GSTR-1 (sales)",
    body: (
      <>
        <p>Returns Dashboard → GSTR-1 tile → Prepare online, or Prepare offline to upload a JSON file.</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Monthly filers: due on the 11th of the following month.</li>
          <li>
            Quarterly filers (QRMP): GSTR-1 is due on the 13th of the month after the quarter. B2B invoices for the first
            two months can be sent early through the optional Invoice Furnishing Facility (IFF), by the 13th of the next month.
          </li>
        </ul>
      </>
    ),
  },
  {
    title: "How to check GSTR-2B (purchases)",
    body: (
      <>
        <p>Returns Dashboard → GSTR-2B tile → View or Download.</p>
        <p>
          GSTR-2B is a fixed statement of the input tax credit your suppliers reported, generated on the 14th of the
          following month. Match it against your purchase bills before claiming ITC in GSTR-3B. Deku does not match it yet.
        </p>
      </>
    ),
  },
  {
    title: "Where to file GSTR-3B (summary and tax payment)",
    body: (
      <>
        <p>Returns Dashboard → GSTR-3B tile → Prepare online. Pay any tax due (Table 6.1) before filing.</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Monthly filers: due on the 20th of the following month.</li>
          <li>Quarterly filers (QRMP): due on the 22nd or 24th of the month after the quarter, depending on your state.</li>
        </ul>
      </>
    ),
  },
  {
    title: "How to file a NIL return",
    body: (
      <>
        <p>
          A NIL return is for a period with no sales, no purchases and no tax to pay. It must still be filed. On the
          GSTR-3B tile answer Yes to &ldquo;file Nil return&rdquo;; GSTR-1 has a similar Nil option. NIL GSTR-3B and GSTR-1 can
          also be filed by SMS to 14409; the portal&apos;s help page gives the exact message format.
        </p>
        <p>
          Late fee for a NIL return: ₹20 per day (₹10 CGST + ₹10 SGST), capped at the maximum notified by CBIC for NIL
          filers.
        </p>
      </>
    ),
  },
  {
    title: "Signing: EVC or DSC",
    body: (
      <p>
        Every return is filed with EVC (an OTP sent to the authorised signatory&apos;s registered mobile) or a DSC
        (digital signature certificate). Companies and LLPs must use DSC.
      </p>
    ),
  },
  {
    title: "How filing works with Deku",
    body: (
      <ol className="list-decimal space-y-1 pl-5">
        <li>
          Open <a href="/gst/file" className="text-brand-strong underline">File GST returns</a> and pick the period (it starts
          on last month).
        </li>
        <li>The readiness check lists anything that blocks the return, such as a missing company GSTIN or an invoice without an HSN code, with a link to fix it.</li>
        <li>Review the GSTR-1 and GSTR-3B figures built from your issued invoices and Input GST ledgers.</li>
        <li>
          Download the JSON files and upload them on the portal (Prepare offline → Upload). Deku never logs in to the portal
          or files for you; you submit and sign there yourself.
        </li>
      </ol>
    ),
  },
];

export default function GstGuidePage() {
  return (
    <AppShell>
      <WorkspaceLayout
        title="GST portal guide"
        subtitle="Where to file each return on gst.gov.in, and how Deku fits in"
        badge={<Badge variant="teal">Guide</Badge>}
        breadcrumbs={[{ label: "GST", href: "/gst" }, { label: "Portal guide", href: "/gst/guide" }]}
      >
        <div className="mx-auto max-w-3xl space-y-4">
          <p role="note" className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            Rules, due dates and portal menus change, and due dates are often extended by notification. Verify on gst.gov.in
            before you file.
          </p>
          <div className="divide-y divide-line rounded-xl border border-line bg-surface shadow-card">
            {SECTIONS.map((s) => (
              <details key={s.title} className="group p-4">
                <summary className="cursor-pointer text-sm font-semibold text-ink">{s.title}</summary>
                <div className="mt-3 space-y-2 text-sm text-ink-soft">{s.body}</div>
              </details>
            ))}
          </div>
        </div>
      </WorkspaceLayout>
    </AppShell>
  );
}
