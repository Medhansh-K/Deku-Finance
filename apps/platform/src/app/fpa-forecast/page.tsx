import { FpaScenarioDashboard } from "@/modules/financial-reports/FpaScenarioDashboard";

export const metadata = {
  title: "FP&A Multi-Scenario Financial Forecasting | Deku Finance",
  description: "12-month rolling cash runway, P&L Best/Base/Worst case sensitivity levers, and liquidity projections.",
};

export default function FpaForecastPage() {
  return <FpaScenarioDashboard />;
}
