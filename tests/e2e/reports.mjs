// Dated reports and the General Ledger through the real API. Runs on the ledger tests/e2e/workflows.mjs leaves:
// everything there is dated in the current financial year, so totals are compared with the undated trial balance.
// Two vouchers go into the previous year, whose figures are worked out by hand:
//   15 Jun  Dr 5090 charges 100.50  Cr 1020 bank 100.50
//   20 Jul  Dr 1020 bank     40.00  Cr 4010 sales 40.00
//   25 Jul  draft Dr 5090 999  Cr 1020 999, which must never count

export async function runReportChecks({ me, org, date, fy, check }) {
  const O = `/organisations/${org}`;
  const round = (n) => Math.round(n * 100) / 100;
  const sum = (rows, key) => round(rows.reduce((a, r) => a + Number(r[key] || 0), 0));
  const get = (path) => me.api("GET", `${O}/reports/${path}`);
  const rows = async (path) => {
    const r = await get(path);
    if (r.status !== 200) throw new Error(`${path}: ${r.status} ${r.text.slice(0, 200)}`);
    return r.json?.data ?? [];
  };
  const totals = (tb) => ({ debit: sum(tb, "total_debit"), credit: sum(tb, "total_credit") });
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const byCode = (list) => Object.fromEntries(list.map((r) => [r.account_code, r]));
  const sides = (bs) => {
    const of = (t) => sum(bs.filter((r) => r.account_type === t), "balance");
    return { assets: of("asset"), liabilities: of("liability"), equity: of("equity"), profit: sum(bs.filter((r) => r.account_id === null), "balance") };
  };

  try {
    const fyRange = `from=${fy.start_date}&to=${fy.end_date}`;
    const undated = await rows("trial-balance");
    const before = totals(undated);
    const ledgerProfit = round(
      undated.filter((r) => r.account_type === "income" || r.account_type === "expense").reduce((a, r) => a + Number(r.total_credit) - Number(r.total_debit), 0)
    );

    const dated = await rows(`trial-balance?${fyRange}`);
    check("R-01a", "this year's trial balance has the same totals as the undated one", before.debit > 0 && same(totals(dated), before), `${JSON.stringify(totals(dated))} ${JSON.stringify(before)}`);
    const undatedBy = byCode(undated);
    check("R-01b", "and the same figure for every account", dated.length === undated.length && dated.every((r) => Number(r.total_debit) === Number(undatedBy[r.account_code]?.total_debit) && Number(r.total_credit) === Number(undatedBy[r.account_code]?.total_credit)), `${dated.length} ${undated.length}`);

    const pl = await rows(`profit-and-loss?${fyRange}`);
    const net = (list) => round(sum(list.filter((r) => r.account_type === "income"), "net_amount") - sum(list.filter((r) => r.account_type === "expense"), "net_amount"));
    check("R-02", "this year's profit agrees with the trial balance", net(pl) === ledgerProfit, `${net(pl)} ${ledgerProfit}`);
    check("R-02b", "one profit and loss row per account", new Set(pl.map((r) => r.account_id)).size === pl.length, pl.length);

    const bsToday = sides(await rows(`balance-sheet?as_of=${date}`));
    check("R-03", "today's balance sheet balances, with profit inside equity", round(bsToday.assets - bsToday.liabilities - bsToday.equity) === 0, JSON.stringify(bsToday));
    const bsYearEnd = sides(await rows(`balance-sheet?as_of=${fy.end_date}`));
    check("R-03b", "its accumulated profit is the ledger's", bsYearEnd.profit === ledgerProfit, `${bsYearEnd.profit} ${ledgerProfit}`);

    // Year 2000 has no entries at all.
    const toDate = await rows(`trial-balance?to=${date}`);
    const totalOf = (list, key) => Math.round(list.reduce((a, r) => a + Number(r[key] || 0), 0) * 100) / 100;
    check("R-tb-to", "balances to date match the undated trial balance", totalOf(toDate, "total_debit") === totalOf(undated, "total_debit"), `${totalOf(toDate, "total_debit")} ${totalOf(undated, "total_debit")}`);
    const tb2000 = await rows("trial-balance?from=2000-01-01&to=2000-12-31");
    check("R-04a", "year 2000: trial balance totals are zero", same(totals(tb2000), { debit: 0, credit: 0 }), JSON.stringify(totals(tb2000)));
    const pl2000 = await rows("profit-and-loss?from=2000-01-01&to=2000-12-31");
    check("R-04b", "year 2000: profit and loss is empty", pl2000.length === 0, pl2000.length);
    const bs2000 = await rows("balance-sheet?as_of=2000-12-31");
    check("R-04c", "year 2000: balance sheet is empty", bs2000.length === 0, bs2000.length);
    const cf2000 = (await get("cash-flow?start_date=2000-01-01&end_date=2000-12-31")).json?.data;
    check("R-04d", "year 2000: cash flow is all zero", Number(cf2000?.opening_cash_equivalents) === 0 && Number(cf2000?.net_change_in_cash) === 0 && Number(cf2000?.closing_cash_equivalents) === 0, JSON.stringify(cf2000 ?? null).slice(0, 200));

    const bad = await get("trial-balance?from=not-a-date&to=2026-01-01");
    check("R-05", "a bad date is refused as bad input", bad.status === 400, `${bad.status} ${bad.text.slice(0, 200)}`);

    // The previous financial year, empty until now.
    const y = Number(fy.start_date.slice(0, 4)) - 1;
    const prior = { name: `FY ${y}-${y + 1}`, start_date: `${y}-04-01`, end_date: `${y + 1}-03-31` };
    const made = await me.api("POST", `${O}/fiscal-periods`, prior);
    if (made.status !== 200) throw new Error(`fiscal period: ${made.status} ${made.text.slice(0, 200)}`);
    const period = ((await me.api("GET", `${O}/fiscal-periods`)).json?.data ?? []).find((p) => p.start_date === prior.start_date)?.id;
    const accounts = byCode(((await me.api("GET", `${O}/accounts`)).json?.data ?? []).map((a) => ({ ...a, account_code: a.code })));
    const voucher = async (number, entry_date, dr, cr, amount, post = true) => {
      const r = await me.api("POST", `${O}/journals`, {
        fiscal_period_id: period,
        entry_number: number,
        entry_date,
        narration: `E2E ${number}`,
        lines: [
          { line_number: 1, account_id: accounts[dr].id, debit: amount, credit: 0 },
          { line_number: 2, account_id: accounts[cr].id, debit: 0, credit: amount },
        ],
      });
      const id = r.json?.entry?.[0]?.id;
      if (!id) throw new Error(`voucher ${number}: ${r.status} ${r.text.slice(0, 200)}`);
      if (!post) return;
      const p = await me.api("POST", `${O}/journals/${id}/post`);
      if (p.status !== 200) throw new Error(`post ${number}: ${p.status} ${p.text.slice(0, 200)}`);
    };
    await voucher("R-1", `${y}-06-15`, "5090", "1020", 100.5);
    await voucher("R-2", `${y}-07-20`, "1020", "4010", 40);
    await voucher("R-3", `${y}-07-25`, "5090", "1020", 999, false);

    const priorRange = `from=${prior.start_date}&to=${prior.end_date}`;
    const tbPrior = await rows(`trial-balance?${priorRange}`);
    check("R-06a", "last year's trial balance: 140.50 each side, no draft", same(totals(tbPrior), { debit: 140.5, credit: 140.5 }), JSON.stringify(totals(tbPrior)));
    const p = byCode(tbPrior);
    check("R-06b", "bank Dr 40, Cr 100.50; charges Dr 100.50; sales Cr 40", Number(p["1020"]?.total_debit) === 40 && Number(p["1020"]?.total_credit) === 100.5 && Number(p["5090"]?.total_debit) === 100.5 && Number(p["4010"]?.total_credit) === 40, JSON.stringify([p["1020"], p["5090"], p["4010"]]).slice(0, 300));
    const oneDay = await rows(`trial-balance?from=${y}-06-15&to=${y}-06-15`);
    check("R-06c", "a one-day range includes that day only", same(totals(oneDay), { debit: 100.5, credit: 100.5 }), JSON.stringify(totals(oneDay)));

    check("R-07a", "this year's totals don't change", same(totals(await rows(`trial-balance?${fyRange}`)), before));
    const after = await rows("trial-balance");
    check("R-07b", "the undated totals grow by 140.50, not the draft", same(totals(after), { debit: round(before.debit + 140.5), credit: round(before.credit + 140.5) }), JSON.stringify(totals(after)));

    const plPrior = byCode(await rows(`profit-and-loss?${priorRange}`));
    check("R-08", "last year's profit and loss: income 40, expenses 100.50", Number(plPrior["4010"]?.net_amount) === 40 && Number(plPrior["5090"]?.net_amount) === 100.5 && Object.keys(plPrior).length === 2, JSON.stringify(plPrior).slice(0, 300));

    const mid = sides(await rows(`balance-sheet?as_of=${y}-06-30`));
    check("R-09a", "as of 30 June: bank -100.50 against a loss of 100.50", same(mid, { assets: -100.5, liabilities: 0, equity: -100.5, profit: -100.5 }), JSON.stringify(mid));
    const yearEnd = sides(await rows(`balance-sheet?as_of=${prior.end_date}`));
    check("R-09b", "at last year's end: bank -60.50 against a loss of 60.50", same(yearEnd, { assets: -60.5, liabilities: 0, equity: -60.5, profit: -60.5 }), JSON.stringify(yearEnd));
    const now = sides(await rows(`balance-sheet?as_of=${fy.end_date}`));
    check("R-09c", "today's sheet still balances, 60.50 less profit", round(now.assets - now.liabilities - now.equity) === 0 && now.profit === round(ledgerProfit - 60.5), JSON.stringify(now));

    const cf = (await get(`cash-flow?start_date=${fy.start_date}&end_date=${fy.end_date}`)).json?.data;
    check("R-10", "this year's cash flow opens at -60.50", Number(cf?.opening_cash_equivalents) === -60.5, JSON.stringify(cf ?? null).slice(0, 200));

    const gl = await rows(`general-ledger?account_id=${accounts["5090"].id}`);
    check("R-11a", "the ledger for one account has only that account", gl.length > 0 && gl.every((r) => r.account_code === "5090"), gl.length);
    const opening = round(gl.filter((r) => r.entry_date < fy.start_date).reduce((a, r) => a + Number(r.debit) - Number(r.credit), 0));
    check("R-11b", "opening balance at the year's start is Dr 100.50, no draft", opening === 100.5, opening);
    const closing = round(gl.reduce((a, r) => a + Number(r.debit) - Number(r.credit), 0));
    const closed = byCode(after)["5090"];
    check("R-11c", "the running balance ends on the trial balance figure", closing === round(Number(closed.total_debit) - Number(closed.total_credit)), `${closing} ${closed?.total_debit} ${closed?.total_credit}`);
    const posted = gl.find((r) => r.entry_number === "R-1");
    check("R-11d", "a line carries its date, narration and amount", posted?.entry_date === `${y}-06-15` && posted?.narration === "E2E R-1" && Number(posted?.debit) === 100.5 && Number(posted?.credit) === 0, JSON.stringify(posted ?? null).slice(0, 300));
    const all = await rows("general-ledger");
    check("R-11e", "without an account the route still lists every account", new Set(all.map((r) => r.account_code)).size > 1, all.length);
  } catch (e) {
    check("R-00", "report checks: stopped early", false, e?.message ?? e);
  }
}
