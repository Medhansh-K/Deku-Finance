import { apiClient } from "./client";
import {
  Account,
  AccountBalanceRow,
  AuditEvent,
  BalanceSheetRow,
  CatalogueItem,
  CreateAccountRequest,
  CreateInvoiceRequest,
  CreateJournalRequest,
  FiscalPeriod,
  GeneralLedgerRow,
  JournalEntry,
  Party,
  ProfitLossRow,
  SalesInvoice,
} from "@/types/accounting";

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface OrgSummary {
  id: string;
  name: string;
  slug: string;
  currency: string;
  timezone: string;
  gstin?: string | null;
  pan?: string | null;
  financial_year_start_month: number;
  created_at?: string;
  updated_at?: string;
}

export const healthApi = {
  check: () =>
    apiClient<{ engine: string; service: string; status: string; version: string }>(
      "/health"
    ),
};

export const organisationsApi = {
  list: () =>
    apiClient<ApiResponse<OrgSummary[]>>("/api/v1/organisations"),
  get: (orgId: string) =>
    apiClient<ApiResponse<OrgSummary[]>>(`/api/v1/organisations/${orgId}`),
  create: (payload: {
    name: string;
    slug: string;
    currency?: string;
    timezone?: string;
    gstin?: string;
    pan?: string;
    financial_year_start_month?: number;
  }) =>
    apiClient<{ success: boolean; organisation_id: string; data?: any }>(
      "/api/v1/organisations",
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    ),
  inviteMember: (
    orgId: string,
    payload: {
      email: string;
      role?: string;
      designation?: string;
      department_id?: string;
    }
  ) =>
    apiClient<{ success: boolean; data: any }>(
      `/api/v1/organisations/${orgId}/invitations`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    ),
  listInvitations: (orgId: string) =>
    apiClient<ApiResponse<any[]>>(
      `/api/v1/organisations/${orgId}/invitations`
    ),
  acceptInvitation: (payload: { token: string }) =>
    apiClient<{ success: boolean; data: any }>(
      "/api/v1/organisations/invitations/accept",
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    ),
  listMembers: (orgId: string) =>
    apiClient<ApiResponse<any[]>>(`/api/v1/organisations/${orgId}/workbench-members`),
  updateMemberRole: (orgId: string, memberId: string, role: string) =>
    apiClient<{ success: boolean; data: any }>(
      `/api/v1/organisations/${orgId}/workbench-members/${memberId}`,
      {
        method: "PATCH",
        body: JSON.stringify({ role }),
      }
    ),
  removeMember: (orgId: string, memberId: string) =>
    apiClient<{ success: boolean; data: any }>(
      `/api/v1/organisations/${orgId}/workbench-members/${memberId}`,
      {
        method: "DELETE",
      }
    ),
};

export const partiesApi = {
  list: (orgId: string) =>
    apiClient<ApiResponse<Party[]>>(`/api/v1/organisations/${orgId}/parties`),
  get: (orgId: string, partyId: string) =>
    apiClient<ApiResponse<Party[]>>(
      `/api/v1/organisations/${orgId}/parties/${partyId}`
    ),
  create: (orgId: string, payload: Partial<Party>) =>
    apiClient<ApiResponse<Party[]>>(`/api/v1/organisations/${orgId}/parties`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};

export const catalogueApi = {
  list: (orgId: string) =>
    apiClient<ApiResponse<CatalogueItem[]>>(
      `/api/v1/organisations/${orgId}/catalogue`
    ),
  create: (orgId: string, payload: Partial<CatalogueItem>) =>
    apiClient<ApiResponse<CatalogueItem[]>>(
      `/api/v1/organisations/${orgId}/catalogue`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    ),
};

export const accountingApi = {
  // Chart of Accounts
  listAccounts: (orgId: string) =>
    apiClient<ApiResponse<Account[]>>(`/api/v1/organisations/${orgId}/accounts`),
  createAccount: (orgId: string, payload: CreateAccountRequest) =>
    apiClient<ApiResponse<Account[]>>(`/api/v1/organisations/${orgId}/accounts`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  deleteAccount: (orgId: string, accountId: string) =>
    apiClient<{ success: boolean; message?: string }>(
      `/api/v1/organisations/${orgId}/accounts/${accountId}`,
      { method: "DELETE" }
    ),
  updateAccount: (orgId: string, accountId: string, payload: Partial<Account>) =>
    apiClient<ApiResponse<Account[]>>(
      `/api/v1/organisations/${orgId}/accounts/${accountId}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      }
    ),
  seedAccounts: (orgId: string) =>
    apiClient<{ success: boolean; message: string }>(
      `/api/v1/organisations/${orgId}/accounts/seed`,
      { method: "POST" }
    ),

  // Fiscal Periods
  listFiscalPeriods: (orgId: string) =>
    apiClient<ApiResponse<FiscalPeriod[]>>(
      `/api/v1/organisations/${orgId}/fiscal-periods`
    ),
  createFiscalPeriod: (
    orgId: string,
    payload: { name: string; start_date: string; end_date: string }
  ) =>
    apiClient<ApiResponse<FiscalPeriod[]>>(
      `/api/v1/organisations/${orgId}/fiscal-periods`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    ),

  // Journal Entries / Vouchers
  listJournals: (orgId: string) =>
    apiClient<ApiResponse<JournalEntry[]>>(
      `/api/v1/organisations/${orgId}/journals`
    ),
  createJournal: (orgId: string, payload: CreateJournalRequest) =>
    apiClient<{ success: boolean; entry: any; lines: any }>(
      `/api/v1/organisations/${orgId}/journals`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    ),
  postJournal: (orgId: string, entryId: string) =>
    apiClient<{ success: boolean; message: string; entry: any }>(
      `/api/v1/organisations/${orgId}/journals/${entryId}/post`,
      { method: "POST" }
    ),
  reverseJournal: (
    orgId: string,
    entryId: string,
    payload: { reversal_date: string; narration?: string }
  ) =>
    apiClient<{
      success: boolean;
      message: string;
      reversal_entry_id: string;
    }>(`/api/v1/organisations/${orgId}/journals/${entryId}/reverse`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};

export const reportsApi = {
  getGeneralLedger: (orgId: string) =>
    apiClient<ApiResponse<GeneralLedgerRow[]>>(
      `/api/v1/organisations/${orgId}/reports/general-ledger`
    ),
  getAccountBalances: (orgId: string) =>
    apiClient<ApiResponse<AccountBalanceRow[]>>(
      `/api/v1/organisations/${orgId}/reports/account-balances`
    ),
  getProfitAndLoss: (orgId: string) =>
    apiClient<ApiResponse<ProfitLossRow[]>>(
      `/api/v1/organisations/${orgId}/reports/profit-and-loss`
    ),
  getBalanceSheet: (orgId: string) =>
    apiClient<ApiResponse<BalanceSheetRow[]>>(
      `/api/v1/organisations/${orgId}/reports/balance-sheet`
    ),
  getTrialBalance: (orgId: string) =>
    apiClient<ApiResponse<any[]>>(
      `/api/v1/organisations/${orgId}/reports/trial-balance`
    ),
  getCashFlow: (
    orgId: string,
    params?: { start_date?: string; end_date?: string }
  ) =>
    apiClient<ApiResponse<any>>(
      `/api/v1/organisations/${orgId}/reports/cash-flow${
        params?.start_date
          ? `?start_date=${params.start_date}&end_date=${params.end_date}`
          : ""
      }`
    ),
  getArApAging: (orgId: string) =>
    apiClient<ApiResponse<any>>(
      `/api/v1/organisations/${orgId}/reports/ar-ap-aging`
    ),
  getFpaMetrics: (
    orgId: string,
    params?: { start_date?: string; end_date?: string }
  ) =>
    apiClient<ApiResponse<any>>(
      `/api/v1/organisations/${orgId}/reports/fpa-metrics${
        params?.start_date
          ? `?start_date=${params.start_date}&end_date=${params.end_date}`
          : ""
      }`
    ),
  getBudgetVariance: (orgId: string) =>
    apiClient<ApiResponse<any>>(
      `/api/v1/organisations/${orgId}/reports/budget-variance`
    ),
  getAccountStatement: (
    orgId: string,
    accountId: string,
    params?: { start_date?: string; end_date?: string }
  ) =>
    apiClient<ApiResponse<any[]>>(
      `/api/v1/organisations/${orgId}/accounts/${accountId}/statement${
        params?.start_date
          ? `?start_date=${params.start_date}&end_date=${params.end_date}`
          : ""
      }`
    ),
};

export const invoicesApi = {
  list: (orgId: string) =>
    apiClient<ApiResponse<SalesInvoice[]>>(
      `/api/v1/organisations/${orgId}/invoices`
    ),
  get: (orgId: string, invId: string) =>
    apiClient<ApiResponse<SalesInvoice[]>>(
      `/api/v1/organisations/${orgId}/invoices/${invId}`
    ),
  create: (orgId: string, payload: CreateInvoiceRequest) =>
    apiClient<{ success: boolean; invoice: any; lines: any }>(
      `/api/v1/organisations/${orgId}/invoices`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    ),
  issue: (orgId: string, invId: string, createJournal = true) =>
    apiClient<{ success: boolean; message: string; invoice: any }>(
      `/api/v1/organisations/${orgId}/invoices/${invId}/issue`,
      {
        method: "POST",
        body: JSON.stringify({ create_journal: createJournal }),
      }
    ),
  cancel: (orgId: string, invId: string, reason: string) =>
    apiClient<{ success: boolean; message: string; invoice: any }>(
      `/api/v1/organisations/${orgId}/invoices/${invId}/cancel`,
      {
        method: "POST",
        body: JSON.stringify({ reason }),
      }
    ),
};

export const auditApi = {
  list: (orgId: string, limit = 100) =>
    apiClient<ApiResponse<any[]>>(
      `/api/v1/organisations/${orgId}/audit-events?limit=${limit}`
    ),
  create: (orgId: string, payload: {
    category: string;
    action: string;
    description: string;
    entity_type?: string;
    entity_id?: string;
    actor_name?: string;
    actor_role?: string;
    status?: string;
    metadata?: any;
  }) =>
    apiClient<ApiResponse<any>>(
      `/api/v1/organisations/${orgId}/audit-events`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    ),
  exportUrl: (orgId: string, format: "csv" | "json" = "json") => {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8080";
    return `${baseUrl}/api/v1/organisations/${orgId}/audit-events/export?format=${format}`;
  },
};

export const departmentsApi = {
  list: (orgId: string) =>
    apiClient<ApiResponse<any[]>>(`/api/v1/organisations/${orgId}/departments`),
  get: (orgId: string, deptId: string) =>
    apiClient<ApiResponse<any[]>>(
      `/api/v1/organisations/${orgId}/departments/${deptId}`
    ),
  create: (orgId: string, payload: any) =>
    apiClient<ApiResponse<any>>(`/api/v1/organisations/${orgId}/departments`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  update: (orgId: string, deptId: string, payload: any) =>
    apiClient<ApiResponse<any>>(
      `/api/v1/organisations/${orgId}/departments/${deptId}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      }
    ),
  delete: (orgId: string, deptId: string) =>
    apiClient<ApiResponse<any>>(
      `/api/v1/organisations/${orgId}/departments/${deptId}`,
      {
        method: "DELETE",
      }
    ),
  createTask: (orgId: string, deptId: string, payload: any) =>
    apiClient<ApiResponse<any>>(
      `/api/v1/organisations/${orgId}/departments/${deptId}/tasks`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    ),
  updateTask: (orgId: string, deptId: string, taskId: string, payload: any) =>
    apiClient<ApiResponse<any>>(
      `/api/v1/organisations/${orgId}/departments/${deptId}/tasks/${taskId}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      }
    ),
  deleteTask: (orgId: string, deptId: string, taskId: string) =>
    apiClient<ApiResponse<any>>(
      `/api/v1/organisations/${orgId}/departments/${deptId}/tasks/${taskId}`,
      {
        method: "DELETE",
      }
    ),
};

export const membersApi = {
  list: (orgId: string) =>
    apiClient<ApiResponse<any[]>>(`/api/v1/organisations/${orgId}/members`),
  get: (orgId: string, memberId: string) =>
    apiClient<ApiResponse<any[]>>(
      `/api/v1/organisations/${orgId}/members/${memberId}`
    ),
  create: (orgId: string, payload: any) =>
    apiClient<ApiResponse<any>>(`/api/v1/organisations/${orgId}/members`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  update: (orgId: string, memberId: string, payload: any) =>
    apiClient<ApiResponse<any>>(
      `/api/v1/organisations/${orgId}/members/${memberId}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      }
    ),
  delete: (orgId: string, memberId: string) =>
    apiClient<ApiResponse<any>>(
      `/api/v1/organisations/${orgId}/members/${memberId}`,
      {
        method: "DELETE",
      }
    ),
  updatePermissions: (orgId: string, memberId: string, payload: { permissions: any; role?: string }) =>
    apiClient<ApiResponse<any>>(
      `/api/v1/organisations/${orgId}/members/${memberId}/permissions`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      }
    ),
  updateCompensation: (orgId: string, memberId: string, payload: any) =>
    apiClient<ApiResponse<any>>(
      `/api/v1/organisations/${orgId}/members/${memberId}/compensation`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      }
    ),
  grantBonus: (orgId: string, memberId: string, amount: number) =>
    apiClient<ApiResponse<any>>(
      `/api/v1/organisations/${orgId}/members/${memberId}/bonus`,
      {
        method: "POST",
        body: JSON.stringify({ amount }),
      }
    ),
  approveReimbursement: (orgId: string, memberId: string, payload?: { reimbursement_id?: string; amount?: number; approver_id?: string }) =>
    apiClient<ApiResponse<any>>(
      `/api/v1/organisations/${orgId}/members/${memberId}/reimbursements/approve`,
      {
        method: "POST",
        body: JSON.stringify(payload || {}),
      }
    ),
};

export const payrollApi = {
  run: (orgId: string, payload: { period: string; executed_by?: string }) =>
    apiClient<ApiResponse<any>>(`/api/v1/organisations/${orgId}/payroll/run`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  listRuns: (orgId: string) =>
    apiClient<ApiResponse<any[]>>(`/api/v1/organisations/${orgId}/payroll/runs`),
};

export const documentsApi = {
  register: (
    orgId: string,
    payload: {
      filename: string;
      storage_path?: string;
      byte_size?: number;
      mime_type?: string;
      document_type?: string;
      invoice_id?: string;
      sha256_hash?: string;
      metadata?: any;
    }
  ) =>
    apiClient<{
      success: boolean;
      is_duplicate: boolean;
      data?: any;
      error?: string;
      existing_record?: any;
    }>(`/api/v1/organisations/${orgId}/documents`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  list: (orgId: string) =>
    apiClient<ApiResponse<any[]>>(`/api/v1/organisations/${orgId}/documents`),
  saveExtraction: (
    orgId: string,
    payload: {
      document_id: string;
      storage_path?: string;
      sha256_hash?: string;
      sarvam_job_id?: string;
      document_nature?: string;
      detected_language?: string;
      raw_markdown_output?: string;
      ufo_payload?: any;
      confidence_score?: number;
    }
  ) =>
    apiClient<ApiResponse<any>>(
      `/api/v1/organisations/${orgId}/documents/extractions`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    ),
  getExtractions: (orgId: string, docId: string) =>
    apiClient<ApiResponse<any[]>>(
      `/api/v1/organisations/${orgId}/documents/${docId}/extractions`
    ),
  createProposal: (
    orgId: string,
    payload: {
      session_id?: string;
      document_id: string;
      voucher_type: string;
      voucher_date?: string;
      party_id?: string;
      header_memo?: string;
      proposed_lines: any[];
      total_debit: number;
      total_credit: number;
    }
  ) =>
    apiClient<ApiResponse<any>>(
      `/api/v1/organisations/${orgId}/documents/proposals`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    ),
  listProposals: (orgId: string) =>
    apiClient<ApiResponse<any[]>>(
      `/api/v1/organisations/${orgId}/documents/proposals`
    ),
  approveProposal: (orgId: string, proposalId: string) =>
    apiClient<{ success: boolean; message: string; data?: any }>(
      `/api/v1/organisations/${orgId}/documents/proposals/${proposalId}/approve`,
      { method: "POST" }
    ),
};

export const consultantApi = {
  chat: (
    orgId: string,
    payload: {
      message: string;
      history?: { role: string; content: string }[];
    }
  ) =>
    apiClient<{
      success: boolean;
      response: string;
      model_used: string;
      context_snapshot: any;
      suggested_followups: string[];
    }>(`/api/v1/organisations/${orgId}/consultant/chat`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getContext: (orgId: string) =>
    apiClient<{ success: boolean; context: any }>(
      `/api/v1/organisations/${orgId}/consultant/context`
    ),
};

export interface BankReconciliation {
  id: string;
  organisation_id: string;
  bank_account_id: string;
  statement_date: string;
  statement_amount: number; // positive = deposit, negative = withdrawal
  statement_reference?: string | null;
  statement_narration?: string | null;
  journal_entry_line_id: string;
  reconciled_by: string;
  reconciled_at: string;
}

export const bankingApi = {
  listReconciliations: (orgId: string, bankAccountId: string) =>
    apiClient<ApiResponse<BankReconciliation[]>>(
      `/api/v1/organisations/${orgId}/banking/reconciliations?bank_account_id=${encodeURIComponent(bankAccountId)}`
    ),
  reconcile: (
    orgId: string,
    payload: Omit<BankReconciliation, "id" | "organisation_id" | "reconciled_by" | "reconciled_at">
  ) =>
    apiClient<ApiResponse<BankReconciliation[]>>(
      `/api/v1/organisations/${orgId}/banking/reconciliations`,
      { method: "POST", body: JSON.stringify(payload) }
    ),
  unreconcile: (orgId: string, reconciliationId: string) =>
    apiClient<ApiResponse<BankReconciliation[]>>(
      `/api/v1/organisations/${orgId}/banking/reconciliations/${reconciliationId}`,
      { method: "DELETE" }
    ),
};


