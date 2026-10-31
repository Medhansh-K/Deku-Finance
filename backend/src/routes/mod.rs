pub mod auth;
pub mod health;
pub mod organisations;
pub mod parties;
pub mod catalogue;
pub mod accounting;
pub mod invoices;
pub mod audit;
pub mod departments;
pub mod subscriptions;
pub mod documents;
pub mod consultant;
pub mod banking;
pub mod purchases;
pub mod gst;
pub mod hsn;
pub mod notifications;
pub mod notes;
pub mod marketplace;
pub mod payments;
pub mod gsp;
pub mod kyc;
pub mod imports;

use std::sync::Arc;
use axum::Router;
use crate::integrations::{gsp::GspProvider, kyc::KycProvider};
use crate::postgrest::PostgrestClient;

#[derive(Clone)]
pub struct AppState {
    pub db: PostgrestClient,
    pub jwt_secret: String,
    pub cron_secret: Option<String>,
    /// `None` when DATA_ENCRYPTION_KEY is missing or malformed: integrations report "not configured".
    pub cipher: Option<crate::crypto::Cipher>,
    /// `None` unless every RAZORPAY_* setting is present.
    pub razorpay: Option<crate::razorpay::Razorpay>,
    /// `NotConfigured` unless GSP_PROVIDER / KYC_PROVIDER select an adapter (see integrations/).
    pub gsp: Arc<dyn GspProvider>,
    pub kyc: Arc<dyn KycProvider>,
}

pub fn create_router(state: AppState) -> Router {
    Router::new()
        .merge(health::routes(state.clone()))
        .nest("/api/v1", api_routes(state))
}

fn api_routes(state: AppState) -> Router {
    Router::new()
        // The only routes that need no caller token: they issue it.
        .nest("/auth", auth::routes(state.clone()))
        .nest("/organisations", organisations::routes(state.clone()))
        .nest("/organisations/:org_id/parties", parties::routes(state.clone()))
        .nest("/organisations/:org_id/catalogue", catalogue::routes(state.clone()))
        .nest("/organisations/:org_id", accounting::routes(state.clone()))
        .nest("/organisations/:org_id/invoices", invoices::routes(state.clone()))
        .nest("/organisations/:org_id/audit-events", audit::routes(state.clone()))
        .nest(
            "/organisations/:org_id/departments",
            departments::department_routes(state.clone()),
        )
        .nest(
            "/organisations/:org_id/members",
            departments::member_routes(state.clone()),
        )
        .nest(
            "/organisations/:org_id/payroll",
            departments::payroll_routes(state.clone()),
        )
        .nest(
            "/organisations/:org_id/subscription",
            subscriptions::routes(state.clone()),
        )
        .nest("/admin", subscriptions::admin_routes(state.clone()))
        .nest(
            "/organisations/:org_id/documents",
            documents::routes(state.clone()),
        )
        .nest(
            "/organisations/:org_id/consultant",
            consultant::routes(state.clone()),
        )
        .nest(
            "/organisations/:org_id/banking",
            banking::routes(state.clone()),
        )
        .nest(
            "/organisations/:org_id/purchases",
            purchases::routes(state.clone()),
        )
        .nest("/organisations/:org_id/gst", gst::routes(state.clone()))
        .nest("/organisations/:org_id/gsp", gsp::routes(state.clone()))
        .nest("/organisations/:org_id/kyc", kyc::routes(state.clone()))
        .nest("/organisations/:org_id/imports", imports::routes(state.clone()))
        .nest("/hsn", hsn::routes(state.clone()))
        .nest(
            "/organisations/:org_id/notifications",
            notifications::routes(state.clone()),
        )
        // Guarded by X-Deku-Cron-Secret instead of a caller token.
        .nest("/internal/notifications", notifications::internal_routes(state.clone()))
        .nest("/organisations/:org_id/notes", notes::routes(state.clone()))
        .nest(
            "/organisations/:org_id/marketplace",
            marketplace::routes(state.clone()),
        )
        // Full paths: they sit beside the organisation and invoice routes.
        .merge(payments::routes(state.clone()))
}
