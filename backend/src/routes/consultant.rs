use axum::{
    extract::{Path, State},
    http::HeaderMap,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use crate::error::AppError;
use crate::routes::AppState;

pub fn routes(state: AppState) -> Router {
    Router::new()
        .route("/chat", post(chat_with_consultant))
        .route("/context", get(get_consultant_context))
        .with_state(state)
}

fn extract_auth_token(headers: &HeaderMap) -> Option<&str> {
    headers
        .get("Authorization")
        .and_then(|h| h.to_str().ok())
        .and_then(|h| h.strip_prefix("Bearer "))
}

#[derive(Debug, Deserialize)]
pub struct ConsultantChatRequest {
    pub message: String,
}

#[derive(Debug, Serialize)]
pub struct ConsultantChatResponse {
    pub success: bool,
    pub response: String,
    pub model_used: String,
    pub context_snapshot: Value,
    pub suggested_followups: Vec<String>,
}

/// Fetches the live financial grounding context for an organisation
async fn fetch_grounded_org_context(
    state: &AppState,
    org_id: &str,
    token: Option<&str>,
) -> Value {
    let payload = json!({ "p_org_id": org_id });

    // 1. Fetch Org Summary
    let org_filter = format!("eq.{}", org_id);
    let org_query = [
        ("select", "id,name,slug,currency,gstin,pan"),
        ("id", &org_filter),
        ("limit", "1"),
    ];
    let org_meta = state
        .db
        .query_table("organisations", &org_query, token)
        .await
        .ok()
        .and_then(|v| v.as_array().and_then(|arr| arr.first().cloned()))
        .unwrap_or_else(|| json!({ "name": "Company", "currency": "INR" }));

    // 2. Fetch FP&A Metrics
    let fpa_metrics = state
        .db
        .rpc("get_fpa_corporate_metrics", &payload, token)
        .await
        .unwrap_or_else(|_| json!({}));

    // 3. Fetch Cash Flow Statement
    let cash_flow = state
        .db
        .rpc("get_cash_flow_statement", &payload, token)
        .await
        .unwrap_or_else(|_| json!({}));

    // 4. Fetch AR/AP Aging Analysis
    let aging = state
        .db
        .rpc("get_ar_ap_aging_analysis", &payload, token)
        .await
        .unwrap_or_else(|_| json!({}));

    // 5. Fetch Departmental Budget Variance
    let budget_variance = state
        .db
        .rpc("get_departmental_budget_variance", &payload, token)
        .await
        .unwrap_or_else(|_| json!({}));

    // 6. Fetch Recent 5 Posted Vouchers
    let voucher_query = [
        ("select", "id,entry_number,entry_date,reference,narration,total_debit"),
        ("organisation_id", &org_filter),
        ("status", "eq.posted"),
        ("order", "entry_date.desc"),
        ("limit", "5"),
    ];
    let recent_vouchers = state
        .db
        .query_table("journal_entries", &voucher_query, token)
        .await
        .unwrap_or_else(|_| json!([]));

    json!({
        "organisation": org_meta,
        "fpa_metrics": fpa_metrics,
        "cash_flow": cash_flow,
        "ar_ap_aging": aging,
        "budget_variance": budget_variance,
        "recent_vouchers": recent_vouchers
    })
}

/// GET /api/v1/organisations/:org_id/consultant/context
/// Returns live grounding snapshot
async fn get_consultant_context(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(org_id): Path<String>,
) -> Result<Json<Value>, AppError> {
    let token = extract_auth_token(&headers);
    let context = fetch_grounded_org_context(&state, &org_id, token).await;

    Ok(Json(json!({
        "success": true,
        "context": context
    })))
}

/// POST /api/v1/organisations/:org_id/consultant/chat
/// Answers from the organisation's own ledger figures. Runs entirely on this server:
/// no financial data is sent to any third-party AI service.
async fn chat_with_consultant(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(org_id): Path<String>,
    Json(payload): Json<ConsultantChatRequest>,
) -> Result<Json<ConsultantChatResponse>, AppError> {
    let token = extract_auth_token(&headers);
    let context = fetch_grounded_org_context(&state, &org_id, token).await;
    let org_name = context["organisation"]["name"].as_str().unwrap_or("your organisation");
    let ai_response = answer_from_ledger(&payload.message, &context, org_name);
    let model_name = "Deku Ledger Analyst (on-premise)".to_string();

    let event_body = json!({
        "organisation_id": org_id,
        "event_type": "consultant_chat",
        "description": format!("Deku Consultant consultation: {}", payload.message.chars().take(60).collect::<String>()),
        "payload": {
            "query": payload.message,
            "response": ai_response.chars().take(200).collect::<String>(),
            "model": model_name
        }
    });
    let _ = state.db.insert_table("agent_events", &event_body, token).await;

    let followups = vec![
        "What is our cash runway?".to_string(),
        "Show receivables ageing and DSO.".to_string(),
        "How are departments tracking against budget?".to_string(),
        "Summarise profitability and liquidity.".to_string(),
    ];

    Ok(Json(ConsultantChatResponse {
        success: true,
        response: ai_response,
        model_used: model_name,
        context_snapshot: context,
        suggested_followups: followups,
    }))
}

/// A figure from the ledger, or "–" when the ledger did not return it. Never substitutes a number.
fn inr(v: &Value) -> String {
    v.as_f64().map(|n| format!("₹{:.2}", n)).unwrap_or_else(|| "–".into())
}

fn num(v: &Value, unit: &str) -> String {
    v.as_f64().map(|n| format!("{:.1}{}", n, unit)).unwrap_or_else(|| "–".into())
}

/// Deterministic answer built only from figures in `context`.
fn answer_from_ledger(query: &str, context: &Value, org_name: &str) -> String {
    let q = query.to_lowercase();
    let fpa = &context["fpa_metrics"];
    let cash = &context["cash_flow"];
    let aging = &context["ar_ap_aging"];
    let budget = &context["budget_variance"];
    let note = "\n\n_Figures come straight from your posted ledger. \"–\" means the ledger has no data for it yet._";

    if ["runway", "burn", "cash", "treasury"].iter().any(|k| q.contains(k)) {
        let t = &fpa["treasury_and_runway"];
        let status = match t["cash_runway_months"].as_f64() {
            Some(m) if m < 3.0 => "Critical: under 3 months",
            Some(m) if m < 6.0 => "Watch: under 6 months",
            Some(_) => "Adequate",
            None => "–",
        };
        format!(
            "### Treasury & cash runway: {org_name}\n\n\
            | PARTICULARS | AMOUNT |\n| :--- | :--- |\n\
            | Cash & bank reserves | {} |\n| Estimated monthly burn | {} |\n| Cash runway | {} |\n\
            | Net cash from operations | {} |\n| Closing cash (cash-flow statement) | {} |\n\n**Status:** {status}{note}",
            inr(&t["cash_and_bank_reserves"]),
            inr(&t["estimated_monthly_burn"]),
            num(&t["cash_runway_months"], " months"),
            inr(&cash["operating_activities"]["net_cash_from_operating_activities"]),
            inr(&cash["closing_cash_equivalents"]),
        )
    } else if ["debtor", "dso", "receivable", "owe", "overdue", "creditor", "payable", "dpo"]
        .iter()
        .any(|k| q.contains(k))
    {
        let row = |label: &str, side: &Value, total_key: &str, days_key: &str| {
            let b = &side["buckets"];
            format!(
                "| {label} | {} | {} | {} | {} | {} | {} |\n",
                inr(&side[total_key]),
                inr(&b["current_0_30_days"]),
                inr(&b["aging_31_60_days"]),
                inr(&b["aging_61_90_days"]),
                inr(&b["over_90_days_overdue"]),
                num(&side[days_key], " days"),
            )
        };
        format!(
            "### Receivables & payables ageing: {org_name}\n\n\
            | PARTICULARS | TOTAL | 0-30 DAYS | 31-60 DAYS | 61-90 DAYS | 90+ DAYS | DSO / DPO |\n\
            | :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n{}{}\n\
            **Working-capital gap:** {}{note}",
            row("Receivables", &aging["accounts_receivable"], "total_receivable", "dso_days"),
            row("Payables", &aging["accounts_payable"], "total_payable", "dpo_days"),
            inr(&aging["working_capital_gap"]),
        )
    } else if ["budget", "department", "variance", "expense", "spend"].iter().any(|k| q.contains(k)) {
        let rows: String = budget["departments"]
            .as_array()
            .map(|ds| {
                ds.iter()
                    .map(|d| {
                        format!(
                            "| {} | {} | {} | {} | {} |\n",
                            d["name"].as_str().unwrap_or("–"),
                            inr(&d["budget_allocated"]),
                            inr(&d["budget_utilized"]),
                            inr(&d["budget_remaining"]),
                            num(&d["burn_percentage"], "%"),
                        )
                    })
                    .collect()
            })
            .unwrap_or_default();
        format!(
            "### Budget vs actual: {org_name}\n\n\
            | DEPARTMENT | ALLOCATED | UTILISED | REMAINING | BURN % |\n| :--- | :--- | :--- | :--- | :--- |\n{rows}\
            | **Total** | {} | {} | {} | {} |{note}",
            inr(&budget["total_budget_allocated"]),
            inr(&budget["total_budget_utilized"]),
            inr(&budget["total_budget_remaining"]),
            num(&budget["overall_burn_pct"], "%"),
        )
    } else {
        let p = &fpa["profitability"];
        let l = &fpa["liquidity_and_balance_sheet"];
        format!(
            "### Financial summary: {org_name}\n\n\
            | PARTICULARS | VALUE |\n| :--- | :--- |\n\
            | Revenue | {} |\n| Gross profit | {} ({}) |\n| Operating expenses | {} |\n| Net profit | {} ({}) |\n\
            | Current assets | {} |\n| Current liabilities | {} |\n| Working capital | {} |\n\
            | Current ratio | {} |\n| Quick ratio | {} |{note}\n\n\
            Ask about **cash runway**, **receivables** or **budget** for a detailed view.",
            inr(&p["total_revenue"]),
            inr(&p["gross_profit"]),
            num(&p["gross_margin_pct"], "%"),
            inr(&p["opex"]),
            inr(&p["net_profit"]),
            num(&p["net_margin_pct"], "%"),
            inr(&l["current_assets"]),
            inr(&l["current_liabilities"]),
            inr(&l["working_capital"]),
            num(&l["current_ratio"], "x"),
            num(&l["quick_ratio"], "x"),
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn missing_figures_show_dash_never_invented_numbers() {
        let out = answer_from_ledger("what is our runway", &json!({}), "Acme");
        assert!(out.contains("| Cash runway | – |"));
        assert!(!out.contains("640000") && !out.contains("14.5"));
    }

    #[test]
    fn real_figures_are_used() {
        let ctx = json!({ "fpa_metrics": { "treasury_and_runway": {
            "cash_and_bank_reserves": 120000.0, "estimated_monthly_burn": 60000.0, "cash_runway_months": 2.0 } } });
        let out = answer_from_ledger("cash runway?", &ctx, "Acme");
        assert!(out.contains("₹120000.00") && out.contains("2.0 months") && out.contains("Critical"));
    }
}
