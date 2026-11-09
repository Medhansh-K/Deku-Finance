import { connection, NextResponse, type NextRequest } from "next/server";
import { startSession } from "@/lib/auth/session";

// Sandbox accounts from the demo seed (seed.sql), which belong only to fictional companies. Kept on
// the server so a customer deployment's browser bundle carries no password.
const DEMO_ACCOUNTS: Record<string, string> = {
  owner: "demo-owner@deku.finance",
  accountant: "demo-accountant@deku.finance",
  freelancer: "demo-freelancer@deku.finance",
};
const DEMO_PASSWORD = "DekuDemo#2026";

const enabled = () => process.env.DEKU_SEED_DEMO === "true";

export async function GET() {
  // Read per request: the image is the same with or without the demo.
  await connection();
  return NextResponse.json({ enabled: enabled() });
}

export async function POST(request: NextRequest) {
  if (!enabled()) return NextResponse.json({ error: "demo_disabled" }, { status: 404 });
  const { type } = await request.json().catch(() => ({ type: null }));
  if (typeof type !== "string" || !Object.hasOwn(DEMO_ACCOUNTS, type)) {
    return NextResponse.json({ error: "unknown_demo_account" }, { status: 400 });
  }
  return startSession("login", JSON.stringify({ email: DEMO_ACCOUNTS[type], password: DEMO_PASSWORD }));
}
