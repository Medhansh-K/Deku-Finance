//! GST portal through a GSP: connect, OTP session, direct filing, IRN and e-way bills.
//! Every route answers 503 `gsp_not_configured` while `GSP_PROVIDER` or `DATA_ENCRYPTION_KEY` is unset.
//! Roles are checked with the caller's token; writes then use the service token (migration 037).

use axum::{
    extract::{Path, State},
    http::HeaderMap,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::crypto::Cipher;
use crate::error::AppError;
use crate::gst;
use crate::integrations::gsp::{Ctx, EwbRequest, Evc};
use crate::integrations::{
    caller, first, is_uuid, now, require_role, service, Caller, ProviderError, ADMIN_ROLES, FINANCE_ROLES,
};
use crate::integrations::kyc::is_pan;
use crate::routes::AppState;

const NOT_CONFIGURED: &str = "gsp_not_configured";
/// Everything except credentials_enc, which never leaves the backend.
const CONNECTION_COLUMNS: &str =
    "id,organisation_id,provider,gstin,session_expires_at,status,last_error,enabled_by,enabled_at,created_at,updated_at";

pub fn routes(state: AppState) -> Router {
    Router::new()
        .route("/status", get(status))
        .route("/connect", post(connect))
        .route("/otp/start", post(otp_start))
        .route("/otp/verify", post(otp_verify))
        .route("/disconnect", post(disconnect))
        .route("/gst/:period/:return_type/evc-otp", post(evc_otp))
        .route("/gst/:period/:return_type/file", post(file_return))
        .route("/invoices/:inv_id", get(invoice_documents))
        .route("/invoices/:inv_id/irn", post(generate_irn))
        .route("/invoices/:inv_id/irn/cancel", post(cancel_irn))
        .route("/invoices/:inv_id/eway", post(generate_ewb))
        .route("/invoices/:inv_id/eway/cancel", post(cancel_ewb))
        .with_state(state)
}

#[derive(Debug, Deserialize)]
pub struct ConnectRequest {
    pub username: String,
}

#[derive(Debug, Deserialize)]
pub struct OtpRequest {
    pub otp: String,
}

#[derive(Debug, Deserialize)]
pub struct FileRequest {
    pub evc_pan: String,
    pub evc_otp: String,
}

#[derive(Debug, Deserialize)]
pub struct EvcOtpRequest {
    pub evc_pan: String,
}

#[derive(Debug, Deserialize)]
pub struct CancelRequest {
    pub reason_code: u8,
    pub remark: String,
}

#[derive(Debug, Deserialize)]
pub struct EwbBody {
    pub vehicle_no: Option<String>,
    pub transporter_id: Option<String>,
    pub distance_km: u32,
}

/// Decrypted only in memory, for the length of one request.
#[derive(Serialize, Deserialize, Default)]
struct Credentials {
    username: String,
    #[serde(default)]
    session_token: String,
}

/// The cipher, or 503 when the area is switched off.
fn enabled(state: &AppState) -> Result<&Cipher, AppError> {
    match (&state.cipher, state.gsp.is_configured()) {
        (Some(c), true) => Ok(c),
        _ => Err(AppError::ServiceUnavailable(NOT_CONFIGURED.into())),
    }
}

fn provider_err(e: ProviderError) -> AppError {
    e.into_app(NOT_CONFIGURED)
}

fn strip_secret(mut row: Value) -> Value {
    if let Some(o) = row.as_object_mut() {
        o.remove("credentials_enc");
    }
    row
}

fn six_digits(s: &str) -> bool {
    s.len() == 6 && s.bytes().all(|c| c.is_ascii_digit())
}

/// Writes one `gsp_requests` row. A logging failure must not undo what the portal already did,
/// so it is reported in the server log instead of failing the request.
async fn log_call<T>(
    state: &AppState,
    svc: &str,
    org_id: &str,
    user_id: &str,
    kind: &str,
    reference: &str,
    result: &Result<T, ProviderError>,
) {
    let body = json!({
        "organisation_id": org_id,
        "provider": state.gsp.name(),
        "kind": kind,
        "ref": reference,
        "status": if result.is_ok() { "ok" } else { "error" },
        "error": result.as_ref().err().map(|e| e.summary()),
        "requested_by": user_id,
    });
    if let Err(e) = state.db.insert_table("gsp_requests", &body, Some(svc)).await {
        tracing::error!("gsp_requests insert failed for {} {}: {:?}", org_id, kind, e);
    }
}

async fn load_connection(state: &AppState, svc: &str, org_id: &str) -> Result<Value, AppError> {
    let org = format!("eq.{}", org_id);
    let rows = state
        .db
        .query_table("gsp_connections", &[("select", "*"), ("organisation_id", org.as_str())], Some(svc))
        .await?;
    first(rows).ok_or_else(|| AppError::NotFound("Connect the GST portal in Settings first".into()))
}

fn decrypt(cipher: &Cipher, conn: &Value) -> Result<Credentials, AppError> {
    let enc = conn
        .get("credentials_enc")
        .and_then(|v| v.as_str())
        .ok_or_else(|| AppError::Conflict("Connect the GST portal in Settings first".into()))?;
    serde_json::from_str(&cipher.decrypt(enc)?)
        .map_err(|_| AppError::Internal("Stored GSP credentials are unreadable".into()))
}

async fn update_connection(state: &AppState, svc: &str, org_id: &str, body: &Value) -> Result<Value, AppError> {
    let org = format!("eq.{}", org_id);
    let res = state
        .db
        .update_table("gsp_connections", &[("organisation_id", org.as_str())], body, Some(svc))
        .await?;
    Ok(first(res).map(strip_secret).unwrap_or(Value::Null))
}

/// A connected, unexpired session: the GSTIN and decrypted credentials.
async fn live_session(state: &AppState, cipher: &Cipher, svc: &str, org_id: &str) -> Result<(String, Credentials), AppError> {
    let conn = load_connection(state, svc, org_id).await?;
    let expires = conn
        .get("session_expires_at")
        .and_then(|v| v.as_str())
        .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok());
    let live = conn.get("status").and_then(|s| s.as_str()) == Some("connected")
        && expires.map(|e| e > chrono::Utc::now()).unwrap_or(false);
    if !live {
        return Err(AppError::Conflict("The GST portal session has expired. Verify a new OTP in Settings.".into()));
    }
    let gstin = conn.get("gstin").and_then(|g| g.as_str()).unwrap_or_default().to_string();
    Ok((gstin, decrypt(cipher, &conn)?))
}

// ---------- Connection ----------

async fn status(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(org_id): Path<String>,
) -> Result<Json<Value>, AppError> {
    let who = caller(&state, &headers)?;
    let org = format!("eq.{}", org_id);
    let rows = state
        .db
        .query_table("gsp_connections", &[("select", CONNECTION_COLUMNS), ("organisation_id", org.as_str())], Some(who.token))
        .await?;
    let reason = if !state.gsp.is_configured() {
        Some("No GST Suvidha Provider is configured on this server (GSP_PROVIDER is unset).")
    } else if state.cipher.is_none() {
        Some("DATA_ENCRYPTION_KEY is not set, so portal credentials can't be stored.")
    } else {
        None
    };
    Ok(Json(json!({
        "success": true,
        "data": {
            "configured": reason.is_none(),
            "reason": reason,
            "provider": state.gsp.is_configured().then(|| state.gsp.name()),
            "sandbox": state.gsp.is_sandbox(),
            "connection": first(rows),
        }
    })))
}

async fn connect(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(org_id): Path<String>,
    Json(payload): Json<ConnectRequest>,
) -> Result<Json<Value>, AppError> {
    let cipher = enabled(&state)?;
    let who = caller(&state, &headers)?;
    require_role(&state, &who, &org_id, ADMIN_ROLES).await?;
    let username = payload.username.trim();
    if username.is_empty() || username.len() > 60 || username.chars().any(char::is_whitespace) {
        return Err(AppError::BadRequest("Enter the GST portal username (no spaces)".into()));
    }

    let org = format!("eq.{}", org_id);
    let orgs = state
        .db
        .query_table("organisations", &[("select", "gstin"), ("id", org.as_str())], Some(who.token))
        .await?;
    let gstin = first(orgs)
        .and_then(|o| o.get("gstin").and_then(|g| g.as_str()).map(String::from))
        .filter(|g| gst::is_valid_gstin(g))
        .ok_or_else(|| AppError::BadRequest("Add a valid company GSTIN in Settings first".into()))?;

    let creds = Credentials { username: username.to_string(), session_token: String::new() };
    let enc = cipher.encrypt(&serde_json::to_string(&creds).map_err(|e| AppError::Internal(e.to_string()))?)?;
    let body = json!({
        "organisation_id": org_id,
        "provider": state.gsp.name(),
        "gstin": gstin,
        "credentials_enc": enc,
        "session_expires_at": null,
        "status": "disconnected",
        "last_error": null,
        "enabled_by": who.user_id,
        "enabled_at": now(),
    });
    let svc = service(&state)?;
    let res = state.db.upsert_table("gsp_connections", "organisation_id", &body, Some(&svc)).await?;
    Ok(Json(json!({ "success": true, "data": first(res).map(strip_secret) })))
}

async fn otp_start(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(org_id): Path<String>,
) -> Result<Json<Value>, AppError> {
    let cipher = enabled(&state)?;
    let who = caller(&state, &headers)?;
    require_role(&state, &who, &org_id, FINANCE_ROLES).await?;
    let svc = service(&state)?;
    let conn = load_connection(&state, &svc, &org_id).await?;
    let creds = decrypt(cipher, &conn)?;
    let gstin = conn.get("gstin").and_then(|g| g.as_str()).unwrap_or_default();

    let ctx = Ctx { gstin, username: &creds.username, session_token: "" };
    let result = state.gsp.start_session(&ctx).await;
    log_call(&state, &svc, &org_id, &who.user_id, "otp_start", gstin, &result).await;
    let body = match &result {
        Ok(()) => json!({ "status": "otp_pending", "last_error": null }),
        Err(e) => json!({ "status": "error", "last_error": e.summary() }),
    };
    let row = update_connection(&state, &svc, &org_id, &body).await?;
    result.map_err(provider_err)?;
    Ok(Json(json!({ "success": true, "data": row })))
}

async fn otp_verify(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(org_id): Path<String>,
    Json(payload): Json<OtpRequest>,
) -> Result<Json<Value>, AppError> {
    let cipher = enabled(&state)?;
    let who = caller(&state, &headers)?;
    require_role(&state, &who, &org_id, FINANCE_ROLES).await?;
    let otp = payload.otp.trim();
    if !six_digits(otp) {
        return Err(AppError::BadRequest("The OTP is 6 digits".into()));
    }
    let svc = service(&state)?;
    let conn = load_connection(&state, &svc, &org_id).await?;
    let mut creds = decrypt(cipher, &conn)?;
    let gstin = conn.get("gstin").and_then(|g| g.as_str()).unwrap_or_default();

    let ctx = Ctx { gstin, username: &creds.username, session_token: "" };
    let result = state.gsp.verify_otp(&ctx, otp).await;
    log_call(&state, &svc, &org_id, &who.user_id, "otp_verify", gstin, &result).await;
    let session = match result {
        Ok(s) => s,
        Err(e) => {
            // A wrong OTP leaves the session pending so the user can retry.
            update_connection(&state, &svc, &org_id, &json!({ "last_error": e.summary() })).await?;
            return Err(provider_err(e));
        }
    };
    creds.session_token = session.token;
    let enc = cipher.encrypt(&serde_json::to_string(&creds).map_err(|e| AppError::Internal(e.to_string()))?)?;
    let row = update_connection(
        &state,
        &svc,
        &org_id,
        &json!({
            "credentials_enc": enc,
            "status": "connected",
            "session_expires_at": session.expires_at.to_rfc3339(),
            "last_error": null,
        }),
    )
    .await?;
    Ok(Json(json!({ "success": true, "data": row })))
}

async fn disconnect(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(org_id): Path<String>,
) -> Result<Json<Value>, AppError> {
    // Allowed even while switched off, so a company can always withdraw its stored credentials.
    let who = caller(&state, &headers)?;
    require_role(&state, &who, &org_id, ADMIN_ROLES).await?;
    let svc = service(&state)?;
    let row = update_connection(
        &state,
        &svc,
        &org_id,
        &json!({ "credentials_enc": null, "status": "disconnected", "session_expires_at": null, "last_error": null }),
    )
    .await?;
    Ok(Json(json!({ "success": true, "data": row })))
}

// ---------- Direct filing ----------

fn filing_key(org_id: &str, period: &str, rt: &str) -> Result<&'static str, AppError> {
    if !is_uuid(org_id) {
        return Err(AppError::BadRequest("Invalid company id".into()));
    }
    if !gst::is_ret_period(period) {
        return Err(AppError::BadRequest("period must be MMYYYY, e.g. 102026".into()));
    }
    crate::routes::gst::return_type(rt)
}

async fn evc_otp(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((org_id, period, rt)): Path<(String, String, String)>,
    Json(payload): Json<EvcOtpRequest>,
) -> Result<Json<Value>, AppError> {
    let cipher = enabled(&state)?;
    let who = caller(&state, &headers)?;
    require_role(&state, &who, &org_id, FINANCE_ROLES).await?;
    let kind = filing_key(&org_id, &period, &rt)?;
    let pan = payload.evc_pan.trim().to_ascii_uppercase();
    if !is_pan(&pan) {
        return Err(AppError::BadRequest("Enter the authorised signatory's PAN".into()));
    }
    let svc = service(&state)?;
    let (gstin, creds) = live_session(&state, cipher, &svc, &org_id).await?;
    let ctx = Ctx { gstin: &gstin, username: &creds.username, session_token: &creds.session_token };
    let result = state.gsp.request_evc_otp(&ctx, &pan, &period, kind).await;
    log_call(&state, &svc, &org_id, &who.user_id, "evc_otp", &format!("{}:{}", kind, period), &result).await;
    result.map_err(provider_err)?;
    Ok(Json(json!({ "success": true, "data": { "sent": true } })))
}

async fn file_return(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((org_id, period, rt)): Path<(String, String, String)>,
    Json(payload): Json<FileRequest>,
) -> Result<Json<Value>, AppError> {
    let cipher = enabled(&state)?;
    let who = caller(&state, &headers)?;
    require_role(&state, &who, &org_id, FINANCE_ROLES).await?;
    let kind = filing_key(&org_id, &period, &rt)?;
    let pan = payload.evc_pan.trim().to_ascii_uppercase();
    let otp = payload.evc_otp.trim();
    if !is_pan(&pan) || !six_digits(otp) {
        return Err(AppError::BadRequest("EVC needs the authorised signatory's PAN and the 6-digit OTP".into()));
    }

    // Files exactly what was recorded (and frozen) as prepared, never a client-sent JSON.
    let org = format!("eq.{}", org_id);
    let per = format!("eq.{}", period);
    let typ = format!("eq.{}", kind);
    let key = [
        ("select", "json,status"),
        ("organisation_id", org.as_str()),
        ("ret_period", per.as_str()),
        ("return_type", typ.as_str()),
    ];
    let filing = first(state.db.query_table("gst_return_filings", &key, Some(who.token)).await?)
        .ok_or_else(|| AppError::NotFound(format!("Record the prepared {} for {} first", kind, period)))?;
    if filing.get("status").and_then(|s| s.as_str()) == Some("filed") {
        return Err(AppError::Conflict(format!("{} for {} is already filed", kind, period)));
    }
    let return_json = filing.get("json").cloned().unwrap_or(Value::Null);

    let svc = service(&state)?;
    let (gstin, creds) = live_session(&state, cipher, &svc, &org_id).await?;
    let ctx = Ctx { gstin: &gstin, username: &creds.username, session_token: &creds.session_token };
    let evc = Evc { pan: &pan, otp };
    let result = state.gsp.file_return(&ctx, &period, kind, &return_json, &evc).await;
    log_call(&state, &svc, &org_id, &who.user_id, "file_return", &format!("{}:{}", kind, period), &result).await;
    let arn = result.map_err(provider_err)?.arn.trim().to_ascii_uppercase();
    if arn.is_empty() || !arn.chars().all(|c| c.is_ascii_alphanumeric()) {
        return Err(AppError::Database(format!("The provider returned an unusable ARN: {:?}", arn)));
    }

    // With the caller's token: the filings trigger stamps filed_by from auth.uid().
    let mark = [
        ("organisation_id", org.as_str()),
        ("ret_period", per.as_str()),
        ("return_type", typ.as_str()),
        ("status", "eq.prepared"),
    ];
    match state
        .db
        .update_table("gst_return_filings", &mark, &json!({ "status": "filed", "filed_arn": arn }), Some(who.token))
        .await
    {
        Ok(res) => Ok(Json(json!({ "success": true, "data": { "arn": arn, "filing": first(res) } }))),
        Err(e) => Err(AppError::Internal(format!(
            "{} was filed on the portal with ARN {}, but recording it failed ({:?}). Mark it filed with that ARN.",
            kind, arn, e
        ))),
    }
}

// ---------- e-invoice and e-way bill ----------

/// An issued invoice of this company, read with the caller's token so RLS applies.
async fn issued_invoice(state: &AppState, who: &Caller<'_>, org_id: &str, inv_id: &str) -> Result<Value, AppError> {
    if !is_uuid(inv_id) {
        return Err(AppError::BadRequest("Invalid invoice id".into()));
    }
    let org = format!("eq.{}", org_id);
    let id = format!("eq.{}", inv_id);
    let q = [
        ("select", "*,parties(legal_name,gstin,billing_address),sales_invoice_lines(*)"),
        ("id", id.as_str()),
        ("organisation_id", org.as_str()),
        ("sales_invoice_lines.order", "line_number.asc"),
    ];
    let inv = first(state.db.query_table("sales_invoices", &q, Some(who.token)).await?)
        .ok_or_else(|| AppError::NotFound("Invoice not found".into()))?;
    if inv.get("status").and_then(|s| s.as_str()) != Some("issued") {
        return Err(AppError::BadRequest("Only an issued invoice can get an IRN or e-way bill".into()));
    }
    Ok(inv)
}

/// The live (generated / active) row for an invoice, if any.
async fn live_row(state: &AppState, token: &str, table: &str, live: &str, org_id: &str, inv_id: &str) -> Result<Option<Value>, AppError> {
    let org = format!("eq.{}", org_id);
    let id = format!("eq.{}", inv_id);
    let st = format!("eq.{}", live);
    let q = [
        ("select", "*"),
        ("organisation_id", org.as_str()),
        ("sales_invoice_id", id.as_str()),
        ("status", st.as_str()),
    ];
    Ok(first(state.db.query_table(table, &q, Some(token)).await?))
}

fn validate_cancel(p: &CancelRequest) -> Result<String, AppError> {
    let remark = p.remark.trim();
    if !(1..=4).contains(&p.reason_code) || remark.is_empty() || remark.len() > 100 {
        return Err(AppError::BadRequest("Pick a reason (1-4) and add a remark of up to 100 characters".into()));
    }
    Ok(remark.to_string())
}

async fn invoice_documents(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((org_id, inv_id)): Path<(String, String)>,
) -> Result<Json<Value>, AppError> {
    let who = caller(&state, &headers)?;
    if !is_uuid(&inv_id) {
        return Err(AppError::BadRequest("Invalid invoice id".into()));
    }
    let org = format!("eq.{}", org_id);
    let id = format!("eq.{}", inv_id);
    let q = [
        ("select", "*"),
        ("organisation_id", org.as_str()),
        ("sales_invoice_id", id.as_str()),
        ("order", "created_at.desc"),
    ];
    let (irns, ewbs) = tokio::try_join!(
        state.db.query_table("e_invoices", &q, Some(who.token)),
        state.db.query_table("eway_bills", &q, Some(who.token)),
    )?;
    Ok(Json(json!({ "success": true, "data": { "e_invoices": irns, "eway_bills": ewbs } })))
}

async fn generate_irn(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((org_id, inv_id)): Path<(String, String)>,
) -> Result<Json<Value>, AppError> {
    let cipher = enabled(&state)?;
    let who = caller(&state, &headers)?;
    require_role(&state, &who, &org_id, FINANCE_ROLES).await?;
    let inv = issued_invoice(&state, &who, &org_id, &inv_id).await?;
    let b2b = inv.pointer("/parties/gstin").and_then(|g| g.as_str()).map(|g| !g.is_empty()).unwrap_or(false);
    if !b2b && inv.get("supply_type").and_then(|s| s.as_str()) != Some("export") {
        return Err(AppError::BadRequest("e-invoicing applies to B2B (customer has a GSTIN) and export invoices".into()));
    }
    if live_row(&state, who.token, "e_invoices", "generated", &org_id, &inv_id).await?.is_some() {
        return Err(AppError::Conflict("This invoice already has an IRN".into()));
    }

    let svc = service(&state)?;
    let (gstin, creds) = live_session(&state, cipher, &svc, &org_id).await?;
    let ctx = Ctx { gstin: &gstin, username: &creds.username, session_token: &creds.session_token };
    let result = state.gsp.generate_irn(&ctx, &inv).await;
    log_call(&state, &svc, &org_id, &who.user_id, "generate_irn", &inv_id, &result).await;
    let irn = result.map_err(provider_err)?;

    let body = json!({
        "organisation_id": org_id,
        "sales_invoice_id": inv_id,
        "provider": state.gsp.name(),
        "irn": irn.irn,
        "ack_no": irn.ack_no,
        "ack_date": irn.ack_date.map(|d| d.to_rfc3339()),
        "signed_qr": irn.signed_qr,
        "raw": irn.raw,
        "created_by": who.user_id,
    });
    match state.db.insert_table("e_invoices", &body, Some(&svc)).await {
        Ok(res) => Ok(Json(json!({ "success": true, "data": first(res) }))),
        Err(e) => Err(AppError::Internal(format!(
            "IRN {} was generated but could not be saved ({:?}). Note it before retrying.",
            irn.irn, e
        ))),
    }
}

async fn cancel_irn(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((org_id, inv_id)): Path<(String, String)>,
    Json(payload): Json<CancelRequest>,
) -> Result<Json<Value>, AppError> {
    let cipher = enabled(&state)?;
    let who = caller(&state, &headers)?;
    require_role(&state, &who, &org_id, ADMIN_ROLES).await?;
    let remark = validate_cancel(&payload)?;
    if !is_uuid(&inv_id) {
        return Err(AppError::BadRequest("Invalid invoice id".into()));
    }
    let row = live_row(&state, who.token, "e_invoices", "generated", &org_id, &inv_id)
        .await?
        .ok_or_else(|| AppError::NotFound("This invoice has no live IRN".into()))?;
    let irn = row.get("irn").and_then(|v| v.as_str()).unwrap_or_default().to_string();

    let svc = service(&state)?;
    let (gstin, creds) = live_session(&state, cipher, &svc, &org_id).await?;
    let ctx = Ctx { gstin: &gstin, username: &creds.username, session_token: &creds.session_token };
    let result = state.gsp.cancel_irn(&ctx, &irn, payload.reason_code, &remark).await;
    log_call(&state, &svc, &org_id, &who.user_id, "cancel_irn", &inv_id, &result).await;
    result.map_err(provider_err)?;

    let irn_q = format!("eq.{}", irn);
    let res = state
        .db
        .update_table(
            "e_invoices",
            &[("irn", irn_q.as_str())],
            &json!({ "status": "cancelled", "cancel_reason": format!("{}: {}", payload.reason_code, remark), "cancelled_at": now() }),
            Some(&svc),
        )
        .await?;
    Ok(Json(json!({ "success": true, "data": first(res) })))
}

/// Vehicle numbers like "MH12AB1234" (spaces and dashes dropped).
fn vehicle(v: &Option<String>) -> Result<Option<String>, AppError> {
    let Some(raw) = v.as_deref().map(str::trim).filter(|s| !s.is_empty()) else {
        return Ok(None);
    };
    let n: String = raw.chars().filter(|c| *c != ' ' && *c != '-').collect::<String>().to_ascii_uppercase();
    if (4..=20).contains(&n.len()) && n.chars().all(|c| c.is_ascii_alphanumeric()) {
        Ok(Some(n))
    } else {
        Err(AppError::BadRequest("Vehicle number should look like MH12AB1234".into()))
    }
}

async fn generate_ewb(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((org_id, inv_id)): Path<(String, String)>,
    Json(payload): Json<EwbBody>,
) -> Result<Json<Value>, AppError> {
    let cipher = enabled(&state)?;
    let who = caller(&state, &headers)?;
    require_role(&state, &who, &org_id, FINANCE_ROLES).await?;
    if payload.distance_km > 4000 {
        return Err(AppError::BadRequest("Distance can be at most 4000 km".into()));
    }
    let vehicle_no = vehicle(&payload.vehicle_no)?;
    let transporter_id = payload
        .transporter_id
        .as_deref()
        .map(|t| t.trim().to_ascii_uppercase())
        .filter(|t| !t.is_empty());
    if let Some(t) = &transporter_id {
        if t.len() != 15 || !t.chars().all(|c| c.is_ascii_alphanumeric()) {
            return Err(AppError::BadRequest("Transporter ID is the 15-character GSTIN or TRANSIN".into()));
        }
    }
    if vehicle_no.is_none() && transporter_id.is_none() {
        return Err(AppError::BadRequest("Give a vehicle number or a transporter ID".into()));
    }
    let inv = issued_invoice(&state, &who, &org_id, &inv_id).await?;
    if live_row(&state, who.token, "eway_bills", "active", &org_id, &inv_id).await?.is_some() {
        return Err(AppError::Conflict("This invoice already has an active e-way bill".into()));
    }
    let irn = live_row(&state, who.token, "e_invoices", "generated", &org_id, &inv_id)
        .await?
        .and_then(|r| r.get("irn").and_then(|v| v.as_str()).map(String::from));

    let svc = service(&state)?;
    let (gstin, creds) = live_session(&state, cipher, &svc, &org_id).await?;
    let ctx = Ctx { gstin: &gstin, username: &creds.username, session_token: &creds.session_token };
    let req = EwbRequest {
        vehicle_no: vehicle_no.as_deref(),
        transporter_id: transporter_id.as_deref(),
        distance_km: payload.distance_km,
        irn: irn.as_deref(),
    };
    let result = state.gsp.generate_ewb(&ctx, &inv, &req).await;
    log_call(&state, &svc, &org_id, &who.user_id, "generate_ewb", &inv_id, &result).await;
    let ewb = result.map_err(provider_err)?;

    let body = json!({
        "organisation_id": org_id,
        "sales_invoice_id": inv_id,
        "provider": state.gsp.name(),
        "ewb_no": ewb.ewb_no,
        "valid_upto": ewb.valid_upto.map(|d| d.to_rfc3339()),
        "vehicle_no": vehicle_no,
        "transporter_id": transporter_id,
        "distance_km": payload.distance_km,
        "raw": ewb.raw,
        "created_by": who.user_id,
    });
    match state.db.insert_table("eway_bills", &body, Some(&svc)).await {
        Ok(res) => Ok(Json(json!({ "success": true, "data": first(res) }))),
        Err(e) => Err(AppError::Internal(format!(
            "E-way bill {} was generated but could not be saved ({:?}). Note it before retrying.",
            ewb.ewb_no, e
        ))),
    }
}

async fn cancel_ewb(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((org_id, inv_id)): Path<(String, String)>,
    Json(payload): Json<CancelRequest>,
) -> Result<Json<Value>, AppError> {
    let cipher = enabled(&state)?;
    let who = caller(&state, &headers)?;
    require_role(&state, &who, &org_id, ADMIN_ROLES).await?;
    let remark = validate_cancel(&payload)?;
    if !is_uuid(&inv_id) {
        return Err(AppError::BadRequest("Invalid invoice id".into()));
    }
    let row = live_row(&state, who.token, "eway_bills", "active", &org_id, &inv_id)
        .await?
        .ok_or_else(|| AppError::NotFound("This invoice has no active e-way bill".into()))?;
    let ewb_no = row.get("ewb_no").and_then(|v| v.as_str()).unwrap_or_default().to_string();

    let svc = service(&state)?;
    let (gstin, creds) = live_session(&state, cipher, &svc, &org_id).await?;
    let ctx = Ctx { gstin: &gstin, username: &creds.username, session_token: &creds.session_token };
    let result = state.gsp.cancel_ewb(&ctx, &ewb_no, payload.reason_code, &remark).await;
    log_call(&state, &svc, &org_id, &who.user_id, "cancel_ewb", &inv_id, &result).await;
    result.map_err(provider_err)?;

    let q = format!("eq.{}", ewb_no);
    let res = state
        .db
        .update_table(
            "eway_bills",
            &[("ewb_no", q.as_str())],
            &json!({ "status": "cancelled", "cancel_reason": format!("{}: {}", payload.reason_code, remark), "cancelled_at": now() }),
            Some(&svc),
        )
        .await?;
    Ok(Json(json!({ "success": true, "data": first(res) })))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn vehicle_numbers_are_normalised() {
        assert_eq!(vehicle(&Some("mh 12-ab 1234".into())).unwrap(), Some("MH12AB1234".into()));
        assert_eq!(vehicle(&None).unwrap(), None);
        assert!(vehicle(&Some("MH12/AB".into())).is_err());
    }

    #[test]
    fn credentials_never_leave_in_a_response() {
        let row = strip_secret(json!({ "status": "connected", "credentials_enc": "abc" }));
        assert!(row.get("credentials_enc").is_none());
        assert_eq!(row["status"], "connected");
    }

    #[test]
    fn cancel_needs_a_reason() {
        assert!(validate_cancel(&CancelRequest { reason_code: 2, remark: "Wrong rate".into() }).is_ok());
        assert!(validate_cancel(&CancelRequest { reason_code: 5, remark: "x".into() }).is_err());
        assert!(validate_cancel(&CancelRequest { reason_code: 1, remark: "  ".into() }).is_err());
    }
}
