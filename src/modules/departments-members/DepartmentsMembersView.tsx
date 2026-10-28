"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Users,
  Building2,
  ShieldCheck,
  CreditCard,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  ArrowRightLeft,
  ChevronRight,
  Lock,
  Unlock,
  AlertCircle,
  FileText,
  DollarSign,
  Award,
  Sparkles,
  Crown,
  Briefcase,
  UserCheck,
  Send,
  Check,
  X,
  Sliders,
  Copy,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { formatINR } from "@/lib/formatters/currency";
import { organisationsApi } from "@/api/endpoints";
import {
  departmentsService,
  Department,
  EmployeeMember,
  DepartmentTask,
  EmployeePermissions,
} from "@/lib/departments/departments-service";

export function DepartmentsMembersView() {
  const [orgId, setOrgId] = useState<string>("");
  const [activeCompanyName, setActiveCompanyName] = useState<string>("");

  const [activeTab, setActiveTab] = useState<"departments" | "members" | "payroll" | "governance">("departments");
  const [departments, setDepartments] = useState<Department[]>([]);
  const [members, setMembers] = useState<EmployeeMember[]>([]);

  // Filtering & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>("all");

  // Modals
  const [isNewDeptModalOpen, setIsNewDeptModalOpen] = useState(false);
  const [isNewMemberModalOpen, setIsNewMemberModalOpen] = useState(false);
  const [isAddTaskModalOpen, setIsAddTaskModalOpen] = useState(false);
  const [selectedDeptForTask, setSelectedDeptForTask] = useState<Department | null>(null);
  const [isAccessModalOpen, setIsAccessModalOpen] = useState(false);
  const [selectedMemberForAccess, setSelectedMemberForAccess] = useState<EmployeeMember | null>(null);
  const [isBonusModalOpen, setIsBonusModalOpen] = useState(false);
  const [selectedMemberForBonus, setSelectedMemberForBonus] = useState<EmployeeMember | null>(null);
  const [selectedMemberForTasks, setSelectedMemberForTasks] = useState<EmployeeMember | null>(null);

  // Invite Link Modal State
  const [createdInviteInfo, setCreatedInviteInfo] = useState<{
    email: string;
    role: string;
    token: string;
    inviteUrl: string;
  } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Forms State
  const [newDeptForm, setNewDeptForm] = useState({
    name: "",
    code: "",
    description: "",
    lead_id: "",
    budget_allocated: "5000000",
    initialTaskTitle: "",
  });

  const [newMemberForm, setNewMemberForm] = useState({
    name: "",
    email: "",
    phone: "",
    designation: "",
    department_id: "",
    role: "member" as EmployeeMember["role"],
    ctc_annual: "1800000",
    pan: "",
    bank_account_masked: "HDFC •••• 1234",
    permissions: {
      can_view_vouchers: false,
      can_create_vouchers: false,
      can_view_banking: false,
      can_view_financial_reports: false,
      can_view_gst: false,
      can_manage_parties: false,
      can_manage_payroll: false,
      can_access_audit_log: false,
    },
  });

  const [taskForm, setTaskForm] = useState({
    title: "",
    type: "intra" as "intra" | "inter",
    priority: "high" as DepartmentTask["priority"],
    target_department_id: "",
    assigned_to_id: "",
    due_date: new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0],
    description: "",
  });

  const [bonusAmountInput, setBonusAmountInput] = useState("50000");
  const [payrollSuccessMessage, setPayrollSuccessMessage] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Load from service and background-sync with live API
  const refreshData = async () => {
    // 1. Instant sync from local cache for immediate render
    const d = departmentsService.getDepartments(orgId);
    const m = departmentsService.getMembers(orgId);
    if (d.length > 0) setDepartments(d);
    if (m.length > 0) setMembers(m);

    // 2. Fetch live data from backend APIs / Supabase
    setIsSyncing(true);
    try {
      const [liveDepts, liveMembers] = await Promise.all([
        departmentsService.fetchDepartments(orgId),
        departmentsService.fetchMembers(orgId),
      ]);
      setDepartments(liveDepts);
      setMembers(liveMembers);
    } catch (err) {
      console.warn("Live sync error, using cached records:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedOrgId = localStorage.getItem("deku_active_org_id");
      if (savedOrgId) setOrgId(savedOrgId);
      const savedOrgName = localStorage.getItem("deku_active_org_name");
      if (savedOrgName) setActiveCompanyName(savedOrgName);

      const urlParams = new URLSearchParams(window.location.search);
      const tabParam = urlParams.get("tab");
      if (tabParam === "members" || tabParam === "payroll" || tabParam === "governance" || tabParam === "departments") {
        setActiveTab(tabParam as any);
      }
    }
  }, []);

  useEffect(() => {
    if (!orgId) return;
    refreshData();
    window.addEventListener("deku_departments_changed", refreshData);
    window.addEventListener("deku_members_changed", refreshData);
    return () => {
      window.removeEventListener("deku_departments_changed", refreshData);
      window.removeEventListener("deku_members_changed", refreshData);
    };
  }, [orgId]);

  // Totals calculations
  const totalHeadcount = members.length;
  const totalAllocatedBudget = departments.reduce((acc, d) => acc + d.budget_allocated, 0);
  const totalUtilizedBudget = departments.reduce((acc, d) => acc + d.budget_utilized, 0);
  const totalMonthlyPayroll = members.reduce((acc, m) => acc + m.compensation.monthly_net, 0);
  const totalPendingReimbursements = members.reduce((acc, m) => acc + m.compensation.reimbursements_pending, 0);
  const totalAccruedBonuses = members.reduce((acc, m) => acc + m.compensation.bonuses_accrued, 0);

  const primeOwner = members.find((m) => m.is_owner) || members[0];

  // Filtered members
  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      const matchesSearch =
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.designation.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.department_name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesDept = selectedDeptFilter === "all" || m.department_id === selectedDeptFilter;
      return matchesSearch && matchesDept;
    });
  }, [members, searchQuery, selectedDeptFilter]);

  // Actions
  const handleCreateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptForm.name || !newDeptForm.code) {
      alert("Department name and code are required.");
      return;
    }

    const leadMember = members.find((m) => m.id === newDeptForm.lead_id) || primeOwner;

    await departmentsService.addDepartment(orgId, {
      name: newDeptForm.name,
      code: newDeptForm.code,
      description: newDeptForm.description,
      lead_id: leadMember.id,
      lead_name: leadMember.name,
      lead_designation: leadMember.designation,
      budget_allocated: parseFloat(newDeptForm.budget_allocated) || 0,
      budget_utilized: 0,
      currency: "INR",
      fiscal_year: "2026-27",
      initialTaskTitle: newDeptForm.initialTaskTitle,
    });

    setIsNewDeptModalOpen(false);
    setNewDeptForm({
      name: "",
      code: "",
      description: "",
      lead_id: "",
      budget_allocated: "5000000",
      initialTaskTitle: "",
    });
    refreshData();
  };

  const handleCreateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberForm.name || !newMemberForm.email) {
      alert("Employee name and email are required.");
      return;
    }

    const targetDept = departments.find((d) => d.id === newMemberForm.department_id) || departments[0];
    const ctc = parseFloat(newMemberForm.ctc_annual) || 1800000;
    const monthlyGross = Math.round(ctc / 12);
    const tds = Math.round(monthlyGross * 0.1);
    const epf = Math.round(monthlyGross * 0.06);
    const net = monthlyGross - tds - epf;

    // 1. Synchronize to local & database personnel directory
    await departmentsService.addEmployee(orgId, {
      name: newMemberForm.name,
      email: newMemberForm.email,
      phone: newMemberForm.phone || "+91 98000 00000",
      designation: newMemberForm.designation || "Executive Associate",
      department_id: targetDept.id,
      department_name: targetDept.name,
      is_lead: false,
      joining_date: new Date().toISOString().split("T")[0],
      role: newMemberForm.role,
      status: "active",
      permissions: newMemberForm.permissions,
      compensation: {
        ctc_annual: ctc,
        monthly_gross: monthlyGross,
        monthly_net: net,
        tds_deduction_monthly: tds,
        epf_monthly: epf,
        reimbursements_pending: 0,
        reimbursements_approved: 0,
        bonuses_accrued: 0,
        last_payroll_date: "2026-10-01",
        payroll_status: "pending",
        bank_account_masked: newMemberForm.bank_account_masked,
        pan: newMemberForm.pan || "XXXXX0000X",
      },
    });

    // 2. Dispatch secure invitation token & workbench link via backend API
    try {
      const inviteRes = await organisationsApi.inviteMember(orgId, {
        email: newMemberForm.email,
        role: newMemberForm.role,
        designation: newMemberForm.designation || "Executive Associate",
        department_id: targetDept.id,
      });

      if (inviteRes && inviteRes.data) {
        const token = inviteRes.data.token || "token-generated";
        const origin = typeof window !== "undefined" ? window.location.origin : "";
        setCreatedInviteInfo({
          email: newMemberForm.email,
          role: newMemberForm.role,
          token: token,
          inviteUrl: `${origin}/join?token=${token}`,
        });
      }
    } catch (inviteErr: any) {
      console.warn("Backend invitation dispatch note:", inviteErr);
    }

    setIsNewMemberModalOpen(false);
    setNewMemberForm({
      name: "",
      email: "",
      phone: "",
      designation: "",
      department_id: "",
      role: "accountant",
      ctc_annual: "1800000",
      pan: "",
      bank_account_masked: "HDFC •••• 1234",
      permissions: {
        can_view_vouchers: false,
        can_create_vouchers: false,
        can_view_banking: false,
        can_view_financial_reports: false,
        can_view_gst: false,
        can_manage_parties: false,
        can_manage_payroll: false,
        can_access_audit_log: false,
      },
    });
    refreshData();
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDeptForTask || !taskForm.title) return;

    const assignee = members.find((m) => m.id === taskForm.assigned_to_id) || members[0];
    const targetDept = departments.find((d) => d.id === taskForm.target_department_id);

    await departmentsService.addTaskToDepartment(orgId, selectedDeptForTask.id, {
      title: taskForm.title,
      type: taskForm.type,
      priority: taskForm.priority,
      status: "in_progress",
      assigned_to_name: assignee.name,
      assigned_to_id: assignee.id,
      source_department_id: selectedDeptForTask.id,
      target_department_id: taskForm.type === "inter" ? targetDept?.id : undefined,
      target_department_name: taskForm.type === "inter" ? targetDept?.name : undefined,
      due_date: taskForm.due_date,
      description: taskForm.description,
    });

    setIsAddTaskModalOpen(false);
    setTaskForm({
      title: "",
      type: "intra",
      priority: "high",
      target_department_id: "",
      assigned_to_id: "",
      due_date: new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0],
      description: "",
    });
    refreshData();
  };

  const handleUpdatePermissions = async (role: EmployeeMember["role"], perms: EmployeePermissions) => {
    if (!selectedMemberForAccess) return;
    await departmentsService.updateEmployeePermissions(orgId, selectedMemberForAccess.id, role, perms);
    setIsAccessModalOpen(false);
    refreshData();
  };

  const handleApproveReimbursement = async (memberId: string, amount: number) => {
    await departmentsService.approveReimbursement(orgId, memberId, amount);
    refreshData();
  };

  const handleGrantBonus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMemberForBonus) return;
    const amount = parseFloat(bonusAmountInput) || 0;
    if (amount <= 0) return;

    await departmentsService.grantBonus(orgId, selectedMemberForBonus.id, amount);
    setIsBonusModalOpen(false);
    refreshData();
  };

  const handleRunPayroll = async () => {
    const res = await departmentsService.runMonthlyPayroll(orgId);
    setPayrollSuccessMessage(
      `✓ Monthly Payroll executed successfully for ${res.processedCount} employees. Total disbursed: ${formatINR(
        res.totalDisbursed
      )} via Direct Bank Allocation.`
    );
    setTimeout(() => setPayrollSuccessMessage(null), 5000);
    refreshData();
  };

  return (
    <div className="space-y-4 font-sans text-xs">
      {/* Prime Owner License Holder Strip */}
      <div className="bg-panel border border-edge rounded-lg p-3 text-white flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-brand/20 border border-brand flex items-center justify-center shrink-0">
            <Crown className="h-5 w-5 text-brand" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm tracking-wide">{primeOwner?.name}</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-brand text-ink">
                Prime License Owner
              </span>
              <span className="text-[11px] text-brand-soft">• {primeOwner?.designation}</span>
              {isSyncing ? (
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-brand/20 text-brand border border-brand/30 flex items-center gap-1">
                  <Clock className="h-3 w-3 animate-spin" /> Syncing API...
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live DB Synced
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-300 mt-0.5">
              Holds legal rights &amp; master credentials for {activeCompanyName}. Exclusive authority to create departments, onboard personnel, and assign granular platform roles.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            suppressHydrationWarning
            variant="tally"
            size="sm"
            onClick={() => setIsNewMemberModalOpen(true)}
            className="gap-1.5 font-bold"
          >
            <Plus className="h-3.5 w-3.5" /> Add Employee
          </Button>
          <Button
            suppressHydrationWarning
            variant="outline"
            size="sm"
            onClick={() => setIsNewDeptModalOpen(true)}
            className="gap-1.5 text-white border-slate-600 hover:bg-white/10"
          >
            <Building2 className="h-3.5 w-3.5 text-brand" /> Create Department
          </Button>
        </div>
      </div>

      {/* Top 4 KPI Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center justify-between">
            <span>Departments</span>
            <Building2 className="h-3.5 w-3.5 text-blue-600" />
          </div>
          <div className="text-xl font-bold font-mono text-slate-900">{departments.length} Units</div>
          <div className="text-[10px] text-slate-500 mt-1">100% Leads Assigned</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center justify-between">
            <span>Firm Personnel</span>
            <Users className="h-3.5 w-3.5 text-emerald-600" />
          </div>
          <div className="text-xl font-bold font-mono text-slate-900">{totalHeadcount} Members</div>
          <div className="text-[10px] text-emerald-600 font-semibold mt-1">All Assigned to Depts</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center justify-between">
            <span>Operating Budgets</span>
            <CreditCard className="h-3.5 w-3.5 text-purple-600" />
          </div>
          <div className="text-xl font-bold font-mono text-slate-900">{formatINR(totalAllocatedBudget)}</div>
          <div className="text-[10px] text-slate-500 mt-1">
            Utilized: {formatINR(totalUtilizedBudget)} ({Math.round((totalUtilizedBudget / totalAllocatedBudget) * 100)}%)
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center justify-between">
            <span>Monthly Payroll Run</span>
            <DollarSign className="h-3.5 w-3.5 text-teal-600" />
          </div>
          <div className="text-xl font-bold font-mono text-slate-900">{formatINR(totalMonthlyPayroll)}</div>
          <div className="text-[10px] text-amber-700 font-semibold mt-1">
            Pending Claims: {formatINR(totalPendingReimbursements)}
          </div>
        </div>
      </div>

      {/* Tab Navigation Strip */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-1">
        <div className="flex items-center gap-1">
          <button
            id="tab-departments"
            suppressHydrationWarning
            onClick={() => setActiveTab("departments")}
            className={`px-3 py-1.5 font-bold rounded text-xs transition-colors flex items-center gap-1.5 ${
              activeTab === "departments"
                ? "bg-panel text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Building2 className="h-3.5 w-3.5 text-brand" />
            Departments &amp; Tasks ({departments.length})
          </button>

          <button
            id="tab-members"
            suppressHydrationWarning
            onClick={() => setActiveTab("members")}
            className={`px-3 py-1.5 font-bold rounded text-xs transition-colors flex items-center gap-1.5 ${
              activeTab === "members"
                ? "bg-panel text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Users className="h-3.5 w-3.5 text-brand" />
            Members &amp; Roles ({members.length})
          </button>

          <button
            suppressHydrationWarning
            onClick={() => setActiveTab("payroll")}
            className={`px-3 py-1.5 font-bold rounded text-xs transition-colors flex items-center gap-1.5 ${
              activeTab === "payroll"
                ? "bg-panel text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <DollarSign className="h-3.5 w-3.5 text-brand" />
            Payroll, CTC &amp; Reimbursements
          </button>

          <button
            suppressHydrationWarning
            onClick={() => setActiveTab("governance")}
            className={`px-3 py-1.5 font-bold rounded text-xs transition-colors flex items-center gap-1.5 ${
              activeTab === "governance"
                ? "bg-panel text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5 text-brand" />
            Owner Access Governance Matrix
          </button>
        </div>

        {activeTab === "payroll" && (
          <Button
            suppressHydrationWarning
            variant="tally"
            size="sm"
            onClick={handleRunPayroll}
            className="gap-1.5 font-bold"
          >
            <Send className="h-3 w-3" /> Run Monthly Payroll Batch
          </Button>
        )}
      </div>

      {payrollSuccessMessage && (
        <div className="p-3 rounded bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{payrollSuccessMessage}</span>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 1: DEPARTMENTS & TASKS                                   */}
      {/* ============================================================ */}
      {activeTab === "departments" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {departments.map((dept) => {
            const deptMembers = members.filter((m) => m.department_id === dept.id);
            const utilizationPercent = Math.min(
              100,
              Math.round((dept.budget_utilized / dept.budget_allocated) * 100)
            );

            return (
              <div
                key={dept.id}
                className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-3 flex flex-col justify-between"
              >
                <div>
                  {/* Department Header */}
                  <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-200">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-sm text-slate-900">{dept.name}</h3>
                        <span className="font-mono font-bold text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-300">
                          {dept.code}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">{dept.description}</p>
                    </div>

                    <Button
                      suppressHydrationWarning
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedDeptForTask(dept);
                        setIsAddTaskModalOpen(true);
                      }}
                      className="gap-1 text-[11px] shrink-0"
                    >
                      <Plus className="h-3 w-3 text-brand" /> Add Task
                    </Button>
                  </div>

                  {/* Department Lead & Members */}
                  <div className="grid grid-cols-2 gap-2 my-3 text-[11px] bg-slate-50 p-2.5 rounded border border-slate-200">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">
                        Departmental Lead
                      </span>
                      <div className="font-bold text-slate-800 flex items-center gap-1.5">
                        <Briefcase className="h-3.5 w-3.5 text-brand" />
                        <span>{dept.lead_name}</span>
                      </div>
                      <div className="text-[10px] text-slate-500">{dept.lead_designation}</div>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">
                        Headcount in Dept
                      </span>
                      <div className="font-mono font-bold text-slate-800 flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 text-blue-600" />
                        <span>{deptMembers.length} Employees</span>
                      </div>
                      <div className="text-[10px] text-slate-500 truncate">
                        {deptMembers.map((m) => m.name.split(" ")[0]).join(", ")}
                      </div>
                    </div>
                  </div>

                  {/* Departmental Budget Bar */}
                  <div className="space-y-1 mb-3">
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="text-slate-500">
                        Budget Utilized: <strong>{formatINR(dept.budget_utilized)}</strong>
                      </span>
                      <span className="font-bold text-slate-900">
                        Total: {formatINR(dept.budget_allocated)} ({utilizationPercent}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          utilizationPercent > 85 ? "bg-rose-500" : "bg-brand"
                        }`}
                        style={{ width: `${utilizationPercent}%` }}
                      />
                    </div>
                  </div>

                  {/* Inter / Intra Department Tasks */}
                  <div className="space-y-1.5">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                      <span>Inter / Intra Departmental Tasks ({dept.tasks.length})</span>
                      <span className="text-slate-400 font-normal">Click status to advance</span>
                    </div>

                    {dept.tasks.length === 0 ? (
                      <div className="p-3 text-center text-slate-400 italic text-[11px] bg-slate-50 rounded border border-dashed border-slate-200">
                        No active tasks assigned yet.
                      </div>
                    ) : (
                      dept.tasks.map((task) => (
                        <div
                          key={task.id}
                          className="p-2 rounded bg-white border border-slate-200 hover:border-slate-300 transition-colors flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${
                                  task.type === "inter"
                                    ? "bg-purple-100 text-purple-800 border border-purple-200"
                                    : "bg-blue-50 text-blue-700 border border-blue-200"
                                }`}
                              >
                                {task.type === "inter" ? `Inter ⇄ ${task.target_department_name?.split(" ")[0] || "Cross"}` : "Intra"}
                              </span>

                              <span
                                className={`text-[9px] font-mono font-bold px-1 py-0.2 rounded uppercase ${
                                  task.priority === "urgent"
                                    ? "bg-rose-100 text-rose-700"
                                    : task.priority === "high"
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-slate-100 text-slate-600"
                                }`}
                              >
                                {task.priority}
                              </span>

                              <span className="font-semibold text-slate-900 truncate text-[11px]">
                                {task.title}
                              </span>
                            </div>

                            <div className="text-[10px] text-slate-500 mt-1 flex items-center justify-between gap-2 flex-wrap">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-slate-400 font-semibold">Assignee:</span>
                                <select
                                  suppressHydrationWarning
                                  value={task.assigned_to_id || ""}
                                  onChange={async (e) => {
                                    const newAssigneeId = e.target.value;
                                    const newAssignee = members.find((m) => m.id === newAssigneeId);
                                    if (newAssignee) {
                                      await departmentsService.assignTaskToMember(
                                        orgId,
                                        dept.id,
                                        task.id,
                                        newAssignee.id,
                                        newAssignee.name
                                      );
                                      refreshData();
                                    }
                                  }}
                                  className="text-[10px] font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded px-1.5 py-0.5 focus:border-brand focus:outline-none cursor-pointer"
                                  title="Click to assign or reassign task to any member"
                                >
                                  <option value="">— Unassigned —</option>
                                  {members.map((m) => (
                                    <option key={m.id} value={m.id}>
                                      {m.name} ({m.designation.split(" ")[0]})
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <span className="text-slate-400 font-mono text-[10px]">Due: {task.due_date}</span>
                            </div>
                          </div>

                          <button
                            suppressHydrationWarning
                            onClick={() => {
                              const nextStatus =
                                task.status === "in_progress"
                                  ? "completed"
                                  : task.status === "completed"
                                  ? "todo"
                                  : "in_progress";
                              departmentsService.updateTaskStatus(orgId, dept.id, task.id, nextStatus);
                            }}
                            className={`px-2 py-1 rounded text-[10px] font-bold uppercase transition-colors shrink-0 ${
                              task.status === "completed"
                                ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                                : "bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100"
                            }`}
                          >
                            {task.status === "completed" ? "✓ Completed" : "In Progress"}
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 2: MEMBERS DIRECTORY & ACCESS ROLES                      */}
      {/* ============================================================ */}
      {activeTab === "members" && (
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-3">
          {/* Search & Filter Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                suppressHydrationWarning
                type="text"
                placeholder="Search member by name, designation, email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded border border-slate-300 pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:border-brand focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                suppressHydrationWarning
                value={selectedDeptFilter}
                onChange={(e) => setSelectedDeptFilter(e.target.value)}
                className="rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-brand focus:outline-none"
              >
                <option value="all">All Departments ({members.length})</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({members.filter((m) => m.department_id === d.id).length})
                  </option>
                ))}
              </select>

              <Button
                suppressHydrationWarning
                variant="tally"
                size="sm"
                onClick={() => setIsNewMemberModalOpen(true)}
                className="gap-1 font-bold shrink-0"
              >
                <Plus className="h-3.5 w-3.5" /> Add Employee
              </Button>
            </div>
          </div>

          {/* Members Table */}
          <div className="overflow-x-auto rounded border border-slate-200">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300 text-[11px] font-mono text-slate-700">
                  <th className="py-2.5 px-3">Employee &amp; Identity</th>
                  <th className="py-2.5 px-3">Assigned Department</th>
                  <th className="py-2.5 px-3">Platform Role</th>
                  <th className="py-2.5 px-3">Selective Permissions</th>
                  <th className="py-2.5 px-3">Assigned Tasks</th>
                  <th className="py-2.5 px-3 text-right">Annual CTC</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredMembers.map((member) => (
                  <tr key={member.id} className="hover:bg-slate-50/70">
                    {/* Employee & Identity */}
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-slate-100 border border-slate-300 flex items-center justify-center font-bold text-slate-700 text-xs shrink-0">
                          {member.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                            <span>{member.name}</span>
                            {member.is_owner && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-brand text-ink">
                                👑 Prime Owner
                              </span>
                            )}
                            {member.is_lead && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-blue-100 text-blue-800">
                                Dept Lead
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500">{member.designation}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{member.email}</div>
                        </div>
                      </div>
                    </td>

                    {/* Department */}
                    <td className="py-2.5 px-3 font-medium text-slate-800">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 text-slate-400" />
                        <span>{member.department_name}</span>
                      </div>
                    </td>

                    {/* Role */}
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider uppercase border ${
                          member.role === "owner"
                            ? "bg-brand/15 text-[#2A7575] border-brand/40"
                            : member.role === "cfo"
                            ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                            : member.role === "admin"
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : member.role === "accountant"
                            ? "bg-amber-50 text-amber-800 border-amber-200"
                            : member.role === "analyst"
                            ? "bg-purple-50 text-purple-700 border-purple-200"
                            : member.role === "auditor"
                            ? "bg-rose-50 text-rose-700 border-rose-200"
                            : "bg-slate-100 text-slate-600 border-slate-300"
                        }`}
                      >
                        {member.role.toUpperCase()}
                      </span>
                    </td>

                    {/* Selective Permissions */}
                    <td className="py-2.5 px-3">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {member.permissions.can_view_vouchers && (
                          <span className="text-[9px] font-mono bg-emerald-50 text-emerald-700 px-1 rounded border border-emerald-200">
                            Vouchers
                          </span>
                        )}
                        {member.permissions.can_view_banking && (
                          <span className="text-[9px] font-mono bg-blue-50 text-blue-700 px-1 rounded border border-blue-200">
                            Bank
                          </span>
                        )}
                        {member.permissions.can_view_financial_reports && (
                          <span className="text-[9px] font-mono bg-purple-50 text-purple-700 px-1 rounded border border-purple-200">
                            Reports
                          </span>
                        )}
                        {member.permissions.can_view_gst && (
                          <span className="text-[9px] font-mono bg-amber-50 text-amber-700 px-1 rounded border border-amber-200">
                            GST
                          </span>
                        )}
                        {member.permissions.can_manage_payroll && (
                          <span className="text-[9px] font-mono bg-rose-50 text-rose-700 px-1 rounded border border-rose-200">
                            Payroll
                          </span>
                        )}
                        {!member.permissions.can_view_vouchers &&
                          !member.permissions.can_view_financial_reports && (
                            <span className="text-[9px] font-mono bg-slate-100 text-slate-500 px-1 rounded">
                              Limited Member Scope
                            </span>
                          )}
                      </div>
                    </td>

                    {/* Assigned Tasks */}
                    <td className="py-2.5 px-3">
                      {(() => {
                        const memberTasks = departments.flatMap((d) =>
                          d.tasks
                            .filter((t) => t.assigned_to_id === member.id || t.assigned_to_name === member.name)
                            .map((t) => ({ ...t, deptName: d.name, deptCode: d.code, deptId: d.id }))
                        );
                        const activeCount = memberTasks.filter((t) => t.status !== "completed").length;

                        if (memberTasks.length > 0) {
                          return (
                            <button
                              suppressHydrationWarning
                              onClick={() => setSelectedMemberForTasks(member)}
                              className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-bold text-[11px] transition-colors"
                              title="Click to view assigned tasks"
                            >
                              <CheckCircle2 className="h-3 w-3 text-blue-600" />
                              <span>{memberTasks.length} {memberTasks.length === 1 ? "Task" : "Tasks"}</span>
                              {activeCount > 0 ? (
                                <span className="px-1 py-0.2 rounded-full text-[9px] bg-amber-100 text-amber-800 font-mono">
                                  {activeCount} active
                                </span>
                              ) : (
                                <span className="px-1 py-0.2 rounded-full text-[9px] bg-emerald-100 text-emerald-800 font-mono">
                                  ✓ all done
                                </span>
                              )}
                            </button>
                          );
                        }

                        return (
                          <button
                            suppressHydrationWarning
                            onClick={() => {
                              const memberDept = departments.find((d) => d.id === member.department_id) || departments[0];
                              setSelectedDeptForTask(memberDept);
                              setTaskForm((prev) => ({ ...prev, assigned_to_id: member.id }));
                              setIsAddTaskModalOpen(true);
                            }}
                            className="text-[10px] text-slate-400 hover:text-brand hover:underline flex items-center gap-1 font-medium"
                          >
                            <Plus className="h-3 w-3" /> Assign Task
                          </button>
                        );
                      })()}
                    </td>

                    {/* CTC */}
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                      {formatINR(member.compensation.ctc_annual)}
                    </td>

                    {/* Status */}
                    <td className="py-2.5 px-3 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        Active
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          suppressHydrationWarning
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const memberDept = departments.find((d) => d.id === member.department_id) || departments[0];
                            setSelectedDeptForTask(memberDept);
                            setTaskForm((prev) => ({ ...prev, assigned_to_id: member.id }));
                            setIsAddTaskModalOpen(true);
                          }}
                          className="gap-1 text-[11px] text-slate-700 hover:text-slate-900"
                          title="Assign task directly to this member"
                        >
                          <Plus className="h-3 w-3 text-blue-600" /> Task
                        </Button>
                        <Button
                          suppressHydrationWarning
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedMemberForAccess(member);
                            setIsAccessModalOpen(true);
                          }}
                          className="gap-1 text-[11px]"
                        >
                          <Sliders className="h-3 w-3 text-brand" /> Access
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 3: PAYROLL, CTC, REIMBURSEMENTS & BONUSES                */}
      {/* ============================================================ */}
      {activeTab === "payroll" && (
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <h3 className="font-bold text-sm text-slate-900">Personnel Financial Records &amp; Compensation</h3>
              <p className="text-[11px] text-slate-500">
                Authoritative breakdown of Annual CTC, Monthly Gross, TDS/EPF deductions, pending reimbursements, and accrued bonuses.
              </p>
            </div>
            <div className="text-right font-mono text-[11px]">
              <span className="text-slate-500">Total Monthly Disbursement: </span>
              <span className="font-bold text-slate-900">{formatINR(totalMonthlyPayroll)}</span>
            </div>
          </div>

          <div className="overflow-x-auto rounded border border-slate-200">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300 text-[11px] font-mono text-slate-700">
                  <th className="py-2.5 px-3">Employee Name</th>
                  <th className="py-2.5 px-3">Department</th>
                  <th className="py-2.5 px-3 text-right">Annual CTC</th>
                  <th className="py-2.5 px-3 text-right">Gross Monthly</th>
                  <th className="py-2.5 px-3 text-right">TDS / EPF</th>
                  <th className="py-2.5 px-3 text-right">Net Take-Home</th>
                  <th className="py-2.5 px-3 text-right">Pending Reimbursements</th>
                  <th className="py-2.5 px-3 text-right">Accrued Bonuses</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {members.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-slate-900 flex items-center gap-1.5">
                        <span>{m.name}</span>
                        {m.is_owner && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-brand text-ink">
                            👑 Owner
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        PAN: {m.compensation.pan} • {m.compensation.bank_account_masked}
                      </div>
                    </td>

                    <td className="py-2.5 px-3 text-slate-700">{m.department_name}</td>

                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                      {formatINR(m.compensation.ctc_annual)}
                    </td>

                    <td className="py-2.5 px-3 text-right font-mono text-slate-800">
                      {formatINR(m.compensation.monthly_gross)}
                    </td>

                    <td className="py-2.5 px-3 text-right font-mono text-slate-500">
                      -{formatINR(m.compensation.tds_deduction_monthly + m.compensation.epf_monthly)}
                    </td>

                    <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700 bg-emerald-50/50">
                      {formatINR(m.compensation.monthly_net)}
                    </td>

                    <td className="py-2.5 px-3 text-right font-mono">
                      {m.compensation.reimbursements_pending > 0 ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <span className="text-amber-700 font-bold">
                            {formatINR(m.compensation.reimbursements_pending)}
                          </span>
                          <button
                            suppressHydrationWarning
                            onClick={() =>
                              handleApproveReimbursement(m.id, m.compensation.reimbursements_pending)
                            }
                            className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-800 hover:bg-emerald-200 font-bold transition-colors"
                            title="Approve & Clear Reimbursement"
                          >
                            Approve
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-400 font-mono text-[11px]">Cleared (0.00)</span>
                      )}
                    </td>

                    <td className="py-2.5 px-3 text-right font-mono font-bold text-purple-700">
                      {formatINR(m.compensation.bonuses_accrued)}
                    </td>

                    <td className="py-2.5 px-3 text-right">
                      <Button
                        suppressHydrationWarning
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedMemberForBonus(m);
                          setIsBonusModalOpen(true);
                        }}
                        className="gap-1 text-[11px]"
                      >
                        <Award className="h-3 w-3 text-brand" /> Grant Bonus
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 4: OWNER ACCESS & GOVERNANCE MATRIX                      */}
      {/* ============================================================ */}
      {activeTab === "governance" && (
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-4">
          <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-200">
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-brand" />
                <h3 className="font-bold text-sm text-slate-900">Owner Access &amp; Role Privilege Governance</h3>
              </div>
              <p className="text-[11px] text-slate-500 mt-1 max-w-2xl leading-relaxed">
                By architectural decree, the license holder (<strong>{primeOwner?.name}</strong>) is the prime employee with non-revocable root authority. 
                Regular employees are granted selective access only to modules designated by the Owner.
              </p>
            </div>
            <span className="px-2.5 py-1 rounded bg-panel text-white font-mono font-bold text-xs shrink-0">
              Double-Entry Protected
            </span>
          </div>

          {/* Governance Matrix Table */}
          <div className="overflow-x-auto rounded border border-slate-200">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300 font-mono text-[11px] text-slate-700">
                  <th className="py-2.5 px-3 w-48">Employee / Role</th>
                  <th className="py-2.5 px-2 text-center">Accounting Vouchers</th>
                  <th className="py-2.5 px-2 text-center">Bank &amp; Liquidity</th>
                  <th className="py-2.5 px-2 text-center">Balance Sheet &amp; P&amp;L</th>
                  <th className="py-2.5 px-2 text-center">GST Filing Hub</th>
                  <th className="py-2.5 px-2 text-center">Parties &amp; KYC</th>
                  <th className="py-2.5 px-2 text-center">Payroll &amp; CTC</th>
                  <th className="py-2.5 px-2 text-center">Audit Security Log</th>
                  <th className="py-2.5 px-3 text-right">Modify</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {members.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-slate-900 flex items-center gap-1.5">
                        <span>{m.name}</span>
                        {m.is_owner && <span className="text-[9px] text-amber-600 font-bold">👑</span>}
                      </div>
                      <div className="text-[10px] text-slate-500">{m.department_name}</div>
                      <Badge variant={m.role === "owner" ? "teal" : "default"}>{m.role.toUpperCase()}</Badge>
                    </td>

                    <td className="py-2.5 px-2 text-center">
                      {m.permissions.can_view_vouchers ? (
                        <Check className="h-4 w-4 text-emerald-600 mx-auto" />
                      ) : (
                        <X className="h-4 w-4 text-slate-300 mx-auto" />
                      )}
                    </td>

                    <td className="py-2.5 px-2 text-center">
                      {m.permissions.can_view_banking ? (
                        <Check className="h-4 w-4 text-emerald-600 mx-auto" />
                      ) : (
                        <X className="h-4 w-4 text-slate-300 mx-auto" />
                      )}
                    </td>

                    <td className="py-2.5 px-2 text-center">
                      {m.permissions.can_view_financial_reports ? (
                        <Check className="h-4 w-4 text-emerald-600 mx-auto" />
                      ) : (
                        <X className="h-4 w-4 text-slate-300 mx-auto" />
                      )}
                    </td>

                    <td className="py-2.5 px-2 text-center">
                      {m.permissions.can_view_gst ? (
                        <Check className="h-4 w-4 text-emerald-600 mx-auto" />
                      ) : (
                        <X className="h-4 w-4 text-slate-300 mx-auto" />
                      )}
                    </td>

                    <td className="py-2.5 px-2 text-center">
                      {m.permissions.can_manage_parties ? (
                        <Check className="h-4 w-4 text-emerald-600 mx-auto" />
                      ) : (
                        <X className="h-4 w-4 text-slate-300 mx-auto" />
                      )}
                    </td>

                    <td className="py-2.5 px-2 text-center">
                      {m.permissions.can_manage_payroll ? (
                        <Check className="h-4 w-4 text-emerald-600 mx-auto" />
                      ) : (
                        <X className="h-4 w-4 text-slate-300 mx-auto" />
                      )}
                    </td>

                    <td className="py-2.5 px-2 text-center">
                      {m.permissions.can_access_audit_log ? (
                        <Check className="h-4 w-4 text-emerald-600 mx-auto" />
                      ) : (
                        <X className="h-4 w-4 text-slate-300 mx-auto" />
                      )}
                    </td>

                    <td className="py-2.5 px-3 text-right">
                      <Button
                        suppressHydrationWarning
                        variant="outline"
                        size="sm"
                        disabled={m.is_owner}
                        onClick={() => {
                          setSelectedMemberForAccess(m);
                          setIsAccessModalOpen(true);
                        }}
                        className="text-[10px]"
                      >
                        {m.is_owner ? "Immutable" : "Configure"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: CREATE DEPARTMENT                                     */}
      {/* ============================================================ */}
      <Modal
        isOpen={isNewDeptModalOpen}
        onClose={() => setIsNewDeptModalOpen(false)}
        title="Create New Firm Department"
        description="Establish an organizational unit with designated lead and allocated annual budget"
      >
        <form onSubmit={handleCreateDepartment} className="space-y-3 font-sans text-xs">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Department Name"
              placeholder="e.g. Legal & Statutory Compliance"
              value={newDeptForm.name}
              onChange={(e) => setNewDeptForm({ ...newDeptForm, name: e.target.value })}
              required
            />
            <Input
              label="Department Code"
              placeholder="e.g. LEG"
              value={newDeptForm.code}
              onChange={(e) => setNewDeptForm({ ...newDeptForm, code: e.target.value.toUpperCase() })}
              maxLength={5}
              required
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
              Departmental Lead (Must be a registered Member)
            </label>
            <select
              suppressHydrationWarning
              value={newDeptForm.lead_id}
              onChange={(e) => setNewDeptForm({ ...newDeptForm, lead_id: e.target.value })}
              className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-brand focus:outline-none"
              required
            >
              <option value="">— Select Departmental Lead —</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.designation})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Annual Allocated Budget (INR)"
              type="number"
              placeholder="5000000"
              value={newDeptForm.budget_allocated}
              onChange={(e) => setNewDeptForm({ ...newDeptForm, budget_allocated: e.target.value })}
              required
            />
            <Input
              label="Initial Department Task (Optional)"
              placeholder="e.g. Q3 Vendor Audit"
              value={newDeptForm.initialTaskTitle}
              onChange={(e) => setNewDeptForm({ ...newDeptForm, initialTaskTitle: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
              Department Description &amp; Scope
            </label>
            <textarea
              rows={2}
              placeholder="Outline mandate, objectives and responsibilities..."
              value={newDeptForm.description}
              onChange={(e) => setNewDeptForm({ ...newDeptForm, description: e.target.value })}
              className="w-full rounded border border-slate-300 p-2 text-xs text-slate-800 focus:border-brand focus:outline-none"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t border-slate-200">
            <Button
              suppressHydrationWarning
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIsNewDeptModalOpen(false)}
            >
              Cancel
            </Button>
            <Button suppressHydrationWarning type="submit" variant="tally" size="sm" className="font-bold">
              Create Department
            </Button>
          </div>
        </form>
      </Modal>

      {/* ============================================================ */}
      {/* MODAL: ADD EMPLOYEE                                          */}
      {/* ============================================================ */}
      <Modal
        isOpen={isNewMemberModalOpen}
        onClose={() => setIsNewMemberModalOpen(false)}
        title="Add Employee to Firm"
        description="Onboard an employee, assign to a department, define CTC and selective platform access"
      >
        <form onSubmit={handleCreateMember} className="space-y-3 font-sans text-xs">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Full Legal Name"
              placeholder="e.g. Aditya Varma"
              value={newMemberForm.name}
              onChange={(e) => setNewMemberForm({ ...newMemberForm, name: e.target.value })}
              required
            />
            <Input
              label="Corporate Email"
              type="email"
              placeholder="aditya@dekufinance.com"
              value={newMemberForm.email}
              onChange={(e) => setNewMemberForm({ ...newMemberForm, email: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Designation / Position"
              placeholder="e.g. Accounts & GST Associate"
              value={newMemberForm.designation}
              onChange={(e) => setNewMemberForm({ ...newMemberForm, designation: e.target.value })}
              required
            />
            <Input
              label="Phone Number"
              placeholder="+91 98000 12345"
              value={newMemberForm.phone}
              onChange={(e) => setNewMemberForm({ ...newMemberForm, phone: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                Assign to Department
              </label>
              <select
                suppressHydrationWarning
                value={newMemberForm.department_id}
                onChange={(e) => setNewMemberForm({ ...newMemberForm, department_id: e.target.value })}
                className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-brand focus:outline-none"
                required
              >
                <option value="">— Select Department —</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                Platform Role
              </label>
              <select
                suppressHydrationWarning
                value={newMemberForm.role}
                onChange={(e) =>
                  setNewMemberForm({ ...newMemberForm, role: e.target.value as EmployeeMember["role"] })
                }
                className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-brand focus:outline-none"
              >
                <option value="owner">Owner (Founder / License Holder)</option>
                <option value="cfo">CFO (Finance Manager &amp; Sign-Off)</option>
                <option value="admin">Admin (Operational Oversight)</option>
                <option value="accountant">Accountant (Accounting &amp; GST Drafts)</option>
                <option value="analyst">Analyst (FP&amp;A &amp; Metrics Inspection)</option>
                <option value="auditor">Auditor (Statutory Read-Only Audit)</option>
                <option value="viewer">Viewer (Stakeholder / Investor KPIs Only)</option>
                <option value="member">Team Member (General Scope)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Input
              label="Annual CTC (INR)"
              type="number"
              placeholder="1800000"
              value={newMemberForm.ctc_annual}
              onChange={(e) => setNewMemberForm({ ...newMemberForm, ctc_annual: e.target.value })}
              required
            />
            <Input
              label="PAN Number"
              placeholder="ABCDE1234F"
              value={newMemberForm.pan}
              onChange={(e) => setNewMemberForm({ ...newMemberForm, pan: e.target.value.toUpperCase() })}
              maxLength={10}
            />
            <Input
              label="Disbursement Bank Mask"
              placeholder="HDFC •••• 1234"
              value={newMemberForm.bank_account_masked}
              onChange={(e) => setNewMemberForm({ ...newMemberForm, bank_account_masked: e.target.value })}
            />
          </div>

          {/* Selective Permissions Checkboxes */}
          <div className="p-3 rounded bg-slate-50 border border-slate-200 space-y-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
              Selective Platform Permissions (Owner Granted)
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newMemberForm.permissions.can_view_vouchers}
                  onChange={(e) =>
                    setNewMemberForm({
                      ...newMemberForm,
                      permissions: { ...newMemberForm.permissions, can_view_vouchers: e.target.checked },
                    })
                  }
                  className="rounded text-brand"
                />
                <span>View Accounting Vouchers</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newMemberForm.permissions.can_create_vouchers}
                  onChange={(e) =>
                    setNewMemberForm({
                      ...newMemberForm,
                      permissions: { ...newMemberForm.permissions, can_create_vouchers: e.target.checked },
                    })
                  }
                  className="rounded text-brand"
                />
                <span>Create &amp; Post Vouchers</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newMemberForm.permissions.can_view_financial_reports}
                  onChange={(e) =>
                    setNewMemberForm({
                      ...newMemberForm,
                      permissions: { ...newMemberForm.permissions, can_view_financial_reports: e.target.checked },
                    })
                  }
                  className="rounded text-brand"
                />
                <span>Financial Reports (P&amp;L, B/S)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newMemberForm.permissions.can_view_gst}
                  onChange={(e) =>
                    setNewMemberForm({
                      ...newMemberForm,
                      permissions: { ...newMemberForm.permissions, can_view_gst: e.target.checked },
                    })
                  }
                  className="rounded text-brand"
                />
                <span>GST Returns &amp; Filing Hub</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newMemberForm.permissions.can_view_banking}
                  onChange={(e) =>
                    setNewMemberForm({
                      ...newMemberForm,
                      permissions: { ...newMemberForm.permissions, can_view_banking: e.target.checked },
                    })
                  }
                  className="rounded text-brand"
                />
                <span>Bank Accounts &amp; Liquidity</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newMemberForm.permissions.can_manage_payroll}
                  onChange={(e) =>
                    setNewMemberForm({
                      ...newMemberForm,
                      permissions: { ...newMemberForm.permissions, can_manage_payroll: e.target.checked },
                    })
                  }
                  className="rounded text-brand"
                />
                <span>Manage Payroll &amp; Compensation</span>
              </label>
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t border-slate-200">
            <Button
              suppressHydrationWarning
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIsNewMemberModalOpen(false)}
            >
              Cancel
            </Button>
            <Button suppressHydrationWarning type="submit" variant="tally" size="sm" className="font-bold">
              Onboard Employee
            </Button>
          </div>
        </form>
      </Modal>

      {/* ============================================================ */}
      {/* MODAL: INVITATION LINK GENERATED                             */}
      {/* ============================================================ */}
      {createdInviteInfo && (
        <Modal
          isOpen={!!createdInviteInfo}
          onClose={() => setCreatedInviteInfo(null)}
          title="Workbench Invitation Link Ready"
          description="A secure cryptographic invite has been generated for your team member"
        >
          <div className="space-y-4 font-sans text-xs">
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-xs">Invite Created Successfully</p>
                <p className="text-[11px] text-emerald-700 mt-0.5">
                  Invited <strong className="font-mono">{createdInviteInfo.email}</strong> as{" "}
                  <span className="font-bold uppercase tracking-wider px-1.5 py-0.5 bg-emerald-200/60 rounded text-[10px]">
                    {createdInviteInfo.role}
                  </span>
                </p>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                Shareable Invitation URL (Valid for 7 Days)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={createdInviteInfo.inviteUrl}
                  className="flex-1 bg-slate-100 border border-slate-300 rounded-lg px-2.5 py-2 text-[11px] font-mono text-slate-800 select-all"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="tally"
                  className="font-bold shrink-0"
                  onClick={() => {
                    navigator.clipboard.writeText(createdInviteInfo.inviteUrl);
                    setCopiedLink(true);
                    setTimeout(() => setCopiedLink(false), 2000);
                  }}
                >
                  {copiedLink ? (
                    <>
                      <Check className="w-3.5 h-3.5 mr-1" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 mr-1" />
                      Copy Link
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-[10px] text-slate-500 space-y-1">
              <p>
                <strong>Token:</strong> <span className="font-mono">{createdInviteInfo.token}</span>
              </p>
              <p>
                When your colleague opens this link, they will instantly enter your organizational workbench with their assigned role and permission matrix.
              </p>
            </div>

            <div className="pt-2 flex justify-end">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setCreatedInviteInfo(null)}
              >
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ============================================================ */}
      {/* MODAL: ADD INTER/INTRA TASK TO DEPARTMENT                     */}
      {/* ============================================================ */}
      <Modal
        isOpen={isAddTaskModalOpen}
        onClose={() => setIsAddTaskModalOpen(false)}
        title={`Add Task — ${selectedDeptForTask?.name || "Department"}`}
        description="Create an internal departmental or cross-departmental collaborative deliverable"
      >
        <form onSubmit={handleAddTask} className="space-y-3 font-sans text-xs">
          <Input
            label="Task Title"
            placeholder="e.g. Annual IT Capex Reconciliation"
            value={taskForm.title}
            onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                Task Scope Type
              </label>
              <select
                suppressHydrationWarning
                value={taskForm.type}
                onChange={(e) =>
                  setTaskForm({ ...taskForm, type: e.target.value as "intra" | "inter" })
                }
                className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-brand focus:outline-none"
              >
                <option value="intra">Intra-Department (Internal Team)</option>
                <option value="inter">Inter-Department (Cross-Team Collaboration)</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                Priority Level
              </label>
              <select
                suppressHydrationWarning
                value={taskForm.priority}
                onChange={(e) =>
                  setTaskForm({ ...taskForm, priority: e.target.value as DepartmentTask["priority"] })
                }
                className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-brand focus:outline-none"
              >
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>

          {taskForm.type === "inter" && (
            <div>
              <label className="block text-[10px] font-bold uppercase text-purple-700 mb-1">
                Collaborating Target Department
              </label>
              <select
                suppressHydrationWarning
                value={taskForm.target_department_id}
                onChange={(e) => setTaskForm({ ...taskForm, target_department_id: e.target.value })}
                className="w-full rounded border border-purple-300 bg-purple-50/40 px-2.5 py-1.5 text-xs text-slate-800 focus:border-purple-500 focus:outline-none"
                required
              >
                <option value="">— Select Target Department —</option>
                {departments
                  .filter((d) => d.id !== selectedDeptForTask?.id)
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.code})
                    </option>
                  ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                Assigned Employee
              </label>
              <select
                suppressHydrationWarning
                value={taskForm.assigned_to_id}
                onChange={(e) => setTaskForm({ ...taskForm, assigned_to_id: e.target.value })}
                className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-brand focus:outline-none"
                required
              >
                <option value="">— Select Assignee —</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.department_name})
                  </option>
                ))}
              </select>
            </div>

            <Input
              label="Due Date"
              type="date"
              value={taskForm.due_date}
              onChange={(e) => setTaskForm({ ...taskForm, due_date: e.target.value })}
              required
            />
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t border-slate-200">
            <Button
              suppressHydrationWarning
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIsAddTaskModalOpen(false)}
            >
              Cancel
            </Button>
            <Button suppressHydrationWarning type="submit" variant="tally" size="sm" className="font-bold">
              Assign Task
            </Button>
          </div>
        </form>
      </Modal>

      {/* ============================================================ */}
      {/* MODAL: MANAGE SELECTIVE ACCESS & PERMISSIONS                 */}
      {/* ============================================================ */}
      {selectedMemberForAccess && (
        <Modal
          isOpen={isAccessModalOpen}
          onClose={() => setIsAccessModalOpen(false)}
          title={`Configure Access — ${selectedMemberForAccess.name}`}
          description="Owner-decided granular platform rights and security visibility"
        >
          <div className="space-y-3 font-sans text-xs">
            <div className="p-2.5 rounded bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-900 block">{selectedMemberForAccess.name}</span>
                <span className="text-[11px] text-slate-500">
                  {selectedMemberForAccess.designation} • {selectedMemberForAccess.department_name}
                </span>
              </div>
              <Badge variant={selectedMemberForAccess.is_owner ? "teal" : "default"}>
                {selectedMemberForAccess.role.toUpperCase()}
              </Badge>
            </div>

            {selectedMemberForAccess.is_owner ? (
              <div className="p-3 rounded bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                <span>
                  The License Prime Owner holds permanent immutable root permissions. These privileges cannot be restricted.
                </span>
              </div>
            ) : (
              <div className="space-y-2">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                    Assign Platform Role
                  </label>
                  <select
                    suppressHydrationWarning
                    value={selectedMemberForAccess.role}
                    onChange={(e) =>
                      setSelectedMemberForAccess({
                        ...selectedMemberForAccess,
                        role: e.target.value as EmployeeMember["role"],
                      })
                    }
                    className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-brand focus:outline-none"
                  >
                    <option value="member">Regular Member (Minimal Scope)</option>
                    <option value="accountant">Accountant (General Ledger &amp; GST)</option>
                    <option value="manager">Department Manager (Team Oversight)</option>
                    <option value="admin">System Admin (Full Functional Access)</option>
                  </select>
                </div>

                <div className="space-y-1.5 pt-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                    Selective Module Access Toggles
                  </div>

                  {[
                    { key: "can_view_vouchers", label: "View Accounting Vouchers (F4—F9)" },
                    { key: "can_create_vouchers", label: "Create & Post Authoritative Vouchers" },
                    { key: "can_view_banking", label: "Bank Account & Liquid Cash Ledgers" },
                    { key: "can_view_financial_reports", label: "Balance Sheet & Profit/Loss Financial Statements" },
                    { key: "can_view_gst", label: "GST Tax Breakdown & Filing Hub" },
                    { key: "can_manage_parties", label: "Customer & Vendor Counterparties Master" },
                    { key: "can_manage_payroll", label: "Personnel Payroll, CTC & Compensation" },
                    { key: "can_access_audit_log", label: "Cryptographic Audit Trail & Security Logs" },
                  ].map((perm) => (
                    <label
                      key={perm.key}
                      className="flex items-center justify-between p-2 rounded hover:bg-slate-50 border border-slate-200 cursor-pointer"
                    >
                      <span className="text-slate-800 font-medium">{perm.label}</span>
                      <input
                        type="checkbox"
                        checked={
                          (selectedMemberForAccess.permissions as any)[perm.key] || false
                        }
                        onChange={(e) =>
                          setSelectedMemberForAccess({
                            ...selectedMemberForAccess,
                            permissions: {
                              ...selectedMemberForAccess.permissions,
                              [perm.key]: e.target.checked,
                            },
                          })
                        }
                        className="rounded text-brand h-4 w-4"
                      />
                    </label>
                  ))}
                </div>

                <div className="pt-3 flex justify-end gap-2 border-t border-slate-200">
                  <Button
                    suppressHydrationWarning
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setIsAccessModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    suppressHydrationWarning
                    type="button"
                    variant="tally"
                    size="sm"
                    onClick={() =>
                      handleUpdatePermissions(
                        selectedMemberForAccess.role,
                        selectedMemberForAccess.permissions
                      )
                    }
                    className="font-bold"
                  >
                    Save Permissions
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ============================================================ */}
      {/* MODAL: GRANT PERFORMANCE BONUS                               */}
      {/* ============================================================ */}
      {selectedMemberForBonus && (
        <Modal
          isOpen={isBonusModalOpen}
          onClose={() => setIsBonusModalOpen(false)}
          title={`Grant Bonus — ${selectedMemberForBonus.name}`}
          description="Accrue performance incentive to employee's compensation ledger"
        >
          <form onSubmit={handleGrantBonus} className="space-y-3 font-sans text-xs">
            <div className="p-2.5 rounded bg-slate-50 border border-slate-200">
              <div className="text-[11px] text-slate-500">
                Department: <strong>{selectedMemberForBonus.department_name}</strong>
              </div>
              <div className="text-[11px] text-slate-500">
                Current Accrued Bonus:{" "}
                <strong className="text-purple-700">
                  {formatINR(selectedMemberForBonus.compensation.bonuses_accrued)}
                </strong>
              </div>
            </div>

            <Input
              label="Bonus Incentive Amount (INR)"
              type="number"
              value={bonusAmountInput}
              onChange={(e) => setBonusAmountInput(e.target.value)}
              required
            />

            <div className="pt-2 flex justify-end gap-2 border-t border-slate-200">
              <Button
                suppressHydrationWarning
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setIsBonusModalOpen(false)}
              >
                Cancel
              </Button>
              <Button suppressHydrationWarning type="submit" variant="tally" size="sm" className="font-bold">
                Credit Bonus
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ============================================================ */}
      {/* MODAL: MEMBER ASSIGNED TASKS                                  */}
      {/* ============================================================ */}
      {selectedMemberForTasks && (
        <Modal
          isOpen={!!selectedMemberForTasks}
          onClose={() => setSelectedMemberForTasks(null)}
          title={`Assigned Tasks — ${selectedMemberForTasks.name}`}
          description={`Active departmental & cross-functional deliverables assigned to ${selectedMemberForTasks.designation} (${selectedMemberForTasks.department_name})`}
        >
          <div className="space-y-3 font-sans text-xs">
            {(() => {
              const assignedTasks = departments.flatMap((d) =>
                d.tasks
                  .filter((t) => t.assigned_to_id === selectedMemberForTasks.id || t.assigned_to_name === selectedMemberForTasks.name)
                  .map((t) => ({ ...t, deptName: d.name, deptCode: d.code, deptId: d.id }))
              );

              if (assignedTasks.length === 0) {
                return (
                  <div className="p-6 text-center text-slate-400 italic bg-slate-50 rounded border border-dashed border-slate-200">
                    No active tasks assigned to this employee.
                  </div>
                );
              }

              return (
                <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                  {assignedTasks.map((task) => (
                    <div
                      key={task.id}
                      className="p-3 rounded border border-slate-200 bg-white hover:border-slate-300 space-y-2 shadow-2xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 border border-slate-200">
                              {task.deptCode}
                            </span>
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${
                                task.type === "inter"
                                  ? "bg-purple-100 text-purple-800 border border-purple-200"
                                  : "bg-blue-50 text-blue-700 border border-blue-200"
                              }`}
                            >
                              {task.type === "inter" ? `Inter ⇄ ${task.target_department_name || "Target"}` : "Intra"}
                            </span>
                            <span
                              className={`text-[9px] font-mono font-bold px-1 py-0.2 rounded uppercase ${
                                task.priority === "urgent"
                                  ? "bg-rose-100 text-rose-700"
                                  : task.priority === "high"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {task.priority}
                            </span>
                          </div>
                          <h4 className="font-bold text-slate-900 text-xs mt-1">{task.title}</h4>
                          {task.description && (
                            <p className="text-[11px] text-slate-500 mt-0.5">{task.description}</p>
                          )}
                        </div>

                        <button
                          suppressHydrationWarning
                          onClick={async () => {
                            const nextStatus =
                              task.status === "in_progress"
                                ? "completed"
                                : task.status === "completed"
                                ? "todo"
                                : "in_progress";
                            await departmentsService.updateTaskStatus(orgId, task.deptId, task.id, nextStatus);
                            refreshData();
                          }}
                          className={`px-2 py-1 rounded text-[10px] font-bold uppercase transition-colors shrink-0 ${
                            task.status === "completed"
                              ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                              : "bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100"
                          }`}
                        >
                          {task.status === "completed" ? "✓ Completed" : "In Progress"}
                        </button>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-400">Reassign:</span>
                          <select
                            suppressHydrationWarning
                            value={task.assigned_to_id || ""}
                            onChange={async (e) => {
                              const newAssigneeId = e.target.value;
                              const newAssignee = members.find((m) => m.id === newAssigneeId);
                              if (newAssignee) {
                                await departmentsService.assignTaskToMember(
                                  orgId,
                                  task.deptId,
                                  task.id,
                                  newAssignee.id,
                                  newAssignee.name
                                );
                                refreshData();
                              }
                            }}
                            className="text-[10px] font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded px-1.5 py-0.5 focus:border-brand focus:outline-none cursor-pointer"
                          >
                            {members.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name} ({m.designation.split(" ")[0]})
                              </option>
                            ))}
                          </select>
                        </div>
                        <span className="font-mono text-[10px]">Due Date: {task.due_date}</span>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}

            <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
              <Button
                suppressHydrationWarning
                variant="outline"
                size="sm"
                onClick={() => {
                  const memberDept =
                    departments.find((d) => d.id === selectedMemberForTasks.department_id) ||
                    departments[0];
                  setSelectedDeptForTask(memberDept);
                  setTaskForm((prev) => ({ ...prev, assigned_to_id: selectedMemberForTasks.id }));
                  setSelectedMemberForTasks(null);
                  setIsAddTaskModalOpen(true);
                }}
                className="gap-1 font-bold text-[11px] text-brand hover:bg-teal-50"
              >
                <Plus className="h-3.5 w-3.5" /> Assign New Task
              </Button>

              <Button
                suppressHydrationWarning
                variant="secondary"
                size="sm"
                onClick={() => setSelectedMemberForTasks(null)}
              >
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
