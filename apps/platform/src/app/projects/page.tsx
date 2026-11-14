import { ProjectCostingView } from "@/modules/financial-reports/ProjectCostingView";

export const metadata = {
  title: "Project & Job Costing Finance | Deku Finance",
  description: "Project budget tracking, revenue and expense allocation, and real-time job profitability margins.",
};

export default function ProjectsPage() {
  return <ProjectCostingView />;
}
