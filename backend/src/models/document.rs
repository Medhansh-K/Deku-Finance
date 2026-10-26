use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Serialize, Deserialize)]
pub struct RegisterDocumentRequest {
    pub filename: String,
    pub storage_path: String,
    pub byte_size: i64,
    #[serde(default = "default_mime_type")]
    pub mime_type: String,
    #[serde(default = "default_document_type")]
    pub document_type: String,
    pub sha256_hash: Option<String>,
    pub invoice_id: Option<String>,
    pub metadata: Option<Value>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SaveExtractionRequest {
    pub document_id: String,
    pub storage_path: String,
    pub sha256_hash: String,
    pub sarvam_job_id: Option<String>,
    #[serde(default = "default_document_nature")]
    pub document_nature: String, // 'printed', 'handwritten', 'mixed'
    #[serde(default = "default_language")]
    pub detected_language: String,
    pub raw_markdown_output: String,
    pub ufo_payload: Value,
    #[serde(default = "default_confidence")]
    pub confidence_score: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateVoucherProposalRequest {
    pub session_id: String,
    pub document_id: String,
    pub voucher_type: String, // 'contra', 'payment', 'receipt', 'journal', 'sales', 'purchase'
    pub voucher_date: Option<String>,
    pub party_id: Option<String>,
    pub header_memo: Option<String>,
    pub proposed_lines: Value,
    pub total_debit: f64,
    pub total_credit: f64,
}

fn default_mime_type() -> String {
    "application/pdf".to_string()
}

fn default_document_type() -> String {
    "tax_invoice".to_string()
}

fn default_document_nature() -> String {
    "mixed".to_string()
}

fn default_language() -> String {
    "en-IN".to_string()
}

fn default_confidence() -> f64 {
    1.0
}
