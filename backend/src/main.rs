mod config;
mod error;
mod models;
mod routes;
mod supabase;

use config::Config;
use routes::{create_router, AppState};
use std::net::SocketAddr;
use supabase::SupabaseClient;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() {
    // 1. Initialize logging
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "deku_backend=debug,tower_http=debug,axum::rejection=trace".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    // 2. Load Configuration
    let config = Config::from_env();
    tracing::info!("Initializing Deku Finance Rust/Axum Backend...");
    tracing::info!("Target Supabase URL: {}", config.supabase_url);

    // 3. Initialize Clients and Shared State
    let supabase_client = SupabaseClient::new(&config);
    let state = AppState {
        supabase: supabase_client,
        config: config.clone(),
    };

    // 4. Configure CORS
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    // 5. Build Router
    let app = create_router(state)
        .layer(TraceLayer::new_for_http())
        .layer(cors);

    // 6. Start TCP Listener
    let addr = SocketAddr::from(([0, 0, 0, 0], config.port));
    tracing::info!("Deku Finance Backend listening on http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .unwrap_or_else(|e| panic!("Failed to bind to {}: {}", addr, e));

    axum::serve(listener, app)
        .await
        .expect("Server failed to run");
}
