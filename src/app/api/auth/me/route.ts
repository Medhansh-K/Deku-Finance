import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE, backendAuth } from "@/lib/auth/session";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(ACCESS_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return backendAuth("me", { headers: { Authorization: `Bearer ${token}` } }, (data) =>
    NextResponse.json({ user: data.user })
  );
}
