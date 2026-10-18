use axum::{
    extract::{Path, State},
    http::HeaderMap,
    routing::{get, post},
    Json, Router,
};
use serde_json::{json, Value};
use crate::error::AppError;
use crate::models::party::CreatePartyRequest;
use crate::routes::AppState;

pub fn routes(state: AppState) -> Router {
    Router::new()
        .route("/", post(create_party).get(list_parties))
        .route("/:party_id", get(get_party))
        .with_state(state)
}

fn extract_auth_token(headers: &HeaderMap) -> Option<&str> {
    headers
        .get("Authorization")
        .and_then(|h| h.to_str().ok())
        .and_then(|h| h.strip_prefix("Bearer "))
}

async fn create_party(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(org_id): Path<String>,
    Json(payload): Json<CreatePartyRequest>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);

    let body = json!({
        "organisation_id": org_id,
        "type": payload.r#type,
        "legal_name": payload.legal_name,
        "display_name": payload.display_name,
        "gstin": payload.gstin,
        "pan": payload.pan,
        "email": payload.email,
        "phone": payload.phone,
        "billing_address": payload.billing_address.unwrap_or_else(|| json!({})),
        "shipping_address": payload.shipping_address.unwrap_or_else(|| json!({})),
        "notes": payload.notes,
    });

    let res = state.supabase.insert_table("parties", &body, token).await?;

    Ok(Json(json!({
        "success": true,
        "data": res
    })))
}

async fn list_parties(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(org_id): Path<String>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    let org_filter = format!("eq.{}", org_id);
    let query = [("select", "*"), ("organisation_id", &org_filter), ("order", "created_at.desc")];
    let res = state.supabase.query_table("parties", &query, token).await?;

    Ok(Json(json!({
        "success": true,
        "data": res
    })))
}

async fn get_party(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((org_id, party_id)): Path<(String, String)>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    let org_filter = format!("eq.{}", org_id);
    let id_filter = format!("eq.{}", party_id);
    let query = [
        ("select", "*"),
        ("organisation_id", &org_filter),
        ("id", &id_filter),
    ];
    let res = state.supabase.query_table("parties", &query, token).await?;

    Ok(Json(json!({
        "success": true,
        "data": res
    })))
}
