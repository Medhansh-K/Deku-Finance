"use client";

import React, { useState } from "react";
import Link from "next/link";
import { DekuLogo } from "@/components/ui/DekuLogo";
import { Reveal } from "@/components/marketing/Reveal";

const INDIAN_STATES = [
  { code: "27", name: "Maharashtra" },
  { code: "29", name: "Karnataka" },
  { code: "07", name: "Delhi" },
  { code: "24", name: "Gujarat" },
  { code: "33", name: "Tamil Nadu" },
  { code: "36", name: "Telangana" },
  { code: "06", name: "Haryana" },
  { code: "09", name: "Uttar Pradesh" },
  { code: "19", name: "West Bengal" },
  { code: "32", name: "Kerala" },
  { code: "08", name: "Rajasthan" },
  { code: "23", name: "Madhya Pradesh" },
  { code: "30", name: "Goa" },
  { code: "21", name: "Odisha" },
  { code: "03", name: "Punjab" },
  { code: "10", name: "Bihar" },
  { code: "37", name: "Andhra Pradesh" },
];

const label = "block text-[13.5px] font-medium text-ink-soft";
const field =
  "mt-1.5 block h-11 w-full rounded-ctl border border-line-strong bg-surface px-3 text-[15px] text-ink placeholder:text-ink-subtle transition-[border-color,box-shadow] focus:border-brand focus:outline-none focus:ring-3 focus:ring-brand/20";

const SETUP_WHATSAPP_NUMBER = "917506461004";
const SETUP_WHATSAPP_DISPLAY = "+91 75064 61004";

const NEXT_STEPS = [
  "Submit your business details to pre-fill a setup message on WhatsApp.",
  `Reach our onboarding team directly on WhatsApp (${SETUP_WHATSAPP_DISPLAY}) to confirm your details.`,
  "We set up Deku for your business and walk you through your workspace.",
];

type SubmittedLead = {
  companyName: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  gstinOrPan: string;
  stateName: string;
  stateCode: string;
  city: string;
  pincode: string;
  whatsappUrl: string;
};

function buildWhatsappSetupUrl(lead: Omit<SubmittedLead, "whatsappUrl">): string {
  const lines = [
    "Hello, I'd like to request a Deku Finance setup.",
    "",
    `Company: ${lead.companyName.trim()}`,
    `Name: ${lead.clientName.trim()}`,
    `Phone: ${lead.clientPhone.trim()}`,
    `Work email: ${lead.clientEmail.trim()}`,
    ...(lead.gstinOrPan.trim() ? [`GSTIN / PAN: ${lead.gstinOrPan.trim()}`] : []),
    `Location: ${lead.city.trim()}, ${lead.stateName} (${lead.stateCode}) - ${lead.pincode.trim()}`,
  ];
  return `https://wa.me/${SETUP_WHATSAPP_NUMBER}?text=${encodeURIComponent(lines.join("\n"))}`;
}

export default function RequestSetupPage() {
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [gstinOrPan, setGstinOrPan] = useState("");
  const [selectedState, setSelectedState] = useState(INDIAN_STATES[0]);
  const [city, setCity] = useState("");
  const [pincode, setPincode] = useState("");
  const [result, setResult] = useState<SubmittedLead | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const details = {
      clientName,
      clientPhone,
      clientEmail,
      companyName,
      gstinOrPan,
      stateName: selectedState.name,
      stateCode: selectedState.code,
      city,
      pincode,
    };
    const whatsappUrl = buildWhatsappSetupUrl(details);
    setResult({ ...details, whatsappUrl });
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="flex min-h-screen flex-col bg-canvas font-sans text-ink">
      <header className="mx-auto flex h-16 w-full max-w-[1200px] items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="inline-flex items-center gap-2.5 rounded-ctl">
          <DekuLogo size={28} />
          <span className="text-[17px] font-semibold tracking-[-0.02em]">
            Deku <span className="font-normal text-ink-muted">Finance</span>
          </span>
        </Link>
        <Link
          href="/learn/demo"
          className="rounded-ctl text-[15px] font-medium text-ink-soft hover:text-ink"
        >
          Try the demo
        </Link>
      </header>

      <main className="mx-auto grid w-full content-start max-w-[1200px] flex-1 gap-12 px-4 pb-24 pt-12 sm:px-6 sm:pt-20 lg:grid-cols-[5fr_7fr] lg:gap-20 lg:px-8">
        <Reveal>
          <h1 className="text-[36px] font-semibold leading-[1.08] tracking-[-0.035em] sm:text-[48px]">
            Request a setup
          </h1>
          <p className="mt-5 max-w-[46ch] text-[17px] leading-[1.55] text-ink-soft">
            Tell us about your business and where you&apos;re based. Submitting
            opens WhatsApp with your details pre-filled so we can get you set
            up directly.
          </p>

          <h2 className="mt-12 text-[15px] font-semibold tracking-[-0.01em]">
            What happens next
          </h2>
          <ol className="mt-4 divide-y divide-line border-y border-line">
            {NEXT_STEPS.map((s, i) => (
              <li
                key={s}
                className="flex gap-4 py-4 text-[15.5px] leading-[1.5] text-ink-soft"
              >
                <span className="w-4 shrink-0 font-mono text-[13px] leading-[1.75] text-ink-muted">
                  {i + 1}
                </span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
          <p className="mt-8 text-[15px] text-ink-muted">
            Want to look around first?{" "}
            <Link
              href="/learn/demo"
              className="font-medium text-brand-strong underline-offset-4 hover:underline"
            >
              Try the demo
            </Link>{" "}
            on sample books, no sign-up needed.
          </p>
        </Reveal>

        <Reveal delay={100} className="self-start">
          <div className="rounded-panel border border-line bg-surface p-6 sm:p-8">
            {result ? (
              <div role="status">
                <span className="inline-flex h-[22px] items-center rounded-chip bg-ok-wash px-2 text-xs font-medium text-ok">
                  Ready on WhatsApp
                </span>
                <h2 className="mt-4 text-[22px] font-semibold tracking-[-0.02em]">
                  Send your details on WhatsApp.
                </h2>
                <p className="mt-2 text-[15.5px] leading-[1.55] text-ink-soft">
                  We prepared your setup request for {SETUP_WHATSAPP_DISPLAY}. If
                  WhatsApp didn&apos;t open automatically, tap the button below
                  to send your details.
                </p>

                <dl className="mt-6 divide-y divide-line rounded-ctl border border-line text-[14.5px]">
                  <div className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:justify-between sm:gap-4">
                    <dt className="text-ink-muted">WhatsApp</dt>
                    <dd className="font-mono font-medium text-ink sm:text-right">
                      {SETUP_WHATSAPP_DISPLAY}
                    </dd>
                  </div>
                  <div className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:justify-between sm:gap-4">
                    <dt className="text-ink-muted">Company</dt>
                    <dd className="text-ink sm:text-right">
                      {result.companyName}
                    </dd>
                  </div>
                  <div className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:justify-between sm:gap-4">
                    <dt className="text-ink-muted">Contact</dt>
                    <dd className="text-ink sm:text-right">
                      {result.clientName} ({result.clientPhone})
                    </dd>
                  </div>
                  <div className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:justify-between sm:gap-4">
                    <dt className="text-ink-muted">Area</dt>
                    <dd className="text-ink sm:text-right">
                      {result.city}, {result.stateName} ({result.pincode})
                    </dd>
                  </div>
                </dl>

                <div className="mt-6 flex flex-wrap gap-3">
                  <a
                    href={result.whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-11 items-center justify-center rounded-ctl bg-brand px-5 text-[15px] font-semibold text-panel-deep transition-colors hover:bg-brand-hover"
                  >
                    Open WhatsApp
                  </a>
                  <button
                    type="button"
                    onClick={() => setResult(null)}
                    className="inline-flex h-11 items-center justify-center rounded-ctl border border-line-strong bg-surface px-5 text-[15px] font-medium text-ink transition-colors hover:bg-canvas"
                  >
                    Edit details
                  </button>
                  <Link
                    href="/learn/demo"
                    className="inline-flex h-11 items-center justify-center rounded-ctl border border-line-strong bg-surface px-5 text-[15px] font-medium text-ink transition-colors hover:bg-canvas"
                  >
                    Try the demo
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="rs-company" className={label}>
                    Company name
                  </label>
                  <input
                    id="rs-company"
                    type="text"
                    required
                    autoComplete="organization"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Your registered business name"
                    className={field}
                  />
                </div>

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div>
                    <label htmlFor="rs-name" className={label}>
                      Your name
                    </label>
                    <input
                      id="rs-name"
                      type="text"
                      required
                      autoComplete="name"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      className={field}
                    />
                  </div>
                  <div>
                    <label htmlFor="rs-phone" className={label}>
                      Phone
                    </label>
                    <input
                      id="rs-phone"
                      type="tel"
                      required
                      autoComplete="tel"
                      value={clientPhone}
                      onChange={(e) => setClientPhone(e.target.value)}
                      placeholder="+91"
                      className={field}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div>
                    <label htmlFor="rs-email" className={label}>
                      Work email
                    </label>
                    <input
                      id="rs-email"
                      type="email"
                      required
                      autoComplete="email"
                      value={clientEmail}
                      onChange={(e) => setClientEmail(e.target.value)}
                      className={field}
                    />
                  </div>
                  <div>
                    <label htmlFor="rs-gstin" className={label}>
                      GSTIN or PAN{" "}
                      <span className="font-normal text-ink-muted">
                        (optional)
                      </span>
                    </label>
                    <input
                      id="rs-gstin"
                      type="text"
                      value={gstinOrPan}
                      onChange={(e) => setGstinOrPan(e.target.value)}
                      className={`${field} font-mono`}
                    />
                  </div>
                </div>

                <fieldset className="border-t border-line pt-5">
                  <legend className="sr-only">Location</legend>
                  <p className="text-[15px] font-semibold tracking-[-0.01em]">
                    Where is your business?
                  </p>
                  <p className="mt-1 text-[14px] text-ink-muted">
                    Included in your WhatsApp setup message for GST &amp; onboarding.
                  </p>

                  <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label htmlFor="rs-state" className={label}>
                        State
                      </label>
                      <select
                        id="rs-state"
                        value={selectedState.code}
                        onChange={(e) => {
                          const found = INDIAN_STATES.find(
                            (s) => s.code === e.target.value,
                          );
                          if (found) setSelectedState(found);
                        }}
                        className={`${field} pr-8`}
                      >
                        {INDIAN_STATES.map((s) => (
                          <option key={s.code} value={s.code}>
                            {s.name} ({s.code})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="rs-city" className={label}>
                        City or town
                      </label>
                      <input
                        id="rs-city"
                        type="text"
                        required
                        autoComplete="address-level2"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        className={field}
                      />
                    </div>
                    <div>
                      <label htmlFor="rs-pincode" className={label}>
                        Pincode
                      </label>
                      <input
                        id="rs-pincode"
                        type="text"
                        inputMode="numeric"
                        required
                        maxLength={6}
                        autoComplete="postal-code"
                        value={pincode}
                        onChange={(e) => setPincode(e.target.value)}
                        className={`${field} font-mono`}
                      />
                    </div>
                  </div>
                </fieldset>

                <button
                  type="submit"
                  className="inline-flex h-11 w-full items-center justify-center rounded-ctl bg-brand px-5 text-[15px] font-semibold text-panel-deep transition-[background-color,transform] duration-150 hover:bg-brand-hover active:translate-y-px motion-reduce:transform-none"
                >
                  Continue on WhatsApp
                </button>

                <p className="text-center text-[14px] text-ink-muted">
                  Already set up?{" "}
                  <Link
                    href="/login"
                    className="font-medium text-brand-strong underline-offset-4 hover:underline"
                  >
                    Sign in
                  </Link>
                </p>
              </form>
            )}
          </div>
        </Reveal>
      </main>
    </div>
  );
}
