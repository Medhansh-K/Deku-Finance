//! GSTR-1 and GSTR-3B JSON built from the company's own books. Pure functions, no I/O.
//! Rule: never invent a value. Anything missing or inconsistent becomes an error and `json` is null.
//!
//! Field names follow the GSTN offline-tool JSON:
//! - GSTR-1: returns offline tool schema with Table 12 split into hsn_b2b / hsn_b2c (Phase-III,
//!   periods from April 2025). The tool's own "version"/"hash" stamps are not emitted.
//! - GSTR-3B: returns offline utility schema (sup_details, inter_sup, itc_elg).
//!
//! Amounts are summed in paise (integers) and converted to rupees only when the JSON is written.
//! Inputs are PostgREST rows; the fixtures in backend/tests/fixtures are shared with the
//! TypeScript test (tests/gst-returns.test.ts), so error texts and JSON must stay identical.

use serde::{Deserialize, Deserializer, Serialize};
use serde_json::{json, Value};
use std::cmp::Ordering;
use std::collections::{HashMap, HashSet};

// ---------- Inputs (rows as PostgREST returns them) ----------

/// numeric columns arrive as JSON numbers, but a string or null must not break the return.
fn de_num<'de, D: Deserializer<'de>>(d: D) -> Result<f64, D::Error> {
    match Option::<Value>::deserialize(d)? {
        None | Some(Value::Null) => Ok(0.0),
        Some(Value::Number(n)) => n
            .as_f64()
            .ok_or_else(|| serde::de::Error::custom("number out of range")),
        Some(Value::String(s)) => s.trim().parse().map_err(serde::de::Error::custom),
        Some(other) => Err(serde::de::Error::custom(format!("expected a number, got {}", other))),
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct Party {
    pub gstin: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct InvoiceLine {
    #[serde(default)]
    pub line_number: i64,
    pub hsn_sac_code: Option<String>,
    pub unit_code: Option<String>,
    #[serde(default, deserialize_with = "de_num")]
    pub quantity: f64,
    #[serde(default, deserialize_with = "de_num")]
    pub taxable_amount: f64,
    #[serde(default, deserialize_with = "de_num")]
    pub gst_rate: f64,
    #[serde(default, deserialize_with = "de_num")]
    pub cgst_amount: f64,
    #[serde(default, deserialize_with = "de_num")]
    pub sgst_amount: f64,
    #[serde(default, deserialize_with = "de_num")]
    pub igst_amount: f64,
    #[serde(default, deserialize_with = "de_num")]
    pub cess_amount: f64,
}

/// A sales invoice (migration 7) with `parties(gstin)` and `sales_invoice_lines(*)` embedded.
/// A sales note row (migration 31) reads into the same shape through the aliases.
#[derive(Debug, Clone, Deserialize)]
pub struct Invoice {
    #[serde(alias = "note_number")]
    pub invoice_number: String,
    #[serde(alias = "note_date")]
    pub invoice_date: String,
    pub status: String,
    pub supply_type: String,
    pub place_of_supply: Option<String>,
    #[serde(default, deserialize_with = "de_num")]
    pub taxable_amount: f64,
    #[serde(default, deserialize_with = "de_num")]
    pub cgst_amount: f64,
    #[serde(default, deserialize_with = "de_num")]
    pub sgst_amount: f64,
    #[serde(default, deserialize_with = "de_num")]
    pub igst_amount: f64,
    #[serde(default, deserialize_with = "de_num")]
    pub cess_amount: f64,
    #[serde(default, deserialize_with = "de_num")]
    pub total_amount: f64,
    /// Migration 25; absent in older rows and fixtures means "direct".
    #[serde(default)]
    pub sales_channel: Option<String>,
    pub parties: Option<Party>,
    #[serde(alias = "sales_note_lines")]
    pub sales_invoice_lines: Option<Vec<InvoiceLine>>,
    /// Migration 32; rows from before it read as "tax_invoice".
    pub invoice_type: Option<String>,
    pub shipping_bill_number: Option<String>,
    pub shipping_bill_date: Option<String>,
    pub port_code: Option<String>,
}

/// The invoice a note adjusts, embedded as `sales_invoices(...)`.
#[derive(Debug, Clone, Deserialize)]
pub struct NoteInvoice {
    pub invoice_number: String,
    pub invoice_type: Option<String>,
    #[serde(default, deserialize_with = "de_num")]
    pub total_amount: f64,
}

/// A credit or debit note (migration 31) with `parties(gstin)`, `sales_note_lines(*)` and its
/// original `sales_invoices(...)` embedded.
#[derive(Debug, Clone, Deserialize)]
pub struct Note {
    #[serde(flatten)]
    pub doc: Invoice,
    pub note_type: String,
    pub sales_invoices: Option<NoteInvoice>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Account {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct JournalLine {
    pub account_id: String,
    #[serde(default, deserialize_with = "de_num")]
    pub debit: f64,
    #[serde(default, deserialize_with = "de_num")]
    pub credit: f64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Journal {
    pub id: String,
    #[serde(default)]
    pub entry_number: String,
    pub entry_date: String,
    pub status: String,
    pub reversal_of_id: Option<String>,
    pub journal_entry_lines: Option<Vec<JournalLine>>,
}

/// A row of public.purchase_bills (migration 24).
#[derive(Debug, Clone, Deserialize)]
pub struct PurchaseBill {
    #[serde(default)]
    pub supplier_name: String,
    #[serde(default)]
    pub supplier_gstin: String,
    #[serde(default)]
    pub bill_number: String,
    #[serde(default)]
    pub bill_date: String,
    #[serde(default)]
    pub place_of_supply: String,
    #[serde(default, deserialize_with = "de_num")]
    pub taxable_amount: f64,
    #[serde(default, deserialize_with = "de_num")]
    pub cgst: f64,
    #[serde(default, deserialize_with = "de_num")]
    pub sgst: f64,
    #[serde(default, deserialize_with = "de_num")]
    pub igst: f64,
    #[serde(default, deserialize_with = "de_num")]
    pub cess: f64,
    #[serde(default)]
    pub itc_eligibility: String,
    pub blocked_reason: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Books {
    pub gstin: Option<String>,
    /// MMYYYY
    pub ret_period: String,
    pub invoices: Vec<Invoice>,
    #[serde(default)]
    pub accounts: Vec<Account>,
    #[serde(default)]
    pub journals: Vec<Journal>,
    /// The purchase register; when it has bills for the period, Table 4 comes from them.
    #[serde(default)]
    pub purchase_bills: Vec<PurchaseBill>,
    /// Credit and debit notes dated in the period, any status.
    #[serde(default)]
    pub notes: Vec<Note>,
}

// ---------- Output ----------

/// One summary line in rupees; `amounts` null means "not computed".
#[derive(Debug, Clone, Serialize)]
pub struct SummaryRow {
    pub section: String,
    pub amounts: Option<Value>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ReturnResult {
    pub json: Option<Value>,
    pub errors: Vec<String>,
    pub summary: Vec<SummaryRow>,
    /// GSTR-3B only: Table 6 tax payment (not part of the uploaded JSON).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub table6: Option<Value>,
}

// ---------- Amounts ----------

#[derive(Debug, Clone, Copy, Default, PartialEq)]
pub struct Amounts {
    pub txval: i64,
    pub iamt: i64,
    pub camt: i64,
    pub samt: i64,
    pub csamt: i64,
}

impl Amounts {
    fn add(&mut self, o: &Amounts) {
        self.txval += o.txval;
        self.iamt += o.iamt;
        self.camt += o.camt;
        self.samt += o.samt;
        self.csamt += o.csamt;
    }
    fn rupees(&self) -> Value {
        json!({
            "txval": rupee(self.txval),
            "iamt": rupee(self.iamt),
            "camt": rupee(self.camt),
            "samt": rupee(self.samt),
            "csamt": rupee(self.csamt),
        })
    }
    fn scaled(&self, k: i64) -> Amounts {
        Amounts {
            txval: self.txval * k,
            iamt: self.iamt * k,
            camt: self.camt * k,
            samt: self.samt * k,
            csamt: self.csamt * k,
        }
    }
    fn negative(&self) -> bool {
        self.txval < 0 || self.iamt < 0 || self.camt < 0 || self.samt < 0 || self.csamt < 0
    }
    fn tax_only(&self) -> Value {
        json!({
            "iamt": rupee(self.iamt),
            "camt": rupee(self.camt),
            "samt": rupee(self.samt),
            "csamt": rupee(self.csamt),
        })
    }
}

fn paise(v: f64) -> i64 {
    (v * 100.0).round() as i64
}

/// Whole numbers are written as integers, as JavaScript's JSON.stringify does (1994, not 1994.0).
fn num(x: f64) -> Value {
    if x.is_finite() && x.fract() == 0.0 && x.abs() < 9e15 {
        json!(x as i64)
    } else {
        json!(x)
    }
}

fn rupee(p: i64) -> Value {
    num(p as f64 / 100.0)
}

fn inr(p: i64) -> String {
    format!("₹{:.2}", p as f64 / 100.0)
}

/// Adds `{ rt, ... }`-style leading fields to an amounts object.
fn merge(mut base: Value, extra: Value) -> Value {
    if let (Some(b), Value::Object(e)) = (base.as_object_mut(), extra) {
        b.extend(e);
    }
    base
}

/// Insertion-ordered bucket (the TS code relies on Map order for the JSON arrays).
fn bucket<'a, K: PartialEq, V: Default>(list: &'a mut Vec<(K, V)>, key: K) -> &'a mut V {
    let idx = match list.iter().position(|(k, _)| *k == key) {
        Some(i) => i,
        None => {
            list.push((key, V::default()));
            list.len() - 1
        }
    };
    &mut list[idx].1
}

fn line_amounts(l: &InvoiceLine) -> Amounts {
    Amounts {
        txval: paise(l.taxable_amount),
        iamt: paise(l.igst_amount),
        camt: paise(l.cgst_amount),
        samt: paise(l.sgst_amount),
        csamt: paise(l.cess_amount),
    }
}

// ---------- Small validators ----------

const GSTIN_CHARS: &[u8] = b"0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/// Format plus the mod-36 check digit.
pub fn is_valid_gstin(gstin: &str) -> bool {
    let g = gstin.to_uppercase();
    let b = g.as_bytes();
    if b.len() != 15 {
        return false;
    }
    let digit = |i: usize| b[i].is_ascii_digit();
    let upper = |i: usize| b[i].is_ascii_uppercase();
    let shape = digit(0)
        && digit(1)
        && (2..7).all(upper)
        && (7..11).all(digit)
        && upper(11)
        && (upper(12) || (b'1'..=b'9').contains(&b[12]))
        && b[13] == b'Z'
        && (digit(14) || upper(14));
    if !shape {
        return false;
    }
    let idx = |c: u8| GSTIN_CHARS.iter().position(|&x| x == c).unwrap_or(0) as u32;
    let sum: u32 = (0..14)
        .map(|i| {
            let v = idx(b[i]) * if i % 2 == 0 { 1 } else { 2 };
            v / 36 + v % 36
        })
        .sum();
    GSTIN_CHARS[((36 - sum % 36) % 36) as usize] == b[14]
}

pub fn is_ret_period(p: &str) -> bool {
    p.len() == 6
        && p.bytes().all(|c| c.is_ascii_digit())
        && matches!(p[..2].parse::<u32>(), Ok(1..=12))
}

/// "YYYY-MM" of a valid MMYYYY period.
pub fn period_month(p: &str) -> String {
    format!("{}-{}", &p[2..], &p[..2])
}

/// True when an ISO yyyy-mm-dd date falls in the MMYYYY return period.
fn in_period(iso: &str, p: &str) -> bool {
    iso.get(..7) == Some(period_month(p).as_str())
}

// 01-38 are states/UTs, 97 is "Other Territory".
fn is_state_code(c: &str) -> bool {
    c.len() == 2 && c.bytes().all(|b| b.is_ascii_digit()) && matches!(c.parse::<u32>(), Ok(1..=38) | Ok(97))
}

/// Leading two-digit state code of "27-Maharashtra" (not followed by a third digit), or "".
fn pos_code(raw: &str) -> String {
    let s = raw.trim();
    let b = s.as_bytes();
    if b.len() >= 2 && b[0].is_ascii_digit() && b[1].is_ascii_digit() && !(b.len() > 2 && b[2].is_ascii_digit()) {
        s[..2].to_string()
    } else {
        String::new()
    }
}

fn is_hsn(code: &str) -> bool {
    (4..=8).contains(&code.len()) && code.bytes().all(|b| b.is_ascii_digit())
}

fn is_iso_date(s: &str) -> bool {
    let b = s.as_bytes();
    b.len() == 10
        && b.iter()
            .enumerate()
            .all(|(i, c)| if i == 4 || i == 7 { *c == b'-' } else { c.is_ascii_digit() })
}

fn upper_trim(s: Option<&str>) -> Option<String> {
    s.map(|g| g.trim().to_uppercase()).filter(|g| !g.is_empty())
}

fn first2(s: &str) -> String {
    s.chars().take(2).collect()
}

// ---------- Shared validations ----------

struct Checked<'a> {
    inv: &'a Invoice,
    ctin: Option<String>,
    pos: String,
    total: Amounts,
    /// invoice_type of the invoice, or of the original invoice for a note.
    typ: &'a str,
}

fn period_invoices<'a>(invoices: &'a [Invoice], p: &str) -> impl Iterator<Item = &'a Invoice> + 'a {
    let p = p.to_string();
    invoices
        .iter()
        .filter(move |i| i.status != "draft" && i.status != "cancelled" && in_period(&i.invoice_date, &p))
}

fn invoice_type(t: Option<&str>) -> &str {
    t.unwrap_or("tax_invoice")
}

/// Rule 49 bill of supply, and exports / SEZ supplies under LUT or bond: no tax is charged.
fn untaxed_type(t: &str) -> bool {
    matches!(t, "bill_of_supply" | "export_without_payment" | "sez_without_payment")
}

/// Exports and SEZ supplies (3.1(b), GSTR-1 6A/6B).
fn zero_rated(c: &Checked) -> bool {
    c.inv.supply_type == "export" || c.typ.starts_with("sez_")
}

fn exempt(c: &Checked) -> bool {
    c.inv.supply_type == "exempt" || c.typ == "bill_of_supply"
}

/// One invoice or note: every reason it can't be reported, or the figures that are.
fn check_doc<'a>(inv: &'a Invoice, typ: &'a str, own_state: &str) -> Result<Checked<'a>, Vec<String>> {
    let mut errs: Vec<String> = Vec::new();
    let pos = pos_code(inv.place_of_supply.as_deref().unwrap_or(""));
    // 96 is GSTN's code for "Other Countries", the place of supply of an export.
    if !is_state_code(&pos) && !(inv.supply_type == "export" && pos == "96") {
        errs.push("place of supply is missing or has no valid state code".into());
    }

    let ctin = upper_trim(inv.parties.as_ref().and_then(|p| p.gstin.as_deref()));
    if let Some(c) = &ctin {
        if !is_valid_gstin(c) {
            errs.push(format!("customer GSTIN {} is not valid", c));
        }
    }

    let lines = inv.sales_invoice_lines.as_deref().unwrap_or(&[]);
    if lines.is_empty() {
        errs.push("has no line items".into());
    }
    // Zero-rated under LUT/bond keeps the applicable rate on the line but charges no tax.
    let untaxed = untaxed_type(typ) || (inv.supply_type == "export" && typ != "export_with_payment");
    let mut total = Amounts::default();
    for l in lines {
        let a = line_amounts(l);
        total.add(&a);
        if !is_hsn(l.hsn_sac_code.as_deref().unwrap_or("").trim()) {
            errs.push(format!("line {} has no valid HSN/SAC code", l.line_number));
        }
        let expected = (a.txval as f64 * l.gst_rate / 100.0).round() as i64;
        // GSTN tolerates up to ₹1 difference between tax and taxable value x rate.
        if !untaxed && (a.iamt + a.camt + a.samt - expected).abs() > 100 {
            errs.push(format!(
                "line {} tax does not match {}% of the taxable value",
                l.line_number,
                num(l.gst_rate)
            ));
        }
    }

    if !lines.is_empty() {
        let header = [
            (paise(inv.taxable_amount), total.txval, "taxable value"),
            (paise(inv.cgst_amount), total.camt, "CGST"),
            (paise(inv.sgst_amount), total.samt, "SGST"),
            (paise(inv.igst_amount), total.iamt, "IGST"),
            (paise(inv.cess_amount), total.csamt, "cess"),
        ];
        for (h, t, label) in header {
            if h != t {
                errs.push(format!("{} {} does not equal the sum of its lines {}", label, inr(h), inr(t)));
            }
        }
    }

    match inv.supply_type.as_str() {
        "intra_state" => {
            if total.iamt != 0 {
                errs.push("is intra-state but carries IGST".into());
            }
            if total.camt != total.samt {
                errs.push("is intra-state but CGST and SGST differ".into());
            }
            if !own_state.is_empty() && !pos.is_empty() && pos != own_state {
                errs.push(format!(
                    "is intra-state but place of supply {} differs from the company's state {}",
                    pos, own_state
                ));
            }
        }
        "inter_state" => {
            if total.camt != 0 || total.samt != 0 {
                errs.push("is inter-state but carries CGST/SGST".into());
            }
            if !own_state.is_empty() && pos == own_state {
                errs.push(format!("is inter-state but place of supply {} is the company's own state", pos));
            }
        }
        "export" | "exempt" => {
            let igst_ok = typ == "export_with_payment";
            if (total.iamt != 0 && !igst_ok) || total.camt != 0 || total.samt != 0 {
                errs.push(format!("is {} but carries tax", inv.supply_type));
            }
        }
        other => errs.push(format!("has unknown supply type \"{}\"", other)),
    }
    if untaxed_type(typ) && total.iamt + total.camt + total.samt + total.csamt != 0 {
        errs.push(format!("is a {} but carries tax", typ.replace('_', " ")));
    }
    if typ.starts_with("sez_") && ctin.is_none() {
        errs.push("is an SEZ supply but the customer has no GSTIN".into());
    }

    if errs.is_empty() {
        Ok(Checked { inv, ctin, pos, total, typ })
    } else {
        Err(errs)
    }
}

/// Validations shared by both returns: (errors, company GSTIN, invoices that passed).
fn check(b: &Books) -> (Vec<String>, String, Vec<Checked<'_>>) {
    let mut errors = Vec::new();
    let valid_period = is_ret_period(&b.ret_period);
    if !valid_period {
        errors.push("Choose a return period (month).".to_string());
    }
    let gstin = upper_trim(b.gstin.as_deref()).unwrap_or_default();
    if gstin.is_empty() {
        errors.push("Company GSTIN is missing. Add it to the company profile before exporting a return.".to_string());
    } else if !is_valid_gstin(&gstin) {
        errors.push(format!("Company GSTIN {} is not valid (check digit or format).", gstin));
    }
    let own_state = first2(&gstin);

    let mut checked = Vec::new();
    if !valid_period {
        return (errors, gstin, checked);
    }

    for inv in period_invoices(&b.invoices, &b.ret_period) {
        match check_doc(inv, invoice_type(inv.invoice_type.as_deref()), &own_state) {
            Ok(c) => checked.push(c),
            Err(errs) => errors.extend(errs.iter().map(|e| format!("Invoice {}: {}.", inv.invoice_number, e))),
        }
    }
    (errors, gstin, checked)
}

/// Issued notes dated in the period, checked like invoices but with their original's invoice type.
fn check_notes<'a>(b: &'a Books, errors: &mut Vec<String>) -> Vec<(Checked<'a>, &'a Note)> {
    let mut out = Vec::new();
    if !is_ret_period(&b.ret_period) {
        return out;
    }
    let own_state = first2(&upper_trim(b.gstin.as_deref()).unwrap_or_default());
    let issued = b.notes.iter().filter(|n| n.doc.status == "issued" && in_period(&n.doc.invoice_date, &b.ret_period));
    for n in issued {
        let label = |e: &str| format!("Note {}: {}.", n.doc.invoice_number, e);
        let Some(orig) = &n.sales_invoices else {
            errors.push(label("its original invoice is not readable"));
            continue;
        };
        if n.note_type != "credit" && n.note_type != "debit" {
            errors.push(label(format!("has unknown note type \"{}\"", n.note_type).as_str()));
            continue;
        }
        match check_doc(&n.doc, invoice_type(orig.invoice_type.as_deref()), &own_state) {
            Ok(c) if exempt(&c) => {
                errors.push(label("notes against exempt or bill-of-supply invoices are not supported yet"))
            }
            Ok(c) => out.push((c, n)),
            Err(errs) => errors.extend(errs.iter().map(|e| label(e.as_str()))),
        }
    }
    out
}

// ---------- GSTR-1 ----------

fn iso_to_gst_date(iso: &str) -> String {
    match (iso.get(8..10), iso.get(5..7), iso.get(..4)) {
        (Some(d), Some(m), Some(y)) => format!("{}-{}-{}", d, m, y),
        _ => iso.to_string(),
    }
}

// The offline tool numbers items as rate x 100 + 1 (18% -> 1801).
fn item_num(rt: f64) -> i64 {
    (rt * 100.0).round() as i64 + 1
}

// shortcut: B2CL threshold is the post-Aug-2024 ₹1 lakh limit; earlier periods (₹2.5 lakh) block more than needed.
const B2CL_LIMIT: i64 = 100_000_00;

fn trailing_digits(s: &str) -> &str {
    &s[s.trim_end_matches(|c: char| c.is_ascii_digit()).len()..]
}

/// Numbers in one series differ only in their trailing digits, so compare those numerically.
fn doc_order(a: &str, b: &str) -> Ordering {
    let da = trailing_digits(a).trim_start_matches('0');
    let db = trailing_digits(b).trim_start_matches('0');
    da.len().cmp(&db.len()).then(da.cmp(db)).then(a.cmp(b))
}

#[derive(PartialEq)]
struct HsnKey {
    b2b: bool,
    code: String,
    uqc: String,
    rt: f64,
}

type HsnRows = Vec<(HsnKey, (Amounts, i64))>;

/// Table 12 rows; a credit note (sign -1) takes its lines back out.
fn add_hsn(hsn: &mut HsnRows, lines: &[InvoiceLine], b2b: bool, sign: i64) {
    for l in lines {
        let code = l.hsn_sac_code.as_deref().unwrap_or("").trim().to_string();
        let service = code.starts_with("99");
        // Services have no quantity: GSTN wants UQC "NA" and qty 0.
        let uqc = if service { "NA".to_string() } else { l.unit_code.clone().unwrap_or_default() };
        let h = bucket(hsn, HsnKey { b2b, code, uqc, rt: l.gst_rate });
        h.0.add(&line_amounts(l).scaled(sign));
        if !service {
            h.1 += sign * (l.quantity * 10000.0).round() as i64;
        }
    }
}

fn by_rate(lines: &[InvoiceLine]) -> Vec<(f64, Amounts)> {
    let mut out: Vec<(f64, Amounts)> = Vec::new();
    for l in lines {
        bucket(&mut out, l.gst_rate).add(&line_amounts(l));
    }
    out
}

/// b2b / cdnr items: `{ num, itm_det: { rt, txval, iamt, camt, samt, csamt } }`.
fn b2b_items(rates: &[(f64, Amounts)]) -> Vec<Value> {
    rates
        .iter()
        .map(|(rt, a)| json!({ "num": item_num(*rt), "itm_det": merge(json!({ "rt": num(*rt) }), a.rupees()) }))
        .collect()
}

fn b2b_inv_typ(typ: &str) -> &'static str {
    match typ {
        "sez_with_payment" => "SEWP",
        "sez_without_payment" => "SEWOP",
        _ => "R",
    }
}

/// Table 13 rows, one per series: the number without its trailing digits (INV-0001 -> INV-).
fn doc_rows<'a>(docs: impl Iterator<Item = (&'a str, bool)>) -> Vec<Value> {
    let mut series: Vec<(String, Vec<(&'a str, bool)>)> = Vec::new();
    for (n, cancelled) in docs {
        bucket(&mut series, n.trim_end_matches(|c: char| c.is_ascii_digit()).to_string()).push((n, cancelled));
    }
    series
        .iter()
        .enumerate()
        .map(|(idx, (_, nums))| {
            let mut sorted: Vec<&str> = nums.iter().map(|(n, _)| *n).collect();
            sorted.sort_by(|a, b| doc_order(a, b));
            let cancel = nums.iter().filter(|(_, c)| *c).count();
            json!({
                "num": idx + 1,
                "from": sorted[0],
                "to": sorted[sorted.len() - 1],
                "totnum": nums.len(),
                "cancel": cancel,
                "net_issue": nums.len() - cancel,
            })
        })
        .collect()
}

pub fn build_gstr1(b: &Books) -> ReturnResult {
    let (mut errors, gstin, checked) = check(b);
    let notes = check_notes(b, &mut errors);
    let own_state = first2(&gstin);

    let mut b2b: Vec<(String, Vec<Value>)> = Vec::new();
    let mut b2cs: Vec<((&str, String, f64), Amounts)> = Vec::new();
    let mut nil: Vec<(String, i64)> = Vec::new();
    let mut hsn: HsnRows = Vec::new();
    let mut exp: Vec<(&str, Vec<Value>)> = Vec::new();
    let mut cdnr: Vec<(String, Vec<Value>)> = Vec::new();
    let mut cdnur: Vec<Value> = Vec::new();
    let (mut sum_b2b, mut sum_b2cs, mut sum_nil) = (Amounts::default(), Amounts::default(), Amounts::default());
    let (mut sum_exp, mut sum_sez) = (Amounts::default(), Amounts::default());
    let (mut sum_cdnr, mut sum_cdnur) = (Amounts::default(), Amounts::default());

    for c in &checked {
        let Checked { inv, ctin, pos, total, typ } = c;
        let lines = inv.sales_invoice_lines.as_deref().unwrap_or(&[]);
        if ctin.is_none() && inv.supply_type == "inter_state" && paise(inv.total_amount) > B2CL_LIMIT {
            errors.push(format!(
                "Invoice {}: inter-state B2C invoice above ₹1 lakh (B2CL) is not supported yet.",
                inv.invoice_number
            ));
            continue;
        }

        add_hsn(&mut hsn, lines, ctin.is_some(), 1);
        let rates = by_rate(lines);

        if inv.supply_type == "export" {
            let mut row = json!({
                "inum": inv.invoice_number,
                "idt": iso_to_gst_date(&inv.invoice_date),
                "val": rupee(paise(inv.total_amount)),
                "itms": rates.iter().map(|(rt, a)| json!({
                    "txval": rupee(a.txval), "rt": num(*rt), "iamt": rupee(a.iamt), "csamt": rupee(a.csamt)
                })).collect::<Vec<_>>(),
            });
            // The shipping bill often arrives after the invoice; the schema leaves it optional.
            let shipping = [
                ("sbpcode", inv.port_code.clone()),
                ("sbnum", inv.shipping_bill_number.clone()),
                ("sbdt", inv.shipping_bill_date.as_deref().map(iso_to_gst_date)),
            ];
            for (key, v) in shipping {
                if let Some(v) = v.filter(|v| !v.trim().is_empty()) {
                    row[key] = json!(v);
                }
            }
            let exp_typ = if *typ == "export_with_payment" { "WPAY" } else { "WOPAY" };
            bucket(&mut exp, exp_typ).push(row);
            sum_exp.add(total);
            continue;
        }

        let inter = inv.supply_type == "inter_state" || *pos != own_state;
        if exempt(c) {
            let key = format!(
                "{}{}",
                if inter { "INTR" } else { "INTRA" },
                if ctin.is_some() { "B2B" } else { "B2C" }
            );
            *bucket(&mut nil, key) += total.txval;
            sum_nil.add(total);
            continue;
        }

        if let Some(ctin) = ctin {
            let inv_typ = b2b_inv_typ(typ);
            bucket(&mut b2b, ctin.clone()).push(json!({
                "inum": inv.invoice_number,
                "idt": iso_to_gst_date(&inv.invoice_date),
                "val": rupee(paise(inv.total_amount)),
                "pos": pos,
                "rchrg": "N",
                "inv_typ": inv_typ,
                "itms": b2b_items(&rates),
            }));
            if inv_typ == "R" {
                sum_b2b.add(total);
            } else {
                sum_sez.add(total);
            }
        } else {
            for (rt, a) in &rates {
                bucket(&mut b2cs, (if inter { "INTER" } else { "INTRA" }, pos.clone(), *rt)).add(a);
            }
            sum_b2cs.add(total);
        }
    }

    // Table 9B. A credit note reduces, a debit note adds; small B2C notes net into B2CS.
    for (c, n) in &notes {
        let Checked { inv, ctin, pos, total, typ } = c;
        let credit = n.note_type == "credit";
        let sign = if credit { -1 } else { 1 };
        let lines = inv.sales_invoice_lines.as_deref().unwrap_or(&[]);
        add_hsn(&mut hsn, lines, ctin.is_some(), sign);
        let rates = by_rate(lines);
        let head = json!({
            "ntty": if credit { "C" } else { "D" },
            "nt_num": inv.invoice_number,
            "nt_dt": iso_to_gst_date(&inv.invoice_date),
            "val": rupee(paise(inv.total_amount)),
        });
        let original_total = n.sales_invoices.as_ref().map_or(0, |o| paise(o.total_amount));
        let export = inv.supply_type == "export";

        if export || (ctin.is_none() && inv.supply_type == "inter_state" && original_total > B2CL_LIMIT) {
            let itms: Vec<Value> = rates
                .iter()
                .map(|(rt, a)| json!({ "num": item_num(*rt), "itm_det": {
                    "rt": num(*rt), "txval": rupee(a.txval), "iamt": rupee(a.iamt), "csamt": rupee(a.csamt)
                }}))
                .collect();
            let note_typ = match (export, *typ == "export_with_payment") {
                (true, true) => "EXPWP",
                (true, false) => "EXPWOP",
                _ => "B2CL",
            };
            let mut row = merge(head, json!({ "typ": note_typ, "itms": itms }));
            if !export {
                row["pos"] = json!(pos);
            }
            cdnur.push(row);
            sum_cdnur.add(&total.scaled(sign));
        } else if let Some(ctin) = ctin {
            bucket(&mut cdnr, ctin.clone()).push(merge(
                head,
                json!({ "pos": pos, "rchrg": "N", "inv_typ": b2b_inv_typ(typ), "itms": b2b_items(&rates) }),
            ));
            sum_cdnr.add(&total.scaled(sign));
        } else {
            let inter = inv.supply_type == "inter_state" || *pos != own_state;
            for (rt, a) in &rates {
                bucket(&mut b2cs, (if inter { "INTER" } else { "INTRA" }, pos.clone(), *rt)).add(&a.scaled(sign));
            }
            sum_b2cs.add(&total.scaled(sign));
        }
    }

    let summary = vec![
        SummaryRow { section: "B2B (4A)".into(), amounts: Some(sum_b2b.rupees()) },
        SummaryRow { section: "B2C small (7)".into(), amounts: Some(sum_b2cs.rupees()) },
        SummaryRow { section: "Nil / exempt (8)".into(), amounts: Some(sum_nil.rupees()) },
        SummaryRow { section: "Exports (6A)".into(), amounts: Some(sum_exp.rupees()) },
        SummaryRow { section: "SEZ supplies (6B)".into(), amounts: Some(sum_sez.rupees()) },
        SummaryRow { section: "Notes, registered (9B CDNR)".into(), amounts: Some(sum_cdnr.rupees()) },
        SummaryRow { section: "Notes, unregistered (9B CDNUR)".into(), amounts: Some(sum_cdnur.rupees()) },
    ];
    if !errors.is_empty() {
        return ReturnResult { json: None, errors, summary, table6: None };
    }

    let hsn_rows = |want_b2b: bool| -> Vec<Value> {
        hsn.iter()
            .filter(|(k, _)| k.b2b == want_b2b)
            .enumerate()
            .map(|(idx, (k, (a, qty)))| {
                merge(
                    json!({
                        "num": idx + 1,
                        "hsn_sc": k.code,
                        "uqc": k.uqc,
                        "qty": num(*qty as f64 / 10000.0),
                        "rt": num(k.rt),
                    }),
                    a.rupees(),
                )
            })
            .collect()
    };

    // The period is valid here (an invalid one is an error above).
    let p = &b.ret_period;
    let invoice_docs = b
        .invoices
        .iter()
        .filter(|i| i.status != "draft" && in_period(&i.invoice_date, p))
        .map(|i| (i.invoice_number.as_str(), i.status == "cancelled"));
    let mut doc_det = vec![json!({ "doc_num": 1, "docs": doc_rows(invoice_docs) })]; // 1: invoices for outward supply
    for (doc_num, kind) in [(4, "debit"), (5, "credit")] {
        let docs = doc_rows(
            b.notes
                .iter()
                .filter(|n| n.note_type == kind && n.doc.status != "draft" && in_period(&n.doc.invoice_date, p))
                .map(|n| (n.doc.invoice_number.as_str(), n.doc.status == "cancelled")),
        );
        if !docs.is_empty() {
            doc_det.push(json!({ "doc_num": doc_num, "docs": docs }));
        }
    }

    let mut json = json!({
        "gstin": gstin,
        "fp": b.ret_period,
        "b2b": b2b.iter().map(|(ctin, inv)| json!({ "ctin": ctin, "inv": inv })).collect::<Vec<_>>(),
        "b2cs": b2cs.iter().map(|((sply_ty, pos, rt), a)| {
            merge(json!({ "sply_ty": sply_ty, "pos": pos, "typ": "OE", "rt": num(*rt) }), a.rupees())
        }).collect::<Vec<_>>(),
        "nil": {
            // The books only know "exempt"; there is no nil-rated or non-GST category to report.
            "inv": nil.iter().map(|(sply_ty, p)| json!({
                "sply_ty": sply_ty, "expt_amt": rupee(*p), "nil_amt": 0, "ngsup_amt": 0
            })).collect::<Vec<_>>(),
        },
        "hsn": { "hsn_b2b": hsn_rows(true), "hsn_b2c": hsn_rows(false) },
        "doc_issue": { "doc_det": doc_det },
    });
    // Sections with nothing to report are left out.
    if !exp.is_empty() {
        json["exp"] = json!(exp.iter().map(|(t, inv)| json!({ "exp_typ": t, "inv": inv })).collect::<Vec<_>>());
    }
    if !cdnr.is_empty() {
        json["cdnr"] = json!(cdnr.iter().map(|(ctin, nt)| json!({ "ctin": ctin, "nt": nt })).collect::<Vec<_>>());
    }
    if !cdnur.is_empty() {
        json["cdnur"] = json!(cdnur);
    }
    ReturnResult { json: Some(json), errors, summary, table6: None }
}

// ---------- GSTR-3B ----------

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
enum Head {
    I,
    C,
    S,
    Cess,
}

impl Amounts {
    fn head_mut(&mut self, h: Head) -> &mut i64 {
        match h {
            Head::I => &mut self.iamt,
            Head::C => &mut self.camt,
            Head::S => &mut self.samt,
            Head::Cess => &mut self.csamt,
        }
    }
}

/// Input GST ledger by name: /^input\s+(cgst|sgst|utgst|igst|cess)\b/i.
fn itc_head(name: &str) -> Option<Head> {
    let lower = name.to_lowercase();
    let rest = lower.strip_prefix("input")?;
    let word = rest.trim_start();
    if word.len() == rest.len() {
        return None;
    }
    let is = |w: &str| {
        word.strip_prefix(w)
            .map_or(false, |after| !after.chars().next().map_or(false, |c| c.is_ascii_alphanumeric() || c == '_'))
    };
    if is("cgst") {
        Some(Head::C)
    } else if is("sgst") || is("utgst") {
        Some(Head::S)
    } else if is("igst") {
        Some(Head::I)
    } else if is("cess") {
        Some(Head::Cess)
    } else {
        None
    }
}

/// Period ITC from the Input GST ledgers, or errors explaining why it can't be derived.
fn compute_itc(p: &str, accounts: &[Account], journals: &[Journal]) -> (Amounts, Vec<String>) {
    let mut errors = Vec::new();
    let head: HashMap<&str, Head> = accounts
        .iter()
        .filter_map(|a| itc_head(&a.name).map(|h| (a.id.as_str(), h)))
        .collect();
    let names: HashMap<&str, &str> = accounts.iter().map(|a| (a.id.as_str(), a.name.as_str())).collect();
    let heads: HashSet<Head> = head.values().copied().collect();
    for (h, label) in [(Head::C, "CGST"), (Head::S, "SGST"), (Head::I, "IGST")] {
        if !heads.contains(&h) {
            errors.push(format!(
                "ITC not computed: the chart of accounts has no \"Input {}\" ledger.",
                label
            ));
        }
    }

    // Reversed entries were posted before being reversed, so they still belong to their period.
    let live: Vec<&Journal> = journals
        .iter()
        .filter(|j| (j.status == "posted" || j.status == "reversed") && in_period(&j.entry_date, p))
        .collect();
    let ids: HashSet<&str> = live.iter().map(|j| j.id.as_str()).collect();
    fn reversal(j: &Journal) -> Option<&str> {
        j.reversal_of_id.as_deref().filter(|r| !r.is_empty())
    }
    let mut voided: HashSet<&str> = HashSet::new();
    for &j in &live {
        if let Some(r) = reversal(j) {
            if ids.contains(r) {
                voided.insert(j.id.as_str());
                voided.insert(r);
            }
        }
    }

    let mut itc = Amounts::default();
    for &j in &live {
        if voided.contains(j.id.as_str()) {
            continue;
        }
        for l in j.journal_entry_lines.as_deref().unwrap_or(&[]) {
            let Some(&k) = head.get(l.account_id.as_str()) else { continue };
            // Credits (set-off, ITC reversal) and reversals of other periods' entries can't be placed
            // in Table 4(B) or utilisation from the ledger alone.
            if reversal(j).is_some() || paise(l.credit) != 0 {
                errors.push(format!(
                    "ITC not computed: entry {} {} {}; Table 4 reversals and set-offs are not supported yet.",
                    j.entry_number,
                    if reversal(j).is_some() { "reverses an entry from another period on" } else { "credits" },
                    names.get(l.account_id.as_str()).copied().unwrap_or("")
                ));
                continue;
            }
            *itc.head_mut(k) += paise(l.debit);
        }
    }
    (itc, errors)
}

/// Every reason the bill can't stand (same rules as validateBill in src/lib/purchases/bills.ts).
fn validate_bill(b: &PurchaseBill) -> Vec<String> {
    let mut errs = Vec::new();
    let gstin = b.supplier_gstin.trim().to_uppercase();
    if b.supplier_name.trim().is_empty() {
        errs.push("Supplier name is missing".to_string());
    }
    if gstin.is_empty() {
        errs.push("Supplier GSTIN is missing".to_string());
    } else if !is_valid_gstin(&gstin) {
        errs.push(format!("Supplier GSTIN {} is not valid (check digit or format)", gstin));
    }
    if b.bill_number.trim().is_empty() {
        errs.push("Bill number is missing".to_string());
    }
    if !is_iso_date(&b.bill_date) {
        errs.push("Bill date is missing or unreadable".to_string());
    }
    let pos_ok = is_state_code(&b.place_of_supply);
    if !pos_ok {
        errs.push("Place of supply needs a two-digit state code".to_string());
    }
    let (taxable, cgst, sgst, igst, cess) =
        (paise(b.taxable_amount), paise(b.cgst), paise(b.sgst), paise(b.igst), paise(b.cess));
    for (v, label) in [(taxable, "Taxable value"), (cgst, "CGST"), (sgst, "SGST"), (igst, "IGST"), (cess, "Cess")] {
        if v < 0 {
            errs.push(format!("{} cannot be negative", label));
        }
    }
    if taxable == 0 && taxable + cgst + sgst + igst + cess == 0 {
        errs.push("Bill has no value".to_string());
    }
    if !gstin.is_empty() && pos_ok {
        if first2(&gstin) == b.place_of_supply {
            if igst != 0 {
                errs.push("Supplier is in the place-of-supply state, so the bill cannot carry IGST".to_string());
            }
            // Same 2 paise tolerance as issue_sales_invoice (migration 10).
            if (cgst - sgst).abs() > 2 {
                errs.push("CGST and SGST must be equal".to_string());
            }
        } else if cgst != 0 || sgst != 0 {
            errs.push("Supplier is in another state, so the bill carries IGST, not CGST/SGST".to_string());
        }
    }
    if b.itc_eligibility != "eligible" && b.blocked_reason.as_deref().unwrap_or("").trim().is_empty() {
        errs.push("Give the reason ITC is blocked or ineligible".to_string());
    }
    errs
}

struct Itc {
    eligible: Amounts,
    /// Bills only: section 17(5), reported in 4(A)(5) and reversed in 4(B)(1).
    blocked: Option<Amounts>,
    /// Bills only: any other reason (16(4), place of supply), reported in 4(D)(2).
    ineligible: Option<Amounts>,
    errors: Vec<String>,
}

/// Table 4 from the purchase register (layout per Notification 14/2022, Circular 170/02/2022).
// shortcut: ITC is placed in the month of the bill date; bills received or reported in GSTR-2B later
// need the receipt period instead once that date is captured.
fn itc_from_bills(bills: &[&PurchaseBill]) -> Itc {
    let mut errors = Vec::new();
    let (mut eligible, mut blocked, mut ineligible) = (Amounts::default(), Amounts::default(), Amounts::default());
    for b in bills {
        for e in validate_bill(b) {
            errors.push(format!("Purchase bill {} ({}): {}.", b.bill_number, b.supplier_gstin, e));
        }
        let to = match b.itc_eligibility.as_str() {
            "eligible" => &mut eligible,
            "blocked_17_5" => &mut blocked,
            _ => &mut ineligible,
        };
        to.add(&Amounts {
            txval: paise(b.taxable_amount),
            iamt: paise(b.igst),
            camt: paise(b.cgst),
            samt: paise(b.sgst),
            csamt: paise(b.cess),
        });
    }
    Itc { eligible, blocked: Some(blocked), ineligible: Some(ineligible), errors }
}

/// Table 6 set-off of `credit` against `liability`, per head, and the cash still payable.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Table6 {
    pub liability: Amounts,
    pub credit: Amounts,
    pub by_igst: Amounts,
    pub by_cgst: Amounts,
    pub by_sgst: Amounts,
    pub by_cess: Amounts,
    pub cash: Amounts,
    pub carried_forward: Amounts,
}

fn take(left: &mut i64, due: &mut i64, paid: &mut i64, cap: i64) {
    let a = (*left).min(*due).min(cap).max(0);
    *left -= a;
    *due -= a;
    *paid += a;
}

// verify Rule 88A order against CBIC before filing
/// Rule 88A (Section 49(5), 49A): IGST credit is used up first, on IGST, then CGST, then SGST;
/// then CGST credit on CGST then IGST, and SGST credit on SGST then IGST. CGST credit never pays
/// SGST or the reverse; cess credit pays only cess. Circular 98/17/2019 lets IGST credit go to
/// CGST and SGST in any proportion, so it first covers what their own credit can't, which keeps
/// cash to the minimum the rule allows.
pub fn set_off(liability: Amounts, credit: Amounts) -> Table6 {
    let mut due = liability;
    let mut left = credit;
    let (mut by_i, mut by_c, mut by_s, mut by_cess) =
        (Amounts::default(), Amounts::default(), Amounts::default(), Amounts::default());
    let all = i64::MAX;

    take(&mut left.iamt, &mut due.iamt, &mut by_i.iamt, all);
    let short_c = (due.camt - left.camt).max(0);
    let short_s = (due.samt - left.samt).max(0);
    take(&mut left.iamt, &mut due.camt, &mut by_i.camt, short_c);
    take(&mut left.iamt, &mut due.samt, &mut by_i.samt, short_s);
    take(&mut left.iamt, &mut due.camt, &mut by_i.camt, all);
    take(&mut left.iamt, &mut due.samt, &mut by_i.samt, all);

    take(&mut left.camt, &mut due.camt, &mut by_c.camt, all);
    take(&mut left.camt, &mut due.iamt, &mut by_c.iamt, all);
    take(&mut left.samt, &mut due.samt, &mut by_s.samt, all);
    take(&mut left.samt, &mut due.iamt, &mut by_s.iamt, all);
    take(&mut left.csamt, &mut due.csamt, &mut by_cess.csamt, all);

    Table6 {
        liability,
        credit,
        by_igst: by_i,
        by_cgst: by_c,
        by_sgst: by_s,
        by_cess,
        cash: due,
        carried_forward: left,
    }
}

impl Table6 {
    fn to_json(&self) -> Value {
        json!({
            "liability": self.liability.tax_only(),
            "itc": self.credit.tax_only(),
            "paid_by_igst_credit": self.by_igst.tax_only(),
            "paid_by_cgst_credit": self.by_cgst.tax_only(),
            "paid_by_sgst_credit": self.by_sgst.tax_only(),
            "paid_by_cess_credit": self.by_cess.tax_only(),
            "cash": self.cash.tax_only(),
            "credit_carried_forward": self.carried_forward.tax_only(),
        })
    }
}

pub fn build_gstr3b(b: &Books) -> ReturnResult {
    let (mut errors, gstin, checked) = check(b);
    let notes = check_notes(b, &mut errors);

    let (mut osup, mut zero, mut nil_exempt) = (Amounts::default(), Amounts::default(), Amounts::default());
    let mut eco = Amounts::default();
    let mut unreg: Vec<(String, Amounts)> = Vec::new();
    // Net of the notes dated in the period: a credit note reduces its original's row, a debit note adds.
    let signed = checked
        .iter()
        .map(|c| (c, 1))
        .chain(notes.iter().map(|(c, n)| (c, if n.note_type == "credit" { -1 } else { 1 })));
    for (c, sign) in signed {
        let total = c.total.scaled(sign);
        if zero_rated(c) {
            zero.add(&total);
        } else if exempt(c) {
            nil_exempt.add(&total);
        } else {
            osup.add(&total);
            // 3.1.1 is information only; marketplace goods stay in 3.1(a) (s.9(5) covers notified services).
            if c.inv.sales_channel.as_deref().map_or(false, |ch| ch != "direct") {
                eco.add(&total);
            }
            if c.inv.supply_type == "inter_state" && c.ctin.is_none() {
                bucket(&mut unreg, c.pos.clone()).add(&total);
            }
        }
    }
    let negative = [
        ("3.1(a)", osup.negative()),
        ("3.1(b)", zero.negative()),
        ("3.2", unreg.iter().any(|(_, a)| a.negative())),
    ];
    for (label, neg) in negative {
        if neg {
            errors.push(format!(
                "{} is negative after this period's credit notes; GSTN does not accept negative values.",
                label
            ));
        }
    }

    let valid_period = is_ret_period(&b.ret_period);
    let bills: Vec<&PurchaseBill> = if valid_period {
        b.purchase_bills.iter().filter(|x| in_period(&x.bill_date, &b.ret_period)).collect()
    } else {
        Vec::new()
    };
    let itc = if !valid_period {
        Itc { eligible: Amounts::default(), blocked: None, ineligible: None, errors: Vec::new() }
    } else if !bills.is_empty() {
        itc_from_bills(&bills)
    } else {
        let (eligible, errors) = compute_itc(&b.ret_period, &b.accounts, &b.journals);
        Itc { eligible, blocked: None, ineligible: None, errors }
    };
    errors.extend(itc.errors.iter().cloned());
    let itc_ok = itc.errors.is_empty();
    let shown = |a: &Amounts| if itc_ok { Some(a.rupees()) } else { None };

    let mut summary = vec![
        SummaryRow { section: "3.1(a) Outward taxable".into(), amounts: Some(osup.rupees()) },
        SummaryRow { section: "3.1(b) Zero rated (exports)".into(), amounts: Some(zero.rupees()) },
        SummaryRow { section: "3.1(c) Nil rated / exempt".into(), amounts: Some(nil_exempt.rupees()) },
        // Information only, already inside 3.1(a) and not in the JSON: Table 3.1.1 covers supplies on
        // which the operator pays tax u/s 9(5), which applies only to notified services (transport,
        // accommodation, restaurant, housekeeping...). Goods sold on a marketplace stay in 3.1(a).
        SummaryRow { section: "3.1.1 Through e-commerce operators (information)".into(), amounts: Some(eco.rupees()) },
        SummaryRow {
            section: if bills.is_empty() {
                "4 Eligible ITC (Input GST ledgers)".into()
            } else {
                "4(A)(5) Eligible ITC (purchase bills)".into()
            },
            amounts: shown(&itc.eligible),
        },
    ];
    if let (Some(blocked), Some(ineligible)) = (&itc.blocked, &itc.ineligible) {
        summary.push(SummaryRow { section: "4(B)(1) Reversed: blocked u/s 17(5)".into(), amounts: shown(blocked) });
        summary.push(SummaryRow {
            section: "4(D)(2) Ineligible (16(4) / place of supply)".into(),
            amounts: shown(ineligible),
        });
    }
    if !errors.is_empty() {
        return ReturnResult { json: None, errors, summary, table6: None };
    }

    // 4(A) carries the 17(5) credit too; 4(B)(1) takes it back out, so 4(C) net equals the eligible ITC.
    let mut available = itc.eligible;
    if let Some(blocked) = &itc.blocked {
        available.add(blocked);
    }
    let mut itc_elg = json!({
        "itc_avl": [merge(json!({ "ty": "OTH" }), available.tax_only())],
        "itc_net": itc.eligible.tax_only(),
    });
    if let Some(blocked) = &itc.blocked {
        itc_elg["itc_rev"] = json!([merge(json!({ "ty": "RUL" }), blocked.tax_only())]);
    }
    if let Some(ineligible) = &itc.ineligible {
        itc_elg["itc_inelg"] = json!([merge(json!({ "ty": "OTH" }), ineligible.tax_only())]);
    }
    let json = json!({
        "gstin": gstin,
        "ret_period": b.ret_period,
        "sup_details": {
            "osup_det": osup.rupees(),
            "osup_zero": { "txval": rupee(zero.txval), "iamt": rupee(zero.iamt), "csamt": rupee(zero.csamt) },
            "osup_nil_exmp": { "txval": rupee(nil_exempt.txval) },
        },
        "inter_sup": {
            "unreg_details": unreg.iter().map(|(pos, a)| json!({
                "pos": pos, "txval": rupee(a.txval), "iamt": rupee(a.iamt)
            })).collect::<Vec<_>>(),
        },
        "itc_elg": itc_elg,
    });

    // shortcut: only this period's ITC is set off; a credit-ledger balance brought forward from
    // earlier months is not known without the portal ledger (needs a GSP or a user-entered opening).
    let liability = Amounts {
        txval: 0,
        iamt: osup.iamt + zero.iamt,
        camt: osup.camt,
        samt: osup.samt,
        csamt: osup.csamt + zero.csamt,
    };
    let table6 = set_off(liability, itc.eligible).to_json();
    ReturnResult { json: Some(json), errors, summary, table6: Some(table6) }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fixture() -> Value {
        serde_json::from_str(include_str!("../../tests/fixtures/gst_returns.json")).unwrap()
    }
    fn books(f: &Value) -> Books {
        serde_json::from_value(f.clone()).unwrap()
    }
    fn amounts(i: i64, c: i64, s: i64, cess: i64) -> Amounts {
        Amounts { txval: 0, iamt: i, camt: c, samt: s, csamt: cess }
    }

    #[test]
    fn gstr1_matches_the_shared_fixture() {
        let f = fixture();
        let r = build_gstr1(&books(&f));
        assert_eq!(r.errors, Vec::<String>::new());
        assert_eq!(r.json.unwrap(), f["expected"]["gstr1"]);
        // Cancelled, out-of-period and draft invoices are not in the figures.
        assert_eq!(r.summary[0].amounts.as_ref().unwrap()["txval"], json!(1700));
    }

    #[test]
    fn gstr1_blocks_without_company_gstin() {
        let mut f = fixture();
        f["gstin"] = Value::Null;
        let r = build_gstr1(&books(&f));
        assert!(r.json.is_none());
        assert!(r.errors[0].contains("Company GSTIN is missing"));
    }

    #[test]
    fn gstr1_flags_intra_state_invoice_with_igst() {
        let mut f = fixture();
        let bad = f["cases"]["intra_state_with_igst"].clone();
        f["invoices"].as_array_mut().unwrap().push(bad);
        let r = build_gstr1(&books(&f));
        assert!(r.json.is_none());
        assert!(r.errors.contains(&"Invoice INV-007: is intra-state but carries IGST.".to_string()));
    }

    #[test]
    fn gstr1_flags_header_tax_not_equal_to_lines() {
        let mut f = fixture();
        let mut bad = f["invoices"][2].clone();
        bad["invoice_number"] = json!("INV-008");
        bad["cgst_amount"] = json!(27);
        f["invoices"] = json!([bad]);
        let r = build_gstr1(&books(&f));
        assert!(r
            .errors
            .contains(&"Invoice INV-008: CGST ₹27.00 does not equal the sum of its lines ₹27.01.".to_string()));
    }

    #[test]
    fn gstr3b_matches_the_shared_fixture() {
        let f = fixture();
        let r = build_gstr3b(&books(&f));
        assert_eq!(r.errors, Vec::<String>::new());
        assert_eq!(r.json.unwrap(), f["expected"]["gstr3b"]);
    }

    #[test]
    fn gstr3b_reports_marketplace_sales_under_3_1_1_as_information_only() {
        let f = fixture();
        let r = build_gstr3b(&books(&f));
        let eco = r.summary.iter().find(|s| s.section.starts_with("3.1.1")).unwrap();
        assert_eq!(eco.amounts.as_ref().unwrap(), &f["expected"]["gstr3b_eco"]);
        // Still inside 3.1(a), and nothing extra in the uploaded JSON.
        assert_eq!(r.json.unwrap(), f["expected"]["gstr3b"]);
    }

    #[test]
    fn gstr3b_blocks_when_an_input_ledger_is_credited() {
        let mut f = fixture();
        let set_off_entry = f["cases"]["set_off_journal"].clone();
        f["journals"].as_array_mut().unwrap().push(set_off_entry);
        let r = build_gstr3b(&books(&f));
        assert!(r.json.is_none());
        assert!(r.table6.is_none());
        assert!(r.summary.iter().find(|s| s.section.starts_with('4')).unwrap().amounts.is_none());
        assert!(r.errors[0].starts_with("ITC not computed: entry J9 credits Input CGST 9%"));
    }

    #[test]
    fn gstr3b_takes_table4_from_purchase_bills() {
        let mut f = fixture();
        let set_off_entry = f["cases"]["set_off_journal"].clone();
        f["journals"].as_array_mut().unwrap().push(set_off_entry);
        f["purchase_bills"] = f["cases"]["purchase_bills"].clone();
        let r = build_gstr3b(&books(&f));
        assert_eq!(r.errors, Vec::<String>::new());
        assert_eq!(r.json.unwrap()["itc_elg"], f["expected"]["gstr3b_bills_itc_elg"]);
        assert!(r.summary.iter().any(|s| s.section == "4(B)(1) Reversed: blocked u/s 17(5)"));
    }

    #[test]
    fn gstr3b_falls_back_to_ledgers_without_bills_in_period() {
        let mut f = fixture();
        f["purchase_bills"] = json!([f["cases"]["purchase_bills"][4].clone()]);
        let r = build_gstr3b(&books(&f));
        assert_eq!(r.json.unwrap()["itc_elg"], f["expected"]["gstr3b"]["itc_elg"]);
    }

    #[test]
    fn gstr3b_blocks_on_invalid_purchase_bill() {
        let mut f = fixture();
        f["purchase_bills"] = json!([f["cases"]["bill_missing_reason"].clone()]);
        let r = build_gstr3b(&books(&f));
        assert!(r.json.is_none());
        assert!(r.errors.contains(
            &"Purchase bill B-1 (27AABCS1429B1ZU): Give the reason ITC is blocked or ineligible.".to_string()
        ));
    }

    #[test]
    fn gstr3b_blocks_without_company_gstin() {
        let mut f = fixture();
        f["gstin"] = json!("");
        let r = build_gstr3b(&books(&f));
        assert!(r.json.is_none());
        assert!(r.errors[0].contains("Company GSTIN is missing"));
    }

    #[test]
    fn gstr3b_table6_sets_off_period_itc() {
        // Liability I 1800.02, C 174.01, S 174.01; ITC I 180.55, C 90, S 90.
        let r = build_gstr3b(&books(&fixture()));
        let t = r.table6.unwrap();
        assert_eq!(t["paid_by_igst_credit"], json!({ "iamt": 180.55, "camt": 0, "samt": 0, "csamt": 0 }));
        assert_eq!(t["paid_by_cgst_credit"], json!({ "iamt": 0, "camt": 90, "samt": 0, "csamt": 0 }));
        assert_eq!(t["paid_by_sgst_credit"], json!({ "iamt": 0, "camt": 0, "samt": 90, "csamt": 0 }));
        assert_eq!(t["cash"], json!({ "iamt": 1619.47, "camt": 84.01, "samt": 84.01, "csamt": 0 }));
        assert_eq!(t["credit_carried_forward"], json!({ "iamt": 0, "camt": 0, "samt": 0, "csamt": 0 }));
    }

    #[test]
    fn rule_88a_igst_credit_first_covers_what_cgst_sgst_credit_cannot() {
        // Circular 98/17/2019 style: IGST 1000 / CGST 200 / SGST 200 credit, IGST 400 / CGST 500 / SGST 500 due.
        let t = set_off(amounts(400, 500, 500, 0), amounts(1000, 200, 200, 0));
        assert_eq!(t.by_igst, amounts(400, 300, 300, 0));
        assert_eq!(t.by_cgst, amounts(0, 200, 0, 0));
        assert_eq!(t.by_sgst, amounts(0, 0, 200, 0));
        assert_eq!(t.cash, Amounts::default());
        assert_eq!(t.carried_forward, Amounts::default());
    }

    #[test]
    fn rule_88a_igst_credit_is_used_up_before_cgst_sgst_credit() {
        // IGST credit beyond the shortfall still goes to CGST, then SGST; the displaced CGST credit carries forward.
        let t = set_off(amounts(0, 300, 100, 0), amounts(500, 300, 100, 0));
        assert_eq!(t.by_igst, amounts(0, 300, 100, 0));
        assert_eq!(t.cash, Amounts::default());
        assert_eq!(t.carried_forward, amounts(100, 300, 100, 0));
    }

    #[test]
    fn rule_88a_cgst_and_sgst_credit_pay_igst_but_never_each_other() {
        let t = set_off(amounts(1000, 100, 100, 50), amounts(300, 500, 50, 20));
        assert_eq!(t.by_igst, amounts(300, 0, 0, 0));
        assert_eq!(t.by_cgst, amounts(400, 100, 0, 0));
        assert_eq!(t.by_sgst, amounts(0, 0, 50, 0));
        assert_eq!(t.by_cess, amounts(0, 0, 0, 20));
        assert_eq!(t.cash, amounts(300, 0, 50, 30));
        assert_eq!(t.carried_forward, Amounts::default());
    }

    /// The exports, SEZ supplies and notes from the fixture, optionally on top of its base invoices.
    fn zero_rated_books(f: &Value, with_base_invoices: bool) -> Books {
        let mut v = f.clone();
        let mut invoices = if with_base_invoices { f["invoices"].as_array().unwrap().clone() } else { Vec::new() };
        invoices.extend(f["cases"]["zero_rated_invoices"].as_array().unwrap().iter().cloned());
        v["invoices"] = json!(invoices);
        v["notes"] = f["cases"]["notes"].clone();
        books(&v)
    }

    #[test]
    fn gstr1_reports_exports_sez_and_notes() {
        let f = fixture();
        let r = build_gstr1(&zero_rated_books(&f, false));
        assert_eq!(r.errors, Vec::<String>::new());
        let section = |s: &str| r.summary.iter().find(|x| x.section == s).unwrap().amounts.clone().unwrap();
        assert_eq!(section("SEZ supplies (6B)")["txval"], json!(2800));
        // DN-001 (+1000, B2CL) and CN-003 (-200, export with payment).
        assert_eq!(section("Notes, unregistered (9B CDNUR)")["txval"], json!(800));
        assert_eq!(r.json.unwrap(), f["expected"]["gstr1_zero_rated_and_notes"]);
    }

    #[test]
    fn gstr3b_nets_notes_and_reports_zero_rated_supplies() {
        let f = fixture();
        let r = build_gstr3b(&zero_rated_books(&f, true));
        assert_eq!(r.errors, Vec::<String>::new());
        let j = r.json.unwrap();
        let e = &f["expected"]["gstr3b_zero_rated_and_notes_sup"];
        assert_eq!(j["sup_details"], e["sup_details"]);
        assert_eq!(j["inter_sup"], e["inter_sup"]);
    }

    #[test]
    fn gstr3b_blocks_when_credit_notes_exceed_the_period() {
        let mut f = fixture();
        f["invoices"] = json!([]);
        f["notes"] = json!([f["cases"]["notes"][2].clone()]);
        let r = build_gstr3b(&books(&f));
        assert!(r.json.is_none());
        assert!(r.errors.contains(
            &"3.1(a) is negative after this period's credit notes; GSTN does not accept negative values.".to_string()
        ));
    }

    #[test]
    fn sez_supply_needs_customer_gstin() {
        let mut f = fixture();
        let mut sez = f["cases"]["zero_rated_invoices"][2].clone();
        sez["parties"] = json!({ "gstin": null });
        f["invoices"] = json!([sez]);
        let r = build_gstr1(&books(&f));
        assert!(r.json.is_none());
        assert!(r.errors.contains(&"Invoice SEZ-001: is an SEZ supply but the customer has no GSTIN.".to_string()));
    }

    #[test]
    fn gstin_check_digit() {
        assert!(is_valid_gstin("27AAPFU0939F1ZV"));
        assert!(!is_valid_gstin("27AAPFU0939F1ZA"));
        assert!(!is_valid_gstin("27AAPFU0939F1Z"));
    }
}
