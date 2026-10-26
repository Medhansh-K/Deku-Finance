import { AppShell } from "@/layouts/AppShell";
import { DebtorsDsoView } from "@/modules/financial-reports/debtors/DebtorsDsoView";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Trade Debtors (AR) & DSO Tracking | Deku Finance",
  description: "Accounts receivable tracking as per Days Sales Outstanding (DSO), open customer invoices, and aging breakdown",
};

export default function DebtorsPage() {
  return (
    <AppShell>
      <div className="p-4 sm:p-6 max-w-7xl mx-auto">
        <DebtorsDsoView />
      </div>
    </AppShell>
  );
}
