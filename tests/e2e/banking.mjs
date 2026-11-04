// Bank reconciliation, payroll and marketplace settlement through the real API, with hand-worked
// figures. Runs right after runWorkflows, so it starts from the ledger workflows.mjs leaves.

const money = (n) => Math.round(Number(n) * 100) / 100;
const one = (data) => (Array.isArray(data) ? data[0] : data);

export async function runBankingChecks({ me, org, date, voucherPeriod, accounts, check, invite, signup }) {
  const O = `/organisations/${org}`;
  const accountId = (code) => accounts.find((a) => a.code === code)?.id;
  const bank = accountId("1020");
  const dayBefore = (d, n) => new Date(Date.parse(d) - n * 86400000).toISOString().slice(0, 10);

  const section = async (id, name, fn) => {
    try {
      await fn();
    } catch (e) {
      check(id, `${name}: stopped early`, false, e?.message ?? e);
    }
  };
  const need = (value, what) => {
    if (value === undefined || value === null) throw new Error(`missing ${what}`);
    return value;
  };

  const balances = async () => {
    const rows = (await me.api("GET", `${O}/reports/trial-balance`)).json?.data ?? [];
    return Object.fromEntries(rows.map((r) => [r.account_code, Number(r.total_debit) - Number(r.total_credit)]));
  };
  const moved = (before, after, code) => money((after[code] ?? 0) - (before[code] ?? 0));

  const draftJournal = async (number, lines) => {
    const r = await me.api("POST", `${O}/journals`, {
      fiscal_period_id: voucherPeriod,
      entry_number: number,
      entry_date: date,
      narration: `E2E ${number}`,
      lines: lines.map(([code, debit, credit], i) => ({ line_number: i + 1, account_id: need(accountId(code), `account ${code}`), debit, credit })),
    });
    return need(r.json?.entry?.[0]?.id, `journal ${number}: ${r.status} ${r.text.slice(0, 200)}`);
  };
  const postJournal = async (number, lines) => {
    const id = await draftJournal(number, lines);
    const p = await me.api("POST", `${O}/journals/${id}/post`);
    if (p.status !== 200) throw new Error(`post ${number}: ${p.status} ${p.text.slice(0, 200)}`);
    return id;
  };
  const journalRow = async (id) => ((await me.api("GET", `${O}/journals`)).json?.data ?? []).find((j) => j.id === id);
  const bankLineOf = async (id) => need((await journalRow(id))?.journal_entry_lines?.find((l) => l.account_id === bank)?.id, `bank line of ${id}`);

  const join = async (tag, role) => {
    const email = `e2e-${tag}-${Date.now()}@example.com`;
    const sent = await me.api("POST", `${O}/invitations`, { email, role });
    if (sent.status !== 200) throw new Error(`invite ${tag}: ${sent.status} ${sent.text.slice(0, 200)}`);
    const token = await invite(email);
    const who = await signup(tag, email, token);
    const accepted = await who.s.api("POST", "/organisations/invitations/accept", { token });
    if (accepted.status !== 200) throw new Error(`accept ${tag}: ${accepted.status} ${accepted.text.slice(0, 200)}`);
    return who.s;
  };

  let viewer, cfo, outsider;
  await section("B-00", "people", async () => {
    viewer = await join("b-viewer", "viewer");
    cfo = await join("b-cfo", "cfo");
    // Signed up on an invitation it never accepted, so a member of no company. A real second company
    // can't exist here (single_organisation); supabase/tests/reconciliation_statements_test.sql has two.
    const email = `e2e-b-outsider-${Date.now()}@example.com`;
    await me.api("POST", `${O}/invitations`, { email, role: "viewer" });
    outsider = (await signup("b-outsider", email, await invite(email))).s;
  });

  await section("B-01", "bank reconciliation", async () => {
    const position = async (asOf, who = me) => who.api("GET", `${O}/banking/statements/position?bank_account_id=${bank}&as_of=${asOf}`);
    const figures = async (asOf) => {
      const d = (await position(asOf)).json?.data;
      return [money(d?.book_balance), money(d?.matched_amount), money(d?.uncleared_amount)].join(" ");
    };
    const statement = (who, body) => who.api("POST", `${O}/banking/statements`, { bank_account_id: bank, statement_date: date, statement_only_amount: 0, ...body });

    // Bank 1020 after workflows.mjs: -1,234.50 (E2E/1), +2,360 (E2E-R-1), -500 (E2E-MC-1), -77 and +77
    // (E2E-REV-1, reversed, and its reversal). The unbalanced E2E/BAD/1 was never posted.
    check("B-01a", "book balance after the workflows is 625.50, nothing matched", (await figures(date)) === "625.5 0 625.5", await figures(date));
    check("B-01a1", "and agrees with the trial balance", money((await balances())["1020"]) === 625.5, JSON.stringify((await balances())["1020"]));

    const draft = await draftJournal("B-DRAFT-1", [["5090", 999, 0], ["1020", 0, 999]]);
    check("B-01b", "a draft on the bank account doesn't move the book balance", (await figures(date)) === "625.5 0 625.5", await figures(date));

    const receipt = await postJournal("B-RCPT-1", [["1020", 1000, 0], ["4090", 0, 1000]]);
    check("B-01c", "a posted receipt adds 1,000, uncleared", (await figures(date)) === "1625.5 0 1625.5", await figures(date));

    const line = await bankLineOf(receipt);
    const match = (who, overrides = {}) =>
      who.api("POST", `${O}/banking/reconciliations`, {
        bank_account_id: bank, statement_date: date, statement_amount: 1000, statement_reference: "B-UTR-1", statement_narration: "E2E NEFT", journal_entry_line_id: line, ...overrides,
      });

    let r = await match(me, { statement_amount: 999 });
    check("B-02a", "a match for the wrong amount is refused", r.status !== 200, r.status);
    r = await match(me, { statement_amount: -1000 });
    check("B-02b", "a match in the wrong direction is refused", r.status !== 200, r.status);
    const draftRow = await journalRow(draft);
    const draftLine = need(draftRow?.journal_entry_lines?.find((l) => l.account_id === bank)?.id, "draft bank line");
    r = await match(me, { statement_amount: -999, journal_entry_line_id: draftLine });
    check("B-02c", "a draft's line can't be matched", r.status !== 200, r.status);
    r = await match(viewer);
    check("B-02d", "a viewer can't confirm a match", r.status === 400 || r.status === 403, `${r.status} ${r.text.slice(0, 200)}`);

    r = await match(me);
    const rec = one(r.json?.data);
    check("B-02e", "the match is saved", r.status === 200 && !!rec?.id && money(rec?.statement_amount) === 1000, `${r.status} ${r.text.slice(0, 200)}`);
    check("B-02f", "matched 1,000, uncleared 625.50, book balance unchanged", (await figures(date)) === "1625.5 1000 625.5", await figures(date));
    r = await match(me);
    check("B-02g", "the same line can't be matched twice", r.status !== 200, r.status);
    const saved = (await me.api("GET", `${O}/banking/reconciliations?bank_account_id=${bank}`)).json?.data ?? [];
    check("B-02h", "the list shows the one match", saved.length === 1 && saved[0].id === rec?.id, JSON.stringify(saved).slice(0, 200));

    // Found by these checks: a role that can't undo got success while the match stayed.
    r = await viewer.api("DELETE", `${O}/banking/reconciliations/${need(rec?.id, "match")}`);
    check("B-03a", "a viewer's undo is refused, not a false success", r.status === 404, `${r.status} ${r.text.slice(0, 200)}`);
    check("B-03b", "and the match stays", (await figures(date)) === "1625.5 1000 625.5", await figures(date));
    r = await me.api("DELETE", `${O}/banking/reconciliations/${rec.id}`);
    check("B-03c", "undo removes the match", r.status === 200 && (r.json?.data ?? []).length === 1, `${r.status} ${r.text.slice(0, 200)}`);
    check("B-03d", "back to nothing matched", (await figures(date)) === "1625.5 0 1625.5", await figures(date));
    r = await me.api("DELETE", `${O}/banking/reconciliations/${rec.id}`);
    check("B-03e", "undoing again finds nothing", r.status === 404, r.status);

    // Found by these checks: migration 52 let a CFO confirm a match but not undo one.
    r = await match(cfo);
    const cfoRec = one(r.json?.data);
    check("B-03f", "a CFO can confirm a match", r.status === 200 && !!cfoRec?.id, `${r.status} ${r.text.slice(0, 200)}`);
    r = await cfo.api("DELETE", `${O}/banking/reconciliations/${need(cfoRec?.id, "CFO's match")}`);
    check("B-03g", "and undo it", r.status === 200 && (await figures(date)) === "1625.5 0 1625.5", `${r.status} ${await figures(date)}`);

    r = await match(me);
    const liveRec = one(r.json?.data);
    check("B-04a", "matched again", r.status === 200 && !!liveRec?.id, `${r.status} ${r.text.slice(0, 200)}`);

    // Bank shows 1,000: the receipt. The rest of the book balance is uncleared, so nothing is unexplained.
    r = await statement(viewer, { closing_balance: 1000 });
    check("B-04b", "a viewer can't complete a statement", r.status === 403, `${r.status} ${r.text.slice(0, 200)}`);
    r = await statement(me, { closing_balance: 1000.01 });
    check("B-04c", "an unexplained paisa is refused unless accepted", r.status !== 200 && /difference_not_accepted: 0\.01/.test(r.text), `${r.status} ${r.text.slice(0, 200)}`);
    r = await statement(me, { closing_balance: 1000.01, accepted_difference: 0.02 });
    check("B-04d", "accepting a different amount is refused", r.status !== 200, r.status);

    r = await statement(me, { closing_balance: 1000, book_balance: 1, difference: 1 });
    const done = one(r.json?.data);
    check("B-04e", "a statement completes with the right book balance", r.status === 200 && money(done?.book_balance) === 1625.5, `${r.status} ${r.text.slice(0, 300)}`);
    check("B-04f", "difference -625.50, of which nothing is unexplained", money(done?.difference) === -625.5 && money(done?.unexplained_difference) === 0 && done?.accepted_difference === null, JSON.stringify(done ?? null));
    check("B-04g", "matched 1,000 and uncleared 625.50 on the record", money(done?.matched_amount) === 1000 && money(done?.uncleared_amount) === 625.5, JSON.stringify(done ?? null));
    check("B-04h", "records who and when", done?.recorded_by_name === "E2E owner" && !!done?.recorded_by && !!done?.recorded_at, JSON.stringify(done ?? null));

    r = await statement(me, { closing_balance: 1000 });
    check("B-04i", "the same date can't be completed twice", r.status !== 200 && /uk_reconciliation_statements_date/.test(r.text), `${r.status} ${r.text.slice(0, 200)}`);

    // Everything so far is dated today, so yesterday's books are empty. A 200 deposit is on the statement only.
    const y1 = dayBefore(date, 1);
    check("B-05a", "the book balance is as at the date", (await figures(y1)) === "0 0 0", await figures(y1));
    r = await statement(me, { statement_date: y1, closing_balance: 200, statement_only_amount: 200 });
    const explained = one(r.json?.data);
    check("B-05b", "a line not yet in the books explains the difference", r.status === 200 && money(explained?.difference) === 200 && money(explained?.unexplained_difference) === 0, `${r.status} ${r.text.slice(0, 300)}`);

    const y2 = dayBefore(date, 2);
    r = await statement(me, { statement_date: y2, closing_balance: 50, accepted_difference: 50 });
    const accepted = one(r.json?.data);
    check("B-05c", "a difference is recorded when accepted at the amount shown", r.status === 200 && money(accepted?.unexplained_difference) === 50 && money(accepted?.accepted_difference) === 50, `${r.status} ${r.text.slice(0, 300)}`);

    const later = await postJournal("B-RCPT-2", [["1020", 10, 0], ["4090", 0, 10]]);
    check("B-06a", "the books move on", (await figures(date)) === "1635.5 1000 635.5" && !!later, await figures(date));
    const list = async (who) => (await who.api("GET", `${O}/banking/statements`)).json?.data ?? [];
    const rows = await list(me);
    check("B-06b", "all three are listed, newest date first", rows.map((s) => s.statement_date).join() === [date, y1, y2].join(), JSON.stringify(rows.map((s) => s.statement_date)));
    check("B-06c", "the record keeps the balance it was completed at", money(rows[0]?.book_balance) === 1625.5, JSON.stringify(rows[0] ?? null));
    check("B-06d", "a viewer can review them", (await list(viewer)).length === 3);
    r = await position(date, viewer);
    check("B-06d1", "and sees the real book balance, not a false zero", money(r.json?.data?.book_balance) === 1635.5, `${r.status} ${r.text.slice(0, 200)}`);
    const filtered = (await me.api("GET", `${O}/banking/statements?bank_account_id=${accountId("1010")}`)).json?.data ?? [];
    check("B-06e", "the list filters by bank account", filtered.length === 0, filtered.length);
    r = await me.api("PATCH", `${O}/banking/statements/${rows[0]?.id}`, { closing_balance: 1 });
    check("B-06f", "no route changes a record", r.status === 404 || r.status === 405, r.status);

    // Other people's companies.
    check("B-07a", "a non-member sees no completed reconciliations", (await list(outsider)).length === 0);
    r = await position(date, outsider);
    check("B-07b", "a non-member can't read the book balance", r.status === 403, `${r.status} ${r.text.slice(0, 200)}`);
    r = await statement(outsider, { statement_date: dayBefore(date, 3), closing_balance: 0 });
    check("B-07c", "a non-member can't complete a statement", r.status === 403, `${r.status} ${r.text.slice(0, 200)}`);
    r = await match(outsider, { journal_entry_line_id: line });
    check("B-07d", "a non-member can't confirm a match", r.status !== 200, r.status);
    r = await outsider.api("DELETE", `${O}/banking/reconciliations/${liveRec.id}`);
    check("B-07e", "a non-member can't undo a match", r.status === 404 && (await figures(date)).split(" ")[1] === "1000", `${r.status} ${await figures(date)}`);
    const elsewhere = "00000000-0000-4000-8000-000000000b07";
    r = await me.api("GET", `/organisations/${elsewhere}/banking/statements/position?bank_account_id=${bank}&as_of=${date}`);
    check("B-07f", "the company in the address is checked, not just the account", r.status === 403, `${r.status} ${r.text.slice(0, 200)}`);
    r = await statement(me, { statement_date: dayBefore(date, 4), closing_balance: 0, bank_account_id: elsewhere });
    check("B-07g", "an account from outside the company is refused", r.status !== 200, r.status);
    r = await statement(me, { statement_date: dayBefore(date, 4), closing_balance: 0, bank_account_id: accountId("5090") });
    check("B-07h", "an expense account is refused", r.status !== 200, r.status);
  });

  await section("B-10", "payroll and departments", async () => {
    let r = await me.api("POST", `${O}/departments`, { name: "E2E Finance", code: "e2efin" });
    const dept = one(r.json?.data);
    check("B-10a", "department created, code in capitals", r.status === 200 && dept?.code === "E2EFIN", `${r.status} ${r.text.slice(0, 200)}`);
    r = await viewer.api("POST", `${O}/departments`, { name: "E2E Viewer Dept", code: "e2eview" });
    check("B-10b", "a viewer can't create a department", r.status !== 200, r.status);

    const stamp = Date.now();
    const member = (tag, extra) =>
      me.api("POST", `${O}/members`, { name: `E2E ${tag}`, email: `e2e-staff-${tag}-${stamp}@example.com`, designation: "E2E staff", department_id: need(dept?.id, "department"), ...extra });
    // Gross less TDS less EPF = net, each one by hand.
    const a = one((await member("a", { monthly_gross: 50000, tds_deduction_monthly: 3000, epf_monthly: 6000, monthly_net: 41000 })).json?.data);
    const b = one((await member("b", { monthly_gross: 30000, tds_deduction_monthly: 0, epf_monthly: 3600, monthly_net: 26400 })).json?.data);
    const away = one((await member("c", { monthly_gross: 99999, monthly_net: 99999, status: "on_leave" })).json?.data);
    check("B-11a", "members created in the department", !!a?.id && !!b?.id && !!away?.id && a?.department_id === dept?.id, JSON.stringify(a ?? null).slice(0, 200));

    const members = async () => (await me.api("GET", `${O}/members`)).json?.data ?? [];
    const period = date.slice(0, 7);
    const run = (who) => who.api("POST", `${O}/payroll/run`, { period });
    const runs = async () => (await me.api("GET", `${O}/payroll/runs`)).json?.data ?? [];
    const before = await balances();
    const journalCount = async () => ((await me.api("GET", `${O}/journals`)).json?.data ?? []).length;
    const journalsBefore = await journalCount();

    r = await run(viewer);
    check("B-12a", "a viewer can't run payroll", r.status === 403, `${r.status} ${r.text.slice(0, 200)}`);
    check("B-12b", "and leaves no run behind", (await runs()).length === 0);

    r = await run(me);
    const result = r.json?.data;
    check("B-12c", "owner runs payroll", r.status === 200 && result?.success === true, `${r.status} ${r.text.slice(0, 300)}`);
    check("B-12d", "net 67,400, TDS 3,000, EPF 9,600, leaving out the one on leave", money(result?.total_net_disbursed) === 67400 && money(result?.total_tds) === 3000 && money(result?.total_epf) === 9600, JSON.stringify(result ?? null));
    const row = (await runs())[0];
    check("B-12e", "the run records gross 80,000", money(row?.total_gross) === 80000 && row?.period === period, JSON.stringify(row ?? null));
    // Every invitation also adds a zero-salary directory row, so the headcount isn't just the two paid here.
    const staff = await members();
    check("B-12f", "headcount is the active directory", result?.headcount === staff.filter((m) => m.status === "active").length && result?.headcount === row?.headcount, `${result?.headcount} ${staff.length}`);
    const status = (id) => staff.find((m) => m.id === id)?.payroll_status;
    check("B-12g", "active members are processed, the one on leave isn't", status(a?.id) === "processed" && status(b?.id) === "processed" && status(away?.id) === "pending", `${status(a?.id)} ${status(b?.id)} ${status(away?.id)}`);

    // run_monthly_payroll posts no journal: this pins that gap so a change to it has to be looked at.
    const after = await balances();
    check("B-13a", "payroll posts no journal (known gap): nothing reaches the ledger", (await journalCount()) === journalsBefore && moved(before, after, "5020") === 0 && moved(before, after, "1020") === 0, `${await journalCount()} vs ${journalsBefore}`);

    r = await run(me);
    check("B-13b", "re-running a month keeps one run", r.status === 200 && (await runs()).length === 1, `${r.status} ${(await runs()).length}`);
  });

  await section("B-20", "marketplace settlement", async () => {
    const lines = [
      ["gross_sales", 10000], ["refunds", 1000], ["commission", 1200], ["other_fees", 300], ["gst_on_fees", 270], ["tcs_amount", 90], ["tds_amount", 9],
    ].map(([line_type, amount], i) => ({ row_number: i + 1, line_type, amount, order_id: `B-ORD-${i + 1}` }));
    // 10,000 - 1,000 - 1,200 - 300 - 270 - 90 - 9 = 7,131.
    const settlement = {
      channel: "amazon", settlement_ref: "B-AMZ-1", period_from: date, period_to: date,
      gross_sales: 10000, refunds: 1000, commission: 1200, other_fees: 300, gst_on_fees: 270, tcs_amount: 90, tds_amount: 9, net_payout: 7131, source_filename: "e2e-settlement.csv",
    };
    const create = (who, body) => who.api("POST", `${O}/marketplace/settlements`, body);

    let r = await create(me, { settlement: { ...settlement, settlement_ref: "B-AMZ-BAD", net_payout: 7131.01 }, lines });
    check("B-20a", "a net payout that doesn't follow from the deductions is refused", r.status !== 200, r.status);
    r = await create(me, { settlement: { ...settlement, settlement_ref: "B-AMZ-BAD" }, lines: lines.filter((l) => l.line_type !== "tds_amount") });
    check("B-20b", "lines that don't add up to the header are refused", r.status !== 200 && /tds_amount lines 0 vs header 9\.00/.test(r.text), `${r.status} ${r.text.slice(0, 300)}`);
    r = await create(viewer, { settlement, lines });
    check("B-20c", "a viewer can't import", r.status === 403, `${r.status} ${r.text.slice(0, 200)}`);

    const before = await balances();
    r = await create(me, { settlement, lines });
    const id = need(one(r.json?.data)?.id, `settlement: ${r.status} ${r.text.slice(0, 300)}`);
    check("B-21a", "settlement imported", r.status === 200, r.status);
    const stored = one((await me.api("GET", `${O}/marketplace/settlements/${id}`)).json?.data);
    check("B-21b", "with its seven lines", stored?.marketplace_settlement_lines?.length === 7, JSON.stringify(stored ?? null).slice(0, 200));
    let after = await balances();
    check("B-21c", "importing doesn't touch the ledger", ["1020", "1040", "5091"].every((c) => moved(before, after, c) === 0));

    const post = (who) => who.api("POST", `${O}/marketplace/settlements/${id}/post`, {});
    r = await post(viewer);
    check("B-22a", "a viewer can't post it", r.status === 403, `${r.status} ${r.text.slice(0, 200)}`);

    r = await post(me);
    const entry = one(r.json?.entry);
    check("B-22b", "posted as one voucher", r.status === 200 && entry?.status === "posted" && entry?.entry_number === "MKT-AMAZON-B-AMZ-1", `${r.status} ${r.text.slice(0, 300)}`);
    after = await balances();
    check("B-22c", "marketplace clearing credited 9,000 (sales less refunds)", moved(before, after, "1040") === -9000, moved(before, after, "1040"));
    check("B-22d", "commission and fees debited 1,500", moved(before, after, "5091") === 1500, moved(before, after, "5091"));
    check("B-22e", "bank debited the net payout, 7,131", moved(before, after, "1020") === 7131, moved(before, after, "1020"));
    check("B-22f", "input IGST 270, TCS 90, TDS 9", moved(before, after, "1083") === 270 && moved(before, after, "1084") === 90 && moved(before, after, "1085") === 9, `${moved(before, after, "1083")} ${moved(before, after, "1084")} ${moved(before, after, "1085")}`);
    const posted = (await me.api("GET", `${O}/marketplace/settlements`)).json?.data?.find((s) => s.id === id);
    check("B-22g", "the settlement links its voucher", posted?.journal_entry_id === entry?.id && posted?.journal_entries?.status === "posted", JSON.stringify(posted ?? null).slice(0, 300));

    r = await post(me);
    check("B-23a", "posting twice is refused", r.status !== 200 && /already has a voucher/.test(r.text), `${r.status} ${r.text.slice(0, 200)}`);
    const again = await balances();
    check("B-23b", "and moves nothing", ["1020", "1040", "1083", "1084", "1085", "5091"].every((c) => moved(after, again, c) === 0));
    r = await me.api("DELETE", `${O}/marketplace/settlements/${id}`);
    check("B-23c", "a posted settlement can't be deleted", r.status === 404, r.status);
    r = await create(me, { settlement, lines });
    check("B-23d", "the same settlement can't be imported twice", r.status !== 200, r.status);
    const tb = (await me.api("GET", `${O}/reports/trial-balance`)).json?.data ?? [];
    const sum = (key) => money(tb.reduce((n, row) => n + Number(row[key] || 0), 0));
    check("B-24", "trial balance still balances", sum("total_debit") === sum("total_credit"), `${sum("total_debit")} ${sum("total_credit")}`);
  });
}
