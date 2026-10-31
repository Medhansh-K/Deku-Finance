use axum::{
    extract::{Path, Query, State},
    http::HeaderMap,
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use crate::auth;
use crate::error::AppError;
use crate::routes::AppState;

pub fn routes(state: AppState) -> Router {
    Router::new()
        .route("/", get(list_notifications))
        .route("/read", post(mark_read))
        .with_state(state)
}

/// Called by Cloud Scheduler (or a manual curl) with `X-Deku-Cron-Secret`, never by the frontend.
pub fn internal_routes(state: AppState) -> Router {
    Router::new()
        .route("/generate", post(generate))
        .with_state(state)
}

#[derive(Debug, Deserialize)]
pub struct ListNotificationsQuery {
    pub unread: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct MarkReadRequest {
    #[serde(default)]
    pub ids: Vec<String>,
}

fn extract_auth_token(headers: &HeaderMap) -> Option<&str> {
    headers
        .get("Authorization")
        .and_then(|h| h.to_str().ok())
        .and_then(|h| h.strip_prefix("Bearer "))
}

async fn list_notifications(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(org_id): Path<String>,
    Query(params): Query<ListNotificationsQuery>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    let payload = json!({
        "p_org_id": org_id,
        "p_unread_only": params.unread.unwrap_or(false),
    });
    let res = state.db.rpc("list_notifications", &payload, token).await?;

    Ok(Json(json!({ "success": true, "data": res })))
}

async fn mark_read(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(_org_id): Path<String>,
    Json(payload): Json<MarkReadRequest>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    if payload.ids.is_empty() || payload.ids.len() > 200 {
        return Err(AppError::BadRequest("ids must list 1 to 200 notifications".into()));
    }
    // The function ignores ids the caller can't see, so the org in the path needs no extra check.
    let res = state
        .db
        .rpc("mark_notifications_read", &json!({ "p_ids": payload.ids }), token)
        .await?;

    Ok(Json(json!({ "success": true, "data": { "marked": res } })))
}

/// Hashing first makes the comparison length-independent; the XOR fold doesn't stop early.
fn secret_matches(given: &str, expected: &str) -> bool {
    let a = Sha256::digest(given.as_bytes());
    let b = Sha256::digest(expected.as_bytes());
    a.iter().zip(b.iter()).fold(0u8, |acc, (x, y)| acc | (x ^ y)) == 0
}

async fn generate(State(state): State<AppState>, headers: HeaderMap) -> Result<Json<Value>, AppError> {
    // Unset means the endpoint doesn't exist on this deployment.
    let expected = state
        .cron_secret
        .as_deref()
        .ok_or_else(|| AppError::NotFound("Not found".into()))?;
    let given = headers
        .get("X-Deku-Cron-Secret")
        .and_then(|h| h.to_str().ok())
        .unwrap_or("");
    if !secret_matches(given, expected) {
        return Err(AppError::Unauthorized("invalid_cron_secret".into()));
    }

    let token = auth::service_token(&state.jwt_secret)?;
    let inserted = state.db.rpc("generate_notifications", &json!({}), Some(&token)).await?;
    tracing::info!("generate_notifications inserted {}", inserted);

    Ok(Json(json!({ "success": true, "data": { "inserted": inserted } })))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn secret_comparison() {
        assert!(secret_matches("s3cret-value", "s3cret-value"));
        assert!(!secret_matches("s3cret-valuX", "s3cret-value"));
        assert!(!secret_matches("", "s3cret-value"));
        assert!(!secret_matches("s3cret-value-longer", "s3cret-value"));
    }
}
