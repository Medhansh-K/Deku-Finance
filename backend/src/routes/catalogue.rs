use axum::{
    extract::{Path, State},
    http::HeaderMap,
    routing::post,
    Json, Router,
};
use serde_json::{json, Value};
use crate::error::AppError;
use crate::models::catalogue::CreateCatalogueItemRequest;
use crate::routes::AppState;

pub fn routes(state: AppState) -> Router {
    Router::new()
        .route("/", post(create_item).get(list_items))
        .with_state(state)
}

fn extract_auth_token(headers: &HeaderMap) -> Option<&str> {
    headers
        .get("Authorization")
        .and_then(|h| h.to_str().ok())
        .and_then(|h| h.strip_prefix("Bearer "))
}

async fn create_item(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(org_id): Path<String>,
    Json(payload): Json<CreateCatalogueItemRequest>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);

    let body = json!({
        "organisation_id": org_id,
        "type": payload.r#type,
        "name": payload.name,
        "description": payload.description,
        "sku": payload.sku,
        "hsn_sac_code": payload.hsn_sac_code,
        "unit_code": payload.unit_code.unwrap_or_else(|| "OTH".to_string()),
        "default_unit_price": payload.default_unit_price,
        "default_gst_rate": payload.default_gst_rate,
        "is_taxable": payload.is_taxable.unwrap_or(true),
    });

    let res = state.supabase.insert_table("catalogue_items", &body, token).await?;

    Ok(Json(json!({
        "success": true,
        "data": res
    })))
}

async fn list_items(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(org_id): Path<String>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    let org_filter = format!("eq.{}", org_id);
    let query = [("select", "*"), ("organisation_id", &org_filter), ("order", "created_at.desc")];
    let res = state.supabase.query_table("catalogue_items", &query, token).await?;

    Ok(Json(json!({
        "success": true,
        "data": res
    })))
}
