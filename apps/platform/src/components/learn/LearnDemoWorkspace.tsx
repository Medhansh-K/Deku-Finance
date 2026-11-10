"use client";

import React, { useEffect } from "react";
import { AppShell } from "@/layouts/AppShell";
import { GatewayLayout } from "@/layouts/GatewayLayout";
import { WorkspaceLayout } from "@/layouts/WorkspaceLayout";
import { Badge } from "@/components/ui/Badge";
import { LearnDemoProvider, useLearnDemo } from "@/context/LearnDemoContext";
import { GatewayLanding } from "@/modules/gateway/GatewayLanding";
import { VoucherWorkspace, type VoucherMode } from "@/modules/vouchers/VoucherWorkspace";
import { DayBookView } from "@/modules/day-book/DayBookView";
import { GstTaxHubView } from "@/modules/gst/GstTaxHubView";
import { PurchasesView } from "@/modules/purchases/PurchasesView";
import { CollectView } from "@/modules/collect/CollectView";
import { InventoryView } from "@/modules/inventory/InventoryView";
import { ReconciliationView } from "@/modules/banking/ReconciliationView";
import { MarketplaceView } from "@/modules/marketplace/MarketplaceView";
import { ApprovalsView } from "@/modules/approvals/ApprovalsView";
import { AuditTrailView } from "@/modules/audit/AuditTrailView";
import { DepartmentsMembersView } from "@/modules/departments-members/DepartmentsMembersView";
import { DekuConsultantView } from "@/modules/consultant/DekuConsultantView";
import { DocumentBuilderView } from "@/modules/builder/DocumentBuilderView";
import { ChartOfAccountsView } from "@/modules/masters/chart-of-accounts/ChartOfAccountsView";
import { PartiesView } from "@/modules/masters/parties/PartiesView";
import { ProductsServicesView } from "@/modules/masters/products-services/ProductsServicesView";
import { BalanceSheetView } from "@/modules/financial-reports/balance-sheet/BalanceSheetView";
import { ProfitLossView } from "@/modules/financial-reports/profit-loss/ProfitLossView";
import { TrialBalanceView } from "@/modules/financial-reports/trial-balance/TrialBalanceView";
import { GeneralLedgerView } from "@/modules/financial-reports/general-ledger/GeneralLedgerView";
import { CashFlowView } from "@/modules/financial-reports/cash-flow/CashFlowView";
import { DebtorsDsoView } from "@/modules/financial-reports/debtors/DebtorsDsoView";
import { CreditorsDpoView } from "@/modules/financial-reports/creditors/CreditorsDpoView";
import { FpaExecutiveView } from "@/modules/financial-reports/fpa/FpaExecutiveView";
import { OperatingExpensesView } from "@/modules/financial-reports/operating-expenses/OperatingExpensesView";
import { SettingsView } from "@/modules/settings/SettingsView";
import { HelpCentreView } from "@/modules/help/HelpCentreView";
import { CompaniesView } from "@/modules/companies/CompaniesView";
import { ImportView } from "@/modules/import/ImportView";
import { ExportView } from "@/modules/import/ExportView";
import { KycHubView } from "@/modules/kyc/KycHubView";
import { ReturnCard } from "@/modules/gst/ReturnCard";
import { Table6Card } from "@/modules/gst/Table6Card";
import { GSTR1_NOT_COVERED, GSTR3B_NOT_COVERED } from "@/lib/gst/returns";
import { useReturnPeriod } from "@/lib/gst/period";
import { useReturnBooks } from "@/lib/gst/useReturnBooks";
import { downloadJson } from "@/lib/download";
import { RecentlyAddedVouchers } from "@/modules/executive/RecentlyAddedVouchers";
import { loadProgress, saveProgress, startPath } from "@/lib/tutorials/progress";
import type { DemoCompanySlug } from "@/lib/learn/companies";
import type { DemoPlanId } from "@/lib/learn/demo-plans";
import type { OrgRole } from "@/modules/departments-members/team";

function GstReturnsDemoScreen() {
  const { plan } = useLearnDemo();
  const { month, setMonth, fy, retPeriod } = useReturnPeriod();
  const { gstin, loading, loadError, gstr1, gstr3b } = useReturnBooks(retPeriod);
  const canJson = plan !== "go";

  return (
    <WorkspaceLayout
      title="GST Returns: GSTR-1 & GSTR-3B"
      subtitle="Generated deterministically from demo invoices and purchase ledgers. Offline JSON requires PRO or Enterprise."
      badge={<Badge variant={canJson ? "teal" : "warning"}>{canJson ? "Offline JSON Active" : "GO Summary Mode"}</Badge>}
      actions={
        <div className="w-44">
          <label className="block text-[10px] font-mono uppercase text-ink-muted mb-1" htmlFor="demo-ret-period">
            Return period (FY {fy || "2026-27"})
          </label>
          <input
            id="demo-ret-period"
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-ink"
          />
        </div>
      }
    >
      <div className="max-w-5xl mx-auto space-y-5">
        {loading && <p className="text-xs text-ink-muted">Compiling return books…</p>}
        {loadError && <p className="text-xs text-rose-600 font-semibold">{loadError}</p>}
        {gstr1 && gstr3b && (
          <div className="grid grid-cols-1 gap-5">
            <ReturnCard
              title="GSTR-1"
              result={gstr1}
              notCovered={GSTR1_NOT_COVERED}
              onDownload={
                canJson
                  ? () => downloadJson(`DEMO_GSTR1_${gstin}_${retPeriod}.json`, gstr1.json)
                  : undefined
              }
            />
            <ReturnCard
              title="GSTR-3B"
              result={gstr3b}
              notCovered={GSTR3B_NOT_COVERED}
              onDownload={
                canJson
                  ? () => downloadJson(`DEMO_GSTR3B_${gstin}_${retPeriod}.json`, gstr3b.json)
                  : undefined
              }
            />
            <Table6Card table6={gstr3b.table6} />
          </div>
        )}
      </div>
    </WorkspaceLayout>
  );
}

function DemoScreenDispatcher() {
  const { activeRoute, datasetVersion, dataset } = useLearnDemo();
  const basePath = activeRoute.split("?")[0];

  const wrap = (title: string, subtitle: string, badgeText: string, node: React.ReactNode) => (
    <WorkspaceLayout title={title} subtitle={subtitle} badge={<Badge variant="teal">{badgeText}</Badge>}>
      {node}
    </WorkspaceLayout>
  );

  if (basePath === "/gateway") {
    return (
      <GatewayLayout>
        <GatewayLanding key={`gw-${datasetVersion}`} />
      </GatewayLayout>
    );
  }

  if (basePath.startsWith("/vouchers")) {
    const seg = basePath.split("/")[2] as VoucherMode | undefined;
    const validModes: VoucherMode[] = ["contra", "payment", "receipt", "journal", "sales", "purchase"];
    const mode: VoucherMode = seg && validModes.includes(seg) ? seg : "payment";
    return wrap(
      "Accounting Vouchers (F4–F9)",
      "Unified double-entry desk with ALERX debit-credit parity and Maker-Checker controls",
      "F4–F9 Desk",
      <VoucherWorkspace key={`v-${mode}-${datasetVersion}`} initialMode={mode} />
    );
  }

  if (basePath === "/day-book") {
    return wrap(
      "Day Book",
      "Chronological immutable register of posted and draft vouchers",
      "Journal Log",
      <DayBookView key={`db-${datasetVersion}`} />
    );
  }
  if (basePath === "/approvals") {
    return wrap("Maker-Checker Approvals", "Independent Checker sign-off queue (Owner / CFO / Admin)", "Governance", <ApprovalsView key={`ap-${datasetVersion}`} />);
  }
  if (basePath === "/gst") {
    return wrap("GST & Invoicing Hub", "CGST/SGST vs IGST Place-of-Supply engine and Tax Invoices", "GST Engine", <GstTaxHubView key={`gst-${datasetVersion}`} />);
  }
  if (basePath === "/gst/returns" || basePath === "/gst/file" || basePath === "/gst-returns") {
    return <GstReturnsDemoScreen key={`gstr-${datasetVersion}`} />;
  }
  if (basePath === "/purchases") {
    return wrap("Purchases & ITC Register", "Vendor bills, Section 17(5) blocked credit & voucher linkage", "ITC & AP", <PurchasesView key={`pur-${datasetVersion}`} />);
  }
  if (basePath === "/collect") {
    return wrap("Receivables & Collections", "FIFO invoice settlement and MSME 45-day Sec 43B(h) tracker", "Collections", <CollectView key={`col-${datasetVersion}`} />);
  }
  if (basePath === "/inventory") {
    return wrap("Inventory & FIFO Warehouses", "Item valuation, batch layers and multi-godown tracking", "Stock & FIFO", <InventoryView key={`inv-${datasetVersion}`} />);
  }
  if (basePath === "/banking/reconciliation") {
    return wrap("Bank Statement Reconciliation", "Match CSV bank statements against Bank Ledger 1020", "F10 Banking", <ReconciliationView key={`br-${datasetVersion}`} />);
  }
  if (basePath === "/reconciliation") {
    return wrap("Marketplace Settlement Engine", "Split ECO Table 3.1.1 gross sales, fees & Sec 52 TCS", "ECO Sec 14", <MarketplaceView key={`mkt-${datasetVersion}`} />);
  }
  if (basePath === "/builder") {
    return wrap("Document Builder", "Quotations, Proforma Invoices and delivery chalans", "Pre-Sales Docs", <DocumentBuilderView key={`bld-${datasetVersion}`} />);
  }
  if (basePath === "/masters/chart-of-accounts") {
    return wrap("Chart of Accounts", "ALERX hierarchy of Assets, Liabilities, Equity, Revenue & Expenses", "Masters", <ChartOfAccountsView key={`coa-${datasetVersion}`} />);
  }
  if (basePath === "/masters/parties") {
    return wrap("Parties & Counterparties", "Customer & supplier masters with GSTIN check-digit validation", "Masters", <PartiesView key={`pty-${datasetVersion}`} />);
  }
  if (basePath === "/masters/products-services") {
    return wrap("Products & Services Catalogue", "HSN/SAC codes, tax rates and FIFO stock toggles", "Masters", <ProductsServicesView key={`cat-${datasetVersion}`} />);
  }
  if (basePath === "/reports/trial-balance") {
    return wrap("Trial Balance", "Real-time debit-credit parity across all posted ledgers", "Statement", <TrialBalanceView key={`tb-${datasetVersion}`} />);
  }
  if (basePath === "/reports/profit-loss") {
    return wrap("Profit & Loss Statement", "Operating revenue, COGS, overheads & net surplus", "Statement", <ProfitLossView key={`pl-${datasetVersion}`} />);
  }
  if (basePath === "/reports/balance-sheet") {
    return wrap("Balance Sheet", "Assets, Liabilities, Equity & current period profit roll-up", "Statement", <BalanceSheetView key={`bs-${datasetVersion}`} />);
  }
  if (basePath === "/reports/general-ledger") {
    return wrap("General Ledger", "Account-level transaction drill-down with running balances", "Audit Detail", <GeneralLedgerView key={`gl-${datasetVersion}`} />);
  }
  if (basePath === "/reports/cash-flow") {
    return wrap("Cash Flow Statement", "Operating inflows, outflows and closing liquidity", "Treasury", <CashFlowView key={`cf-${datasetVersion}`} />);
  }
  if (basePath === "/reports/debtors") {
    return wrap("Debtors & DSO Ageing", "Customer receivables ageing buckets & collection days", "Receivables", <DebtorsDsoView key={`dso-${datasetVersion}`} />);
  }
  if (basePath === "/reports/creditors") {
    return wrap("Creditors & DPO Ageing", "Supplier payables ageing buckets & settlement timing", "Payables", <CreditorsDpoView key={`dpo-${datasetVersion}`} />);
  }
  if (basePath === "/reports/fpa") {
    return wrap("FP&A Corporate Intelligence", "EBITDA margins, DSO/DPO, runway and department budgets", "FP&A", <FpaExecutiveView key={`fpa-${datasetVersion}`} />);
  }
  if (basePath === "/reports/operating-expenses") {
    return wrap("Operating Expenses Breakdown", "Ledger-wise operating cost drivers", "Expenses", <OperatingExpensesView key={`opex-${datasetVersion}`} />);
  }
  if (basePath === "/executive") {
    return wrap(
      `Executive Summary — ${dataset.org.name}`,
      "Live financial KPIs, FP&A variance & recently posted vouchers",
      "F1 Executive",
      <div className="space-y-6" key={`exec-${datasetVersion}`}>
        <FpaExecutiveView />
        <RecentlyAddedVouchers
          activeOrgId={dataset.org.id}
          activeOrgName={dataset.org.name}
        />
      </div>
    );
  }
  if (basePath === "/departments-members") {
    return wrap("Departments, Roles & Payroll", "7-Role RBAC governance, budgets and privacy-masked payroll", "Governance", <DepartmentsMembersView key={`dm-${datasetVersion}`} />);
  }
  if (basePath === "/audit") {
    return wrap("Immutable Audit Trail", "Append-only governance log of postings, approvals & reversals", "Compliance", <AuditTrailView key={`aud-${datasetVersion}`} />);
  }
  if (basePath === "/consultant") {
    return wrap("Deku Konsultant (Demo)", "Deterministic ledger intelligence preview", "F2 Consultant", <DekuConsultantView key={`con-${datasetVersion}`} />);
  }
  if (basePath === "/settings") {
    return wrap("Company Settings & Connectors", "Fiscal periods, Maker-Checker controls & integration simulation", "Settings", <SettingsView key={`set-${datasetVersion}`} />);
  }
  if (basePath === "/help") {
    return wrap("Help & Guided Tours", "Interactive walkthroughs across all modules and workflows", "Tutorials", <HelpCentreView key={`hlp-${datasetVersion}`} />);
  }
  if (basePath === "/companies") {
    return wrap("Company Profile Overview", "Active demonstration entity details", "Company", <CompaniesView key={`cmp-${datasetVersion}`} />);
  }
  if (basePath === "/import") {
    return wrap("Import Data Preview", "Tally XML / CSV review workflow", "Utility", <ImportView key={`imp-${datasetVersion}`} />);
  }
  if (basePath === "/export") {
    return wrap("Export Books", "CSV Day Book and Master exports", "Utility", <ExportView key={`exp-${datasetVersion}`} />);
  }
  if (basePath === "/kyc") {
    return wrap("Identity & KYC Verification", "Requires external KYC provider in production (simulated)", "Simulated", <KycHubView key={`kyc-${datasetVersion}`} />);
  }

  return (
    <GatewayLayout>
      <GatewayLanding key={`gw-fallback-${datasetVersion}`} />
    </GatewayLayout>
  );
}

function TourAutoStarter({ initialTour }: { initialTour?: string | null }) {
  const { navigateTo } = useLearnDemo();
  useEffect(() => {
    if (!initialTour) return;
    const progress = loadProgress("public-learn-demo");
    saveProgress("public-learn-demo", startPath(progress, initialTour));
    // Route alignment happens cleanly inside TutorialCoach, or navigate if needed
    void navigateTo;
  }, [initialTour, navigateTo]);
  return null;
}

export function LearnDemoWorkspace({
  initialCompany,
  initialRole,
  initialPlan,
  initialRoute,
  initialTour,
}: {
  initialCompany?: DemoCompanySlug;
  initialRole?: OrgRole;
  initialPlan?: DemoPlanId;
  initialRoute?: string;
  initialTour?: string | null;
}) {
  return (
    <LearnDemoProvider
      initialCompany={initialCompany}
      initialRole={initialRole}
      initialPlan={initialPlan}
      initialRoute={initialRoute}
    >
      <TourAutoStarter initialTour={initialTour} />
      <AppShell>
        <DemoScreenDispatcher />
      </AppShell>
    </LearnDemoProvider>
  );
}
