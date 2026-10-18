use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Serialize, Deserialize)]
pub struct CreatePartyRequest {
    pub r#type: String, // customer, vendor, both, other
    pub legal_name: String,
    pub display_name: String,
    pub gstin: Option<String>,
    pub pan: Option<String>,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub billing_address: Option<Value>,
    pub shipping_address: Option<Value>,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PartyResponse {
    pub id: String,
    pub organisation_id: String,
    pub r#type: String,
    pub legal_name: String,
    pub display_name: String,
    pub gstin: Option<String>,
    pub pan: Option<String>,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub is_active: bool,
    pub created_at: String,
}
