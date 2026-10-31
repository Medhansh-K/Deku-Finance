//! KYC seam: PAN, Udyam and GSTIN checks plus the DigiLocker / EntityLocker consent flow. No provider has
//! been chosen (docs/IMPLEMENTATION_PLAN.md §6), so only `NotConfigured` and a labelled `Sandbox` exist.
//! Adapters return the outcome and the provider's reference only: never an Aadhaar number or a document
//! (migration 038 refuses both).

use chrono::{DateTime, Utc};
use serde_json::{json, Value};

use super::{not_configured, random_hex, ready, ProviderError, ProviderFuture};

pub struct Outcome {
    pub verified: bool,
    /// The name the registry holds, when the provider returns one.
    pub verified_name: Option<String>,
    pub provider_ref: Option<String>,
    pub failure_reason: Option<String>,
    pub expires_at: Option<DateTime<Utc>>,
    /// At most a few flags (e.g. `pan_status`); see `kyc_verifications.raw_minimal`.
    pub raw_minimal: Value,
}

pub struct ConsentStart {
    /// Where the browser goes to give consent. Real providers redirect back to the URI registered
    /// with them, never to one the client supplies.
    pub authorize_url: String,
    pub provider_ref: String,
}

pub trait KycProvider: Send + Sync {
    fn name(&self) -> &'static str;
    fn is_configured(&self) -> bool {
        true
    }
    fn is_sandbox(&self) -> bool {
        false
    }
    fn verify_pan<'a>(&'a self, pan: &'a str, name: Option<&'a str>) -> ProviderFuture<'a, Outcome>;
    fn verify_udyam<'a>(&'a self, udyam_number: &'a str) -> ProviderFuture<'a, Outcome>;
    fn verify_gstin<'a>(&'a self, gstin: &'a str) -> ProviderFuture<'a, Outcome>;
    /// `business` picks EntityLocker (the company's documents) over DigiLocker (a person's).
    fn start_digilocker<'a>(&'a self, business: bool) -> ProviderFuture<'a, ConsentStart>;
    fn complete_digilocker<'a>(&'a self, provider_ref: &'a str, code: &'a str) -> ProviderFuture<'a, Outcome>;
}

/// The default when `KYC_PROVIDER` is unset: nothing leaves Deku.
pub struct NotConfigured;

impl KycProvider for NotConfigured {
    fn name(&self) -> &'static str {
        "none"
    }
    fn is_configured(&self) -> bool {
        false
    }
    fn verify_pan<'a>(&'a self, _: &'a str, _: Option<&'a str>) -> ProviderFuture<'a, Outcome> {
        not_configured()
    }
    fn verify_udyam<'a>(&'a self, _: &'a str) -> ProviderFuture<'a, Outcome> {
        not_configured()
    }
    fn verify_gstin<'a>(&'a self, _: &'a str) -> ProviderFuture<'a, Outcome> {
        not_configured()
    }
    fn start_digilocker<'a>(&'a self, _: bool) -> ProviderFuture<'a, ConsentStart> {
        not_configured()
    }
    fn complete_digilocker<'a>(&'a self, _: &'a str, _: &'a str) -> ProviderFuture<'a, Outcome> {
        not_configured()
    }
}

/// Local demos only (`KYC_PROVIDER=sandbox`, refused in production). Checks formats, contacts no
/// registry, never invents a name, and marks every row `sandbox`, which the trust level ignores.
pub struct Sandbox;

pub const SANDBOX_CODE: &str = "SANDBOX-CONSENT";

fn sandbox_ok() -> Outcome {
    Outcome {
        verified: true,
        verified_name: None,
        provider_ref: Some(format!("SANDBOX-{}", random_hex(8))),
        failure_reason: None,
        expires_at: None,
        raw_minimal: json!({ "sandbox": true, "note": "No registry was contacted" }),
    }
}

impl KycProvider for Sandbox {
    fn name(&self) -> &'static str {
        "sandbox"
    }
    fn is_sandbox(&self) -> bool {
        true
    }
    fn verify_pan<'a>(&'a self, _: &'a str, _: Option<&'a str>) -> ProviderFuture<'a, Outcome> {
        ready(Ok(sandbox_ok()))
    }
    fn verify_udyam<'a>(&'a self, _: &'a str) -> ProviderFuture<'a, Outcome> {
        ready(Ok(sandbox_ok()))
    }
    fn verify_gstin<'a>(&'a self, _: &'a str) -> ProviderFuture<'a, Outcome> {
        ready(Ok(sandbox_ok()))
    }
    fn start_digilocker<'a>(&'a self, business: bool) -> ProviderFuture<'a, ConsentStart> {
        let provider_ref = format!("SANDBOX-{}", random_hex(12));
        // Straight back to the KYC hub, as if consent had been given.
        let authorize_url = format!(
            "/kyc?sandbox=1&flow={}&ref={}&code={}",
            if business { "entitylocker" } else { "digilocker" },
            provider_ref,
            SANDBOX_CODE
        );
        ready(Ok(ConsentStart { authorize_url, provider_ref }))
    }
    fn complete_digilocker<'a>(&'a self, _: &'a str, code: &'a str) -> ProviderFuture<'a, Outcome> {
        ready(if code == SANDBOX_CODE {
            Ok(sandbox_ok())
        } else {
            Err(ProviderError::Rejected("Consent was not given".into()))
        })
    }
}

// ---------- Format checks, applied before anything is sent to a provider ----------

pub fn is_pan(s: &str) -> bool {
    let b = s.as_bytes();
    b.len() == 10
        && b[..5].iter().all(u8::is_ascii_uppercase)
        && b[5..9].iter().all(u8::is_ascii_digit)
        && b[9].is_ascii_uppercase()
}

/// UDYAM-XX-00-0000000
pub fn is_udyam(s: &str) -> bool {
    let p: Vec<&str> = s.split('-').collect();
    p.len() == 4
        && p[0] == "UDYAM"
        && p[1].len() == 2
        && p[1].bytes().all(|c| c.is_ascii_uppercase())
        && p[2].len() == 2
        && p[2].bytes().all(|c| c.is_ascii_digit())
        && p[3].len() == 7
        && p[3].bytes().all(|c| c.is_ascii_digit())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn block<T>(f: ProviderFuture<'_, T>) -> Result<T, ProviderError> {
        tokio::runtime::Builder::new_current_thread().build().unwrap().block_on(f)
    }

    #[test]
    fn not_configured_refuses_everything() {
        let p = NotConfigured;
        assert!(!p.is_configured());
        assert!(matches!(block(p.verify_pan("AAAAA0000A", None)), Err(ProviderError::NotConfigured)));
        assert!(matches!(block(p.verify_udyam("UDYAM-MH-01-0000001")), Err(ProviderError::NotConfigured)));
        assert!(matches!(block(p.verify_gstin("27AAAAA0000A1Z5")), Err(ProviderError::NotConfigured)));
        assert!(matches!(block(p.start_digilocker(false)), Err(ProviderError::NotConfigured)));
        assert!(matches!(block(p.complete_digilocker("r", "c")), Err(ProviderError::NotConfigured)));
    }

    #[test]
    fn sandbox_is_labelled_and_invents_no_name() {
        let p = Sandbox;
        let o = block(p.verify_pan("AAAAA0000A", Some("Someone"))).unwrap();
        assert!(o.verified);
        assert_eq!(o.verified_name, None);
        assert!(o.provider_ref.unwrap().starts_with("SANDBOX-"));
        assert_eq!(o.raw_minimal["sandbox"], true);

        let start = block(p.start_digilocker(true)).unwrap();
        assert!(start.provider_ref.starts_with("SANDBOX-"));
        assert!(start.authorize_url.starts_with("/kyc?sandbox=1&flow=entitylocker"));
        assert!(block(p.complete_digilocker(&start.provider_ref, SANDBOX_CODE)).unwrap().verified);
        assert!(block(p.complete_digilocker(&start.provider_ref, "other")).is_err());
    }

    #[test]
    fn formats() {
        assert!(is_pan("ABCDE1234F"));
        assert!(!is_pan("ABCDE1234"));
        assert!(!is_pan("abcde1234f"));
        assert!(is_udyam("UDYAM-MH-01-0000001"));
        assert!(!is_udyam("UDYAM-MH-1-0000001"));
        assert!(!is_udyam("UDYAM-MH-01-000001"));
    }
}
