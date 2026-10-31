use crate::config::Config;
use crate::error::AppError;
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE};
use serde_json::Value;
use std::time::Duration;

#[derive(Clone)]
pub struct PostgrestClient {
    client: reqwest::Client,
    base_url: String,
}

impl PostgrestClient {
    pub fn new(config: &Config) -> Self {
        Self {
            client: reqwest::Client::builder()
                .timeout(Duration::from_secs(15))
                .build()
                .expect("Failed to build HTTP client"),
            base_url: config.postgrest_url.trim_end_matches('/').to_string(),
        }
    }

    /// Readiness probe: any non-5xx answer from the PostgREST root means it is up.
    pub async fn is_ready(&self) -> bool {
        let req = self.client.get(format!("{}/", self.base_url)).timeout(Duration::from_secs(3));
        match req.send().await {
            Ok(resp) => !resp.status().is_server_error(),
            Err(_) => false,
        }
    }

    fn build_headers(&self, auth_token: Option<&str>) -> Result<HeaderMap, AppError> {
        let mut headers = HeaderMap::new();
        headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));

        // Row-level security must see the real user, so a request without a login is refused.
        // Never fall back to a service-role token: it bypasses RLS for every tenant.
        let user_token = auth_token
            .filter(|t| !t.trim().is_empty())
            .ok_or_else(|| AppError::Unauthorized("Sign in required".into()))?;

        let bearer_val = format!("Bearer {}", user_token);
        headers.insert(
            AUTHORIZATION,
            HeaderValue::from_str(&bearer_val)
                .map_err(|e| AppError::Internal(e.to_string()))?,
        );

        Ok(headers)
    }

    async fn send(&self, req: reqwest::RequestBuilder, what: String) -> Result<Value, AppError> {
        let resp = req.send().await?;
        let status = resp.status();
        let body_text = resp.text().await.unwrap_or_default();

        if !status.is_success() {
            return Err(map_error(status, &body_text, &what));
        }
        if body_text.trim().is_empty() {
            return Ok(Value::Null);
        }
        serde_json::from_str(&body_text)
            .map_err(|e| AppError::Internal(format!("Failed to parse response: {}", e)))
    }

    fn url(&self, path: &str) -> String {
        format!("{}/{}", self.base_url, path)
    }

    pub async fn rpc(&self, fn_name: &str, payload: &Value, auth_token: Option<&str>) -> Result<Value, AppError> {
        let req = self.client.post(self.url(&format!("rpc/{}", fn_name)))
            .headers(self.build_headers(auth_token)?)
            .json(payload);
        self.send(req, format!("PostgREST RPC '{}'", fn_name)).await
    }

    pub async fn query_table(&self, table: &str, query: &[(&str, &str)], auth_token: Option<&str>) -> Result<Value, AppError> {
        let req = self.client.get(self.url(table))
            .headers(self.build_headers(auth_token)?)
            .query(query);
        self.send(req, format!("PostgREST query '{}'", table)).await
    }

    pub async fn insert_table(&self, table: &str, payload: &Value, auth_token: Option<&str>) -> Result<Value, AppError> {
        let req = self.client.post(self.url(table))
            .headers(self.build_headers(auth_token)?)
            .header("Prefer", "return=representation")
            .json(payload);
        self.send(req, format!("PostgREST insert into '{}'", table)).await
    }

    /// INSERT ... ON CONFLICT (on_conflict) DO UPDATE with the payload's columns.
    pub async fn upsert_table(&self, table: &str, on_conflict: &str, payload: &Value, auth_token: Option<&str>) -> Result<Value, AppError> {
        let req = self.client.post(self.url(table))
            .headers(self.build_headers(auth_token)?)
            .header("Prefer", "resolution=merge-duplicates,return=representation")
            .query(&[("on_conflict", on_conflict)])
            .json(payload);
        self.send(req, format!("PostgREST upsert into '{}'", table)).await
    }

    pub async fn update_table(&self, table: &str, query: &[(&str, &str)], payload: &Value, auth_token: Option<&str>) -> Result<Value, AppError> {
        let req = self.client.patch(self.url(table))
            .headers(self.build_headers(auth_token)?)
            .header("Prefer", "return=representation")
            .query(query)
            .json(payload);
        self.send(req, format!("PostgREST update '{}'", table)).await
    }

    pub async fn delete_table(&self, table: &str, query: &[(&str, &str)], auth_token: Option<&str>) -> Result<Value, AppError> {
        let req = self.client.delete(self.url(table))
            .headers(self.build_headers(auth_token)?)
            .header("Prefer", "return=representation")
            .query(query);
        self.send(req, format!("PostgREST delete from '{}'", table)).await
    }
}

/// Turns the database's stable error codes (`plan_limit:<name>`, `stock_insufficient:<code>`,
/// `Permission denied…`) into statuses the browser can act on instead of a raw 502.
fn map_error(status: reqwest::StatusCode, body: &str, what: &str) -> AppError {
    let message = serde_json::from_str::<serde_json::Value>(body)
        .ok()
        .and_then(|v| v.get("message").and_then(|m| m.as_str()).map(str::to_owned))
        .unwrap_or_default();

    if let Some(limit) = message.strip_prefix("plan_limit:") {
        return AppError::PlanLimit(limit.trim().to_string());
    }
    if let Some(item) = message.strip_prefix("stock_insufficient:") {
        return AppError::StockInsufficient(item.trim().to_string());
    }
    // Migration 016 spells it "Permission Denied", later ones "Permission denied".
    if message.to_ascii_lowercase().starts_with("permission denied") {
        return AppError::Forbidden(message);
    }
    if status == reqwest::StatusCode::UNAUTHORIZED {
        AppError::Unauthorized(format!("{} not permitted: {}", what, body))
    } else if status == reqwest::StatusCode::FORBIDDEN {
        // A 401 would send the browser to the login page; a signed-in user lacking a grant is a 403.
        AppError::Forbidden(format!("{} not permitted: {}", what, body))
    } else {
        AppError::Database(format!("{} error ({}): {}", what, status, body))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::response::IntoResponse;
    use reqwest::StatusCode;

    fn pgrst(message: &str) -> String {
        serde_json::json!({ "code": "P0001", "message": message, "details": null, "hint": null }).to_string()
    }

    #[test]
    fn plan_limit_is_402_with_the_limit_name() {
        let err = map_error(StatusCode::BAD_REQUEST, &pgrst("plan_limit:seats"), "rpc");
        assert!(matches!(&err, AppError::PlanLimit(l) if l == "seats"));
        assert_eq!(err.into_response().status().as_u16(), 402);
        let err = map_error(StatusCode::BAD_REQUEST, &pgrst("plan_limit:max_monthly_invoices"), "rpc");
        assert!(matches!(&err, AppError::PlanLimit(l) if l == "max_monthly_invoices"));
    }

    #[test]
    fn stock_insufficient_is_409_with_the_item() {
        let err = map_error(StatusCode::BAD_REQUEST, &pgrst("stock_insufficient:SKU-01"), "rpc");
        assert!(matches!(&err, AppError::StockInsufficient(i) if i == "SKU-01"));
        assert_eq!(err.into_response().status().as_u16(), 409);
    }

    #[test]
    fn permission_denied_is_403_in_either_spelling() {
        for m in ["Permission denied: only the owner, CFO or admin can run payroll", "Permission Denied: Only Owners"] {
            let err = map_error(StatusCode::BAD_REQUEST, &pgrst(m), "rpc");
            assert!(matches!(&err, AppError::Forbidden(msg) if msg == m));
            assert_eq!(err.into_response().status().as_u16(), 403);
        }
    }

    #[test]
    fn other_errors_keep_their_status_mapping() {
        assert!(matches!(map_error(StatusCode::UNAUTHORIZED, "{}", "q"), AppError::Unauthorized(_)));
        assert!(matches!(map_error(StatusCode::FORBIDDEN, "{}", "q"), AppError::Forbidden(_)));
        assert!(matches!(map_error(StatusCode::BAD_REQUEST, &pgrst("email_taken"), "q"), AppError::Database(m) if m.contains("email_taken")));
        assert!(matches!(map_error(StatusCode::BAD_GATEWAY, "not json", "q"), AppError::Database(_)));
    }
}
