use axum::{
    extract::{Path, Query, State},
    http::HeaderMap,
    routing::{get, patch, post},
    Json, Router,
};
use serde::Deserialize;
use serde_json::{json, Value};
use crate::error::AppError;
use crate::routes::AppState;

/// Stock (migration 42). Movements are written only by the database: document triggers and
/// record_stock_adjustment. These routes read the FIFO reports and manage warehouses.
pub fn routes(state: AppState) -> Router {
    Router::new()
        .route("/warehouses", get(list_warehouses).post(create_warehouse))
        .route(
            "/warehouses/:warehouse_id",
            patch(update_warehouse).delete(delete_warehouse),
        )
        .route("/summary", get(stock_summary))
        .route("/items/:item_id/ledger", get(item_ledger))
        .route("/adjustments", post(record_adjustment))
        .with_state(state)
}

#[derive(Debug, Deserialize)]
pub struct CreateWarehouseRequest {
    pub name: String,
    pub code: String,
    pub is_default: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateWarehouseRequest {
    pub name: Option<String>,
    pub code: Option<String>,
    pub is_default: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct SummaryQuery {
    /// yyyy-mm-dd; defaults to today in the database.
    pub as_of: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct LedgerQuery {
    pub from: Option<String>,
    pub to: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AdjustmentRequest {
    pub item_id: String,
    pub kind: String,      // opening | adjustment
    pub direction: String, // in | out
    pub qty: f64,
    pub unit_cost: Option<f64>,
    pub date: String,
    pub warehouse_id: Option<String>,
    pub reason: Option<String>,
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

async fn list_warehouses(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(org_id): Path<String>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    let org_filter = format!("eq.{}", org_id);
    let query = [
        ("select", "*"),
        ("organisation_id", org_filter.as_str()),
        ("order", "is_default.desc,name.asc"),
    ];
    let res = state.db.query_table("warehouses", &query, token).await?;

    Ok(Json(json!({ "success": true, "data": res })))
}

async fn create_warehouse(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(org_id): Path<String>,
    Json(payload): Json<CreateWarehouseRequest>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    if payload.name.trim().is_empty() || payload.code.trim().is_empty() {
        return Err(AppError::BadRequest("name and code are required".into()));
    }
    let body = json!({
        "organisation_id": org_id,
        "name": payload.name.trim(),
        "code": payload.code.trim().to_uppercase(),
        "is_default": payload.is_default.unwrap_or(false),
    });
    let res = state.db.insert_table("warehouses", &body, token).await?;

    Ok(Json(json!({ "success": true, "data": res })))
}

async fn update_warehouse(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((org_id, warehouse_id)): Path<(String, String)>,
    Json(payload): Json<UpdateWarehouseRequest>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    let mut body = serde_json::Map::new();
    if let Some(name) = payload.name {
        body.insert("name".into(), json!(name.trim()));
    }
    if let Some(code) = payload.code {
        body.insert("code".into(), json!(code.trim().to_uppercase()));
    }
    if let Some(is_default) = payload.is_default {
        body.insert("is_default".into(), json!(is_default));
    }
    if body.is_empty() {
        return Err(AppError::BadRequest("Nothing to update".into()));
    }
    let org_filter = format!("eq.{}", org_id);
    let id_filter = format!("eq.{}", warehouse_id);
    let query = [
        ("organisation_id", org_filter.as_str()),
        ("id", id_filter.as_str()),
    ];
    let res = state
        .db
        .update_table("warehouses", &query, &Value::Object(body), token)
        .await?;
    if is_empty_array(&res) {
        return Err(AppError::NotFound("Warehouse not found".into()));
    }

    Ok(Json(json!({ "success": true, "data": res })))
}

async fn delete_warehouse(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((org_id, warehouse_id)): Path<(String, String)>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    let org_filter = format!("eq.{}", org_id);
    let id_filter = format!("eq.{}", warehouse_id);
    let query = [
        ("organisation_id", org_filter.as_str()),
        ("id", id_filter.as_str()),
    ];
    // The default warehouse and any warehouse with movements are refused by the database.
    let res = state.db.delete_table("warehouses", &query, token).await?;
    if is_empty_array(&res) {
        return Err(AppError::NotFound("Warehouse not found".into()));
    }

    Ok(Json(json!({ "success": true, "data": res })))
}

async fn stock_summary(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(org_id): Path<String>,
    Query(params): Query<SummaryQuery>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    let mut rpc_payload = json!({ "p_org_id": org_id });
    if let Some(as_of) = params.as_of {
        rpc_payload["p_as_of"] = json!(as_of);
    }
    let res = state.db.rpc("get_stock_summary", &rpc_payload, token).await?;

    Ok(Json(json!({ "success": true, "data": res })))
}

async fn item_ledger(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((org_id, item_id)): Path<(String, String)>,
    Query(params): Query<LedgerQuery>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    let rpc_payload = json!({
        "p_org_id": org_id,
        "p_item_id": item_id,
        "p_from": params.from,
        "p_to": params.to,
    });
    let res = state.db.rpc("get_stock_ledger", &rpc_payload, token).await?;

    Ok(Json(json!({ "success": true, "data": res })))
}

async fn record_adjustment(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(org_id): Path<String>,
    Json(payload): Json<AdjustmentRequest>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    if !(payload.qty > 0.0) {
        return Err(AppError::BadRequest("qty must be positive".into()));
    }
    // Kind/direction rules, costs, the negative-stock guard and the journal are all in the database.
    let rpc_payload = json!({
        "p_org_id": org_id,
        "p_item_id": payload.item_id,
        "p_kind": payload.kind,
        "p_direction": payload.direction,
        "p_qty": payload.qty,
        "p_unit_cost": payload.unit_cost,
        "p_date": payload.date,
        "p_warehouse_id": payload.warehouse_id,
        "p_reason": payload.reason,
    });
    let res = state.db.rpc("record_stock_adjustment", &rpc_payload, token).await?;

    Ok(Json(json!({ "success": true, "data": res })))
}
