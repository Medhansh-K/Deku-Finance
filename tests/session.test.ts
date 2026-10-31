// @vitest-environment node
import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cookieOptions, proxyTarget, verifyAccessToken } from "@/lib/auth/session";

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
