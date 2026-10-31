use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;

#[allow(dead_code)]
#[derive(Debug)]
pub enum AppError {
    NotFound(String),
    BadRequest(String),
    Unauthorized(String),
    /// Signed in but not allowed (a 401 would send the browser to the login page).
    Forbidden(String),
    Conflict(String),
    /// A switched-off integration: the message is a stable code such as "gsp_not_configured".
    ServiceUnavailable(String),
    Database(String),
    Internal(String),
    /// 503: a switched-off integration.
    Unavailable(String),
    /// 402: the company's plan limit (e.g. "seats") is used up.
    PlanLimit(String),
    /// 409: not enough stock of the named item.
    StockInsufficient(String),
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, error_message) = match self {
            AppError::PlanLimit(limit) => {
                let status = StatusCode::PAYMENT_REQUIRED;
                let body = json!({ "success": false, "error": "plan_limit", "limit": limit, "status": status.as_u16() });
                return (status, Json(body)).into_response();
            }
            AppError::StockInsufficient(item) => {
                let status = StatusCode::CONFLICT;
                let body = json!({ "success": false, "error": "stock_insufficient", "item": item, "status": status.as_u16() });
                return (status, Json(body)).into_response();
            }
            AppError::NotFound(msg) => (StatusCode::NOT_FOUND, msg),
            AppError::BadRequest(msg) => (StatusCode::BAD_REQUEST, msg),
            AppError::Unauthorized(msg) => (StatusCode::UNAUTHORIZED, msg),
            AppError::Forbidden(msg) => (StatusCode::FORBIDDEN, msg),
            AppError::Conflict(msg) => (StatusCode::CONFLICT, msg),
            AppError::ServiceUnavailable(msg) => (StatusCode::SERVICE_UNAVAILABLE, msg),
            AppError::Database(msg) => (StatusCode::BAD_GATEWAY, msg),
            AppError::Internal(msg) => (StatusCode::INTERNAL_SERVER_ERROR, msg),
            AppError::Unavailable(msg) => (StatusCode::SERVICE_UNAVAILABLE, msg),
        };

        let body = Json(json!({
            "success": false,
            "error": error_message,
            "status": status.as_u16(),
        }));

        (status, body).into_response()
    }
}

impl From<reqwest::Error> for AppError {
    fn from(err: reqwest::Error) -> Self {
        AppError::Database(format!("PostgREST HTTP error: {}", err))
    }
}
