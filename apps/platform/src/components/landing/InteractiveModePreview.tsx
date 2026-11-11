"use client";

import React, { useEffect, useRef, useState } from "react";
import { Check, QrCode } from "lucide-react";

type Mode = "lean" | "gst";

const TAXABLE = 50000;
const inr = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Tweens a figure to its new value; jumps straight there for reduced motion. */
function useTween(target: number, ms = 520) {
  const [value, setValue] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const start = from.current;
    if (start === target) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      from.current = target;
      setValue(target);
      return;
    }
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      const v = Math.round(start + (target - start) * eased);
      from.current = v;
      setValue(v);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return value;
}

/** Height-animated block: rows open and close instead of popping. */
function Collapse({ open, children }: { open: boolean; children: React.ReactNode }) {
  return (
    <div
      className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none ${
        open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
      }`}
      aria-hidden={!open}
    >
      <div className="overflow-hidden">{children}</div>
    </div>
  );
}

const FIELDS = [
  { key: "po", label: "PO number" },
  { key: "vehicle", label: "Vehicle number" },
  { key: "terms", label: "Due date and terms" },
  { key: "qr", label: "UPI QR" },
] as const;
type FieldKey = (typeof FIELDS)[number]["key"];

export default function InteractiveModePreview() {
  const [mode, setMode] = useState<Mode>("lean");
  const [fields, setFields] = useState<Record<FieldKey, boolean>>({ po: true, vehicle: false, terms: true, qr: true });
  const gst = mode === "gst";
  const tax = gst ? TAXABLE * 0.09 : 0;
  const total = useTween(TAXABLE + tax * 2);
  const cgst = useTween(tax);
  const meta = fields.po || fields.vehicle || fields.terms;

  return (
    <section id="modes" aria-labelledby="modes-title" className="scroll-mt-20 bg-panel-deep text-white">
      <div className="mx-auto max-w-[1200px] px-5 py-16 sm:px-8 lg:py-24">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
          {/* Left: the story for each stage */}
          <div>
            <h2 id="modes-title" className="text-[32px] font-semibold leading-[1.1] tracking-[-0.03em] sm:text-[40px]">
              Start without GST. Switch it on when you register.
            </h2>
            <p className="mt-5 max-w-[52ch] text-[17px] leading-[1.55] text-white/70">
              A small studio and a growing distributor need different paperwork. Deku keeps the same books underneath
              and changes what each bill carries.
            </p>

            <div role="radiogroup" aria-label="Business stage" className="mt-8 inline-flex rounded-ctl border border-edge bg-panel p-1">
              {(
                [
                  ["lean", "Not registered for GST"],
                  ["gst", "GST registered"],
                ] as [Mode, string][]
              ).map(([m, label]) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={mode === m}
                  onClick={() => setMode(m)}
                  className={`rounded-[7px] px-3.5 py-2 text-[14px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                    mode === m ? "bg-white text-ink" : "text-white/65 hover:text-white"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div key={mode} className="mt-8 space-y-6 motion-safe:animate-[dekuFade_.4s_ease-out]">
              {gst ? (
                <>
                  <div>
                    <h3 className="text-[17px] font-medium">Tax invoices, purchases and returns</h3>
                    <p className="mt-2 text-[15px] leading-[1.6] text-white/65">
                      For B2B suppliers and marketplace sellers. CGST and SGST or IGST are split by place of supply,
                      marketplace settlement sheets can be imported, and roles decide who can post.
                    </p>
                  </div>
                  <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-panel border border-edge bg-edge">
                    <div className="bg-panel p-4">
                      <dt className="text-[13px] text-white/55">Monthly sales summary</dt>
                      <dd className="mt-1 text-[15px] font-medium">GSTR-1 prepared from invoices</dd>
                    </div>
                    <div className="bg-panel p-4">
                      <dt className="text-[13px] text-white/55">Credit and tax</dt>
                      <dd className="mt-1 text-[15px] font-medium">ITC from your purchase register</dd>
                    </div>
                  </dl>
                  <p className="text-[14px] text-white/55">Month-end starts from books that already balance.</p>
                </>
              ) : (
                <>
                  <div>
                    <h3 className="text-[17px] font-medium">Bills without tax clutter</h3>
                    <p className="mt-2 text-[15px] leading-[1.6] text-white/65">
                      For freelancers, studios and young businesses below the ₹20 lakh or ₹40 lakh registration limit.
                      Send bills of supply with no monthly return to file.
                    </p>
                  </div>
                  <div className="rounded-panel border border-edge bg-panel p-5">
                    <div className="flex items-baseline justify-between gap-3 text-[14px]">
                      <span className="text-white/65">Registration limit tracker</span>
                      <span className="tabular-nums text-brand-soft">32% of ₹20 lakh</span>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-panel-raised">
                      <div className="h-full w-[32%] origin-left rounded-full bg-brand motion-safe:animate-[dekuGrow_.9s_.1s_cubic-bezier(.2,.7,.2,1)_both]" />
                    </div>
                    <div className="mt-3 flex justify-between text-[13px] tabular-nums text-white/50">
                      <span>This year ₹6,40,000</span>
                      <span>Limit ₹20,00,000</span>
                    </div>
                  </div>
                  <p className="text-[14px] text-white/55">Sample figures for a services business. Limits shown are general guidance.</p>
                </>
              )}
            </div>

            <div className="mt-8 flex gap-4 border-t border-edge pt-6">
              <QrCode aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
              <p className="text-[15px] leading-[1.55] text-white/70">
                <span className="font-medium text-white">UPI QR on every bill.</span> Your UPI ID and the bill amount,
                ready for the customer to scan with any UPI app.
              </p>
            </div>
          </div>

          {/* Right: a sample bill that reacts to the stage and the field toggles */}
          <div className="min-w-0">
            <fieldset className="mb-4 flex flex-wrap items-center gap-2">
              <legend className="mb-3 text-[14px] text-white/60">Fields on the bill</legend>
              {FIELDS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  aria-pressed={fields[f.key]}
                  onClick={() => setFields((p) => ({ ...p, [f.key]: !p[f.key] }))}
                  className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] transition-colors active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                    fields[f.key]
                      ? "border-brand/60 bg-brand/15 text-brand-soft"
                      : "border-edge text-white/60 hover:border-white/30 hover:text-white"
                  }`}
                >
                  <Check aria-hidden="true" className={`h-3.5 w-3.5 transition-opacity ${fields[f.key] ? "opacity-100" : "opacity-0 -ml-5"}`} />
                  {f.label}
                </button>
              ))}
            </fieldset>

            <div className="rounded-panel bg-surface p-6 text-ink shadow-[0_30px_80px_-20px_rgb(0_0_0/0.55)] sm:p-8">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-5">
                <div>
                  <p className="text-[13px] text-ink-muted">{gst ? "Tax invoice" : "Bill of supply"}</p>
                  <p className="mt-1 font-mono text-[14px] text-ink">{gst ? "KDS/26-27/0088" : "KDS/26-27/0014"}</p>
                </div>
                <span
                  className={`inline-flex h-[24px] items-center rounded-chip px-2 text-xs font-medium transition-colors ${
                    gst ? "bg-brand-wash text-brand-strong" : "bg-canvas-sunken text-ink-soft"
                  }`}
                >
                  {gst ? "Intra-state, CGST + SGST" : "Not registered (section 22)"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-6 py-5 text-[13.5px]">
                <div>
                  <p className="text-ink-muted">From</p>
                  <p className="mt-1 font-medium">Kavya Design Studio</p>
                  <p className="mt-0.5 text-ink-muted">{gst ? "GST registered" : "Not registered for GST"}</p>
                  <p className="text-ink-muted">Mumbai, Maharashtra</p>
                </div>
                <div>
                  <p className="text-ink-muted">To</p>
                  <p className="mt-1 font-medium">Apex Growth Solutions LLP</p>
                  <p className="mt-0.5 text-ink-muted">{gst ? "GST registered" : "Customer"}</p>
                  <p className="text-ink-muted">Pune, Maharashtra</p>
                </div>
              </div>

              <Collapse open={meta}>
                <dl className="mb-5 grid grid-cols-2 gap-4 rounded-ctl bg-canvas p-3.5 text-[13px] sm:grid-cols-3">
                  {fields.po && (
                    <div>
                      <dt className="text-ink-muted">PO number</dt>
                      <dd className="mt-0.5 font-mono">PO-2610-892</dd>
                    </div>
                  )}
                  {fields.vehicle && (
                    <div>
                      <dt className="text-ink-muted">Vehicle number</dt>
                      <dd className="mt-0.5 font-mono">MH-04-AB-1234</dd>
                    </div>
                  )}
                  {fields.terms && (
                    <div>
                      <dt className="text-ink-muted">Terms</dt>
                      <dd className="mt-0.5">Net 15, due 3 Nov 2026</dd>
                    </div>
                  )}
                </dl>
              </Collapse>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[380px] text-[13.5px]">
                  <thead>
                    <tr className="border-b border-line text-left text-[12.5px] text-ink-muted">
                      <th className="pb-2 font-medium">Item</th>
                      <th className="pb-2 text-right font-medium">Qty</th>
                      <th className="pb-2 text-right font-medium">GST</th>
                      <th className="pb-2 text-right font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-line">
                      <td className="py-3">
                        Brand identity design
                        <span className="block font-mono text-[12px] text-ink-muted">SAC 998391</span>
                      </td>
                      <td className="py-3 text-right">1</td>
                      <td className="py-3 text-right text-ink-soft">{gst ? "18%" : "–"}</td>
                      <td className="py-3 text-right">{inr(TAXABLE)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="ml-auto mt-4 max-w-[300px] space-y-1.5 text-[13.5px] tabular-nums">
                <div className="flex justify-between text-ink-soft">
                  <span>Taxable value</span>
                  <span>{inr(TAXABLE)}</span>
                </div>
                <Collapse open={gst}>
                  <div className="space-y-1.5 text-ink-soft">
                    <div className="flex justify-between">
                      <span>CGST 9%</span>
                      <span>{inr(cgst)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>SGST 9%</span>
                      <span>{inr(cgst)}</span>
                    </div>
                  </div>
                </Collapse>
                <div className="flex justify-between border-t border-line pt-2 text-[15px] font-semibold">
                  <span>Total</span>
                  <span className="ledger-total">₹{inr(total)}</span>
                </div>
              </div>

              <Collapse open={fields.qr}>
                <div className="mt-6 flex items-center gap-4 rounded-ctl border border-line p-3.5">
                  <SampleQr />
                  <div className="min-w-0 text-[13px]">
                    <p className="font-medium">Scan to pay with any UPI app</p>
                    <p className="mt-0.5 font-mono text-[12.5px] text-ink-soft">kavya.studio@bank</p>
                    <p className="mt-0.5 text-ink-muted">Amount filled in: ₹{inr(TAXABLE + tax * 2)}</p>
                  </div>
                </div>
              </Collapse>
            </div>

            <div className="mt-4 rounded-panel border border-edge bg-panel p-4 text-[13px] tabular-nums">
              <p className="mb-2 text-white/55">Posted to the ledger</p>
              <div className="flex justify-between text-white/85">
                <span>Dr Trade debtors</span>
                <span>{inr(total)}</span>
              </div>
              <div className="flex justify-between text-white/85">
                <span>Cr Sales</span>
                <span>{inr(TAXABLE)}</span>
              </div>
              <Collapse open={gst}>
                <div className="flex justify-between text-white/85">
                  <span>Cr Output CGST and SGST</span>
                  <span>{inr(cgst * 2)}</span>
                </div>
              </Collapse>
            </div>
            <p className="mt-3 text-[13px] text-white/45">A sample bill from a fictional business.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

/** A decorative QR-like mark: the sample bill is fictional, so it deliberately encodes nothing. */
export function SampleQr({ className = "h-16 w-16" }: { className?: string }) {
  const cells = [
    [36, 10], [46, 10], [56, 10], [36, 24], [46, 24], [56, 36], [10, 36], [24, 46], [36, 46], [46, 46], [66, 46],
    [80, 36], [36, 60], [46, 60], [66, 60], [80, 60], [36, 76], [56, 76], [76, 76], [46, 86], [66, 86], [86, 86],
  ];
  return (
    <svg viewBox="0 0 100 100" className={`${className} shrink-0 text-ink`} fill="currentColor" aria-hidden="true">
      {[
        [0, 0],
        [70, 0],
        [0, 70],
      ].map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <rect x={x} y={y} width="30" height="30" rx="4" />
          <rect x={x + 6} y={y + 6} width="18" height="18" rx="2" fill="white" />
          <rect x={x + 10} y={y + 10} width="10" height="10" rx="1.5" />
        </g>
      ))}
      {cells.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="6" height="6" rx="1" />
      ))}
    </svg>
  );
}
