"use client";

import React, { useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
// Internal but stable: what useRouter() reads. Lets the demo keep module screens' router.push inside the workspace.
import { AppRouterContext, type AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { Download } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
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
import { downloadFile, downloadJson } from "@/lib/download";
import { demoStatementCsv } from "@/lib/learn/sample-data";
import { ExecutiveSummaryView } from "@/modules/executive/ExecutiveSummaryView";
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
      title="GST returns"
      subtitle="GSTR-1 and GSTR-3B from the demo invoices and purchases. Offline JSON needs PRO or Enterprise."
      badge={<Badge variant={canJson ? "teal" : "warning"}>{canJson ? "Offline JSON" : "Summary only on GO"}</Badge>}
      actions={
        <div className="w-44">
          <label className="block text-[13px] text-ink-muted mb-1" htmlFor="demo-ret-period">
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

  const wrap = (title: string, subtitle: string, node: React.ReactNode) => (
    <WorkspaceLayout title={title} subtitle={subtitle}>
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
    return wrap("Vouchers", "Contra, payment, receipt, journal, sales and purchase entries", <VoucherWorkspace key={`v-${mode}-${datasetVersion}`} initialMode={mode} />
    );
  }

  if (basePath === "/day-book") {
    return wrap("Day Book", "Every voucher in date order, posted and draft", <DayBookView key={`db-${datasetVersion}`} />
    );
  }
  if (basePath === "/approvals") {
    return wrap("Approvals", "Vouchers waiting for a checker to post or send back", <ApprovalsView key={`ap-${datasetVersion}`} />);
  }
  if (basePath === "/gst") {
    return wrap("Sales & GST invoices", "Tax invoices, bills of supply and credit or debit notes", <GstTaxHubView key={`gst-${datasetVersion}`} />);
  }
  if (basePath === "/gst/returns" || basePath === "/gst/file" || basePath === "/gst-returns") {
    return <GstReturnsDemoScreen key={`gstr-${datasetVersion}`} />;
  }
  if (basePath === "/purchases") {
    return wrap("Purchases & ITC", "Vendor bills, input tax credit and blocked credit", <PurchasesView key={`pur-${datasetVersion}`} />);
  }
  if (basePath === "/collect") {
    return wrap("Collections", "Unpaid invoices, settlements and WhatsApp reminders", <CollectView key={`col-${datasetVersion}`} />);
  }
  if (basePath === "/inventory") {
    return wrap("Inventory & stock", "Items, warehouses and FIFO valuation", <InventoryView key={`inv-${datasetVersion}`} />);
  }
  if (basePath === "/banking/reconciliation") {
    const statement = dataset.bankStatements[0];
    return (
      <WorkspaceLayout
        title="Bank reconciliation"
        subtitle="Match a bank statement against the bank ledger"
        actions={
          statement ? (
            <button
              type="button"
              data-tour="demo-statement-download"
              onClick={() => downloadFile(`demo-bank-statement-${dataset.org.slug}.csv`, demoStatementCsv(statement), "text/csv")}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-ctl border border-line-strong bg-surface hover:bg-canvas text-[13.5px] font-medium text-ink"
              title="A sample statement for this demo company, made in your browser"
            >
              <Download className="h-4 w-4 text-ink-soft" />
              Download demo statement
            </button>
          ) : undefined
        }
      >
        <ReconciliationView key={`br-${datasetVersion}`} />
      </WorkspaceLayout>
    );
  }
  if (basePath === "/reconciliation") {
    return wrap("Marketplace settlements", "Gross sales, fees and TCS from marketplace payouts", <MarketplaceView key={`mkt-${datasetVersion}`} />);
  }
  if (basePath === "/builder") {
    return wrap("Document builder", "Quotations, proforma invoices and delivery challans", <DocumentBuilderView key={`bld-${datasetVersion}`} />);
  }
  if (basePath === "/masters/chart-of-accounts") {
    return wrap("Chart of accounts", "Assets, liabilities, equity, revenue and expense ledgers", <ChartOfAccountsView key={`coa-${datasetVersion}`} />);
  }
  if (basePath === "/masters/parties") {
    return wrap("Parties", "Customers and suppliers with GSTIN", <PartiesView key={`pty-${datasetVersion}`} />);
  }
  if (basePath === "/masters/products-services") {
    return wrap("Stock & services", "Items with HSN/SAC codes and tax rates", <ProductsServicesView key={`cat-${datasetVersion}`} />);
  }
  if (basePath === "/reports/trial-balance") {
    return wrap("Trial Balance", "Debit and credit balances across posted ledgers", <TrialBalanceView key={`tb-${datasetVersion}`} />);
  }
  if (basePath === "/reports/profit-loss") {
    return wrap("Profit & Loss", "Revenue, cost of goods, overheads and net profit", <ProfitLossView key={`pl-${datasetVersion}`} />);
  }
  if (basePath === "/reports/balance-sheet") {
    return wrap("Balance Sheet", "Assets, liabilities and equity, with profit to date", <BalanceSheetView key={`bs-${datasetVersion}`} />);
  }
  if (basePath === "/reports/general-ledger") {
    return wrap("General Ledger", "One account, every entry, with running balance", <GeneralLedgerView key={`gl-${datasetVersion}`} />);
  }
  if (basePath === "/reports/cash-flow") {
    return wrap("Cash Flow", "Operating inflows, outflows and closing cash", <CashFlowView key={`cf-${datasetVersion}`} />);
  }
  if (basePath === "/reports/debtors") {
    return wrap("Debtors & DSO", "Customer receivables by age and collection days", <DebtorsDsoView key={`dso-${datasetVersion}`} />);
  }
  if (basePath === "/reports/creditors") {
    return wrap("Creditors & DPO", "Supplier payables by age and payment days", <CreditorsDpoView key={`dpo-${datasetVersion}`} />);
  }
  if (basePath === "/reports/fpa") {
    return wrap("FP&A", "Margins, working capital, runway and department budgets", <FpaExecutiveView key={`fpa-${datasetVersion}`} />);
  }
  if (basePath === "/reports/operating-expenses") {
    return wrap("Operating expenses", "Operating costs by ledger", <OperatingExpensesView key={`opex-${datasetVersion}`} />);
  }
  if (basePath === "/executive") {
    return <ExecutiveSummaryView key={`exec-${datasetVersion}`} />;
  }
  if (basePath === "/departments-members") {
    return wrap("Departments & members", "Teams, roles and payroll runs", <DepartmentsMembersView key={`dm-${datasetVersion}`} />);
  }
  if (basePath === "/audit") {
    return wrap("Audit log", "Postings, approvals and reversals, in order", <AuditTrailView key={`aud-${datasetVersion}`} />);
  }
  if (basePath === "/consultant") {
    return (
      <div className="w-full h-full overflow-hidden flex flex-col flex-1 bg-canvas text-ink">
        <DekuConsultantView key={`con-${datasetVersion}`} />
      </div>
    );
  }
  if (basePath === "/settings") {
    return wrap("Settings", "Fiscal periods, approval controls and connections", <SettingsView key={`set-${datasetVersion}`} />);
  }
  if (basePath === "/help") {
    return wrap("Help & tutorials", "Walkthroughs for every module and workflow", <HelpCentreView key={`hlp-${datasetVersion}`} />);
  }
  if (basePath === "/companies") {
    return wrap("Company", "The demo company's details", <CompaniesView key={`cmp-${datasetVersion}`} />);
  }
  if (basePath === "/import") {
    return wrap("Import", "Bring in data from Tally XML or CSV", <ImportView key={`imp-${datasetVersion}`} />);
  }
  if (basePath === "/export") {
    return wrap("Export", "Day Book and masters as CSV", <ExportView key={`exp-${datasetVersion}`} />);
  }
  if (basePath === "/kyc") {
    return wrap("Identity & KYC", "Needs a KYC provider in production; simulated here", <KycHubView key={`kyc-${datasetVersion}`} />);
  }

  return (
    <GatewayLayout>
      <GatewayLanding key={`gw-fallback-${datasetVersion}`} />
    </GatewayLayout>
  );
}

/** `?tour=<core path id>` starts a Help Centre tutorial. `?workflow=` is applied by the provider; both are dropped from the URL once used. */
function TourAutoStarter({ initialTour, initialWorkflow }: { initialTour?: string | null; initialWorkflow?: string | null }) {
  const { user } = useAuth();
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    if (initialTour && user) saveProgress(user.id, startPath(loadProgress(user.id), initialTour));
    // Consumed: a reload resumes from saved progress instead of starting again.
    const url = new URL(window.location.href);
    url.searchParams.delete("tour");
    url.searchParams.delete("workflow");
    window.history.replaceState(null, "", url.toString());
  }, [initialTour, initialWorkflow, user]);
  return null;
}

const LEAVES_DEMO = /^\/(learn|login|signup|request-setup)(\/|\?|$)/;

/** Screens call router.push for in-app pages (a report row opening the ledger, say); in the demo those stay in the workspace. */
function DemoRouterShim({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { navigateTo } = useLearnDemo();
  const value = useMemo<AppRouterInstance>(() => {
    const stays = (href: string) => href.startsWith("/") && !LEAVES_DEMO.test(href);
    return {
      ...router,
      push: (href, opts) => (stays(href) ? navigateTo(href) : router.push(href, opts)),
      replace: (href, opts) => (stays(href) ? navigateTo(href) : router.replace(href, opts)),
    };
  }, [router, navigateTo]);
  return <AppRouterContext.Provider value={value}>{children}</AppRouterContext.Provider>;
}

export function LearnDemoWorkspace({
  initialCompany,
  initialRole,
  initialPlan,
  initialRoute,
  initialTour,
  initialWorkflow,
}: {
  initialCompany?: DemoCompanySlug;
  initialRole?: OrgRole;
  initialPlan?: DemoPlanId;
  initialRoute?: string;
  initialTour?: string | null;
  initialWorkflow?: string | null;
}) {
  return (
    <LearnDemoProvider
      initialCompany={initialCompany}
      initialRole={initialRole}
      initialPlan={initialPlan}
      initialRoute={initialRoute}
      initialWorkflow={initialWorkflow}
    >
      <TourAutoStarter initialTour={initialTour} initialWorkflow={initialWorkflow} />
      <DemoRouterShim>
        <AppShell>
          <DemoScreenDispatcher />
        </AppShell>
      </DemoRouterShim>
    </LearnDemoProvider>
  );
}
