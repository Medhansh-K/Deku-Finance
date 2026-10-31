//! Third-party adapters (GST Suvidha Provider, KYC). Each area is a provider-neutral trait with a
//! `NotConfigured` implementation (the default: every call answers 503 `<area>_not_configured`) and a
//! `Sandbox` one for local demos. A real provider is one more implementation; see docs/INTEGRATIONS.md.

pub mod gsp;
pub mod kyc;

use std::future::Future;
use std::pin::Pin;

use axum::http::HeaderMap;
use serde_json::{json, Value};

use crate::auth;
use crate::error::AppError;
use crate::routes::AppState;

/// Boxed so the traits stay object-safe (`Arc<dyn ...>` in AppState) without the async-trait crate.
pub type ProviderFuture<'a, T> = Pin<Box<dyn Future<Output = Result<T, ProviderError>> + Send + 'a>>;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ProviderError {
    /// No provider selected (or no encryption key for one that stores credentials).
    NotConfigured,
    /// The provider understood the request and refused it: wrong OTP, invalid PAN, IRN already cancelled.
    Rejected(String),
    /// Network failure or a reply the adapter couldn't read.
    Upstream(String),
}

impl ProviderError {
    /// Short, secret-free text for logs and `gsp_requests.error`.
    pub fn summary(&self) -> String {
        let s = match self {
            ProviderError::NotConfigured => "not configured".to_string(),
            ProviderError::Rejected(m) => format!("rejected: {}", m),
            ProviderError::Upstream(m) => format!("provider error: {}", m),
        };
        s.chars().take(500).collect()
    }

    pub fn into_app(self, not_configured_code: &str) -> AppError {
        match self {
            ProviderError::NotConfigured => AppError::ServiceUnavailable(not_configured_code.to_string()),
            ProviderError::Rejected(m) => AppError::BadRequest(m),
            ProviderError::Upstream(m) => AppError::Database(format!("Provider error: {}", m)),
        }
    }
}

pub(crate) fn not_configured<'a, T: Send + 'a>() -> ProviderFuture<'a, T> {
    Box::pin(std::future::ready(Err(ProviderError::NotConfigured)))
}

pub(crate) fn ready<'a, T: Send + 'a>(r: Result<T, ProviderError>) -> ProviderFuture<'a, T> {
    Box::pin(std::future::ready(r))
}

/// Which adapter an env var such as `GSP_PROVIDER` selects.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Choice {
    NotConfigured,
    Sandbox,
}

/// Unset or empty means switched off. Sandbox output is not legally valid, so it is refused when
/// `DEKU_ENV=production`; an unknown name is refused too, so a typo can't silently switch an area off.
pub fn choose(var: &str, provider: Option<&str>, deku_env: Option<&str>) -> Result<Choice, String> {
    let provider = provider.map(|p| p.trim().to_ascii_lowercase()).filter(|p| !p.is_empty());
    let production = deku_env.map(|e| e.trim().eq_ignore_ascii_case("production")).unwrap_or(false);
    match provider.as_deref() {
        None => Ok(Choice::NotConfigured),
        Some("sandbox") if production => Err(format!(
            "{}=sandbox is refused when DEKU_ENV=production: sandbox results are not legally valid",
            var
        )),
        Some("sandbox") => Ok(Choice::Sandbox),
        Some(other) => Err(format!("{}={} is not an implemented provider (available: sandbox)", var, other)),
    }
}

// ---------- Helpers shared by routes/gsp.rs and routes/kyc.rs ----------

pub const FINANCE_ROLES: &[&str] = &["owner", "cfo", "admin", "accountant"];
pub const ADMIN_ROLES: &[&str] = &["owner", "cfo", "admin"];

pub struct Caller<'a> {
    pub token: &'a str,
    pub user_id: String,
}

/// The caller's token and user id. Integration writes use the service token, so the actor has to be
/// taken from the verified token here rather than from `auth.uid()` in SQL.
pub fn caller<'a>(state: &AppState, headers: &'a HeaderMap) -> Result<Caller<'a>, AppError> {
    let token = headers
        .get("Authorization")
        .and_then(|h| h.to_str().ok())
        .and_then(|h| h.strip_prefix("Bearer "))
        .filter(|t| !t.trim().is_empty())
        .ok_or_else(|| AppError::Unauthorized("Sign in required".into()))?;
    let claims = auth::verify_access_token(&state.jwt_secret, token)?;
    Ok(Caller { token, user_id: claims.sub.unwrap_or_default() })
}

/// Checked with the caller's own token, before anything is written with the service token.
pub async fn require_role(state: &AppState, caller: &Caller<'_>, org_id: &str, roles: &[&str]) -> Result<(), AppError> {
    if !is_uuid(org_id) {
        return Err(AppError::BadRequest("Invalid company id".into()));
    }
    let ok = state
        .db
        .rpc("has_role", &json!({ "p_org_id": org_id, "p_roles": roles }), Some(caller.token))
        .await?;
    if ok == Value::Bool(true) {
        Ok(())
    } else {
        Err(AppError::Forbidden(format!("Only {} can do this", roles.join(", "))))
    }
}

pub fn service(state: &AppState) -> Result<String, AppError> {
    auth::service_token(&state.jwt_secret)
}

pub fn is_uuid(s: &str) -> bool {
    let b = s.as_bytes();
    b.len() == 36
        && b.iter().enumerate().all(|(i, c)| match i {
            8 | 13 | 18 | 23 => *c == b'-',
            _ => c.is_ascii_hexdigit(),
        })
}

pub fn first(v: Value) -> Option<Value> {
    match v {
        Value::Array(mut a) if !a.is_empty() => Some(a.swap_remove(0)),
        _ => None,
    }
}

pub fn now() -> String {
    chrono::Utc::now().to_rfc3339()
}

/// Lowercase hex of SHA-256, used by the sandboxes for stable, obviously synthetic identifiers.
pub(crate) fn sha_hex(input: &str) -> String {
    use sha2::{Digest, Sha256};
    Sha256::digest(input.as_bytes()).iter().map(|b| format!("{:02x}", b)).collect()
}

pub(crate) fn random_hex(bytes: usize) -> String {
    use rand::RngCore;
    let mut buf = vec![0u8; bytes];
    rand::rngs::OsRng.fill_bytes(&mut buf);
    buf.iter().map(|b| format!("{:02x}", b)).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn unset_or_empty_is_switched_off() {
        assert_eq!(choose("GSP_PROVIDER", None, None), Ok(Choice::NotConfigured));
        assert_eq!(choose("GSP_PROVIDER", Some("  "), Some("production")), Ok(Choice::NotConfigured));
    }

    #[test]
    fn sandbox_only_outside_production() {
        assert_eq!(choose("KYC_PROVIDER", Some("sandbox"), None), Ok(Choice::Sandbox));
        assert_eq!(choose("KYC_PROVIDER", Some("Sandbox"), Some("development")), Ok(Choice::Sandbox));
        let err = choose("KYC_PROVIDER", Some("sandbox"), Some("Production")).unwrap_err();
        assert!(err.contains("refused"), "{}", err);
        assert!(choose("GSP_PROVIDER", Some("sandbox"), Some(" production ")).is_err());
    }

    #[test]
    fn unknown_provider_is_refused() {
        assert!(choose("GSP_PROVIDER", Some("acme_gsp"), None).is_err());
    }

    #[test]
    fn not_configured_maps_to_503_code() {
        match ProviderError::NotConfigured.into_app("gsp_not_configured") {
            AppError::ServiceUnavailable(code) => assert_eq!(code, "gsp_not_configured"),
            other => panic!("unexpected {:?}", other),
        }
    }

    #[test]
    fn uuid_shape() {
        assert!(is_uuid("37100000-0000-4000-8000-000000000001"));
        assert!(!is_uuid("37100000-0000-4000-8000-00000000000"));
        assert!(!is_uuid("eq.1,or(x)-0000-4000-8000-000000000001"));
    }
}
