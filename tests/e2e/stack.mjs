// End-to-end checks against a running stack, through the same frontend proxy the browser uses.
// Usage: node tests/e2e/stack.mjs fresh|persisted|demo   (env: E2E_BASE, E2E_BACKEND, E2E_STATE, E2E_CRON_SECRET)
// Plan §7, §8 and §10. Records created here use throwaway addresses and a fictional company.
import { readFileSync, writeFileSync } from "node:fs";

const BASE = process.env.E2E_BASE ?? "http://localhost:3000";
const BACKEND = process.env.E2E_BACKEND ?? "http://localhost:8080";
const STATE = process.env.E2E_STATE ?? "e2e-state.json";
const CRON = process.env.E2E_CRON_SECRET ?? "dev-only-cron-secret";
const PASSWORD = "e2e-Only-Passw0rd!";

const results = [];
function check(id, name, ok, detail = "") {
  results.push({ id, name, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${id} ${name}${!ok && detail ? ` :: ${detail}` : ""}`);
  if (!ok && process.env.GITHUB_ACTIONS) console.log(`::error::${id} ${name} ${String(detail).slice(0, 300)}`);
}

class Session {
  cookies = {};
  async req(method, path, body, base = BASE) {
    const headers = { Cookie: Object.entries(this.cookies).map(([k, v]) => `${k}=${v}`).join("; ") };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const res = await fetch(base + path, {
      method,
      headers,
      redirect: "manual",
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    this.setCookies = res.headers.getSetCookie();
    for (const c of this.setCookies) {
      const [pair] = c.split(";");
      const i = pair.indexOf("=");
      const value = pair.slice(i + 1);
      if (value) this.cookies[pair.slice(0, i)] = value;
      else delete this.cookies[pair.slice(0, i)];
    }
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {}
    return { status: res.status, json, text, location: res.headers.get("location") };
  }
  api(method, path, body) {
    return this.req(method, `/api/backend/api/v1${path}`, body);
  }
}

async function signup(tag) {
  const s = new Session();
  const email = `e2e-${tag}-${Date.now()}@example.com`;
  const r = await s.req("POST", "/api/auth/signup", { email, password: PASSWORD, full_name: `E2E ${tag}` });
  return { s, email, r };
}

async function login(email) {
  const s = new Session();
  const r = await s.req("POST", "/api/auth/login", { email, password: PASSWORD });
  return { s, r };
}

function fiscalYear(today = new Date()) {
  const y = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
  return { name: `FY ${y}-${y + 1}`, start_date: `${y}-04-01`, end_date: `${y + 1}-03-31` };
}

function tbTotals(rows) {
  const round = (n) => Math.round(n * 100) / 100;
  return {
    debit: round(rows.reduce((a, r) => a + Number(r.total_debit || 0), 0)),
    credit: round(rows.reduce((a, r) => a + Number(r.total_credit || 0), 0)),
  };
}

async function fresh() {
  // D-07, D-08
  const health = await fetch(`${BACKEND}/health`);
  check("D-07", "backend /health", health.ok, health.status);
  const ready = await fetch(`${BACKEND}/ready`);
  check("D-06", "backend reaches PostgREST (/ready)", ready.ok, ready.status);
  const landing = await fetch(`${BASE}/login`);
  check("D-08", "frontend serves /login", landing.ok, landing.status);

  // Plan §8: unauthenticated and bad credentials
  const anon = new Session();
  let r = await anon.api("GET", "/organisations");
  check("A-01", "no session: API returns 401", r.status === 401, r.status);
  r = await anon.req("GET", "/gateway");
  check("A-02", "no session: page redirects to login", r.status >= 300 && r.status < 400 && /\/login/.test(r.location ?? ""), `${r.status} ${r.location}`);
  const garbage = new Session();
  garbage.cookies.deku_at = "not.a.jwt";
  r = await garbage.api("GET", "/organisations");
  check("A-03", "malformed token: API returns 401", r.status === 401, r.status);
  const bad = new Session();
  r = await bad.req("POST", "/api/auth/login", { email: "nobody@example.com", password: PASSWORD });
  check("A-04", "bad login rejected", r.status === 401, r.status);

  // W-03: clean onboarding, no demo data
  const owner = await signup("owner");
  check("O-01", "signup succeeds", owner.r.status === 200, `${owner.r.status} ${owner.r.text}`);
  const cookieFlags = owner.s.setCookies.join("\n");
  check("A-05", "session cookies are HttpOnly and SameSite=Lax", /deku_at=[^\n]*HttpOnly/i.test(cookieFlags) && /deku_rt=[^\n]*HttpOnly/i.test(cookieFlags) && /SameSite=Lax/i.test(cookieFlags), cookieFlags.replace(/=[^;]+/g, "=…"));
  check("A-06", "signup response has no tokens", !/access_token|refresh_token/.test(owner.r.text));
  r = await owner.s.api("GET", "/organisations");
  check("O-02", "new user sees no companies (no demo leakage)", r.status === 200 && r.json?.data?.length === 0, r.text);

  const slug = `e2e-${Date.now()}`;
  r = await owner.s.api("POST", "/organisations", { name: "E2E Test Traders", slug });
  check("O-03", "company created", r.status === 200 && !!r.json?.organisation_id, `${r.status} ${r.text}`);
  const org = r.json?.organisation_id;
  if (!org) return false;

  r = await owner.s.api("POST", `/organisations/${org}/accounts/seed`);
  check("O-04", "chart of accounts seeded", r.status === 200, `${r.status} ${r.text}`);
  r = await owner.s.api("GET", `/organisations/${org}/accounts`);
  const accounts = r.json?.data ?? [];
  const seededCount = accounts.length;
  check("O-05", "default chart has accounts", seededCount > 10, seededCount);
  await owner.s.api("POST", `/organisations/${org}/accounts/seed`);
  r = await owner.s.api("GET", `/organisations/${org}/accounts`);
  check("O-06", "seeding again adds no accounts", (r.json?.data ?? []).length === seededCount, (r.json?.data ?? []).length);

  const fy = fiscalYear();
  r = await owner.s.api("POST", `/organisations/${org}/fiscal-periods`, fy);
  check("O-07", "fiscal period created", r.status === 200, `${r.status} ${r.text}`);
  r = await owner.s.api("GET", `/organisations/${org}/fiscal-periods`);
  const period = r.json?.data?.[0]?.id;

  const byCode = (code) => accounts.find((a) => a.code === code)?.id;
  const bank = byCode("1020");
  const charges = byCode("5090");
  check("W-00", "accounts 1020 and 5090 exist", !!bank && !!charges);
  const date = new Date().toISOString().slice(0, 10);
  const voucher = (number, debit, credit) => ({
    fiscal_period_id: period,
    entry_number: number,
    entry_date: date,
    narration: `E2E ${number}`,
    lines: [
      { line_number: 1, account_id: charges, debit, credit: 0 },
      { line_number: 2, account_id: bank, debit: 0, credit },
    ],
  });
  const journalId = (res) => res.json?.entry?.[0]?.id;

  // Unbalanced: must not reach the ledger, whichever step refuses it.
  r = await owner.s.api("POST", `/organisations/${org}/journals`, voucher("E2E/BAD/1", 1000, 900));
  if (r.status === 200) {
    check("W-01a0", "create response has the entry id", !!journalId(r), r.text.slice(0, 200));
    const p = await owner.s.api("POST", `/organisations/${org}/journals/${journalId(r)}/post`);
    check("W-01a", "unbalanced voucher can't be posted", p.status !== 200, p.status);
  } else {
    check("W-01a", "unbalanced voucher refused at creation", true);
  }

  r = await owner.s.api("GET", `/organisations/${org}/reports/trial-balance`);
  check("W-01a1", "unposted vouchers stay out of the trial balance", tbTotals(r.json?.data ?? []).debit === 0, JSON.stringify(tbTotals(r.json?.data ?? [])));

  // Critical accounting proof (plan §10)
  r = await owner.s.api("POST", `/organisations/${org}/journals`, voucher("E2E/1", 1234.5, 1234.5));
  check("W-01b", "balanced voucher saved as draft", r.status === 200 && !!journalId(r), `${r.status} ${r.text}`);
  const entry = journalId(r);
  r = await owner.s.api("POST", `/organisations/${org}/journals/${entry}/post`);
  check("W-01c", "voucher posted", r.status === 200, `${r.status} ${r.text}`);
  r = await owner.s.api("POST", `/organisations/${org}/journals`, voucher("E2E/1", 1234.5, 1234.5));
  check("W-01d", "duplicate voucher number refused", r.status !== 200, r.status);
  r = await owner.s.api("GET", `/organisations/${org}/journals`);
  const row = (r.json?.data ?? []).find((j) => j.id === entry);
  check("W-01e", "Day Book data shows it as posted", row?.status === "posted", row?.status);
  r = await owner.s.api("GET", `/organisations/${org}/reports/general-ledger`);
  const gl = JSON.stringify(r.json?.data ?? "");
  check("W-01f", "general ledger has the voucher", r.status === 200 && gl.includes("E2E/1"), `${r.status} ${r.text.slice(0, 200)}`);
  r = await owner.s.api("GET", `/organisations/${org}/reports/trial-balance`);
  const tb = tbTotals(r.json?.data ?? []);
  check("W-01g", "trial balance debits equal credits", tb.debit === tb.credit && tb.debit === 1234.5, JSON.stringify(tb));
  r = await owner.s.api("GET", `/organisations/${org}/reports/cash-flow`);
  check("W-01i", "cash flow shows the money leaving the bank", Number(r.json?.data?.closing_cash_equivalents) === -1234.5, r.text.slice(0, 300));
  r = await owner.s.api("GET", `/organisations/${org}/audit-events`);
  check("W-01h", "audit trail recorded events", r.status === 200 && (r.json?.data ?? []).length > 0, `${r.status} ${r.text.slice(0, 200)}`);

  // Plan §8: forbidden, no membership, low role
  const stranger = await signup("stranger");
  r = await stranger.s.api("GET", `/organisations/${org}/accounts`);
  check("A-07", "non-member reads no accounts", (r.json?.data ?? []).length === 0, r.text.slice(0, 200));
  r = await stranger.s.api("POST", `/organisations/${org}/journals`, voucher("E2E/STRANGER", 1, 1));
  check("A-08", "non-member can't create a voucher", r.status !== 200, r.status);

  const viewer = await signup("viewer");
  r = await owner.s.api("POST", `/organisations/${org}/invitations`, { email: viewer.email, role: "viewer" });
  check("A-09", "owner invites a viewer", r.status === 200, `${r.status} ${r.text}`);
  r = await owner.s.api("GET", `/organisations/${org}/invitations`);
  const token = (r.json?.data ?? []).find((i) => i.email === viewer.email)?.token;
  r = await viewer.s.api("POST", "/organisations/invitations/accept", { token });
  check("A-10", "viewer accepts invitation", r.status === 200, `${r.status} ${r.text}`);
  r = await viewer.s.api("GET", `/organisations/${org}/accounts`);
  check("A-11", "viewer can read", (r.json?.data ?? []).length === seededCount, (r.json?.data ?? []).length);
  r = await viewer.s.api("POST", `/organisations/${org}/journals`, voucher("E2E/VIEWER", 1, 1));
  check("A-12", "viewer can't create a voucher", r.status !== 200, r.status);

  // Plan §8: refresh, reuse detection, logout
  const { s: rs, r: lr } = await login(owner.email);
  check("A-13", "login succeeds", lr.status === 200, lr.status);
  const oldRefresh = rs.cookies.deku_rt;
  const refreshing = new Session();
  refreshing.cookies.deku_rt = oldRefresh;
  r = await refreshing.req("GET", "/api/auth/me");
  check("A-14", "expired access token refreshes from refresh cookie", r.status === 200 && refreshing.cookies.deku_rt !== oldRefresh, r.status);
  const reused = await fetch(`${BACKEND}/api/v1/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: oldRefresh }),
  });
  check("A-15", "reused refresh token is rejected by the backend", reused.status === 401, reused.status);

  const { s: out } = await login(owner.email);
  const outRefresh = out.cookies.deku_rt;
  r = await out.req("POST", "/api/auth/logout");
  check("A-16", "logout clears cookies", r.status < 300 && !out.cookies.deku_at, r.status);
  const after = new Session();
  after.cookies.deku_rt = outRefresh;
  r = await after.req("GET", "/api/auth/me");
  check("A-17", "refresh token dead after logout", r.status === 401, r.status);

  // D-15: optional integrations off, core still up
  const { s: me } = await login(owner.email);
  r = await me.api("GET", `/organisations/${org}/payments/status`);
  check("D-15a", "payments report not configured", r.status === 503 || r.json?.configured === false || r.json?.data?.configured === false, `${r.status} ${r.text}`);
  r = await me.api("GET", `/organisations/${org}/gsp/status`);
  check("D-15b", "GSP doesn't pretend to be connected", r.status === 503 || r.json?.configured === false || r.json?.data?.configured === false, `${r.status} ${r.text}`);

  // Background job
  const cron = await fetch(`${BACKEND}/api/v1/internal/notifications/generate`, { method: "POST", headers: { "X-Deku-Cron-Secret": CRON } });
  check("J-01", "notification job runs", cron.ok, cron.status);

  writeFileSync(STATE, JSON.stringify({ email: owner.email, org, seededCount, tb }));
  return true;
}

// D-13: run after the containers are removed and recreated on the same volume.
async function persisted() {
  const { email, org, seededCount, tb } = JSON.parse(readFileSync(STATE, "utf8"));
  const { s, r } = await login(email);
  check("D-13a", "user can sign in after recreation", r.status === 200, r.status);
  let res = await s.api("GET", `/organisations/${org}/accounts`);
  check("D-13b", "chart of accounts survived", (res.json?.data ?? []).length === seededCount, (res.json?.data ?? []).length);
  res = await s.api("GET", `/organisations/${org}/reports/trial-balance`);
  const now = tbTotals(res.json?.data ?? []);
  check("D-13c", "posted ledger survived", now.debit === tb.debit && now.credit === tb.credit, JSON.stringify(now));
}

// D-11: only in a stack started with DEKU_SEED_DEMO=true.
async function demo() {
  const s = new Session();
  const r = await s.req("POST", "/api/auth/login", { email: "demo-owner@deku.finance", password: "DekuDemo#2026" });
  check("D-11a", "demo login works in demo mode", r.status === 200, r.status);
  const orgs = await s.api("GET", "/organisations");
  check("D-11b", "demo user has a demo company", (orgs.json?.data ?? []).length > 0, orgs.text.slice(0, 200));
}

const mode = process.argv[2];
const run = { fresh, persisted, demo }[mode];
if (!run) {
  console.error("usage: stack.mjs fresh|persisted|demo");
  process.exit(2);
}
try {
  await run();
} catch (e) {
  check("X-00", `script aborted in ${mode}`, false, e?.stack ?? e);
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${mode}: ${results.length - failed.length}/${results.length} passed`);
if (process.env.GITHUB_ACTIONS) {
  console.log(`::notice::e2e ${mode}: ${results.length - failed.length}/${results.length} passed`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    const lines = results.map((r) => `| ${r.id} | ${r.name} | ${r.ok ? "PASS" : "FAIL"} |`).join("\n");
    writeFileSync(process.env.GITHUB_STEP_SUMMARY, `### ${mode}\n| ID | Check | Result |\n|---|---|---|\n${lines}\n`, { flag: "a" });
  }
}
process.exit(failed.length ? 1 : 0);
