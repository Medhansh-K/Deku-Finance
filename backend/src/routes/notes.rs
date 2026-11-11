use axum::{
    extract::{Path, State},
    http::HeaderMap,
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use serde_json::{json, Value};
use crate::error::AppError;
use crate::models::invoice::{CancelInvoiceRequest, CreateInvoiceLineRequest};
use crate::routes::AppState;

pub fn routes(state: AppState) -> Router {
    Router::new()
        .route("/", post(create_note).get(list_notes))
        .route("/:note_id", get(get_note))
        .route("/:note_id/issue", post(issue_note))
        .route("/:note_id/cancel", post(cancel_note))
        .with_state(state)
}

/// Customer, supply type and place of supply are copied from the original invoice by the
/// database (migration 31), so the client doesn't send them.
#[derive(Debug, Deserialize)]
pub struct CreateNoteRequest {
    pub original_invoice_id: String,
    pub note_type: String, // credit | debit
    pub note_number: String,
    pub note_date: String,
    pub reason_code: String,
    pub reason: Option<String>,
    pub lines: Vec<CreateInvoiceLineRequest>,
}

fn extract_auth_token(headers: &HeaderMap) -> Option<&str> {
    headers
        .get("Authorization")
        .and_then(|h| h.to_str().ok())
        .and_then(|h| h.strip_prefix("Bearer "))
}

async fn create_note(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(org_id): Path<String>,
    Json(payload): Json<CreateNoteRequest>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    if payload.note_number.trim().is_empty() {
        return Err(AppError::BadRequest("note_number is required".into()));
    }
    if payload.lines.is_empty() {
        return Err(AppError::BadRequest("A note needs at least one line".into()));
    }

    let header_body = json!({
        "organisation_id": org_id,
        "original_invoice_id": payload.original_invoice_id,
        "note_type": payload.note_type,
        "note_number": payload.note_number.trim(),
        "note_date": payload.note_date,
        "reason_code": payload.reason_code,
        "reason": payload.reason,
        "status": "draft",
    });
    let header_res = state.db.insert_table("sales_notes", &header_body, token).await?;
    let note_id = header_res
        .as_array()
        .and_then(|arr| arr.first())
        .and_then(|obj| obj.get("id"))
        .and_then(|id| id.as_str())
        .ok_or_else(|| AppError::Internal("Failed to extract created note id".to_string()))?
        .to_string();

    let lines_body: Vec<Value> = payload
        .lines
        .into_iter()
        .map(|l| {
            json!({
                "organisation_id": org_id,
                "note_id": note_id,
                "line_number": l.line_number,
                "item_id": l.item_id,
                "item_name": l.item_name,
                "description": l.description,
                "hsn_sac_code": l.hsn_sac_code,
                "unit_code": l.unit_code.unwrap_or_else(|| "OTH".to_string()),
                "quantity": l.quantity,
                "unit_price": l.unit_price,
                "discount_amount": l.discount_amount.unwrap_or(0.0),
                "taxable_amount": l.taxable_amount,
                "gst_rate": l.gst_rate,
                "cgst_rate": l.cgst_rate.unwrap_or(0.0),
                "cgst_amount": l.cgst_amount.unwrap_or(0.0),
                "sgst_rate": l.sgst_rate.unwrap_or(0.0),
                "sgst_amount": l.sgst_amount.unwrap_or(0.0),
                "igst_rate": l.igst_rate.unwrap_or(0.0),
                "igst_amount": l.igst_amount.unwrap_or(0.0),
                "cess_rate": l.cess_rate.unwrap_or(0.0),
                "cess_amount": l.cess_amount.unwrap_or(0.0),
                "total_amount": l.total_amount,
            })
        })
        .collect();

    let lines_res = match state.db.insert_table("sales_note_lines", &json!(lines_body), token).await {
        Ok(res) => res,
        Err(e) => {
            // Don't leave an empty draft behind; the user retries with the same note number.
            let id_filter = format!("eq.{}", note_id);
            let _ = state.db.delete_table("sales_notes", &[("id", id_filter.as_str())], token).await;
            return Err(e);
        }
    };

    Ok(Json(json!({ "success": true, "note": header_res, "lines": lines_res })))
}

async fn list_notes(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(org_id): Path<String>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    let org_filter = format!("eq.{}", org_id);
    let query = [
        ("select", "*,parties(legal_name,gstin),sales_invoices(invoice_number,invoice_date)"),
        ("organisation_id", org_filter.as_str()),
        ("order", "note_date.desc,note_number.desc"),
    ];
    let res = state.db.query_table("sales_notes", &query, token).await?;

    Ok(Json(json!({ "success": true, "data": res })))
}

async fn get_note(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((org_id, note_id)): Path<(String, String)>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    let org_filter = format!("eq.{}", org_id);
    let id_filter = format!("eq.{}", note_id);
    let query = [
        (
            "select",
            "*,parties(legal_name,gstin),sales_invoices(invoice_number,invoice_date),sales_note_lines(*)",
        ),
        ("organisation_id", org_filter.as_str()),
        ("id", id_filter.as_str()),
        ("sales_note_lines.order", "line_number.asc"),
    ];
    let res = state.db.query_table("sales_notes", &query, token).await?;

    Ok(Json(json!({ "success": true, "data": res })))
}

async fn issue_note(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((org_id, note_id)): Path<(String, String)>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    let rpc_payload = json!({ "p_org_id": org_id, "p_note_id": note_id });
    let res = state.db.rpc("issue_sales_note", &rpc_payload, token).await?;

    Ok(Json(json!({
        "success": true,
        "message": "Note issued and its journal posted",
        "note": res
    })))
}

async fn cancel_note(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((org_id, note_id)): Path<(String, String)>,
    Json(payload): Json<CancelInvoiceRequest>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    let rpc_payload = json!({ "p_org_id": org_id, "p_note_id": note_id, "p_reason": payload.reason });
    let res = state.db.rpc("cancel_sales_note", &rpc_payload, token).await?;

    Ok(Json(json!({
        "success": true,
        "message": "Note cancelled and its journal reversed",
        "note": res
    })))
}
