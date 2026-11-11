use axum::{
    extract::{Query, State},
    http::HeaderMap,
    routing::get,
    Json, Router,
};
use serde::Deserialize;
use serde_json::{json, Value};
use crate::error::AppError;
use crate::routes::AppState;

pub fn routes(state: AppState) -> Router {
    Router::new()
        .route("/", get(search_hsn))
        .with_state(state)
}

#[derive(Debug, Deserialize)]
pub struct HsnQuery {
    pub q: Option<String>,
    pub limit: Option<i32>,
}

fn extract_auth_token(headers: &HeaderMap) -> Option<&str> {
    headers
        .get("Authorization")
        .and_then(|h| h.to_str().ok())
        .and_then(|h| h.strip_prefix("Bearer "))
}

async fn search_hsn(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(params): Query<HsnQuery>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    let payload = json!({
        "p_query": params.q.unwrap_or_default(),
        "p_limit": params.limit.unwrap_or(20).clamp(1, 50),
    });
    let res = state.db.rpc("search_hsn", &payload, token).await?;

    // "No match" and "master never imported" need different messages in the UI.
    let has_rows = res.as_array().map_or(false, |rows| !rows.is_empty());
    let loaded = has_rows || {
        let probe = state
            .db
            .query_table("hsn_sac_codes", &[("select", "code"), ("limit", "1")], token)
            .await?;
        probe.as_array().map_or(false, |rows| !rows.is_empty())
    };

    Ok(Json(json!({ "success": true, "data": res, "loaded": loaded })))
}
