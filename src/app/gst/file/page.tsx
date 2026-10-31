"use client";

import React, { useState } from "react";
import { AlertCircle, CheckCircle2, Download, Upload } from "lucide-react";
import { AppShell } from "@/layouts/AppShell";
import { WorkspaceLayout } from "@/layouts/WorkspaceLayout";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { GSTR1_NOT_COVERED, GSTR3B_NOT_COVERED } from "@/lib/gst/returns";
import { useReturnPeriod } from "@/lib/gst/period";
import { useReturnBooks } from "@/lib/gst/useReturnBooks";
import { downloadJson } from "@/lib/download";
import { ReturnCard } from "@/modules/gst/ReturnCard";

const STEPS = ["Period", "Readiness", "Review", "Download"];

/** Where the user can fix a blocking error, by the wording returns.ts uses. */
function fixLink(error: string): { href: string; label: string } | null {
  if (error.startsWith("Company GSTIN")) return { href: "/settings", label: "Fix in Settings" };
  if (error.startsWith("Invoice ")) return { href: "/gst", label: "Open invoices" };
  if (error.includes("chart of accounts has no")) return { href: "/masters/chart-of-accounts", label: "Open chart of accounts" };
  return null;
}

export default function GstFilePage() {
  const { month, setMonth, fy, retPeriod } = useReturnPeriod();
  const { orgId, books, loading, loadError, gstr1, gstr3b } = useReturnBooks(retPeriod);
  const [step, setStep] = useState(0);
  const [guideOpen, setGuideOpen] = useState(false);

  const errors = [...new Set([...(gstr1?.errors ?? []), ...(gstr3b?.errors ?? [])])];
  const ready = !!(gstr1 && gstr3b);

  return (
    <AppShell>
      <WorkspaceLayout
        title="File GST returns"
        subtitle="Build GSTR-1 and GSTR-3B from your books, fix what blocks them, then upload the JSON on gst.gov.in"
        badge={<Badge variant="teal">GSTR-1 · GSTR-3B</Badge>}
        breadcrumbs={[{ label: "GST", href: "/gst" }, { label: "File returns", href: "/gst/file" }]}
      >
        <div className="mx-auto max-w-4xl space-y-5">
          <ol className="flex flex-wrap gap-2" aria-label="Filing steps">
            {STEPS.map((s, i) => (
              <li key={s}>
                <button
                  onClick={() => setStep(i)}
                  aria-current={step === i ? "step" : undefined}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                    step === i ? "bg-panel text-white" : "bg-surface text-ink-muted border border-line hover:text-ink"
                  }`}
                >
                  {i + 1}. {s}
                </button>
              </li>
            ))}
          </ol>

          {!orgId && <p className="text-sm text-ink-muted">Select a company first.</p>}

          <section className="rounded-xl border border-line bg-surface p-5 shadow-card space-y-4" aria-live="polite">
            {step === 0 && (
              <>
                <h2 className="text-base font-semibold text-ink">Pick the return period</h2>
                <p className="text-sm text-ink-muted">
                  Returns are filed for the month just ended, so this starts on last month.{fy && ` FY ${fy}.`}
                </p>
                <div className="w-48">
                  <Input label="Return period" id="file-period" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
                </div>
              </>
            )}

            {step > 0 && loading && <p className="text-sm text-ink-muted">Loading invoices and ledgers…</p>}
            {step > 0 && loadError && (
              <div role="alert" className="flex items-center gap-2 rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900">
                <AlertCircle className="h-4 w-4 shrink-0" aria-hidden /> {loadError}. Nothing can be exported.
              </div>
            )}

            {step === 1 && ready && (
              <>
                <h2 className="text-base font-semibold text-ink">Readiness check</h2>
                {errors.length === 0 ? (
                  <p className="flex items-center gap-2 text-sm text-emerald-800">
                    <CheckCircle2 className="h-4 w-4" aria-hidden /> Every check passed for {month}. Both returns can be downloaded.
                  </p>
                ) : (
                  <>
                    <p className="text-sm text-ink-muted">
                      {errors.length} issue{errors.length === 1 ? "" : "s"} block the download. Fix them in the books, then come back.
                    </p>
                    <ul className="divide-y divide-line rounded-lg border border-rose-200">
                      {errors.map((e) => {
                        const fix = fixLink(e);
                        return (
                          <li key={e} className="flex flex-wrap items-start justify-between gap-2 p-3 text-sm text-rose-900">
                            <span>{e}</span>
                            {fix && (
                              <a href={fix.href} className="shrink-0 text-xs font-semibold text-brand-strong underline">
                                {fix.label}
                              </a>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}
              </>
            )}

            {step === 2 && ready && (
              <>
                <h2 className="text-base font-semibold text-ink">Review the figures</h2>
                <p className="text-sm text-ink-muted">Amounts in rupees for {month}, straight from your issued invoices and Input GST ledgers.</p>
                <ReturnCard title="GSTR-1" result={gstr1!} notCovered={GSTR1_NOT_COVERED} />
                <ReturnCard title="GSTR-3B" result={gstr3b!} notCovered={GSTR3B_NOT_COVERED} />
              </>
            )}

            {step === 3 && ready && books && (
              <>
                <h2 className="text-base font-semibold text-ink">Download and upload</h2>
                {errors.length > 0 && (
                  <p className="text-sm text-rose-800">
                    A return with blocking issues can&apos;t be downloaded. See step 2.
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={!gstr1!.json}
                    onClick={() => downloadJson(`GSTR1_${books.gstin}_${retPeriod}.json`, gstr1!.json)}
                  >
                    <Download className="h-4 w-4" aria-hidden /> Download GSTR-1 JSON
                  </Button>
                  <Button
                    disabled={!gstr3b!.json}
                    onClick={() => downloadJson(`GSTR3B_${books.gstin}_${retPeriod}.json`, gstr3b!.json)}
                  >
                    <Download className="h-4 w-4" aria-hidden /> Download GSTR-3B JSON
                  </Button>
                  <Button variant="secondary" onClick={() => setGuideOpen(true)}>
                    <Upload className="h-4 w-4" aria-hidden /> How to upload on gst.gov.in
                  </Button>
                </div>
                <p className="text-xs text-ink-muted">
                  Deku does not file for you. The files stay on your computer until you upload them yourself.{" "}
                  <a href="/gst/guide" className="text-brand-strong underline">Full portal guide</a>
                </p>
              </>
            )}

            <div className="flex justify-between border-t border-line pt-3">
              <Button variant="ghost" size="sm" disabled={step === 0} onClick={() => setStep(step - 1)}>
                Back
              </Button>
              <Button variant="secondary" size="sm" disabled={step === STEPS.length - 1 || !orgId} onClick={() => setStep(step + 1)}>
                Next
              </Button>
            </div>
          </section>

          <Modal isOpen={guideOpen} onClose={() => setGuideOpen(false)} title="Upload on gst.gov.in" maxWidth="lg">
            <ol className="list-decimal space-y-2 pl-5 text-sm text-ink-soft">
              <li>
                Log in at <span className="font-medium">gst.gov.in</span>, go to Services → Returns → Returns Dashboard and
                choose FY {fy} and the period {month}.
              </li>
              <li>
                On the GSTR-1 (or GSTR-3B) tile choose <span className="font-medium">Prepare offline</span>, then Upload, and
                select the JSON file you downloaded. Wait for the upload to be processed and check for errors.
              </li>
              <li>
                Open the return online, compare the figures with step 3, then submit and file it with EVC (OTP) or DSC.
              </li>
            </ol>
            <p className="mt-3 text-xs text-ink-muted">Portal menus change from time to time; verify on gst.gov.in.</p>
          </Modal>
        </div>
      </WorkspaceLayout>
    </AppShell>
  );
}
