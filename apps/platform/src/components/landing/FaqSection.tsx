"use client";

import React, { useState } from "react";
import { Plus } from "lucide-react";
import Reveal from "./Reveal";
import { LANDING_FAQS } from "@/lib/landing/faqs";

export default function FaqSection() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section id="faq" aria-labelledby="faq-title" className="scroll-mt-20 bg-canvas">
      <div className="mx-auto grid max-w-[1200px] gap-6 px-4 py-10 sm:gap-12 sm:px-8 sm:py-16 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-16 lg:py-24">
        <Reveal>
          <h2 id="faq-title" className="text-[26px] font-semibold leading-[1.12] tracking-[-0.03em] text-ink sm:text-[34px] lg:text-[40px]">
            Questions, answered
          </h2>
          <p className="mt-3 max-w-[40ch] text-[15.5px] leading-[1.55] text-ink-soft sm:mt-5 sm:text-[17px]">
            Something else on your mind? Request a setup and we&apos;ll help you directly on WhatsApp.
          </p>
        </Reveal>

        <Reveal delay={80}>
          <ul className="border-t border-line-strong">
            {LANDING_FAQS.map((f, i) => {
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
                      className="flex w-full items-start justify-between gap-4 py-3.5 text-left text-[15px] font-medium leading-[1.4] text-ink transition-colors hover:text-brand-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-4 focus-visible:ring-offset-canvas sm:gap-6 sm:py-5 sm:text-[16.5px]"
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
                      <p className="max-w-[68ch] pb-4 pr-6 text-[14.5px] leading-[1.6] text-ink-soft sm:pb-6 sm:pr-10 sm:text-[15.5px]">{f.a}</p>
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
