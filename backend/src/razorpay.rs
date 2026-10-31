//! Razorpay as a Technology Partner: each company connects its own account through OAuth, and
//! Deku calls Razorpay with that company's access token. Webhooks are signed with the partner
//! app's webhook secret (HMAC-SHA256 of the raw body, hex, header `X-Razorpay-Signature`).
//! Field names marked "verify against Razorpay docs" come from Razorpay's public docs and were not
//! checked against a live account.

use crate::config::Config;
use crate::error::AppError;
use serde::Deserialize;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::time::Duration;

const AUTH_BASE: &str = "https://auth.razorpay.com";
const API_BASE: &str = "https://api.razorpay.com/v1";

#[derive(Clone)]
pub struct Razorpay {
    http: reqwest::Client,
    client_id: String,
    client_secret: String,
    redirect_uri: String,
    webhook_secret: String,
}

#[derive(Debug, Deserialize)]
pub struct TokenResponse {
    pub access_token: String,
    pub refresh_token: String,
    #[serde(default)]
    pub public_token: Option<String>,
    /// Seconds; about 90 days. verify against Razorpay docs
    pub expires_in: i64,
    /// verify against Razorpay docs
    #[serde(default)]
    pub razorpay_account_id: Option<String>,
}

impl Razorpay {
    /// `None` unless all four settings are present: payments then stay switched off.
    pub fn from_config(c: &Config) -> Option<Self> {
        Some(Self {
            http: reqwest::Client::builder()
                .timeout(Duration::from_secs(15))
                .build()
                .expect("Failed to build HTTP client"),
            client_id: c.razorpay_client_id.clone()?,
            client_secret: c.razorpay_client_secret.clone()?,
            redirect_uri: c.razorpay_redirect_uri.clone()?,
            webhook_secret: c.razorpay_webhook_secret.clone()?,
        })
    }

    pub fn authorize_url(&self, state: &str) -> String {
        reqwest::Url::parse_with_params(
            &format!("{}/authorize", AUTH_BASE),
            &[
                ("client_id", self.client_id.as_str()),
                ("response_type", "code"),
                ("redirect_uri", self.redirect_uri.as_str()),
                ("scope", "read_write"),
                ("state", state),
            ],
        )
        .expect("static authorize URL")
        .to_string()
    }

    pub async fn exchange_code(&self, code: &str, mode: &str) -> Result<TokenResponse, AppError> {
        let body = json!({
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "grant_type": "authorization_code",
            "redirect_uri": self.redirect_uri,
            "code": code,
            "mode": mode,
        });
        let v = self.post(&format!("{}/token", AUTH_BASE), None, &body).await?;
        serde_json::from_value(v).map_err(|e| AppError::Internal(format!("Unexpected Razorpay token response: {}", e)))
    }

    /// The refresh token rotates: store the new one from the response.
    pub async fn refresh(&self, refresh_token: &str) -> Result<TokenResponse, AppError> {
        let body = json!({
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
        });
        let v = self.post(&format!("{}/token", AUTH_BASE), None, &body).await?;
        serde_json::from_value(v).map_err(|e| AppError::Internal(format!("Unexpected Razorpay token response: {}", e)))
    }

    pub async fn revoke(&self, access_token: &str) -> Result<(), AppError> {
        let body = json!({
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "token_type_hint": "access_token", // verify against Razorpay docs
            "token": access_token,
        });
        self.post(&format!("{}/revoke", AUTH_BASE), None, &body).await.map(|_| ())
    }

    pub async fn create_payment_link(&self, access_token: &str, body: &Value) -> Result<Value, AppError> {
        self.post(&format!("{}/payment_links", API_BASE), Some(access_token), body).await
    }

    pub fn webhook_signature_ok(&self, body: &[u8], signature: &str) -> bool {
        signature_matches(&self.webhook_secret, body, signature)
    }

    async fn post(&self, url: &str, bearer: Option<&str>, body: &Value) -> Result<Value, AppError> {
        let mut req = self.http.post(url).json(body);
        if let Some(t) = bearer {
            req = req.bearer_auth(t);
        }
        let resp = req
            .send()
            .await
            .map_err(|e| AppError::Database(format!("Razorpay unreachable: {}", e)))?;
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        if !status.is_success() {
            // Only the description: never echo a body that could hold credentials.
            return Err(AppError::Database(format!("Razorpay error ({}): {}", status, error_description(&text))));
        }
        if text.trim().is_empty() {
            return Ok(Value::Null);
        }
        serde_json::from_str(&text).map_err(|e| AppError::Internal(format!("Unreadable Razorpay response: {}", e)))
    }
}

fn error_description(text: &str) -> String {
    let v: Value = serde_json::from_str(text).unwrap_or(Value::Null);
    v.pointer("/error/description")
        .or_else(|| v.get("error_description"))
        .and_then(Value::as_str)
        .unwrap_or("no description")
        .chars()
        .take(300)
        .collect()
}

/// RFC 2104 HMAC over SHA-256 (block size 64), so no extra crate is needed.
fn hmac_sha256(key: &[u8], msg: &[u8]) -> [u8; 32] {
    let mut k = [0u8; 64];
    if key.len() > 64 {
        k[..32].copy_from_slice(&Sha256::digest(key));
    } else {
        k[..key.len()].copy_from_slice(key);
    }
    let mut inner = Sha256::new();
    inner.update(k.map(|b| b ^ 0x36));
    inner.update(msg);
    let mut outer = Sha256::new();
    outer.update(k.map(|b| b ^ 0x5c));
    outer.update(inner.finalize());
    let mut out = [0u8; 32];
    out.copy_from_slice(&outer.finalize());
    out
}

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
}

/// Constant-time comparison of the hex signature Razorpay sends with our own.
pub fn signature_matches(secret: &str, body: &[u8], signature: &str) -> bool {
    let expected = hex(&hmac_sha256(secret.as_bytes(), body));
    let given = signature.trim().to_ascii_lowercase();
    given.len() == expected.len()
        && given.bytes().zip(expected.bytes()).fold(0u8, |acc, (a, b)| acc | (a ^ b)) == 0
}

/// What a captured payment books. Razorpay's `fee` includes the GST on it and `tax` is that GST
/// (both paise; verify against Razorpay docs), so the fee proper is `fee - tax`.
#[derive(Debug, PartialEq)]
pub struct PaymentSplit {
    pub amount_paise: i64,
    pub fee_paise: i64,
    pub tax_on_fee_paise: i64,
}

impl PaymentSplit {
    pub fn from_payment(entity: &Value) -> Option<Self> {
        let amount = entity.get("amount")?.as_i64()?;
        let fee_incl_tax = entity.get("fee").and_then(Value::as_i64).unwrap_or(0);
        let tax = entity.get("tax").and_then(Value::as_i64).unwrap_or(0);
        if amount <= 0 || tax < 0 || fee_incl_tax < tax || fee_incl_tax > amount {
            return None;
        }
        Some(Self { amount_paise: amount, fee_paise: fee_incl_tax - tax, tax_on_fee_paise: tax })
    }

    /// Debited to the Razorpay clearing account.
    pub fn net_paise(&self) -> i64 {
        self.amount_paise - self.fee_paise - self.tax_on_fee_paise
    }
}

/// Request body for POST /v1/payment_links. Customer fields are sent only when saved.
pub fn payment_link_body(info: &Value) -> Value {
    let text = |k: &str| info.get(k).and_then(Value::as_str).map(str::trim).filter(|s| !s.is_empty());
    let mut customer = serde_json::Map::new();
    for (ours, theirs) in [("customer_name", "name"), ("customer_email", "email"), ("customer_phone", "contact")] {
        if let Some(v) = text(ours) {
            customer.insert(theirs.into(), json!(v));
        }
    }
    let invoice_number = text("invoice_number").unwrap_or_default();
    let mut body = json!({
        "amount": info.get("amount_paise").and_then(Value::as_i64).unwrap_or(0),
        "currency": "INR",
        "accept_partial": false,
        "reference_id": text("invoice_id").unwrap_or_default(),
        "description": format!("Invoice {}", invoice_number),
        // Deku shares the link itself; Razorpay must not message the customer.
        "notify": { "sms": false, "email": false },
        "reminder_enable": false,
        "notes": { "invoice_number": invoice_number },
    });
    if !customer.is_empty() {
        body["customer"] = Value::Object(customer);
    }
    body
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hmac_matches_rfc4231_vectors() {
        assert_eq!(
            hex(&hmac_sha256(b"Jefe", b"what do ya want for nothing?")),
            "5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843"
        );
        // Key longer than the block size is hashed first.
        assert_eq!(
            hex(&hmac_sha256(&[0xaa; 131], b"Test Using Larger Than Block-Size Key - Hash Key First")),
            "60e431591ee0b67f0d8a26aacbf5b77f8e0bc6213728c5140546040f0ee37f54"
        );
    }

    #[test]
    fn webhook_signature_check() {
        let body = br#"{"event":"payment.captured"}"#;
        let sig = hex(&hmac_sha256(b"whsec", body));
        assert!(signature_matches("whsec", body, &sig));
        assert!(signature_matches("whsec", body, &sig.to_uppercase()));
        assert!(!signature_matches("other", body, &sig));
        assert!(!signature_matches("whsec", br#"{"event":"payment.failed"}"#, &sig));
        assert!(!signature_matches("whsec", body, ""));
        assert!(!signature_matches("whsec", body, &sig[..63]));
    }

    #[test]
    fn payment_split_balances() {
        // 1180.00 paid, fee 23.60 of which 3.60 is GST.
        let s = PaymentSplit::from_payment(&json!({"amount": 118000, "fee": 2360, "tax": 360})).unwrap();
        assert_eq!(s, PaymentSplit { amount_paise: 118000, fee_paise: 2000, tax_on_fee_paise: 360 });
        assert_eq!(s.net_paise(), 115640);
        assert_eq!(s.net_paise() + s.fee_paise + s.tax_on_fee_paise, s.amount_paise);

        let no_fee = PaymentSplit::from_payment(&json!({"amount": 500})).unwrap();
        assert_eq!((no_fee.fee_paise, no_fee.tax_on_fee_paise, no_fee.net_paise()), (0, 0, 500));

        assert!(PaymentSplit::from_payment(&json!({"amount": 100, "fee": 10, "tax": 20})).is_none());
        assert!(PaymentSplit::from_payment(&json!({"amount": 100, "fee": 200, "tax": 0})).is_none());
        assert!(PaymentSplit::from_payment(&json!({"amount": 0})).is_none());
    }

    #[test]
    fn payment_link_sends_only_saved_customer_fields() {
        let body = payment_link_body(&json!({
            "invoice_id": "36e00000-0000-4000-8000-000000000001",
            "invoice_number": "INV-1",
            "amount_paise": 118000,
            "customer_name": "Asha Traders",
            "customer_email": null,
            "customer_phone": " ",
        }));
        assert_eq!(body["amount"], 118000);
        assert_eq!(body["reference_id"], "36e00000-0000-4000-8000-000000000001");
        assert_eq!(body["notes"], json!({"invoice_number": "INV-1"}));
        assert_eq!(body["customer"], json!({"name": "Asha Traders"}));

        let bare = payment_link_body(&json!({"invoice_id": "x", "invoice_number": "INV-2", "amount_paise": 1}));
        assert!(bare.get("customer").is_none());
    }
}
