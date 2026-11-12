import { redirect } from "next/navigation";
import { ComingSoon } from "@/components/ui/ComingSoon";

export default function AdminRedirect() {
  const target =
    process.env.ADMIN_URL || (process.env.NODE_ENV !== "production" ? "http://localhost:3001/" : undefined);
  if (target) redirect(target);
  return <ComingSoon title="Admin portal is deployed separately" />;
}

