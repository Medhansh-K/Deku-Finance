-- =====================================================================
-- Deku Finance - Comprehensive Database Test Suite & Security Validation
-- File: supabase/tests/database_test.sql
-- =====================================================================

BEGIN;

-- Display Banner
DO $$
BEGIN
  RAISE NOTICE '======================================================';
  RAISE NOTICE 'STARTING DEKU FINANCE DATABASE VALIDATION TEST SUITE';
  RAISE NOTICE '======================================================';
END $$;

-- ---------------------------------------------------------------------
-- Setup Test Fixtures (2 Mock Organisations & Mock Users)
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v_user_a uuid := '11111111-1111-1111-1111-111111111111'::uuid;
  v_user_b uuid := '22222222-2222-2222-2222-222222222222'::uuid;
  v_user_c uuid := '33333333-3333-3333-3333-333333333333'::uuid; -- Viewer
  v_org_1 uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid;
  v_org_2 uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid;
  v_fy_open_id uuid := 'cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid;
  v_fy_closed_id uuid := 'dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid;
  v_acc_cash uuid := 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'::uuid;
  v_acc_rev uuid := 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid;
  v_journal_id uuid;
  v_test_failed boolean := false;
BEGIN
  RAISE NOTICE 'Setting up test tenants and fixtures...';

  -- Create profiles
  INSERT INTO public.profiles (id, email, full_name)
  VALUES
    (v_user_a, 'owner@tenant1.com', 'Tenant 1 Owner'),
    (v_user_b, 'owner@tenant2.com', 'Tenant 2 Owner'),
    (v_user_c, 'viewer@tenant1.com', 'Tenant 1 Viewer')
  ON CONFLICT (id) DO NOTHING;

  -- Create organisations
  INSERT INTO public.organisations (id, name, slug, currency, created_by)
  VALUES
    (v_org_1, 'Tenant Alpha Corp', 'tenant-alpha', 'INR', v_user_a),
    (v_org_2, 'Tenant Beta Corp', 'tenant-beta', 'INR', v_user_b)
  ON CONFLICT (id) DO NOTHING;

  -- Memberships
  INSERT INTO public.organisation_members (organisation_id, user_id, role)
  VALUES
    (v_org_1, v_user_a, 'owner'),
    (v_org_1, v_user_c, 'viewer'),
    (v_org_2, v_user_b, 'owner')
  ON CONFLICT (organisation_id, user_id) DO NOTHING;

  -- Seed Chart of Accounts for Org 1
  PERFORM public.seed_default_chart_of_accounts(v_org_1);

  -- Create Fiscal Periods for Org 1
  INSERT INTO public.fiscal_periods (id, organisation_id, name, start_date, end_date, status)
  VALUES
    (v_fy_open_id, v_org_1, 'FY 2026-27 Open', '2026-04-01', '2027-03-31', 'open'),
    (v_fy_closed_id, v_org_1, 'FY 2025-26 Closed', '2025-04-01', '2026-03-31', 'closed')
  ON CONFLICT (id) DO NOTHING;

  -- -------------------------------------------------------------------
  -- Test 1: Fiscal Period Non-Overlap Constraint
  -- -------------------------------------------------------------------
  BEGIN
    INSERT INTO public.fiscal_periods (organisation_id, name, start_date, end_date, status)
    VALUES (v_org_1, 'Overlapping Period', '2026-06-01', '2026-08-31', 'open');
    RAISE EXCEPTION 'TEST 1 FAILED: Overlapping fiscal period was allowed';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM LIKE '%cannot overlap%' THEN
        RAISE NOTICE '✓ TEST 1 PASSED: Overlapping fiscal periods correctly blocked';
      ELSE
        RAISE;
      END IF;
  END;

  -- -------------------------------------------------------------------
  -- Test 2: Double-Entry Unbalanced Posting Rejection
  -- -------------------------------------------------------------------
  SELECT id INTO v_acc_cash FROM public.accounts WHERE organisation_id = v_org_1 AND code = '1010';
  SELECT id INTO v_acc_rev FROM public.accounts WHERE organisation_id = v_org_1 AND code = '4010';

  INSERT INTO public.journal_entries (
    organisation_id, fiscal_period_id, entry_number, entry_date, status, narration, created_by
  )
  VALUES (
    v_org_1, v_fy_open_id, 'TEST-UNBALANCED-01', '2026-05-10', 'draft', 'Unbalanced Test', v_user_a
  )
  RETURNING id INTO v_journal_id;

  -- Add unbalanced lines (Debit 1000, Credit 800)
  INSERT INTO public.journal_entry_lines (organisation_id, journal_entry_id, line_number, account_id, debit, credit)
  VALUES
    (v_org_1, v_journal_id, 1, v_acc_cash, 1000.00, 0.00),
    (v_org_1, v_journal_id, 2, v_acc_rev, 0.00, 800.00);

  BEGIN
    PERFORM public.post_journal_entry(v_org_1, v_journal_id);
    RAISE EXCEPTION 'TEST 2 FAILED: Unbalanced journal entry was posted';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM LIKE '%Out of balance%' THEN
        RAISE NOTICE '✓ TEST 2 PASSED: Unbalanced journal entry correctly rejected by post_journal_entry()';
      ELSE
        RAISE;
      END IF;
  END;

  -- -------------------------------------------------------------------
  -- Test 3: Double-Entry Minimum Line Count Rejection (< 2 lines)
  -- -------------------------------------------------------------------
  DELETE FROM public.journal_entry_lines WHERE journal_entry_id = v_journal_id AND line_number = 2;
  BEGIN
    PERFORM public.post_journal_entry(v_org_1, v_journal_id);
    RAISE EXCEPTION 'TEST 3 FAILED: Single-line journal entry was posted';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM LIKE '%at least 2 lines%' THEN
        RAISE NOTICE '✓ TEST 3 PASSED: Single-line entry rejected by posting engine';
      ELSE
        RAISE;
      END IF;
  END;

  -- -------------------------------------------------------------------
  -- Test 4: Closed Fiscal Period Posting Rejection
  -- -------------------------------------------------------------------
  DELETE FROM public.journal_entry_lines WHERE journal_entry_id = v_journal_id;
  UPDATE public.journal_entries
  SET
    fiscal_period_id = v_fy_closed_id,
    entry_date = '2025-06-01'
  WHERE id = v_journal_id;

  INSERT INTO public.journal_entry_lines (organisation_id, journal_entry_id, line_number, account_id, debit, credit)
  VALUES
    (v_org_1, v_journal_id, 1, v_acc_cash, 500.00, 0.00),
    (v_org_1, v_journal_id, 2, v_acc_rev, 0.00, 500.00);

  BEGIN
    PERFORM public.post_journal_entry(v_org_1, v_journal_id);
    RAISE EXCEPTION 'TEST 4 FAILED: Posting into closed fiscal period was allowed';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM LIKE '%closed fiscal period%' THEN
        RAISE NOTICE '✓ TEST 4 PASSED: Posting into closed fiscal period correctly blocked';
      ELSE
        RAISE;
      END IF;
  END;

  -- -------------------------------------------------------------------
  -- Test 5: Successful Balanced Posting & Immutability Enforcement
  -- -------------------------------------------------------------------
  UPDATE public.journal_entries
  SET
    fiscal_period_id = v_fy_open_id,
    entry_date = '2026-06-01'
  WHERE id = v_journal_id;

  -- Post valid balanced entry
  PERFORM public.post_journal_entry(v_org_1, v_journal_id);
  RAISE NOTICE '✓ TEST 5A PASSED: Balanced entry posted successfully';

  -- Attempt to mutate posted entry header
  BEGIN
    UPDATE public.journal_entries SET narration = 'Hacked Narration' WHERE id = v_journal_id;
    RAISE EXCEPTION 'TEST 5B FAILED: Mutating posted journal entry was allowed';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM LIKE '%immutable%' THEN
        RAISE NOTICE '✓ TEST 5B PASSED: Direct modification of posted entry permanently blocked';
      ELSE
        RAISE;
      END IF;
  END;

  -- Attempt to mutate posted entry lines
  BEGIN
    UPDATE public.journal_entry_lines SET debit = 999.00 WHERE journal_entry_id = v_journal_id AND line_number = 1;
    RAISE EXCEPTION 'TEST 5C FAILED: Mutating posted entry lines was allowed';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM LIKE '%cannot be modified%' THEN
        RAISE NOTICE '✓ TEST 5C PASSED: Direct line mutation on posted entry permanently blocked';
      ELSE
        RAISE;
      END IF;
  END;

  -- -------------------------------------------------------------------
  -- Test 6: Controlled Reversal Test
  -- -------------------------------------------------------------------
  DECLARE
    v_rev_id uuid;
  BEGIN
    v_rev_id := public.reverse_journal_entry(v_org_1, v_journal_id, '2026-06-05', 'Reversing Test 5 Entry');
    RAISE NOTICE '✓ TEST 6 PASSED: Atomic reversal entry generated and posted (%)', v_rev_id;
  END;

  -- -------------------------------------------------------------------
  -- Test 7: Audit Log Immutability Test
  -- -------------------------------------------------------------------
  DECLARE
    v_audit_id uuid;
  BEGIN
    v_audit_id := public.log_audit_event(v_org_1, 'test.event', 'organisations', v_org_1, '{"test": true}'::jsonb);
    BEGIN
      DELETE FROM public.audit_events WHERE id = v_audit_id;
      RAISE EXCEPTION 'TEST 7 FAILED: Audit record deletion was allowed';
    EXCEPTION
      WHEN OTHERS THEN
        IF SQLERRM LIKE '%Security Violation: Audit records%' THEN
          RAISE NOTICE '✓ TEST 7 PASSED: Audit records are strictly append-only';
        ELSE
          RAISE;
        END IF;
    END;
  END;

  -- -------------------------------------------------------------------
  -- Test 8: GST Invoice Intra-State Tax Rule Validation
  -- -------------------------------------------------------------------
  DECLARE
    v_party_id uuid;
    v_inv_id uuid;
  BEGIN
    INSERT INTO public.parties (organisation_id, type, legal_name, display_name, created_by)
    VALUES (v_org_1, 'customer', 'Acme Consumer Ltd', 'Acme Consumer', v_user_a)
    RETURNING id INTO v_party_id;

    -- Create draft invoice with intra-state supply
    INSERT INTO public.sales_invoices (
      organisation_id, customer_id, invoice_number, invoice_date, due_date,
      supply_type, place_of_supply, taxable_amount, total_amount, created_by
    )
    VALUES (
      v_org_1, v_party_id, 'INV-2026-001', '2026-07-01', '2026-07-15',
      'intra_state', '27-Maharashtra', 1000.00, 1180.00, v_user_a
    )
    RETURNING id INTO v_inv_id;

    -- Insert invalid intra-state line having IGST instead of CGST/SGST
    INSERT INTO public.sales_invoice_lines (
      organisation_id, invoice_id, line_number, item_name, quantity, unit_price,
      taxable_amount, gst_rate, igst_rate, igst_amount, total_amount
    )
    VALUES (
      v_org_1, v_inv_id, 1, 'Software Subscription', 1.0, 1000.00,
      1000.00, 18.00, 18.00, 180.00, 1180.00
    );

    -- Issuing must fail because intra-state cannot have IGST
    BEGIN
      PERFORM public.issue_sales_invoice(v_org_1, v_inv_id, false);
      RAISE EXCEPTION 'TEST 8 FAILED: Intra-state invoice with IGST was issued';
    EXCEPTION
      WHEN OTHERS THEN
        IF SQLERRM LIKE '%Intra-state line%cannot have IGST%' THEN
          RAISE NOTICE '✓ TEST 8A PASSED: Intra-state IGST invalidation caught successfully';
        ELSE
          RAISE;
        END IF;
    END;

    -- Fix line to proper CGST/SGST split
    UPDATE public.sales_invoice_lines
    SET
      igst_rate = 0.00,
      igst_amount = 0.00,
      cgst_rate = 9.00,
      cgst_amount = 90.00,
      sgst_rate = 9.00,
      sgst_amount = 90.00
    WHERE invoice_id = v_inv_id;

    -- Issue with automatic journal creation
    PERFORM public.issue_sales_invoice(v_org_1, v_inv_id, true);
    RAISE NOTICE '✓ TEST 8B PASSED: Valid GST invoice issued and linked to posted accounting journal';
  END;

  RAISE NOTICE '======================================================';
  RAISE NOTICE 'ALL 8 TEST PHASES COMPLETED WITH 100%% SUCCESS!';
  RAISE NOTICE '======================================================';
END $$;

-- Rollback transaction so test data does not pollute database
ROLLBACK;
