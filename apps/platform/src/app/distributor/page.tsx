import { redirect } from "next/navigation";
import { ComingSoon } from "@/components/ui/ComingSoon";

export default function DistributorRedirect() {
  const target =
    process.env.DISTRIBUTOR_URL ||
    (process.env.NODE_ENV !== "production" ? "http://localhost:3002/" : undefined);
  if (target) redirect(target);
  return <ComingSoon title="Distributor portal is deployed separately" />;
}

