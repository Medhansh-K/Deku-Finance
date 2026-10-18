use axum::{
    extract::{Path, State},
    http::HeaderMap,
    routing::{get, post},
    Json, Router,
};
use serde_json::{json, Value};
use crate::error::AppError;
use crate::models::organisation::CreateOrgRequest;
use crate::routes::AppState;

pub fn routes(state: AppState) -> Router {
    Router::new()
        .route("/", post(create_organisation).get(list_organisations))
        .route("/:id", get(get_organisation))
        .route("/:id/members", get(get_members))
        .with_state(state)
}

fn extract_auth_token(headers: &HeaderMap) -> Option<&str> {
    headers
        .get("Authorization")
        .and_then(|h| h.to_str().ok())
        .and_then(|h| h.strip_prefix("Bearer "))
}

async fn create_organisation(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<CreateOrgRequest>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);

    let body = json!({
        "p_name": payload.name,
        "p_slug": payload.slug,
        "p_currency": payload.currency.unwrap_or_else(|| "INR".to_string()),
        "p_timezone": payload.timezone.unwrap_or_else(|| "Asia/Kolkata".to_string()),
        "p_gstin": payload.gstin,
        "p_pan": payload.pan,
        "p_fy_start_month": payload.financial_year_start_month.unwrap_or(4),
    });

    let res = state.supabase.rpc("create_organisation", &body, token).await?;

    Ok(Json(json!({
        "success": true,
        "organisation_id": res
    })))
}

async fn list_organisations(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    let query = [("select", "*"), ("order", "created_at.desc")];
    let res = state.supabase.query_table("organisations", &query, token).await?;

    Ok(Json(json!({
        "success": true,
        "data": res
    })))
}

async fn get_organisation(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    let id_filter = format!("eq.{}", id);
    let query = [("select", "*"), ("id", &id_filter)];
    let res = state.supabase.query_table("organisations", &query, token).await?;

    Ok(Json(json!({
        "success": true,
        "data": res
    })))
}

async fn get_members(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    let org_filter = format!("eq.{}", id);
    let query = [("select", "*"), ("organisation_id", &org_filter)];
    let res = state.supabase.query_table("organisation_members", &query, token).await?;

    Ok(Json(json!({
        "success": true,
        "data": res
    })))
}
