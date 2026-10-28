import { Suspense } from "react";
import { AppShell } from "@/layouts/AppShell";
import { InvoicesView } from "@/modules/invoices/InvoicesView";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sales Invoices & Billed Turnover | Deku Finance",
  description: "Sales invoices register, turnover tracking, payment conversions, and accounts receivable reconciliation",
};

export default function InvoicesPage() {
  return (
    <AppShell>
      <div className="p-4 sm:p-6 max-w-7xl mx-auto">
        <Suspense fallback={<div className="p-4 text-xs text-slate-500 font-mono">Loading invoices...</div>}>
          <InvoicesView />
        </Suspense>
      </div>
    </AppShell>
  );
}
