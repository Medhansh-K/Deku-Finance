import { formatINR } from "@/lib/formatters/currency";
import { departmentsApi, membersApi, payrollApi } from "@/api/endpoints";
import { logUserActivity } from "@/lib/logging/activity-logger";

export type PlatformModule =
  | "vouchers"
  | "banking"
  | "reports"
  | "gst"
  | "parties"
  | "departments_members"
  | "payroll"
  | "audit";

export interface EmployeePermissions {
  can_view_vouchers: boolean;
  can_create_vouchers: boolean;
  can_view_banking: boolean;
  can_view_financial_reports: boolean;
  can_view_gst: boolean;
  can_manage_parties: boolean;
  can_manage_payroll: boolean;
  can_access_audit_log: boolean;
}

export interface CompensationDetails {
  ctc_annual: number; // e.g. ₹ 36,00,000
  monthly_gross: number; // e.g. ₹ 3,00,000
  monthly_net: number; // e.g. ₹ 2,42,000
  tds_deduction_monthly: number; // e.g. ₹ 40,000
  epf_monthly: number; // e.g. ₹ 18,000
  reimbursements_pending: number; // e.g. ₹ 14,500
  reimbursements_approved: number; // e.g. ₹ 42,000
  bonuses_accrued: number; // e.g. ₹ 2,50,000
  last_payroll_date: string;
  payroll_status: "processed" | "pending" | "hold";
  bank_account_masked: string;
  pan: string;
}

export interface EmployeeMember {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar_url?: string;
  designation: string;
  department_id: string;
  department_name: string;
  is_owner: boolean; // Prime employee holding license rights
  is_lead: boolean;
  joining_date: string;
  role: "owner" | "cfo" | "admin" | "accountant" | "analyst" | "auditor" | "viewer" | "manager" | "member";
  status: "active" | "on_leave" | "suspended";
  permissions: EmployeePermissions;
  compensation: CompensationDetails;
}

export interface DepartmentTask {
  id: string;
  title: string;
  type: "intra" | "inter"; // Intra-department or Inter-department
  priority: "low" | "medium" | "high" | "urgent";
  status: "todo" | "in_progress" | "review" | "completed";
  assigned_to_name: string;
  assigned_to_id: string;
  source_department_id: string;
  target_department_id?: string; // For inter-departmental tasks
  target_department_name?: string;
  due_date: string;
  description?: string;
}

export interface Department {
  id: string;
  name: string;
  code: string; // e.g. "FIN", "ENG", "OPS", "SAL"
  description: string;
  lead_id: string;
  lead_name: string;
  lead_designation: string;
  budget_allocated: number;
  budget_utilized: number;
  currency: string;
  fiscal_year: string;
  tasks: DepartmentTask[];
  created_at: string;
}

const DEFAULT_DEPARTMENTS: Department[] = [
  {
    id: "dept-mgmt",
    name: "Executive & Corporate Governance",
    code: "MGMT",
    description: "Firm-wide leadership, license administration and strategic capital allocation",
    lead_id: "emp-prime-001",
    lead_name: "Medhansh K. (License Owner)",
    lead_designation: "Founder & Chief Executive Officer",
    budget_allocated: 4500000,
    budget_utilized: 2450000,
    currency: "INR",
    fiscal_year: "2026-27",
    created_at: "2026-04-01",
    tasks: [
      {
        id: "task-m-1",
        title: "Annual Deku License Rights & Compliance Audit",
        type: "intra",
        priority: "urgent",
        status: "in_progress",
        assigned_to_name: "Medhansh K. (License Owner)",
        assigned_to_id: "emp-prime-001",
        source_department_id: "dept-mgmt",
        due_date: "2026-11-15",
        description: "Review multi-company license allocation and owner cryptographic signature",
      },
      {
        id: "task-m-2",
        title: "Q3 Departmental Budget Allocation & Headcount Approval",
        type: "inter",
        priority: "high",
        status: "in_progress",
        assigned_to_name: "Medhansh K. (License Owner)",
        assigned_to_id: "emp-prime-001",
        source_department_id: "dept-mgmt",
        target_department_id: "dept-fin",
        target_department_name: "Finance & Accounts",
        due_date: "2026-10-31",
        description: "Align fiscal limits between executive governance and financial ledgers",
      },
    ],
  },
  {
    id: "dept-fin",
    name: "Finance & Accounts",
    code: "FIN",
    description: "ALERX double-entry ledger management, GST filing, cashflow liquidity and audit compliance",
    lead_id: "emp-002",
    lead_name: "Rohan Sharma",
    lead_designation: "VP of Finance & Chief Accountant",
    budget_allocated: 6500000,
    budget_utilized: 3840000,
    currency: "INR",
    fiscal_year: "2026-27",
    created_at: "2026-04-01",
    tasks: [
      {
        id: "task-f-1",
        title: "GSTR-1 & GSTR-3B Monthly Return Filing Reconciliation",
        type: "intra",
        priority: "urgent",
        status: "in_progress",
        assigned_to_name: "Priya Iyer",
        assigned_to_id: "emp-003",
        source_department_id: "dept-fin",
        due_date: "2026-10-25",
        description: "Reconcile outward sales invoices with B2B e-Invoices in GSTN portal",
      },
      {
        id: "task-f-2",
        title: "Cross-Department Cloud Infra AWS Capex Verification",
        type: "inter",
        priority: "high",
        status: "in_progress",
        assigned_to_name: "Rohan Sharma",
        assigned_to_id: "emp-002",
        source_department_id: "dept-fin",
        target_department_id: "dept-eng",
        target_department_name: "Engineering & Infrastructure",
        due_date: "2026-10-28",
        description: "Verify AWS compute charges against engineering server scaling logs",
      },
    ],
  },
  {
    id: "dept-eng",
    name: "Engineering & Infrastructure",
    code: "ENG",
    description: "High-frequency financial kernel, Rust Axum backend microservices and cryptographic audit trails",
    lead_id: "emp-004",
    lead_name: "Vikramaditya Sen",
    lead_designation: "Head of Engineering",
    budget_allocated: 12000000,
    budget_utilized: 8420000,
    currency: "INR",
    fiscal_year: "2026-27",
    created_at: "2026-04-01",
    tasks: [
      {
        id: "task-e-1",
        title: "Rust Axum PostgreSQL Connection Pooling Optimization",
        type: "intra",
        priority: "high",
        status: "completed",
        assigned_to_name: "Rahul Deshmukh",
        assigned_to_id: "emp-006",
        source_department_id: "dept-eng",
        due_date: "2026-10-18",
        description: "Benchmark latency under 5,000 concurrent ALERX voucher writes",
      },
      {
        id: "task-e-2",
        title: "Automated Bank Statement OCR Integration with Finance",
        type: "inter",
        priority: "medium",
        status: "in_progress",
        assigned_to_name: "Ananya Nair",
        assigned_to_id: "emp-005",
        source_department_id: "dept-eng",
        target_department_id: "dept-fin",
        target_department_name: "Finance & Accounts",
        due_date: "2026-11-10",
        description: "Expose document extraction endpoints for accounting voucher desk",
      },
    ],
  },
  {
    id: "dept-sal",
    name: "Sales & Client Operations",
    code: "SAL",
    description: "Enterprise customer acquisition, B2B invoicing pipeline, counterparty SLA and revenue growth",
    lead_id: "emp-007",
    lead_name: "Neha Kapur",
    lead_designation: "Director of Enterprise Sales",
    budget_allocated: 5000000,
    budget_utilized: 3120000,
    currency: "INR",
    fiscal_year: "2026-27",
    created_at: "2026-04-01",
    tasks: [
      {
        id: "task-s-1",
        title: "Apex Enterprise Systems Inward Dues Clearance",
        type: "inter",
        priority: "urgent",
        status: "in_progress",
        assigned_to_name: "Neha Kapur",
        assigned_to_id: "emp-007",
        source_department_id: "dept-sal",
        target_department_id: "dept-fin",
        target_department_name: "Finance & Accounts",
        due_date: "2026-10-24",
        description: "Coordinate with finance team on ₹50,000 IMPS receipt settlement",
      },
    ],
  },
];

const DEFAULT_MEMBERS: EmployeeMember[] = [
  {
    id: "emp-prime-001",
    name: "Medhansh K.",
    email: "founder@dekufinance.com",
    phone: "+91 98200 11223",
    designation: "Founder & Chief Executive Officer",
    department_id: "dept-mgmt",
    department_name: "Executive & Corporate Governance",
    is_owner: true, // The Prime Employee holding the License
    is_lead: true,
    joining_date: "2025-01-01",
    role: "owner",
    status: "active",
    permissions: {
      can_view_vouchers: true,
      can_create_vouchers: true,
      can_view_banking: true,
      can_view_financial_reports: true,
      can_view_gst: true,
      can_manage_parties: true,
      can_manage_payroll: true,
      can_access_audit_log: true,
    },
    compensation: {
      ctc_annual: 4800000,
      monthly_gross: 400000,
      monthly_net: 318000,
      tds_deduction_monthly: 62000,
      epf_monthly: 20000,
      reimbursements_pending: 18500,
      reimbursements_approved: 75000,
      bonuses_accrued: 500000,
      last_payroll_date: "2026-10-01",
      payroll_status: "processed",
      bank_account_masked: "HDFC •••• 9012",
      pan: "AAAPK1029M",
    },
  },
  {
    id: "emp-002",
    name: "Rohan Sharma",
    email: "rohan.sharma@dekufinance.com",
    phone: "+91 98201 33445",
    designation: "VP of Finance & Chief Accountant",
    department_id: "dept-fin",
    department_name: "Finance & Accounts",
    is_owner: false,
    is_lead: true,
    joining_date: "2025-03-15",
    role: "accountant",
    status: "active",
    permissions: {
      can_view_vouchers: true,
      can_create_vouchers: true,
      can_view_banking: true,
      can_view_financial_reports: true,
      can_view_gst: true,
      can_manage_parties: true,
      can_manage_payroll: true,
      can_access_audit_log: true,
    },
    compensation: {
      ctc_annual: 2800000,
      monthly_gross: 233333,
      monthly_net: 188000,
      tds_deduction_monthly: 31000,
      epf_monthly: 14333,
      reimbursements_pending: 8200,
      reimbursements_approved: 34000,
      bonuses_accrued: 180000,
      last_payroll_date: "2026-10-01",
      payroll_status: "processed",
      bank_account_masked: "ICICI •••• 4421",
      pan: "BPNRS4829K",
    },
  },
  {
    id: "emp-003",
    name: "Priya Iyer",
    email: "priya.iyer@dekufinance.com",
    phone: "+91 98202 55667",
    designation: "Senior Tax & GST Specialist",
    department_id: "dept-fin",
    department_name: "Finance & Accounts",
    is_owner: false,
    is_lead: false,
    joining_date: "2025-06-01",
    role: "accountant",
    status: "active",
    permissions: {
      can_view_vouchers: true,
      can_create_vouchers: true,
      can_view_banking: false,
      can_view_financial_reports: true,
      can_view_gst: true,
      can_manage_parties: true,
      can_manage_payroll: false,
      can_access_audit_log: false,
    },
    compensation: {
      ctc_annual: 1600000,
      monthly_gross: 133333,
      monthly_net: 112000,
      tds_deduction_monthly: 12500,
      epf_monthly: 8833,
      reimbursements_pending: 3400,
      reimbursements_approved: 19000,
      bonuses_accrued: 95000,
      last_payroll_date: "2026-10-01",
      payroll_status: "processed",
      bank_account_masked: "SBI •••• 8820",
      pan: "CPIIY9012L",
    },
  },
  {
    id: "emp-004",
    name: "Vikramaditya Sen",
    email: "vikram.sen@dekufinance.com",
    phone: "+91 98203 77889",
    designation: "Head of Engineering",
    department_id: "dept-eng",
    department_name: "Engineering & Infrastructure",
    is_owner: false,
    is_lead: true,
    joining_date: "2025-02-10",
    role: "manager",
    status: "active",
    permissions: {
      can_view_vouchers: false,
      can_create_vouchers: false,
      can_view_banking: false,
      can_view_financial_reports: false,
      can_view_gst: false,
      can_manage_parties: false,
      can_manage_payroll: false,
      can_access_audit_log: true,
    },
    compensation: {
      ctc_annual: 3600000,
      monthly_gross: 300000,
      monthly_net: 242000,
      tds_deduction_monthly: 42000,
      epf_monthly: 16000,
      reimbursements_pending: 12400,
      reimbursements_approved: 58000,
      bonuses_accrued: 300000,
      last_payroll_date: "2026-10-01",
      payroll_status: "processed",
      bank_account_masked: "KOTAK •••• 1194",
      pan: "DSVSE2019P",
    },
  },
  {
    id: "emp-005",
    name: "Ananya Nair",
    email: "ananya.nair@dekufinance.com",
    phone: "+91 98204 99001",
    designation: "Fullstack Systems Engineer",
    department_id: "dept-eng",
    department_name: "Engineering & Infrastructure",
    is_owner: false,
    is_lead: false,
    joining_date: "2025-08-01",
    role: "member",
    status: "active",
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
    compensation: {
      ctc_annual: 2000000,
      monthly_gross: 166667,
      monthly_net: 138000,
      tds_deduction_monthly: 18000,
      epf_monthly: 10667,
      reimbursements_pending: 4800,
      reimbursements_approved: 12000,
      bonuses_accrued: 110000,
      last_payroll_date: "2026-10-01",
      payroll_status: "processed",
      bank_account_masked: "AXIS •••• 7731",
      pan: "FANAI3341Q",
    },
  },
  {
    id: "emp-006",
    name: "Rahul Deshmukh",
    email: "rahul.deshmukh@dekufinance.com",
    phone: "+91 98205 11234",
    designation: "DevOps & Cloud Reliability Engineer",
    department_id: "dept-eng",
    department_name: "Engineering & Infrastructure",
    is_owner: false,
    is_lead: false,
    joining_date: "2025-09-15",
    role: "member",
    status: "active",
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
    compensation: {
      ctc_annual: 1800000,
      monthly_gross: 150000,
      monthly_net: 125000,
      tds_deduction_monthly: 15500,
      epf_monthly: 9500,
      reimbursements_pending: 0,
      reimbursements_approved: 22000,
      bonuses_accrued: 85000,
      last_payroll_date: "2026-10-01",
      payroll_status: "processed",
      bank_account_masked: "HDFC •••• 5599",
      pan: "GARDM7788S",
    },
  },
  {
    id: "emp-007",
    name: "Neha Kapur",
    email: "neha.kapur@dekufinance.com",
    phone: "+91 98206 33456",
    designation: "Director of Enterprise Sales",
    department_id: "dept-sal",
    department_name: "Sales & Client Operations",
    is_owner: false,
    is_lead: true,
    joining_date: "2025-04-01",
    role: "manager",
    status: "active",
    permissions: {
      can_view_vouchers: true,
      can_create_vouchers: false,
      can_view_banking: false,
      can_view_financial_reports: false,
      can_view_gst: false,
      can_manage_parties: true,
      can_manage_payroll: false,
      can_access_audit_log: false,
    },
    compensation: {
      ctc_annual: 3200000,
      monthly_gross: 266667,
      monthly_net: 215000,
      tds_deduction_monthly: 37000,
      epf_monthly: 14667,
      reimbursements_pending: 22500,
      reimbursements_approved: 65000,
      bonuses_accrued: 350000,
      last_payroll_date: "2026-10-01",
      payroll_status: "processed",
      bank_account_masked: "ICICI •••• 9912",
      pan: "HNKAP5544T",
    },
  },
];

/**
 * Database <-> Domain Model Mappers
 */
export function mapDbDepartmentToModel(row: any): Department {
  const rawTasks = row.department_tasks || [];
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    description: row.description || "",
    lead_id: row.lead_id || "",
    lead_name: row.lead_name || "Unassigned Lead",
    lead_designation: row.lead_designation || "Department Lead",
    budget_allocated: Number(row.budget_allocated) || 0,
    budget_utilized: Number(row.budget_utilized) || 0,
    currency: row.currency || "INR",
    fiscal_year: row.fiscal_year || "2026-27",
    created_at: row.created_at ? row.created_at.split("T")[0] : "2026-04-01",
    tasks: rawTasks.map((t: any) => ({
      id: t.id,
      title: t.title,
      type: t.task_type || "intra",
      priority: t.priority || "medium",
      status: t.status || "todo",
      assigned_to_name: t.assigned_to_name || "Assigned Member",
      assigned_to_id: t.assigned_to_id || "",
      source_department_id: row.id,
      target_department_id: t.target_department_id,
      target_department_name: t.target_department_name,
      due_date: t.due_date || "",
      description: t.description || "",
    })),
  };
}

export function mapDbEmployeeToModel(row: any): EmployeeMember {
  const deptName =
    row.departments?.name ||
    (row.department_id ? "Assigned Department" : "General Firm");
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone || "",
    avatar_url: row.avatar_url,
    designation: row.designation,
    department_id: row.department_id || "",
    department_name: deptName,
    is_owner: Boolean(row.is_owner),
    is_lead: Boolean(row.is_lead),
    joining_date: row.joining_date || "2026-04-01",
    role: row.role || "member",
    status: row.status || "active",
    permissions: row.permissions || {
      can_view_vouchers: false,
      can_create_vouchers: false,
      can_view_banking: false,
      can_view_financial_reports: false,
      can_view_gst: false,
      can_manage_parties: false,
      can_manage_payroll: false,
      can_access_audit_log: false,
    },
    compensation: {
      ctc_annual: Number(row.ctc_annual) || 0,
      monthly_gross: Number(row.monthly_gross) || 0,
      monthly_net: Number(row.monthly_net) || 0,
      tds_deduction_monthly: Number(row.tds_deduction_monthly) || 0,
      epf_monthly: Number(row.epf_monthly) || 0,
      reimbursements_pending: Number(row.reimbursements_pending) || 0,
      reimbursements_approved: Number(row.reimbursements_approved) || 0,
      bonuses_accrued: Number(row.bonuses_accrued) || 0,
      last_payroll_date: row.last_payroll_date || "2026-10-01",
      payroll_status: row.payroll_status || "pending",
      bank_account_masked: row.bank_account_masked || "•••• ••••",
      pan: row.pan || "",
    },
  };
}

/**
 * Storage helpers with custom reactivity
 */
function getStorageKey(prefix: string, orgId: string): string {
  return `deku_${prefix}_${orgId || "default"}`;
}

export const departmentsService = {
  // Synchronous cache getters for instant rendering without layout shift
  getDepartments(orgId: string): Department[] {
    if (typeof window === "undefined") return DEFAULT_DEPARTMENTS;
    const key = getStorageKey("departments", orgId);
    const data = localStorage.getItem(key);
    if (!data) {
      localStorage.setItem(key, JSON.stringify(DEFAULT_DEPARTMENTS));
      return DEFAULT_DEPARTMENTS;
    }
    try {
      return JSON.parse(data);
    } catch {
      return DEFAULT_DEPARTMENTS;
    }
  },

  saveDepartments(orgId: string, departments: Department[]) {
    if (typeof window === "undefined") return;
    const key = getStorageKey("departments", orgId);
    localStorage.setItem(key, JSON.stringify(departments));
    window.dispatchEvent(new CustomEvent("deku_departments_changed"));
  },

  getMembers(orgId: string): EmployeeMember[] {
    if (typeof window === "undefined") return DEFAULT_MEMBERS;
    const key = getStorageKey("members", orgId);
    const data = localStorage.getItem(key);
    if (!data) {
      localStorage.setItem(key, JSON.stringify(DEFAULT_MEMBERS));
      return DEFAULT_MEMBERS;
    }
    try {
      return JSON.parse(data);
    } catch {
      return DEFAULT_MEMBERS;
    }
  },

  saveMembers(orgId: string, members: EmployeeMember[]) {
    if (typeof window === "undefined") return;
    const key = getStorageKey("members", orgId);
    localStorage.setItem(key, JSON.stringify(members));
    window.dispatchEvent(new CustomEvent("deku_members_changed"));
  },

  // Asynchronous live API fetchers
  async fetchDepartments(orgId: string): Promise<Department[]> {
    try {
      const res = await departmentsApi.list(orgId);
      if (res.data && Array.isArray(res.data) && res.data.length > 0) {
        const mapped = res.data.map(mapDbDepartmentToModel);
        this.saveDepartments(orgId, mapped);
        return mapped;
      }
    } catch (err) {
      console.warn("Using local cache, could not connect to departments API:", err);
    }
    return this.getDepartments(orgId);
  },

  async fetchMembers(orgId: string): Promise<EmployeeMember[]> {
    try {
      const res = await membersApi.list(orgId);
      if (res.data && Array.isArray(res.data) && res.data.length > 0) {
        const mapped = res.data.map(mapDbEmployeeToModel);
        this.saveMembers(orgId, mapped);
        return mapped;
      }
    } catch (err) {
      console.warn("Using local cache, could not connect to members API:", err);
    }
    return this.getMembers(orgId);
  },

  async addDepartment(
    orgId: string,
    deptData: Omit<Department, "id" | "tasks" | "created_at"> & {
      initialTaskTitle?: string;
    }
  ): Promise<Department> {
    const departments = this.getDepartments(orgId);
    let createdId = `dept-${Date.now()}`;

    try {
      const res = await departmentsApi.create(orgId, {
        name: deptData.name,
        code: deptData.code.toUpperCase(),
        description: deptData.description,
        lead_id: deptData.lead_id,
        lead_name: deptData.lead_name,
        lead_designation: deptData.lead_designation,
        budget_allocated: deptData.budget_allocated,
        currency: "INR",
        fiscal_year: deptData.fiscal_year || "2026-27",
      });

      if (res.data && Array.isArray(res.data) && res.data[0]?.id) {
        createdId = res.data[0].id;
      }

      if (deptData.initialTaskTitle) {
        await departmentsApi.createTask(orgId, createdId, {
          title: deptData.initialTaskTitle,
          task_type: "intra",
          priority: "high",
          status: "in_progress",
          assigned_to_name: deptData.lead_name,
          assigned_to_id: deptData.lead_id,
          due_date: new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0],
        });
      }
    } catch (err) {
      console.warn("API addDepartment call failed, persisting to cache:", err);
    }

    const newDept: Department = {
      id: createdId,
      name: deptData.name,
      code: deptData.code.toUpperCase(),
      description: deptData.description,
      lead_id: deptData.lead_id,
      lead_name: deptData.lead_name,
      lead_designation: deptData.lead_designation,
      budget_allocated: deptData.budget_allocated,
      budget_utilized: 0,
      currency: "INR",
      fiscal_year: deptData.fiscal_year || "2026-27",
      created_at: new Date().toISOString().split("T")[0],
      tasks: deptData.initialTaskTitle
        ? [
            {
              id: `task-${Date.now()}`,
              title: deptData.initialTaskTitle,
              type: "intra",
              priority: "high",
              status: "in_progress",
              assigned_to_name: deptData.lead_name,
              assigned_to_id: deptData.lead_id,
              source_department_id: createdId,
              due_date: new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0],
            },
          ]
        : [],
    };

    departments.push(newDept);
    this.saveDepartments(orgId, departments);
    return newDept;
  },

  async addTaskToDepartment(
    orgId: string,
    deptId: string,
    task: Omit<DepartmentTask, "id">
  ): Promise<void> {
    const departments = this.getDepartments(orgId);
    const targetDept = departments.find((d) => d.id === deptId);
    if (!targetDept) return;

    let taskId = `task-${Date.now()}`;
    try {
      const res = await departmentsApi.createTask(orgId, deptId, {
        title: task.title,
        task_type: task.type,
        priority: task.priority,
        status: task.status,
        assigned_to_name: task.assigned_to_name,
        assigned_to_id: task.assigned_to_id,
        target_department_id: task.target_department_id,
        target_department_name: task.target_department_name,
        due_date: task.due_date,
        description: task.description,
      });
      if (res.data && Array.isArray(res.data) && res.data[0]?.id) {
        taskId = res.data[0].id;
      }
    } catch (err) {
      console.warn("API createTask failed, persisting to cache:", err);
    }

    const newTask: DepartmentTask = {
      ...task,
      id: taskId,
    };

    targetDept.tasks.unshift(newTask);
    this.saveDepartments(orgId, departments);

    logUserActivity({
      category: "DEPARTMENT",
      crud_type: "CREATE",
      action: "Task Created",
      description: `Created ${task.type.toUpperCase()} task '${task.title}' for ${targetDept.name} (Priority: ${task.priority.toUpperCase()})`,
      entity_type: "task",
      entity_id: taskId,
      organisation_id: orgId,
      status: "info",
      metadata: {
        taskType: task.type,
        priority: task.priority,
        department: targetDept.name,
        assignedTo: task.assigned_to_name,
      },
    });
  },

  async updateTaskStatus(
    orgId: string,
    deptId: string,
    taskId: string,
    status: DepartmentTask["status"]
  ): Promise<void> {
    const departments = this.getDepartments(orgId);
    const targetDept = departments.find((d) => d.id === deptId);
    if (!targetDept) return;

    const task = targetDept.tasks.find((t) => t.id === taskId);
    if (task) {
      task.status = status;
      this.saveDepartments(orgId, departments);

      logUserActivity({
        category: "DEPARTMENT",
        crud_type: "UPDATE",
        action: "Task Status Updated",
        description: `Task '${task.title}' updated to ${status.toUpperCase().replace("_", " ")}`,
        entity_type: "task",
        entity_id: taskId,
        organisation_id: orgId,
        status: status === "completed" ? "success" : "info",
        metadata: { status, taskTitle: task.title, department: targetDept.name },
      });
    }

    try {
      await departmentsApi.updateTask(orgId, deptId, taskId, { status });
    } catch (err) {
      console.warn("API updateTask failed:", err);
    }
  },

  async assignTaskToMember(
    orgId: string,
    deptId: string,
    taskId: string,
    memberId: string,
    memberName: string
  ): Promise<void> {
    const departments = this.getDepartments(orgId);
    const targetDept = departments.find((d) => d.id === deptId);
    if (!targetDept) return;

    const task = targetDept.tasks.find((t) => t.id === taskId);
    if (task) {
      task.assigned_to_id = memberId;
      task.assigned_to_name = memberName;
      this.saveDepartments(orgId, departments);
    }

    try {
      await departmentsApi.updateTask(orgId, deptId, taskId, {
        assigned_to_id: memberId,
        assigned_to_name: memberName,
      });
    } catch (err) {
      console.warn("API updateTask assignee failed:", err);
    }
  },

  getTasksByMember(
    orgId: string,
    memberId: string
  ): { task: DepartmentTask; dept: Department }[] {
    const departments = this.getDepartments(orgId);
    const results: { task: DepartmentTask; dept: Department }[] = [];
    for (const d of departments) {
      for (const t of d.tasks) {
        if (t.assigned_to_id === memberId) {
          results.push({ task: t, dept: d });
        }
      }
    }
    return results;
  },

  async addEmployee(
    orgId: string,
    empData: Omit<EmployeeMember, "id" | "is_owner">
  ): Promise<EmployeeMember> {
    const members = this.getMembers(orgId);
    let memberId = `emp-${Date.now()}`;

    try {
      const res = await membersApi.create(orgId, {
        name: empData.name,
        email: empData.email,
        phone: empData.phone,
        designation: empData.designation,
        department_id: empData.department_id,
        is_lead: empData.is_lead,
        role: empData.role,
        status: empData.status,
        pan: empData.compensation.pan,
        bank_account_masked: empData.compensation.bank_account_masked,
        permissions: empData.permissions,
        ctc_annual: empData.compensation.ctc_annual,
        monthly_gross: empData.compensation.monthly_gross,
        monthly_net: empData.compensation.monthly_net,
        tds_deduction_monthly: empData.compensation.tds_deduction_monthly,
        epf_monthly: empData.compensation.epf_monthly,
      });
      if (res.data && Array.isArray(res.data) && res.data[0]?.id) {
        memberId = res.data[0].id;
      }
    } catch (err) {
      console.warn("API addMember failed, persisting to cache:", err);
    }

    const newEmp: EmployeeMember = {
      ...empData,
      id: memberId,
      is_owner: false,
    };

    members.push(newEmp);
    this.saveMembers(orgId, members);

    logUserActivity({
      category: "DEPARTMENT",
      crud_type: "CREATE",
      action: "Member Onboarded",
      description: `Onboarded ${newEmp.name} as ${newEmp.designation} (${newEmp.role.toUpperCase()}) with annual CTC of ₹${(newEmp.compensation.ctc_annual).toLocaleString("en-IN")}`,
      entity_type: "member",
      entity_id: memberId,
      organisation_id: orgId,
      status: "success",
      metadata: {
        memberName: newEmp.name,
        designation: newEmp.designation,
        role: newEmp.role,
        departmentId: newEmp.department_id,
      },
    });

    return newEmp;
  },

  async updateEmployeePermissions(
    orgId: string,
    employeeId: string,
    role: EmployeeMember["role"],
    permissions: EmployeePermissions
  ): Promise<void> {
    const members = this.getMembers(orgId);
    const emp = members.find((m) => m.id === employeeId);
    if (!emp) return;

    if (emp.is_owner) {
      emp.role = "owner";
      emp.permissions = {
        can_view_vouchers: true,
        can_create_vouchers: true,
        can_view_banking: true,
        can_view_financial_reports: true,
        can_view_gst: true,
        can_manage_parties: true,
        can_manage_payroll: true,
        can_access_audit_log: true,
      };
    } else {
      emp.role = role;
      emp.permissions = permissions;
    }

    this.saveMembers(orgId, members);

    logUserActivity({
      category: "DEPARTMENT",
      crud_type: "UPDATE",
      action: "Permissions Updated",
      description: `Updated access permissions & role for ${emp.name} to ${emp.role.toUpperCase()}`,
      entity_type: "member",
      entity_id: employeeId,
      organisation_id: orgId,
      status: "info",
      metadata: { role: emp.role, permissions: emp.permissions },
    });

    try {
      await membersApi.updatePermissions(orgId, employeeId, {
        permissions: emp.permissions,
        role: emp.role,
      });
    } catch (err) {
      console.warn("API updatePermissions failed:", err);
    }
  },

  async approveReimbursement(
    orgId: string,
    employeeId: string,
    amount: number
  ): Promise<void> {
    const members = this.getMembers(orgId);
    const emp = members.find((m) => m.id === employeeId);
    if (!emp) return;

    const approvedAmt = Math.min(
      amount,
      emp.compensation.reimbursements_pending
    );
    emp.compensation.reimbursements_pending -= approvedAmt;
    emp.compensation.reimbursements_approved += approvedAmt;
    this.saveMembers(orgId, members);

    logUserActivity({
      category: "DEPARTMENT",
      crud_type: "UPDATE",
      action: "Reimbursement Approved",
      description: `Approved ₹${approvedAmt.toLocaleString("en-IN")} reimbursement for ${emp.name}`,
      entity_type: "member",
      entity_id: employeeId,
      organisation_id: orgId,
      status: "success",
      metadata: { approvedAmount: approvedAmt, employeeName: emp.name },
    });

    try {
      await membersApi.approveReimbursement(orgId, employeeId, {
        amount: approvedAmt,
      });
    } catch (err) {
      console.warn("API approveReimbursement failed:", err);
    }
  },

  async grantBonus(
    orgId: string,
    employeeId: string,
    bonusAmount: number
  ): Promise<void> {
    const members = this.getMembers(orgId);
    const emp = members.find((m) => m.id === employeeId);
    if (!emp) return;

    emp.compensation.bonuses_accrued += bonusAmount;
    this.saveMembers(orgId, members);

    logUserActivity({
      category: "DEPARTMENT",
      crud_type: "UPDATE",
      action: "Bonus Awarded",
      description: `Awarded performance bonus of ₹${bonusAmount.toLocaleString("en-IN")} to ${emp.name}`,
      entity_type: "member",
      entity_id: employeeId,
      organisation_id: orgId,
      status: "success",
      metadata: { bonusAmount, employeeName: emp.name },
    });

    try {
      await membersApi.grantBonus(orgId, employeeId, bonusAmount);
    } catch (err) {
      console.warn("API grantBonus failed:", err);
    }
  },

  async runMonthlyPayroll(
    orgId: string,
    period?: string
  ): Promise<{ processedCount: number; totalDisbursed: number }> {
    const members = this.getMembers(orgId);
    let totalDisbursed = 0;

    members.forEach((m) => {
      m.compensation.payroll_status = "processed";
      m.compensation.last_payroll_date = new Date().toISOString().split("T")[0];
      totalDisbursed += m.compensation.monthly_net;
    });

    this.saveMembers(orgId, members);

    logUserActivity({
      category: "DEPARTMENT",
      crud_type: "CREATE",
      action: "Monthly Payroll Disbursed",
      description: `Disbursed monthly payroll of ₹${totalDisbursed.toLocaleString("en-IN")} across ${members.length} team members`,
      entity_type: "payroll",
      entity_id: period || new Date().toISOString().slice(0, 7),
      organisation_id: orgId,
      status: "success",
      metadata: {
        processedCount: members.length,
        totalDisbursed,
        period: period || new Date().toISOString().slice(0, 7),
      },
    });

    try {
      const activePeriod = period || new Date().toISOString().slice(0, 7);
      await payrollApi.run(orgId, { period: activePeriod });
    } catch (err) {
      console.warn("API runMonthlyPayroll failed:", err);
    }

    return {
      processedCount: members.length,
      totalDisbursed,
    };
  },
};

