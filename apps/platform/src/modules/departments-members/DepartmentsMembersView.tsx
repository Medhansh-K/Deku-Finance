"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Building2, Check, Copy, CreditCard, Mail, Users } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/context/AuthContext";
import { departmentsApi, organisationsApi, payrollApi } from "@/api/endpoints";
import { ApiError } from "@/api/errors";
import { friendlyError } from "@/lib/errors/friendly";
import { formatINR } from "@/lib/formatters/currency";
import { formatDateTally } from "@/lib/formatters/date";
import {
  ROLES,
  assignableRoles,
  canInvite,
  canManageDepartments,
  canManageMembers,
  canRunPayroll,
  inviteStatus,
  memberName,
  roleLabel,
  seatUsage,
  type Department,
  type Invitation,
  type OrgMember,
  type PayrollResult,
  type PayrollRun,
} from "./team";

type Tab = "members" | "invitations" | "departments" | "payroll";
type Message = { ok: boolean; text: string } | null;

const TABS: { id: Tab; label: string; icon: typeof Users }[] = [
  { id: "members", label: "Members & roles", icon: Users },
  { id: "invitations", label: "Invitations", icon: Mail },
  { id: "departments", label: "Departments", icon: Building2 },
  { id: "payroll", label: "Payroll", icon: CreditCard },
];

const INVITE_BADGE = { pending: "warning", accepted: "success", expired: "default", revoked: "default" } as const;

const selectClass = "h-9 rounded-ctl border border-line-strong bg-surface px-2.5 text-[13.5px] text-ink focus:border-brand focus:outline-none";
const date = (iso: string | null | undefined) => (iso ? formatDateTally(iso.slice(0, 10)) : "–");

export function DepartmentsMembersView() {
  const { user, organisation, subscription, entitlements, refreshSubscription } = useAuth();
  const orgId = organisation?.id;

  const [tab, setTab] = useState<Tab>("members");
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [invites, setInvites] = useState<Invitation[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message>(null);

  const [invite, setInvite] = useState({ email: "", role: "viewer", designation: "", department_id: "" });
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [resetLink, setResetLink] = useState<{ name: string; url: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [dept, setDept] = useState({ name: "", code: "", description: "", budget: "" });
  const [period, setPeriod] = useState(() => (subscription?.server_time ?? new Date().toISOString()).slice(0, 7));
  const [payrollResult, setPayrollResult] = useState<PayrollResult | null>(null);

  const errorText = useCallback(
    (e: unknown) =>
      e instanceof ApiError ? friendlyError(e.details, e.status, entitlements) ?? e.message : (e as Error).message,
    [entitlements]
  );

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    const failures: string[] = [];
    const get = <T,>(p: Promise<{ data: T }>, set: (v: T) => void) =>
      p.then((r) => set(r.data)).catch((e) => failures.push(errorText(e)));
    await Promise.all([
      get(organisationsApi.listMembers(orgId), setMembers),
      get(organisationsApi.listInvitations(orgId), setInvites),
      get(departmentsApi.list(orgId), setDepartments),
      get(payrollApi.listRuns(orgId), setRuns),
    ]);
    if (failures.length) setMessage({ ok: false, text: failures[0] });
    setLoading(false);
  }, [orgId, errorText]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true);
    setMessage(null);
    try {
      await fn();
      if (ok) setMessage({ ok: true, text: ok });
      await load();
    } catch (e) {
      setMessage({ ok: false, text: errorText(e) });
    } finally {
      setBusy(false);
    }
  };

  if (!orgId) return <p className="p-6 text-[13.5px] text-ink-muted">Select a company to see its team.</p>;

  const myRole = members.find((m) => m.user_id === user?.id)?.role ?? null;
  const nowMs = Date.parse(subscription?.server_time ?? "") || Date.now();
  const pending = invites.filter((i) => inviteStatus(i, nowMs) === "pending");
  const seats = seatUsage(entitlements, members.length, pending.length);
  const seatsFullText = seats.limit !== null ? friendlyError({ error: "plan_limit", limit: "seats" }, 402, entitlements) : null;

  const copy = (text: string) => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(text);
      setTimeout(() => setCopied(null), 1500);
    });
  };
  const joinUrl = (token: string) => `${window.location.origin}/join?token=${token}`;

  const sendInvite = (e: React.FormEvent) => {
    e.preventDefault();
    setInviteLink(null);
    act(async () => {
      const res = await organisationsApi.inviteMember(orgId, {
        email: invite.email.trim(),
        role: invite.role,
        designation: invite.designation.trim() || undefined,
        department_id: invite.department_id || undefined,
      });
      if (res.data?.token) setInviteLink(joinUrl(res.data.token));
      setInvite({ email: "", role: "viewer", designation: "", department_id: "" });
      await refreshSubscription();
    }, "Invitation created. Share the link below; it expires in 7 days.");
  };

  const createDepartment = (e: React.FormEvent) => {
    e.preventDefault();
    act(async () => {
      await departmentsApi.create(orgId, {
        name: dept.name.trim(),
        code: dept.code.trim(),
        description: dept.description.trim() || undefined,
        budget_allocated: dept.budget ? Number(dept.budget) : undefined,
      });
      setDept({ name: "", code: "", description: "", budget: "" });
    }, "Department created.");
  };

  const runPayroll = () => {
    if (!confirm(`Run payroll for ${period}? Every active employee is marked processed for this period.`)) return;
    setPayrollResult(null);
    act(async () => {
      const res = await payrollApi.run(orgId, { period });
      setPayrollResult(res.data as PayrollResult);
    });
  };

  return (
    <div className="space-y-4 font-sans text-[13.5px]">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Members" value={String(members.length)} />
        <Stat label="Pending invitations" value={String(pending.length)} />
        <Stat label="Seats used" value={seats.limit === null ? `${seats.used} (unlimited)` : `${seats.used} of ${seats.limit}`} />
        <Stat label="Departments" value={String(departments.length)} />
      </div>

      <div data-tour="members-tabs" role="tablist" className="inline-flex flex-wrap gap-0.5 rounded-ctl bg-canvas-sunken p-0.5">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`h-8 px-3 font-medium rounded-[7px] flex items-center gap-1.5 transition-colors ${
              tab === id ? "bg-surface text-ink shadow-[0_0_0_1px_var(--color-line)]" : "text-ink-muted hover:text-ink"
            }`}
          >
            <Icon className={`h-4 w-4 ${tab === id ? "text-brand-strong" : ""}`} aria-hidden /> {label}
          </button>
        ))}
      </div>

      {message && (
        <p role={message.ok ? "status" : "alert"} className={message.ok ? "text-ok" : "text-bad"}>
          {message.text}
        </p>
      )}
      {loading && <p className="text-ink-muted">Loading…</p>}

      {tab === "members" && (
        <Panel title={`Members of ${organisation.name}`}>
          {resetLink && (
            <div className="space-y-1">
              <p className="text-ink-soft">Send this link to {resetLink.name}. Anyone who has it can set their password.</p>
              <CopyRow text={resetLink.url} copied={copied === resetLink.url} onCopy={copy} />
            </div>
          )}

          <div className="overflow-x-auto rounded-ctl border border-line">
          <table className="w-full text-left">
            <thead>
              <tr>
                <th className="deku-table-th">Name</th>
                <th className="deku-table-th">Email</th>
                <th className="deku-table-th">Role</th>
                <th className="deku-table-th">Joined</th>
                <th className="deku-table-th" />
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const editable =
                  canManageMembers(myRole) && m.user_id !== user?.id && (m.role !== "owner" || myRole === "owner");
                return (
                  <tr key={m.id} className="hover:bg-canvas">
                    <td className="deku-table-td font-[550]">{memberName(m)}</td>
                    <td className="deku-table-td !text-ink-soft">{m.profiles?.email ?? "–"}</td>
                    <td className="deku-table-td">
                      {editable ? (
                        <select
                          aria-label={`Role of ${memberName(m)}`}
                          className={selectClass}
                          value={m.role}
                          disabled={busy}
                          onChange={(e) =>
                            act(() => organisationsApi.updateMemberRole(orgId, m.id, e.target.value), "Role updated.")
                          }
                        >
                          {assignableRoles(myRole).map((r) => (
                            <option key={r} value={r}>
                              {roleLabel(r)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <Badge variant={m.role === "owner" ? "teal" : "default"}>{roleLabel(m.role)}</Badge>
                      )}
                    </td>
                    <td className="deku-table-td !text-ink-soft">{date(m.created_at)}</td>
                    <td className="deku-table-td text-right">
                      {editable && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busy}
                          onClick={() =>
                            act(async () => {
                              const res = await organisationsApi.createPasswordReset(orgId, m.id);
                              setResetLink({
                                name: memberName(m),
                                url: `${window.location.origin}/reset-password?token=${res.data?.token}`,
                              });
                            }, "Reset link created. It works once, for 24 hours.")
                          }
                        >
                          Reset password
                        </Button>
                      )}
                      {editable && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busy}
                          onClick={() =>
                            confirm(`Remove ${memberName(m)} from ${organisation.name}?`) &&
                            act(() => organisationsApi.removeMember(orgId, m.id), "Member removed.")
                          }
                        >
                          Remove
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
          <dl data-tour="members-roles" className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 pt-3 text-[13px] text-ink-muted">
            {ROLES.map((r) => (
              <div key={r.value}>
                <dt className="inline font-medium text-ink-soft">{r.label}:</dt> <dd className="inline">{r.duty}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      )}

      {tab === "invitations" && (
        <Panel title="Invitations">
          {canInvite(myRole) ? (
            <form data-tour="members-invite-form" onSubmit={sendInvite} className="grid sm:grid-cols-5 gap-2 items-end">
              <Input label="Email" type="email" required value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} />
              <label className="space-y-1">
                <span className="block text-[13px] text-ink-muted">Role</span>
                <select className={`${selectClass} w-full`} value={invite.role} onChange={(e) => setInvite({ ...invite, role: e.target.value })}>
                  {assignableRoles(myRole).map((r) => (
                    <option key={r} value={r}>
                      {roleLabel(r)}
                    </option>
                  ))}
                </select>
              </label>
              <Input label="Designation" value={invite.designation} onChange={(e) => setInvite({ ...invite, designation: e.target.value })} />
              <label className="space-y-1">
                <span className="block text-[13px] text-ink-muted">Department</span>
                <select className={`${selectClass} w-full`} value={invite.department_id} onChange={(e) => setInvite({ ...invite, department_id: e.target.value })}>
                  <option value="">None</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </label>
              <Button type="submit" variant="tally" size="sm" isLoading={busy} disabled={seats.reached}>
                Send invitation
              </Button>
            </form>
          ) : (
            <p className="text-ink-muted">Only the owner, CFO or an admin can invite people.</p>
          )}
          {seats.reached && <p role="alert" className="text-bad">{seatsFullText}</p>}
          {inviteLink && <CopyRow text={inviteLink} copied={copied === inviteLink} onCopy={copy} />}

          <div className="overflow-x-auto rounded-ctl border border-line">
          <table className="w-full text-left">
            <thead>
              <tr>
                <th className="deku-table-th">Email</th>
                <th className="deku-table-th">Role</th>
                <th className="deku-table-th">Status</th>
                <th className="deku-table-th">Expires</th>
                <th className="deku-table-th" />
              </tr>
            </thead>
            <tbody>
              {invites.map((i) => {
                const status = inviteStatus(i, nowMs);
                return (
                  <tr key={i.id} className="hover:bg-canvas">
                    <td className="deku-table-td">{i.email}</td>
                    <td className="deku-table-td">{roleLabel(i.role)}</td>
                    <td className="deku-table-td">
                      <Badge variant={INVITE_BADGE[status]} className="capitalize">{status}</Badge>
                    </td>
                    <td className="deku-table-td !text-ink-soft">{date(i.expires_at)}</td>
                    <td className="deku-table-td text-right">
                      {status === "pending" && i.token && canInvite(myRole) && (
                        <Button variant="ghost" size="sm" onClick={() => copy(joinUrl(i.token!))}>
                          {copied === joinUrl(i.token) ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} Link
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!invites.length && !loading && (
                <tr>
                  <td colSpan={5} className="deku-table-td !text-ink-muted">No invitations yet.</td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
          <p className="text-ink-muted">The invitee signs in with the invited email and opens the link to join.</p>
        </Panel>
      )}

      {tab === "departments" && (
        <Panel title="Departments">
          {canManageDepartments(myRole) && (
            <form data-tour="departments-form" onSubmit={createDepartment} className="grid sm:grid-cols-5 gap-2 items-end">
              <Input label="Name" required value={dept.name} onChange={(e) => setDept({ ...dept, name: e.target.value })} />
              <Input label="Code" required maxLength={10} value={dept.code} onChange={(e) => setDept({ ...dept, code: e.target.value })} />
              <Input label="Description" value={dept.description} onChange={(e) => setDept({ ...dept, description: e.target.value })} />
              <Input label="Annual budget" type="number" min={0} prefixSymbol="₹" value={dept.budget} onChange={(e) => setDept({ ...dept, budget: e.target.value })} />
              <Button type="submit" variant="tally" size="sm" isLoading={busy}>
                Create department
              </Button>
            </form>
          )}
          {!departments.length && !loading && <p className="text-ink-muted">No departments yet.</p>}
          <div className="grid md:grid-cols-2 gap-3">
            {departments.map((d) => (
              <div key={d.id} className="rounded-panel border border-line bg-surface p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[14px] font-[550] text-ink">
                      {d.name} <span className="ml-1 font-mono text-[12.5px] text-ink-subtle">{d.code}</span>
                    </p>
                    {d.description && <p className="text-[12.5px] text-ink-muted">{d.description}</p>}
                  </div>
                  {canManageDepartments(myRole) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() =>
                        confirm(`Delete the ${d.name} department and its tasks?`) &&
                        act(() => departmentsApi.delete(orgId, d.id), "Department deleted.")
                      }
                    >
                      Delete
                    </Button>
                  )}
                </div>
                <p className="text-[13px] text-ink-soft tabular-nums">
                  Lead: {d.lead_name ?? "–"} · Budget {formatINR(d.budget_allocated)} · Used {formatINR(d.budget_utilized)}
                </p>
                {!!d.department_tasks?.length && (
                  <ul className="space-y-1 border-t border-line pt-2 text-[13px]">
                    {d.department_tasks.map((t) => (
                      <li key={t.id} className="flex justify-between gap-2">
                        <span className="text-ink">{t.title}</span>
                        <span className="text-ink-muted first-letter:uppercase">
                          {t.status.replace("_", " ")} · {t.priority}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </Panel>
      )}

      {tab === "payroll" && (
        <Panel title="Payroll">
          <p className="text-ink-muted">
            Payroll totals are computed by the database from each active employee&apos;s recorded salary.
          </p>
          {canRunPayroll(myRole) ? (
            <div className="flex flex-wrap items-end gap-2">
              <Input label="Period" type="month" value={period} onChange={(e) => setPeriod(e.target.value)} className="w-40" />
              <Button variant="tally" size="sm" isLoading={busy} disabled={!period} onClick={runPayroll}>
                Run payroll
              </Button>
            </div>
          ) : (
            <p className="text-ink-muted">Only the owner, CFO or an admin can run payroll.</p>
          )}
          {payrollResult &&
            (payrollResult.success ? (
              <p role="status" className="text-ok">
                Payroll for {payrollResult.period}: {payrollResult.headcount} employees, net{" "}
                {formatINR(payrollResult.total_net_disbursed)}, TDS {formatINR(payrollResult.total_tds)}, EPF{" "}
                {formatINR(payrollResult.total_epf)}.{" "}
                {payrollResult.entry_number &&
                  (payrollResult.submitted_for_approval
                    ? `Voucher ${payrollResult.entry_number} is waiting for approval and reaches the ledger once approved.`
                    : `Posted to the ledger as ${payrollResult.entry_number}. Record the salary, TDS and EPF payments as payment vouchers against the payable accounts.`)}
              </p>
            ) : (
              <p role="alert" className="text-bad">{payrollResult.message}</p>
            ))}
          <div className="overflow-x-auto rounded-ctl border border-line">
          <table className="w-full text-left">
            <thead>
              <tr>
                <th className="deku-table-th">Period</th>
                <th className="deku-table-th">Headcount</th>
                <th className="deku-table-th !text-right">Gross</th>
                <th className="deku-table-th !text-right">Net paid</th>
                <th className="deku-table-th !text-right">TDS</th>
                <th className="deku-table-th !text-right">EPF</th>
                <th className="deku-table-th !text-right">Run on</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id} className="hover:bg-canvas">
                  <td className="deku-table-td">{r.period}</td>
                  <td className="deku-table-td">{r.headcount}</td>
                  <td className="deku-table-td text-right">{formatINR(r.total_gross)}</td>
                  <td className="deku-table-td text-right">{formatINR(r.total_net_disbursed)}</td>
                  <td className="deku-table-td text-right">{formatINR(r.total_tds)}</td>
                  <td className="deku-table-td text-right">{formatINR(r.total_epf)}</td>
                  <td className="deku-table-td text-right">{date(r.executed_at)}</td>
                </tr>
              ))}
              {!runs.length && !loading && (
                <tr>
                  <td colSpan={7} className="deku-table-td !text-ink-muted">No payroll runs yet.</td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </Panel>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface border border-line rounded-panel px-5 py-4">
      <div className="text-[13px] text-ink-muted mb-1">{label}</div>
      <div className="text-[26px] font-semibold tracking-[-0.035em] tabular-nums text-ink">{value}</div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-surface border border-line rounded-panel p-5 space-y-4">
      <h3 className="text-[15px] font-semibold tracking-tight text-ink">{title}</h3>
      {children}
    </section>
  );
}

function CopyRow({ text, copied, onCopy }: { text: string; copied: boolean; onCopy: (t: string) => void }) {
  return (
    <div className="flex items-center gap-2 rounded-ctl border border-line bg-canvas px-3 py-2">
      <code className="flex-1 truncate font-mono text-[12.5px] text-ink">{text}</code>
      <Button variant="outline" size="sm" onClick={() => onCopy(text)}>
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}
