use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateOrgRequest {
    pub name: String,
    pub slug: String,
    pub currency: Option<String>,
    pub timezone: Option<String>,
    pub gstin: Option<String>,
    pub pan: Option<String>,
    pub financial_year_start_month: Option<i16>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OrganisationResponse {
    pub id: String,
    pub name: String,
    pub slug: String,
    pub currency: String,
    pub timezone: String,
    pub gstin: Option<String>,
    pub pan: Option<String>,
    pub financial_year_start_month: i16,
    pub created_at: String,
}
