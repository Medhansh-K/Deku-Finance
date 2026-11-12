import { NextResponse, type NextRequest } from "next/server";

export const ACCESS_COOKIE = "deku_at";
export const REFRESH_COOKIE = "deku_rt";
const ACCESS_MAX_AGE = 3600;
const REFRESH_MAX_AGE = 30 * 24 * 3600;

// Pages anyone may open; every other page needs a signed-in user.
const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/join",
  "/reset-password",
  "/request-setup",
  // The public setup form posts here; anonymous visitors must reach it.
  "/api/ecosystem/onboarding-request",
  "/api/auth",
  "/api/health",
  "/features",
  "/gst-compliance",
  "/gst-returns",
  "/learn",
  "/api/learn",
];

export { safeNextPath } from "./next-path";

export function isPublicPath(path: string): boolean {
  return path === "/" || PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
}

export function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

export interface BackendSession {
  access_token: string;
  refresh_token: string;
  user: unknown;
}

export function setSessionCookies(res: NextResponse, s: BackendSession) {
  res.cookies.set(ACCESS_COOKIE, s.access_token, cookieOptions(ACCESS_MAX_AGE));
  res.cookies.set(REFRESH_COOKIE, s.refresh_token, cookieOptions(REFRESH_MAX_AGE));
}

export function clearSessionCookies(res: NextResponse) {
  res.cookies.set(ACCESS_COOKIE, "", cookieOptions(0));
  res.cookies.set(REFRESH_COOKIE, "", cookieOptions(0));
}

export function backendUrl(path: string): string {
  return `${(process.env.BACKEND_URL ?? "").replace(/\/+$/, "")}${path}`;
}

/** Proxy target for /api/backend/[...path]; null unless it is a plain /api/v1/ path (no open proxy, no ".." escapes). */
export function proxyTarget(segments: string[], search: string): string | null {
  if (segments.length < 3 || segments[0] !== "api" || segments[1] !== "v1") return null;
  // Auth answers carry raw tokens, which must not reach page scripts; the other two aren't for browsers.
  if (["auth", "internal", "webhooks"].includes(segments[2])) return null;
  if (segments.some((s) => s === "" || s === "." || s === ".." || /[/\\]/.test(s))) return null;
  return backendUrl(`/${segments.map(encodeURIComponent).join("/")}${search}`);
}

const b64url = (s: string) =>
  Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
const utf8 = new TextEncoder();

/** HS256 access-token check; returns the claims, or null if the signature, audience or expiry is wrong. */
export async function verifyAccessToken(
  token: string,
  secret: string,
  nowSeconds = Date.now() / 1000
): Promise<Record<string, unknown> | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const header = JSON.parse(new TextDecoder().decode(b64url(parts[0])));
    if (header.alg !== "HS256") return null;
    const key = await crypto.subtle.importKey(
      "raw",
      utf8.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      b64url(parts[2]),
      utf8.encode(`${parts[0]}.${parts[1]}`)
    );
    if (!valid) return null;
    const claims = JSON.parse(new TextDecoder().decode(b64url(parts[1])));
    if (claims.aud !== "deku" || typeof claims.exp !== "number" || claims.exp <= nowSeconds) return null;
    return claims;
  } catch {
    return null;
  }
}

// Refresh tokens rotate and reuse revokes the whole family, so parallel requests
// carrying the same old token must share one refresh instead of racing.
// shortcut: per-process only, so deploy/gcp runs one frontend instance; move to a shared store to run several.
const refreshes = new Map<string, Promise<RefreshResult>>();

// "rejected" means the token is dead. "unavailable" means we couldn't find out, which must not sign anyone out.
type RefreshResult = BackendSession | "rejected" | "unavailable";

function refreshSession(refreshToken: string): Promise<RefreshResult> {
  let pending = refreshes.get(refreshToken);
  if (!pending) {
    pending = fetch(backendUrl("/api/v1/auth/refresh"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
      cache: "no-store",
    })
      .then((r): RefreshResult | Promise<RefreshResult> => {
        if (r.ok) return r.json() as Promise<BackendSession>;
        return r.status === 401 ? "rejected" : "unavailable";
      })
      .catch((): RefreshResult => "unavailable")
      .then((result) => {
        if (result === "unavailable") refreshes.delete(refreshToken);
        return result;
      });
    refreshes.set(refreshToken, pending);
    setTimeout(() => refreshes.delete(refreshToken), 30_000);
  }
  return pending;
}

/**
 * A write sent by another site's page, which the browser would otherwise send with our cookies.
 * SameSite=Lax doesn't cover sibling subdomains, and login and logout need this too. Scripts and
 * servers send neither header and carry no ambient cookies.
 */
export function isCrossSiteWrite(method: string, headers: Headers): boolean {
  if (["GET", "HEAD", "OPTIONS"].includes(method)) return false;
  const site = headers.get("sec-fetch-site");
  if (site) return site === "cross-site" || site === "same-site";
  const origin = headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host !== (headers.get("x-forwarded-host") ?? headers.get("host"));
  } catch {
    return true;
  }
}

export async function updateSession(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (path.startsWith("/api/") && isCrossSiteWrite(request.method, request.headers)) {
    return NextResponse.json({ error: "cross_site_request" }, { status: 403 });
  }
  // login/signup/logout set their own cookies; a second Set-Cookie from here would race them.
  if (path.startsWith("/api/auth/") && path !== "/api/auth/me") return NextResponse.next();

  const access = request.cookies.get(ACCESS_COOKIE)?.value;
  const secret = process.env.JWT_SECRET;

  if (access && secret && (await verifyAccessToken(access, secret))) {
    return NextResponse.next();
  }

  const refresh = request.cookies.get(REFRESH_COOKIE)?.value;
  if (refresh) {
    const session = await refreshSession(refresh);
    if (session === "unavailable") {
      // The cookies stay, so the session picks up again once the backend is back.
      return path.startsWith("/api/") && !isPublicPath(path)
        ? NextResponse.json({ error: "backend_unavailable" }, { status: 503 })
        : NextResponse.next();
    }
    if (session !== "rejected") {
      // The route handler or page behind this request must already see the new tokens.
      request.cookies.set(ACCESS_COOKIE, session.access_token);
      request.cookies.set(REFRESH_COOKIE, session.refresh_token);
      const res = NextResponse.next({ request });
      setSessionCookies(res, session);
      return res;
    }
  }

  let res: NextResponse;
  if (isPublicPath(path)) {
    res = NextResponse.next();
  } else if (path.startsWith("/api/")) {
    res = NextResponse.json({ error: "unauthorized" }, { status: 401 });
  } else {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(path)}`;
    res = NextResponse.redirect(url);
  }
  if (access || refresh) clearSessionCookies(res);
  return res;
}

/** Calls a backend auth endpoint and turns its JSON into a browser response; tokens never leave the server. */
export async function backendAuth(
  path: string,
  init: RequestInit,
  onSuccess: (data: Record<string, unknown>) => NextResponse
): Promise<NextResponse> {
  let res: Response;
  try {
    res = await fetch(backendUrl(`/api/v1/auth/${path}`), { ...init, cache: "no-store" });
  } catch {
    return NextResponse.json({ error: "backend_unavailable" }, { status: 502 });
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    // Backend error bodies carry only codes such as invalid_credentials or email_taken.
    return NextResponse.json(data && typeof data === "object" ? data : { error: "auth_failed" }, {
      status: res.status,
    });
  }
  return onSuccess(data ?? {});
}

export async function sessionFromBackend(path: "login" | "signup", request: NextRequest) {
  return startSession(path, await request.text());
}

export function startSession(path: "login" | "signup" | "change-password", body: string, bearer?: string) {
  return backendAuth(
    path,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) },
      body,
    },
    (data) => {
      const res = NextResponse.json({ user: data.user });
      setSessionCookies(res, data as unknown as BackendSession);
      return res;
    }
  );
}
