use axum::{
    extract::{Path, Query, State},
    http::HeaderMap,
    routing::{get, post, put},
    Json, Router,
};
use serde::Deserialize;
use serde_json::{json, Value};
use crate::error::AppError;
use crate::routes::AppState;

pub fn routes(state: AppState) -> Router {
    Router::new()
        .route("/settlements", get(list_settlements).post(create_settlement))
        .route(
            "/settlements/:settlement_id",
            get(get_settlement).delete(delete_settlement),
        )
        .route("/settlements/:settlement_id/post", post(post_settlement))
        .route("/column-maps", get(list_column_maps))
        .route("/column-maps/:channel", put(put_column_map))
        .with_state(state)
}

#[derive(Debug, Deserialize)]
pub struct ListSettlementsQuery {
    pub channel: Option<String>,
}

/// The parsed report: header totals plus one line per non-zero amount. The database checks
/// net = gross - deductions and that the lines add up to the header per type.
#[derive(Debug, Deserialize)]
pub struct CreateSettlementRequest {
    pub settlement: Value,
    pub lines: Vec<Value>,
}

#[derive(Debug, Deserialize)]
pub struct PostSettlementRequest {
    pub bank_account_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ColumnMapRequest {
    pub mapping: Value,
    pub deductions_negative: bool,
}

fn extract_auth_token(headers: &HeaderMap) -> Option<&str> {
    headers
        .get("Authorization")
        .and_then(|h| h.to_str().ok())
        .and_then(|h| h.strip_prefix("Bearer "))
}

fn is_empty_array(v: &Value) -> bool {
    v.as_array().map(|a| a.is_empty()).unwrap_or(false)
}

async fn list_settlements(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(org_id): Path<String>,
    Query(params): Query<ListSettlementsQuery>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    let org_filter = format!("eq.{}", org_id);
    let mut query = vec![
        ("select", "*,journal_entries(entry_number,status,submitted_at)".to_string()),
        ("organisation_id", org_filter),
        ("order", "period_to.desc,created_at.desc".to_string()),
    ];
    if let Some(channel) = params.channel {
        query.push(("channel", format!("eq.{}", channel)));
    }
    let query: Vec<(&str, &str)> = query.iter().map(|(k, v)| (*k, v.as_str())).collect();
    let res = state
        .db
        .query_table("marketplace_settlements", &query, token)
        .await?;

    Ok(Json(json!({ "success": true, "data": res })))
}

async fn get_settlement(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((org_id, settlement_id)): Path<(String, String)>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    let org_filter = format!("eq.{}", org_id);
    let id_filter = format!("eq.{}", settlement_id);
    let query = [
        ("select", "*,marketplace_settlement_lines(*)"),
        ("organisation_id", org_filter.as_str()),
        ("id", id_filter.as_str()),
        ("marketplace_settlement_lines.order", "row_number.asc"),
    ];
    let res = state
        .db
        .query_table("marketplace_settlements", &query, token)
        .await?;
    if is_empty_array(&res) {
        return Err(AppError::NotFound("Settlement not found".into()));
    }

    Ok(Json(json!({ "success": true, "data": res })))
}

async fn create_settlement(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(org_id): Path<String>,
    Json(payload): Json<CreateSettlementRequest>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    if payload.lines.is_empty() {
        return Err(AppError::BadRequest("A settlement needs at least one line".into()));
    }
    let rpc_payload = json!({
        "p_org_id": org_id,
        "p_settlement": payload.settlement,
        "p_lines": payload.lines,
    });
    let res = state
        .db
        .rpc("create_marketplace_settlement", &rpc_payload, token)
        .await?;

    Ok(Json(json!({ "success": true, "data": res })))
}

async fn post_settlement(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((org_id, settlement_id)): Path<(String, String)>,
    Json(payload): Json<PostSettlementRequest>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    let rpc_payload = json!({
        "p_org_id": org_id,
        "p_id": settlement_id,
        "p_bank_account_id": payload.bank_account_id,
    });
    // Posts, or submits for approval when the company requires maker-checker.
    let res = state
        .db
        .rpc("post_marketplace_settlement", &rpc_payload, token)
        .await?;

    Ok(Json(json!({ "success": true, "entry": res })))
}

async fn delete_settlement(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((org_id, settlement_id)): Path<(String, String)>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    let org_filter = format!("eq.{}", org_id);
    let id_filter = format!("eq.{}", settlement_id);
    let query = [
        ("organisation_id", org_filter.as_str()),
        ("id", id_filter.as_str()),
    ];
    let res = state
        .db
        .delete_table("marketplace_settlements", &query, token)
        .await?;
    // RLS hides settlements that already have a voucher.
    if is_empty_array(&res) {
        return Err(AppError::NotFound(
            "Settlement not found or already has a voucher (reverse the voucher instead)".into(),
        ));
    }

    Ok(Json(json!({ "success": true, "data": res })))
}

async fn list_column_maps(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(org_id): Path<String>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    let org_filter = format!("eq.{}", org_id);
    let query = [("select", "*"), ("organisation_id", org_filter.as_str())];
    let res = state
        .db
        .query_table("marketplace_column_maps", &query, token)
        .await?;

    Ok(Json(json!({ "success": true, "data": res })))
}

async fn put_column_map(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((org_id, channel)): Path<(String, String)>,
    Json(payload): Json<ColumnMapRequest>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    if !payload.mapping.is_object() {
        return Err(AppError::BadRequest("mapping must be an object".into()));
    }
    let body = json!({
        "organisation_id": org_id,
        "channel": channel,
        "mapping": payload.mapping,
        "deductions_negative": payload.deductions_negative,
    });
    let res = state
        .db
        .upsert_table("marketplace_column_maps", "organisation_id,channel", &body, token)
        .await?;

    Ok(Json(json!({ "success": true, "data": res })))
}
