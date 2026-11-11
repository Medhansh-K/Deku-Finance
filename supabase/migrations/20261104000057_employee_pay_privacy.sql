-- Deku Finance - salaries and PAN are visible only to those who run payroll, and to the employee themselves.
-- Every member could read every employee's row, including a viewer.

DROP POLICY IF EXISTS "employees_select_org_members" ON public.employees;
CREATE POLICY "employees_select_payroll_or_self"
  ON public.employees FOR SELECT TO authenticated
  USING (
    public.has_role(organisation_id, ARRAY['owner', 'cfo', 'admin']::public.organisation_role[])
    OR user_id = auth.uid()
  );
