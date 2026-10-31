use std::env;

#[derive(Clone, Debug)]
pub struct Config {
    pub port: u16,
    pub postgrest_url: String,
    pub jwt_secret: String,
    pub cors_allowed_origins: Vec<String>,
    /// Shared secret for the scheduler's internal endpoints; unset disables them.
    pub cron_secret: Option<String>,
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

        Self {
            port,
            postgrest_url,
            jwt_secret,
            cors_allowed_origins,
            cron_secret,
        }
    }
}
