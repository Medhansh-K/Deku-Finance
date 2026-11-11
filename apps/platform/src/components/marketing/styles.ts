/** Shared class strings for the public secondary pages (features, GST compliance). */
export const container = "mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8";

const cta =
  "inline-flex h-11 items-center justify-center gap-2 rounded-ctl px-5 text-[15px] transition-[background-color,border-color,color,transform] duration-150 active:translate-y-px motion-reduce:transform-none";
export const primaryCta = `${cta} bg-brand font-semibold text-panel-deep hover:bg-brand-hover`;
export const secondaryCta = `${cta} border border-line-strong bg-surface font-medium text-ink hover:border-ink-subtle hover:bg-canvas`;
/** Secondary button on a dark evergreen section. */
export const darkSecondaryCta = `${cta} border border-white/20 font-medium text-white hover:border-white/40 hover:bg-white/5`;

export const h1 = "text-[36px] font-semibold leading-[1.06] tracking-[-0.035em] sm:text-[56px]";
export const h2 = "text-[30px] font-semibold leading-[1.15] tracking-[-0.03em] sm:text-[38px]";
export const lead = "max-w-[64ch] text-[17px] leading-[1.55] text-ink-soft";
export const chip = "inline-flex h-[22px] shrink-0 items-center rounded-chip px-2 text-xs font-medium";

/** Panels that respond to the pointer: a firmer border and a small lift. */
export const card =
  "rounded-panel border border-line bg-surface transition-[border-color,transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-line-strong motion-reduce:transform-none";

export const table = {
  wrap: "overflow-x-auto rounded-panel border border-line bg-surface",
  th: "px-4 py-3 text-left text-[13px] font-medium text-ink-muted sm:px-5",
  td: "border-t border-line px-4 py-4 align-top text-[15px] text-ink-soft sm:px-5",
  head: "bg-canvas/60",
};
