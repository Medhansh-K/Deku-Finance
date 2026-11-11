/**
 * Team and company administration: members and roles (protect_membership_changes, migration 41),
 * invitations (invite_user_to_organisation, migration 16; nothing is ever sent), departments and
 * budgets (migration 13 + Rust routes), tasks, payroll (run_monthly_payroll, migration 58).
 */
import type { Department, DepartmentTask, Invitation } from "@/modules/departments-members/team";
import { ROLES } from "@/modules/departments-members/team";
import { getDemoPlanConfig } from "../demo-plans";
import { getDemoRoleConfig } from "../demo-roles";
import { makeAccount, PAYROLL_ACCOUNTS } from "../sample-data";
import { accountByCode, fail, newId, notInDemo, openPeriodFor, r2 } from "./books";
import { actor, ledgerUpdated, save, withAudit, type Handler, type Req } from "./context";
import { insertDraft, postDraft, submitDraft } from "./journals";
import { assertRole } from "./rbac";

const EMAIL = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const VALID_ROLES = ROLES.map((r) => r.value as string);

export const teamHandler: Handler = (req: Req) => {
  const { sub, method, body, ctx, role } = req;
  let ds = req.ds;
  const me = actor(ds, role);

  // ---- members ----
  if ((sub === "/workbench-members" || sub === "/members") && method === "GET") {
    const masked = getDemoRoleConfig(role).salaryMasked;
    return { success: true, data: ds.members.map((m) => ({ ...m, organisation_id: ds.org.id, salary_masked: masked })) };
  }
  const member = sub.match(/^\/workbench-members\/([^/]+)(\/password-reset)?$/);
  if (member) {
    if (member[2]) notInDemo("Password reset links", "the demo team members are fictional and have no logins");
    const m = ds.members.find((x) => x.id === member[1]) ?? fail("Member not found", 404);
    if (method === "PATCH") {
      assertRole(ctx, "manageMembers", "Changing a member's role");
      const to = String(body.role ?? "");
      if (!VALID_ROLES.includes(to)) fail("Choose one of the seven roles");
      if (m.user_id === me.id && m.role !== to) fail("Permission denied: You cannot modify your own role");
      if (role === "admin" && (m.role === "owner" || to === "owner")) fail("Permission denied: Only owners can modify or grant owner status");
      const updated = { ...m, role: to };
      ds = withAudit({ ...ds, members: ds.members.map((x) => (x.id === m.id ? updated : x)) }, role, "SECURITY", "Member Role Changed", `Changed ${m.profiles?.email} from ${m.role} to ${to}`, "organisation_member", m.id, { from: m.role, to });
      save(req, ds);
      ctx.record("member.role_changed", `${m.profiles?.full_name ?? "Member"}: ${m.role} → ${to}`, { memberId: m.id, from: m.role, to });
      return { success: true, data: [updated] };
    }
    if (method === "DELETE") {
      const self = m.user_id === me.id;
      if (!self) assertRole(ctx, "manageMembers", "Removing a member");
      if (role === "admin" && m.role === "owner") fail("Permission denied: Admins cannot remove an owner");
      if (m.role === "owner" && ds.members.filter((x) => x.role === "owner").length <= 1)
        fail("Permission denied: The sole owner cannot leave the organisation without transferring ownership");
      ds = withAudit({ ...ds, members: ds.members.filter((x) => x.id !== m.id) }, role, "SECURITY", "Member Removed", `Removed ${m.profiles?.email} (${m.role})`, "organisation_member", m.id);
      save(req, ds);
      return { success: true, data: [m] };
    }
  }

  // ---- invitations ----
  if (sub === "/invitations") {
    if (method === "GET") return { success: true, data: [...ds.invitations].sort((a, b) => b.created_at.localeCompare(a.created_at)) };
    if (method === "POST") {
      assertRole(ctx, "invite", "Inviting a team member");
      const email = String(body.email ?? "").trim().toLowerCase();
      const newRole = String(body.role || "viewer");
      if (!VALID_ROLES.includes(newRole)) fail("Choose one of the seven roles");
      if (role !== "owner" && newRole === "owner") fail("Permission Denied: Only the current Owner can invite or assign the Owner role");
      if (!EMAIL.test(email)) fail(`Invalid email address: ${email}`);
      const now = new Date().toISOString();
      const seats = getDemoPlanConfig(req.plan).entitlements.seats;
      const pending = ds.invitations.filter((i) => i.status === "pending" && i.expires_at > now).length;
      if (seats != null && ds.members.length + pending >= seats)
        fail(`plan_limit:seats: ${seats} seats: ${ds.members.length} members and ${pending} pending invites. Upgrade the plan (switch plan in the demo bar) to add more members.`, 402, "plan_limit");
      if (ds.members.some((m) => m.profiles?.email?.toLowerCase() === email)) fail(`User ${email} is already an active member of ${ds.org.name}`);
      const token = `deku-inv-demo-${Math.random().toString(36).slice(2, 14)}`;
      const inv: Invitation = {
        id: newId(ds, "invite"),
        email,
        role: newRole,
        designation: String(body.designation || "Team Member"),
        department_id: body.department_id || null,
        status: "pending",
        expires_at: new Date(Date.now() + 7 * 86_400_000).toISOString(),
        created_at: now,
        token,
      };
      ds = { ...ds, invitations: [inv, ...ds.invitations.map((i) => (i.email.toLowerCase() === email && i.status === "pending" ? { ...i, status: "expired" as const } : i))] };
      ds = withAudit(ds, role, "SECURITY", "Member Invitation Issued", `Invited ${email} to workbench as ${newRole.toUpperCase()} (${inv.designation})`, "invitation", inv.id, { email, role: newRole });
      save(req, ds);
      ctx.notifyAction("Invitation simulated", `Nothing was sent: ${email} is recorded as a pending ${newRole} invitation in this demo company only.`, "info");
      ctx.record("member.invited", `Invited ${email} as ${newRole}`, { invitationId: inv.id, email, role: newRole });
      return {
        success: true,
        simulated: true,
        message: "Simulated invitation: recorded in the demo, no email was sent and the link works nowhere.",
        data: { success: true, simulated: true, invitation_id: inv.id, organisation_id: ds.org.id, organisation_name: ds.org.name, email, role: newRole, designation: inv.designation, token },
      };
    }
  }

  // ---- departments, budgets and tasks ----
  if (sub === "/departments") {
    if (method === "GET") return { success: true, data: ds.departments };
    if (method === "POST") {
      assertRole(ctx, "departments", "Creating a department");
      const name = String(body.name ?? "").trim() || fail("Enter a department name");
      const code = String(body.code ?? "").trim().toUpperCase() || fail("Enter a department code");
      if (ds.departments.some((d) => d.code === code)) fail(`Department code ${code} is already used`);
      const budget = Number(body.budget_allocated ?? 0);
      if (!(budget >= 0)) fail("The budget can't be negative");
      const d: Department = { id: newId(ds, "dept"), name, code, description: body.description ?? null, lead_name: body.lead_name ?? null, budget_allocated: r2(budget), budget_utilized: 0, department_tasks: [] };
      save(req, { ...ds, departments: [...ds.departments, d] });
      ctx.record("department.updated", `Created department ${name}`, { departmentId: d.id, field: "created" });
      return { success: true, data: [d] };
    }
  }
  const dept = sub.match(/^\/departments\/([^/]+)(?:\/tasks(?:\/([^/]+))?)?$/);
  if (dept) {
    const d = ds.departments.find((x) => x.id === dept[1]) ?? fail("Department not found", 404);
    const isTask = sub.includes("/tasks");
    if (!isTask) {
      if (method === "GET") return { success: true, data: [d] };
      if (method === "PATCH") {
        assertRole(ctx, "departments", "Changing a department or its budget");
        const allowed = ["name", "code", "description", "lead_name", "lead_designation", "budget_allocated", "budget_utilized"];
        const fields = Object.keys(body).filter((k) => allowed.includes(k));
        if (!fields.length) fail("Nothing to update");
        for (const k of ["budget_allocated", "budget_utilized"]) if (k in body && !(Number(body[k]) >= 0)) fail(`${k.replace("_", " ")} can't be negative`);
        const code = body.code ? String(body.code).toUpperCase() : d.code;
        if (ds.departments.some((x) => x.id !== d.id && x.code === code)) fail(`Department code ${code} is already used`);
        const upd: Department = { ...d, ...Object.fromEntries(fields.map((k) => [k, k.startsWith("budget") ? r2(Number(body[k])) : body[k]])), code };
        save(req, { ...ds, departments: ds.departments.map((x) => (x.id === d.id ? upd : x)) });
        ctx.record("department.updated", `Updated ${d.name}: ${fields.join(", ")}`, { departmentId: d.id, field: fields.join(",") });
        return { success: true, data: [upd] };
      }
      if (method === "DELETE") {
        assertRole(ctx, "departments", "Deleting a department");
        save(req, { ...ds, departments: ds.departments.filter((x) => x.id !== d.id), employees: ds.employees.map((e) => (e.department_id === d.id ? { ...e, department_id: null } : e)) });
        ctx.record("department.updated", `Deleted department ${d.name}`, { departmentId: d.id, field: "deleted" });
        return { success: true, data: [d] };
      }
    } else {
      assertRole(ctx, "tasks", "Changing department tasks");
      const tasks = d.department_tasks ?? [];
      let next: DepartmentTask[] = tasks;
      let task: DepartmentTask | undefined;
      if (method === "POST" && !dept[2]) {
        task = { id: newId(ds, "task"), title: String(body.title ?? "").trim() || fail("Enter a task title"), task_type: body.task_type ?? "intra", priority: body.priority ?? "medium", status: body.status ?? "todo" } as DepartmentTask;
        next = [...tasks, task];
      } else if (dept[2] && (method === "PATCH" || method === "DELETE")) {
        task = tasks.find((t) => t.id === dept[2]) ?? fail("Task not found", 404);
        next = method === "DELETE" ? tasks.filter((t) => t.id !== task!.id) : tasks.map((t) => (t.id === task!.id ? { ...t, ...body, id: t.id } : t));
      } else return undefined;
      save(req, { ...ds, departments: ds.departments.map((x) => (x.id === d.id ? { ...d, department_tasks: next } : x)) });
      ctx.record("department.updated", `${method === "POST" ? "Added" : method === "PATCH" ? "Updated" : "Removed"} a task in ${d.name}`, { departmentId: d.id, field: "tasks" });
      return { success: true, data: [task] };
    }
  }

  // ---- payroll ----
  if (sub === "/payroll/runs" && method === "GET") {
    const masked = getDemoRoleConfig(role).salaryMasked;
    return { success: true, data: [...ds.payrollRuns].sort((a, b) => b.executed_at.localeCompare(a.executed_at)).map((r) => (masked ? { ...r, masked_individual_salaries: true } : r)) };
  }
  if (sub === "/payroll/run" && method === "POST") {
    assertRole(ctx, "payroll", "Running payroll");
    const period = String(body.period ?? "");
    if (!/^[0-9]{4}-(0[1-9]|1[0-2])$/.test(period)) fail("the period must look like 2026-11", 409);
    const today = new Date().toISOString().slice(0, 10);
    const monthStart = `${period}-01`;
    if (monthStart > today) fail("that month hasn't started yet", 409);
    const monthEnd = new Date(Date.UTC(Number(period.slice(0, 4)), Number(period.slice(5, 7)), 0)).toISOString().slice(0, 10);
    const entryDate = monthEnd < today ? monthEnd : today;
    const prev = ds.payrollRuns.find((r) => r.period === period);
    const prevJe = prev?.journal_entry_id ? ds.journals.find((j) => j.id === prev.journal_entry_id) : undefined;
    if (prevJe && prevJe.status !== "reversed" && !prevJe.rejected_at)
      fail(`payroll for ${period} is already in the ledger as ${prevJe.entry_number}. Reverse that voucher to run it again`, 409);
    const active = ds.employees.filter((e) => e.status === "active");
    if (!active.length) return { success: true, data: { success: false, message: "No active employees found in organisation" } };
    const sum = (k: "monthly_gross" | "monthly_net" | "tds_deduction_monthly" | "epf_monthly") => r2(active.reduce((s, e) => s + e[k], 0));
    const [gross, net, tds, epf] = [sum("monthly_gross"), sum("monthly_net"), sum("tds_deduction_monthly"), sum("epf_monthly")];
    if (gross !== r2(net + tds + epf)) fail(`gross pay of ${gross} doesn't equal net pay, TDS and EPF of ${r2(net + tds + epf)}. Correct the salary details first`, 409);
    let journal = null;
    if (gross > 0) {
      if (!openPeriodFor(ds, entryDate)) fail(`no open fiscal period covers ${entryDate}. Add or reopen one in Settings`, 409);
      const expense = accountByCode(ds, "5020") ?? fail("the salaries expense account 5020 is missing from the chart of accounts", 409);
      for (const [code, name, ledger, subl, label] of PAYROLL_ACCOUNTS)
        if (!accountByCode(ds, code)) ds = { ...ds, accounts: [...ds.accounts, makeAccount(ds.org.id, code, name, "liability", "liability", ledger, subl, label)] };
      const attempt = ds.journals.filter((j) => j.entry_number.startsWith(`PAYROLL-${period}`)).length + 1;
      const lines = [
        { account_id: expense.id, party_id: null, description: `Gross salaries ${period}`, debit: gross, credit: 0 },
        ...([["2091", net, "Net salaries"], ["2092", tds, "TDS"], ["2093", epf, "EPF"]] as const)
          .filter(([, v]) => v > 0)
          .map(([code, v, what]) => ({ account_id: accountByCode(ds, code)!.id, party_id: null, description: `${what} ${period}`, debit: 0, credit: v })),
      ];
      const draft = insertDraft(ds, role, { entry_number: `PAYROLL-${period}${attempt > 1 ? `-${attempt}` : ""}`, entry_date: entryDate, narration: `Payroll for ${period}` }, lines);
      const r = ds.org.require_journal_approval ? submitDraft(draft.ds, role, draft.entry.id) : postDraft(draft.ds, role, draft.entry.id, true);
      ds = r.ds;
      journal = r.entry;
    }
    const runId = prev?.id ?? newId(ds, "pr");
    const run = { id: runId, period, total_gross: gross, total_net_disbursed: net, total_tds: tds, total_epf: epf, headcount: active.length, executed_at: new Date().toISOString(), status: "processed", journal_entry_id: journal?.id ?? null };
    ds = { ...ds, payrollRuns: [run, ...ds.payrollRuns.filter((x) => x.period !== period)] };
    save(req, ds);
    ctx.record("payroll.run", `Ran payroll for ${period}`, { runId, journalId: journal?.id ?? "" });
    ledgerUpdated({ payrollRunId: runId, act: "payroll" });
    return {
      success: true,
      data: {
        success: true,
        payroll_run_id: runId,
        period,
        headcount: active.length,
        total_gross: gross,
        total_net_disbursed: net,
        total_tds: tds,
        total_epf: epf,
        journal_entry_id: journal?.id ?? null,
        entry_number: journal?.entry_number ?? null,
        journal_status: journal?.status ?? null,
        submitted_for_approval: !!journal?.submitted_at,
      },
    };
  }
  if (sub.startsWith("/members/") && method !== "GET") notInDemo("Employee records, compensation, bonuses and reimbursements", "no screen in the demo edits them");
  return undefined;
};
