use crate::config::Config;
use crate::error::AppError;
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE};
use serde_json::Value;

#[derive(Clone)]
pub struct SupabaseClient {
    client: reqwest::Client,
    base_url: String,
    anon_key: String,
}

impl SupabaseClient {
    pub fn new(config: &Config) -> Self {
        Self {
            client: reqwest::Client::new(),
            base_url: config.supabase_url.trim_end_matches('/').to_string(),
            anon_key: config.supabase_anon_key.clone(),
        }
    }

    fn build_headers(&self, auth_token: Option<&str>) -> Result<HeaderMap, AppError> {
        let mut headers = HeaderMap::new();
        headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
        headers.insert(
            "apikey",
            HeaderValue::from_str(&self.anon_key)
                .map_err(|e| AppError::Internal(e.to_string()))?,
        );

        let token = auth_token.unwrap_or(&self.anon_key);
        let bearer_val = format!("Bearer {}", token);
        headers.insert(
            AUTHORIZATION,
            HeaderValue::from_str(&bearer_val)
                .map_err(|e| AppError::Internal(e.to_string()))?,
        );

        Ok(headers)
    }

    pub async fn rpc(
        &self,
        fn_name: &str,
        payload: &Value,
        auth_token: Option<&str>,
    ) -> Result<Value, AppError> {
        let url = format!("{}/rest/v1/rpc/{}", self.base_url, fn_name);
        let headers = self.build_headers(auth_token)?;

        let resp = self
            .client
            .post(&url)
            .headers(headers)
            .json(payload)
            .send()
            .await?;

        let status = resp.status();
        let body_text = resp.text().await.unwrap_or_default();

        if !status.is_success() {
            return Err(AppError::Database(format!(
                "Supabase RPC '{}' error ({}): {}",
                fn_name, status, body_text
            )));
        }

        if body_text.trim().is_empty() {
            return Ok(Value::Null);
        }

        serde_json::from_str(&body_text)
            .map_err(|e| AppError::Internal(format!("Failed to parse response: {}", e)))
    }

    pub async fn query_table(
        &self,
        table: &str,
        query: &[(&str, &str)],
        auth_token: Option<&str>,
    ) -> Result<Value, AppError> {
        let url = format!("{}/rest/v1/{}", self.base_url, table);
        let headers = self.build_headers(auth_token)?;

        let resp = self
            .client
            .get(&url)
            .headers(headers)
            .query(query)
            .send()
            .await?;

        let status = resp.status();
        let body_text = resp.text().await.unwrap_or_default();

        if !status.is_success() {
            return Err(AppError::Database(format!(
                "Supabase Query '{}' error ({}): {}",
                table, status, body_text
            )));
        }

        serde_json::from_str(&body_text)
            .map_err(|e| AppError::Internal(format!("Failed to parse response: {}", e)))
    }

    pub async fn insert_table(
        &self,
        table: &str,
        payload: &Value,
        auth_token: Option<&str>,
    ) -> Result<Value, AppError> {
        let url = format!("{}/rest/v1/{}", self.base_url, table);
        let mut headers = self.build_headers(auth_token)?;
        headers.insert("Prefer", HeaderValue::from_static("return=representation"));

        let resp = self
            .client
            .post(&url)
            .headers(headers)
            .json(payload)
            .send()
            .await?;

        let status = resp.status();
        let body_text = resp.text().await.unwrap_or_default();

        if !status.is_success() {
            return Err(AppError::Database(format!(
                "Supabase Insert into '{}' error ({}): {}",
                table, status, body_text
            )));
        }

        serde_json::from_str(&body_text)
            .map_err(|e| AppError::Internal(format!("Failed to parse response: {}", e)))
    }
}
