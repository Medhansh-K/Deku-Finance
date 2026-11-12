import { NextResponse } from "next/server";

/** Stateless readiness probe for Vercel uptime monitors and container healthchecks. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "deku-platform",
    status: "ready",
  });
}

