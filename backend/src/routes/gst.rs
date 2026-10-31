use axum::{
    extract::{Path, State},
    http::HeaderMap,
    routing::{get, patch, post},
    Json, Router,
};
use serde::de::DeserializeOwned;
use serde::Deserialize;
use serde_json::{json, Value};
use crate::error::AppError;
use crate::gst::{self, Books, ReturnResult};
use crate::routes::AppState;

pub fn routes(state: AppState) -> Router {
    Router::new()
        .route("/:period/gstr1", get(get_gstr1))
        .route("/:period/gstr3b", get(get_gstr3b))
        .route("/:period/:return_type/record", post(record_return))
        .route("/:period/:return_type/filed", patch(mark_filed))
        .with_state(state)
}

#[derive(Debug, Deserialize)]
pub struct MarkFiledRequest {
    pub arn: String,
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

/// "gstr1" / "gstr3b" in the path to the stored return_type.
fn return_type(path: &str) -> Result<&'static str, AppError> {
    match path.to_ascii_lowercase().as_str() {
        "gstr1" => Ok("GSTR1"),
        "gstr3b" => Ok("GSTR3B"),
        _ => Err(AppError::BadRequest("return type must be gstr1 or gstr3b".into())),
    }
}

fn rows<T: DeserializeOwned>(v: Value, what: &str) -> Result<Vec<T>, AppError> {
    serde_json::from_value(v).map_err(|e| AppError::Internal(format!("Unreadable {}: {}", what, e)))
}

/// The company's books for one MMYYYY period, read with the caller's token so RLS applies.
async fn load_books(state: &AppState, token: Option<&str>, org_id: &str, period: &str) -> Result<Books, AppError> {
    if !gst::is_ret_period(period) {
        return Err(AppError::BadRequest("period must be MMYYYY, e.g. 102026".into()));
    }
    let month: u32 = period[..2].parse().unwrap_or(1);
    let year: u32 = period[2..].parse().unwrap_or(0);
    let from = format!("gte.{}-01", gst::period_month(period));
    let (ny, nm) = if month == 12 { (year + 1, 1) } else { (year, month + 1) };
    let before = format!("lt.{:04}-{:02}-01", ny, nm);
    let org = format!("eq.{}", org_id);

    let org_q = [("select", "gstin"), ("id", org.as_str())];
    let inv_q = [
        ("select", "*,parties(legal_name,gstin),sales_invoice_lines(*)"),
        ("organisation_id", org.as_str()),
        ("invoice_date", from.as_str()),
        ("invoice_date", before.as_str()),
        ("order", "invoice_date.asc,invoice_number.asc"),
        ("sales_invoice_lines.order", "line_number.asc"),
    ];
    let acc_q = [("select", "id,name"), ("organisation_id", org.as_str())];
    let jnl_q = [
        ("select", "*,journal_entry_lines(*)"),
        ("organisation_id", org.as_str()),
        ("entry_date", from.as_str()),
        ("entry_date", before.as_str()),
        ("order", "entry_date.asc"),
    ];
    let bill_q = [
        ("select", "*"),
        ("organisation_id", org.as_str()),
        ("bill_date", from.as_str()),
        ("bill_date", before.as_str()),
        ("order", "bill_date.asc,created_at.asc"),
    ];
    let note_q = [
        (
            "select",
            "*,parties(gstin),sales_note_lines(*),sales_invoices(invoice_number,invoice_type,total_amount)",
        ),
        ("organisation_id", org.as_str()),
        ("note_date", from.as_str()),
        ("note_date", before.as_str()),
        ("order", "note_date.asc,note_number.asc"),
        ("sales_note_lines.order", "line_number.asc"),
    ];
    let (orgs, invoices, accounts, journals, bills, notes) = tokio::try_join!(
        state.db.query_table("organisations", &org_q, token),
        state.db.query_table("sales_invoices", &inv_q, token),
        state.db.query_table("accounts", &acc_q, token),
        state.db.query_table("journal_entries", &jnl_q, token),
        state.db.query_table("purchase_bills", &bill_q, token),
        state.db.query_table("sales_notes", &note_q, token),
    )?;

    let org_row = orgs
        .as_array()
        .and_then(|a| a.first())
        .ok_or_else(|| AppError::NotFound("Company not found".into()))?;
    Ok(Books {
        gstin: org_row.get("gstin").and_then(|g| g.as_str()).map(String::from),
        ret_period: period.to_string(),
        invoices: rows(invoices, "invoices")?,
        accounts: rows(accounts, "accounts")?,
        journals: rows(journals, "journals")?,
        purchase_bills: rows(bills, "purchase bills")?,
        notes: rows(notes, "credit/debit notes")?,
    })
}

fn build(kind: &str, books: &Books) -> ReturnResult {
    if kind == "GSTR1" {
        gst::build_gstr1(books)
    } else {
        gst::build_gstr3b(books)
    }
}

async fn get_gstr1(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((org_id, period)): Path<(String, String)>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    let books = load_books(&state, token, &org_id, &period).await?;
    Ok(Json(json!({ "success": true, "data": gst::build_gstr1(&books) })))
}

async fn get_gstr3b(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((org_id, period)): Path<(String, String)>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    let books = load_books(&state, token, &org_id, &period).await?;
    Ok(Json(json!({ "success": true, "data": gst::build_gstr3b(&books) })))
}

/// Recomputes from the books (never trusts a client-sent JSON) and stores it as prepared.
async fn record_return(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((org_id, period, rt)): Path<(String, String, String)>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    let kind = return_type(&rt)?;
    let books = load_books(&state, token, &org_id, &period).await?;
    let result = build(kind, &books);
    let Some(return_json) = result.json.clone().filter(|_| result.errors.is_empty()) else {
        return Err(AppError::BadRequest(format!(
            "{} has {} blocking issue(s): {}",
            kind,
            result.errors.len(),
            result.errors.join(" ")
        )));
    };

    let org_filter = format!("eq.{}", org_id);
    let period_filter = format!("eq.{}", period);
    let type_filter = format!("eq.{}", kind);
    let key = [
        ("select", "status"),
        ("organisation_id", org_filter.as_str()),
        ("ret_period", period_filter.as_str()),
        ("return_type", type_filter.as_str()),
    ];
    let existing = state.db.query_table("gst_return_filings", &key, token).await?;
    if existing.get(0).and_then(|r| r.get("status")).and_then(|s| s.as_str()) == Some("filed") {
        return Err(AppError::Conflict(format!("{} for {} is already filed", kind, period)));
    }

    // prepared_by / prepared_at are stamped by the table's trigger from the caller's token.
    let body = json!({
        "organisation_id": org_id,
        "ret_period": period,
        "return_type": kind,
        "json": return_json,
        "summary": { "rows": result.summary, "table6": result.table6 },
        "status": "prepared",
    });
    let res = state
        .db
        .upsert_table("gst_return_filings", "organisation_id,ret_period,return_type", &body, token)
        .await?;

    Ok(Json(json!({ "success": true, "data": res })))
}

async fn mark_filed(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((org_id, period, rt)): Path<(String, String, String)>,
    Json(payload): Json<MarkFiledRequest>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    let kind = return_type(&rt)?;
    let arn = payload.arn.trim().to_ascii_uppercase();
    if arn.is_empty() || !arn.chars().all(|c| c.is_ascii_alphanumeric()) {
        return Err(AppError::BadRequest("ARN must be the letters and digits shown on the portal".into()));
    }

    let org_filter = format!("eq.{}", org_id);
    let period_filter = format!("eq.{}", period);
    let type_filter = format!("eq.{}", kind);
    let query = [
        ("organisation_id", org_filter.as_str()),
        ("ret_period", period_filter.as_str()),
        ("return_type", type_filter.as_str()),
        ("status", "eq.prepared"),
    ];
    // filed_by / filed_at come from the trigger, which also freezes the prepared JSON.
    let body = json!({ "status": "filed", "filed_arn": arn });
    let res = state
        .db
        .update_table("gst_return_filings", &query, &body, token)
        .await?;
    if is_empty_array(&res) {
        return Err(AppError::NotFound(format!(
            "No prepared {} for {} to mark filed (record it first; a filed return can't change)",
            kind, period
        )));
    }

    Ok(Json(json!({ "success": true, "data": res })))
}
