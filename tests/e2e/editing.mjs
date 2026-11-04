// Editing a draft voucher and selling a catalogue item, through the real API (runs after workflows.mjs,
// which leaves approvals off, so these drafts post directly until E-04 turns approvals on).

export async function runEditingChecks({ me, org, date, voucherPeriod, accounts, check }) {
  const O = `/organisations/${org}`;
  const accountId = (code) => {
    const id = accounts.find((a) => a.code === code)?.id;
    if (!id) throw new Error(`missing account ${code}`);
    return id;
  };

  const section = async (id, name, fn) => {
    try {
      await fn();
    } catch (e) {
      check(id, `${name}: stopped early`, false, e?.message ?? e);
    }
  };

  // Debit minus credit per account code, from the trial balance users see.
  const balances = async () => {
    const rows = (await me.api("GET", `${O}/reports/trial-balance`)).json?.data ?? [];
    return Object.fromEntries(rows.map((r) => [r.account_code, Number(r.total_debit) - Number(r.total_credit)]));
  };
  const moved = (before, after, code) => Math.round(((after[code] ?? 0) - (before[code] ?? 0)) * 100) / 100;

  const lines = (debit, credit) => [
    { line_number: 1, account_id: accountId("5090"), debit, credit: 0 },
    { line_number: 2, account_id: accountId("1020"), debit: 0, credit },
  ];
  const draft = async (number, amount) => {
    const r = await me.api("POST", `${O}/journals`, {
      fiscal_period_id: voucherPeriod,
      entry_number: number,
      entry_date: date,
      narration: `E2E ${number}`,
      lines: lines(amount, amount),
    });
    const id = r.json?.entry?.[0]?.id;
    if (!id) throw new Error(`draft ${number}: ${r.status} ${r.text.slice(0, 200)}`);
    return id;
  };
  const edit = (id, debit, credit, narration = "E2E edited", reference = "E2E-REF") =>
    me.api("PUT", `${O}/journals/${id}`, { entry_date: date, narration, reference, lines: lines(debit, credit) });
  const row = async (id) => ((await me.api("GET", `${O}/journals`)).json?.data ?? []).find((j) => j.id === id);

  let posted;

  await section("E-01", "edit a draft", async () => {
    const before = await balances();
    const id = await draft("E2E-ED-1", 100);
    const r = await edit(id, 250, 250);
    check("E-01a", "a draft's amount can be edited", r.status === 200, `${r.status} ${r.text.slice(0, 300)}`);
    const saved = await row(id);
    check("E-01b", "the edit replaced the header and the lines", saved?.narration === "E2E edited" && saved?.reference === "E2E-REF"
      && saved?.journal_entry_lines?.length === 2 && Number(saved?.journal_entry_lines?.find((l) => l.line_number === 1)?.debit) === 250, JSON.stringify(saved ?? null).slice(0, 300));
    check("E-01c", "a draft edit leaves the ledger alone", moved(before, await balances(), "5090") === 0);
    const p = await me.api("POST", `${O}/journals/${id}/post`);
    check("E-01d", "the edited draft posts", p.status === 200, `${p.status} ${p.text.slice(0, 200)}`);
    const after = await balances();
    check("E-01e", "the trial balance has the new figures, not the old", moved(before, after, "5090") === 250 && moved(before, after, "1020") === -250, `${moved(before, after, "5090")} ${moved(before, after, "1020")}`);
    posted = id;
  });

  await section("E-02", "refused after posting", async () => {
    const before = await balances();
    const r = await edit(posted, 999, 999);
    check("E-02a", "a posted voucher can't be edited", r.status !== 200, `${r.status} ${r.text.slice(0, 200)}`);
    check("E-02b", "the refused edit moved nothing", moved(before, await balances(), "5090") === 0);
  });

  await section("E-03", "balance is still checked", async () => {
    const id = await draft("E2E-ED-2", 100);
    const r = await edit(id, 100, 90);
    check("E-03a", "an out-of-balance draft can be saved", r.status === 200, `${r.status} ${r.text.slice(0, 200)}`);
    const p = await me.api("POST", `${O}/journals/${id}/post`);
    check("E-03b", "but it can't be posted", p.status !== 200, p.status);
    const fixed = await edit(id, 90, 90);
    const again = await me.api("POST", `${O}/journals/${id}/post`);
    check("E-03c", "corrected, it posts", fixed.status === 200 && again.status === 200, `${fixed.status} ${again.status}`);
  });

  await section("E-04", "approval round trip", async () => {
    const on = await me.api("PATCH", `${O}/settings`, { require_journal_approval: true });
    check("E-04a", "approval turned on", on.status === 200, `${on.status} ${on.text.slice(0, 200)}`);
    try {
      const id = await draft("E2E-ED-3", 100);
      await me.api("POST", `${O}/journals/${id}/submit`);
      const pending = await edit(id, 200, 200);
      check("E-04b", "a voucher awaiting approval can't be edited", pending.status !== 200, `${pending.status} ${pending.text.slice(0, 200)}`);
      await me.api("POST", `${O}/journals/${id}/reject`, { reason: "E2E wrong amount" });
      const edited = await edit(id, 200, 200);
      const back = await row(id);
      check("E-04c", "sent back, the maker can edit it and the rejection clears", edited.status === 200 && back?.rejected_at === null && back?.rejection_reason === null, `${edited.status} ${JSON.stringify(back ?? null).slice(0, 300)}`);
      const again = await me.api("POST", `${O}/journals/${id}/submit`);
      check("E-04d", "it can be resubmitted", again.status === 200, `${again.status} ${again.text.slice(0, 200)}`);
    } finally {
      await me.api("PATCH", `${O}/settings`, { require_journal_approval: false });
    }
  });

  await section("E-05", "catalogue item on an invoice", async () => {
    const item = await me.api("POST", `${O}/catalogue`, {
      type: "goods", name: "E2E Gadget", sku: "E2E-G", hsn_sac_code: "8471", unit_code: "NOS", default_unit_price: 200, default_gst_rate: 18, track_inventory: true,
    });
    check("E-05a", "create a stocked product", item.status === 200, `${item.status} ${item.text.slice(0, 200)}`);
    const itemId = ((await me.api("GET", `${O}/catalogue`)).json?.data ?? []).find((i) => i.sku === "E2E-G")?.id;
    if (!itemId) throw new Error("item not listed");
    const summary = async () => ((await me.api("GET", `${O}/inventory/summary`)).json?.data ?? []).find((s) => s.item_id === itemId);
    const opening = await me.api("POST", `${O}/inventory/adjustments`, { item_id: itemId, kind: "opening", direction: "in", qty: 10, unit_cost: 50, date, reason: "E2E opening" });
    check("E-05b", "opening stock recorded", opening.status === 200 && Number((await summary())?.qty_on_hand) === 10, `${opening.status} ${opening.text.slice(0, 200)}`);

    const party = await me.api("POST", `${O}/parties`, { type: "customer", legal_name: "E2E Gadget Buyer", display_name: "E2E Gadget Buyer" });
    const customer = ((await me.api("GET", `${O}/parties`)).json?.data ?? []).find((p) => p.legal_name === "E2E Gadget Buyer")?.id;
    if (!customer) throw new Error(`customer: ${party.status} ${party.text.slice(0, 200)}`);
    const created = await me.api("POST", `${O}/invoices`, {
      customer_id: customer, invoice_number: "E2E-S-ED1", invoice_date: date, due_date: date, supply_type: "intra_state", place_of_supply: "27-Maharashtra",
      taxable_amount: 600, total_amount: 708,
      lines: [{
        line_number: 1, item_id: itemId, item_name: "E2E Gadget", hsn_sac_code: "8471", unit_code: "NOS", quantity: 3, unit_price: 200, gst_rate: 18,
        cgst_rate: 9, cgst_amount: 54, sgst_rate: 9, sgst_amount: 54, igst_rate: 0, igst_amount: 0, taxable_amount: 600, total_amount: 708,
      }],
    });
    const invoice = created.json?.invoice?.[0]?.id;
    check("E-05c", "invoice saved with the item", !!invoice && created.json?.lines?.[0]?.item_id === itemId, `${created.status} ${created.text.slice(0, 300)}`);
    check("E-05d", "a draft invoice leaves stock alone", Number((await summary())?.qty_on_hand) === 10);
    const issued = await me.api("POST", `${O}/invoices/${invoice}/issue`, { create_journal: true });
    check("E-05e", "invoice issued", issued.status === 200, `${issued.status} ${issued.text.slice(0, 300)}`);
    const s = await summary();
    // 10 at 50, less 3 first-in-first-out.
    check("E-05f", "issuing it moves the stock: 7 on hand worth 350", Number(s?.qty_on_hand) === 7 && Number(s?.fifo_value) === 350, JSON.stringify(s ?? null));
  });
}
