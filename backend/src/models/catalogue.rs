use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateCatalogueItemRequest {
    pub r#type: String, // goods or services
    pub name: String,
    pub description: Option<String>,
    pub sku: Option<String>,
    pub hsn_sac_code: Option<String>,
    pub unit_code: Option<String>,
    pub default_unit_price: f64,
    pub default_gst_rate: f64,
    pub is_taxable: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CatalogueItemResponse {
    pub id: String,
    pub organisation_id: String,
    pub r#type: String,
    pub name: String,
    pub sku: Option<String>,
    pub hsn_sac_code: Option<String>,
    pub unit_code: String,
    pub default_unit_price: f64,
    pub default_gst_rate: f64,
    pub is_taxable: bool,
    pub is_active: bool,
    pub created_at: String,
}
