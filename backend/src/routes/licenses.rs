use axum::{
    extract::{Path, State},
    http::HeaderMap,
    routing::{get, post},
    Json, Router,
};
use serde_json::{json, Value};
use crate::error::AppError;
use crate::models::license::{ActivateLicenseRequest, IssueLicenseRequest};
use crate::routes::AppState;

pub fn routes(state: AppState) -> Router {
    Router::new()
        .route("/", get(get_organisation_license))
        .route("/activate", post(activate_license))
        .route("/issue", post(issue_license))
        .with_state(state)
}

fn extract_auth_token(headers: &HeaderMap) -> Option<&str> {
    headers
        .get("Authorization")
        .and_then(|h| h.to_str().ok())
        .and_then(|h| h.strip_prefix("Bearer "))
}

/// GET /api/v1/organisations/:org_id/license
/// Returns the current active license for the organisation.
/// If none is found, returns empty or details.
async fn get_organisation_license(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(org_id): Path<String>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    let org_filter = format!("eq.{}", org_id);

    let query = [
        ("select", "*"),
        ("organisation_id", &org_filter),
        ("order", "created_at.desc"),
        ("limit", "1"),
    ];

    let res = state.db.query_table("organisation_licenses", &query, token).await?;

    let license_opt = res.as_array().and_then(|arr| arr.first().cloned());

    match license_opt {
        Some(license) => Ok(Json(json!({
            "success": true,
            "has_license": true,
            "data": license
        }))),
        None => {
            // First visit starts the free trial; paid plans are issued by Deku (migration 22).
            // shortcut: owner email is a placeholder; take it from the caller's JWT once the backend decodes it.
            let issue_payload = json!({
                "p_org_id": org_id,
                "p_owner_email": "admin@deku.finance",
                "p_type": "temp",
                "p_tier": "go"
            });

            if let Ok(issued) = state.db.rpc("issue_organisation_license", &issue_payload, token).await {
                if let Some(key) = issued.get("license_key").and_then(|k| k.as_str()) {
                    let act_payload = json!({
                        "p_license_key": key,
                        "p_owner_email": "admin@deku.finance"
                    });
                    if let Ok(activated) = state.db.rpc("activate_organisation_license", &act_payload, token).await {
                        return Ok(Json(json!({
                            "success": true,
                            "has_license": true,
                            "auto_provisioned": true,
                            "data": activated
                        })));
                    }
                }
                return Ok(Json(json!({
                    "success": true,
                    "has_license": true,
                    "auto_provisioned": true,
                    "data": issued
                })));
            }

            Ok(Json(json!({
                "success": true,
                "has_license": false,
                "data": null
            })))
        }
    }
}

/// POST /api/v1/organisations/:org_id/license/activate
/// Activates a license key using the `activate_organisation_license` RPC.
async fn activate_license(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(_org_id): Path<String>,
    Json(payload): Json<ActivateLicenseRequest>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);

    let rpc_payload = json!({
        "p_license_key": payload.license_key.trim(),
        "p_owner_email": payload.owner_email.trim()
    });

    let res = state
        .db
        .rpc("activate_organisation_license", &rpc_payload, token)
        .await?;

    Ok(Json(json!({
        "success": true,
        "data": res
    })))
}

/// POST /api/v1/organisations/:org_id/license/issue
/// Issues a new license (temp/plan, tier 'go' or 'pro') using the `issue_organisation_license` RPC.
async fn issue_license(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(org_id): Path<String>,
    Json(payload): Json<IssueLicenseRequest>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);

    let rpc_payload = json!({
        "p_org_id": org_id,
        "p_owner_email": payload.owner_email.trim(),
        "p_type": payload.license_type,
        "p_tier": payload.plan_tier,
        "p_tenure_days": payload.tenure_days.unwrap_or(30)
    });

    let res = state
        .db
        .rpc("issue_organisation_license", &rpc_payload, token)
        .await?;

    Ok(Json(json!({
        "success": true,
        "data": res
    })))
}
