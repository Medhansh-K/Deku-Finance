use axum::{
    extract::{Path, State},
    http::HeaderMap,
    routing::{get, patch, post},
    Json, Router,
};
use serde::Deserialize;
use serde_json::{json, Value};
use crate::error::AppError;
use crate::models::organisation::CreateOrgRequest;
use crate::routes::AppState;

#[derive(Debug, Deserialize)]
pub struct InviteMemberRequest {
    pub email: String,
    pub role: Option<String>,
    pub designation: Option<String>,
    pub department_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AcceptInviteRequest {
    pub token: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateMemberRoleRequest {
    pub role: String,
}

pub fn routes(state: AppState) -> Router {
    Router::new()
        .route("/", post(create_organisation).get(list_organisations))
        .route("/invitations/accept", post(accept_invitation))
        .route("/:id", get(get_organisation))
        .route("/:id/settings", patch(update_settings))
        .route(
            "/:id/invitations",
            post(invite_member).get(list_invitations),
        )
        .route("/:id/workbench-members", get(list_members))
        .route(
            "/:id/workbench-members/:member_id",
            patch(update_member_role).delete(remove_member),
        )
        .with_state(state)
}

fn extract_auth_token(headers: &HeaderMap) -> Option<&str> {
    headers
        .get("Authorization")
        .and_then(|h| h.to_str().ok())
        .and_then(|h| h.strip_prefix("Bearer "))
}

async fn create_organisation(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<CreateOrgRequest>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    let body = json!({
        "p_name": payload.name,
        "p_slug": payload.slug,
        "p_currency": payload.currency.unwrap_or_else(|| "INR".to_string()),
        "p_timezone": payload.timezone.unwrap_or_else(|| "Asia/Kolkata".to_string()),
        "p_gstin": payload.gstin,
        "p_pan": payload.pan,
        "p_fy_start_month": payload.financial_year_start_month.unwrap_or(4),
    });

    let res = state.db.rpc("create_organisation", &body, token).await?;

    Ok(Json(json!({
        "success": true,
        "organisation_id": res
    })))
}

async fn list_organisations(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    let query = [("select", "*"), ("order", "created_at.desc")];
    let res = state.db.query_table("organisations", &query, token).await?;

    Ok(Json(json!({
        "success": true,
        "data": res
    })))
}

async fn get_organisation(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    let id_filter = format!("eq.{}", id);
    let query = [("select", "*"), ("id", &id_filter)];
    let res = state.db.query_table("organisations", &query, token).await?;

    Ok(Json(json!({
        "success": true,
        "data": res
    })))
}

#[derive(Debug, Deserialize)]
pub struct UpdateSettingsRequest {
    pub require_journal_approval: Option<bool>,
    pub allow_negative_stock: Option<bool>,
    pub gstin: Option<String>,
    pub operating_mode: Option<String>,
    pub state_code: Option<String>,
    pub registered_address: Option<Value>,
    pub upi_vpa: Option<String>,
    pub bank_account_number: Option<String>,
    pub bank_ifsc: Option<String>,
    pub bank_beneficiary: Option<String>,
    pub bank_name: Option<String>,
    pub udyam_number: Option<String>,
    pub composition_scheme: Option<bool>,
    /// `true` stamps `onboarded_at` with the server clock; the client never sends a timestamp.
    pub onboarded: Option<bool>,
}

fn all_bytes(s: &str, f: impl Fn(u8) -> bool) -> bool {
    s.bytes().all(f)
}

fn is_gstin(s: &str) -> bool {
    let b = s.as_bytes();
    b.len() == 15
        && b[0..2].iter().all(u8::is_ascii_digit)
        && b[2..7].iter().all(u8::is_ascii_uppercase)
        && b[7..11].iter().all(u8::is_ascii_digit)
        && b[11].is_ascii_uppercase()
        && (b[12].is_ascii_uppercase() || (b'1'..=b'9').contains(&b[12]))
        && b[13] == b'Z'
        && (b[14].is_ascii_uppercase() || b[14].is_ascii_digit())
}

fn is_state_code(s: &str) -> bool {
    s.len() == 2 && all_bytes(s, |c| c.is_ascii_digit())
}

/// Mirrors `chk_organisations_upi_vpa`: `name@handle`.
fn is_upi_vpa(s: &str) -> bool {
    let Some((name, handle)) = s.split_once('@') else { return false };
    (2..=255).contains(&name.len())
        && all_bytes(name, |c| c.is_ascii_alphanumeric() || b"._-".contains(&c))
        && (2..=64).contains(&handle.len())
        && handle.as_bytes()[0].is_ascii_alphabetic()
        && all_bytes(handle, |c| c.is_ascii_alphanumeric() || b".-".contains(&c))
}

fn is_account_number(s: &str) -> bool {
    (9..=18).contains(&s.len()) && all_bytes(s, |c| c.is_ascii_digit())
}

fn is_ifsc(s: &str) -> bool {
    let b = s.as_bytes();
    b.len() == 11
        && b[0..4].iter().all(u8::is_ascii_uppercase)
        && b[4] == b'0'
        && b[5..].iter().all(|c| c.is_ascii_uppercase() || c.is_ascii_digit())
}

/// Mirrors `chk_organisations_udyam_number`: `UDYAM-XX-00-0000000`.
fn is_udyam(s: &str) -> bool {
    let b = s.as_bytes();
    b.len() == 19
        && s.starts_with("UDYAM-")
        && b[6..8].iter().all(u8::is_ascii_uppercase)
        && b[8] == b'-'
        && b[9..11].iter().all(u8::is_ascii_digit)
        && b[11] == b'-'
        && b[12..].iter().all(u8::is_ascii_digit)
}

/// Builds the PATCH body, or lists every invalid field. Blank text clears the column.
fn settings_body(p: UpdateSettingsRequest, now: &str) -> Result<serde_json::Map<String, Value>, Vec<&'static str>> {
    let mut body = serde_json::Map::new();
    let mut bad: Vec<&'static str> = Vec::new();

    let mut text = |field: &'static str, v: Option<String>, upper: bool, ok: fn(&str) -> bool| {
        if let Some(v) = v {
            let v = if upper { v.trim().to_uppercase() } else { v.trim().to_string() };
            if v.is_empty() {
                body.insert(field.into(), Value::Null);
            } else if ok(&v) {
                body.insert(field.into(), json!(v));
            } else {
                bad.push(field);
            }
        }
    };
    text("gstin", p.gstin, true, is_gstin);
    text("state_code", p.state_code, false, is_state_code);
    text("upi_vpa", p.upi_vpa, false, is_upi_vpa);
    text("bank_account_number", p.bank_account_number.map(|v| v.replace(' ', "")), false, is_account_number);
    text("bank_ifsc", p.bank_ifsc, true, is_ifsc);
    text("bank_beneficiary", p.bank_beneficiary, false, |v| v.len() <= 200);
    text("bank_name", p.bank_name, false, |v| v.len() <= 200);
    text("udyam_number", p.udyam_number, true, is_udyam);

    if let Some(m) = p.operating_mode {
        match m.trim() {
            "gst" | "pure" => {
                body.insert("operating_mode".into(), json!(m.trim()));
            }
            _ => bad.push("operating_mode"),
        }
    }
    if let Some(a) = p.registered_address {
        if a.is_object() {
            body.insert("registered_address".into(), a);
        } else {
            bad.push("registered_address");
        }
    }
    if let Some(v) = p.composition_scheme {
        if v && body.get("operating_mode") == Some(&json!("pure")) {
            bad.push("composition_scheme");
        } else {
            body.insert("composition_scheme".into(), json!(v));
        }
    }
    if let Some(v) = p.require_journal_approval {
        body.insert("require_journal_approval".into(), json!(v));
    }
    if let Some(v) = p.allow_negative_stock {
        body.insert("allow_negative_stock".into(), json!(v));
    }
    if p.onboarded == Some(true) {
        body.insert("onboarded_at".into(), json!(now));
    }

    if bad.is_empty() { Ok(body) } else { Err(bad) }
}

/// Company settings an owner/admin may change; RLS (`organisations_update_admins`) enforces who.
async fn update_settings(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(payload): Json<UpdateSettingsRequest>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    let body = settings_body(payload, &chrono::Utc::now().to_rfc3339())
        .map_err(|bad| AppError::BadRequest(format!("Invalid fields: {}", bad.join(", "))))?;
    if body.is_empty() {
        return Err(AppError::BadRequest("Nothing to update".into()));
    }

    let id_filter = format!("eq.{}", id);
    let res = state
        .db
        .update_table("organisations", &[("id", id_filter.as_str())], &Value::Object(body), token)
        .await
        .map_err(|e| match e {
            // Cross-field rules checked against the stored row (state vs GSTIN, composition vs mode).
            AppError::Database(m) if m.contains("23514") => {
                let rule = m.split("chk_organisations_").nth(1).and_then(|r| r.split('"').next()).unwrap_or("check");
                AppError::BadRequest(format!("Invalid fields: {}", rule))
            }
            other => other,
        })?;
    // RLS silently matches zero rows for someone who may not edit this company.
    if res.as_array().map_or(true, |rows| rows.is_empty()) {
        return Err(AppError::Unauthorized("Only an owner or admin can change company settings".into()));
    }

    Ok(Json(json!({ "success": true, "data": res })))
}

async fn invite_member(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(org_id): Path<String>,
    Json(payload): Json<InviteMemberRequest>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);

    let body = json!({
        "p_org_id": org_id,
        "p_email": payload.email,
        "p_role": payload.role.unwrap_or_else(|| "viewer".to_string()),
        "p_designation": payload.designation.unwrap_or_else(|| "Team Member".to_string()),
        "p_department_id": payload.department_id,
    });

    let res = state
        .db
        .rpc("invite_user_to_organisation", &body, token)
        .await?;

    Ok(Json(json!({
        "success": true,
        "data": res
    })))
}

async fn accept_invitation(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<AcceptInviteRequest>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);

    let body = json!({
        "p_token": payload.token,
    });

    let res = state
        .db
        .rpc("accept_organisation_invitation", &body, token)
        .await?;

    Ok(Json(json!({
        "success": true,
        "data": res
    })))
}

async fn list_invitations(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(org_id): Path<String>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    let org_filter = format!("eq.{}", org_id);
    let query = [
        ("select", "*"),
        ("organisation_id", &org_filter),
        ("order", "created_at.desc"),
    ];

    let res = state
        .db
        .query_table("organisation_invitations", &query, token)
        .await?;

    Ok(Json(json!({
        "success": true,
        "data": res
    })))
}

async fn list_members(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(org_id): Path<String>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    let org_filter = format!("eq.{}", org_id);
    let query = [
        ("select", "*"),
        ("organisation_id", &org_filter),
        ("order", "created_at.asc"),
    ];

    let mut res = state
        .db
        .query_table("organisation_members", &query, token)
        .await?;

    // organisation_members.user_id references auth.users, not profiles, so PostgREST cannot
    // embed profiles; fetch them separately (RLS lets peers read each other's profile).
    let ids: Vec<&str> = res
        .as_array()
        .map(|rows| rows.iter().filter_map(|r| r["user_id"].as_str()).collect())
        .unwrap_or_default();
    if !ids.is_empty() {
        let id_filter = format!("in.({})", ids.join(","));
        let profiles = state
            .db
            .query_table("profiles", &[("select", "id,email,full_name,avatar_url"), ("id", id_filter.as_str())], token)
            .await?;
        let profiles = profiles.as_array().cloned().unwrap_or_default();
        if let Some(rows) = res.as_array_mut() {
            for row in rows {
                let profile = profiles.iter().find(|p| p["id"] == row["user_id"]).cloned().unwrap_or(Value::Null);
                row["profiles"] = profile;
            }
        }
    }

    Ok(Json(json!({
        "success": true,
        "data": res
    })))
}

async fn update_member_role(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((org_id, member_id)): Path<(String, String)>,
    Json(payload): Json<UpdateMemberRoleRequest>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    let org_filter = format!("eq.{}", org_id);
    let id_filter = format!("eq.{}", member_id);
    let query = [
        ("organisation_id", org_filter.as_str()),
        ("id", id_filter.as_str()),
    ];

    // updated_at is set by trg_org_members_updated_at; the text "now()" is not a timestamp.
    let body = json!({ "role": payload.role });

    let res = state
        .db
        .update_table("organisation_members", &query, &body, token)
        .await?;
    // RLS silently matches zero rows for someone who may not change roles.
    if res.as_array().map_or(true, |rows| rows.is_empty()) {
        return Err(AppError::Forbidden("Only an owner or admin can change roles".into()));
    }

    Ok(Json(json!({
        "success": true,
        "data": res
    })))
}

async fn remove_member(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((org_id, member_id)): Path<(String, String)>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    let org_filter = format!("eq.{}", org_id);
    let id_filter = format!("eq.{}", member_id);
    let query = [
        ("organisation_id", org_filter.as_str()),
        ("id", id_filter.as_str()),
    ];

    let res = state
        .db
        .delete_table("organisation_members", &query, token)
        .await?;
    if res.as_array().map_or(true, |rows| rows.is_empty()) {
        return Err(AppError::Forbidden("Only an owner or admin can remove members".into()));
    }

    Ok(Json(json!({
        "success": true,
        "data": res
    })))
}


#[cfg(test)]
mod tests {
    use super::*;

    fn req(v: Value) -> UpdateSettingsRequest {
        serde_json::from_value(v).unwrap()
    }

    #[test]
    fn valid_profile_is_normalised() {
        let body = settings_body(
            req(json!({
                "gstin": " 27aabcd1234f1z6 ", "state_code": "27", "upi_vpa": "shop.name@okhdfc",
                "bank_account_number": "5020 0012 345678", "bank_ifsc": "hdfc0001234",
                "udyam_number": "udyam-mh-01-0001234", "operating_mode": "gst", "composition_scheme": true,
                "registered_address": {"city": "Pune"}, "onboarded": true
            })),
            "2026-10-31T00:00:00Z",
        )
        .unwrap();
        assert_eq!(body["gstin"], "27AABCD1234F1Z6");
        assert_eq!(body["bank_ifsc"], "HDFC0001234");
        assert_eq!(body["bank_account_number"], "50200012345678");
        assert_eq!(body["udyam_number"], "UDYAM-MH-01-0001234");
        assert_eq!(body["onboarded_at"], "2026-10-31T00:00:00Z");
    }

    #[test]
    fn blank_text_clears_the_column() {
        let body = settings_body(req(json!({ "upi_vpa": "  ", "gstin": "" })), "t").unwrap();
        assert_eq!(body["upi_vpa"], Value::Null);
        assert_eq!(body["gstin"], Value::Null);
    }

    #[test]
    fn every_bad_field_is_named() {
        let bad = settings_body(
            req(json!({
                "bank_ifsc": "HDFC1001234", "upi_vpa": "no-at-sign", "udyam_number": "UDYAM-MH-1-0001234",
                "state_code": "7", "operating_mode": "other", "bank_account_number": "12AB",
                "registered_address": "text"
            })),
            "t",
        )
        .unwrap_err();
        for f in ["bank_ifsc", "upi_vpa", "udyam_number", "state_code", "operating_mode", "bank_account_number", "registered_address"] {
            assert!(bad.contains(&f), "{f} not reported");
        }
    }

    #[test]
    fn composition_needs_gst_mode() {
        let bad = settings_body(req(json!({ "operating_mode": "pure", "composition_scheme": true })), "t").unwrap_err();
        assert_eq!(bad, vec!["composition_scheme"]);
    }

    #[test]
    fn upi_handle_must_start_with_a_letter() {
        assert!(is_upi_vpa("name@okaxis"));
        assert!(!is_upi_vpa("name@1bank"));
        assert!(!is_upi_vpa("a@bank"));
    }
}
