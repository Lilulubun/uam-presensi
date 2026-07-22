-- 0025_fix_session_rls_pengurus.sql
-- Fix: auth.jwt()->>'role' returns NULL for custom roles.
-- Replace with the project's standard is_pengurus() helper to restore access for admin/pengurus.

DROP POLICY IF EXISTS "session read" ON public.sessions;
CREATE POLICY "session read" ON public.sessions
  FOR SELECT USING (
    -- Pengajar: hanya sesi di TPA yang di-assign
    tpa_id IN (SELECT tpa_id FROM public.pengajar_tpa WHERE user_id = auth.uid())
    -- Pengurus: semua sesi
    OR public.is_pengurus()
  );
