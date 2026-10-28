use axum::{
    extract::{Path, State},
    http::HeaderMap,
    routing::{get, post},
    Json, Router,
};
use serde_json::{json, Value};
use crate::error::AppError;
use crate::models::document::{
    CreateVoucherProposalRequest, RegisterDocumentRequest, SaveExtractionRequest,
};
use crate::routes::AppState;

pub fn routes(state: AppState) -> Router {
    Router::new()
        .route("/", post(register_document).get(list_documents))
        .route("/extractions", post(save_extraction))
        .route("/:doc_id/extractions", get(get_document_extractions))
        .route("/proposals", post(create_voucher_proposal).get(list_voucher_proposals))
        .route("/proposals/:proposal_id/approve", post(approve_voucher_proposal))
        .with_state(state)
}

fn extract_auth_token(headers: &HeaderMap) -> Option<&str> {
    headers
        .get("Authorization")
        .and_then(|h| h.to_str().ok())
        .and_then(|h| h.strip_prefix("Bearer "))
}

/// POST /api/v1/organisations/:org_id/documents
/// Registers an uploaded document in `invoice_documents`, checking for duplicate SHA-256 hashes.
async fn register_document(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(org_id): Path<String>,
    Json(payload): Json<RegisterDocumentRequest>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);

    // 1. Duplicate hash check if sha256_hash is provided
    if let Some(ref hash) = payload.sha256_hash {
        let org_filter = format!("eq.{}", org_id);
        let hash_filter = format!("eq.{}", hash);
        let check_query = [
            ("select", "id,document_id,created_at"),
            ("organisation_id", &org_filter),
            ("sha256_hash", &hash_filter),
            ("limit", "1"),
        ];

        let existing = state
            .supabase
            .query_table("document_extractions", &check_query, token)
            .await;

        if let Ok(res) = existing {
            if let Some(arr) = res.as_array() {
                if !arr.is_empty() {
                    return Ok(Json(json!({
                        "success": false,
                        "is_duplicate": true,
                        "error": "Duplicate document detected. This file has already been ingested.",
                        "existing_record": arr[0]
                    })));
                }
            }
        }
    }

    // 2. Insert metadata into invoice_documents
    let doc_body = json!({
        "organisation_id": org_id,
        "filename": payload.filename,
        "storage_path": payload.storage_path,
        "byte_size": payload.byte_size,
        "mime_type": payload.mime_type,
        "document_type": payload.document_type,
        "invoice_id": payload.invoice_id,
        "metadata": payload.metadata.unwrap_or_else(|| json!({
            "sha256": payload.sha256_hash
        }))
    });

    let res = state
        .supabase
        .insert_table("invoice_documents", &doc_body, token)
        .await?;

    Ok(Json(json!({
        "success": true,
        "is_duplicate": false,
        "data": res
    })))
}

/// GET /api/v1/organisations/:org_id/documents
/// Lists documents belonging to the organisation.
async fn list_documents(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(org_id): Path<String>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    let org_filter = format!("eq.{}", org_id);
    let query = [
        ("select", "*"),
        ("organisation_id", &org_filter),
        ("order", "created_at.desc"),
        ("limit", "100"),
    ];

    let res = state
        .supabase
        .query_table("invoice_documents", &query, token)
        .await?;

    Ok(Json(json!({
        "success": true,
        "data": res
    })))
}

/// POST /api/v1/organisations/:org_id/documents/extractions
/// Saves normalized extraction results (UFO 2.0) into `document_extractions`.
async fn save_extraction(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(org_id): Path<String>,
    Json(payload): Json<SaveExtractionRequest>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);

    let body = json!({
        "organisation_id": org_id,
        "document_id": payload.document_id,
        "storage_path": payload.storage_path,
        "sha256_hash": payload.sha256_hash,
        "sarvam_job_id": payload.sarvam_job_id,
        "document_nature": payload.document_nature,
        "detected_language": payload.detected_language,
        "raw_markdown_output": payload.raw_markdown_output,
        "ufo_payload": payload.ufo_payload,
        "confidence_score": payload.confidence_score
    });

    let res = state
        .supabase
        .insert_table("document_extractions", &body, token)
        .await?;

    Ok(Json(json!({
        "success": true,
        "data": res
    })))
}

/// GET /api/v1/organisations/:org_id/documents/:doc_id/extractions
/// Fetches extractions for a specific document.
async fn get_document_extractions(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((org_id, doc_id)): Path<(String, String)>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    let org_filter = format!("eq.{}", org_id);
    let doc_filter = format!("eq.{}", doc_id);

    let query = [
        ("select", "*"),
        ("organisation_id", &org_filter),
        ("document_id", &doc_filter),
        ("order", "created_at.desc"),
    ];

    let res = state
        .supabase
        .query_table("document_extractions", &query, token)
        .await?;

    Ok(Json(json!({
        "success": true,
        "data": res
    })))
}

/// POST /api/v1/organisations/:org_id/documents/proposals
/// Stages a balanced voucher proposal bundled with its document proof.
async fn create_voucher_proposal(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(org_id): Path<String>,
    Json(payload): Json<CreateVoucherProposalRequest>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);

    let body = json!({
        "organisation_id": org_id,
        "session_id": payload.session_id,
        "document_id": payload.document_id,
        "voucher_type": payload.voucher_type,
        "voucher_date": payload.voucher_date.unwrap_or_else(|| chrono::Utc::now().format("%Y-%m-%d").to_string()),
        "party_id": payload.party_id,
        "header_memo": payload.header_memo,
        "proposed_lines": payload.proposed_lines,
        "total_debit": payload.total_debit,
        "total_credit": payload.total_credit,
        "approval_status": "waiting_approval"
    });

    let res = state
        .supabase
        .insert_table("agent_voucher_proposals", &body, token)
        .await?;

    Ok(Json(json!({
        "success": true,
        "data": res
    })))
}

/// GET /api/v1/organisations/:org_id/documents/proposals
/// Lists staged voucher proposals waiting for human approval.
async fn list_voucher_proposals(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(org_id): Path<String>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    let org_filter = format!("eq.{}", org_id);

    let query = [
        ("select", "*,invoice_documents(filename,storage_path)"),
        ("organisation_id", &org_filter),
        ("order", "created_at.desc"),
        ("limit", "50"),
    ];

    let res = state
        .supabase
        .query_table("agent_voucher_proposals", &query, token)
        .await?;

    Ok(Json(json!({
        "success": true,
        "data": res
    })))
}

/// POST /api/v1/organisations/:org_id/documents/proposals/:proposal_id/approve
/// Approves a staged voucher proposal.
async fn approve_voucher_proposal(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((org_id, proposal_id)): Path<(String, String)>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);

    let org_filter = format!("eq.{}", org_id);
    let id_filter = format!("eq.{}", proposal_id);
    let update_query = [
        ("organisation_id", org_filter.as_str()),
        ("id", id_filter.as_str()),
    ];

    let update_body = json!({
        "approval_status": "approved",
        "approved_at": chrono::Utc::now().to_rfc3339()
    });

    let res = state
        .supabase
        .update_table("agent_voucher_proposals", &update_query, &update_body, token)
        .await?;

    Ok(Json(json!({
        "success": true,
        "message": "Voucher proposal approved",
        "data": res
    })))
}
