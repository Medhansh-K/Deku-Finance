import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE, proxyTarget } from "@/lib/auth/session";

// location: the Razorpay OAuth callback answers with a same-origin redirect to /settings.
const PASS_RESPONSE_HEADERS = ["content-type", "content-disposition", "cache-control", "location"];

async function forward(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const target = proxyTarget((await params).path, request.nextUrl.search);
  if (!target) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Built from scratch so the browser's cookies and Host never reach the backend.
  const headers = new Headers();
  for (const name of ["content-type", "accept"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const token = request.cookies.get(ACCESS_COOKIE)?.value;
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers,
      body: ["GET", "HEAD"].includes(request.method) ? undefined : await request.arrayBuffer(),
      redirect: "manual",
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ error: "backend_unavailable" }, { status: 502 });
  }

  const out = new Headers();
  for (const name of PASS_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) out.set(name, value);
  }
  return new Response(upstream.body, { status: upstream.status, headers: out });
}

export { forward as GET, forward as POST, forward as PUT, forward as PATCH, forward as DELETE };
