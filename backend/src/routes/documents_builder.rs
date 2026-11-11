use axum::{
    extract::{Path, Query, State},
    http::HeaderMap,
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use serde_json::{json, Value};
use crate::error::AppError;
use crate::routes::AppState;

/// Quotations, proformas, purchase orders and delivery challans (migration 44).
pub fn routes(state: AppState) -> Router {
    Router::new()
        .route("/", get(list_documents).post(create_document))
        .route(
            "/:doc_id",
            get(get_document).put(update_document).delete(delete_document),
        )
        .route("/:doc_id/status", post(set_status))
        .route("/:doc_id/link-invoice", post(link_invoice))
        .route("/:doc_id/convert", post(convert_document))
        .with_state(state)
}

#[derive(Debug, Deserialize)]
pub struct ListQuery {
    pub doc_type: Option<String>,
    pub status: Option<String>,
}

/// Header fields and lines go to save_business_document as given: it validates them, replaces
/// the lines and computes the header totals in one transaction.
#[derive(Debug, Deserialize)]
pub struct SaveDocumentRequest {
    pub doc: serde_json::Map<String, Value>,
    pub lines: Vec<Value>,
}

#[derive(Debug, Deserialize)]
pub struct StatusRequest {
    pub status: String,
}

#[derive(Debug, Deserialize)]
pub struct LinkInvoiceRequest {
    pub invoice_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ConvertRequest {
    pub invoice_number: String,
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

async fn list_documents(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(org_id): Path<String>,
    Query(params): Query<ListQuery>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    let mut query = vec![
        ("select", "*,parties(legal_name,gstin)".to_string()),
        ("organisation_id", format!("eq.{}", org_id)),
        ("order", "doc_date.desc,created_at.desc".to_string()),
    ];
    if let Some(t) = params.doc_type.filter(|t| !t.is_empty()) {
        query.push(("doc_type", format!("eq.{}", t)));
    }
    if let Some(s) = params.status.filter(|s| !s.is_empty()) {
        query.push(("status", format!("eq.{}", s)));
    }
    let query: Vec<(&str, &str)> = query.iter().map(|(k, v)| (*k, v.as_str())).collect();
    let res = state.db.query_table("business_documents", &query, token).await?;

    Ok(Json(json!({ "success": true, "data": res })))
}

async fn get_document(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((org_id, doc_id)): Path<(String, String)>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    let org_filter = format!("eq.{}", org_id);
    let id_filter = format!("eq.{}", doc_id);
    let query = [
        ("select", "*,parties(legal_name,gstin),business_document_lines(*)"),
        ("organisation_id", org_filter.as_str()),
        ("id", id_filter.as_str()),
        ("business_document_lines.order", "line_number.asc"),
    ];
    let res = state.db.query_table("business_documents", &query, token).await?;
    if is_empty_array(&res) {
        return Err(AppError::NotFound("Document not found".into()));
    }

    Ok(Json(json!({ "success": true, "data": res })))
}

async fn save(
    state: &AppState,
    token: Option<&str>,
    org_id: &str,
    doc: serde_json::Map<String, Value>,
    lines: Vec<Value>,
) -> Result<Json<Value>, AppError> {
    if lines.is_empty() {
        return Err(AppError::BadRequest("A document needs at least one line".into()));
    }
    let rpc_payload = json!({ "p_org_id": org_id, "p_doc": doc, "p_lines": lines });
    let res = state.db.rpc("save_business_document", &rpc_payload, token).await?;

    Ok(Json(json!({ "success": true, "data": res })))
}

async fn create_document(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(org_id): Path<String>,
    Json(payload): Json<SaveDocumentRequest>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    let mut doc = payload.doc;
    // An id makes the database update instead of insert; creating never targets an existing row.
    doc.remove("id");
    save(&state, token, &org_id, doc, payload.lines).await
}

async fn update_document(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((org_id, doc_id)): Path<(String, String)>,
    Json(payload): Json<SaveDocumentRequest>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    let mut doc = payload.doc;
    doc.insert("id".into(), Value::String(doc_id));
    save(&state, token, &org_id, doc, payload.lines).await
}

async fn delete_document(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((org_id, doc_id)): Path<(String, String)>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    let org_filter = format!("eq.{}", org_id);
    let id_filter = format!("eq.{}", doc_id);
    let query = [("organisation_id", org_filter.as_str()), ("id", id_filter.as_str())];
    let res = state.db.delete_table("business_documents", &query, token).await?;
    if is_empty_array(&res) {
        return Err(AppError::NotFound(
            "Document not found, not a draft, or you can't delete it".into(),
        ));
    }

    Ok(Json(json!({ "success": true, "data": res })))
}

async fn set_status(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((org_id, doc_id)): Path<(String, String)>,
    Json(payload): Json<StatusRequest>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    if payload.status == "converted" {
        return Err(AppError::BadRequest("Use the convert action to convert a document".into()));
    }
    // The guard trigger decides which moves are allowed.
    let org_filter = format!("eq.{}", org_id);
    let id_filter = format!("eq.{}", doc_id);
    let query = [("organisation_id", org_filter.as_str()), ("id", id_filter.as_str())];
    let body = json!({ "status": payload.status });
    let res = state.db.update_table("business_documents", &query, &body, token).await?;
    if is_empty_array(&res) {
        return Err(AppError::NotFound("Document not found or no longer changeable".into()));
    }

    Ok(Json(json!({ "success": true, "data": res })))
}

async fn link_invoice(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((org_id, doc_id)): Path<(String, String)>,
    Json(payload): Json<LinkInvoiceRequest>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    let org_filter = format!("eq.{}", org_id);
    let id_filter = format!("eq.{}", doc_id);
    let query = [("organisation_id", org_filter.as_str()), ("id", id_filter.as_str())];
    // Only challans accept a link (CHECK constraint); the invoice must be in the same company (FK).
    let body = json!({ "linked_invoice_id": payload.invoice_id });
    let res = state.db.update_table("business_documents", &query, &body, token).await?;
    if is_empty_array(&res) {
        return Err(AppError::NotFound("Document not found or no longer changeable".into()));
    }

    Ok(Json(json!({ "success": true, "data": res })))
}

async fn convert_document(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((org_id, doc_id)): Path<(String, String)>,
    Json(payload): Json<ConvertRequest>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    if payload.invoice_number.trim().is_empty() {
        return Err(AppError::BadRequest("invoice_number is required".into()));
    }
    let rpc_payload = json!({
        "p_org_id": org_id,
        "p_doc_id": doc_id,
        "p_invoice_number": payload.invoice_number.trim(),
    });
    let res = state.db.rpc("convert_business_document", &rpc_payload, token).await?;

    Ok(Json(json!({
        "success": true,
        "message": "Converted to a draft sales invoice; issue it from the GST hub",
        "data": res
    })))
}
