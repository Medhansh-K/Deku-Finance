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
      <div className="px-5 pt-6 pb-8 sm:px-8 sm:pt-7 max-w-[1400px] mx-auto">
        <OperatingExpensesView />
      </div>
    </AppShell>
  );
}
