use axum::{
    extract::{Path, Query, State},
    http::HeaderMap,
    routing::{delete, get},
    Json, Router,
};
use serde::Deserialize;
use serde_json::{json, Value};
use crate::error::AppError;
use crate::routes::AppState;

pub fn routes(state: AppState) -> Router {
    Router::new()
        .route(
            "/reconciliations",
            get(list_reconciliations).post(create_reconciliation),
        )
        .route("/reconciliations/:reconciliation_id", delete(delete_reconciliation))
        .with_state(state)
}

#[derive(Debug, Deserialize)]
pub struct ListReconciliationsQuery {
    pub bank_account_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateReconciliationRequest {
    pub bank_account_id: String,
    pub statement_date: String,
    pub statement_amount: f64,
    pub statement_reference: Option<String>,
    pub statement_narration: Option<String>,
    pub journal_entry_line_id: String,
}

fn extract_auth_token(headers: &HeaderMap) -> Option<&str> {
    headers
        .get("Authorization")
        .and_then(|h| h.to_str().ok())
        .and_then(|h| h.strip_prefix("Bearer "))
}

async fn list_reconciliations(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(org_id): Path<String>,
    Query(params): Query<ListReconciliationsQuery>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    let org_filter = format!("eq.{}", org_id);
    let mut query = vec![
        ("select", "*".to_string()),
        ("organisation_id", org_filter),
        ("order", "statement_date.desc".to_string()),
    ];
    if let Some(account_id) = params.bank_account_id {
        query.push(("bank_account_id", format!("eq.{}", account_id)));
    }
    let query: Vec<(&str, &str)> = query.iter().map(|(k, v)| (*k, v.as_str())).collect();
    let res = state
        .db
        .query_table("bank_reconciliations", &query, token)
        .await?;

    Ok(Json(json!({ "success": true, "data": res })))
}

async fn create_reconciliation(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(org_id): Path<String>,
    Json(payload): Json<CreateReconciliationRequest>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    if payload.statement_amount == 0.0 {
        return Err(AppError::BadRequest("statement_amount must not be zero".into()));
    }

    // reconciled_by and reconciled_at are filled by the database from the caller's token.
    let body = json!({
        "organisation_id": org_id,
        "bank_account_id": payload.bank_account_id,
        "statement_date": payload.statement_date,
        "statement_amount": payload.statement_amount,
        "statement_reference": payload.statement_reference,
        "statement_narration": payload.statement_narration,
        "journal_entry_line_id": payload.journal_entry_line_id,
    });
    let res = state
        .db
        .insert_table("bank_reconciliations", &body, token)
        .await?;

    Ok(Json(json!({ "success": true, "data": res })))
}

async fn delete_reconciliation(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((org_id, reconciliation_id)): Path<(String, String)>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    let org_filter = format!("eq.{}", org_id);
    let id_filter = format!("eq.{}", reconciliation_id);
    let query = [
        ("organisation_id", org_filter.as_str()),
        ("id", id_filter.as_str()),
    ];
    let res = state
        .db
        .delete_table("bank_reconciliations", &query, token)
        .await?;

    Ok(Json(json!({ "success": true, "data": res })))
}
