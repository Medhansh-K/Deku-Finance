// Real Chromium against the running stack: every page, the tutorials, keyboard and navigation (plan sections 9, 23).
// Run after `stack.mjs fresh`, whose state file supplies the users.
// Usage: PW_HOME=<dir with playwright> node --experimental-strip-types tests/e2e/browser.mjs
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { TUTORIAL_PATHS } from "../../src/lib/tutorials/paths.ts";

const { chromium } = createRequire(`${process.env.PW_HOME}/`)("playwright");
const BASE = process.env.E2E_BASE ?? "http://localhost:3000";
const STATE = JSON.parse(readFileSync(process.env.E2E_STATE ?? "e2e-state.json", "utf8"));
const PASSWORD = "e2e-Only-Passw0rd!";
const SHOTS = "browser-screenshots";
mkdirSync(SHOTS, { recursive: true });

const results = [];
function check(id, name, ok, detail = "") {
  results.push({ id, name, ok, detail: String(detail) });
  console.log(`${ok ? "PASS" : "FAIL"} ${id} ${name}${!ok && detail ? ` :: ${detail}` : ""}`);
}

// All signed-in pages. Pages needing a token or an id aren't reachable on their own.
function routes(dir = "src/app", prefix = "") {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (!statSync(full).isDirectory()) return name === "page.tsx" && prefix ? [prefix] : [];
    if (name === "api" || name.startsWith("(") || name.startsWith("[")) return [];
    return routes(full, `${prefix}/${name}`);
  });
}
const SKIP = new Set(["/join", "/onboarding"]);
const PAGES = routes().filter((r) => !SKIP.has(r)).sort();

async function signIn(browser, email, viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.goto(`${BASE}/login`);
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/gateway/, { timeout: 20000 });
  return { context, page };
}

// Records what would otherwise be a blank or half-broken screen.
function watch(page) {
  const problems = [];
  page.on("pageerror", (e) => problems.push(`script error: ${e.message}`));
  page.on("response", (r) => {
    const url = r.url();
    if (!url.includes("/api/")) return;
    const status = r.status();
    // 503 is how a switched-off integration answers.
    if (status >= 500 && status !== 503) problems.push(`${status} ${url.replace(BASE, "")}`);
    if (status === 404) problems.push(`404 ${url.replace(BASE, "")}`);
  });
  return problems;
}

let wizardBlocked = false;

// The real setup wizard, once: every signed-in page redirects here until it's finished.
async function completeOnboarding(browser) {
  const { context, page } = await signIn(browser, STATE.email, { width: 1366, height: 800 });
  await page.waitForURL(/\/onboarding/, { timeout: 15000 });
  const problems = watch(page);
  check("O-W1", "a new company is sent to the setup wizard", true);
  for (let i = 0; i < 8 && new URL(page.url()).pathname === "/onboarding"; i++) {
    if (await page.locator("#ob-state").isVisible()) {
      await page.locator("#ob-state").selectOption("27");
      await page.getByLabel("Registered address").fill("1 E2E Road");
      await page.getByLabel("City").fill("Pune");
      await page.getByLabel("PIN code").fill("411001");
    }
    const finish = page.getByRole("button", { name: "Finish setup" });
    if (await finish.isVisible()) {
      await finish.click();
      await page.waitForURL(/\/gateway/, { timeout: 15000 });
      break;
    }
    const title = await page.locator("h1").innerText();
    const proceed = page.getByRole("button", { name: "Continue", exact: true });
    const clicked = await proceed.click({ timeout: 10000 }).then(() => null, (e) => e.message);
    if (clicked) {
      const seen = await proceed.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return { disabled: el.disabled, rect: [r.x, r.y, r.width, r.height], viewport: [innerWidth, innerHeight], covering: top ? `${top.tagName}.${String(top.className).slice(0, 80)} ${top.textContent.slice(0, 60)}` : null, same: top === el || el.contains(top) };
      }).catch((e) => e.message);
      const reasons = clicked.split(/?
/).filter((l) => /intercept|not enabled|not stable|not visible|outside|detached/.test(l)).slice(0, 3).join(" ");
      check("O-W-click", "Continue can be clicked", false, `${JSON.stringify(seen)} ${reasons}`);
      await page.screenshot({ path: join(SHOTS, "wizard-stuck.png") });
      break;
    }
    // The button is disabled while saving and then relabelled, so wait for the step itself to change.
    const moved = await page.waitForFunction((t) => document.querySelector("h1")?.innerText !== t, title, { timeout: 15000 }).then(() => true, () => false);
    if (!moved) break;
  }
  const finished = new URL(page.url()).pathname === "/gateway";
  check("O-W2", "the setup wizard finishes on the Gateway", finished, `${page.url()} ${(await page.locator("body").innerText()).slice(0, 240)}`);
  if (!finished) wizardBlocked = true;
  check("O-W3", "the wizard makes no failed requests", problems.length === 0, problems.join(" | "));
  await context.close();
}

async function visitAll(browser, label, viewport) {
  const { context, page } = await signIn(browser, STATE.email, viewport);
  const problems = watch(page);
  const overflowing = [];
  // The welcome card would sit over every screenshot.
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) if (k.startsWith("deku_tutorial_progress_")) localStorage.removeItem(k);
  });
  for (const route of PAGES) {
    const before = problems.length;
    let status = 0;
    try {
      const response = await page.goto(`${BASE}${route}`, { waitUntil: "networkidle", timeout: 30000 });
      status = response?.status() ?? 0;
    } catch (e) {
      problems.push(`navigation: ${e.message.split("\n")[0]}`);
    }
    const visible = (await page.locator("body").innerText().catch(() => "")).trim().length;
    const crashed = await page.getByText(/application error|something went wrong/i).count();
    const redirected = new URL(page.url()).pathname !== route;
    check(`P-${label}${route}`, `${route} loads at ${label}`, status === 200 && visible > 50 && !crashed && !redirected && problems.length === before, `status ${status}, text ${visible}, url ${page.url()}, ${problems.slice(before).join("; ")}`);
    const wide = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    if (wide) overflowing.push(route);
    await page.screenshot({ path: join(SHOTS, `${label}${route.replaceAll("/", "_")}.png`) });
  }
  // Wide accounting tables scroll on phones by design, so this is reported rather than failed.
  console.log(`${label}: pages wider than the screen: ${overflowing.join(", ") || "none"}`);
  writeFileSync(join(SHOTS, `${label}-overflow.txt`), overflowing.join("\n"));
  await context.close();
  return overflowing;
}

async function clickStep(page, name) {
  await page.getByRole("button", { name, exact: true }).click();
}

const card = (page, title) => page.getByRole("region", { name: `Tutorial: ${title}` });

async function walkTutorials(browser) {
  const { context, page } = await signIn(browser, STATE.email, { width: 1366, height: 800 });
  const problems = watch(page);

  await page.goto(`${BASE}/gateway`, { waitUntil: "networkidle" });
  const welcome = page.getByRole("region", { name: "Welcome" });
  check("T-01", "a first-time user is offered the tour", await welcome.isVisible(), "no welcome card");
  await clickStep(page, "Not now");
  await page.reload({ waitUntil: "networkidle" });
  check("T-02", "declining is remembered", !(await welcome.isVisible()));

  for (const path of TUTORIAL_PATHS) {
    await page.goto(`${BASE}/help`, { waitUntil: "networkidle" });
    const section = page.locator("section", { has: page.getByRole("heading", { name: path.title, exact: true }) });
    await section.getByRole("button", { name: "Start", exact: true }).click();
    const guide = card(page, path.title);
    const bad = [];
    for (const [i, step] of path.steps.entries()) {
      try {
        await guide.getByRole("heading", { name: step.title, exact: true }).waitFor({ timeout: 10000 });
        if (step.route) await page.waitForURL((u) => u.pathname === step.route, { timeout: 15000 });
        if (step.target) {
          await page.locator(`[data-tour="${step.target}"].tour-highlight`).waitFor({ state: "attached", timeout: 8000 });
          const box = await page.locator(`[data-tour="${step.target}"]`).boundingBox();
          if (!box || box.width === 0 || box.height === 0) bad.push(`${step.id}: target has no size`);
        }
      } catch (e) {
        bad.push(`${step.id}: ${e.message.split("\n")[0]}`);
        await page.screenshot({ path: join(SHOTS, `tutorial_${path.id}_${step.id}.png`) });
      }
      await guide.getByRole("button", { name: i === path.steps.length - 1 ? "Finish" : "Next", exact: true }).click();
    }
    check(`T-path-${path.id}`, `every step of "${path.title}" shows, opens its page and finds its element`, bad.length === 0, bad.join(" | "));
  }

  await page.goto(`${BASE}/help`, { waitUntil: "networkidle" });
  check("T-03", "finished paths show as completed", (await page.getByText("Completed", { exact: true }).count()) === TUTORIAL_PATHS.length, await page.getByText("Completed", { exact: true }).count());

  // Pause, resume, restart, and that a tutorial saved nothing.
  const first = TUTORIAL_PATHS[0];
  const firstSection = page.locator("section", { has: page.getByRole("heading", { name: first.title, exact: true }) });
  await firstSection.getByRole("button", { name: "Restart", exact: true }).click();
  const guide = card(page, first.title);
  await clickStep(guide, "Next");
  await guide.getByRole("heading", { name: first.steps[1].title, exact: true }).waitFor();
  await clickStep(guide, "Pause");
  check("T-04", "pausing closes the guide", !(await guide.isVisible()));
  await page.goto(`${BASE}/help`, { waitUntil: "networkidle" });
  await firstSection.getByRole("button", { name: "Resume", exact: true }).click().catch(() => {});
  await guide.getByRole("heading", { name: first.steps[1].title, exact: true }).waitFor({ timeout: 10000 }).catch(() => {});
  check("T-05", "resume returns to the same step", await guide.getByRole("heading", { name: first.steps[1].title, exact: true }).isVisible());
  await clickStep(guide, "Pause");

  await page.goto(`${BASE}/help`, { waitUntil: "networkidle" });
  await page.getByLabel("Search tutorials").fill("trial balance");
  const shown = await page.getByRole("heading", { level: 2 }).count();
  check("T-06", "search narrows the list", shown > 0 && shown < TUTORIAL_PATHS.length, `${shown} shown`);
  check("T-07", "no API or script errors during the tours", problems.length === 0, problems.join(" | "));
  await context.close();

  // Phone width: the guide must fit the screen.
  const phone = await signIn(browser, STATE.email, { width: 390, height: 844 });
  await phone.page.goto(`${BASE}/help`, { waitUntil: "networkidle" });
  const section = phone.page.locator("section", { has: phone.page.getByRole("heading", { name: first.title, exact: true }) });
  await section.getByRole("button", { name: /Start|Resume/ }).first().click();
  const phoneCard = card(phone.page, first.title);
  await phoneCard.waitFor({ timeout: 10000 });
  const box = await phoneCard.boundingBox();
  check("T-08", "guide card fits a phone screen", !!box && box.x >= 0 && box.x + box.width <= 390 && box.y + box.height <= 844, JSON.stringify(box));
  await phone.page.screenshot({ path: join(SHOTS, "mobile_tutorial.png") });
  await phone.context.close();

  // Other roles don't get the administrator paths.
  const viewer = await signIn(browser, STATE.viewerEmail, { width: 1366, height: 800 });
  await viewer.page.goto(`${BASE}/help`, { waitUntil: "networkidle" });
  const admin = TUTORIAL_PATHS.find((p) => p.audience === "admin");
  const everyone = TUTORIAL_PATHS.find((p) => p.audience === "everyone");
  await viewer.page.getByRole("heading", { name: everyone.title, exact: true }).waitFor({ timeout: 10000 });
  check("T-09", "a viewer doesn't see administrator tutorials", (await viewer.page.getByRole("heading", { name: admin.title, exact: true }).count()) === 0);
  await viewer.context.close();
}

async function navigationAndKeyboard(browser) {
  const { context, page } = await signIn(browser, STATE.email, { width: 1366, height: 800 });
  await page.goto(`${BASE}/help`, { waitUntil: "networkidle" });

  // Header and menu changes.
  check("U-01", "header has import and export", (await page.getByRole("link", { name: "Import data" }).count()) === 1 && (await page.getByRole("link", { name: "Export data" }).count()) === 1);
  await page.goto(`${BASE}/gateway`, { waitUntil: "networkidle" });
  check("U-02", "inventory isn't listed twice on the Gateway", (await page.locator('a[href="/inventory"]').count()) === 0);
  check("U-03", "Gateway offers Reconciliation & Settlements", (await page.locator('a[href="/reconciliation"]').count()) === 1);
  await page.goto(`${BASE}/marketplace`, { waitUntil: "networkidle" });
  check("U-04", "the old marketplace address redirects", new URL(page.url()).pathname === "/reconciliation" && page.url().includes("tab=marketplace"), page.url());
  await page.getByRole("tab", { name: "Bank Reconciliation" }).click();
  await page.waitForURL(/tab=bank/);
  check("U-05", "reconciliation tabs switch", await page.getByRole("tab", { name: "Bank Reconciliation" }).getAttribute("aria-selected") === "true");
  await page.goto(`${BASE}/masters/products-services`, { waitUntil: "networkidle" });
  check("U-06", "the catalogue links to stock levels", (await page.locator('a[href="/inventory"]').count()) === 1);

  // F5 while typing must not reload away a half-filled voucher.
  await page.goto(`${BASE}/vouchers`, { waitUntil: "networkidle" });
  const field = page.locator("main textarea, main input[type='text']").first();
  await field.click();
  await field.fill("E2E half-typed entry");
  await page.keyboard.press("F5");
  await page.waitForTimeout(800);
  check("K-01", "F5 while typing keeps the text", (await field.inputValue().catch(() => "")) === "E2E half-typed entry" && new URL(page.url()).pathname === "/vouchers");
  await page.keyboard.press("F2");
  await page.waitForTimeout(500);
  check("K-02", "function keys don't navigate while typing", new URL(page.url()).pathname === "/vouchers", page.url());

  // Unsaved work prompts before leaving; declining stays.
  await field.blur();
  let prompted = false;
  page.once("dialog", (d) => {
    prompted = true;
    d.dismiss();
  });
  await page.keyboard.press("F1");
  await page.waitForTimeout(800);
  check("K-03", "leaving with typed work asks first, and declining stays", prompted && new URL(page.url()).pathname === "/vouchers", `${prompted} ${page.url()}`);

  await page.goto(`${BASE}/gateway`, { waitUntil: "networkidle" });
  await page.keyboard.press("F8");
  await page.waitForURL(/\/day-book/, { timeout: 10000 }).catch(() => {});
  check("K-04", "function keys navigate otherwise", new URL(page.url()).pathname === "/day-book", page.url());
  await page.keyboard.press("Control+k");
  check("K-05", "Ctrl+K opens the command palette", await page.getByRole("dialog").first().isVisible().catch(() => false) || (await page.getByPlaceholder(/search|jump|type/i).count()) > 0);

  // A document attached in Day Book can be downloaded.
  await page.goto(`${BASE}/day-book`, { waitUntil: "networkidle" });
  await page.getByText("E2E-R-1", { exact: true }).first().click();
  const attach = page.locator('label:has-text("Attach document") input[type="file"]');
  await attach.waitFor({ state: "attached", timeout: 10000 });
  await attach.setInputFiles({ name: "receipt.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.7 e2e receipt") });
  await page.waitForTimeout(1500);
  await page.getByText("E2E-R-1", { exact: true }).first().click();
  const download = page.getByRole("link", { name: "Download", exact: true });
  await download.waitFor({ timeout: 10000 });
  const [file] = await Promise.all([page.waitForEvent("download"), download.click()]);
  check("U-07", "Day Book attaches and downloads a document", file.suggestedFilename() === "receipt.pdf", file.suggestedFilename());
  await context.close();

  // Clean deployment: no demo offer, and the reset page works without signing in.
  const anon = await browser.newContext();
  const fresh = await anon.newPage();
  await fresh.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  check("U-08", "login has no demo buttons on a clean deployment", (await fresh.getByText("Interactive Plan Tour").count()) === 0);
  await fresh.goto(`${BASE}/reset-password`, { waitUntil: "networkidle" });
  check("U-09", "reset page explains a missing link", await fresh.getByText(/invalid|expired/i).first().isVisible());
  await anon.close();
}

const browser = await chromium.launch();
try {
  const sections = [
    () => completeOnboarding(browser),
    () => visitAll(browser, "desktop", { width: 1366, height: 800 }),
    () => visitAll(browser, "mobile", { width: 390, height: 844 }),
    () => navigationAndKeyboard(browser),
    () => walkTutorials(browser),
  ];
  for (const run of sections) {
    // Every other page would just redirect back to the wizard.
    if (wizardBlocked) break;
    try {
      await run();
    } catch (e) {
      check("X-00", "browser section stopped early", false, e?.stack ?? e);
      if (run === sections[0]) wizardBlocked = true;
    }
  }
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\nbrowser: ${results.length - failed.length}/${results.length} passed`);
if (process.env.GITHUB_ACTIONS) {
  console.log(`::notice::e2e browser: ${results.length - failed.length}/${results.length} passed`);
  // One annotation: GitHub shows only ten per step, and logs need a login.
  if (failed.length) console.log(`::error::${failed.map((f) => `${f.id} ${f.detail.slice(0, 700)}`.replaceAll("\n", " ")).join("%0A").slice(0, 9000)}`);
}
process.exit(failed.length ? 1 : 0);
