import Link from "next/link";
import { DekuWordmark } from "./LandingNavbar";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { href: "/features", label: "Features" },
      { href: "/gst-compliance", label: "GST compliance" },
      { href: "/#pricing", label: "Pricing" },
      { href: "/#faq", label: "Questions" },
    ],
  },
  {
    title: "Learn",
    links: [
      { href: "/learn/demo", label: "Try the demo" },
      { href: "/learn", label: "Learn Centre" },
      { href: "/learn/docs", label: "Guides" },
    ],
  },
  {
    title: "Get started",
    links: [
      { href: "/request-setup", label: "Request a setup" },
      { href: "/login", label: "Sign in" },
      { href: "tel:+917506461004", label: "+91 75064 61004" },
    ],
  },
];

export default function LandingFooter() {
  return (
    <footer className="border-t border-line bg-surface font-sans">
      <div className="mx-auto grid max-w-[1200px] grid-cols-2 gap-x-6 gap-y-7 px-4 py-10 sm:px-8 sm:py-16 md:grid-cols-[1.4fr_repeat(3,1fr)] md:gap-12">
        <div className="col-span-2 max-w-xs space-y-4 md:col-span-1">
          <DekuWordmark />
          <p className="text-[14px] leading-relaxed text-ink-muted">
            GST and financial operating system for Indian businesses. Double-entry books, GST returns prepared from
            them, and a keyboard for every screen.
          </p>
        </div>
        {COLUMNS.map((col) => (
          <div key={col.title}>
            <h2 className="text-[13px] font-medium text-ink">{col.title}</h2>
            <ul className="mt-4 space-y-3">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="rounded-chip text-[14px] text-ink-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-line">
        <p className="mx-auto max-w-[1200px] px-5 py-6 text-[13px] text-ink-muted sm:px-8">
          © 2026 Deku Finance.
        </p>
      </div>
    </footer>
  );
}
