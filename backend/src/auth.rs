//! Login primitives: bcrypt passwords, HS256 JWTs and opaque refresh tokens.
//! See docs/PLATFORM_ARCHITECTURE.md ("JWT" and "Database identity layer").

use crate::error::AppError;
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use jsonwebtoken::{decode, encode, Algorithm, DecodingKey, EncodingKey, Header, Validation};
use rand::{rngs::OsRng, RngCore};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::sync::OnceLock;

pub const AUDIENCE: &str = "deku";
pub const ACCESS_TTL_SECS: i64 = 3600;
const SERVICE_TTL_SECS: i64 = 60;
const REFRESH_TTL_DAYS: i64 = 30;
const BCRYPT_COST: u32 = 12;
const MIN_PASSWORD_LEN: usize = 10;

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sub: Option<String>,
    pub role: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub email: Option<String>,
    pub aud: String,
    pub iat: i64,
    pub exp: i64,
}

fn now() -> i64 {
    chrono::Utc::now().timestamp()
}

fn sign(claims: &Claims, secret: &str) -> Result<String, AppError> {
    encode(&Header::new(Algorithm::HS256), claims, &EncodingKey::from_secret(secret.as_bytes()))
        .map_err(|e| AppError::Internal(format!("Failed to sign token: {}", e)))
}

pub fn access_token(secret: &str, user_id: &str, email: &str) -> Result<String, AppError> {
    let iat = now();
    sign(
        &Claims {
            sub: Some(user_id.to_string()),
            role: "authenticated".into(),
            email: Some(email.to_string()),
            aud: AUDIENCE.into(),
            iat,
            exp: iat + ACCESS_TTL_SECS,
        },
        secret,
    )
}

/// Only for the `public.auth_*` RPCs; it must never be returned to a caller.
pub fn service_token(secret: &str) -> Result<String, AppError> {
    let iat = now();
    sign(
        &Claims {
            sub: None,
            role: "service_role".into(),
            email: None,
            aud: AUDIENCE.into(),
            iat,
            exp: iat + SERVICE_TTL_SECS,
        },
        secret,
    )
}

/// Checks signature, audience and expiry, and that it is a user (not service) token.
pub fn verify_access_token(secret: &str, token: &str) -> Result<Claims, AppError> {
    let mut validation = Validation::new(Algorithm::HS256);
    validation.set_audience(&[AUDIENCE]);
    let claims = decode::<Claims>(token, &DecodingKey::from_secret(secret.as_bytes()), &validation)
        .map_err(|_| AppError::Unauthorized("invalid_token".into()))?
        .claims;
    if claims.role != "authenticated" || claims.sub.is_none() {
        return Err(AppError::Unauthorized("invalid_token".into()));
    }
    Ok(claims)
}

pub fn hash_password(password: &str) -> Result<String, AppError> {
    bcrypt::hash(password, BCRYPT_COST).map_err(|e| AppError::Internal(format!("Failed to hash password: {}", e)))
}

/// Verifies against a dummy hash when there is no user, so unknown emails cost the same time.
pub fn verify_password(password: &str, stored_hash: Option<&str>) -> bool {
    static DUMMY: OnceLock<String> = OnceLock::new();
    match stored_hash {
        Some(hash) => bcrypt::verify(password, hash).unwrap_or(false),
        None => {
            let dummy = DUMMY.get_or_init(|| {
                bcrypt::hash("deku-dummy-password", BCRYPT_COST).expect("bcrypt dummy hash")
            });
            let _ = bcrypt::verify(password, dummy);
            false
        }
    }
}

pub fn new_refresh_token() -> String {
    let mut bytes = [0u8; 32];
    OsRng.fill_bytes(&mut bytes);
    URL_SAFE_NO_PAD.encode(bytes)
}

pub fn hash_refresh_token(token: &str) -> String {
    Sha256::digest(token.as_bytes()).iter().map(|b| format!("{:02x}", b)).collect()
}

pub fn refresh_expiry() -> String {
    (chrono::Utc::now() + chrono::Duration::days(REFRESH_TTL_DAYS)).to_rfc3339()
}

pub fn normalize_email(email: &str) -> String {
    email.trim().to_lowercase()
}

fn is_valid_email(email: &str) -> bool {
    if email.len() > 254 || email.chars().any(char::is_whitespace) {
        return false;
    }
    match email.split_once('@') {
        Some((local, domain)) => {
            !local.is_empty()
                && !domain.contains('@')
                && domain.contains('.')
                && !domain.starts_with('.')
                && !domain.ends_with('.')
        }
        None => false,
    }
}

/// Expects an already normalised email and trimmed full name.
pub fn validate_signup(email: &str, password: &str, full_name: &str) -> Result<(), AppError> {
    if !is_valid_email(email) {
        return Err(AppError::BadRequest("invalid_email".into()));
    }
    if password.chars().count() < MIN_PASSWORD_LEN {
        return Err(AppError::BadRequest("password_too_short".into()));
    }
    if full_name.is_empty() {
        return Err(AppError::BadRequest("full_name_required".into()));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    const SECRET: &str = "test-secret-that-is-at-least-32-bytes-long";

    #[test]
    fn access_token_round_trips() {
        let token = access_token(SECRET, "11111111-1111-1111-1111-111111111111", "a@b.co").unwrap();
        let claims = verify_access_token(SECRET, &token).unwrap();
        assert_eq!(claims.sub.as_deref(), Some("11111111-1111-1111-1111-111111111111"));
        assert_eq!(claims.email.as_deref(), Some("a@b.co"));
        assert_eq!(claims.role, "authenticated");
        assert_eq!(claims.aud, AUDIENCE);
        assert_eq!(claims.exp - claims.iat, ACCESS_TTL_SECS);
    }

    #[test]
    fn rejects_wrong_secret() {
        let token = access_token(SECRET, "u", "a@b.co").unwrap();
        assert!(verify_access_token("another-secret-that-is-also-32-bytes-long", &token).is_err());
    }

    #[test]
    fn rejects_wrong_audience_and_expired() {
        let iat = now();
        let mut claims = Claims {
            sub: Some("u".into()),
            role: "authenticated".into(),
            email: None,
            aud: "someone-else".into(),
            iat,
            exp: iat + 600,
        };
        assert!(verify_access_token(SECRET, &sign(&claims, SECRET).unwrap()).is_err());

        claims.aud = AUDIENCE.into();
        claims.iat = iat - 7200;
        claims.exp = iat - 3600;
        assert!(verify_access_token(SECRET, &sign(&claims, SECRET).unwrap()).is_err());
    }

    #[test]
    fn service_token_is_not_an_access_token() {
        let token = service_token(SECRET).unwrap();
        assert!(verify_access_token(SECRET, &token).is_err());
    }

    #[test]
    fn verifies_pgcrypto_style_2a_hashes() {
        // Generated like seed.sql: crypt('DekuDemo#2026', gen_salt('bf')) yields a $2a$ hash.
        assert!(verify_password(
            "DekuDemo#2026",
            Some("$2a$06$mUXXOZV32zgkeXPje10P..QqsXtg8lNZaOpkFhX8/OxF36tZsKite")
        ));
        // Openwall crypt_blowfish test vector.
        assert!(verify_password("U*U", Some("$2a$05$CCCCCCCCCCCCCCCCCCCCC.E5YPO9kmyuRGyh0XouQYb4YMJKvyOeW")));
        assert!(!verify_password("wrong", Some("$2a$05$CCCCCCCCCCCCCCCCCCCCC.E5YPO9kmyuRGyh0XouQYb4YMJKvyOeW")));
        assert!(!verify_password("anything", None));
    }

    #[test]
    fn refresh_token_hash_is_stable() {
        assert_eq!(
            hash_refresh_token("abc"),
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
        let token = new_refresh_token();
        assert_eq!(token.len(), 43); // 32 bytes, base64url without padding
        assert_eq!(hash_refresh_token(&token), hash_refresh_token(&token));
        assert_ne!(token, new_refresh_token());
    }

    #[test]
    fn signup_validation() {
        assert!(validate_signup("a@b.co", "0123456789", "Asha").is_ok());
        assert!(validate_signup("not-an-email", "0123456789", "Asha").is_err());
        assert!(validate_signup("a@b", "0123456789", "Asha").is_err());
        assert!(validate_signup("a b@c.co", "0123456789", "Asha").is_err());
        assert!(validate_signup("a@b.co", "short", "Asha").is_err());
        assert!(validate_signup("a@b.co", "0123456789", "").is_err());
    }
}
