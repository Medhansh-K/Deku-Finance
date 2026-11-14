import { FixedAssetsRegisterView } from "@/modules/financial-reports/FixedAssetsRegisterView";

export const metadata = {
  title: "Fixed Asset Register & Depreciation | Deku Finance",
  description: "Asset capitalization, statutory SLM & WDV depreciation schedules, and automated general ledger posting.",
};

export default function FixedAssetsPage() {
  return <FixedAssetsRegisterView />;
}
