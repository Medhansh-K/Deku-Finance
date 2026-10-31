use axum::{
    extract::{Path, State},
    http::HeaderMap,
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use serde_json::{json, Value};
use crate::error::AppError;
use crate::routes::AppState;

pub fn routes(state: AppState) -> Router {
    Router::new()
        .route("/", get(list_jobs).post(create_job))
        .route("/:job_id/apply", post(apply_job))
        .with_state(state)
}

/// The browser parses and validates the file; only the job summary is recorded here.
#[derive(Debug, Deserialize)]
pub struct CreateJobRequest {
    pub kind: String,
    pub source: String,
    pub filename: Option<String>,
    pub row_count: i64,
    #[serde(default)]
    pub errors: Vec<Value>,
    #[serde(default)]
    pub allow_opening_difference: bool,
}

#[derive(Debug, Deserialize)]
pub struct ApplyJobRequest {
    pub rows: Vec<Value>,
}

const KINDS: [&str; 5] = ["chart_of_accounts", "parties", "items", "opening_balances", "vouchers"];
const SOURCES: [&str; 2] = ["tally_xml", "csv"];

fn extract_auth_token(headers: &HeaderMap) -> Option<&str> {
    headers
        .get("Authorization")
        .and_then(|h| h.to_str().ok())
        .and_then(|h| h.strip_prefix("Bearer "))
}

async fn list_jobs(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(org_id): Path<String>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    let org_filter = format!("eq.{}", org_id);
    let query = [
        ("select", "*"),
        ("organisation_id", org_filter.as_str()),
        ("order", "created_at.desc"),
        ("limit", "100"),
    ];
    let res = state.db.query_table("import_jobs", &query, token).await?;

    Ok(Json(json!({ "success": true, "data": res })))
}

async fn create_job(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(org_id): Path<String>,
    Json(payload): Json<CreateJobRequest>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    if !KINDS.contains(&payload.kind.as_str()) || !SOURCES.contains(&payload.source.as_str()) {
        return Err(AppError::BadRequest("Unknown import kind or source".into()));
    }
    if payload.row_count < 0 {
        return Err(AppError::BadRequest("row_count must not be negative".into()));
    }
    // A job with errors stays a draft; apply_import_job refuses drafts.
    let status = if payload.errors.is_empty() { "validated" } else { "draft" };
    let body = json!({
        "organisation_id": org_id,
        "kind": payload.kind,
        "source": payload.source,
        "filename": payload.filename,
        "status": status,
        "row_count": payload.row_count,
        "error_count": payload.errors.len(),
        "errors": payload.errors,
        "allow_opening_difference": payload.allow_opening_difference,
    });
    let res = state.db.insert_table("import_jobs", &body, token).await?;

    Ok(Json(json!({ "success": true, "data": res })))
}

async fn apply_job(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((org_id, job_id)): Path<(String, String)>,
    Json(payload): Json<ApplyJobRequest>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    if payload.rows.is_empty() {
        return Err(AppError::BadRequest("No rows to import".into()));
    }
    let rpc_payload = json!({
        "p_org_id": org_id,
        "p_job_id": job_id,
        "p_rows": payload.rows,
    });
    // All or nothing: a failed job comes back with status "failed" and the row that broke it.
    let res = state.db.rpc("apply_import_job", &rpc_payload, token).await?;
    if res.get("status").and_then(|s| s.as_str()) == Some("failed") {
        // Only the id: error messages can carry party names and GSTINs.
        tracing::warn!("import job {} failed", job_id);
    }

    Ok(Json(json!({ "success": true, "data": res })))
}
