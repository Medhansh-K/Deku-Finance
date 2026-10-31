use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use serde_json::{json, Value};
use crate::auth;
use crate::error::AppError;
use crate::routes::AppState;

// shortcut: no email verification and no rate limiting on these endpoints; add an email
// provider for verification and Cloud Armor rate-limit rules in front of /api/v1/auth before launch.
pub fn routes(state: AppState) -> Router {
    Router::new()
        .route("/signup", post(signup))
        .route("/login", post(login))
        .route("/refresh", post(refresh))
        .route("/logout", post(logout))
        .route("/me", get(me))
        .with_state(state)
}

// Fields default to empty so a missing one gets our 400 instead of axum's 422.
#[derive(Deserialize)]
struct SignupRequest {
    #[serde(default)]
    email: String,
    #[serde(default)]
    password: String,
    #[serde(default)]
    full_name: String,
    business_name: Option<String>,
    operating_mode: Option<String>,
    state: Option<String>,
}

#[derive(Deserialize)]
struct LoginRequest {
    #[serde(default)]
    email: String,
    #[serde(default)]
    password: String,
}

#[derive(Deserialize)]
struct RefreshRequest {
    #[serde(default)]
    refresh_token: String,
}

fn invalid_credentials() -> AppError {
    AppError::Unauthorized("invalid_credentials".into())
}

fn invalid_refresh() -> AppError {
    AppError::Unauthorized("invalid_refresh".into())
}

/// The auth_* functions signal domain errors with `raise exception '<code>'`, which PostgREST
/// returns as a 4xx whose body carries the code; `send` maps that to AppError::Database.
fn is_db_error(err: &AppError, code: &str) -> bool {
    matches!(err, AppError::Database(msg) if msg.contains(code))
}

async fn rpc_service(app: &AppState, function: &str, payload: Value) -> Result<Value, AppError> {
    let token = auth::service_token(&app.jwt_secret)?;
    app.db.rpc(function, &payload, Some(&token)).await
}

async fn fetch_user(app: &AppState, user_id: &str) -> Result<Option<Value>, AppError> {
    let rows = rpc_service(app, "auth_user", json!({ "p_id": user_id })).await?;
    Ok(rows.as_array().and_then(|r| r.first()).cloned())
}

/// bcrypt at cost 12 takes ~250 ms of CPU, so keep it off the async workers.
async fn blocking<T: Send + 'static>(f: impl FnOnce() -> T + Send + 'static) -> Result<T, AppError> {
    tokio::task::spawn_blocking(f)
        .await
        .map_err(|e| AppError::Internal(format!("Background task failed: {}", e)))
}

fn user_json(id: &str, email: &str, meta: &Value) -> Value {
    json!({
        "id": id,
        "email": email,
        "full_name": meta.get("full_name").cloned().unwrap_or(Value::Null),
        "is_demo": meta.get("is_demo").and_then(Value::as_bool).unwrap_or(false),
    })
}

fn session_json(access_token: String, refresh_token: String, user: Value) -> Json<Value> {
    Json(json!({
        "access_token": access_token,
        "refresh_token": refresh_token,
        "expires_in": auth::ACCESS_TTL_SECS,
        "user": user,
    }))
}

async fn start_session(app: &AppState, user_id: &str, email: &str, user: Value) -> Result<Json<Value>, AppError> {
    let access_token = auth::access_token(&app.jwt_secret, user_id, email)?;
    let refresh_token = auth::new_refresh_token();
    rpc_service(
        app,
        "auth_store_refresh",
        json!({
            "p_user": user_id,
            "p_token_hash": auth::hash_refresh_token(&refresh_token),
            "p_expires": auth::refresh_expiry(),
        }),
    )
    .await?;
    Ok(session_json(access_token, refresh_token, user))
}

async fn signup(
    State(app): State<AppState>,
    Json(payload): Json<SignupRequest>,
) -> Result<Json<Value>, AppError> {
    let email = auth::normalize_email(&payload.email);
    let full_name = payload.full_name.trim().to_string();
    auth::validate_signup(&email, &payload.password, &full_name)?;

    let password = payload.password;
    let password_hash = blocking(move || auth::hash_password(&password)).await??;

    let meta = json!({
        "full_name": full_name,
        "business_name": payload.business_name,
        "operating_mode": payload.operating_mode,
        "state": payload.state,
    });
    let id = rpc_service(
        &app,
        "auth_register",
        json!({ "p_email": email, "p_password_hash": password_hash, "p_meta": meta }),
    )
    .await
    .map_err(|e| if is_db_error(&e, "email_taken") { AppError::Conflict("email_taken".into()) } else { e })?;
    let id = id
        .as_str()
        .ok_or_else(|| AppError::Internal("auth_register returned no user id".into()))?
        .to_string();

    let user = user_json(&id, &email, &meta);
    start_session(&app, &id, &email, user).await
}

async fn login(
    State(app): State<AppState>,
    Json(payload): Json<LoginRequest>,
) -> Result<Json<Value>, AppError> {
    let email = auth::normalize_email(&payload.email);
    let rows = rpc_service(&app, "auth_credentials", json!({ "p_email": email })).await?;
    let row = rows.as_array().and_then(|r| r.first()).cloned();

    let stored_hash = row
        .as_ref()
        .and_then(|r| r.get("password_hash"))
        .and_then(Value::as_str)
        .map(str::to_string);
    let password = payload.password;
    let valid = blocking(move || auth::verify_password(&password, stored_hash.as_deref())).await?;

    let row = match row {
        Some(row) if valid => row,
        _ => return Err(invalid_credentials()),
    };
    let id = row["id"].as_str().ok_or_else(invalid_credentials)?.to_string();
    let email = row["email"].as_str().unwrap_or(email.as_str()).to_string();
    let user = user_json(&id, &email, &row["meta"]);
    start_session(&app, &id, &email, user).await
}

async fn refresh(
    State(app): State<AppState>,
    Json(payload): Json<RefreshRequest>,
) -> Result<Json<Value>, AppError> {
    if payload.refresh_token.is_empty() {
        return Err(invalid_refresh());
    }
    let new_refresh_token = auth::new_refresh_token();
    let user_id = rpc_service(
        &app,
        "auth_rotate_refresh",
        json!({
            "p_old_hash": auth::hash_refresh_token(&payload.refresh_token),
            "p_new_hash": auth::hash_refresh_token(&new_refresh_token),
            "p_expires": auth::refresh_expiry(),
        }),
    )
    .await
    .map_err(|e| if is_db_error(&e, "invalid_refresh") { invalid_refresh() } else { e })?;
    let user_id = user_id.as_str().ok_or_else(invalid_refresh)?.to_string();

    let row = fetch_user(&app, &user_id).await?.ok_or_else(invalid_refresh)?;
    let email = row["email"].as_str().unwrap_or_default().to_string();
    let access_token = auth::access_token(&app.jwt_secret, &user_id, &email)?;
    Ok(session_json(access_token, new_refresh_token, user_json(&user_id, &email, &row["meta"])))
}

async fn logout(
    State(app): State<AppState>,
    Json(payload): Json<RefreshRequest>,
) -> Result<StatusCode, AppError> {
    if !payload.refresh_token.is_empty() {
        rpc_service(
            &app,
            "auth_revoke_refresh",
            json!({ "p_token_hash": auth::hash_refresh_token(&payload.refresh_token) }),
        )
        .await?;
    }
    Ok(StatusCode::NO_CONTENT)
}

async fn me(State(app): State<AppState>, headers: HeaderMap) -> Result<Json<Value>, AppError> {
    let token = headers
        .get("Authorization")
        .and_then(|h| h.to_str().ok())
        .and_then(|h| h.strip_prefix("Bearer "))
        .ok_or_else(|| AppError::Unauthorized("invalid_token".into()))?;
    let claims = auth::verify_access_token(&app.jwt_secret, token)?;
    let user_id = claims.sub.unwrap_or_default();

    let row = fetch_user(&app, &user_id)
        .await?
        .ok_or_else(|| AppError::Unauthorized("invalid_token".into()))?;
    let email = row["email"].as_str().unwrap_or_default().to_string();
    Ok(Json(json!({ "user": user_json(&user_id, &email, &row["meta"]) })))
}
