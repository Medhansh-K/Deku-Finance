use axum::{
    extract::{Path, State},
    http::HeaderMap,
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use serde_json::{json, Value};
use crate::error::AppError;
use crate::routes::AppState;

/// Nested at /organisations/:org_id/subscription.
pub fn routes(state: AppState) -> Router {
    Router::new()
        .route("/", get(get_subscription))
        .with_state(state)
}

/// Nested at /admin. grant_subscription refuses anyone but a platform superadmin.
pub fn admin_routes(state: AppState) -> Router {
    Router::new()
        .route("/organisations/:org_id/subscription", post(grant_subscription))
        .with_state(state)
}

#[derive(Debug, Deserialize)]
pub struct GrantSubscriptionRequest {
    pub plan: String,
    /// RFC 3339 timestamp; the plan is active until then.
    pub until: String,
}

fn extract_auth_token(headers: &HeaderMap) -> Option<&str> {
    headers
        .get("Authorization")
        .and_then(|h| h.to_str().ok())
        .and_then(|h| h.strip_prefix("Bearer "))
}

/// GET /api/v1/organisations/:org_id/subscription
/// Plan, effective status, trial/period dates, entitlements and this month's usage.
/// The trial is started by the database when the company is created; nothing is provisioned here.
async fn get_subscription(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(org_id): Path<String>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    let res = state
        .db
        .rpc("get_organisation_subscription", &json!({ "p_org_id": org_id }), token)
        .await?;

    Ok(Json(json!({ "success": true, "data": res })))
}

/// POST /api/v1/admin/organisations/:org_id/subscription
/// Manual / offline billing: a superadmin sets the plan and its end date.
// shortcut: no online payment for Deku's own plans yet; add Razorpay Subscriptions (provider 'razorpay') with its webhook when M4 payment starts.
async fn grant_subscription(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(org_id): Path<String>,
    Json(payload): Json<GrantSubscriptionRequest>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    if payload.plan.trim().is_empty() || payload.until.trim().is_empty() {
        return Err(AppError::BadRequest("plan and until are required".into()));
    }

    let rpc_payload = json!({
        "p_org_id": org_id,
        "p_plan": payload.plan.trim(),
        "p_until": payload.until.trim(),
    });
    let res = state.db.rpc("grant_subscription", &rpc_payload, token).await?;

    Ok(Json(json!({ "success": true, "data": res })))
}
