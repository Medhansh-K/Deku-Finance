use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateFiscalPeriodRequest {
    pub name: String,
    pub start_date: String,
    pub end_date: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateJournalLineRequest {
    pub line_number: i32,
    pub account_id: String,
    pub party_id: Option<String>,
    pub description: Option<String>,
    pub debit: f64,
    pub credit: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateJournalRequest {
    pub fiscal_period_id: String,
    pub entry_number: String,
    pub entry_date: String,
    pub narration: String,
    pub reference: Option<String>,
    pub lines: Vec<CreateJournalLineRequest>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ReverseJournalRequest {
    pub reversal_date: String,
    pub narration: Option<String>,
}
