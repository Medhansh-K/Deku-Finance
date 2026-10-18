pub mod health;
pub mod organisations;
pub mod parties;
pub mod catalogue;
pub mod accounting;
pub mod invoices;
pub mod audit;

use axum::Router;
use crate::supabase::SupabaseClient;

#[derive(Clone)]
pub struct AppState {
    pub supabase: SupabaseClient,
}

pub fn create_router(state: AppState) -> Router {
    Router::new()
        .merge(health::routes())
        .nest("/api/v1", api_routes(state))
}

fn api_routes(state: AppState) -> Router {
    Router::new()
        .nest("/organisations", organisations::routes(state.clone()))
        .nest("/organisations/:org_id/parties", parties::routes(state.clone()))
        .nest("/organisations/:org_id/catalogue", catalogue::routes(state.clone()))
        .nest("/organisations/:org_id", accounting::routes(state.clone()))
        .nest("/organisations/:org_id/invoices", invoices::routes(state.clone()))
        .nest("/organisations/:org_id/audit-events", audit::routes(state.clone()))
}
