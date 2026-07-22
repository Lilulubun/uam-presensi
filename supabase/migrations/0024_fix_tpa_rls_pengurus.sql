-- 0024_fix_tpa_rls_pengurus.sql
-- Fix: auth.jwt()->>'role' always NULL in Supabase — role lives in public.users, not JWT payload.
-- Replace with EXISTS subquery pattern used by all other pengurus policies in this project.

DROP POLICY IF EXISTS "tpa read" ON public.tpas;
CREATE POLICY "tpa read" ON public.tpas
  FOR SELECT USING (
    -- Pengajar: hanya TPA yang di-assign
    id IN (SELECT tpa_id FROM public.pengajar_tpa WHERE user_id = auth.uid())
    -- Pengurus: semua TPA
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'pengurus')
  );
