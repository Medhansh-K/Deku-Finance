import { type NextRequest } from "next/server";
import { ACCESS_COOKIE, startSession } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  return startSession("change-password", await request.text(), request.cookies.get(ACCESS_COOKIE)?.value);
}
