use axum::{extract::State, http::StatusCode, routing::get, Json, Router};
use serde_json::{json, Value};
use crate::routes::AppState;

pub fn routes(state: AppState) -> Router {
    Router::new()
        .route("/health", get(health_check))
        .route("/ready", get(ready_check))
        .with_state(state)
}

async fn health_check() -> Json<Value> {
    Json(json!({
        "status": "healthy",
        "service": "deku-finance-backend",
        "version": "0.1.0",
        "engine": "Axum / Rust"
    }))
}

async fn ready_check(State(state): State<AppState>) -> (StatusCode, Json<Value>) {
    if state.db.is_ready().await {
        (StatusCode::OK, Json(json!({ "status": "ready" })))
    } else {
        (StatusCode::SERVICE_UNAVAILABLE, Json(json!({ "status": "postgrest_unreachable" })))
    }
}
