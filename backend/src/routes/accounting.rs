use axum::{
    extract::{Path, Query, State},
    http::HeaderMap,
    routing::{delete, get, post},
    Json, Router,
};
use serde::Deserialize;
use serde_json::{json, Value};
use crate::error::AppError;
use crate::models::accounting::{
    CreateAccountRequest, CreateFiscalPeriodRequest, CreateJournalRequest, ReverseJournalRequest,
};
use crate::routes::AppState;

#[derive(Debug, Deserialize)]
pub struct DateRangeQuery {
    pub start_date: Option<String>,
    pub end_date: Option<String>,
}

pub fn routes(state: AppState) -> Router {
    Router::new()
        // Chart of Accounts
        .route("/accounts", post(create_account).get(list_accounts))
        .route("/accounts/seed", post(seed_chart_of_accounts))
        .route("/accounts/:account_id", delete(delete_account).patch(update_account))
        // Fiscal Periods
        .route("/fiscal-periods", post(create_fiscal_period).get(list_fiscal_periods))
        // Journal Entries
        .route("/journals", post(create_journal).get(list_journals))
        .route("/journals/:entry_id/post", post(post_journal))
        .route("/journals/:entry_id/reverse", post(reverse_journal))
        // Financial Reports & Universal Rollup Engine
        .route("/reports/general-ledger", get(get_general_ledger))
        .route("/reports/account-balances", get(get_account_balances))
        .route("/reports/profit-and-loss", get(get_profit_and_loss))
        .route("/reports/balance-sheet", get(get_balance_sheet))
        .route("/reports/trial-balance", get(get_trial_balance))
        .route("/reports/cash-flow", get(get_cash_flow))
        .route("/reports/ar-ap-aging", get(get_ar_ap_aging))
        .route("/reports/fpa-metrics", get(get_fpa_metrics))
        .route("/reports/budget-variance", get(get_budget_variance))
        .route("/accounts/:account_id/statement", get(get_account_statement_handler))
        .with_state(state)
}

fn extract_auth_token(headers: &HeaderMap) -> Option<&str> {
    headers
        .get("Authorization")
        .and_then(|h| h.to_str().ok())
        .and_then(|h| h.strip_prefix("Bearer "))
}

// ---------------- Chart of Accounts ----------------
async fn list_accounts(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(org_id): Path<String>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    let org_filter = format!("eq.{}", org_id);
    let query = [
        ("select", "*"),
        ("organisation_id", &org_filter),
        ("order", "code.asc"),
    ];
    let res = state.supabase.query_table("accounts", &query, token).await?;

    Ok(Json(json!({ "success": true, "data": res })))
}

async fn seed_chart_of_accounts(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(org_id): Path<String>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    let payload = json!({ "p_org_id": org_id });
    state.supabase.rpc("seed_default_chart_of_accounts", &payload, token).await?;

    Ok(Json(json!({
        "success": true,
        "message": "Default Chart of Accounts seeded successfully"
    })))
}

async fn create_account(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(org_id): Path<String>,
    Json(payload): Json<CreateAccountRequest>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);

    let grp = payload.account_group.trim().to_lowercase();
    let acct_type = match grp.as_str() {
        "revenue" | "income" => "income",
        "asset" => "asset",
        "liability" => "liability",
        "equity" => "equity",
        "expense" => "expense",
        _ => {
            return Err(AppError::BadRequest(
                "Invalid account group. Must be asset, liability, equity, revenue, or expense".into(),
            ))
        }
    };

    let effective_group = if grp == "income" { "revenue" } else { &grp };
    let label = payload
        .label
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| payload.name.clone());
    let ledger = payload
        .ledger
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| "General Ledger".into());
    let sub_ledger = payload
        .sub_ledger
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| "General Sub-Ledger".into());
    let is_postable = payload.is_postable.unwrap_or(true);

    let body = json!({
        "organisation_id": org_id,
        "code": payload.code.trim(),
        "name": payload.name.trim(),
        "type": acct_type,
        "account_group": effective_group,
        "label": label,
        "ledger": ledger,
        "sub_ledger": sub_ledger,
        "is_postable": is_postable,
        "is_active": true,
        "is_system": false,
        "description": payload.description,
        "parent_account_id": payload.parent_account_id,
    });

    let res = state.supabase.insert_table("accounts", &body, token).await?;
    Ok(Json(json!({ "success": true, "data": res })))
}

async fn delete_account(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((org_id, account_id)): Path<(String, String)>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);

    let org_filter = format!("eq.{}", org_id);
    let id_filter = format!("eq.{}", account_id);
    let query = [
        ("select", "id,code,name,is_system"),
        ("organisation_id", &org_filter),
        ("id", &id_filter),
    ];
    let accounts = state.supabase.query_table("accounts", &query, token).await?;
    let account = accounts
        .as_array()
        .and_then(|arr| arr.first())
        .ok_or_else(|| AppError::NotFound("Account not found".into()))?;

    if account.get("is_system").and_then(|v| v.as_bool()).unwrap_or(false) {
        return Err(AppError::BadRequest(
            "System accounts cannot be removed or deleted.".into(),
        ));
    }

    let j_query = [
        ("select", "id"),
        ("account_id", &id_filter),
        ("limit", "1"),
    ];
    let lines = state.supabase.query_table("journal_entry_lines", &j_query, token).await?;
    if let Some(arr) = lines.as_array() {
        if !arr.is_empty() {
            return Err(AppError::BadRequest(
                "Cannot delete account because it has recorded journal transactions. Deactivate the account instead to retain audit history.".into(),
            ));
        }
    }

    let delete_query = [
        ("organisation_id", org_filter.as_str()),
        ("id", id_filter.as_str()),
    ];
    let res = state.supabase.delete_table("accounts", &delete_query, token).await?;
    Ok(Json(json!({
        "success": true,
        "message": "Account removed successfully",
        "data": res
    })))
}

async fn update_account(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((org_id, account_id)): Path<(String, String)>,
    Json(payload): Json<Value>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    let org_filter = format!("eq.{}", org_id);
    let id_filter = format!("eq.{}", account_id);

    let query = [
        ("organisation_id", org_filter.as_str()),
        ("id", id_filter.as_str()),
    ];

    let res = state.supabase.update_table("accounts", &query, &payload, token).await?;
    Ok(Json(json!({ "success": true, "data": res })))
}

// ---------------- Fiscal Periods ----------------
async fn create_fiscal_period(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(org_id): Path<String>,
    Json(payload): Json<CreateFiscalPeriodRequest>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);

    let body = json!({
        "organisation_id": org_id,
        "name": payload.name,
        "start_date": payload.start_date,
        "end_date": payload.end_date,
        "status": "open"
    });

    let res = state.supabase.insert_table("fiscal_periods", &body, token).await?;

    Ok(Json(json!({ "success": true, "data": res })))
}

async fn list_fiscal_periods(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(org_id): Path<String>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    let org_filter = format!("eq.{}", org_id);
    let query = [
        ("select", "*"),
        ("organisation_id", &org_filter),
        ("order", "start_date.desc"),
    ];
    let res = state.supabase.query_table("fiscal_periods", &query, token).await?;

    Ok(Json(json!({ "success": true, "data": res })))
}

// ---------------- Journals ----------------
async fn create_journal(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(org_id): Path<String>,
    Json(payload): Json<CreateJournalRequest>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);

    // 1. Insert Header
    let header_body = json!({
        "organisation_id": org_id,
        "fiscal_period_id": payload.fiscal_period_id,
        "entry_number": payload.entry_number,
        "entry_date": payload.entry_date,
        "status": "draft",
        "narration": payload.narration,
        "reference": payload.reference,
    });

    let header_res = state.supabase.insert_table("journal_entries", &header_body, token).await?;
    let entry_id = header_res
        .as_array()
        .and_then(|arr| arr.first())
        .and_then(|obj| obj.get("id"))
        .and_then(|id| id.as_str())
        .ok_or_else(|| AppError::Internal("Failed to extract created entry id".to_string()))?;

    // 2. Insert Lines
    let lines_body: Vec<Value> = payload
        .lines
        .into_iter()
        .map(|l| {
            json!({
                "organisation_id": org_id,
                "journal_entry_id": entry_id,
                "line_number": l.line_number,
                "account_id": l.account_id,
                "party_id": l.party_id,
                "description": l.description,
                "debit": l.debit,
                "credit": l.credit,
            })
        })
        .collect();

    let lines_res = state
        .supabase
        .insert_table("journal_entry_lines", &json!(lines_body), token)
        .await?;

    Ok(Json(json!({
        "success": true,
        "entry": header_res,
        "lines": lines_res
    })))
}

async fn list_journals(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(org_id): Path<String>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    let org_filter = format!("eq.{}", org_id);
    let query = [
        ("select", "*, journal_entry_lines(*)"),
        ("organisation_id", &org_filter),
        ("order", "entry_date.desc"),
    ];
    let res = state.supabase.query_table("journal_entries", &query, token).await?;

    Ok(Json(json!({ "success": true, "data": res })))
}

async fn post_journal(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((org_id, entry_id)): Path<(String, String)>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    let payload = json!({
        "p_org_id": org_id,
        "p_entry_id": entry_id
    });

    let res = state.supabase.rpc("post_journal_entry", &payload, token).await?;

    Ok(Json(json!({
        "success": true,
        "message": "Journal entry posted successfully",
        "entry": res
    })))
}

async fn reverse_journal(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((org_id, entry_id)): Path<(String, String)>,
    Json(payload): Json<ReverseJournalRequest>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    let rpc_payload = json!({
        "p_org_id": org_id,
        "p_entry_id": entry_id,
        "p_reversal_date": payload.reversal_date,
        "p_narration": payload.narration
    });

    let res = state.supabase.rpc("reverse_journal_entry", &rpc_payload, token).await?;

    Ok(Json(json!({
        "success": true,
        "message": "Journal entry reversed successfully",
        "reversal_entry_id": res
    })))
}

// ---------------- Reports ----------------
async fn get_general_ledger(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(org_id): Path<String>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    let org_filter = format!("eq.{}", org_id);
    let query = [
        ("select", "*"),
        ("organisation_id", &org_filter),
        ("order", "entry_date.desc,line_number.asc"),
    ];
    let res = state.supabase.query_table("view_general_ledger", &query, token).await?;

    Ok(Json(json!({ "success": true, "data": res })))
}

async fn get_account_balances(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(org_id): Path<String>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    let org_filter = format!("eq.{}", org_id);
    let query = [
        ("select", "*"),
        ("organisation_id", &org_filter),
        ("order", "account_code.asc"),
    ];
    let res = state.supabase.query_table("view_account_balances", &query, token).await?;

    Ok(Json(json!({ "success": true, "data": res })))
}

async fn get_profit_and_loss(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(org_id): Path<String>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    let org_filter = format!("eq.{}", org_id);
    let query = [
        ("select", "*"),
        ("organisation_id", &org_filter),
        ("order", "account_code.asc"),
    ];
    let res = state.supabase.query_table("view_profit_and_loss", &query, token).await?;

    Ok(Json(json!({ "success": true, "data": res })))
}

async fn get_balance_sheet(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(org_id): Path<String>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    let org_filter = format!("eq.{}", org_id);
    let query = [
        ("select", "*"),
        ("organisation_id", &org_filter),
        ("order", "account_code.asc"),
    ];
    let res = state.supabase.query_table("view_balance_sheet", &query, token).await?;

    Ok(Json(json!({ "success": true, "data": res })))
}

async fn get_trial_balance(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(org_id): Path<String>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    let org_filter = format!("eq.{}", org_id);
    let query = [
        ("select", "*"),
        ("organisation_id", &org_filter),
        ("order", "account_code.asc"),
    ];
    let res = state.supabase.query_table("view_trial_balance", &query, token).await?;

    Ok(Json(json!({ "success": true, "data": res })))
}

async fn get_cash_flow(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(org_id): Path<String>,
    Query(params): Query<DateRangeQuery>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    let payload = json!({
        "p_org_id": org_id,
        "p_start_date": params.start_date.unwrap_or_else(|| "2026-04-01".to_string()),
        "p_end_date": params.end_date.unwrap_or_else(|| chrono::Utc::now().format("%Y-%m-%d").to_string())
    });
    let res = state.supabase.rpc("get_cash_flow_statement", &payload, token).await?;

    Ok(Json(json!({ "success": true, "data": res })))
}

async fn get_ar_ap_aging(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(org_id): Path<String>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    let payload = json!({ "p_org_id": org_id });
    let res = state.supabase.rpc("get_ar_ap_aging_analysis", &payload, token).await?;

    Ok(Json(json!({ "success": true, "data": res })))
}

async fn get_fpa_metrics(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(org_id): Path<String>,
    Query(params): Query<DateRangeQuery>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    let payload = json!({
        "p_org_id": org_id,
        "p_start_date": params.start_date.unwrap_or_else(|| "2026-04-01".to_string()),
        "p_end_date": params.end_date.unwrap_or_else(|| chrono::Utc::now().format("%Y-%m-%d").to_string())
    });
    let res = state.supabase.rpc("get_fpa_corporate_metrics", &payload, token).await?;

    Ok(Json(json!({ "success": true, "data": res })))
}

async fn get_budget_variance(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(org_id): Path<String>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    let payload = json!({ "p_org_id": org_id });
    let res = state.supabase.rpc("get_departmental_budget_variance", &payload, token).await?;

    Ok(Json(json!({ "success": true, "data": res })))
}

async fn get_account_statement_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((org_id, account_id)): Path<(String, String)>,
    Query(params): Query<DateRangeQuery>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    let payload = json!({
        "p_org_id": org_id,
        "p_account_id": account_id,
        "p_start_date": params.start_date.unwrap_or_else(|| "2026-04-01".to_string()),
        "p_end_date": params.end_date.unwrap_or_else(|| chrono::Utc::now().format("%Y-%m-%d").to_string())
    });
    let res = state.supabase.rpc("get_account_statement", &payload, token).await?;

    Ok(Json(json!({ "success": true, "data": res })))
}
