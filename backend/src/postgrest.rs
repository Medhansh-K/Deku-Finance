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

        if status == reqwest::StatusCode::UNAUTHORIZED || status == reqwest::StatusCode::FORBIDDEN {
            return Err(AppError::Unauthorized(format!("{} not permitted: {}", what, body_text)));
        }
        if !status.is_success() {
            return Err(AppError::Database(format!("{} error ({}): {}", what, status, body_text)));
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
