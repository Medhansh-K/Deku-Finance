import { AppShell } from "@/layouts/AppShell";
import { OperatingExpensesView } from "@/modules/financial-reports/operating-expenses/OperatingExpensesView";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Operating Expenses & Payment Vouchers | Deku Finance",
  description: "Operating expenses ledger, issued payment vouchers to companies and individuals, and department-wise spend allocations",
};

export default function OperatingExpensesPage() {
  return (
    <AppShell>
      <div className="p-4 sm:p-6 max-w-7xl mx-auto">
        <OperatingExpensesView />
      </div>
    </AppShell>
  );
}
