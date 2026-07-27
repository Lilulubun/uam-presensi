-- 0023_fix_broken_access_control.sql
-- Fix A01:2025 Broken Access Control — 4 RLS policies + 1 RPC audit + 1 helper RPC
-- Idempotent: DROP + CREATE
-- Deploy via Supabase Dashboard > SQL Editor

-- =========================================================================
-- 0. Fix pengajar_tpa RLS — ganti query users ke auth.jwt()->>'role'
-- Perbaiki infinite recursion: lama SELECT users → users policy SELECT
-- pengajar_tpa → loop. Pakai JWT claim langsung.
-- =========================================================================
DROP POLICY IF EXISTS "pengajar_tpa read" ON public.pengajar_tpa;
CREATE POLICY "pengajar_tpa read" ON public.pengajar_tpa
  FOR SELECT USING (
    user_id = auth.uid()
    OR auth.jwt()->>'role' = 'pengurus'
  );

-- =========================================================================
-- 1. Sessions RLS — scope by tpa_id via pengajar_tpa junction
-- Fix: HIGH, 58 sessions dari 4 TPA bocor via GET /rest/v1/sessions
-- =========================================================================
DROP POLICY IF EXISTS "session read" ON public.sessions;
CREATE POLICY "session read" ON public.sessions
  FOR SELECT USING (
    tpa_id IN (SELECT tpa_id FROM pengajar_tpa WHERE user_id = auth.uid())
    OR auth.jwt()->>'role' = 'pengurus'
  );

-- =========================================================================
-- 2. Users RLS — scope by tpa_id via pengajar_tpa transitively
-- Fix: HIGH, 100+ user profiles (nama, NIM, email) bocor via GET /rest/v1/users
-- =========================================================================
DROP POLICY IF EXISTS "users self-read" ON public.users;
CREATE POLICY "users self-read" ON public.users
  FOR SELECT USING (
    id = auth.uid()
    OR public.is_pengurus()
    OR (
      public.is_pengajar()
      AND is_active = true
      AND id IN (
        SELECT pt.user_id FROM pengajar_tpa pt
        WHERE pt.tpa_id IN (
          SELECT pt2.tpa_id FROM pengajar_tpa pt2 WHERE pt2.user_id = auth.uid()
        )
      )
    )
  );

-- =========================================================================
-- 3. TPAs RLS — scope by assigned TPA
-- Fix: MEDIUM, GPS coordinates + static QR code semua TPA bocor via GET /rest/v1/tpas
-- =========================================================================
DROP POLICY IF EXISTS "tpa read" ON public.tpas;
CREATE POLICY "tpa read" ON public.tpas
  FOR SELECT USING (
    id IN (SELECT tpa_id FROM pengajar_tpa WHERE user_id = auth.uid())
    OR auth.jwt()->>'role' = 'pengurus'
  );

-- =========================================================================
-- 4. session_expected_teachers RLS — scope via session's tpa_id
-- Fix: MEDIUM, 18 record lintas sesi TPA lain bocor via GET /rest/v1/session_expected_teachers
-- =========================================================================
DROP POLICY IF EXISTS "session_expected_teachers select" ON public.session_expected_teachers;
CREATE POLICY "session_expected_teachers select" ON public.session_expected_teachers
  FOR SELECT USING (
    session_id IN (
      SELECT id FROM sessions
      WHERE tpa_id IN (SELECT tpa_id FROM pengajar_tpa WHERE user_id = auth.uid())
    )
    OR auth.jwt()->>'role' = 'pengurus'
  );

-- =========================================================================
-- 5. get_session_report RPC — add auth check
-- Fix: BONUS, SECURITY DEFINER tanpa auth check sebelumnya
-- =========================================================================
DROP FUNCTION IF EXISTS public.get_session_report(uuid);
CREATE OR REPLACE FUNCTION public.get_session_report(p_session_id uuid)
RETURNS TABLE (
  user_id uuid,
  user_name text,
  user_nim text,
  scan_in_time timestamptz,
  scan_out_time timestamptz,
  is_late boolean,
  late_minutes int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.sessions s
    WHERE s.id = p_session_id
      AND (
        s.tpa_id IN (SELECT pt.tpa_id FROM public.pengajar_tpa pt WHERE pt.user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.users u2 WHERE u2.id = auth.uid() AND u2.role = 'pengurus')
      )
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
    SELECT
      u.id, u.name, u.nim,
      a.scan_in_time, a.scan_out_time,
      a.is_late, a.late_minutes
    FROM attendances a
    JOIN users u ON u.id = a.user_id
    WHERE a.session_id = p_session_id
    ORDER BY a.scan_in_time NULLS LAST;
END;
$$;

-- =========================================================================
-- 6. get_tpa_by_qr RPC — secure QR lookup for ScanPage
-- Fix: BONUS, allows static QR TPA lookup tanpa expose semua TPA
-- ponytail: RPC ini tidak perlu dipakai frontend karena RLS baru
-- tetap mengembalikan TPA yang di-assign ke pengajar via policy.
-- Pengurus tetap lihat semua via role check.
-- Simpan sebagai opsi jika ScanPage perlu lookup QR lintas TPA di masa depan.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.get_tpa_by_qr(p_qr_code text)
RETURNS TABLE (
  id text,
  name text,
  location jsonb,
  static_qr_code text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.id, t.name, t.location, t.static_qr_code
  FROM public.tpas t
  WHERE t.static_qr_code = p_qr_code
  LIMIT 1;
$$;
