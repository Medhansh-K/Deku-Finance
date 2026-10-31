use axum::{
    extract::{Path, State},
    http::HeaderMap,
    routing::{patch, post},
    Json, Router,
};
use serde_json::{json, Value};
use crate::error::AppError;
use crate::models::catalogue::{CreateCatalogueItemRequest, UpdateCatalogueItemRequest};
use crate::routes::AppState;

pub fn routes(state: AppState) -> Router {
    Router::new()
        .route("/", post(create_item).get(list_items))
        .route("/:item_id", patch(update_item))
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
        "track_inventory": payload.track_inventory.unwrap_or(false),
    });

    let res = state.db.insert_table("catalogue_items", &body, token).await?;

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
    let res = state.db.query_table("catalogue_items", &query, token).await?;

    Ok(Json(json!({
        "success": true,
        "data": res
    })))
}

async fn update_item(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((org_id, item_id)): Path<(String, String)>,
    Json(payload): Json<UpdateCatalogueItemRequest>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    let org_filter = format!("eq.{}", org_id);
    let id_filter = format!("eq.{}", item_id);
    let query = [
        ("organisation_id", org_filter.as_str()),
        ("id", id_filter.as_str()),
    ];
    let body = json!({ "track_inventory": payload.track_inventory });
    let res = state.db.update_table("catalogue_items", &query, &body, token).await?;
    if res.as_array().map(|a| a.is_empty()).unwrap_or(false) {
        return Err(AppError::NotFound("Catalogue item not found".into()));
    }

    Ok(Json(json!({
        "success": true,
        "data": res
    })))
}
