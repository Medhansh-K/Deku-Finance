pub mod auth;
pub mod health;
pub mod organisations;
pub mod parties;
pub mod catalogue;
pub mod accounting;
pub mod invoices;
pub mod audit;
pub mod departments;
pub mod licenses;
pub mod documents;
pub mod consultant;
pub mod banking;
pub mod purchases;
pub mod gst;
pub mod notes;

use axum::Router;
use crate::postgrest::PostgrestClient;

#[derive(Clone)]
pub struct AppState {
    pub db: PostgrestClient,
    pub jwt_secret: String,
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
            "/organisations/:org_id/license",
            licenses::routes(state.clone()),
        )
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
        .nest("/organisations/:org_id/notes", notes::routes(state.clone()))
}
