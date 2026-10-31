import { NextResponse, type NextRequest } from "next/server";
import { REFRESH_COOKIE, backendUrl, clearSessionCookies } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  if (refreshToken) {
    // Cookies are cleared even if the backend is unreachable; the token then simply expires.
    await fetch(backendUrl("/api/v1/auth/logout"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
      cache: "no-store",
    }).catch(() => undefined);
  }
  const res = new NextResponse(null, { status: 204 });
  clearSessionCookies(res);
  return res;
}
