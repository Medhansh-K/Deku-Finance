mod auth;
mod config;
mod crypto;
mod error;
mod gst;
mod models;
mod postgrest;
mod routes;

use axum::http::HeaderValue;
use config::Config;
use postgrest::PostgrestClient;
use routes::{create_router, AppState};
use std::net::SocketAddr;
use tower_http::cors::{AllowOrigin, Any, CorsLayer};
use tower_http::limit::RequestBodyLimitLayer;
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
    tracing::info!("PostgREST URL: {}", config.postgrest_url);

    // 3. Initialize Clients and Shared State
    let state = AppState {
        db: PostgrestClient::new(&config),
        jwt_secret: config.jwt_secret.clone(),
        cron_secret: config.cron_secret.clone(),
        cipher: config.data_encryption_key.as_deref().and_then(crypto::Cipher::from_base64),
    };
    if config.data_encryption_key.is_some() && state.cipher.is_none() {
        panic!("DATA_ENCRYPTION_KEY must be base64 of exactly 32 bytes");
    }

    // 4. Configure CORS: only explicitly configured origins (none by default)
    let origins: Vec<HeaderValue> = config
        .cors_allowed_origins
        .iter()
        .map(|o| o.parse().unwrap_or_else(|_| panic!("Invalid CORS origin: {}", o)))
        .collect();
    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::list(origins))
        .allow_methods(Any)
        .allow_headers(Any);

    // 5. Build Router
    let app = create_router(state)
        .layer(RequestBodyLimitLayer::new(2 * 1024 * 1024))
        .layer(TraceLayer::new_for_http())
        .layer(cors);

    // 6. Start TCP Listener
    let addr = SocketAddr::from(([0, 0, 0, 0], config.port));
    tracing::info!("Deku Finance Backend listening on http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .unwrap_or_else(|e| panic!("Failed to bind to {}: {}", addr, e));

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await
        .expect("Server failed to run");
}

/// Cloud Run sends SIGTERM before stopping an instance; finish in-flight requests first.
async fn shutdown_signal() {
    let ctrl_c = async {
        tokio::signal::ctrl_c().await.expect("Failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("Failed to install SIGTERM handler")
            .recv()
            .await;
    };
    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }
    tracing::info!("Shutdown signal received, draining connections");
}
