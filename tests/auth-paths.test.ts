import { describe, it, expect } from "vitest";
import { isPublicPath, safeNextPath } from "@/lib/auth/session";

describe("isPublicPath", () => {
  it("lets anyone see landing and auth pages but guards the app", () => {
    expect(["/", "/login", "/signup", "/join", "/api/auth/login"].every(isPublicPath)).toBe(true);
    expect(["/gateway", "/vouchers/sales", "/reports/balance-sheet", "/loginx", "/api/backend/api/v1/organisations", "/api/authx"].some(isPublicPath)).toBe(false);
  });
});

describe("safeNextPath", () => {
  it("keeps same-site paths and rejects off-site redirects", () => {
    expect(safeNextPath("/reports/trial-balance")).toBe("/reports/trial-balance");
    expect(safeNextPath("//evil.com")).toBe("/gateway");
    expect(safeNextPath("/\\evil.com")).toBe("/gateway");
    expect(safeNextPath("https://evil.com")).toBe("/gateway");
    expect(safeNextPath(null)).toBe("/gateway");
  });
});
