-- 0026_fix_remaining_rls_jwt_role.sql
-- Complete the cleanup started in 0024/0025: replace all remaining
-- auth.jwt()->>'role' expressions with is_pengurus() helper.
-- auth.jwt()->>'role' returns NULL for custom Supabase roles.

-- 1. pengajar_tpa — junction table (pengajar <-> TPA assignments)
DROP POLICY IF EXISTS "pengajar_tpa read" ON public.pengajar_tpa;
CREATE POLICY "pengajar_tpa read" ON public.pengajar_tpa
  FOR SELECT USING (
    user_id = auth.uid()
    OR public.is_pengurus()
  );

-- 2. session_expected_teachers — expected teacher list per session
DROP POLICY IF EXISTS "session_expected_teachers select" ON public.session_expected_teachers;
CREATE POLICY "session_expected_teachers select" ON public.session_expected_teachers
  FOR SELECT USING (
    session_id IN (
      SELECT id FROM public.sessions
      WHERE tpa_id IN (SELECT tpa_id FROM public.pengajar_tpa WHERE user_id = auth.uid())
    )
    OR public.is_pengurus()
  );
