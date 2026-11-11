// Business modules through the real API, with figures worked out by hand (plan section 10).
// Each step's asserts build on the last, so a failed section is reported and later ones still run.

export async function runWorkflows({ me, org, fy, date, check, invite, login, signup, voucherPeriod, accounts, viewer, base, PASSWORD }) {
  const O = `/organisations/${org}`;
  const accountId = (code) => accounts.find((a) => a.code === code)?.id;

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

  // Debit minus credit per account code, from the trial balance users see.
  const balances = async () => {
    const rows = (await me.api("GET", `${O}/reports/trial-balance`)).json?.data ?? [];
    return Object.fromEntries(rows.map((r) => [r.account_code, Number(r.total_debit) - Number(r.total_credit)]));
  };
  const moved = (before, after, code) => Math.round(((after[code] ?? 0) - (before[code] ?? 0)) * 100) / 100;

  const journal = (number, lines) => ({
    fiscal_period_id: voucherPeriod,
    entry_number: number,
    entry_date: date,
    narration: `E2E ${number}`,
    lines: lines.map(([code, debit, credit, party_id], i) => ({ line_number: i + 1, account_id: need(accountId(code), `account ${code}`), party_id, debit, credit })),
  });
  const postJournal = async (number, lines) => {
    const r = await me.api("POST", `${O}/journals`, journal(number, lines));
    const id = need(r.json?.entry?.[0]?.id, `journal ${number}: ${r.text.slice(0, 200)}`);
    const p = await me.api("POST", `${O}/journals/${id}/post`);
    if (p.status !== 200) throw new Error(`post ${number}: ${p.status} ${p.text.slice(0, 200)}`);
    return id;
  };

  const invoiceLine = (n, name, qty, price, rate, interState, item_id) => {
    const taxable = qty * price;
    const half = (taxable * rate) / 200;
    return {
      line_number: n,
      item_id,
      item_name: name,
      hsn_sac_code: "8471",
      unit_code: "NOS",
      quantity: qty,
      unit_price: price,
      gst_rate: rate,
      cgst_rate: interState ? 0 : rate / 2,
      cgst_amount: interState ? 0 : half,
      sgst_rate: interState ? 0 : rate / 2,
      sgst_amount: interState ? 0 : half,
      igst_rate: interState ? rate : 0,
      igst_amount: interState ? half * 2 : 0,
      taxable_amount: taxable,
      total_amount: taxable + half * 2,
    };
  };
  const issueInvoice = async (number, customer, interState, lines) => {
    const taxable = lines.reduce((a, l) => a + l.taxable_amount, 0);
    const total = lines.reduce((a, l) => a + l.total_amount, 0);
    const r = await me.api("POST", `${O}/invoices`, {
      customer_id: customer,
      invoice_number: number,
      invoice_date: date,
      due_date: date,
      supply_type: interState ? "inter_state" : "intra_state",
      place_of_supply: interState ? "24-Gujarat" : "27-Maharashtra",
      taxable_amount: taxable,
      total_amount: total,
      lines,
    });
    const id = need(r.json?.invoice?.[0]?.id, `invoice ${number}: ${r.status} ${r.text.slice(0, 300)}`);
    const issued = await me.api("POST", `${O}/invoices/${id}/issue`, { create_journal: true });
    if (issued.status !== 200) throw new Error(`issue ${number}: ${issued.status} ${issued.text.slice(0, 300)}`);
    return id;
  };

  const ids = {};

  await section("M-01", "masters", async () => {
    const parties = [
      ["customerA", "customer", "E2E Maharashtra Buyer", "27AAPFU0939F1ZV"],
      ["customerB", "customer", "E2E Gujarat Buyer", "24AAACC1206D1ZM"],
      ["vendor", "vendor", "E2E Karnataka Supplier", "29AABCT1332L1ZA"],
    ];
    for (const [key, type, name, gstin] of parties) {
      const r = await me.api("POST", `${O}/parties`, { type, legal_name: name, display_name: name, gstin });
      check(`M-01-${key}`, `create ${key}`, r.status === 200, `${r.status} ${r.text.slice(0, 200)}`);
    }
    const list = (await me.api("GET", `${O}/parties`)).json?.data ?? [];
    for (const [key, , name] of parties) ids[key] = list.find((p) => p.legal_name === name)?.id;
    const r = await me.api("POST", `${O}/parties`, { type: "customer", legal_name: "E2E Bad GSTIN", display_name: "E2E Bad GSTIN", gstin: "27AAPFU0939F1ZX" });
    check("M-01-gstin", "a GSTIN with a wrong check digit is refused", r.status !== 200, r.status);
    const item = await me.api("POST", `${O}/catalogue`, {
      type: "goods", name: "E2E Widget", sku: "E2E-W", hsn_sac_code: "8471", unit_code: "NOS", default_unit_price: 500, default_gst_rate: 18, track_inventory: true,
    });
    check("M-01-item", "create a stocked product", item.status === 200, `${item.status} ${item.text.slice(0, 200)}`);
    ids.item = ((await me.api("GET", `${O}/catalogue`)).json?.data ?? []).find((i) => i.name === "E2E Widget")?.id;
  });

  await section("M-02", "sales", async () => {
    const before = await balances();
    ids.saleA = await issueInvoice("E2E-S-1", need(ids.customerA, "customer"), false, [invoiceLine(1, "E2E consulting", 2, 1000, 18, false)]);
    const after = await balances();
    check("M-02a", "intra-state sale: debtors up 2,360", moved(before, after, "1030") === 2360, JSON.stringify(moved(before, after, "1030")));
    check("M-02b", "CGST 180 and SGST 180 payable", moved(before, after, "2081") === -180 && moved(before, after, "2082") === -180, `${moved(before, after, "2081")} ${moved(before, after, "2082")}`);
    const inv = (await me.api("GET", `${O}/invoices/${ids.saleA}`)).json?.data;
    const header = Array.isArray(inv) ? inv[0] : inv;
    check("M-02c", "invoice is issued with its journal", header?.status === "issued" && !!header?.journal_entry_id, JSON.stringify(header ?? {}).slice(0, 200));

    const beforeB = await balances();
    await issueInvoice("E2E-S-2", need(ids.customerB, "customer"), true, [invoiceLine(1, "E2E consulting", 1, 1000, 18, true)]);
    const afterB = await balances();
    check("M-02d", "inter-state sale: IGST 180, no CGST or SGST", moved(beforeB, afterB, "2083") === -180 && moved(beforeB, afterB, "2081") === 0, `${moved(beforeB, afterB, "2083")} ${moved(beforeB, afterB, "2081")}`);
  });

  await section("M-03", "collection", async () => {
    const before = await balances();
    await postJournal("E2E-R-1", [["1020", 2360, 0], ["1030", 0, 2360, need(ids.customerA, "customer")]]);
    const after = await balances();
    check("M-03a", "receipt: debtors down 2,360, bank up 2,360", moved(before, after, "1030") === -2360 && moved(before, after, "1020") === 2360, `${moved(before, after, "1030")} ${moved(before, after, "1020")}`);
    const r = await me.api("GET", `${O}/reports/party-ageing?side=receivable`);
    const row = (r.json?.data ?? []).find((p) => p.party_id === ids.customerA);
    check("M-03b", "the paid customer shows nothing outstanding", r.status === 200 && Number(row?.outstanding ?? row?.balance ?? 0) === 0, JSON.stringify(row ?? r.text).slice(0, 300));
  });

  await section("M-04", "purchases", async () => {
    const opening = await me.api("POST", `${O}/inventory/adjustments`, { item_id: need(ids.item, "item"), kind: "opening", direction: "in", qty: 10, unit_cost: 100, date, reason: "E2E opening" });
    check("M-05a", "opening stock recorded", opening.status === 200, `${opening.status} ${opening.text.slice(0, 200)}`);
    const before = await balances();
    const r = await me.api("POST", `${O}/purchases`, {
      party_id: need(ids.vendor, "vendor"),
      supplier_name: "E2E Karnataka Supplier",
      supplier_gstin: "29AABCT1332L1ZA",
      bill_number: "E2E-B-1",
      bill_date: date,
      place_of_supply: "27",
      taxable_amount: 600,
      // Karnataka supplier into Maharashtra, so IGST.
      cgst: 0,
      sgst: 0,
      igst: 108,
      cess: 0,
      total_amount: 708,
      itc_eligibility: "eligible",
      lines: [{ item_id: need(ids.item, "item"), quantity: 5, rate: 120 }],
    });
    const bill = Array.isArray(r.json?.data) ? r.json.data[0] : r.json?.data;
    check("M-04a", "purchase bill saved", r.status === 200 && !!bill?.id, `${r.status} ${r.text.slice(0, 300)}`);
    const entry = await postJournal("E2E-P-1", [["5010", 600, 0], ["1083", 108, 0], ["2010", 0, 708, ids.vendor]]);
    const link = await me.api("PATCH", `${O}/purchases/${need(bill?.id, "bill")}`, { journal_entry_id: entry });
    check("M-04b", "bill links to its journal", link.status === 200, `${link.status} ${link.text.slice(0, 200)}`);
    const after = await balances();
    check("M-04c", "vendor payable 708 and input IGST 108", moved(before, after, "2010") === -708 && moved(before, after, "1083") === 108, `${moved(before, after, "2010")} ${moved(before, after, "1083")}`);
  });

  await section("M-05", "stock", async () => {
    // 10 opening at 100, then the 5 bought at 120 above, then 3 sold first-in-first-out.
    const summary = async () => ((await me.api("GET", `${O}/inventory/summary`)).json?.data ?? []).find((s) => s.item_id === ids.item);
    let s = await summary();
    check("M-05b", "15 on hand worth 1,600", Number(s?.qty_on_hand) === 15 && Number(s?.fifo_value) === 1600, JSON.stringify(s ?? null));
    await issueInvoice("E2E-S-3", need(ids.customerA, "customer"), false, [invoiceLine(1, "E2E Widget", 3, 500, 18, false, ids.item)]);
    s = await summary();
    check("M-05c", "after selling 3: 12 on hand worth 1,300", Number(s?.qty_on_hand) === 12 && Number(s?.fifo_value) === 1300, JSON.stringify(s ?? null));
    const tooMany = await me.api("POST", `${O}/invoices`, {
      customer_id: ids.customerA, invoice_number: "E2E-S-X", invoice_date: date, due_date: date, supply_type: "intra_state", place_of_supply: "27-Maharashtra",
      taxable_amount: 50000, total_amount: 59000, lines: [invoiceLine(1, "E2E Widget", 100, 500, 18, false, ids.item)],
    });
    const issued = await me.api("POST", `${O}/invoices/${tooMany.json?.invoice?.[0]?.id}/issue`, { create_journal: true });
    check("M-05d", "can't sell more stock than is on hand", issued.status !== 200, issued.status);
  });

  await section("M-06", "credit note", async () => {
    const before = await balances();
    const r = await me.api("POST", `${O}/notes`, {
      original_invoice_id: need(ids.saleA, "invoice"),
      note_type: "credit",
      note_number: "E2E-CN-1",
      note_date: date,
      reason_code: "post_sale_discount",
      reason: "E2E discount",
      lines: [invoiceLine(1, "E2E consulting", 1, 1000, 18, false)],
    });
    const note = need(r.json?.note?.[0]?.id, `note: ${r.status} ${r.text.slice(0, 300)}`);
    const issued = await me.api("POST", `${O}/notes/${note}/issue`, { create_journal: true });
    check("M-06a", "credit note issued", issued.status === 200, `${issued.status} ${issued.text.slice(0, 300)}`);
    const after = await balances();
    check("M-06b", "debtors down 1,180 and output GST down 180", moved(before, after, "1030") === -1180 && moved(before, after, "2081") === 90 && moved(before, after, "2082") === 90, `${moved(before, after, "1030")} ${moved(before, after, "2081")}`);
  });

  await section("M-07", "GST returns", async () => {
    const noGstin = await me.api("GET", `${O}/gst/${date.slice(5, 7)}${date.slice(0, 4)}/gstr1`);
    check("M-07-gstin", "a return can't be exported without a company GSTIN", noGstin.json?.data?.json === null && (noGstin.json?.data?.errors ?? []).length > 0, noGstin.text.slice(0, 200));
    const profile = await me.api("PATCH", `${O}/settings`, { gstin: "27AAACR5055K1Z7", state_code: "27" });
    check("M-07-profile", "company GSTIN saved", profile.status === 200, `${profile.status} ${profile.text.slice(0, 200)}`);
    const period = `${date.slice(5, 7)}${date.slice(0, 4)}`;
    const g1 = await me.api("GET", `${O}/gst/${period}/gstr1`);
    const text = JSON.stringify(g1.json?.data ?? {});
    check("M-07a", "GSTR-1 lists the invoices and the credit note", g1.status === 200 && text.includes("E2E-S-1") && text.includes("E2E-S-2") && text.includes("E2E-CN-1"), `${g1.status} ${text.slice(0, 300)}`);
    const g3 = await me.api("GET", `${O}/gst/${period}/gstr3b`);
    const o = g3.json?.data?.json?.sup_details?.osup_det;
    // 2,000 + 1,000 + 1,500 sold, less the 1,000 credit note.
    check("M-07b", "GSTR-3B outward: taxable 3,500, CGST 225, SGST 225, IGST 180", Number(o?.txval) === 3500 && Number(o?.camt) === 225 && Number(o?.samt) === 225 && Number(o?.iamt) === 180, JSON.stringify(o ?? g3.text.slice(0, 300)));
    const itc = g3.json?.data?.json?.itc_elg?.itc_net;
    check("M-07c", "GSTR-3B net ITC: IGST 108", Number(itc?.iamt) === 108 && Number(itc?.camt) === 0, JSON.stringify(itc ?? null));
  });

  await section("M-08", "maker-checker", async () => {
    const email = `e2e-accountant-${Date.now()}@example.com`;
    await me.api("POST", `/organisations/${org}/invitations`, { email, role: "accountant" });
    const accountant = await signup("accountant", email, await invite(email));
    const accept = await accountant.s.api("POST", "/organisations/invitations/accept", { token: await invite(email) });
    check("M-08a", "accountant joins", accept.status === 200, `${accept.status} ${accept.text.slice(0, 200)}`);
    const on = await me.api("PATCH", `${O}/settings`, { require_journal_approval: true });
    check("M-08b", "approval turned on", on.status === 200, `${on.status} ${on.text.slice(0, 200)}`);

    const before = await balances();
    const r = await accountant.s.api("POST", `${O}/journals`, journal("E2E-MC-1", [["5090", 500, 0], ["1020", 0, 500]]));
    const id = need(r.json?.entry?.[0]?.id, `maker's voucher: ${r.text.slice(0, 200)}`);
    const direct = await accountant.s.api("POST", `${O}/journals/${id}/post`);
    check("M-08c", "maker can't post directly", direct.status !== 200, direct.status);
    const submitted = await accountant.s.api("POST", `${O}/journals/${id}/submit`);
    check("M-08d", "maker submits for approval", submitted.status === 200, `${submitted.status} ${submitted.text.slice(0, 200)}`);
    const sentBack = await me.api("POST", `${O}/journals/${id}/reject`, { reason: "E2E please check" });
    check("M-08d1", "checker sends it back", sentBack.status === 200, `${sentBack.status} ${sentBack.text.slice(0, 200)}`);
    const resubmitted = await accountant.s.api("POST", `${O}/journals/${id}/submit`);
    check("M-08d2", "maker resubmits it", resubmitted.status === 200, `${resubmitted.status} ${resubmitted.text.slice(0, 200)}`);
    const self = await accountant.s.api("POST", `${O}/journals/${id}/post`);
    check("M-08e", "maker can't approve their own voucher", self.status !== 200, self.status);
    check("M-08f", "nothing reaches the ledger before approval", moved(before, await balances(), "5090") === 0);
    const approved = await me.api("POST", `${O}/journals/${id}/post`);
    check("M-08g", "another approver posts it", approved.status === 200, `${approved.status} ${approved.text.slice(0, 200)}`);
    check("M-08h", "it reaches the ledger after approval", moved(before, await balances(), "5090") === 500);
    await me.api("PATCH", `${O}/settings`, { require_journal_approval: false });
  });

  await section("M-09", "reversal", async () => {
    const before = await balances();
    const id = await postJournal("E2E-REV-1", [["5090", 77, 0], ["1020", 0, 77]]);
    check("M-09a", "voucher moves the ledger", moved(before, await balances(), "5090") === 77);
    const r = await me.api("POST", `${O}/journals/${id}/reverse`, { reversal_date: date, narration: "E2E reversal" });
    check("M-09b", "voucher reversed", r.status === 200, `${r.status} ${r.text.slice(0, 200)}`);
    const after = await balances();
    check("M-09c", "reversal nets to zero", moved(before, after, "5090") === 0 && moved(before, after, "1020") === 0, `${moved(before, after, "5090")} ${moved(before, after, "1020")}`);
    const row = ((await me.api("GET", `${O}/journals`)).json?.data ?? []).find((j) => j.id === id);
    check("M-09d", "the original stays visible as reversed", row?.status === "reversed", row?.status);
  });

  await section("M-10", "quotation", async () => {
    const before = await balances();
    const r = await me.api("POST", `${O}/business-documents`, {
      doc: { doc_type: "quotation", doc_number: "E2E-QT-1", doc_date: date, valid_until: date, party_id: need(ids.customerA, "customer"), party_snapshot: { name: "E2E Maharashtra Buyer" }, place_of_supply: "27-Maharashtra", supply_type: "intra_state" },
      lines: [invoiceLine(1, "E2E quoted work", 1, 1000, 18, false)],
    });
    const doc = Array.isArray(r.json?.data) ? r.json.data[0] : r.json?.data;
    check("M-10a", "quotation saved with computed total", r.status === 200 && Number(doc?.total_amount) === 1180, `${r.status} ${r.text.slice(0, 300)}`);
    const converted = await me.api("POST", `${O}/business-documents/${need(doc?.id, "document")}/convert`, { invoice_number: "E2E-S-Q1" });
    check("M-10b", "quotation converts", converted.status === 200, `${converted.status} ${converted.text.slice(0, 300)}`);
    const invoice = ((await me.api("GET", `${O}/invoices`)).json?.data ?? []).find((i) => i.invoice_number === "E2E-S-Q1");
    check("M-10c", "the result is a draft invoice", invoice?.status === "draft" && Number(invoice?.total_amount) === 1180, JSON.stringify(invoice ?? null).slice(0, 200));
    check("M-10d", "the ledger doesn't move", moved(before, await balances(), "1030") === 0);
  });

  await section("M-11", "import", async () => {
    const rows = [{ row: 1, name: "E2E Imported Buyer", type: "customer", gstin: "27AABCS1429B1ZU" }];
    const r = await me.api("POST", `${O}/imports`, { kind: "parties", source: "csv", filename: "e2e.csv", row_count: 1 });
    const job = Array.isArray(r.json?.data) ? r.json.data[0] : r.json?.data;
    check("M-11a", "import job created", r.status === 200 && !!job?.id, `${r.status} ${r.text.slice(0, 200)}`);
    const applied = await me.api("POST", `${O}/imports/${need(job?.id, "job")}/apply`, { rows });
    check("M-11b", "import applies", applied.status === 200, `${applied.status} ${applied.text.slice(0, 300)}`);
    const list = (await me.api("GET", `${O}/parties`)).json?.data ?? [];
    check("M-11c", "the party exists", list.some((p) => p.legal_name === "E2E Imported Buyer"));
    const again = await me.api("POST", `${O}/imports/${job.id}/apply`, { rows });
    check("M-11d", "a job can't apply twice", again.status !== 200, again.status);
  });

  await section("M-12", "reports reconcile", async () => {
    const tb = (await me.api("GET", `${O}/reports/trial-balance`)).json?.data ?? [];
    const sum = (rows, key) => Math.round(rows.reduce((a, r) => a + Number(r[key] || 0), 0) * 100) / 100;
    check("M-12a", "trial balance debits equal credits", sum(tb, "total_debit") === sum(tb, "total_credit"), `${sum(tb, "total_debit")} ${sum(tb, "total_credit")}`);

    const typed = (t) => tb.filter((r) => r.account_type === t);
    const net = (rows) => Math.round((sum(rows, "total_credit") - sum(rows, "total_debit")) * 100) / 100;
    const profit = Math.round((net(typed("income")) + net(typed("expense"))) * 100) / 100;

    const pl = (await me.api("GET", `${O}/reports/profit-and-loss`)).json?.data ?? [];
    check("M-12b", "P&L agrees with the trial balance", net(pl) === profit, `P&L ${net(pl)} TB ${profit}`);

    const bs = (await me.api("GET", `${O}/reports/balance-sheet`)).json?.data ?? [];
    const byType = (t) => bs.filter((r) => r.account_type === t);
    const assets = -net(byType("asset"));
    const claims = net(byType("liability")) + net(byType("equity")) + profit;
    check("M-12c", "assets = liabilities + equity + profit", Math.round((assets - claims) * 100) / 100 === 0, `assets ${assets} claims ${claims}`);

    const revenue = net(typed("income"));
    const current = (await me.api("GET", `${O}/reports/fpa-metrics?start_date=${fy.start_date}&end_date=${date}`)).json?.data;
    check("M-12d", "FP&A revenue agrees with the ledger", Number(current?.profitability?.total_revenue) === revenue, `${current?.profitability?.total_revenue} ${revenue}`);
    const past = (await me.api("GET", `${O}/reports/fpa-metrics?start_date=2000-01-01&end_date=2000-12-31`)).json?.data;
    check("M-12e", "a date filter narrows the results", Number(past?.profitability?.total_revenue) === 0, JSON.stringify(past?.profitability ?? null));
  });

  await section("S-06", "passwords", async () => {
    const newPassword = "e2e-Changed-Passw0rd!";
    const change = (who, current, next) =>
      fetch(`${base}/api/auth/password`, {
        method: "POST",
        headers: { Cookie: `deku_at=${who.cookies.deku_at}`, "Content-Type": "application/json" },
        body: JSON.stringify({ current_password: current, new_password: next }),
      });
    const session = (await login(viewer.email)).s;
    let r = await change(session, "not-the-password", newPassword);
    check("S-06a", "wrong current password is refused", r.status === 401, r.status);
    r = await change(session, PASSWORD, "short");
    check("S-06b", "a short new password is refused", r.status === 400, r.status);
    r = await change(session, PASSWORD, newPassword);
    check("S-06c", "password changes", r.status === 200, r.status);
    check("S-06d", "the old password stops working", (await login(viewer.email)).r.status === 401);
    const relogin = await login(viewer.email, newPassword);
    check("S-06e", "the new password works", relogin.r.status === 200, relogin.r.status);

    const members = (await me.api("GET", `${O}/workbench-members`)).json?.data ?? [];
    const member = need(members.find((m) => m.profiles?.email === viewer.email || m.user_id === relogin.r.json?.user?.id), "viewer's member row");
    const viewerTry = await relogin.s.api("POST", `${O}/workbench-members/${member.id}/password-reset`);
    check("S-06f", "a viewer can't create a reset link", viewerTry.status !== 200, viewerTry.status);
    const link = await me.api("POST", `${O}/workbench-members/${member.id}/password-reset`);
    const token = need(link.json?.data?.token, `reset link: ${link.status} ${link.text.slice(0, 200)}`);
    const reset = (t, p) =>
      fetch(`${base}/api/auth/reset-password`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: t, new_password: p }) });
    r = await reset("not-a-real-token", PASSWORD);
    check("S-06g", "a made-up reset token is refused", r.status === 400, r.status);
    r = await reset(token, PASSWORD);
    check("S-06h", "the reset link sets the password", r.ok, r.status);
    r = await reset(token, newPassword);
    check("S-06i", "the link works only once", r.status === 400, r.status);
    check("S-06j", "sign-in works with the reset password", (await login(viewer.email)).r.status === 200);
  });
}
