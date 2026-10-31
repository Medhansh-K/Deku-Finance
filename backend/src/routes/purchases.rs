use axum::{
    extract::{Path, Query, State},
    http::HeaderMap,
    routing::{delete, get},
    Json, Router,
};
use serde::Deserialize;
use serde_json::{json, Value};
use crate::error::AppError;
use crate::routes::AppState;

pub fn routes(state: AppState) -> Router {
    Router::new()
        .route("/", get(list_purchase_bills).post(create_purchase_bill))
        .route(
            "/:bill_id",
            delete(delete_purchase_bill).patch(link_purchase_bill_journal),
        )
        .with_state(state)
}

#[derive(Debug, Deserialize)]
pub struct ListPurchaseBillsQuery {
    /// Inclusive yyyy-mm-dd bounds on bill_date.
    pub from: Option<String>,
    pub to: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreatePurchaseBillRequest {
    pub party_id: Option<String>,
    pub supplier_name: String,
    pub supplier_gstin: String,
    pub bill_number: String,
    pub bill_date: String,
    pub place_of_supply: String,
    pub taxable_amount: f64,
    pub cgst: f64,
    pub sgst: f64,
    pub igst: f64,
    pub cess: f64,
    pub total_amount: f64,
    pub itc_eligibility: String,
    pub blocked_reason: Option<String>,
    pub journal_entry_id: Option<String>,
    /// Optional item lines (migration 42); tracked items enter stock when the voucher is linked.
    pub lines: Option<Vec<PurchaseBillLineRequest>>,
}

#[derive(Debug, Deserialize)]
pub struct PurchaseBillLineRequest {
    pub item_id: String,
    pub quantity: f64,
    pub rate: f64,
}

#[derive(Debug, Deserialize)]
pub struct LinkJournalRequest {
    pub journal_entry_id: String,
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

async fn list_purchase_bills(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(org_id): Path<String>,
    Query(params): Query<ListPurchaseBillsQuery>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    let org_filter = format!("eq.{}", org_id);
    let mut query = vec![
        ("select", "*".to_string()),
        ("organisation_id", org_filter),
        ("order", "bill_date.desc,created_at.desc".to_string()),
    ];
    if let Some(from) = params.from {
        query.push(("bill_date", format!("gte.{}", from)));
    }
    if let Some(to) = params.to {
        query.push(("bill_date", format!("lte.{}", to)));
    }
    let query: Vec<(&str, &str)> = query.iter().map(|(k, v)| (*k, v.as_str())).collect();
    let res = state
        .db
        .query_table("purchase_bills", &query, token)
        .await?;

    Ok(Json(json!({ "success": true, "data": res })))
}

async fn create_purchase_bill(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(org_id): Path<String>,
    Json(payload): Json<CreatePurchaseBillRequest>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    if payload.bill_number.trim().is_empty() {
        return Err(AppError::BadRequest("bill_number is required".into()));
    }
    if payload.supplier_gstin.trim().is_empty() {
        return Err(AppError::BadRequest("supplier_gstin is required".into()));
    }

    let lines = payload.lines.unwrap_or_default();
    // Lines can only be added while the bill has no voucher, so link it after inserting them.
    let initial_journal = if lines.is_empty() { payload.journal_entry_id.clone() } else { None };
    // Tax split, totals and GSTIN format are enforced by the table's CHECK constraints;
    // created_by is filled by the database from the caller's token.
    let body = json!({
        "organisation_id": org_id,
        "party_id": payload.party_id,
        "supplier_name": payload.supplier_name,
        "supplier_gstin": payload.supplier_gstin,
        "bill_number": payload.bill_number,
        "bill_date": payload.bill_date,
        "place_of_supply": payload.place_of_supply,
        "taxable_amount": payload.taxable_amount,
        "cgst": payload.cgst,
        "sgst": payload.sgst,
        "igst": payload.igst,
        "cess": payload.cess,
        "total_amount": payload.total_amount,
        "itc_eligibility": payload.itc_eligibility,
        "blocked_reason": payload.blocked_reason,
        "journal_entry_id": initial_journal,
    });
    let res = state
        .db
        .insert_table("purchase_bills", &body, token)
        .await?;
    if lines.is_empty() {
        return Ok(Json(json!({ "success": true, "data": res })));
    }

    let bill_id = res
        .as_array()
        .and_then(|arr| arr.first())
        .and_then(|obj| obj.get("id"))
        .and_then(|id| id.as_str())
        .ok_or_else(|| AppError::Internal("Failed to extract created bill id".to_string()))?
        .to_string();
    let id_filter = format!("eq.{}", bill_id);
    let lines_body: Vec<Value> = lines
        .iter()
        .map(|l| {
            json!({
                "organisation_id": org_id,
                "bill_id": bill_id,
                "item_id": l.item_id,
                "quantity": l.quantity,
                "rate": l.rate,
            })
        })
        .collect();
    if let Err(e) = state
        .db
        .insert_table("purchase_bill_lines", &json!(lines_body), token)
        .await
    {
        // Don't leave a bill without its lines; the user retries with the same bill number.
        let _ = state
            .db
            .delete_table("purchase_bills", &[("id", id_filter.as_str())], token)
            .await;
        return Err(e);
    }
    let res = match payload.journal_entry_id {
        Some(journal_entry_id) => {
            state
                .db
                .update_table(
                    "purchase_bills",
                    &[("id", id_filter.as_str())],
                    &json!({ "journal_entry_id": journal_entry_id }),
                    token,
                )
                .await?
        }
        None => res,
    };

    Ok(Json(json!({ "success": true, "data": res })))
}

async fn link_purchase_bill_journal(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((org_id, bill_id)): Path<(String, String)>,
    Json(payload): Json<LinkJournalRequest>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    let org_filter = format!("eq.{}", org_id);
    let id_filter = format!("eq.{}", bill_id);
    let query = [
        ("organisation_id", org_filter.as_str()),
        ("id", id_filter.as_str()),
    ];
    let body = json!({ "journal_entry_id": payload.journal_entry_id });
    let res = state
        .db
        .update_table("purchase_bills", &query, &body, token)
        .await?;
    // RLS hides bills that already have a voucher, so PostgREST returns an empty list.
    if is_empty_array(&res) {
        return Err(AppError::NotFound(
            "Purchase bill not found or already linked to a voucher".into(),
        ));
    }

    Ok(Json(json!({ "success": true, "data": res })))
}

async fn delete_purchase_bill(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((org_id, bill_id)): Path<(String, String)>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    let org_filter = format!("eq.{}", org_id);
    let id_filter = format!("eq.{}", bill_id);
    let query = [
        ("organisation_id", org_filter.as_str()),
        ("id", id_filter.as_str()),
    ];
    let res = state
        .db
        .delete_table("purchase_bills", &query, token)
        .await?;
    if is_empty_array(&res) {
        return Err(AppError::NotFound(
            "Purchase bill not found or linked to a voucher (reverse the voucher instead)".into(),
        ));
    }

    Ok(Json(json!({ "success": true, "data": res })))
}
