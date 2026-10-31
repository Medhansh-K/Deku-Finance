//! Razorpay payment links on each company's own Razorpay account (migration 036).
//! Tokens are encrypted with `AppState.cipher` and read back only with the service token; they are
//! never returned to the browser. Without the RAZORPAY_* settings or DATA_ENCRYPTION_KEY every route
//! answers 503 `payments_not_configured`, except `status`, which says so.

use axum::{
    body::Bytes,
    extract::{Path, Query, State},
    http::HeaderMap,
    response::Redirect,
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use serde_json::{json, Value};
use crate::auth;
use crate::crypto::Cipher;
use crate::error::AppError;
use crate::razorpay::{payment_link_body, PaymentSplit, Razorpay};
use crate::routes::AppState;

const NOT_CONFIGURED: &str = "payments_not_configured";
/// Refresh this long before the access token expires (it lasts about 90 days).
const REFRESH_MARGIN_DAYS: i64 = 7;

pub fn routes(state: AppState) -> Router {
    Router::new()
        .route("/organisations/:org_id/payments/status", get(status))
        .route("/organisations/:org_id/payments/links", get(list_links))
        .route("/organisations/:org_id/payments/razorpay/connect", post(connect))
        .route("/organisations/:org_id/payments/razorpay/disconnect", post(disconnect))
        .route("/organisations/:org_id/invoices/:inv_id/payment-link", post(create_link))
        // Reached through the frontend proxy, so it carries the user's session (see deploy/gcp/README.md §11).
        .route("/payments/razorpay/callback", get(callback))
        // Called by Razorpay directly; authenticated by its signature only.
        .route("/webhooks/razorpay", post(webhook))
        .with_state(state)
}

#[derive(Debug, Deserialize)]
pub struct ConnectRequest {
    #[serde(default)]
    pub mode: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CallbackQuery {
    pub code: Option<String>,
    pub state: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct LinksQuery {
    pub invoice_id: Option<String>,
}

fn extract_auth_token(headers: &HeaderMap) -> Option<&str> {
    headers
        .get("Authorization")
        .and_then(|h| h.to_str().ok())
        .and_then(|h| h.strip_prefix("Bearer "))
}

fn configured(state: &AppState) -> Result<(&Razorpay, &Cipher), AppError> {
    match (state.razorpay.as_ref(), state.cipher.as_ref()) {
        (Some(r), Some(c)) => Ok((r, c)),
        _ => Err(AppError::Unavailable(NOT_CONFIGURED.into())),
    }
}

fn first(v: Value) -> Option<Value> {
    v.as_array().and_then(|a| a.first()).cloned()
}

fn is_uuid(s: &str) -> bool {
    s.len() == 36
        && s.char_indices().all(|(i, c)| if [8, 13, 18, 23].contains(&i) { c == '-' } else { c.is_ascii_hexdigit() })
}

async fn status(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(org_id): Path<String>,
) -> Result<Json<Value>, AppError> {
    if configured(&state).is_err() {
        return Ok(Json(json!({
            "success": true,
            "data": {
                "configured": false,
                "reason": "Online payments are switched off on this Deku server (Razorpay partner settings or the data encryption key are not set).",
                "connection": null,
            }
        })));
    }
    let token = extract_auth_token(&headers);
    let org_filter = format!("eq.{}", org_id);
    // Explicit columns: the token columns are not granted to signed-in users.
    let query = [
        ("select", "razorpay_account_id,mode,status,expires_at,created_at,updated_at"),
        ("organisation_id", &org_filter),
        ("provider", "eq.razorpay"),
    ];
    let res = state.db.query_table("payment_connections", &query, token).await?;
    Ok(Json(json!({ "success": true, "data": { "configured": true, "connection": first(res) } })))
}

async fn list_links(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(org_id): Path<String>,
    Query(params): Query<LinksQuery>,
) -> Result<Json<Value>, AppError> {
    configured(&state)?;
    let token = extract_auth_token(&headers);
    let org_filter = format!("eq.{}", org_id);
    let mut query = vec![
        ("select", "id,invoice_id,link_id,short_url,amount_paise,status,created_at".to_string()),
        ("organisation_id", org_filter),
        ("order", "created_at.desc".to_string()),
    ];
    if let Some(inv) = params.invoice_id.filter(|s| is_uuid(s)) {
        query.push(("invoice_id", format!("eq.{}", inv)));
    }
    let query: Vec<(&str, &str)> = query.iter().map(|(k, v)| (*k, v.as_str())).collect();
    let res = state.db.query_table("invoice_payment_links", &query, token).await?;
    Ok(Json(json!({ "success": true, "data": res })))
}

async fn connect(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(org_id): Path<String>,
    Json(payload): Json<ConnectRequest>,
) -> Result<Json<Value>, AppError> {
    let (rzp, _) = configured(&state)?;
    let token = extract_auth_token(&headers);
    let mode = payload.mode.unwrap_or_else(|| "live".into());
    if mode != "live" && mode != "test" {
        return Err(AppError::BadRequest("mode must be live or test".into()));
    }
    let oauth_state = auth::new_refresh_token();
    // RLS on oauth_states lets only the owner or an admin insert.
    state
        .db
        .insert_table(
            "oauth_states",
            &json!({ "state": oauth_state, "organisation_id": org_id, "provider": "razorpay", "mode": mode }),
            token,
        )
        .await?;
    Ok(Json(json!({ "success": true, "data": { "authorize_url": rzp.authorize_url(&oauth_state) } })))
}

fn back_to_settings(result: &str) -> Redirect {
    Redirect::to(&format!("/settings?payments={}", result))
}

async fn callback(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(q): Query<CallbackQuery>,
) -> Result<Redirect, AppError> {
    let (rzp, cipher) = configured(&state)?;
    match finish_connect(&state, rzp, cipher, &headers, q).await {
        Ok(()) => Ok(back_to_settings("connected")),
        Err(reason) => {
            tracing::warn!("Razorpay connect failed: {}", reason);
            Ok(back_to_settings("error"))
        }
    }
}

async fn finish_connect(
    state: &AppState,
    rzp: &Razorpay,
    cipher: &Cipher,
    headers: &HeaderMap,
    q: CallbackQuery,
) -> Result<(), String> {
    let (code, oauth_state) = match (q.code, q.state) {
        (Some(c), Some(s)) if !c.is_empty() && !s.is_empty() => (c, s),
        _ => return Err("missing code or state (consent declined?)".into()),
    };
    let token = extract_auth_token(headers).ok_or("no session on callback")?;
    let user = auth::verify_access_token(&state.jwt_secret, token).map_err(|_| "invalid session")?;

    // Bound to the user who started the flow, one-time and short-lived (CSRF).
    let consumed = state
        .db
        .rpc("consume_payment_oauth_state", &json!({ "p_state": oauth_state }), Some(token))
        .await
        .map_err(|e| format!("{:?}", e))?;
    let row = first(consumed).ok_or("unknown, expired or reused state")?;
    let org_id = row.get("organisation_id").and_then(Value::as_str).ok_or("state without company")?.to_string();
    let mode = row.get("mode").and_then(Value::as_str).unwrap_or("live").to_string();

    let tokens = rzp.exchange_code(&code, &mode).await.map_err(|e| format!("{:?}", e))?;
    let account_id = tokens.razorpay_account_id.clone().ok_or("token response without razorpay_account_id")?;
    store_tokens(state, cipher, &org_id, user.sub.as_deref(), &account_id, &tokens, &mode)
        .await
        .map_err(|e| format!("{:?}", e))
}

async fn store_tokens(
    state: &AppState,
    cipher: &Cipher,
    org_id: &str,
    user_id: Option<&str>,
    account_id: &str,
    tokens: &crate::razorpay::TokenResponse,
    mode: &str,
) -> Result<(), AppError> {
    let expires_at = (chrono::Utc::now() + chrono::Duration::seconds(tokens.expires_in)).to_rfc3339();
    let service = auth::service_token(&state.jwt_secret)?;
    state
        .db
        .rpc(
            "store_payment_connection",
            &json!({
                "p_org_id": org_id,
                "p_user_id": user_id,
                "p_account_id": account_id,
                "p_access_token_enc": cipher.encrypt(&tokens.access_token)?,
                "p_refresh_token_enc": cipher.encrypt(&tokens.refresh_token)?,
                "p_public_token": tokens.public_token,
                "p_expires_at": expires_at,
                "p_mode": mode,
            }),
            Some(&service),
        )
        .await?;
    Ok(())
}

/// The company's encrypted connection row, read with the service token.
async fn connection_secrets(state: &AppState, org_id: &str) -> Result<Option<Value>, AppError> {
    let service = auth::service_token(&state.jwt_secret)?;
    let res = state
        .db
        .rpc("payment_connection_secrets", &json!({ "p_org_id": org_id }), Some(&service))
        .await?;
    Ok(first(res))
}

/// A usable access token, refreshed (and the rotated refresh token stored) when close to expiry.
async fn access_token_for(state: &AppState, rzp: &Razorpay, cipher: &Cipher, org_id: &str) -> Result<String, AppError> {
    let row = connection_secrets(state, org_id)
        .await?
        .filter(|r| r.get("status").and_then(Value::as_str) == Some("connected"))
        .ok_or_else(|| AppError::BadRequest("razorpay_not_connected".into()))?;
    let field = |k: &str| row.get(k).and_then(Value::as_str).unwrap_or_default().to_string();
    let access = cipher.decrypt(&field("access_token_enc"))?;
    let expires_at = chrono::DateTime::parse_from_rfc3339(&field("expires_at")).ok();
    let now = chrono::Utc::now();
    let due = expires_at.map_or(true, |t| t < now + chrono::Duration::days(REFRESH_MARGIN_DAYS));
    if !due {
        return Ok(access);
    }

    let refreshed = match rzp.refresh(&cipher.decrypt(&field("refresh_token_enc"))?).await {
        Ok(t) => t,
        Err(e) if expires_at.map_or(false, |t| t > now) => {
            tracing::warn!("Razorpay token refresh failed, using the current token: {:?}", e);
            return Ok(access);
        }
        Err(e) => return Err(e),
    };
    let account_id = refreshed.razorpay_account_id.clone().unwrap_or_else(|| field("razorpay_account_id"));
    store_tokens(state, cipher, org_id, None, &account_id, &refreshed, &field("mode")).await?;
    Ok(refreshed.access_token)
}

async fn disconnect(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(org_id): Path<String>,
) -> Result<Json<Value>, AppError> {
    let (rzp, cipher) = configured(&state)?;
    let token = extract_auth_token(&headers);
    let row = connection_secrets(&state, &org_id).await?;
    // Owner/admin check and local revoke first; Razorpay's revoke is best effort afterwards.
    state
        .db
        .rpc("disconnect_payment_connection", &json!({ "p_org_id": org_id }), token)
        .await?;
    let access = row
        .as_ref()
        .and_then(|r| r.get("access_token_enc"))
        .and_then(Value::as_str)
        .map(|enc| cipher.decrypt(enc));
    if let Some(Ok(access)) = access {
        if let Err(e) = rzp.revoke(&access).await {
            tracing::warn!("Razorpay revoke failed for organisation {}: {:?}", org_id, e);
        }
    }
    Ok(Json(json!({ "success": true, "data": { "status": "revoked" } })))
}

async fn create_link(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((org_id, inv_id)): Path<(String, String)>,
) -> Result<Json<Value>, AppError> {
    let (rzp, cipher) = configured(&state)?;
    let token = extract_auth_token(&headers);
    // Checks the caller's role and that the invoice is issued; returns any active link.
    let info = state
        .db
        .rpc("payment_link_invoice", &json!({ "p_org_id": org_id, "p_invoice_id": inv_id }), token)
        .await?;
    if let Some(existing) = info.get("existing_link").filter(|v| !v.is_null()) {
        return Ok(Json(json!({ "success": true, "data": existing })));
    }

    let access = access_token_for(&state, rzp, cipher, &org_id).await?;
    let link = rzp.create_payment_link(&access, &payment_link_body(&info)).await?;
    let link_id = link.get("id").and_then(Value::as_str).ok_or_else(|| AppError::Internal("Razorpay link without id".into()))?;
    let short_url = link
        .get("short_url")
        .and_then(Value::as_str)
        .ok_or_else(|| AppError::Internal("Razorpay link without short_url".into()))?;

    let res = state
        .db
        .insert_table(
            "invoice_payment_links",
            &json!({
                "organisation_id": org_id,
                "invoice_id": inv_id,
                "link_id": link_id,
                "short_url": short_url,
                "amount_paise": info.get("amount_paise"),
            }),
            token,
        )
        .await?;
    Ok(Json(json!({ "success": true, "data": first(res) })))
}

async fn webhook(
    State(state): State<AppState>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<Json<Value>, AppError> {
    let (rzp, _) = configured(&state)?;
    let signature = headers
        .get("X-Razorpay-Signature")
        .and_then(|h| h.to_str().ok())
        .unwrap_or("");
    if !rzp.webhook_signature_ok(&body, signature) {
        return Err(AppError::Unauthorized("invalid_signature".into()));
    }
    let event: Value = serde_json::from_slice(&body).map_err(|_| AppError::BadRequest("invalid_json".into()))?;
    let name = event.get("event").and_then(Value::as_str).unwrap_or("");
    let account_id = event.get("account_id").and_then(Value::as_str); // verify against Razorpay docs
    let service = auth::service_token(&state.jwt_secret)?;

    match name {
        "payment_link.paid" | "payment.captured" => {
            let payment = event.pointer("/payload/payment/entity").cloned().unwrap_or(Value::Null);
            let link = event.pointer("/payload/payment_link/entity");
            let (Some(payment_id), Some(split)) = (payment.get("id").and_then(Value::as_str), PaymentSplit::from_payment(&payment))
            else {
                tracing::warn!("Razorpay {} without a usable payment entity", name);
                return Ok(Json(json!({ "success": true })));
            };
            let captured_at = event
                .get("created_at")
                .or_else(|| payment.get("created_at"))
                .and_then(Value::as_i64)
                .and_then(|s| chrono::DateTime::<chrono::Utc>::from_timestamp(s, 0))
                .unwrap_or_else(chrono::Utc::now)
                .to_rfc3339();
            let res = state
                .db
                .rpc(
                    "record_gateway_payment",
                    &json!({
                        "p_account_id": account_id,
                        "p_payment_id": payment_id,
                        "p_link_id": link.and_then(|l| l.get("id")).and_then(Value::as_str),
                        // reference_id is the invoice id we set on the link.
                        "p_invoice_id": link.and_then(|l| l.get("reference_id")).and_then(Value::as_str).filter(|s| is_uuid(s)),
                        "p_invoice_number": payment.pointer("/notes/invoice_number").and_then(Value::as_str),
                        "p_amount_paise": split.amount_paise,
                        "p_fee_paise": split.fee_paise,
                        "p_tax_on_fee_paise": split.tax_on_fee_paise,
                        "p_method": payment.get("method").and_then(Value::as_str),
                        "p_captured_at": captured_at,
                        "p_raw": payment,
                    }),
                    Some(&service),
                )
                // A database error propagates as 5xx so Razorpay retries instead of the payment being lost.
                .await?;
            tracing::info!("Razorpay {} {}: {}", name, payment_id, res.get("status").unwrap_or(&serde_json::Value::Null));
        }
        "account.app.authorization_revoked" => {
            if let Some(acc) = account_id {
                state
                    .db
                    .rpc("revoke_razorpay_account", &json!({ "p_account_id": acc }), Some(&service))
                    .await?;
            }
        }
        _ => {}
    }
    Ok(Json(json!({ "success": true })))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn uuid_check() {
        assert!(is_uuid("36e00000-0000-4000-8000-000000000001"));
        assert!(!is_uuid("36e00000-0000-4000-8000-00000000000"));
        assert!(!is_uuid("36e00000x0000-4000-8000-000000000001"));
        assert!(!is_uuid("INV-1"));
    }
}
