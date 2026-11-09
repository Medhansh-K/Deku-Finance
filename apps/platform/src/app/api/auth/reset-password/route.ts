import { NextResponse, type NextRequest } from "next/server";
import { backendAuth } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  return backendAuth(
    "reset-password",
    { method: "POST", headers: { "Content-Type": "application/json" }, body: await request.text() },
    () => NextResponse.json({ ok: true })
  );
}
