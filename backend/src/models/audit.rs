use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateActivityLogRequest {
    pub category: String,
    pub action: String,
    pub description: String,
    pub entity_type: Option<String>,
    pub entity_id: Option<String>,
    pub actor_name: Option<String>,
    pub actor_role: Option<String>,
    pub status: Option<String>,
    pub metadata: Option<Value>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ActivityLogItem {
    pub id: String,
    pub organisation_id: String,
    pub actor_name: String,
    pub actor_role: String,
    pub category: String,
    pub action: String,
    pub description: String,
    pub entity_type: String,
    pub entity_id: String,
    pub status: String,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
    pub metadata: Option<Value>,
    pub hash: Option<String>,
    pub created_at: String,
}
