use axum::{
    extract::{Path, State},
    http::HeaderMap,
    routing::{get, post},
    Json, Router,
};
use serde_json::{json, Value};
use crate::error::AppError;
use crate::models::accounting::{
    CreateFiscalPeriodRequest, CreateJournalRequest, ReverseJournalRequest,
};
use crate::routes::AppState;

pub fn routes(state: AppState) -> Router {
    Router::new()
        // Chart of Accounts
        .route("/accounts", get(list_accounts))
        .route("/accounts/seed", post(seed_chart_of_accounts))
        // Fiscal Periods
        .route("/fiscal-periods", post(create_fiscal_period).get(list_fiscal_periods))
        // Journal Entries
        .route("/journals", post(create_journal).get(list_journals))
        .route("/journals/:entry_id/post", post(post_journal))
        .route("/journals/:entry_id/reverse", post(reverse_journal))
        // Financial Reports
        .route("/reports/general-ledger", get(get_general_ledger))
        .route("/reports/account-balances", get(get_account_balances))
        .route("/reports/profit-and-loss", get(get_profit_and_loss))
        .route("/reports/balance-sheet", get(get_balance_sheet))
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
