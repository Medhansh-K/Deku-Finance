//! GST Suvidha Provider seam: GST portal sessions (OTP), return filing with EVC, e-invoice IRNs and
//! e-way bills. No GSP has been chosen (docs/IMPLEMENTATION_PLAN.md §6), so only `NotConfigured` and a
//! clearly labelled `Sandbox` exist.

use chrono::{DateTime, Duration, Utc};
use serde_json::{json, Value};

use super::{not_configured, random_hex, ready, sha_hex, ProviderError, ProviderFuture};

/// What a provider needs to act for one company. Some GSPs use separate e-invoice / e-way bill API
/// credentials; mapping these onto them is the adapter's job.
pub struct Ctx<'a> {
    pub gstin: &'a str,
    pub username: &'a str,
    /// From `verify_otp`; empty before a session exists.
    pub session_token: &'a str,
}

pub struct Session {
    pub token: String,
    pub expires_at: DateTime<Utc>,
}

pub struct Evc<'a> {
    pub pan: &'a str,
    pub otp: &'a str,
}

pub struct Filed {
    pub arn: String,
}

pub struct Irn {
    pub irn: String,
    pub ack_no: Option<String>,
    pub ack_date: Option<DateTime<Utc>>,
    pub signed_qr: Option<String>,
    pub raw: Value,
}

pub struct EwbRequest<'a> {
    pub vehicle_no: Option<&'a str>,
    pub transporter_id: Option<&'a str>,
    pub distance_km: u32,
    /// The live IRN, when the e-way bill is generated from an e-invoice.
    pub irn: Option<&'a str>,
}

pub struct Ewb {
    pub ewb_no: String,
    pub valid_upto: Option<DateTime<Utc>>,
    pub raw: Value,
}

pub trait GspProvider: Send + Sync {
    /// Stored in the `provider` columns.
    fn name(&self) -> &'static str;
    fn is_configured(&self) -> bool {
        true
    }
    fn is_sandbox(&self) -> bool {
        false
    }
    /// Asks the portal to send the taxpayer an OTP.
    fn start_session<'a>(&'a self, ctx: &'a Ctx<'a>) -> ProviderFuture<'a, ()>;
    fn verify_otp<'a>(&'a self, ctx: &'a Ctx<'a>, otp: &'a str) -> ProviderFuture<'a, Session>;
    /// Asks the portal to send the EVC OTP to the authorised signatory registered with this PAN.
    fn request_evc_otp<'a>(&'a self, ctx: &'a Ctx<'a>, pan: &'a str, ret_period: &'a str, return_type: &'a str) -> ProviderFuture<'a, ()>;
    /// Saves, submits and files the return JSON (as `backend/src/gst` builds it) with EVC; returns the ARN.
    fn file_return<'a>(
        &'a self,
        ctx: &'a Ctx<'a>,
        ret_period: &'a str,
        return_type: &'a str,
        json: &'a Value,
        evc: &'a Evc<'a>,
    ) -> ProviderFuture<'a, Filed>;
    /// `invoice` is the sales_invoices row with `parties` and `sales_invoice_lines` embedded.
    fn generate_irn<'a>(&'a self, ctx: &'a Ctx<'a>, invoice: &'a Value) -> ProviderFuture<'a, Irn>;
    /// `reason_code` follows the IRP: 1 duplicate, 2 data entry mistake, 3 order cancelled, 4 other.
    fn cancel_irn<'a>(&'a self, ctx: &'a Ctx<'a>, irn: &'a str, reason_code: u8, remark: &'a str) -> ProviderFuture<'a, ()>;
    fn generate_ewb<'a>(&'a self, ctx: &'a Ctx<'a>, invoice: &'a Value, req: &'a EwbRequest<'a>) -> ProviderFuture<'a, Ewb>;
    fn cancel_ewb<'a>(&'a self, ctx: &'a Ctx<'a>, ewb_no: &'a str, reason_code: u8, remark: &'a str) -> ProviderFuture<'a, ()>;
}

/// The default when `GSP_PROVIDER` is unset: nothing leaves Deku.
pub struct NotConfigured;

impl GspProvider for NotConfigured {
    fn name(&self) -> &'static str {
        "none"
    }
    fn is_configured(&self) -> bool {
        false
    }
    fn start_session<'a>(&'a self, _: &'a Ctx<'a>) -> ProviderFuture<'a, ()> {
        not_configured()
    }
    fn verify_otp<'a>(&'a self, _: &'a Ctx<'a>, _: &'a str) -> ProviderFuture<'a, Session> {
        not_configured()
    }
    fn request_evc_otp<'a>(&'a self, _: &'a Ctx<'a>, _: &'a str, _: &'a str, _: &'a str) -> ProviderFuture<'a, ()> {
        not_configured()
    }
    fn file_return<'a>(&'a self, _: &'a Ctx<'a>, _: &'a str, _: &'a str, _: &'a Value, _: &'a Evc<'a>) -> ProviderFuture<'a, Filed> {
        not_configured()
    }
    fn generate_irn<'a>(&'a self, _: &'a Ctx<'a>, _: &'a Value) -> ProviderFuture<'a, Irn> {
        not_configured()
    }
    fn cancel_irn<'a>(&'a self, _: &'a Ctx<'a>, _: &'a str, _: u8, _: &'a str) -> ProviderFuture<'a, ()> {
        not_configured()
    }
    fn generate_ewb<'a>(&'a self, _: &'a Ctx<'a>, _: &'a Value, _: &'a EwbRequest<'a>) -> ProviderFuture<'a, Ewb> {
        not_configured()
    }
    fn cancel_ewb<'a>(&'a self, _: &'a Ctx<'a>, _: &'a str, _: u8, _: &'a str) -> ProviderFuture<'a, ()> {
        not_configured()
    }
}

/// Local demos only (`GSP_PROVIDER=sandbox`, refused in production). Makes no network call and labels
/// every identifier it invents with `SANDBOX`, so nothing it returns can pass for a real IRN, ARN or EWB.
pub struct Sandbox;

pub const SANDBOX_PREFIX: &str = "SANDBOX-";
const SESSION_HOURS: i64 = 6;

impl GspProvider for Sandbox {
    fn name(&self) -> &'static str {
        "sandbox"
    }
    fn is_sandbox(&self) -> bool {
        true
    }
    fn start_session<'a>(&'a self, ctx: &'a Ctx<'a>) -> ProviderFuture<'a, ()> {
        ready(if ctx.username.trim().is_empty() {
            Err(ProviderError::Rejected("GST portal username is missing".into()))
        } else {
            Ok(())
        })
    }
    // Any 6-digit OTP is accepted.
    fn verify_otp<'a>(&'a self, _: &'a Ctx<'a>, otp: &'a str) -> ProviderFuture<'a, Session> {
        ready(if otp.len() == 6 && otp.bytes().all(|c| c.is_ascii_digit()) {
            Ok(Session {
                token: format!("{}SESSION-{}", SANDBOX_PREFIX, random_hex(16)),
                expires_at: Utc::now() + Duration::hours(SESSION_HOURS),
            })
        } else {
            Err(ProviderError::Rejected("OTP must be 6 digits".into()))
        })
    }
    fn request_evc_otp<'a>(&'a self, _: &'a Ctx<'a>, _: &'a str, _: &'a str, _: &'a str) -> ProviderFuture<'a, ()> {
        ready(Ok(()))
    }
    fn file_return<'a>(&'a self, ctx: &'a Ctx<'a>, ret_period: &'a str, return_type: &'a str, _: &'a Value, _: &'a Evc<'a>) -> ProviderFuture<'a, Filed> {
        // gst_return_filings.filed_arn only allows A-Z and 0-9, so no dash here.
        let h = sha_hex(&format!("{}|{}|{}", ctx.gstin, ret_period, return_type)).to_ascii_uppercase();
        ready(Ok(Filed { arn: format!("SANDBOX{}", &h[..12]) }))
    }
    fn generate_irn<'a>(&'a self, ctx: &'a Ctx<'a>, invoice: &'a Value) -> ProviderFuture<'a, Irn> {
        let number = invoice.get("invoice_number").and_then(|v| v.as_str()).unwrap_or("");
        let date = invoice.get("invoice_date").and_then(|v| v.as_str()).unwrap_or("");
        let h = sha_hex(&format!("{}|{}|{}", ctx.gstin, number, date));
        let irn = format!("{}{}", SANDBOX_PREFIX, &h[..56]);
        ready(Ok(Irn {
            signed_qr: Some(format!("{}NOT-A-SIGNED-QR|{}|{}|{}", SANDBOX_PREFIX, ctx.gstin, number, irn)),
            ack_no: Some(format!("{}ACK-{}", SANDBOX_PREFIX, &h[56..])),
            ack_date: Some(Utc::now()),
            raw: json!({ "sandbox": true, "note": "Not registered on the Invoice Registration Portal" }),
            irn,
        }))
    }
    fn cancel_irn<'a>(&'a self, _: &'a Ctx<'a>, _: &'a str, _: u8, _: &'a str) -> ProviderFuture<'a, ()> {
        ready(Ok(()))
    }
    fn generate_ewb<'a>(&'a self, ctx: &'a Ctx<'a>, invoice: &'a Value, req: &'a EwbRequest<'a>) -> ProviderFuture<'a, Ewb> {
        let number = invoice.get("invoice_number").and_then(|v| v.as_str()).unwrap_or("");
        let digits: String = sha_hex(&format!("{}|{}|ewb", ctx.gstin, number))
            .bytes()
            .map(|b| char::from(b'0' + b % 10))
            .take(12)
            .collect();
        // Validity rule of thumb for normal cargo: one day per 200 km, at least one.
        let days = (req.distance_km as i64 + 199) / 200;
        ready(Ok(Ewb {
            ewb_no: format!("{}{}", SANDBOX_PREFIX, digits),
            valid_upto: Some(Utc::now() + Duration::days(days.max(1))),
            raw: json!({ "sandbox": true, "note": "Not generated on the e-way bill portal" }),
        }))
    }
    fn cancel_ewb<'a>(&'a self, _: &'a Ctx<'a>, _: &'a str, _: u8, _: &'a str) -> ProviderFuture<'a, ()> {
        ready(Ok(()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ctx() -> Ctx<'static> {
        Ctx { gstin: "27AAAAA0000A1Z5", username: "demo", session_token: "" }
    }

    fn block<T>(f: ProviderFuture<'_, T>) -> Result<T, ProviderError> {
        tokio::runtime::Builder::new_current_thread().build().unwrap().block_on(f)
    }

    #[test]
    fn not_configured_refuses_everything() {
        let p = NotConfigured;
        let c = ctx();
        let inv = json!({});
        let evc = Evc { pan: "AAAAA0000A", otp: "123456" };
        let ewb = EwbRequest { vehicle_no: None, transporter_id: None, distance_km: 10, irn: None };
        assert!(!p.is_configured());
        assert_eq!(block(p.start_session(&c)).err(), Some(ProviderError::NotConfigured));
        assert!(matches!(block(p.verify_otp(&c, "123456")), Err(ProviderError::NotConfigured)));
        assert!(matches!(block(p.request_evc_otp(&c, "AAAAA0000A", "102026", "GSTR1")), Err(ProviderError::NotConfigured)));
        assert!(matches!(block(p.file_return(&c, "102026", "GSTR1", &inv, &evc)), Err(ProviderError::NotConfigured)));
        assert!(matches!(block(p.generate_irn(&c, &inv)), Err(ProviderError::NotConfigured)));
        assert!(matches!(block(p.cancel_irn(&c, "x", 1, "x")), Err(ProviderError::NotConfigured)));
        assert!(matches!(block(p.generate_ewb(&c, &inv, &ewb)), Err(ProviderError::NotConfigured)));
        assert!(matches!(block(p.cancel_ewb(&c, "x", 1, "x")), Err(ProviderError::NotConfigured)));
    }

    #[test]
    fn sandbox_labels_everything_it_invents() {
        let p = Sandbox;
        let c = ctx();
        let inv = json!({ "invoice_number": "INV-1", "invoice_date": "2026-10-01" });
        let irn = block(p.generate_irn(&c, &inv)).unwrap();
        assert!(irn.irn.starts_with("SANDBOX-"));
        assert_eq!(irn.irn.len(), 64);
        assert!(irn.signed_qr.unwrap().starts_with("SANDBOX-"));
        assert!(irn.ack_no.unwrap().starts_with("SANDBOX-"));
        assert_eq!(irn.raw["sandbox"], true);

        let evc = Evc { pan: "AAAAA0000A", otp: "123456" };
        let filed = block(p.file_return(&c, "102026", "GSTR1", &inv, &evc)).unwrap();
        assert!(filed.arn.starts_with("SANDBOX"));
        assert!(filed.arn.bytes().all(|b| b.is_ascii_uppercase() || b.is_ascii_digit()));

        let req = EwbRequest { vehicle_no: Some("MH12AB1234"), transporter_id: None, distance_km: 450, irn: None };
        let ewb = block(p.generate_ewb(&c, &inv, &req)).unwrap();
        assert!(ewb.ewb_no.starts_with("SANDBOX-"));
        let days = (ewb.valid_upto.unwrap() - Utc::now()).num_hours();
        assert!((47..=72).contains(&days), "450 km should be valid for 3 days, got {} h", days);

        let s = block(p.verify_otp(&c, "575757")).unwrap();
        assert!(s.token.starts_with("SANDBOX-"));
        assert!(block(p.verify_otp(&c, "12345")).is_err());
        assert!(p.is_sandbox() && p.is_configured());
    }
}
