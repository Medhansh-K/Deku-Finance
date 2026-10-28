import Link from "next/link";
import { Layers, PhoneCall, ShieldCheck, ExternalLink } from "lucide-react";

export default function LandingFooter() {
  return (
    <footer className="border-t border-edge bg-panel-deep text-white font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10">
          {/* Brand Info (2 cols) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-brand text-ink flex items-center justify-center font-black">
                <Layers className="h-5 w-5 text-ink" />
              </div>
              <span className="font-extrabold text-xl tracking-tight text-white">
                Deku<span className="text-brand">Finance</span>
              </span>
            </div>
            <p className="text-sm text-slate-400 max-w-sm leading-relaxed">
              India’s desktop-first accounting operating system. Built for seamless compliance, frictionless keyboard-driven invoicing, and real-time ALERX double-entry ledger bookkeeping.
            </p>
            <div className="pt-2 flex items-center gap-2 text-xs text-brand-soft bg-panel border border-edge px-3.5 py-2 rounded-xl w-fit">
              <PhoneCall className="h-3.5 w-3.5 text-brand" />
              <span>Dedicated Support Helpline: <strong>+91 7506461004</strong></span>
            </div>
          </div>

          {/* Column 1: Financial Engine */}
          <div className="space-y-3">
            <h5 className="text-xs font-mono font-bold uppercase tracking-widest text-slate-400">
              Platform Modules
            </h5>
            <ul className="space-y-2 text-sm text-slate-400">
              <li>
                <Link href="/gateway" className="hover:text-brand transition-colors">
                  Gateway of Deku (Desktop)
                </Link>
              </li>
              <li>
                <Link href="/vouchers/sales" className="hover:text-brand transition-colors">
                  Sales & Tax Invoices (F8)
                </Link>
              </li>
              <li>
                <Link href="/vouchers/purchase" className="hover:text-brand transition-colors">
                  Purchase & Inward Bills (F9)
                </Link>
              </li>
              <li>
                <Link href="/masters/parties" className="hover:text-brand transition-colors">
                  Party Master (Customers/Vendors)
                </Link>
              </li>
              <li>
                <Link href="/masters/chart-of-accounts" className="hover:text-brand transition-colors">
                  ALERX 4-Tier COA
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 2: Government & Compliance */}
          <div className="space-y-3">
            <h5 className="text-xs font-mono font-bold uppercase tracking-widest text-slate-400">
              Tax & Reports
            </h5>
            <ul className="space-y-2 text-sm text-slate-400">
              <li>
                <Link href="/gst" className="hover:text-brand transition-colors">
                  GST Tax Engine & Splits
                </Link>
              </li>
              <li>
                <Link href="/day-book" className="hover:text-brand transition-colors">
                  Day Book Register
                </Link>
              </li>
              <li>
                <Link href="/reports/trial-balance" className="hover:text-brand transition-colors">
                  Trial Balance Equilibrium
                </Link>
              </li>
              <li>
                <Link href="/reports/balance-sheet" className="hover:text-brand transition-colors">
                  Balance Sheet Verification
                </Link>
              </li>
              <li>
                <Link href="/audit" className="hover:text-brand transition-colors">
                  Immutable Audit Trail
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Legal & Standards */}
          <div className="space-y-3">
            <h5 className="text-xs font-mono font-bold uppercase tracking-widest text-slate-400">
              Statutory Governance
            </h5>
            <ul className="space-y-2 text-sm text-slate-400">
              <li>
                <span className="text-slate-300 font-medium">Sec 22 CGST Act Exempt</span>
              </li>
              <li>
                <span className="text-slate-300 font-medium">Indian GAAP (ALERX)</span>
              </li>
              <li>
                <span className="text-slate-300 font-medium">MSME Samadhaan 45-Day</span>
              </li>
              <li>
                <span className="text-slate-300 font-medium">Zero Password Sharing</span>
              </li>
              <li>
                <span className="text-slate-300 font-medium">Postgres Trigger Guard</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Legal Disclaimer Bar */}
        <div className="mt-12 pt-8 border-t border-panel text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span>
              © 2026 Deku Finance. Built in India for entrepreneurs, professionals, and enterprises.
            </span>
          </div>
          <div className="flex items-center gap-4 text-slate-400 font-mono text-[11px]">
            <span>Server: 2026-10-20</span>
            <span>•</span>
            <span>PostgreSQL Multi-Tenant RLS</span>
            <span>•</span>
            <span className="text-brand">Axum Backend Active</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
