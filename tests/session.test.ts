// @vitest-environment node
import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { cookieOptions, isCrossSiteWrite, proxyTarget, updateSession, verifyAccessToken } from "@/lib/auth/session";

const SECRET = "dev-secret-at-least-32-bytes-long-xx";
const b64 = (v: object | Buffer) =>
  (Buffer.isBuffer(v) ? v : Buffer.from(JSON.stringify(v))).toString("base64url");

function sign(claims: object, secret = SECRET, header: object = { alg: "HS256", typ: "JWT" }) {
  const body = `${b64(header)}.${b64(claims)}`;
  return `${body}.${b64(createHmac("sha256", secret).update(body).digest())}`;
}

const now = Math.floor(Date.now() / 1000);
const claims = { sub: "u1", role: "authenticated", email: "a@b.c", aud: "deku", iat: now, exp: now + 3600 };

describe("verifyAccessToken", () => {
  it("accepts a valid token and returns its claims", async () => {
    expect(await verifyAccessToken(sign(claims), SECRET)).toMatchObject({ sub: "u1", aud: "deku" });
  });

  it("rejects a bad signature, wrong audience, expiry, alg none and garbage", async () => {
    expect(await verifyAccessToken(sign(claims, "another-secret-another-secret-xx"), SECRET)).toBeNull();
    expect(await verifyAccessToken(sign({ ...claims, aud: "other" }), SECRET)).toBeNull();
    expect(await verifyAccessToken(sign({ ...claims, exp: now - 1 }), SECRET)).toBeNull();
    expect(await verifyAccessToken(sign(claims, SECRET, { alg: "none" }), SECRET)).toBeNull();
    expect(await verifyAccessToken("not.a.jwt", SECRET)).toBeNull();
  });
});

describe("proxyTarget", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("forwards only /api/v1/ paths to the backend, with the query string", () => {
    vi.stubEnv("BACKEND_URL", "http://backend:8080/");
    expect(proxyTarget(["api", "v1", "organisations", "o 1"], "?a=1")).toBe(
      "http://backend:8080/api/v1/organisations/o%201?a=1"
    );
    expect(proxyTarget(["health"], "")).toBeNull();
    expect(proxyTarget(["api", "v1"], "")).toBeNull();
    expect(proxyTarget(["api", "v2", "x"], "")).toBeNull();
    expect(proxyTarget(["api", "v1", "..", "..", "admin"], "")).toBeNull();
    expect(proxyTarget(["api", "v1", "a/../../admin"], "")).toBeNull();
  });
});

describe("cookieOptions", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("is httpOnly and Lax, Secure only in production", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(cookieOptions(3600)).toEqual({ httpOnly: true, sameSite: "lax", secure: false, path: "/", maxAge: 3600 });
    vi.stubEnv("NODE_ENV", "production");
    expect(cookieOptions(3600).secure).toBe(true);
  });
});

describe("proxy limits", () => {
  it("doesn't forward auth, internal or webhook routes", () => {
    expect(proxyTarget(["api", "v1", "auth", "login"], "")).toBeNull();
    expect(proxyTarget(["api", "v1", "internal", "notifications", "generate"], "")).toBeNull();
    expect(proxyTarget(["api", "v1", "webhooks", "razorpay"], "")).toBeNull();
    expect(proxyTarget(["api", "v1", "payments", "razorpay", "callback"], "")).not.toBeNull();
  });
});

describe("isCrossSiteWrite", () => {
  const h = (o: Record<string, string>) => new Headers(o);
  it("refuses writes from other sites and sibling subdomains", () => {
    expect(isCrossSiteWrite("POST", h({ "sec-fetch-site": "cross-site" }))).toBe(true);
    expect(isCrossSiteWrite("DELETE", h({ "sec-fetch-site": "same-site" }))).toBe(true);
    expect(isCrossSiteWrite("POST", h({ origin: "https://evil.example", host: "app.example" }))).toBe(true);
    expect(isCrossSiteWrite("POST", h({ origin: "not a url", host: "app.example" }))).toBe(true);
  });
  it("allows the app itself, reads, and non-browser callers", () => {
    expect(isCrossSiteWrite("POST", h({ "sec-fetch-site": "same-origin" }))).toBe(false);
    expect(isCrossSiteWrite("POST", h({ origin: "https://app.example", host: "app.example" }))).toBe(false);
    expect(isCrossSiteWrite("POST", h({ origin: "https://app.example", "x-forwarded-host": "app.example", host: "internal" }))).toBe(false);
    expect(isCrossSiteWrite("GET", h({ "sec-fetch-site": "cross-site" }))).toBe(false);
    expect(isCrossSiteWrite("POST", h({}))).toBe(false);
  });
});

describe("updateSession refresh failures", () => {
  const request = (refresh: string) =>
    new NextRequest("http://app.example/gateway", { headers: { cookie: `deku_rt=${refresh}` } });
  afterEach(() => vi.unstubAllGlobals());

  it("keeps the session when the backend is briefly down", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("down", { status: 503 })));
    const res = await updateSession(request("outage-token"));
    expect(res.headers.get("set-cookie") ?? "").not.toContain("deku_rt=;");
    expect(res.status).not.toBe(307);
  });
  it("signs out when the token is really dead", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("no", { status: 401 })));
    const res = await updateSession(request("dead-token"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });
});
