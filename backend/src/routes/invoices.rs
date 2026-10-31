use axum::{
    extract::{Path, State},
    http::HeaderMap,
    routing::{get, post},
    Json, Router,
};
use serde_json::{json, Value};
use crate::error::AppError;
use crate::models::invoice::{
    CancelInvoiceRequest, CreateInvoiceRequest, IssueInvoiceRequest,
};
use crate::routes::AppState;

pub fn routes(state: AppState) -> Router {
    Router::new()
        .route("/", post(create_invoice).get(list_invoices))
        .route("/:inv_id", get(get_invoice))
        .route("/:inv_id/issue", post(issue_invoice))
        .route("/:inv_id/cancel", post(cancel_invoice))
        .with_state(state)
}

fn extract_auth_token(headers: &HeaderMap) -> Option<&str> {
    headers
        .get("Authorization")
        .and_then(|h| h.to_str().ok())
        .and_then(|h| h.strip_prefix("Bearer "))
}

async fn create_invoice(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(org_id): Path<String>,
    Json(payload): Json<CreateInvoiceRequest>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);

    // 1. Insert Invoice Header
    let header_body = json!({
        "organisation_id": org_id,
        "customer_id": payload.customer_id,
        "invoice_number": payload.invoice_number,
        "invoice_date": payload.invoice_date,
        "due_date": payload.due_date,
        "status": "draft",
        "supply_type": payload.supply_type,
        "place_of_supply": payload.place_of_supply,
        "sales_channel": payload.sales_channel.unwrap_or_else(|| "direct".to_string()),
        "taxable_amount": payload.taxable_amount,
        "round_off": payload.round_off.unwrap_or(0.0),
        "total_amount": payload.total_amount,
        "notes": payload.notes,
        "terms": payload.terms,
    });

    let header_res = state.db.insert_table("sales_invoices", &header_body, token).await?;
    let inv_id = header_res
        .as_array()
        .and_then(|arr| arr.first())
        .and_then(|obj| obj.get("id"))
        .and_then(|id| id.as_str())
        .ok_or_else(|| AppError::Internal("Failed to extract created invoice id".to_string()))?;

    // 2. Insert Invoice Lines
    let lines_body: Vec<Value> = payload
        .lines
        .into_iter()
        .map(|l| {
            json!({
                "organisation_id": org_id,
                "invoice_id": inv_id,
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

    let lines_res = state
        .db
        .insert_table("sales_invoice_lines", &json!(lines_body), token)
        .await?;

    Ok(Json(json!({
        "success": true,
        "invoice": header_res,
        "lines": lines_res
    })))
}

async fn list_invoices(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(org_id): Path<String>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    let org_filter = format!("eq.{}", org_id);
    let query = [
        ("select", "*, parties(legal_name, gstin)"),
        ("organisation_id", &org_filter),
        ("order", "invoice_date.desc"),
    ];
    let res = state.db.query_table("sales_invoices", &query, token).await?;

    Ok(Json(json!({ "success": true, "data": res })))
}

async fn get_invoice(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((org_id, inv_id)): Path<(String, String)>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    let org_filter = format!("eq.{}", org_id);
    let id_filter = format!("eq.{}", inv_id);
    let query = [
        ("select", "*, sales_invoice_lines(*)"),
        ("organisation_id", &org_filter),
        ("id", &id_filter),
    ];
    let res = state.db.query_table("sales_invoices", &query, token).await?;

    Ok(Json(json!({ "success": true, "data": res })))
}

async fn issue_invoice(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((org_id, inv_id)): Path<(String, String)>,
    Json(payload): Json<IssueInvoiceRequest>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    let rpc_payload = json!({
        "p_org_id": org_id,
        "p_invoice_id": inv_id,
        "p_create_journal": payload.create_journal.unwrap_or(true),
    });

    let res = state.db.rpc("issue_sales_invoice", &rpc_payload, token).await?;

    Ok(Json(json!({
        "success": true,
        "message": "Invoice issued and verified successfully",
        "invoice": res
    })))
}

async fn cancel_invoice(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((org_id, inv_id)): Path<(String, String)>,
    Json(payload): Json<CancelInvoiceRequest>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    let rpc_payload = json!({
        "p_org_id": org_id,
        "p_invoice_id": inv_id,
        "p_reason": payload.reason,
    });

    let res = state.db.rpc("cancel_sales_invoice", &rpc_payload, token).await?;

    Ok(Json(json!({
        "success": true,
        "message": "Invoice cancelled successfully",
        "invoice": res
    })))
}
