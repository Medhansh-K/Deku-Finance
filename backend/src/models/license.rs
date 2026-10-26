use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct ActivateLicenseRequest {
    pub license_key: String,
    pub owner_email: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct IssueLicenseRequest {
    pub owner_email: String,
    #[serde(default = "default_license_type")]
    pub license_type: String, // 'temp' or 'plan'
    #[serde(default = "default_plan_tier")]
    pub plan_tier: String,    // 'go' or 'pro'
    pub tenure_days: Option<i32>,
}

fn default_license_type() -> String {
    "temp".to_string()
}

fn default_plan_tier() -> String {
    "go".to_string()
}
