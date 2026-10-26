use serde::{Deserialize, Serialize};
use serde_json::Value;

// ============================================================================
// Department Models
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateDepartmentRequest {
    pub name: String,
    pub code: String,
    pub description: Option<String>,
    pub lead_id: Option<String>,
    pub lead_name: Option<String>,
    pub lead_designation: Option<String>,
    pub budget_allocated: Option<f64>,
    pub currency: Option<String>,
    pub fiscal_year: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateDepartmentRequest {
    pub name: Option<String>,
    pub code: Option<String>,
    pub description: Option<String>,
    pub lead_id: Option<String>,
    pub lead_name: Option<String>,
    pub lead_designation: Option<String>,
    pub budget_allocated: Option<f64>,
    pub budget_utilized: Option<f64>,
}

// ============================================================================
// Department Task Models (Intra & Inter-Departmental)
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateDepartmentTaskRequest {
    pub title: String,
    pub task_type: Option<String>, // "intra" | "inter"
    pub priority: Option<String>,  // "low" | "medium" | "high" | "urgent"
    pub status: Option<String>,    // "todo" | "in_progress" | "review" | "completed"
    pub assigned_to_id: Option<String>,
    pub assigned_to_name: Option<String>,
    pub target_department_id: Option<String>,
    pub target_department_name: Option<String>,
    pub due_date: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateDepartmentTaskRequest {
    pub title: Option<String>,
    pub task_type: Option<String>,
    pub priority: Option<String>,
    pub status: Option<String>,
    pub assigned_to_id: Option<String>,
    pub assigned_to_name: Option<String>,
    pub target_department_id: Option<String>,
    pub target_department_name: Option<String>,
    pub due_date: Option<String>,
    pub description: Option<String>,
}

// ============================================================================
// Firm Member / Employee Models
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateEmployeeRequest {
    pub name: String,
    pub email: String,
    pub phone: Option<String>,
    pub designation: String,
    pub department_id: Option<String>,
    pub is_owner: Option<bool>,
    pub is_lead: Option<bool>,
    pub role: Option<String>,
    pub status: Option<String>,
    pub pan: Option<String>,
    pub bank_account_masked: Option<String>,
    pub permissions: Option<Value>,
    pub ctc_annual: Option<f64>,
    pub monthly_gross: Option<f64>,
    pub monthly_net: Option<f64>,
    pub tds_deduction_monthly: Option<f64>,
    pub epf_monthly: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateEmployeeRequest {
    pub name: Option<String>,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub designation: Option<String>,
    pub department_id: Option<String>,
    pub is_lead: Option<bool>,
    pub role: Option<String>,
    pub status: Option<String>,
    pub pan: Option<String>,
    pub bank_account_masked: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdatePermissionsRequest {
    pub permissions: Value,
    pub role: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateCompensationRequest {
    pub ctc_annual: Option<f64>,
    pub monthly_gross: Option<f64>,
    pub monthly_net: Option<f64>,
    pub tds_deduction_monthly: Option<f64>,
    pub epf_monthly: Option<f64>,
    pub pan: Option<String>,
    pub bank_account_masked: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GrantBonusRequest {
    pub amount: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApproveReimbursementRequest {
    pub reimbursement_id: Option<String>,
    pub approver_id: Option<String>,
    pub amount: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RunPayrollRequest {
    pub period: String, // e.g. "2026-10"
    pub executed_by: Option<String>,
}
