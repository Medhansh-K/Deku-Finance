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
    /// DEKU_ENV=production refuses the sandbox providers.
    pub deku_env: Option<String>,
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

        Self {
            gsp_provider: opt("GSP_PROVIDER"),
            kyc_provider: opt("KYC_PROVIDER"),
            deku_env: opt("DEKU_ENV"),
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
