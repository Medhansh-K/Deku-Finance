// End-to-end checks against a running stack, through the same frontend proxy the browser uses.
// Usage: node tests/e2e/stack.mjs fresh|persisted|demo   (env: E2E_BASE, E2E_BACKEND, E2E_STATE, E2E_CRON_SECRET)
// Plan §7, §8 and §10. Records created here use throwaway addresses and a fictional company.
import { readFileSync, writeFileSync } from "node:fs";
import { runWorkflows } from "./workflows.mjs";
import { runEditingChecks } from "./editing.mjs";
import { runBankingChecks } from "./banking.mjs";
import { runReportChecks } from "./reports.mjs";

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

async function signup(tag, invitedEmail, inviteToken) {
  const s = new Session();
  const email = invitedEmail ?? `e2e-${tag}-${Date.now()}@example.com`;
  const r = await s.req("POST", "/api/auth/signup", { email, password: PASSWORD, full_name: `E2E ${tag}`, invite_token: inviteToken });
  return { s, email, r };
}

async function login(email, password = PASSWORD) {
  const s = new Session();
  const r = await s.req("POST", "/api/auth/login", { email, password });
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
  const blocked = new Session();
  r = await blocked.req("POST", "/api/auth/signup", { email: `e2e-blocked-${Date.now()}@example.com`, password: PASSWORD, full_name: "E2E Blocked" });
  check("S-01", "second signup with no invitation is refused", r.status === 403 && r.json?.error === "signup_closed", `${r.status} ${r.text}`);
  r = await fetch(`${BACKEND}/api/v1/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: `e2e-direct-${Date.now()}@example.com`, password: PASSWORD, full_name: "E2E Direct" }),
  });
  check("S-01b", "going straight to the backend is refused too", r.status === 403, r.status);
  r = await blocked.req("POST", "/api/auth/demo", { type: "owner" });
  check("S-02a", "demo sign-in is off without the demo seed", r.status === 404, r.status);
  const html = await (await fetch(`${BASE}/login`)).text();
  const chunks = [...new Set(html.match(/\/_next\/static\/[^"' ]+\.js/g) ?? [])];
  const bundles = await Promise.all(chunks.map((c) => fetch(BASE + c).then((x) => x.text())));
  check("S-02b", "no demo password in the login page's scripts", chunks.length > 0 && !bundles.some((b) => b.includes("DekuDemo")), `${chunks.length} chunks`);
  r = await owner.s.api("GET", "/organisations");
  check("O-02", "new user sees no companies (no demo leakage)", r.status === 200 && r.json?.data?.length === 0, r.text);

  const slug = `e2e-${Date.now()}`;
  r = await owner.s.api("POST", "/organisations", { name: "E2E Test Traders", slug });
  check("O-03", "company created", r.status === 200 && !!r.json?.organisation_id, `${r.status} ${r.text}`);
  const org = r.json?.organisation_id;
  if (!org) return false;

  r = await owner.s.api("POST", "/organisations", { name: "E2E Second Company", slug: `${slug}-second` });
  check("O-08", "a second company is refused", r.status === 409 && r.json?.error === "single_organisation", `${r.status} ${r.text}`);
  r = await owner.s.api("GET", `/organisations/${org}/subscription`);
  const sub = r.json?.data ?? r.json;
  check("O-09", "company has no trial or end date", sub?.plan?.code === "single_org" && !sub?.current_period_end, r.text.slice(0, 300));

  r = await owner.s.api("GET", `/organisations/${org}/accounts`);
  check("O-04", "company starts with its chart of accounts", (r.json?.data ?? []).length > 10, (r.json?.data ?? []).length);
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

  r = await owner.s.api("GET", `/organisations/${org}/journals/next-number?prefix=PMT-2026`);
  check("W-00b", "server issues the first voucher number", r.json?.data === "PMT-2026-0001", r.text);

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
  r = await owner.s.api("GET", `/organisations/${org}/reports/cash-flow?start_date=${fy.start_date}&end_date=${date}`);
  check("W-01i", "cash flow shows the money leaving the bank", Number(r.json?.data?.closing_cash_equivalents) === -1234.5, r.text.slice(0, 300));
  r = await owner.s.api("GET", `/organisations/${org}/audit-events`);
  check("W-01h", "audit trail recorded events", r.status === 200 && (r.json?.data ?? []).length > 0, `${r.status} ${r.text.slice(0, 200)}`);

  // Plan §8: forbidden, no membership, low role
  const strangerEmail = `e2e-stranger-${Date.now()}@example.com`;
  await owner.s.api("POST", `/organisations/${org}/invitations`, { email: strangerEmail, role: "viewer" });
  const inviteToken = async (address) =>
    ((await owner.s.api("GET", `/organisations/${org}/invitations`)).json?.data ?? []).find((i) => i.email === address)?.token;
  const squatter = await signup("squatter", strangerEmail);
  check("S-12", "an invited address can't sign up without the link", squatter.r.status === 403, squatter.r.status);
  const stranger = await signup("stranger", strangerEmail, await inviteToken(strangerEmail));
  check("A-06b", "invited address can sign up", stranger.r.status === 200, stranger.r.status);
  r = await stranger.s.api("GET", `/organisations/${org}/accounts`);
  check("A-07", "non-member reads no accounts", (r.json?.data ?? []).length === 0, r.text.slice(0, 200));
  r = await stranger.s.api("POST", `/organisations/${org}/journals`, voucher("E2E/STRANGER", 1, 1));
  check("A-08", "non-member can't create a voucher", r.status !== 200, r.status);

  const viewerEmail = `e2e-viewer-${Date.now()}@example.com`;
  r = await owner.s.api("POST", `/organisations/${org}/invitations`, { email: viewerEmail, role: "viewer" });
  check("A-09", "owner invites a viewer", r.status === 200, `${r.status} ${r.text}`);
  const token = await inviteToken(viewerEmail);
  const viewer = await signup("viewer", viewerEmail, token);
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

  // F-01, plan section 11: documents are stored, access-checked and limited.
  const pdf = Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(300000, 7)]);
  const upload = (who, body, name = "bill.pdf") =>
    fetch(`${BASE}/api/backend/api/v1/organisations/${org}/files?filename=${name}&journal_entry_id=${entry}&category=Vendor%20bill`, {
      method: "POST",
      headers: { Cookie: `deku_at=${who.cookies.deku_at}`, "Content-Type": "application/octet-stream" },
      body,
    });
  const fetchFile = (who, id) =>
    fetch(`${BASE}/api/backend/api/v1/organisations/${org}/files/${id}`, { headers: { Cookie: `deku_at=${who.cookies.deku_at}` } });
  const sent = await upload(me, pdf);
  const sentJson = await sent.json().catch(() => null);
  check("F-01a", "owner attaches a PDF to the voucher", sent.ok && !!sentJson?.data?.id, `${sent.status} ${JSON.stringify(sentJson)}`);
  check("F-01b", "upload response doesn't echo the bytes", !JSON.stringify(sentJson ?? {}).includes("\\x25"));
  const fileId = sentJson?.data?.id;
  const got = await fetchFile(me, fileId);
  check("F-01c", "download returns the exact bytes", got.ok && Buffer.from(await got.arrayBuffer()).equals(pdf), got.status);
  check("F-01d", "download is an attachment and can't be sniffed as a page", /attachment/.test(got.headers.get("content-disposition") ?? "") && got.headers.get("x-content-type-options") === "nosniff", got.headers.get("content-disposition"));
  const viewerGot = await fetchFile(viewer.s, fileId);
  check("F-01e", "viewer can download", viewerGot.ok, viewerGot.status);
  const strangerGot = await fetchFile(stranger.s, fileId);
  check("F-01f", "non-member can't download", strangerGot.status === 404, strangerGot.status);
  const viewerSent = await upload(viewer.s, pdf);
  check("F-01g", "viewer can't attach", viewerSent.status === 403, viewerSent.status);
  const webPage = await upload(me, Buffer.from("<html><script>alert(1)</script></html>"), "x.pdf");
  check("F-01h", "a web page named .pdf is refused", webPage.status === 400, webPage.status);
  const huge = await upload(me, Buffer.concat([Buffer.from("%PDF-"), Buffer.alloc(11 * 1024 * 1024)]));
  check("F-01i", "a file over 10 MB is refused", huge.status === 413, huge.status);
  const trail = await me.api("GET", `/organisations/${org}/audit-events`);
  check("F-01k", "the audit trail shows the attachment", (trail.json?.data ?? []).some((e) => e.action === "document_attached"), trail.text.slice(0, 200));
  const listed = await me.api("GET", `/organisations/${org}/files`);
  const fileRow = (listed.json?.data ?? []).find((f) => f.id === fileId);
  check("F-01j", "file list links the voucher and leaves out the bytes", fileRow?.journal_entry_id === entry && !("data" in (fileRow ?? {})), listed.text.slice(0, 200));

  await runWorkflows({ me, org, fy, date, check, invite: inviteToken, login, signup, voucherPeriod: period, accounts, viewer, base: BASE, PASSWORD });
  await runEditingChecks({ me, org, date, voucherPeriod: period, accounts, check });
  await runBankingChecks({ me, org, date, voucherPeriod: period, accounts, check, invite: inviteToken, signup });
  await runReportChecks({ me, org, date, fy, check });

  // S-04, S-09: what a hostile page or script can reach through the proxy.
  r = await fetch(`${BASE}/api/backend/api/v1/organisations/${org}/fiscal-periods`, {
    method: "POST",
    headers: { Cookie: `deku_at=${me.cookies.deku_at}`, "Content-Type": "application/json", Origin: "https://evil.example", "Sec-Fetch-Site": "cross-site" },
    body: JSON.stringify(fy),
  });
  check("S-04a", "a cross-site write is refused", r.status === 403, r.status);
  r = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "text/plain", Origin: "https://evil.example", "Sec-Fetch-Site": "cross-site" },
    body: JSON.stringify({ email: owner.email, password: PASSWORD }),
  });
  check("S-04b", "a cross-site login is refused", r.status === 403, r.status);
  r = await me.api("GET", "/auth/me");
  check("S-09", "auth routes aren't reachable through the proxy", r.status === 404, r.status);

  // S-05, last because it locks this address.
  let lastBad;
  for (let i = 0; i < 10; i++) lastBad = (await new Session().req("POST", "/api/auth/login", { email: strangerEmail, password: "wrong-password-e2e" })).status;
  check("S-05a", "ten wrong passwords are each refused", lastBad === 401, lastBad);
  const locked = await new Session().req("POST", "/api/auth/login", { email: strangerEmail, password: PASSWORD });
  check("S-05b", "the address is locked, even with the right password", locked.status === 429 && locked.json?.error === "too_many_attempts", `${locked.status} ${locked.text}`);
  const elsewhere = await login(owner.email);
  check("S-05c", "other users are unaffected", elsewhere.r.status === 200, elsewhere.r.status);

  const finalTb = tbTotals((await me.api("GET", `/organisations/${org}/reports/trial-balance`)).json?.data ?? []);
  writeFileSync(STATE, JSON.stringify({ email: owner.email, viewerEmail: viewer.email, org, seededCount, tb: finalTb, fileId, fileBase64: pdf.toString("base64") }));
  return true;
}

// D-13: run after the containers are removed and recreated on the same volume.
async function persisted() {
  const { email, org, seededCount, tb, fileId, fileBase64 } = JSON.parse(readFileSync(STATE, "utf8"));
  const { s, r } = await login(email);
  check("D-13a", "user can sign in after recreation", r.status === 200, r.status);
  let res = await s.api("GET", `/organisations/${org}/accounts`);
  check("D-13b", "chart of accounts survived", (res.json?.data ?? []).length === seededCount, (res.json?.data ?? []).length);
  res = await s.api("GET", `/organisations/${org}/reports/trial-balance`);
  const now = tbTotals(res.json?.data ?? []);
  check("D-13c", "posted ledger survived", now.debit === tb.debit && now.credit === tb.credit, JSON.stringify(now));
  const file = await fetch(`${BASE}/api/backend/api/v1/organisations/${org}/files/${fileId}`, { headers: { Cookie: `deku_at=${s.cookies.deku_at}` } });
  check("D-14", "attached document survived, byte for byte", file.ok && Buffer.from(await file.arrayBuffer()).equals(Buffer.from(fileBase64, "base64")), file.status);
}

// D-11: only in a stack started with DEKU_SEED_DEMO=true.
async function demo() {
  const s = new Session();
  const r = await s.req("POST", "/api/auth/demo", { type: "owner" });
  check("D-11a", "demo login works in demo mode", r.status === 200, `${r.status} ${r.text}`);
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
