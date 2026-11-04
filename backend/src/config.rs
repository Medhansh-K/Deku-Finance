use std::env;

#[derive(Clone, Debug)]
pub struct Config {
    pub port: u16,
    pub postgrest_url: String,
    pub jwt_secret: String,
    pub cors_allowed_origins: Vec<String>,
    /// Shared secret for the scheduler's internal endpoints; unset disables them.
    pub cron_secret: Option<String>,
    /// Base64 32-byte key for third-party credentials; unset keeps integrations switched off.
    pub data_encryption_key: Option<String>,
    /// Razorpay partner app; payments stay switched off unless all four are set.
    pub razorpay_client_id: Option<String>,
    pub razorpay_client_secret: Option<String>,
    pub razorpay_redirect_uri: Option<String>,
    pub razorpay_webhook_secret: Option<String>,
    /// GSP_PROVIDER / KYC_PROVIDER; unset keeps that integration switched off.
    pub gsp_provider: Option<String>,
    pub kyc_provider: Option<String>,
    /// DEKU_ENV=production refuses the sandbox providers and the dev-only secrets.
    pub deku_env: Option<String>,
    /// The only address that may become the first administrator; required in production.
    pub admin_email: Option<String>,
}

impl Config {
    pub fn from_env() -> Self {
        dotenvy::dotenv().ok();

        let port = env::var("PORT")
            .unwrap_or_else(|_| "8080".to_string())
            .parse::<u16>()
            .expect("PORT must be a valid number");

        let postgrest_url = env::var("POSTGREST_URL")
            .expect("POSTGREST_URL environment variable must be set");

        let jwt_secret = env::var("JWT_SECRET")
            .expect("JWT_SECRET environment variable must be set");
        if jwt_secret.len() < 32 {
            panic!("JWT_SECRET must be at least 32 bytes");
        }

        // Empty by default: the frontend calls the backend server-side, so browsers never need CORS.
        let cors_allowed_origins = env::var("CORS_ALLOWED_ORIGINS")
            .unwrap_or_default()
            .split(',')
            .map(str::trim)
            .filter(|o| !o.is_empty())
            .map(String::from)
            .collect();

        let cron_secret = env::var("CRON_SECRET").ok().filter(|s| !s.trim().is_empty());

        let data_encryption_key = env::var("DATA_ENCRYPTION_KEY").ok().filter(|s| !s.trim().is_empty());

        let optional = |name: &str| env::var(name).ok().map(|s| s.trim().to_string()).filter(|s| !s.is_empty());
        let opt = |k: &str| env::var(k).ok().filter(|s| !s.trim().is_empty());

        let deku_env = opt("DEKU_ENV");
        if deku_env.as_deref() == Some("production") {
            for (name, value) in [
                ("JWT_SECRET", Some(&jwt_secret)),
                ("CRON_SECRET", cron_secret.as_ref()),
                ("DATA_ENCRYPTION_KEY", data_encryption_key.as_ref()),
            ] {
                if value.is_some_and(|v| is_dev_secret(v)) {
                    panic!("{} still has its dev-only value; refusing to start in production", name);
                }
            }
        }

        Self {
            gsp_provider: opt("GSP_PROVIDER"),
            kyc_provider: opt("KYC_PROVIDER"),
            deku_env,
            admin_email: opt("DEKU_ADMIN_EMAIL"),
            port,
            postgrest_url,
            jwt_secret,
            cors_allowed_origins,
            cron_secret,
            data_encryption_key,
            razorpay_client_id: optional("RAZORPAY_CLIENT_ID"),
            razorpay_client_secret: optional("RAZORPAY_CLIENT_SECRET"),
            razorpay_redirect_uri: optional("RAZORPAY_REDIRECT_URI"),
            razorpay_webhook_secret: optional("RAZORPAY_WEBHOOK_SECRET"),
        }
    }
}

/// The values in docker-compose.yml and .env.example; the key is base64 of a dev-only string.
fn is_dev_secret(value: &str) -> bool {
    value.contains("dev-only") || value == "ZGV2LW9ubHktZGF0YS1lbmNyeXB0aW9uLWtleS0zMmI="
}

#[cfg(test)]
mod tests {
    use super::is_dev_secret;

    #[test]
    fn recognises_dev_secrets_only() {
        assert!(is_dev_secret("dev-only-jwt-secret-change-me-0123456789abcdef"));
        assert!(is_dev_secret("ZGV2LW9ubHktZGF0YS1lbmNyeXB0aW9uLWtleS0zMmI="));
        assert!(!is_dev_secret("a-real-randomly-generated-secret-value-0123"));
    }
}
