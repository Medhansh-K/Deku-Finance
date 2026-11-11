//! Supporting documents for vouchers. Bytes live in Postgres (migration 48), so one database backup
//! covers them. PostgREST carries bytea as "\x" hex in JSON.

use axum::{
    body::{Body, Bytes},
    extract::{DefaultBodyLimit, Path, Query, State},
    http::{header, HeaderMap, Response},
    routing::get,
    Json, Router,
};
use serde::Deserialize;
use serde_json::{json, Value};

use crate::error::AppError;
use crate::routes::AppState;

pub const MAX_FILE_BYTES: usize = 10 * 1024 * 1024;

const METADATA: &str = "id,journal_entry_id,filename,content_type,byte_size,category,reference,uploaded_by,created_at";

pub fn routes(state: AppState) -> Router {
    Router::new()
        .route(
            "/",
            get(list_files)
                .post(upload_file)
                .layer(DefaultBodyLimit::max(MAX_FILE_BYTES)),
        )
        .route("/:file_id", get(download_file))
        .with_state(state)
}

fn extract_auth_token(headers: &HeaderMap) -> Option<&str> {
    headers
        .get("Authorization")
        .and_then(|h| h.to_str().ok())
        .and_then(|h| h.strip_prefix("Bearer "))
}

/// From the file's own bytes: the browser's claimed type and the file extension prove nothing.
fn sniff_content_type(bytes: &[u8]) -> Option<&'static str> {
    if bytes.starts_with(b"%PDF-") {
        Some("application/pdf")
    } else if bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
        Some("image/png")
    } else if bytes.starts_with(b"\xFF\xD8\xFF") {
        Some("image/jpeg")
    } else if bytes.len() >= 12 && &bytes[..4] == b"RIFF" && &bytes[8..12] == b"WEBP" {
        Some("image/webp")
    } else {
        None
    }
}

fn to_hex(bytes: &[u8]) -> String {
    let mut out = String::with_capacity(2 + bytes.len() * 2);
    out.push_str("\\x");
    for b in bytes {
        out.push_str(&format!("{:02x}", b));
    }
    out
}

fn from_hex(text: &str) -> Option<Vec<u8>> {
    let digits = text.strip_prefix("\\x")?.as_bytes();
    if digits.len() % 2 != 0 {
        return None;
    }
    digits
        .chunks(2)
        .map(|pair| {
            let hi = (pair[0] as char).to_digit(16)?;
            let lo = (pair[1] as char).to_digit(16)?;
            Some((hi * 16 + lo) as u8)
        })
        .collect()
}

/// Safe inside a quoted Content-Disposition value, whatever the uploader named the file.
fn download_name(filename: &str) -> String {
    filename
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '_' | ' ') { c } else { '_' })
        .collect()
}

async fn list_files(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(org_id): Path<String>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    let org_filter = format!("eq.{}", org_id);
    let query = [
        ("select", METADATA),
        ("organisation_id", org_filter.as_str()),
        ("order", "created_at.desc"),
    ];
    let res = state.db.query_table("document_files", &query, token).await?;
    Ok(Json(json!({ "success": true, "data": res })))
}

#[derive(Debug, Deserialize)]
struct UploadParams {
    filename: String,
    journal_entry_id: Option<String>,
    category: Option<String>,
    reference: Option<String>,
}

async fn upload_file(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(org_id): Path<String>,
    Query(params): Query<UploadParams>,
    body: Bytes,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    if body.is_empty() {
        return Err(AppError::BadRequest("The file is empty.".into()));
    }
    let content_type = sniff_content_type(&body)
        .ok_or_else(|| AppError::BadRequest("Only PDF, PNG, JPEG or WebP files can be attached.".into()))?;

    let row = json!({
        "organisation_id": org_id,
        "journal_entry_id": params.journal_entry_id,
        "filename": params.filename,
        "content_type": content_type,
        "byte_size": body.len(),
        "category": params.category,
        "reference": params.reference,
        "data": to_hex(&body),
    });
    let res = state.db.insert_table("document_files", &row, token).await.map_err(|e| {
        if matches!(&e, AppError::Database(msg) if msg.contains("row-level security")) {
            AppError::Forbidden("You don't have permission to attach documents.".into())
        } else {
            e
        }
    })?;

    // The insert echoes the whole row; the file's bytes don't need to go back to the browser.
    let saved = res.as_array().and_then(|rows| rows.first());
    Ok(Json(json!({
        "success": true,
        "data": {
            "id": saved.and_then(|r| r.get("id")),
            "filename": saved.and_then(|r| r.get("filename")),
            "content_type": content_type,
            "byte_size": body.len(),
        }
    })))
}

async fn download_file(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((org_id, file_id)): Path<(String, String)>,
) -> Result<Response<Body>, AppError> {
    let token = extract_auth_token(&headers);
    let org_filter = format!("eq.{}", org_id);
    let id_filter = format!("eq.{}", file_id);
    let query = [
        ("select", "filename,content_type,data"),
        ("organisation_id", org_filter.as_str()),
        ("id", id_filter.as_str()),
    ];
    let rows = state.db.query_table("document_files", &query, token).await?;
    let row = rows
        .as_array()
        .and_then(|r| r.first())
        .ok_or_else(|| AppError::NotFound("File not found.".into()))?;

    let bytes = row
        .get("data")
        .and_then(Value::as_str)
        .and_then(from_hex)
        .ok_or_else(|| AppError::Internal("Stored file could not be read.".into()))?;
    let content_type = row.get("content_type").and_then(Value::as_str).unwrap_or("application/octet-stream");
    let filename = download_name(row.get("filename").and_then(Value::as_str).unwrap_or("document"));

    // Attachment and nosniff: an uploaded file must never run as a page on this origin.
    Response::builder()
        .header(header::CONTENT_TYPE, content_type)
        .header(header::CONTENT_DISPOSITION, format!("attachment; filename=\"{}\"", filename))
        .header(header::X_CONTENT_TYPE_OPTIONS, "nosniff")
        .header(header::CACHE_CONTROL, "private, no-store")
        .body(Body::from(bytes))
        .map_err(|e| AppError::Internal(format!("Could not build the download: {}", e)))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn recognises_allowed_types_by_content() {
        assert_eq!(sniff_content_type(b"%PDF-1.7 rest"), Some("application/pdf"));
        assert_eq!(sniff_content_type(b"\x89PNG\r\n\x1a\nrest"), Some("image/png"));
        assert_eq!(sniff_content_type(b"\xFF\xD8\xFF\xE0rest"), Some("image/jpeg"));
        assert_eq!(sniff_content_type(b"RIFF\0\0\0\0WEBPrest"), Some("image/webp"));
    }

    #[test]
    fn refuses_anything_else() {
        assert_eq!(sniff_content_type(b"<html><script>alert(1)</script>"), None);
        assert_eq!(sniff_content_type(b"MZ\x90\0"), None);
        assert_eq!(sniff_content_type(b"RIFF"), None);
        assert_eq!(sniff_content_type(b""), None);
    }

    #[test]
    fn hex_round_trips() {
        let bytes = vec![0u8, 1, 127, 128, 255];
        assert_eq!(to_hex(&bytes), "\\x00017f80ff");
        assert_eq!(from_hex(&to_hex(&bytes)), Some(bytes));
        assert_eq!(from_hex("no prefix"), None);
        assert_eq!(from_hex("\\xabc"), None);
        assert_eq!(from_hex("\\xzz"), None);
    }

    #[test]
    fn download_name_cannot_break_the_header() {
        assert_eq!(download_name("a\"b\r\nc.pdf"), "a_b__c.pdf");
        assert_eq!(download_name("Bill 12-A_final.pdf"), "Bill 12-A_final.pdf");
    }
}
