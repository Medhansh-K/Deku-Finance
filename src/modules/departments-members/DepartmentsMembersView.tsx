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

const selectClass = "h-8 rounded-md border border-line-strong bg-surface px-2 text-xs text-ink";
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

  if (!orgId) return <p className="p-6 text-xs text-ink-muted">Select a company to see its team.</p>;

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
    <div className="space-y-4 font-sans text-xs">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Members" value={String(members.length)} />
        <Stat label="Pending invitations" value={String(pending.length)} />
        <Stat label="Seats used" value={seats.limit === null ? `${seats.used} (unlimited)` : `${seats.used} of ${seats.limit}`} />
        <Stat label="Departments" value={String(departments.length)} />
      </div>

      <div role="tablist" className="flex flex-wrap gap-1 border-b border-line pb-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`px-3 py-1.5 font-bold rounded flex items-center gap-1.5 ${
              tab === id ? "bg-panel text-white" : "text-ink-soft hover:bg-canvas-sunken"
            }`}
          >
            <Icon className="h-3.5 w-3.5 text-brand" aria-hidden /> {label}
          </button>
        ))}
      </div>

      {message && (
        <p role={message.ok ? "status" : "alert"} className={message.ok ? "text-emerald-700" : "text-rose-700"}>
          {message.text}
        </p>
      )}
      {loading && <p className="text-ink-muted">Loading…</p>}

      {tab === "members" && (
        <Panel title={`Members of ${organisation.name}`}>
          <table className="w-full text-left">
            <thead className="text-ink-muted">
              <tr>
                <th className="py-1">Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Joined</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const editable =
                  canManageMembers(myRole) && m.user_id !== user?.id && (m.role !== "owner" || myRole === "owner");
                return (
                  <tr key={m.id} className="border-t border-line">
                    <td className="py-1.5 font-semibold text-ink">{memberName(m)}</td>
                    <td className="text-ink-soft">{m.profiles?.email ?? "–"}</td>
                    <td>
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
                    <td className="text-ink-soft">{date(m.created_at)}</td>
                    <td className="text-right">
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
          <dl className="grid sm:grid-cols-2 gap-x-4 gap-y-1 pt-2 border-t border-line text-ink-muted">
            {ROLES.map((r) => (
              <div key={r.value}>
                <dt className="inline font-semibold text-ink-soft">{r.label}:</dt> <dd className="inline">{r.duty}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      )}

      {tab === "invitations" && (
        <Panel title="Invitations">
          {canInvite(myRole) ? (
            <form onSubmit={sendInvite} className="grid sm:grid-cols-5 gap-2 items-end">
              <Input label="Email" type="email" required value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} />
              <label className="space-y-1">
                <span className="block font-medium text-ink-soft">Role</span>
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
                <span className="block font-medium text-ink-soft">Department</span>
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
          {seats.reached && <p role="alert" className="text-rose-700">{seatsFullText}</p>}
          {inviteLink && <CopyRow text={inviteLink} copied={copied === inviteLink} onCopy={copy} />}

          <table className="w-full text-left">
            <thead className="text-ink-muted">
              <tr>
                <th className="py-1">Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Expires</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {invites.map((i) => {
                const status = inviteStatus(i, nowMs);
                return (
                  <tr key={i.id} className="border-t border-line">
                    <td className="py-1.5 text-ink">{i.email}</td>
                    <td>{roleLabel(i.role)}</td>
                    <td>
                      <Badge variant={INVITE_BADGE[status]}>{status}</Badge>
                    </td>
                    <td className="text-ink-soft">{date(i.expires_at)}</td>
                    <td className="text-right">
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
                  <td colSpan={5} className="py-2 text-ink-muted">No invitations yet.</td>
                </tr>
              )}
            </tbody>
          </table>
          <p className="text-ink-muted">The invitee signs in with the invited email and opens the link to join.</p>
        </Panel>
      )}

      {tab === "departments" && (
        <Panel title="Departments">
          {canManageDepartments(myRole) && (
            <form onSubmit={createDepartment} className="grid sm:grid-cols-5 gap-2 items-end">
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
              <div key={d.id} className="rounded border border-line bg-canvas p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-ink">
                      {d.name} <span className="font-mono text-ink-subtle">{d.code}</span>
                    </p>
                    {d.description && <p className="text-ink-muted">{d.description}</p>}
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
                <p className="text-ink-soft">
                  Lead: {d.lead_name ?? "–"} · Budget {formatINR(d.budget_allocated)} · Used {formatINR(d.budget_utilized)}
                </p>
                {!!d.department_tasks?.length && (
                  <ul className="space-y-0.5 border-t border-line pt-2">
                    {d.department_tasks.map((t) => (
                      <li key={t.id} className="flex justify-between gap-2">
                        <span className="text-ink">{t.title}</span>
                        <span className="text-ink-muted">
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
              <p role="status" className="text-emerald-700">
                Payroll for {payrollResult.period}: {payrollResult.headcount} employees, net{" "}
                {formatINR(payrollResult.total_net_disbursed)}, TDS {formatINR(payrollResult.total_tds)}, EPF{" "}
                {formatINR(payrollResult.total_epf)}.
              </p>
            ) : (
              <p role="alert" className="text-rose-700">{payrollResult.message}</p>
            ))}
          <table className="w-full text-left">
            <thead className="text-ink-muted">
              <tr>
                <th className="py-1">Period</th>
                <th>Headcount</th>
                <th className="text-right">Gross</th>
                <th className="text-right">Net paid</th>
                <th className="text-right">TDS</th>
                <th className="text-right">EPF</th>
                <th className="text-right">Run on</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {runs.map((r) => (
                <tr key={r.id} className="border-t border-line">
                  <td className="py-1.5">{r.period}</td>
                  <td>{r.headcount}</td>
                  <td className="text-right">{formatINR(r.total_gross)}</td>
                  <td className="text-right">{formatINR(r.total_net_disbursed)}</td>
                  <td className="text-right">{formatINR(r.total_tds)}</td>
                  <td className="text-right">{formatINR(r.total_epf)}</td>
                  <td className="text-right">{date(r.executed_at)}</td>
                </tr>
              ))}
              {!runs.length && !loading && (
                <tr>
                  <td colSpan={7} className="py-2 font-sans text-ink-muted">No payroll runs yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </Panel>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface border border-line rounded-lg p-3 shadow-xs">
      <div className="text-[10px] font-bold uppercase tracking-wider text-ink-muted mb-1">{label}</div>
      <div className="text-xl font-bold font-mono text-ink">{value}</div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-surface border border-line-strong rounded-lg p-4 shadow-xs space-y-3">
      <h3 className="text-sm font-bold text-ink">{title}</h3>
      {children}
    </section>
  );
}

function CopyRow({ text, copied, onCopy }: { text: string; copied: boolean; onCopy: (t: string) => void }) {
  return (
    <div className="flex items-center gap-2 rounded border border-line bg-canvas p-2">
      <code className="flex-1 truncate font-mono text-ink">{text}</code>
      <Button variant="outline" size="sm" onClick={() => onCopy(text)}>
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}
