use std::env;

#[derive(Clone, Debug)]
pub struct Config {
    pub port: u16,
    pub supabase_url: String,
    pub supabase_anon_key: String,
    pub supabase_service_role_key: Option<String>,
    pub sarvam_api_key: Option<String>,
}

impl Config {
    pub fn from_env() -> Self {
        dotenvy::dotenv().ok();

        let port = env::var("PORT")
            .unwrap_or_else(|_| "8080".to_string())
            .parse::<u16>()
            .expect("PORT must be a valid number");

        let supabase_url = env::var("SUPABASE_URL")
            .expect("SUPABASE_URL environment variable must be set");

        let supabase_anon_key = env::var("SUPABASE_ANON_KEY")
            .expect("SUPABASE_ANON_KEY environment variable must be set");

        let supabase_service_role_key = env::var("SUPABASE_SERVICE_ROLE_KEY")
            .ok()
            .filter(|k| !k.trim().is_empty());

        let sarvam_api_key = env::var("SARVAM_API_KEY")
            .ok()
            .filter(|k| !k.trim().is_empty());

        Self {
            port,
            supabase_url,
            supabase_anon_key,
            supabase_service_role_key,
            sarvam_api_key,
        }
    }
}
