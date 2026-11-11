-- Deku Finance - migration 52 renamed the bank ledger for new companies; existing ones keep whatever
-- they typed, and only the untouched default changes.
UPDATE public.accounts
   SET name = 'Operating Bank Account', label = 'Bank Current Account'
 WHERE code = '1020' AND name = 'Operating Bank Account (HDFC Current Account)';
