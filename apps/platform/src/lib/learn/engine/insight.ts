/**
 * Read-side endpoints: financial reports (each visit recorded once as report.viewed), GST
 * returns built from the demo books, the Deku Consultant answering only from those books, and
 * the external services (GSP, IRN/EWB, KYC, payments), which are simulated and say so.
 */
import { reportName } from "../activity";
import { buildGstr1, buildGstr3b } from "@/lib/gst/returns";
import { getDemoPlanConfig } from "../demo-plans";
import { stockValue } from "./inventory";
import { booksToday, fail, newId, r2 } from "./books";
import { save, type Handler, type Req } from "./context";
import { assertRole } from "./rbac";
import {
  accountBalances,
  arApAgeing,
  balanceSheet,
  budgetVariance,
  cashFlow,
  expenseBreakdown,
  fpaMetrics,
  generalLedger,
  kpis,
  partyAgeing,
  profitAndLoss,
  trialBalance,
} from "./reports";

type ReportName = "trial-balance" | "profit-loss" | "balance-sheet" | "cash-flow" | "general-ledger" | "debtors" | "creditors" | "fpa" | "operating-expenses" | "gstr1" | "gstr3b";

/** report.viewed, but never twice in a row for the same report (screens often fetch twice). */
function viewed(req: Req, report: ReportName) {
  const last = req.ctx.getDataset().activity.at(-1);
  if (last?.type === "report.viewed" && last.refs?.report === report) return;
  req.ctx.record("report.viewed", `Viewed ${reportName(report)}`, { report });
}

/** Start of the books' financial year (April). */
const fy = (req: Req) => {
  const t = booksToday(req.ds);
  return `${Number(t.slice(0, 4)) - (t.slice(5, 7) < "04" ? 1 : 0)}-04-01`;
};

function inr(n: number) {
  return `₹${r2(n).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

/** The consultant's figures: every number comes from the same report functions the screens use. */
function consultantFacts(req: Req) {
  const ds = req.ds;
  const to = booksToday(ds);
  const from = fy(req);
  const k = kpis(ds, from, to);
  const f = fpaMetrics(ds, from, to);
  const debtors = partyAgeing(ds, "receivable", to);
  const creditors = partyAgeing(ds, "payable", to);
  const pl = profitAndLoss(ds, { from, to });
  return { from, to, k, f, debtors, creditors, pl, stock: stockValue(ds, to) };
}

function answer(req: Req, question: string) {
  const { from, to, k, f, debtors, creditors, pl, stock } = consultantFacts(req);
  const q = question.toLowerCase();
  const name = req.ds.org.name;
  const sources: string[] = [];
  const parts: string[] = [];
  if (/receiv|debtor|owes? us|collect|dso|customer|outstanding/.test(q)) {
    sources.push("Debtors ageing (reports/party-ageing)");
    parts.push(
      `Receivables stand at ${inr(k.debtors ?? 0)} across ${k.debtors_count} customer(s)${k.dso_days != null ? `, about ${k.dso_days} days of sales (DSO)` : ""}.` +
        (debtors[0] ? ` Largest: ${debtors[0].party_name} owes ${inr(Number(debtors[0].balance))}, oldest item ${debtors[0].oldest_age_days ?? 0} days.` : "")
    );
  }
  if (/payab|creditor|supplier|vendor|we owe|dpo/.test(q)) {
    sources.push("Creditors ageing (reports/party-ageing)");
    parts.push(`Payables stand at ${inr(k.creditors ?? 0)} to ${k.creditors_count} supplier(s)${k.dpo_days != null ? `, about ${k.dpo_days} days of purchases (DPO)` : ""}.` + (creditors[0] ? ` Largest: ${creditors[0].party_name}, ${inr(Number(creditors[0].balance))}.` : ""));
  }
  if (/cash|bank|runway|liquid|burn/.test(q)) {
    sources.push("Cash flow and FP&A metrics");
    parts.push(`Cash and bank total ${inr(k.liquid ?? 0)}.` + (f.treasury_and_runway.cash_runway_months != null ? ` At the last six months' operating spend that is ${f.treasury_and_runway.cash_runway_months} months of runway.` : " There isn't six months of spending history to estimate runway."));
  }
  if (/stock|inventory/.test(q)) {
    sources.push("Stock summary (inventory/summary)");
    parts.push(`Stock on hand is valued at ${inr(stock)} at FIFO cost.`);
  }
  if (/gst|tax/.test(q)) {
    sources.push("Trial balance: output and input GST ledgers");
    parts.push(`Output GST payable ${inr(k.gst_output ?? 0)}, input tax credit ${inr(k.gst_input ?? 0)}, net ${inr((k.gst_output ?? 0) - (k.gst_input ?? 0))}.`);
  }
  if (!parts.length || /revenue|sales|profit|expense|margin|perform|how are we|summary/.test(q)) {
    sources.push(`Profit & loss ${from} to ${to}`);
    const top = pl.filter((r) => r.account_type === "expense" && !["5010", "5015"].includes(r.account_code)).sort((a, b) => b.net_amount - a.net_amount)[0];
    parts.unshift(
      `${name} from ${from} to ${to}: revenue ${inr(f.profitability.total_revenue)}, cost of goods ${inr(f.profitability.cogs)}, operating expenses ${inr(f.profitability.opex)}, net profit ${inr(f.profitability.net_profit)}` +
        (f.profitability.net_margin_pct != null ? ` (${f.profitability.net_margin_pct}% margin).` : ".") +
        (top ? ` Biggest operating expense: ${top.account_name}, ${inr(top.net_amount)}.` : "")
    );
  }
  return {
    response: `${parts.join(" ")}\n\nSources: ${[...new Set(sources)].join("; ")}. This answer is computed from the demo books by fixed rules; no AI model was called.`,
    sources,
  };
}

const SIMULATED = "Simulated in the public demo: no external service is connected and nothing is sent.";

export const insightHandler: Handler = (req: Req) => {
  const { sub, method, query, ctx, body } = req;
  const ds = req.ds;
  const to = query.get("to") || query.get("end_date") || null;
  const from = query.get("from") || query.get("start_date") || null;

  if (method === "GET") {
    switch (sub) {
      case "/reports/account-balances":
        return { success: true, data: accountBalances(ds) };
      case "/reports/trial-balance":
        viewed(req, "trial-balance");
        return { success: true, data: trialBalance(ds, { from, to }) };
      case "/reports/profit-and-loss":
        viewed(req, "profit-loss");
        return { success: true, data: profitAndLoss(ds, { from, to }) };
      case "/reports/balance-sheet":
        viewed(req, "balance-sheet");
        return { success: true, data: balanceSheet(ds, query.get("as_of")) };
      case "/reports/general-ledger":
        viewed(req, "general-ledger");
        return { success: true, data: generalLedger(ds, query.get("account_id")) };
      case "/reports/cash-flow":
        viewed(req, "cash-flow");
        return { success: true, data: cashFlow(ds, from ?? undefined, to ?? undefined) };
      case "/reports/party-ageing": {
        const side = query.get("side") === "payable" ? "payable" : query.get("side") === "receivable" ? "receivable" : fail("side must be receivable or payable");
        viewed(req, side === "receivable" ? "debtors" : "creditors");
        return { success: true, data: partyAgeing(ds, side, query.get("as_of") || undefined) };
      }
      case "/reports/kpis":
        return { success: true, data: kpis(ds, from ?? fy(req), to ?? booksToday(ds)) };
      case "/reports/expenses":
        viewed(req, "operating-expenses");
        return { success: true, data: expenseBreakdown(ds, from ?? fy(req), to ?? booksToday(ds)) };
      case "/reports/fpa-metrics":
        viewed(req, "fpa");
        return { success: true, data: fpaMetrics(ds, from, to ?? undefined) };
      case "/reports/budget-variance":
        viewed(req, "fpa");
        return { success: true, data: budgetVariance(ds) };
      case "/reports/ar-ap-aging":
        return { success: true, data: arApAgeing(ds) };
      case "/consultant/context": {
        const { k, f } = consultantFacts(req);
        return {
          success: true,
          context: { company: ds.org.name, as_of: booksToday(ds), source: "demo books", ai_model: null, fpa_metrics: f, ar_ap_aging: arApAgeing(ds), kpis: k },
        };
      }
    }
  }

  const gst = sub.match(/^\/gst\/([^/]+)\/(gstr1|gstr3b)(\/record|\/filed)?$/);
  if (gst) {
    const [, period, type, action] = gst;
    if (!action && method === "GET") {
      if (!getDemoPlanConfig(req.plan).gstnJsonEnabled)
        ctx.notifyAction("PRO plan for offline JSON", "The GO plan shows GST summaries only. Switch to PRO or Enterprise in the demo bar to preview GSTR-1 and GSTR-3B JSON.", "warning");
      viewed(req, type as ReportName);
      const invoices = ds.invoices.map((inv) => ({ ...inv, cgst_amount: inv.cgst_amount ?? 0, sgst_amount: inv.sgst_amount ?? 0, igst_amount: inv.igst_amount ?? 0, cess_amount: inv.cess_amount ?? 0 }));
      const data =
        type === "gstr1"
          ? buildGstr1({ gstin: ds.org.gstin, retPeriod: period, invoices })
          : buildGstr3b({ gstin: ds.org.gstin, retPeriod: period, invoices, accounts: ds.accounts, journals: ds.journals });
      return { success: true, data };
    }
    // Recording that a return was prepared or filed is bookkeeping in Deku; the filing itself happens on the GST portal.
    if (action === "/record" && method === "POST") {
      assertRole(ctx, "gstRecord", "Recording a GST return");
      const row = { id: newId(ds, "gst"), period, return_type: type as "gstr1" | "gstr3b", status: "recorded" as const, arn: null, recorded_at: new Date().toISOString(), filed_at: null };
      save(req, { ...ds, gstFilings: [row, ...ds.gstFilings.filter((g) => !(g.period === period && g.return_type === type))] });
      ctx.record("settings.updated", `Recorded ${type.toUpperCase()} for ${period} as prepared`, { fields: `gst_${type}_${period}` });
      return { success: true, simulated: true, message: "Recorded in this demo company only. Nothing was filed with GSTN.", data: [row] };
    }
    if (action === "/filed" && method === "PATCH") {
      assertRole(ctx, "gstRecord", "Marking a GST return filed");
      const arn = String(req.body.arn ?? "").trim().toUpperCase() || fail("Enter the ARN the GST portal gave you");
      const prev = ds.gstFilings.find((g) => g.period === period && g.return_type === type) ?? fail(`Record the ${type.toUpperCase()} for ${period} first`);
      const row = { ...prev, status: "filed" as const, arn, filed_at: new Date().toISOString() };
      save(req, { ...ds, gstFilings: ds.gstFilings.map((g) => (g.id === prev.id ? row : g)) });
      ctx.notifyAction("Filing recorded, not submitted", "The demo stored the ARN you typed. Nothing was sent to the GST portal.", "info");
      ctx.record("settings.updated", `Marked ${type.toUpperCase()} for ${period} filed (ARN typed by the visitor)`, { fields: `gst_${type}_${period}_filed` });
      return { success: true, simulated: true, message: "Simulated: the ARN was stored in the demo; nothing was filed.", data: [row] };
    }
  }

  if (sub === "/consultant/chat" && method === "POST") {
    const question = String(req.body.message ?? "").trim() || fail("Ask a question about the company's books");
    const a = answer(req, question);
    ctx.record("consultant.asked", question.slice(0, 120), { question: question.slice(0, 200) });
    return {
      success: true,
      response: a.response,
      model_used: "None: rule-based summary of the demo books (no AI model is called in the public demo)",
      context_snapshot: { company: ds.org.name, as_of: booksToday(ds), sources: a.sources },
      suggested_followups: ["Who owes us the most?", "How much cash runway do we have?", "What is our GST position?"],
    };
  }

  // ---- external services: simulated, never live ----
  if (sub.startsWith("/gsp/") || sub.startsWith("/kyc/") || sub.startsWith("/payments/") || /^\/invoices\/[^/]+\/payment-link$/.test(sub)) {
    if (method === "GET") {
      if (sub === "/kyc/status") return { success: true, simulated: true, data: { configured: false, sandbox: true, reason: SIMULATED, trust: { trust_level: "none" }, verifications: [] } };
      if (sub === "/payments/status") return { success: true, simulated: true, data: { configured: false, reason: SIMULATED, connection: null } };
      if (sub.startsWith("/payments/")) return { success: true, simulated: true, data: [] };
      if (sub === "/gsp/status") return { success: true, simulated: true, data: { configured: false, sandbox: true, reason: SIMULATED, connection: null } };
      if (sub.startsWith("/gsp/invoices/")) return { success: true, simulated: true, data: { e_invoices: [], eway_bills: [] } };
      return { success: true, simulated: true, data: [] };
    }
    const what = sub.includes("payment-link") || sub.startsWith("/payments/")
      ? "Payment links and payment gateway connections"
      : sub.startsWith("/kyc/")
        ? "KYC verification (PAN, GSTIN, Udyam, DigiLocker)"
        : "GST portal actions (IRN, e-way bill, OTP and return filing)";
    ctx.notifyAction("Simulated external action", `${what}: ${SIMULATED}`, "info");
    fail(`${what} are simulated in the demo: nothing was sent and no live result exists.`, 501, "simulated_external_action");
  }
  return undefined;
};
