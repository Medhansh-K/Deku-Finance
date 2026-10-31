-- Migration 29: ledger aggregation on the server
-- Deku Finance
--
-- Party ageing, the KPI snapshot and the operating-expense breakdown used to be computed in the
-- browser from a full journal dump (src/lib/reports/*.ts). These functions are the single source
-- for reports, Collections and any future client. Semantics follow the old TypeScript exactly:
--   * posted and reversed entries are in the books, drafts never are;
--   * for party ageing and DSO/DPO a reversed entry and its reversal cancel out and are dropped;
--   * figures the books can't support come back NULL, never 0.

-- ---------------------------------------------------------------------------------------------
-- Internal helpers (not callable through the API)
-- ---------------------------------------------------------------------------------------------

-- Trade debtors / creditors control account: seeded code 1030 / 2010, else the first postable
-- account of the right group whose name, ledger or sub-ledger says so (accounts in code order).
CREATE OR REPLACE FUNCTION public._ledger_control_account(p_org_id uuid, p_side text)
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT a.id
  FROM public.accounts a
  WHERE a.organisation_id = p_org_id
    AND a.account_group = CASE p_side WHEN 'receivable' THEN 'asset' ELSE 'liability' END
    AND (
      a.code = CASE p_side WHEN 'receivable' THEN '1030' ELSE '2010' END
      OR (a.is_postable IS NOT FALSE
          AND (a.name || ' ' || coalesce(a.ledger, '') || ' ' || coalesce(a.sub_ledger, '')) ~*
              CASE p_side
                WHEN 'receivable' THEN 'trade debtors|accounts receivable|sundry debtors'
                ELSE 'trade creditors|accounts payable|sundry creditors'
              END)
    )
  ORDER BY (a.code = CASE p_side WHEN 'receivable' THEN '1030' ELSE '2010' END) DESC, a.code
  LIMIT 1;
$$;

-- Book entries up to p_as_of minus reversed originals paired with their reversal.
CREATE OR REPLACE FUNCTION public._ledger_live_entries(p_org_id uuid, p_as_of date)
RETURNS TABLE (id uuid, entry_date date, entry_number text, reference text)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH booked AS (
    SELECT j.id, j.entry_date, j.entry_number, j.reference, j.reversal_of_id
    FROM public.journal_entries j
    WHERE j.organisation_id = p_org_id
      AND j.status IN ('posted', 'reversed')
      AND j.entry_date <= p_as_of
  ),
  pairs AS (
    SELECT b.id AS rev_id, o.id AS orig_id
    FROM booked b
    JOIN booked o ON o.id = b.reversal_of_id
  )
  SELECT b.id, b.entry_date, b.entry_number, b.reference
  FROM booked b
  WHERE NOT EXISTS (SELECT 1 FROM pairs p WHERE b.id IN (p.rev_id, p.orig_id));
$$;

-- DSO / DPO: closing balance / credit sales (or purchases) booked to the control account over the
-- last 365 days, x days in that window. The window shrinks to the age of the books so a young
-- company isn't measured against a year it didn't trade. NULL when there was no such flow.
CREATE OR REPLACE FUNCTION public._ledger_days_outstanding(
  p_org_id uuid, p_account_id uuid, p_side text, p_balance numeric, p_as_of date
)
RETURNS integer
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH live AS (
    SELECT * FROM public._ledger_live_entries(p_org_id, p_as_of)
  ),
  win AS (
    SELECT LEAST(365, p_as_of - MIN(live.entry_date) + 1) AS days FROM live HAVING COUNT(*) > 0
  ),
  flow AS (
    SELECT SUM(CASE WHEN p_side = 'receivable' THEN l.debit ELSE l.credit END) AS amt
    FROM live
    JOIN public.journal_entry_lines l ON l.journal_entry_id = live.id AND l.organisation_id = p_org_id
    CROSS JOIN win
    WHERE l.account_id = p_account_id
      AND live.entry_date >= p_as_of - (win.days - 1)
  )
  -- floor(x + 0.5) rounds like JS Math.round, which the TS reports used.
  SELECT CASE WHEN flow.amt > 0 THEN floor(p_balance / flow.amt * win.days + 0.5)::integer END
  FROM win, flow;
$$;

-- Accounts with the classifications the reports use.
CREATE OR REPLACE FUNCTION public._ledger_accounts(p_org_id uuid)
RETURNS TABLE (
  id uuid, code text, name text, grp text,
  is_cash_bank boolean, is_output_gst boolean, is_input_gst boolean, is_operating_expense boolean
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT a.id, a.code, a.name, a.account_group,
    a.account_group = 'asset' AND t.txt ~* '\y(cash|bank)\y',
    a.account_group = 'liability' AND t.txt ~* 'output.*gst',
    a.account_group = 'asset' AND t.txt ~* 'input.*gst',
    a.account_group = 'expense' AND NOT t.txt ~* 'cost of (goods|sales)|\ycogs\y'
  FROM public.accounts a
  CROSS JOIN LATERAL (
    SELECT a.name || ' ' || coalesce(a.ledger, '') || ' ' || coalesce(a.sub_ledger, '') AS txt
  ) t
  WHERE a.organisation_id = p_org_id;
$$;

REVOKE EXECUTE ON FUNCTION
  public._ledger_control_account(uuid, text),
  public._ledger_live_entries(uuid, date),
  public._ledger_days_outstanding(uuid, uuid, text, numeric, date),
  public._ledger_accounts(uuid)
FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- get_party_ledger_ageing
-- ---------------------------------------------------------------------------------------------

-- One row per party on the trade debtors (receivable) or creditors (payable) control account,
-- settled oldest first: each payment clears the party's oldest open bill/invoice and anything
-- left over is an advance. No rows when the control account doesn't exist.
CREATE OR REPLACE FUNCTION public.get_party_ledger_ageing(
  p_org_id uuid, p_side text, p_as_of date DEFAULT current_date
)
RETURNS TABLE (
  party_id uuid,
  party_name text,
  gstin text,
  billing_address jsonb,
  balance numeric(15, 2),
  advance numeric(15, 2),
  oldest_age_days integer,
  d0_30 numeric(15, 2),
  d31_60 numeric(15, 2),
  d61_90 numeric(15, 2),
  d90_plus numeric(15, 2),
  open_items jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_account uuid;
  v_sign integer;
BEGIN
  IF NOT public.is_org_member(p_org_id) THEN
    RAISE EXCEPTION 'Access denied: not a member of this organisation' USING ERRCODE = '42501';
  END IF;
  IF p_side IS NULL OR p_side NOT IN ('receivable', 'payable') THEN
    RAISE EXCEPTION 'side must be receivable or payable' USING ERRCODE = '22023';
  END IF;

  v_account := public._ledger_control_account(p_org_id, p_side);
  IF v_account IS NULL THEN
    RETURN;
  END IF;
  v_sign := CASE p_side WHEN 'receivable' THEN 1 ELSE -1 END;

  RETURN QUERY
  WITH moves AS (
    -- Net movement per entry and party, positive = a bill/invoice, negative = a payment.
    SELECT e.id, e.entry_date, e.entry_number, e.reference, l.party_id AS pid,
           v_sign * SUM(l.debit - l.credit) AS amt
    FROM public._ledger_live_entries(p_org_id, coalesce(p_as_of, current_date)) e
    JOIN public.journal_entry_lines l ON l.journal_entry_id = e.id AND l.organisation_id = p_org_id
    WHERE l.account_id = v_account
    GROUP BY e.id, e.entry_date, e.entry_number, e.reference, l.party_id
    HAVING SUM(l.debit - l.credit) <> 0
  ),
  totals AS (
    SELECT m.pid,
           coalesce(SUM(m.amt) FILTER (WHERE m.amt > 0), 0) AS dr,
           coalesce(-SUM(m.amt) FILTER (WHERE m.amt < 0), 0) AS cr,
           MIN(m.entry_date) AS first_date
    FROM moves m
    GROUP BY m.pid
  ),
  items AS (
    -- Oldest-first settlement nets to: payments clear the first cr of the bills in date order.
    SELECT m.*,
           LEAST(m.amt, GREATEST(0,
             SUM(m.amt) OVER (PARTITION BY m.pid ORDER BY m.entry_date, m.entry_number, m.id
                              ROWS UNBOUNDED PRECEDING) - t.cr)) AS open_amt,
           GREATEST(0, coalesce(p_as_of, current_date) - m.entry_date) AS age
    FROM moves m
    JOIN totals t ON t.pid IS NOT DISTINCT FROM m.pid
    WHERE m.amt > 0
  ),
  open_items AS (
    SELECT i.*, si.id AS invoice_id, si.invoice_number, si.due_date
    FROM items i
    LEFT JOIN LATERAL (
      SELECT s.id, s.invoice_number, s.due_date
      FROM public.sales_invoices s
      WHERE s.organisation_id = p_org_id AND s.journal_entry_id = i.id
      ORDER BY s.created_at
      LIMIT 1
    ) si ON true
    WHERE i.open_amt > 0
  )
  SELECT t.pid,
         coalesce(nullif(p.display_name, ''), p.legal_name),
         p.gstin,
         p.billing_address,
         (t.dr - t.cr)::numeric(15, 2),
         GREATEST(0, t.cr - t.dr)::numeric(15, 2),
         MAX(o.age)::integer,
         coalesce(SUM(o.open_amt) FILTER (WHERE o.age <= 30), 0)::numeric(15, 2),
         coalesce(SUM(o.open_amt) FILTER (WHERE o.age > 30 AND o.age <= 60), 0)::numeric(15, 2),
         coalesce(SUM(o.open_amt) FILTER (WHERE o.age > 60 AND o.age <= 90), 0)::numeric(15, 2),
         coalesce(SUM(o.open_amt) FILTER (WHERE o.age > 90), 0)::numeric(15, 2),
         coalesce(jsonb_agg(jsonb_build_object(
           'entry_id', o.id,
           'entry_number', o.entry_number,
           'reference', o.reference,
           'date', o.entry_date,
           'amount', o.amt::numeric(15, 2),
           'open', o.open_amt::numeric(15, 2),
           'age_days', o.age,
           'invoice_id', o.invoice_id,
           'invoice_number', o.invoice_number,
           'due_date', o.due_date
         ) ORDER BY o.entry_date, o.entry_number, o.id) FILTER (WHERE o.id IS NOT NULL), '[]'::jsonb)
  FROM totals t
  LEFT JOIN open_items o ON o.pid IS NOT DISTINCT FROM t.pid
  LEFT JOIN public.parties p ON p.id = t.pid AND p.organisation_id = p_org_id
  GROUP BY t.pid, t.dr, t.cr, t.first_date, p.display_name, p.legal_name, p.gstin, p.billing_address
  HAVING t.dr <> t.cr OR COUNT(o.id) > 0
  ORDER BY t.dr - t.cr DESC, t.first_date;
END;
$$;

-- ---------------------------------------------------------------------------------------------
-- get_expense_breakdown
-- ---------------------------------------------------------------------------------------------

-- Operating expenses (cost of sales excluded) booked between p_from and p_to, by entry and by
-- expense head, plus revenue for the same period so callers can show an expense ratio.
CREATE OR REPLACE FUNCTION public.get_expense_breakdown(p_org_id uuid, p_from date, p_to date)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public.is_org_member(p_org_id) THEN
    RAISE EXCEPTION 'Access denied: not a member of this organisation' USING ERRCODE = '42501';
  END IF;

  WITH acc AS (
    SELECT * FROM public._ledger_accounts(p_org_id)
  ),
  ents AS (
    SELECT j.id, j.entry_number, j.entry_date, j.status, j.reference, j.narration
    FROM public.journal_entries j
    WHERE j.organisation_id = p_org_id
      AND j.status IN ('posted', 'reversed')
      AND j.entry_date BETWEEN p_from AND p_to
  ),
  ln AS (
    SELECT l.journal_entry_id, l.line_number, l.account_id, l.party_id, l.debit, l.credit,
           a.code, a.name, a.grp, a.is_operating_expense
    FROM ents e
    JOIN public.journal_entry_lines l ON l.journal_entry_id = e.id AND l.organisation_id = p_org_id
    JOIN acc a ON a.id = l.account_id
  ),
  heads AS (
    SELECT ln.journal_entry_id, ln.account_id, ln.code, ln.name,
           MIN(ln.line_number) AS first_line, SUM(ln.debit - ln.credit) AS net
    FROM ln
    WHERE ln.is_operating_expense
    GROUP BY ln.journal_entry_id, ln.account_id, ln.code, ln.name
  ),
  vouchers AS (
    SELECT e.*,
      (SELECT SUM(h.net) FROM heads h WHERE h.journal_entry_id = e.id) AS amount,
      (SELECT jsonb_agg(h.name ORDER BY h.first_line) FROM heads h WHERE h.journal_entry_id = e.id) AS head_names,
      (SELECT jsonb_agg(h.account_id ORDER BY h.first_line) FROM heads h WHERE h.journal_entry_id = e.id) AS head_ids,
      (SELECT coalesce(nullif(p.display_name, ''), p.legal_name)
         FROM ln JOIN public.parties p ON p.id = ln.party_id AND p.organisation_id = p_org_id
         WHERE ln.journal_entry_id = e.id
         ORDER BY ln.line_number LIMIT 1) AS party_name,
      (SELECT coalesce(jsonb_agg(s.name ORDER BY s.first_line), '[]'::jsonb)
         FROM (SELECT ln.name, MIN(ln.line_number) AS first_line FROM ln
               WHERE ln.journal_entry_id = e.id AND ln.credit > 0 AND NOT ln.is_operating_expense
               GROUP BY ln.name) s) AS sources,
      (SELECT jsonb_agg(jsonb_build_object(
                'account_name', ln.name, 'account_code', ln.code, 'group', ln.grp,
                'debit', ln.debit, 'credit', ln.credit) ORDER BY ln.line_number)
         FROM ln WHERE ln.journal_entry_id = e.id) AS lines
    FROM ents e
    WHERE EXISTS (SELECT 1 FROM heads h WHERE h.journal_entry_id = e.id)
  ),
  by_head AS (
    SELECT h.account_id, h.code, h.name, SUM(h.net) AS amount, COUNT(*) AS entries,
           MIN(e.entry_date) AS first_date
    FROM heads h JOIN ents e ON e.id = h.journal_entry_id
    GROUP BY h.account_id, h.code, h.name
    HAVING SUM(h.net) <> 0
  )
  SELECT jsonb_build_object(
    'total', (SELECT coalesce(SUM(v.amount), 0)::numeric(15, 2) FROM vouchers v),
    'revenue', (SELECT coalesce(SUM(ln.credit - ln.debit), 0)::numeric(15, 2) FROM ln WHERE ln.grp = 'revenue'),
    'by_head', (SELECT coalesce(jsonb_agg(jsonb_build_object(
                  'account_id', b.account_id, 'code', b.code, 'name', b.name,
                  'amount', b.amount::numeric(15, 2), 'entries', b.entries
                ) ORDER BY b.amount DESC, b.first_date, b.code), '[]'::jsonb) FROM by_head b),
    'vouchers', (SELECT coalesce(jsonb_agg(jsonb_build_object(
                  'id', v.id, 'entry_number', v.entry_number, 'date', v.entry_date,
                  'status', v.status, 'reference', v.reference, 'narration', v.narration,
                  'party_name', v.party_name, 'amount', v.amount::numeric(15, 2),
                  'heads', v.head_names, 'head_ids', v.head_ids, 'sources', v.sources, 'lines', v.lines
                ) ORDER BY v.entry_date DESC, v.entry_number DESC), '[]'::jsonb) FROM vouchers v)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- ---------------------------------------------------------------------------------------------
-- get_kpi_snapshot
-- ---------------------------------------------------------------------------------------------

-- Ledger KPIs for the period p_from..p_to (balances as at p_to). Money is rupees, numeric(15,2).
CREATE OR REPLACE FUNCTION public.get_kpi_snapshot(p_org_id uuid, p_from date, p_to date)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has boolean;
  v_last date;
  v_balanced boolean;
  v_turnover numeric;
  v_profit numeric;
  v_lifetime_profit numeric;
  v_assets numeric;
  v_liabilities numeric;
  v_equity numeric;
  v_any_liquid boolean;
  v_liquid numeric;
  v_liquid_names jsonb;
  v_any_out boolean;
  v_gst_out numeric;
  v_any_in boolean;
  v_gst_in numeric;
  v_billed numeric;
  v_ar uuid;
  v_ap uuid;
  v_ar_bal numeric;
  v_ap_bal numeric;
  v_ar_count integer;
  v_ar_over45 integer;
  v_ap_count integer;
  v_opex jsonb;
  v_gst_net numeric;
BEGIN
  IF NOT public.is_org_member(p_org_id) THEN
    RAISE EXCEPTION 'Access denied: not a member of this organisation' USING ERRCODE = '42501';
  END IF;

  WITH booked AS (
    SELECT j.id, j.entry_date
    FROM public.journal_entries j
    WHERE j.organisation_id = p_org_id
      AND j.status IN ('posted', 'reversed')
      AND j.entry_date <= p_to
  )
  SELECT COUNT(*) > 0, MAX(b.entry_date),
         (SELECT coalesce(SUM(l.debit), 0) = coalesce(SUM(l.credit), 0)
            FROM public.journal_entry_lines l JOIN booked bb ON bb.id = l.journal_entry_id
           WHERE l.organisation_id = p_org_id)
  INTO v_has, v_last, v_balanced
  FROM booked b;

  WITH acc AS (
    SELECT * FROM public._ledger_accounts(p_org_id)
  ),
  mv AS (
    SELECT l.account_id, j.entry_date, l.debit, l.credit
    FROM public.journal_entries j
    JOIN public.journal_entry_lines l ON l.journal_entry_id = j.id AND l.organisation_id = p_org_id
    WHERE j.organisation_id = p_org_id
      AND j.status IN ('posted', 'reversed')
      AND j.entry_date <= p_to
  ),
  bal AS (
    -- Natural-side balance: debit-normal for assets and expenses.
    SELECT a.*,
           coalesce(SUM(CASE WHEN a.grp IN ('asset', 'expense') THEN m.debit - m.credit ELSE m.credit - m.debit END), 0) AS total,
           coalesce(SUM(CASE WHEN a.grp IN ('asset', 'expense') THEN m.debit - m.credit ELSE m.credit - m.debit END)
                    FILTER (WHERE m.entry_date >= p_from), 0) AS period
    FROM acc a
    LEFT JOIN mv m ON m.account_id = a.id
    GROUP BY a.id, a.code, a.name, a.grp, a.is_cash_bank, a.is_output_gst, a.is_input_gst, a.is_operating_expense
  )
  SELECT
    coalesce(SUM(period) FILTER (WHERE grp = 'revenue'), 0),
    coalesce(SUM(period) FILTER (WHERE grp = 'revenue'), 0) - coalesce(SUM(period) FILTER (WHERE grp = 'expense'), 0),
    coalesce(SUM(total) FILTER (WHERE grp = 'revenue'), 0) - coalesce(SUM(total) FILTER (WHERE grp = 'expense'), 0),
    coalesce(SUM(total) FILTER (WHERE grp = 'asset'), 0),
    coalesce(SUM(total) FILTER (WHERE grp = 'liability'), 0),
    coalesce(SUM(total) FILTER (WHERE grp = 'equity'), 0),
    bool_or(is_cash_bank),
    coalesce(SUM(total) FILTER (WHERE is_cash_bank), 0),
    coalesce(jsonb_agg(name ORDER BY code) FILTER (WHERE is_cash_bank AND total <> 0), '[]'::jsonb),
    bool_or(is_output_gst),
    coalesce(SUM(total) FILTER (WHERE is_output_gst), 0),
    bool_or(is_input_gst),
    coalesce(SUM(total) FILTER (WHERE is_input_gst), 0)
  INTO v_turnover, v_profit, v_lifetime_profit, v_assets, v_liabilities, v_equity,
       v_any_liquid, v_liquid, v_liquid_names, v_any_out, v_gst_out, v_any_in, v_gst_in
  FROM bal;

  SELECT SUM(s.total_amount) INTO v_billed
  FROM public.sales_invoices s
  WHERE s.organisation_id = p_org_id
    AND s.status::text IN ('issued', 'paid')
    AND s.invoice_date BETWEEN p_from AND p_to;

  v_ar := public._ledger_control_account(p_org_id, 'receivable');
  v_ap := public._ledger_control_account(p_org_id, 'payable');

  IF v_ar IS NOT NULL THEN
    SELECT coalesce(SUM(l.debit - l.credit), 0) INTO v_ar_bal
    FROM public.journal_entry_lines l
    JOIN public.journal_entries j ON j.id = l.journal_entry_id
    WHERE l.organisation_id = p_org_id AND l.account_id = v_ar
      AND j.status IN ('posted', 'reversed') AND j.entry_date <= p_to;
    SELECT COUNT(*) FILTER (WHERE g.balance > 0), COUNT(*) FILTER (WHERE coalesce(g.oldest_age_days, 0) > 45)
    INTO v_ar_count, v_ar_over45
    FROM public.get_party_ledger_ageing(p_org_id, 'receivable', p_to) g;
  END IF;

  IF v_ap IS NOT NULL THEN
    SELECT coalesce(SUM(l.credit - l.debit), 0) INTO v_ap_bal
    FROM public.journal_entry_lines l
    JOIN public.journal_entries j ON j.id = l.journal_entry_id
    WHERE l.organisation_id = p_org_id AND l.account_id = v_ap
      AND j.status IN ('posted', 'reversed') AND j.entry_date <= p_to;
    SELECT COUNT(*) FILTER (WHERE g.balance > 0) INTO v_ap_count
    FROM public.get_party_ledger_ageing(p_org_id, 'payable', p_to) g;
  END IF;

  v_opex := public.get_expense_breakdown(p_org_id, p_from, p_to);

  IF v_has AND (v_any_out OR v_any_in) THEN
    v_gst_net := CASE WHEN v_any_out THEN v_gst_out ELSE 0 END - CASE WHEN v_any_in THEN v_gst_in ELSE 0 END;
  END IF;

  RETURN jsonb_build_object(
    'has_entries', v_has,
    'last_entry_date', v_last,
    'turnover', CASE WHEN v_has THEN v_turnover::numeric(15, 2) END,
    'profit', CASE WHEN v_has THEN v_profit::numeric(15, 2) END,
    'margin_pct', CASE WHEN v_has AND v_turnover <> 0 THEN round(v_profit / v_turnover * 100, 1) END,
    'billed', v_billed::numeric(15, 2),
    'liquid', CASE WHEN v_has AND v_any_liquid THEN v_liquid::numeric(15, 2) END,
    'liquid_accounts', v_liquid_names,
    'debtors_account', (SELECT jsonb_build_object('id', a.id, 'code', a.code, 'name', a.name) FROM public.accounts a WHERE a.id = v_ar),
    'debtors', CASE WHEN v_has THEN v_ar_bal::numeric(15, 2) END,
    'debtors_count', coalesce(v_ar_count, 0),
    'debtors_over_45_count', coalesce(v_ar_over45, 0),
    'dso_days', CASE WHEN v_ar IS NOT NULL THEN public._ledger_days_outstanding(p_org_id, v_ar, 'receivable', v_ar_bal, p_to) END,
    'creditors_account', (SELECT jsonb_build_object('id', a.id, 'code', a.code, 'name', a.name) FROM public.accounts a WHERE a.id = v_ap),
    'creditors', CASE WHEN v_has THEN v_ap_bal::numeric(15, 2) END,
    'creditors_count', coalesce(v_ap_count, 0),
    'dpo_days', CASE WHEN v_ap IS NOT NULL THEN public._ledger_days_outstanding(p_org_id, v_ap, 'payable', v_ap_bal, p_to) END,
    'expenses', CASE WHEN v_has THEN (v_opex->>'total')::numeric(15, 2) END,
    'expense_heads', coalesce((SELECT jsonb_agg(h->'name' ORDER BY n)
                                 FROM jsonb_array_elements(v_opex->'by_head') WITH ORDINALITY AS x(h, n)
                                WHERE n <= 2), '[]'::jsonb),
    'gst_output', CASE WHEN v_has AND v_any_out THEN v_gst_out::numeric(15, 2) END,
    'gst_input', CASE WHEN v_has AND v_any_in THEN v_gst_in::numeric(15, 2) END,
    'gst_net', v_gst_net::numeric(15, 2),
    'assets', CASE WHEN v_has THEN v_assets::numeric(15, 2) END,
    'liabilities', CASE WHEN v_has THEN v_liabilities::numeric(15, 2) END,
    -- Equity including profit not yet closed to retained earnings.
    'equity', CASE WHEN v_has THEN (v_equity + v_lifetime_profit)::numeric(15, 2) END,
    'balanced', CASE WHEN v_has THEN v_balanced END
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION
  public.get_party_ledger_ageing(uuid, text, date),
  public.get_expense_breakdown(uuid, date, date),
  public.get_kpi_snapshot(uuid, date, date)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
  public.get_party_ledger_ageing(uuid, text, date),
  public.get_expense_breakdown(uuid, date, date),
  public.get_kpi_snapshot(uuid, date, date)
TO authenticated;
