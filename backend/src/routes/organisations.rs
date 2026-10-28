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

    let res = state.supabase.rpc("create_organisation", &body, token).await?;

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
    let res = state.supabase.query_table("organisations", &query, token).await?;

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
    let res = state.supabase.query_table("organisations", &query, token).await?;

    Ok(Json(json!({
        "success": true,
        "data": res
    })))
}

#[derive(Debug, Deserialize)]
pub struct UpdateSettingsRequest {
    pub require_journal_approval: Option<bool>,
    pub gstin: Option<String>,
}

/// Company settings an owner/admin may change; RLS (`organisations_update_admins`) enforces who.
async fn update_settings(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(payload): Json<UpdateSettingsRequest>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    let mut body = serde_json::Map::new();
    if let Some(v) = payload.require_journal_approval {
        body.insert("require_journal_approval".into(), json!(v));
    }
    if let Some(g) = payload.gstin {
        let g = g.trim().to_uppercase();
        body.insert("gstin".into(), if g.is_empty() { Value::Null } else { json!(g) });
    }
    if body.is_empty() {
        return Err(AppError::BadRequest("Nothing to update".into()));
    }

    let id_filter = format!("eq.{}", id);
    let res = state
        .supabase
        .update_table("organisations", &[("id", id_filter.as_str())], &Value::Object(body), token)
        .await?;
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
        .supabase
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
        .supabase
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
        .supabase
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
        ("select", "*,profiles:user_id(id,full_name,avatar_url)"),
        ("organisation_id", &org_filter),
        ("order", "created_at.asc"),
    ];

    let res = state
        .supabase
        .query_table("organisation_members", &query, token)
        .await?;

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

    let body = json!({
        "role": payload.role,
        "updated_at": "now()",
    });

    let res = state
        .supabase
        .update_table("organisation_members", &query, &body, token)
        .await?;

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
        .supabase
        .delete_table("organisation_members", &query, token)
        .await?;

    Ok(Json(json!({
        "success": true,
        "data": res
    })))
}

