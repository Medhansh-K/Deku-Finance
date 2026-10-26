import { AppShell } from "@/layouts/AppShell";
import { CreditorsDpoView } from "@/modules/financial-reports/creditors/CreditorsDpoView";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Trade Creditors (AP) & DPO Tracking | Deku Finance",
  description: "Accounts payable tracking as per Days Payable Outstanding (DPO), vendor credit terms, and invoices issued by them",
};

export default function CreditorsPage() {
  return (
    <AppShell>
      <div className="p-4 sm:p-6 max-w-7xl mx-auto">
        <CreditorsDpoView />
      </div>
    </AppShell>
  );
}
