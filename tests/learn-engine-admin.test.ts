import { describe, expect, it } from "vitest";
import { ApiError } from "@/api/errors";
import { canDemoRolePerform } from "@/lib/learn/demo-roles";
import { SQL_ROLES } from "@/lib/learn/engine/rbac";
import { DEMO_ROLES } from "@/lib/learn/demo-roles";
import { demo } from "./fixtures/learn-engine-ctx";

async function refused(promise: Promise<unknown>, status: number, message?: RegExp) {
  const err = await promise.then(() => null, (e) => e);
  expect(err, "expected the engine to refuse").toBeInstanceOf(ApiError);
  expect((err as ApiError).status).toBe(status);
  if (message) expect((err as ApiError).message).toMatch(message);
}

describe("team", () => {
  it("an invitation is recorded (never sent), respects seats and the owner-only rule", async () => {
    const d = demo("aster-trading", "admin", "enterprise");
    const res = await d.post("/invitations", { email: "new.hire@aster-trading.example", role: "accountant", designation: "Junior accountant" });
    expect(res).toMatchObject({ success: true, simulated: true, data: { email: "new.hire@aster-trading.example", role: "accountant" } });
    expect(d.ds.invitations[0]).toMatchObject({ status: "pending", role: "accountant" });
    expect(d.last()).toMatchObject({ type: "member.invited", refs: { email: "new.hire@aster-trading.example", role: "accountant" } });
    expect(d.state.notices).toContain("Invitation simulated");
    await refused(d.post("/invitations", { email: "boss@x.example", role: "owner" }), 400, /Only the current Owner/);
    await refused(d.post("/invitations", { email: "not-an-email", role: "viewer" }), 400, /Invalid email/);
    await refused(d.post("/invitations", { email: "owner@aster-trading.example", role: "viewer" }), 400, /already an active member/);
    await refused(d.as("accountant").post("/invitations", { email: "a@b.example", role: "viewer" }), 403);
    // PRO allows 5 seats; the seven-person demo team is already past it.
    d.state.plan = "pro";
    await refused(d.as("owner").post("/invitations", { email: "x@y.example", role: "viewer" }), 402, /plan_limit:seats/);
  });

  it("role changes follow protect_membership_changes", async () => {
    const d = demo("aster-trading", "owner");
    const analyst = d.ds.members.find((m) => m.role === "analyst")!;
    await d.patch(`/workbench-members/${analyst.id}`, { role: "accountant" });
    expect(d.ds.members.find((m) => m.id === analyst.id)!.role).toBe("accountant");
    expect(d.last()).toMatchObject({ type: "member.role_changed", refs: { memberId: analyst.id, from: "analyst", to: "accountant" } });
    const owner = d.ds.members.find((m) => m.role === "owner")!;
    await refused(d.patch(`/workbench-members/${owner.id}`, { role: "admin" }), 400, /own role/);
    await refused(d.as("admin").patch(`/workbench-members/${owner.id}`, { role: "cfo" }), 400, /Only owners/);
    await refused(d.as("admin").patch(`/workbench-members/${analyst.id}`, { role: "owner" }), 400, /Only owners/);
    await refused(d.as("cfo").patch(`/workbench-members/${analyst.id}`, { role: "viewer" }), 403);
  });
});

describe("departments and budgets", () => {
  it("owner/admin edit budgets; the variance report follows; CFO is refused like the RLS policy", async () => {
    const d = demo("northstar-consulting", "owner");
    const dept = d.ds.departments[0];
    await d.patch(`/departments/${dept.id}`, { budget_allocated: 1500000 });
    expect(d.last()).toMatchObject({ type: "department.updated", refs: { departmentId: dept.id, field: "budget_allocated" } });
    const v = (await d.get("/reports/budget-variance")).data;
    expect(v.departments[0]).toMatchObject({ budget_allocated: 1500000, budget_remaining: 1500000 - 680000 });
    expect(v.total_budget_allocated).toBe(d.ds.departments.reduce((s, x) => s + Number(x.budget_allocated), 0));
    await refused(d.as("cfo").patch(`/departments/${dept.id}`, { budget_allocated: 1 }), 403);
    await refused(d.as("owner").patch(`/departments/${dept.id}`, { budget_allocated: -5 }), 400);
    const created = await d.post("/departments", { name: "Research", code: "rnd", budget_allocated: 250000 });
    expect(created.data[0]).toMatchObject({ code: "RND", budget_allocated: 250000 });
    expect(d.last()).toMatchObject({ type: "department.updated", refs: { field: "created" } });
  });
});

describe("payroll", () => {
  it("posts the run's journal for approval from the employees' pay", async () => {
    const d = demo("northstar-consulting", "cfo");
    const res = await d.post("/payroll/run", { period: "2026-11" });
    expect(res.data).toMatchObject({ success: true, headcount: 6, total_gross: 620000, total_net_disbursed: 557200, submitted_for_approval: true });
    const je = d.ds.journals.find((j) => j.id === res.data.journal_entry_id)!;
    expect(je).toMatchObject({ entry_number: "PAYROLL-2026-11", status: "draft" });
    expect(je.journal_entry_lines.map((l) => [l.debit, l.credit])).toEqual([[620000, 0], [0, 557200], [0, 52000], [0, 10800]]);
    expect(d.last()).toMatchObject({ type: "payroll.run", refs: { journalId: je.id } });
    await refused(d.post("/payroll/run", { period: "2026-10" }), 409, /already in the ledger/);
    await refused(d.as("accountant").post("/payroll/run", { period: "2026-11" }), 403);
  });
});

describe("roles and refusals", () => {
  it("read-only roles can't write anything", async () => {
    for (const role of ["viewer", "auditor", "analyst"] as const) {
      const d = demo("aster-trading", role);
      await refused(d.post("/parties", { legal_name: "X Traders", type: "customer" }), 403);
      await refused(d.post("/journals", { entry_number: "JRN-2026-0099", entry_date: "2026-11-10", lines: [] }), 403);
      await refused(d.patch("/settings", { require_journal_approval: false }), 403);
      expect(d.ds.activity).toEqual([]);
    }
  });

  it("an unhandled write is an error, never a silent success", async () => {
    const d = demo("aster-trading", "owner");
    await refused(d.post("/imports", { kind: "parties" }), 501, /isn't available in the demo/);
    await refused(d.post("/something-new", {}), 501, /isn't available in the demo/);
    await refused(d.post("/workbench-members/x/password-reset"), 501, /isn't available in the demo/);
    expect((await d.get("/something-new")).data).toEqual([]);
  });

  it("external actions are simulated and labelled, never live", async () => {
    const d = demo("aster-trading", "owner");
    const inv = d.ds.invoices[0];
    await refused(d.post(`/gsp/invoices/${inv.id}/irn`), 501, /simulated in the demo: nothing was sent/);
    await refused(d.post(`/invoices/${inv.id}/payment-link`), 501, /simulated/);
    expect((await d.get("/gsp/status")).data).toMatchObject({ configured: false });
    expect((await d.get("/payments/status")).simulated).toBe(true);
    const filed = await d.post("/gst/102026/gstr1/record");
    expect(filed.simulated).toBe(true);
  });

  it("the demo role table is never looser than the database", () => {
    const map: Record<string, keyof typeof SQL_ROLES> = { create_draft: "createDraft", approve_voucher: "approveVoucher", post_voucher: "approveVoucher", reverse_voucher: "reverseVoucher", issue_invoice: "issueInvoice", reconcile_bank: "reconcileBank", invite_members: "invite", manage_members: "manageMembers", manage_departments: "departments", run_payroll: "payroll", edit_settings: "settings" };
    for (const r of DEMO_ROLES)
      for (const [action, sql] of Object.entries(map))
        if (canDemoRolePerform(r.role, action as never).allowed) expect(SQL_ROLES[sql] as readonly string[], `${r.role} ${action}`).toContain(r.role);
  });
});

describe("settings, masters, consultant", () => {
  it("settings accept only valid known fields", async () => {
    const d = demo("aster-trading", "admin");
    await d.patch("/settings", { require_journal_approval: false, bank_ifsc: "demo0000999" });
    expect(d.ds.org).toMatchObject({ require_journal_approval: false, bank_ifsc: "DEMO0000999" });
    expect(d.last()).toMatchObject({ type: "settings.updated", refs: { fields: "bank_ifsc,require_journal_approval" } });
    await refused(d.patch("/settings", { bank_ifsc: "nope" }), 400, /bank_ifsc/);
    await refused(d.patch("/settings", { name: "Hacked" }), 400, /Nothing to update/);
  });

  it("masters are created and recorded", async () => {
    const d = demo("aster-trading", "accountant");
    await d.post("/parties", { legal_name: "Godavari Electricals", type: "customer", gstin: "27AABCG1234H1Z5" });
    expect(d.last()).toMatchObject({ type: "party.created", refs: { name: "Godavari Electricals", kind: "customer" } });
    await d.post("/catalogue", { name: "Busbar 200A", type: "goods", track_inventory: true, default_unit_price: 4000, default_gst_rate: 18 });
    expect(d.last()?.type).toBe("item.created");
    await d.post("/accounts", { code: "5050", name: "Freight Inward", account_group: "expense" });
    expect(d.last()).toMatchObject({ type: "account.created", refs: { code: "5050" } });
    await refused(d.post("/accounts", { code: "5050", name: "Dup", account_group: "expense" }), 400, /already used/);
    await refused(d.as("owner").del(`/accounts/${d.acc("1020")}`), 400, /System accounts/);
  });

  it("the consultant answers from the books and says no AI model was called", async () => {
    const d = demo("aster-trading", "analyst");
    const res = await d.post("/consultant/chat", { message: "Who owes us money?" });
    expect(res.response).toContain("Kaveri Infra");
    expect(res.response).toContain("4,72,000");
    expect(res.model_used).toMatch(/no AI model/);
    expect(d.last()).toMatchObject({ type: "consultant.asked", refs: { question: "Who owes us money?" } });
  });
});
