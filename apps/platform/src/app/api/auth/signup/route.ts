import { type NextRequest } from "next/server";
import { sessionFromBackend } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  return sessionFromBackend("signup", request);
}
