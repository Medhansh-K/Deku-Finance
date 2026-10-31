import { describe, expect, it } from "vitest";
import {
  ROLES,
  assignableRoles,
  canInvite,
  canManageMembers,
  canRunPayroll,
  inviteStatus,
  memberName,
  seatUsage,
  type Invitation,
  type OrgMember,
} from "@/modules/departments-members/team";

const member = (profiles: OrgMember["profiles"]): OrgMember => ({ id: "m", user_id: "u", role: "viewer", created_at: "", profiles });
const invite = (status: Invitation["status"], expires_at: string): Invitation => ({
  id: "i", email: "a@b.in", role: "viewer", designation: "", department_id: null, status, expires_at, created_at: "",
});

describe("team logic", () => {
  it("has the seven roles of migration 016", () => {
    expect(ROLES.map((r) => r.value)).toEqual(["owner", "cfo", "admin", "accountant", "analyst", "auditor", "viewer"]);
  });

  it("gates actions like the database does", () => {
    for (const r of ["owner", "cfo", "admin"]) {
      expect(canRunPayroll(r)).toBe(true);
      expect(canInvite(r)).toBe(true);
    }
    for (const r of ["accountant", "analyst", "auditor", "viewer", null]) {
      expect(canRunPayroll(r)).toBe(false);
      expect(canInvite(r)).toBe(false);
    }
    expect(canManageMembers("cfo")).toBe(false);
    expect(canManageMembers("admin")).toBe(true);
  });

  it("lets only an owner grant the owner role", () => {
    expect(assignableRoles("owner")).toContain("owner");
    expect(assignableRoles("admin")).not.toContain("owner");
    expect(assignableRoles("cfo")).toHaveLength(6);
  });

  it("names members from their profile, never with a made-up name", () => {
    expect(memberName(member({ id: "u", email: "x@y.in", full_name: " Asha ", avatar_url: null }))).toBe("Asha");
    expect(memberName(member({ id: "u", email: "x@y.in", full_name: "", avatar_url: null }))).toBe("x@y.in");
    expect(memberName(member(null))).toBe("–");
  });

  it("shows a lapsed pending invitation as expired", () => {
    const now = Date.parse("2026-10-31T00:00:00Z");
    expect(inviteStatus(invite("pending", "2026-11-05T00:00:00Z"), now)).toBe("pending");
    expect(inviteStatus(invite("pending", "2026-10-30T00:00:00Z"), now)).toBe("expired");
    expect(inviteStatus(invite("accepted", "2026-10-30T00:00:00Z"), now)).toBe("accepted");
  });

  it("counts members plus pending invitations against the seat limit", () => {
    expect(seatUsage({ seats: 2 }, 1, 1)).toEqual({ used: 2, limit: 2, reached: true });
    expect(seatUsage({ seats: 3 }, 1, 1)).toEqual({ used: 2, limit: 3, reached: false });
    expect(seatUsage({ seats: null }, 9, 9).reached).toBe(false);
    expect(seatUsage(null, 9, 9)).toEqual({ used: 18, limit: null, reached: false });
  });
});
