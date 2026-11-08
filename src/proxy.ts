import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/auth/session";

export default async function proxy(request: NextRequest) {
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

  return await updateSession(request);
}

export const config = {
  matcher: [
    // Everything except Next's static assets and images.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
