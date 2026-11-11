//! KYC: PAN / Udyam / GSTIN checks and the DigiLocker (person) or EntityLocker (business) consent flow.
//! Every verify route answers 503 `kyc_not_configured` while `KYC_PROVIDER` is unset. Roles are checked
//! with the caller's token; rows are written with the service token (migration 038).

use axum::{
    extract::{Path, State},
    http::HeaderMap,
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use serde_json::{json, Value};

use crate::error::AppError;
use crate::gst;
use crate::integrations::kyc::{is_pan, is_udyam, Outcome};
use crate::integrations::{caller, first, is_uuid, now, require_role, service, Caller, ProviderError, ADMIN_ROLES};
use crate::routes::AppState;

const NOT_CONFIGURED: &str = "kyc_not_configured";

pub fn routes(state: AppState) -> Router {
    Router::new()
        .route("/status", get(status))
        .route("/pan", post(verify_pan))
        .route("/udyam", post(verify_udyam))
        .route("/gstin", post(verify_gstin))
        .route("/digilocker/start", post(start_digilocker))
        .route("/digilocker/complete", post(complete_digilocker))
        .with_state(state)
}

#[derive(Debug, Deserialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Subject {
    Person,
    Business,
}

impl Subject {
    fn as_str(self) -> &'static str {
        match self {
            Subject::Person => "person",
            Subject::Business => "business",
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct PanRequest {
    pub subject: Subject,
    pub pan: String,
    pub name: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UdyamRequest {
    pub udyam_number: String,
}

#[derive(Debug, Deserialize)]
pub struct GstinRequest {
    /// Defaults to the company's own GSTIN.
    pub gstin: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct StartRequest {
    pub subject: Subject,
}

#[derive(Debug, Deserialize)]
pub struct CompleteRequest {
    pub id: String,
    pub code: String,
}

fn enabled(state: &AppState) -> Result<(), AppError> {
    if state.kyc.is_configured() {
        Ok(())
    } else {
        Err(AppError::ServiceUnavailable(NOT_CONFIGURED.into()))
    }
}

fn provider_err(e: ProviderError) -> AppError {
    e.into_app(NOT_CONFIGURED)
}

/// A person verifies themselves (any member); the business is verified by an owner, CFO or admin.
async fn authorise(state: &AppState, who: &Caller<'_>, org_id: &str, subject: Subject) -> Result<(), AppError> {
    match subject {
        Subject::Business => require_role(state, who, org_id, ADMIN_ROLES).await,
        Subject::Person => {
            if !is_uuid(org_id) {
                return Err(AppError::BadRequest("Invalid company id".into()));
            }
            let ok = state.db.rpc("is_org_member", &json!({ "p_org_id": org_id }), Some(who.token)).await?;
            if ok == Value::Bool(true) {
                Ok(())
            } else {
                Err(AppError::Forbidden("Only members of this company can verify here".into()))
            }
        }
    }
}

fn outcome_fields(o: &Outcome) -> Value {
    json!({
        "status": if o.verified { "verified" } else { "failed" },
        "verified_name": o.verified_name,
        "verified_at": if o.verified { Some(now()) } else { None },
        "expires_at": o.expires_at.map(|d| d.to_rfc3339()),
        "failure_reason": o.failure_reason.as_deref().map(|r| r.chars().take(500).collect::<String>()),
        "raw_minimal": o.raw_minimal,
    })
}

async fn insert_outcome(
    state: &AppState,
    who: &Caller<'_>,
    org_id: &str,
    subject: Subject,
    method: &str,
    o: &Outcome,
) -> Result<Json<Value>, AppError> {
    let mut body = outcome_fields(o);
    let extra = json!({
        "organisation_id": org_id,
        "subject": subject.as_str(),
        "user_id": (subject == Subject::Person).then(|| who.user_id.clone()),
        "method": method,
        "provider": state.kyc.name(),
        "provider_ref": o.provider_ref,
        "requested_by": who.user_id,
    });
    if let (Some(b), Some(e)) = (body.as_object_mut(), extra.as_object()) {
        b.extend(e.clone());
    }
    let svc = service(state)?;
    let res = state.db.insert_table("kyc_verifications", &body, Some(&svc)).await?;
    Ok(Json(json!({ "success": true, "data": first(res) })))
}

async fn status(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(org_id): Path<String>,
) -> Result<Json<Value>, AppError> {
    let who = caller(&state, &headers)?;
    let org = format!("eq.{}", org_id);
    let rows_q = [("select", "*"), ("organisation_id", org.as_str()), ("order", "created_at.desc")];
    let trust_q = [("select", "*"), ("organisation_id", org.as_str())];
    let (rows, trust) = tokio::try_join!(
        state.db.query_table("kyc_verifications", &rows_q, Some(who.token)),
        state.db.query_table("organisation_trust_level", &trust_q, Some(who.token)),
    )?;
    Ok(Json(json!({
        "success": true,
        "data": {
            "configured": state.kyc.is_configured(),
            "provider": state.kyc.is_configured().then(|| state.kyc.name()),
            "sandbox": state.kyc.is_sandbox(),
            "verifications": rows,
            "trust": first(trust),
        }
    })))
}

async fn verify_pan(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(org_id): Path<String>,
    Json(p): Json<PanRequest>,
) -> Result<Json<Value>, AppError> {
    enabled(&state)?;
    let who = caller(&state, &headers)?;
    authorise(&state, &who, &org_id, p.subject).await?;
    let pan = p.pan.trim().to_ascii_uppercase();
    if !is_pan(&pan) {
        return Err(AppError::BadRequest("PAN looks like ABCDE1234F".into()));
    }
    let name = p.name.as_deref().map(str::trim).filter(|n| !n.is_empty());
    if name.map(|n| n.len() > 100).unwrap_or(false) {
        return Err(AppError::BadRequest("Name can be at most 100 characters".into()));
    }
    let o = state.kyc.verify_pan(&pan, name).await.map_err(provider_err)?;
    insert_outcome(&state, &who, &org_id, p.subject, "pan", &o).await
}

async fn verify_udyam(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(org_id): Path<String>,
    Json(p): Json<UdyamRequest>,
) -> Result<Json<Value>, AppError> {
    enabled(&state)?;
    let who = caller(&state, &headers)?;
    authorise(&state, &who, &org_id, Subject::Business).await?;
    let udyam = p.udyam_number.trim().to_ascii_uppercase();
    if !is_udyam(&udyam) {
        return Err(AppError::BadRequest("Udyam number looks like UDYAM-MH-01-0000001".into()));
    }
    let o = state.kyc.verify_udyam(&udyam).await.map_err(provider_err)?;
    insert_outcome(&state, &who, &org_id, Subject::Business, "udyam", &o).await
}

async fn verify_gstin(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(org_id): Path<String>,
    Json(p): Json<GstinRequest>,
) -> Result<Json<Value>, AppError> {
    enabled(&state)?;
    let who = caller(&state, &headers)?;
    authorise(&state, &who, &org_id, Subject::Business).await?;
    let gstin = match p.gstin.as_deref().map(str::trim).filter(|g| !g.is_empty()) {
        Some(g) => g.to_ascii_uppercase(),
        None => {
            let org = format!("eq.{}", org_id);
            let orgs = state
                .db
                .query_table("organisations", &[("select", "gstin"), ("id", org.as_str())], Some(who.token))
                .await?;
            first(orgs)
                .and_then(|o| o.get("gstin").and_then(|g| g.as_str()).map(String::from))
                .unwrap_or_default()
        }
    };
    if !gst::is_valid_gstin(&gstin) {
        return Err(AppError::BadRequest("Enter a valid GSTIN (or add one to the company profile)".into()));
    }
    let o = state.kyc.verify_gstin(&gstin).await.map_err(provider_err)?;
    insert_outcome(&state, &who, &org_id, Subject::Business, "gstin", &o).await
}

async fn start_digilocker(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(org_id): Path<String>,
    Json(p): Json<StartRequest>,
) -> Result<Json<Value>, AppError> {
    enabled(&state)?;
    let who = caller(&state, &headers)?;
    authorise(&state, &who, &org_id, p.subject).await?;
    let business = p.subject == Subject::Business;
    let start = state.kyc.start_digilocker(business).await.map_err(provider_err)?;

    let body = json!({
        "organisation_id": org_id,
        "subject": p.subject.as_str(),
        "user_id": (!business).then(|| who.user_id.clone()),
        "method": if business { "entitylocker" } else { "digilocker" },
        "status": "pending",
        "provider": state.kyc.name(),
        "provider_ref": start.provider_ref,
        "requested_by": who.user_id,
    });
    let svc = service(&state)?;
    let row = first(state.db.insert_table("kyc_verifications", &body, Some(&svc)).await?)
        .ok_or_else(|| AppError::Internal("KYC request was not saved".into()))?;
    Ok(Json(json!({
        "success": true,
        "data": { "id": row.get("id"), "authorize_url": start.authorize_url }
    })))
}

async fn complete_digilocker(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(org_id): Path<String>,
    Json(p): Json<CompleteRequest>,
) -> Result<Json<Value>, AppError> {
    enabled(&state)?;
    let who = caller(&state, &headers)?;
    if !is_uuid(&p.id) || !is_uuid(&org_id) {
        return Err(AppError::BadRequest("Invalid id".into()));
    }
    let code = p.code.trim();
    if code.is_empty() || code.len() > 500 {
        return Err(AppError::BadRequest("Missing consent code".into()));
    }
    let svc = service(&state)?;
    let id = format!("eq.{}", p.id);
    let org = format!("eq.{}", org_id);
    let q = [("select", "*"), ("id", id.as_str()), ("organisation_id", org.as_str()), ("status", "eq.pending")];
    let row = first(state.db.query_table("kyc_verifications", &q, Some(&svc)).await?)
        .ok_or_else(|| AppError::NotFound("No pending DigiLocker request with that id".into()))?;
    let subject = if row.get("subject").and_then(|s| s.as_str()) == Some("person") {
        Subject::Person
    } else {
        Subject::Business
    };
    authorise(&state, &who, &org_id, subject).await?;
    if subject == Subject::Person && row.get("user_id").and_then(|u| u.as_str()) != Some(who.user_id.as_str()) {
        return Err(AppError::Forbidden("Only the person who started this can complete it".into()));
    }
    let provider_ref = row.get("provider_ref").and_then(|r| r.as_str()).unwrap_or_default();

    let o = state.kyc.complete_digilocker(provider_ref, code).await.map_err(provider_err)?;
    let res = state
        .db
        .update_table("kyc_verifications", &[("id", id.as_str()), ("status", "eq.pending")], &outcome_fields(&o), Some(&svc))
        .await?;
    Ok(Json(json!({ "success": true, "data": first(res) })))
}
