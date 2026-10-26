use axum::{
    extract::{Path, State},
    http::HeaderMap,
    routing::{get, patch, post},
    Json, Router,
};
use serde_json::{json, Value};
use crate::error::AppError;
use crate::models::department::{
    ApproveReimbursementRequest, CreateDepartmentRequest, CreateDepartmentTaskRequest,
    CreateEmployeeRequest, GrantBonusRequest, RunPayrollRequest, UpdateCompensationRequest,
    UpdateDepartmentRequest, UpdateDepartmentTaskRequest, UpdateEmployeeRequest,
    UpdatePermissionsRequest,
};
use crate::routes::AppState;

fn extract_auth_token(headers: &HeaderMap) -> Option<&str> {
    headers
        .get("Authorization")
        .and_then(|h| h.to_str().ok())
        .and_then(|h| h.strip_prefix("Bearer "))
}

// ============================================================================
// 1. Department Routes
// ============================================================================
pub fn department_routes(state: AppState) -> Router {
    Router::new()
        .route("/", post(create_department).get(list_departments))
        .route(
            "/:dept_id",
            get(get_department)
                .patch(update_department)
                .delete(delete_department),
        )
        .route(
            "/:dept_id/tasks",
            get(list_department_tasks).post(create_department_task),
        )
        .route(
            "/:dept_id/tasks/:task_id",
            patch(update_department_task).delete(delete_department_task),
        )
        .with_state(state)
}

async fn list_departments(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(org_id): Path<String>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    let org_filter = format!("eq.{}", org_id);
    let query = [
        (
            "select",
            "*,department_tasks:department_tasks!department_tasks_department_id_fkey(*)",
        ),
        ("organisation_id", &org_filter),
        ("order", "created_at.asc"),
    ];

    let res = state.supabase.query_table("departments", &query, token).await?;

    Ok(Json(json!({
        "success": true,
        "data": res
    })))
}

async fn create_department(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(org_id): Path<String>,
    Json(payload): Json<CreateDepartmentRequest>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);

    let mut body = json!({
        "organisation_id": org_id,
        "name": payload.name,
        "code": payload.code.to_uppercase(),
        "budget_allocated": payload.budget_allocated.unwrap_or(0.0),
        "currency": payload.currency.unwrap_or_else(|| "INR".to_string()),
        "fiscal_year": payload.fiscal_year.unwrap_or_else(|| "2026-27".to_string()),
    });

    if let Some(desc) = payload.description {
        body["description"] = json!(desc);
    }
    if let Some(lead_id) = payload.lead_id {
        body["lead_id"] = json!(lead_id);
    }
    if let Some(lead_name) = payload.lead_name {
        body["lead_name"] = json!(lead_name);
    }
    if let Some(lead_desig) = payload.lead_designation {
        body["lead_designation"] = json!(lead_desig);
    }

    let res = state.supabase.insert_table("departments", &body, token).await?;

    Ok(Json(json!({
        "success": true,
        "data": res
    })))
}

async fn get_department(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((org_id, dept_id)): Path<(String, String)>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    let org_filter = format!("eq.{}", org_id);
    let id_filter = format!("eq.{}", dept_id);
    let query = [
        (
            "select",
            "*,department_tasks:department_tasks!department_tasks_department_id_fkey(*)",
        ),
        ("organisation_id", &org_filter),
        ("id", &id_filter),
    ];

    let res = state.supabase.query_table("departments", &query, token).await?;

    Ok(Json(json!({
        "success": true,
        "data": res
    })))
}

async fn update_department(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((org_id, dept_id)): Path<(String, String)>,
    Json(payload): Json<UpdateDepartmentRequest>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    let org_filter = format!("eq.{}", org_id);
    let id_filter = format!("eq.{}", dept_id);
    let query = [
        ("organisation_id", org_filter.as_str()),
        ("id", id_filter.as_str()),
    ];

    let mut body = json!({});
    if let Some(name) = payload.name {
        body["name"] = json!(name);
    }
    if let Some(code) = payload.code {
        body["code"] = json!(code.to_uppercase());
    }
    if let Some(desc) = payload.description {
        body["description"] = json!(desc);
    }
    if let Some(lead_id) = payload.lead_id {
        body["lead_id"] = json!(lead_id);
    }
    if let Some(lead_name) = payload.lead_name {
        body["lead_name"] = json!(lead_name);
    }
    if let Some(lead_desig) = payload.lead_designation {
        body["lead_designation"] = json!(lead_desig);
    }
    if let Some(alloc) = payload.budget_allocated {
        body["budget_allocated"] = json!(alloc);
    }
    if let Some(util) = payload.budget_utilized {
        body["budget_utilized"] = json!(util);
    }

    let res = state
        .supabase
        .update_table("departments", &query, &body, token)
        .await?;

    Ok(Json(json!({
        "success": true,
        "data": res
    })))
}

async fn delete_department(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((org_id, dept_id)): Path<(String, String)>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    let org_filter = format!("eq.{}", org_id);
    let id_filter = format!("eq.{}", dept_id);
    let query = [
        ("organisation_id", org_filter.as_str()),
        ("id", id_filter.as_str()),
    ];

    let res = state.supabase.delete_table("departments", &query, token).await?;

    Ok(Json(json!({
        "success": true,
        "data": res
    })))
}

// ============================================================================
// Department Tasks Handlers (Intra / Inter)
// ============================================================================

async fn list_department_tasks(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((org_id, dept_id)): Path<(String, String)>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    let org_filter = format!("eq.{}", org_id);
    let dept_filter = format!("eq.{}", dept_id);
    let query = [
        ("select", "*"),
        ("organisation_id", &org_filter),
        ("department_id", &dept_filter),
        ("order", "created_at.desc"),
    ];

    let res = state
        .supabase
        .query_table("department_tasks", &query, token)
        .await?;

    Ok(Json(json!({
        "success": true,
        "data": res
    })))
}

async fn create_department_task(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((org_id, dept_id)): Path<(String, String)>,
    Json(payload): Json<CreateDepartmentTaskRequest>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);

    let mut body = json!({
        "organisation_id": org_id,
        "department_id": dept_id,
        "title": payload.title,
        "task_type": payload.task_type.unwrap_or_else(|| "intra".to_string()),
        "priority": payload.priority.unwrap_or_else(|| "medium".to_string()),
        "status": payload.status.unwrap_or_else(|| "todo".to_string()),
    });

    if let Some(assign_id) = payload.assigned_to_id {
        body["assigned_to_id"] = json!(assign_id);
    }
    if let Some(assign_name) = payload.assigned_to_name {
        body["assigned_to_name"] = json!(assign_name);
    }
    if let Some(target_id) = payload.target_department_id {
        body["target_department_id"] = json!(target_id);
    }
    if let Some(target_name) = payload.target_department_name {
        body["target_department_name"] = json!(target_name);
    }
    if let Some(due) = payload.due_date {
        body["due_date"] = json!(due);
    }
    if let Some(desc) = payload.description {
        body["description"] = json!(desc);
    }

    let res = state
        .supabase
        .insert_table("department_tasks", &body, token)
        .await?;

    Ok(Json(json!({
        "success": true,
        "data": res
    })))
}

async fn update_department_task(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((org_id, dept_id, task_id)): Path<(String, String, String)>,
    Json(payload): Json<UpdateDepartmentTaskRequest>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    let org_filter = format!("eq.{}", org_id);
    let dept_filter = format!("eq.{}", dept_id);
    let id_filter = format!("eq.{}", task_id);
    let query = [
        ("organisation_id", org_filter.as_str()),
        ("department_id", dept_filter.as_str()),
        ("id", id_filter.as_str()),
    ];

    let mut body = json!({});
    if let Some(title) = payload.title {
        body["title"] = json!(title);
    }
    if let Some(tt) = payload.task_type {
        body["task_type"] = json!(tt);
    }
    if let Some(prio) = payload.priority {
        body["priority"] = json!(prio);
    }
    if let Some(status) = payload.status {
        body["status"] = json!(status);
    }
    if let Some(assign_id) = payload.assigned_to_id {
        body["assigned_to_id"] = json!(assign_id);
    }
    if let Some(assign_name) = payload.assigned_to_name {
        body["assigned_to_name"] = json!(assign_name);
    }
    if let Some(target_id) = payload.target_department_id {
        body["target_department_id"] = json!(target_id);
    }
    if let Some(target_name) = payload.target_department_name {
        body["target_department_name"] = json!(target_name);
    }
    if let Some(due) = payload.due_date {
        body["due_date"] = json!(due);
    }
    if let Some(desc) = payload.description {
        body["description"] = json!(desc);
    }

    let res = state
        .supabase
        .update_table("department_tasks", &query, &body, token)
        .await?;

    Ok(Json(json!({
        "success": true,
        "data": res
    })))
}

async fn delete_department_task(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((org_id, dept_id, task_id)): Path<(String, String, String)>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    let org_filter = format!("eq.{}", org_id);
    let dept_filter = format!("eq.{}", dept_id);
    let id_filter = format!("eq.{}", task_id);
    let query = [
        ("organisation_id", org_filter.as_str()),
        ("department_id", dept_filter.as_str()),
        ("id", id_filter.as_str()),
    ];

    let res = state
        .supabase
        .delete_table("department_tasks", &query, token)
        .await?;

    Ok(Json(json!({
        "success": true,
        "data": res
    })))
}

// ============================================================================
// 2. Firm Members & Employees Routes
// ============================================================================
pub fn member_routes(state: AppState) -> Router {
    Router::new()
        .route("/", post(create_member).get(list_members))
        .route(
            "/:member_id",
            get(get_member).patch(update_member).delete(delete_member),
        )
        .route("/:member_id/permissions", patch(update_permissions))
        .route("/:member_id/compensation", patch(update_compensation))
        .route("/:member_id/bonus", post(grant_bonus))
        .route(
            "/:member_id/reimbursements/approve",
            post(approve_reimbursement),
        )
        .with_state(state)
}

async fn list_members(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(org_id): Path<String>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    let org_filter = format!("eq.{}", org_id);
    let query = [
        (
            "select",
            "*,departments:departments!employees_department_id_fkey(name,code)",
        ),
        ("organisation_id", &org_filter),
        ("order", "is_owner.desc,name.asc"),
    ];

    let res = state.supabase.query_table("employees", &query, token).await?;

    Ok(Json(json!({
        "success": true,
        "data": res
    })))
}

async fn create_member(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(org_id): Path<String>,
    Json(payload): Json<CreateEmployeeRequest>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);

    let mut body = json!({
        "organisation_id": org_id,
        "name": payload.name,
        "email": payload.email,
        "designation": payload.designation,
        "is_owner": payload.is_owner.unwrap_or(false),
        "is_lead": payload.is_lead.unwrap_or(false),
        "role": payload.role.unwrap_or_else(|| "member".to_string()),
        "status": payload.status.unwrap_or_else(|| "active".to_string()),
        "ctc_annual": payload.ctc_annual.unwrap_or(0.0),
        "monthly_gross": payload.monthly_gross.unwrap_or(0.0),
        "monthly_net": payload.monthly_net.unwrap_or(0.0),
        "tds_deduction_monthly": payload.tds_deduction_monthly.unwrap_or(0.0),
        "epf_monthly": payload.epf_monthly.unwrap_or(0.0),
    });

    if let Some(phone) = payload.phone {
        body["phone"] = json!(phone);
    }
    if let Some(dept_id) = payload.department_id {
        body["department_id"] = json!(dept_id);
    }
    if let Some(pan) = payload.pan {
        body["pan"] = json!(pan);
    }
    if let Some(bank) = payload.bank_account_masked {
        body["bank_account_masked"] = json!(bank);
    }
    if let Some(perms) = payload.permissions {
        body["permissions"] = perms;
    }

    let res = state.supabase.insert_table("employees", &body, token).await?;

    Ok(Json(json!({
        "success": true,
        "data": res
    })))
}

async fn get_member(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((org_id, member_id)): Path<(String, String)>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    let org_filter = format!("eq.{}", org_id);
    let id_filter = format!("eq.{}", member_id);
    let query = [
        (
            "select",
            "*,departments:departments!employees_department_id_fkey(name,code)",
        ),
        ("organisation_id", &org_filter),
        ("id", &id_filter),
    ];

    let res = state.supabase.query_table("employees", &query, token).await?;

    Ok(Json(json!({
        "success": true,
        "data": res
    })))
}

async fn update_member(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((org_id, member_id)): Path<(String, String)>,
    Json(payload): Json<UpdateEmployeeRequest>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    let org_filter = format!("eq.{}", org_id);
    let id_filter = format!("eq.{}", member_id);
    let query = [
        ("organisation_id", org_filter.as_str()),
        ("id", id_filter.as_str()),
    ];

    let mut body = json!({});
    if let Some(name) = payload.name {
        body["name"] = json!(name);
    }
    if let Some(email) = payload.email {
        body["email"] = json!(email);
    }
    if let Some(phone) = payload.phone {
        body["phone"] = json!(phone);
    }
    if let Some(desig) = payload.designation {
        body["designation"] = json!(desig);
    }
    if let Some(dept_id) = payload.department_id {
        body["department_id"] = json!(dept_id);
    }
    if let Some(is_lead) = payload.is_lead {
        body["is_lead"] = json!(is_lead);
    }
    if let Some(role) = payload.role {
        body["role"] = json!(role);
    }
    if let Some(status) = payload.status {
        body["status"] = json!(status);
    }
    if let Some(pan) = payload.pan {
        body["pan"] = json!(pan);
    }
    if let Some(bank) = payload.bank_account_masked {
        body["bank_account_masked"] = json!(bank);
    }

    let res = state
        .supabase
        .update_table("employees", &query, &body, token)
        .await?;

    Ok(Json(json!({
        "success": true,
        "data": res
    })))
}

async fn delete_member(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((org_id, member_id)): Path<(String, String)>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    let org_filter = format!("eq.{}", org_id);
    let id_filter = format!("eq.{}", member_id);
    let query = [
        ("organisation_id", org_filter.as_str()),
        ("id", id_filter.as_str()),
        ("is_owner", "eq.false"), // Architectural safeguard: cannot delete prime owner
    ];

    let res = state.supabase.delete_table("employees", &query, token).await?;

    Ok(Json(json!({
        "success": true,
        "data": res
    })))
}

// Selective permissions update (Owner-only privilege matrix)
async fn update_permissions(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((_org_id, member_id)): Path<(String, String)>,
    Json(payload): Json<UpdatePermissionsRequest>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);

    let rpc_payload = json!({
        "p_employee_id": member_id,
        "p_permissions": payload.permissions,
        "p_new_role": payload.role,
    });

    let res = state
        .supabase
        .rpc("update_employee_permissions", &rpc_payload, token)
        .await?;

    Ok(Json(json!({
        "success": true,
        "data": res
    })))
}

// Personal compensation tracking
async fn update_compensation(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((org_id, member_id)): Path<(String, String)>,
    Json(payload): Json<UpdateCompensationRequest>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    let org_filter = format!("eq.{}", org_id);
    let id_filter = format!("eq.{}", member_id);
    let query = [
        ("organisation_id", org_filter.as_str()),
        ("id", id_filter.as_str()),
    ];

    let mut body = json!({});
    if let Some(ctc) = payload.ctc_annual {
        body["ctc_annual"] = json!(ctc);
    }
    if let Some(gross) = payload.monthly_gross {
        body["monthly_gross"] = json!(gross);
    }
    if let Some(net) = payload.monthly_net {
        body["monthly_net"] = json!(net);
    }
    if let Some(tds) = payload.tds_deduction_monthly {
        body["tds_deduction_monthly"] = json!(tds);
    }
    if let Some(epf) = payload.epf_monthly {
        body["epf_monthly"] = json!(epf);
    }
    if let Some(pan) = payload.pan {
        body["pan"] = json!(pan);
    }
    if let Some(bank) = payload.bank_account_masked {
        body["bank_account_masked"] = json!(bank);
    }

    let res = state
        .supabase
        .update_table("employees", &query, &body, token)
        .await?;

    Ok(Json(json!({
        "success": true,
        "data": res
    })))
}

// Grant performance bonus
async fn grant_bonus(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((_org_id, member_id)): Path<(String, String)>,
    Json(payload): Json<GrantBonusRequest>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);

    let rpc_payload = json!({
        "p_employee_id": member_id,
        "p_amount": payload.amount,
    });

    let res = state
        .supabase
        .rpc("grant_employee_bonus", &rpc_payload, token)
        .await?;

    Ok(Json(json!({
        "success": true,
        "data": res
    })))
}

// Approve reimbursement claim
async fn approve_reimbursement(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((org_id, member_id)): Path<(String, String)>,
    Json(payload): Json<ApproveReimbursementRequest>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);

    // If explicit reimbursement_id provided, call RPC
    if let Some(claim_id) = payload.reimbursement_id {
        let rpc_payload = json!({
            "p_reimbursement_id": claim_id,
            "p_approver_id": payload.approver_id,
        });

        let res = state
            .supabase
            .rpc("approve_employee_reimbursement", &rpc_payload, token)
            .await?;

        return Ok(Json(json!({
            "success": true,
            "data": res
        })));
    }

    // Direct adjustment on employee record if bulk approving member's pending claims
    let org_filter = format!("eq.{}", org_id);
    let id_filter = format!("eq.{}", member_id);
    let query = [
        ("select", "reimbursements_pending,reimbursements_approved"),
        ("organisation_id", &org_filter),
        ("id", &id_filter),
    ];

    let member_records = state.supabase.query_table("employees", &query, token).await?;
    let pending = member_records
        .as_array()
        .and_then(|arr| arr.first())
        .and_then(|obj| obj.get("reimbursements_pending"))
        .and_then(|v| v.as_f64())
        .unwrap_or(0.0);

    let approved = member_records
        .as_array()
        .and_then(|arr| arr.first())
        .and_then(|obj| obj.get("reimbursements_approved"))
        .and_then(|v| v.as_f64())
        .unwrap_or(0.0);

    let amount_to_approve = payload.amount.unwrap_or(pending);
    let update_query = [
        ("organisation_id", org_filter.as_str()),
        ("id", id_filter.as_str()),
    ];

    let update_body = json!({
        "reimbursements_pending": (pending - amount_to_approve).max(0.0),
        "reimbursements_approved": approved + amount_to_approve,
    });

    let res = state
        .supabase
        .update_table("employees", &update_query, &update_body, token)
        .await?;

    Ok(Json(json!({
        "success": true,
        "approved_amount": amount_to_approve,
        "data": res
    })))
}

// ============================================================================
// 3. Payroll Batch Execution Routes
// ============================================================================
pub fn payroll_routes(state: AppState) -> Router {
    Router::new()
        .route("/run", post(run_monthly_payroll_batch))
        .route("/runs", get(list_payroll_runs))
        .with_state(state)
}

async fn run_monthly_payroll_batch(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(org_id): Path<String>,
    Json(payload): Json<RunPayrollRequest>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);

    let rpc_payload = json!({
        "p_org_id": org_id,
        "p_period": payload.period,
        "p_executed_by": payload.executed_by,
    });

    let res = state
        .supabase
        .rpc("run_monthly_payroll", &rpc_payload, token)
        .await?;

    Ok(Json(json!({
        "success": true,
        "data": res
    })))
}

async fn list_payroll_runs(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(org_id): Path<String>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    let org_filter = format!("eq.{}", org_id);
    let query = [
        ("select", "*"),
        ("organisation_id", &org_filter),
        ("order", "executed_at.desc"),
    ];

    let res = state
        .supabase
        .query_table("payroll_runs", &query, token)
        .await?;

    Ok(Json(json!({
        "success": true,
        "data": res
    })))
}
