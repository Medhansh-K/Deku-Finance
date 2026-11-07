import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const dekuInterface = process.env.DEKU_INTERFACE;
  const { pathname } = request.nextUrl;

  // Interface-specific root redirection
  if (pathname === "/") {
    if (dekuInterface === "admin") {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
    if (dekuInterface === "distributor") {
      return NextResponse.redirect(new URL("/distributor", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/"],
};
