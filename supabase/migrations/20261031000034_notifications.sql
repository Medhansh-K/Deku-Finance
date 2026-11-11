-- Migration 34: in-app notifications generated on a schedule
-- Deku Finance
--
-- The backend's internal endpoint (called hourly by Cloud Scheduler) runs generate_notifications()
-- as service_role. Every notification has a dedupe_key, so running the job again inserts nothing new.
-- user_id NULL means "every member of the organisation whose role is in audience_roles"
-- (all members when audience_roles is NULL); such rows are marked read per user in notification_reads.

-- ---------------------------------------------------------------------------------------------
-- Compliance calendar (data, not code)
-- ---------------------------------------------------------------------------------------------

-- Verify these against the current CBIC notifications before each financial year: the due days
-- move (QRMP filers, state-wise staggered GSTR-3B dates, one-off extensions).
CREATE TABLE IF NOT EXISTS public.compliance_calendar (
  return_type text PRIMARY KEY CHECK (return_type IN ('GSTR1', 'GSTR3B')),
  -- Day of the month after the return period.
  due_day smallint NOT NULL CHECK (due_day BETWEEN 1 AND 28),
  applies_to text NOT NULL DEFAULT 'monthly' CHECK (applies_to IN ('monthly')),
  remind_days_before integer[] NOT NULL DEFAULT '{5,1}'
);

INSERT INTO public.compliance_calendar (return_type, due_day, applies_to) VALUES
  ('GSTR1', 11, 'monthly'),
  ('GSTR3B', 20, 'monthly')
ON CONFLICT (return_type) DO NOTHING;

ALTER TABLE public.compliance_calendar ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "compliance_calendar_select" ON public.compliance_calendar;
CREATE POLICY "compliance_calendar_select"
  ON public.compliance_calendar FOR SELECT TO authenticated USING (true);
REVOKE INSERT, UPDATE, DELETE ON public.compliance_calendar FROM authenticated;

-- ---------------------------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  audience_roles public.organisation_role[],
  kind text NOT NULL CHECK (kind IN ('gst_due', 'invoice_overdue', 'approval_waiting', 'period_ending')),
  title text NOT NULL,
  body text,
  link text CHECK (link IS NULL OR link ~ '^/[A-Za-z0-9/_?=&.-]*$'),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  dedupe_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Only for rows addressed to one user; org-wide rows use notification_reads.
  read_at timestamptz,
  CONSTRAINT uk_notifications_org_dedupe UNIQUE (organisation_id, dedupe_key),
  CONSTRAINT chk_notifications_read_at_personal CHECK (read_at IS NULL OR user_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_notifications_org_created ON public.notifications(organisation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id) WHERE user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.notification_reads (
  notification_id uuid NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (notification_id, user_id)
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select" ON public.notifications;
CREATE POLICY "notifications_select"
  ON public.notifications FOR SELECT TO authenticated
  USING (
    public.is_org_member(organisation_id)
    AND (
      user_id = auth.uid()
      OR (user_id IS NULL AND (audience_roles IS NULL OR public.has_role(organisation_id, audience_roles)))
    )
  );

DROP POLICY IF EXISTS "notification_reads_select" ON public.notification_reads;
CREATE POLICY "notification_reads_select"
  ON public.notification_reads FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Writes only through mark_notifications_read / generate_notifications.
REVOKE INSERT, UPDATE, DELETE ON public.notifications, public.notification_reads FROM authenticated;

-- Latest notifications the caller can see, unread first. Runs as the caller, so RLS decides.
CREATE OR REPLACE FUNCTION public.list_notifications(
  p_org_id uuid, p_unread_only boolean DEFAULT false, p_limit integer DEFAULT 50
)
RETURNS TABLE (
  id uuid, kind text, title text, body text, link text, payload jsonb,
  created_at timestamptz, read_at timestamptz
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT n.id, n.kind, n.title, n.body, n.link, n.payload, n.created_at,
         coalesce(n.read_at, r.read_at)
  FROM public.notifications n
  LEFT JOIN public.notification_reads r ON r.notification_id = n.id AND r.user_id = auth.uid()
  WHERE n.organisation_id = p_org_id
    AND (NOT coalesce(p_unread_only, false) OR coalesce(n.read_at, r.read_at) IS NULL)
  ORDER BY coalesce(n.read_at, r.read_at) IS NULL DESC, n.created_at DESC
  LIMIT LEAST(GREATEST(coalesce(p_limit, 50), 1), 200);
$$;

-- Marks the given notifications read for the caller; ids the caller can't see are ignored.
CREATE OR REPLACE FUNCTION public.mark_notifications_read(p_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_personal integer;
  v_shared integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in required' USING ERRCODE = '42501';
  END IF;

  UPDATE public.notifications n
  SET read_at = now()
  WHERE n.id = ANY(p_ids) AND n.user_id = v_uid AND n.read_at IS NULL
    AND public.is_org_member(n.organisation_id);
  GET DIAGNOSTICS v_personal = ROW_COUNT;

  INSERT INTO public.notification_reads (notification_id, user_id)
  SELECT n.id, v_uid
  FROM public.notifications n
  WHERE n.id = ANY(p_ids) AND n.user_id IS NULL
    AND public.is_org_member(n.organisation_id)
    AND (n.audience_roles IS NULL OR public.has_role(n.organisation_id, n.audience_roles))
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_shared = ROW_COUNT;

  RETURN v_personal + v_shared;
END;
$$;

-- ---------------------------------------------------------------------------------------------
-- generate_notifications (service_role only)
-- ---------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.generate_notifications(p_org_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org record;
  v_today date;
  v_n integer;
  v_total integer := 0;
  v_prev_sub text;
  v_actor uuid;
  v_finance constant public.organisation_role[] := ARRAY['owner', 'cfo', 'admin', 'accountant']::public.organisation_role[];
  v_approvers constant public.organisation_role[] := ARRAY['owner', 'cfo', 'admin']::public.organisation_role[];
BEGIN
  -- EXECUTE is granted to service_role only (below); that grant is the gate.
  FOR v_org IN
    SELECT o.id, o.operating_mode, o.composition_scheme, o.timezone
    FROM public.organisations o
    WHERE p_org_id IS NULL OR o.id = p_org_id
  LOOP
    -- One company's bad data must not stop reminders for every other company.
    BEGIN
    v_today := (now() AT TIME ZONE coalesce(v_org.timezone, 'Asia/Kolkata'))::date;

    -- 1. GST return due dates (regular monthly filers; composition dealers file CMP-08 instead).
    -- Of the reminder leads still ahead, only the nearest is sent, so a job that first runs a day
    -- before the due date sends one reminder, not two.
    IF v_org.operating_mode = 'gst' AND NOT v_org.composition_scheme THEN
      INSERT INTO public.notifications (organisation_id, audience_roles, kind, title, body, link, payload, dedupe_key)
      SELECT v_org.id, v_finance, 'gst_due',
             replace(c.return_type, 'GSTR', 'GSTR-') || ' for ' || to_char(p.period_start, 'Mon YYYY')
               || ' is due on ' || to_char(d.due_date, 'DD Mon YYYY'),
             CASE WHEN d.due_date = v_today THEN 'Due today.'
                  ELSE 'Due in ' || (d.due_date - v_today) || CASE WHEN d.due_date - v_today = 1 THEN ' day.' ELSE ' days.' END
             END || ' File it on the GST portal, then record the ARN in Deku.',
             '/gst/file',
             jsonb_build_object('return_type', c.return_type, 'ret_period', to_char(p.period_start, 'MMYYYY'),
                                'due_date', d.due_date, 'lead_days', l.lead),
             'gst_due:' || c.return_type || ':' || to_char(p.period_start, 'MMYYYY') || ':' || l.lead
      FROM public.compliance_calendar c
      CROSS JOIN LATERAL (VALUES
        ((date_trunc('month', v_today) - interval '1 month')::date),
        (date_trunc('month', v_today)::date)
      ) AS p(period_start)
      CROSS JOIN LATERAL (
        SELECT ((p.period_start + interval '1 month')::date + (c.due_day - 1)) AS due_date
      ) d
      CROSS JOIN LATERAL (
        SELECT min(x) AS lead FROM unnest(c.remind_days_before) x WHERE d.due_date - v_today <= x
      ) l
      WHERE c.applies_to = 'monthly'
        AND d.due_date >= v_today
        AND l.lead IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM public.gst_return_filings f
          WHERE f.organisation_id = v_org.id
            AND f.ret_period = to_char(p.period_start, 'MMYYYY')
            AND f.return_type = c.return_type
            AND f.status = 'filed'
        )
      ON CONFLICT (organisation_id, dedupe_key) DO NOTHING;
      GET DIAGNOSTICS v_n = ROW_COUNT;
      v_total := v_total + v_n;
    END IF;

    -- 2. Overdue sales invoices with an open balance, from the ledger (payments settle oldest first).
    -- get_party_ledger_ageing authorises by membership, so the job reads it as the earliest owner;
    -- the previous identity is restored right after.
    SELECT m.user_id INTO v_actor
    FROM public.organisation_members m
    WHERE m.organisation_id = v_org.id AND m.role = 'owner'
    ORDER BY m.created_at
    LIMIT 1;
    IF v_actor IS NOT NULL THEN
      v_prev_sub := current_setting('request.jwt.claim.sub', true);
      PERFORM set_config('request.jwt.claim.sub', v_actor::text, true);

      INSERT INTO public.notifications (organisation_id, audience_roles, kind, title, body, link, payload, dedupe_key)
      SELECT v_org.id, v_finance, 'invoice_overdue',
             'Invoice ' || (i->>'invoice_number') || ' is overdue',
             coalesce(a.party_name, 'A customer') || ' owes ₹' || to_char((i->>'open')::numeric, 'FM99,99,99,99,990.00')
               || ', due ' || to_char((i->>'due_date')::date, 'DD Mon YYYY') || '.',
             '/reports/debtors',
             jsonb_build_object('invoice_id', i->>'invoice_id', 'invoice_number', i->>'invoice_number',
                                'party_id', a.party_id, 'open', (i->>'open')::numeric, 'due_date', i->>'due_date'),
             'invoice_overdue:' || (i->>'invoice_id') || ':' || (i->>'due_date')
      FROM public.get_party_ledger_ageing(v_org.id, 'receivable', v_today) a
      CROSS JOIN LATERAL jsonb_array_elements(a.open_items) i
      WHERE i->>'invoice_id' IS NOT NULL
        AND (i->>'due_date')::date < v_today
        AND (i->>'open')::numeric > 0
      ON CONFLICT (organisation_id, dedupe_key) DO NOTHING;
      GET DIAGNOSTICS v_n = ROW_COUNT;
      v_total := v_total + v_n;

      PERFORM set_config('request.jwt.claim.sub', coalesce(v_prev_sub, ''), true);
    END IF;

    -- 3. Vouchers submitted for approval more than 24 hours ago. A resubmission is a new reminder.
    INSERT INTO public.notifications (organisation_id, audience_roles, kind, title, body, link, payload, dedupe_key)
    SELECT v_org.id, v_approvers, 'approval_waiting',
           'Voucher ' || coalesce(j.entry_number, '(unnumbered)') || ' is waiting for approval',
           'Submitted ' || to_char(j.submitted_at AT TIME ZONE coalesce(v_org.timezone, 'Asia/Kolkata'), 'DD Mon YYYY HH24:MI') || '.',
           '/approvals',
           jsonb_build_object('journal_entry_id', j.id, 'submitted_at', j.submitted_at),
           'approval_waiting:' || j.id || ':' || extract(epoch FROM j.submitted_at)::bigint
    FROM public.journal_entries j
    WHERE j.organisation_id = v_org.id
      AND j.status = 'draft'
      AND j.submitted_at IS NOT NULL
      AND j.submitted_at < now() - interval '24 hours'
    ON CONFLICT (organisation_id, dedupe_key) DO NOTHING;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_total := v_total + v_n;

    -- 4. Open fiscal periods ending within 7 days.
    INSERT INTO public.notifications (organisation_id, audience_roles, kind, title, body, link, payload, dedupe_key)
    SELECT v_org.id, v_finance, 'period_ending',
           'Fiscal period ' || f.name || ' ends on ' || to_char(f.end_date, 'DD Mon YYYY'),
           'Post outstanding vouchers and reconcile banks before closing it.',
           '/day-book',
           jsonb_build_object('fiscal_period_id', f.id, 'end_date', f.end_date),
           'period_ending:' || f.id || ':' || f.end_date
    FROM public.fiscal_periods f
    WHERE f.organisation_id = v_org.id
      AND f.status = 'open'
      AND f.end_date BETWEEN v_today AND v_today + 7
    ON CONFLICT (organisation_id, dedupe_key) DO NOTHING;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_total := v_total + v_n;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'generate_notifications: organisation % skipped: %', v_org.id, SQLERRM;
    END;
  END LOOP;

  RETURN v_total;
END;
$$;

-- Migration 018 default privileges grant EXECUTE on new functions to authenticated.
REVOKE EXECUTE ON FUNCTION public.list_notifications(uuid, boolean, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mark_notifications_read(uuid[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.generate_notifications(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_notifications(uuid) TO service_role;
