use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateInvoiceLineRequest {
    pub line_number: i32,
    pub item_id: Option<String>,
    pub item_name: String,
    pub description: Option<String>,
    pub hsn_sac_code: Option<String>,
    pub unit_code: Option<String>,
    pub quantity: f64,
    pub unit_price: f64,
    pub discount_amount: Option<f64>,
    pub gst_rate: f64,
    pub cgst_rate: Option<f64>,
    pub cgst_amount: Option<f64>,
    pub sgst_rate: Option<f64>,
    pub sgst_amount: Option<f64>,
    pub igst_rate: Option<f64>,
    pub igst_amount: Option<f64>,
    pub cess_rate: Option<f64>,
    pub cess_amount: Option<f64>,
    pub taxable_amount: f64,
    pub total_amount: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateInvoiceRequest {
    pub customer_id: String,
    pub invoice_number: String,
    pub invoice_date: String,
    pub due_date: String,
    pub supply_type: String, // intra_state, inter_state, export, exempt
    pub place_of_supply: String,
    pub sales_channel: Option<String>,
    pub taxable_amount: f64,
    pub round_off: Option<f64>,
    pub total_amount: f64,
    pub lines: Vec<CreateInvoiceLineRequest>,
    pub notes: Option<String>,
    pub terms: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct IssueInvoiceRequest {
    pub create_journal: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CancelInvoiceRequest {
    pub reason: String,
}
