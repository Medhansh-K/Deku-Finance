import { describe, expect, it } from "vitest";
import { friendlyError } from "@/lib/errors/friendly";

describe("friendlyError", () => {
  it("states the seat limit from the plan", () => {
    const msg = friendlyError({ success: false, error: "plan_limit", limit: "seats", status: 402 }, 402, { seats: 2 });
    expect(msg).toMatch(/^Your plan allows 2 seats\./);
    expect(msg).not.toContain("plan_limit");
  });

  it("still reads when the limit value is unknown", () => {
    expect(friendlyError({ error: "plan_limit", limit: "seats" }, 402)).toMatch(/seats are all in use/);
    expect(friendlyError({ error: "plan_limit", limit: "max_monthly_invoices" }, 402, { max_monthly_invoices: 150 })).toMatch(
      /150 invoices a month/
    );
  });

  it("finds codes inside raw database text", () => {
    const raw = `PostgREST RPC 'x' error (400 Bad Request): {"code":"P0001","message":"plan_limit:seats"}`;
    expect(friendlyError({ error: raw }, 502, { seats: 5 })).toMatch(/^Your plan allows 5 seats\./);
    expect(friendlyError({ error: "stock_insufficient", item: "SKU-9" }, 409)).toBe("Not enough stock of SKU-9.");
    expect(friendlyError(`{"message":"stock_insufficient:AB-1"}`, 502)).toBe("Not enough stock of AB-1.");
  });

  it("explains permission errors without the raw prefix", () => {
    expect(friendlyError({ error: "Permission denied: only the owner, CFO or admin can run payroll" }, 403)).toBe(
      "You don't have permission: only the owner, CFO or admin can run payroll"
    );
    expect(friendlyError({ error: "PostgREST insert into 'x' not permitted: {}" }, 403)).toBe(
      "You don't have permission to do this."
    );
  });

  it("leaves other errors to the server's message", () => {
    expect(friendlyError({ error: "Department code already exists" }, 400)).toBeNull();
    expect(friendlyError(null, 500)).toBeNull();
  });
});
