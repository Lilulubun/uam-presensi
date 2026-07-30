/**
 * v2 attendance adapter — direct RPC wrappers with Zustand store sync.
 *
 * v2 RPCs:
 *   - open_session_with_expected_v2  → openSessionV2
 *   - check_in_v2                    → checkInV2
 *   - close_session_v2               → closeSessionV2
 *   - rotate_qr_token_v2             → rotateQRV2
 *
 * All v2 RPCs enforce: auth check, teacher-is-active-for-tpa guard,
 * GPS haversine check, SHA-256 token hashing, and audit logs.
 */

import { supabase } from '../lib/supabase';
import { toCamelCase } from '../lib/transform';
import { logEvent } from '../lib/log-event';
import { useSessionStore } from '../store/sessionStore';
import { useAttendanceStore } from '../store/attendanceStore';
import type {
  Session,
  Attendance,
  Coordinates,
  ValidationResult,
} from '../types';

// ─── openSessionV2 ────────────────────────────────────────────────────────────

export async function openSessionV2(
  tpaId: string,
  location: Coordinates,
  expectedUserIds: string[],
): Promise<ValidationResult> {
  const { data, error } = await supabase.rpc('open_session_with_expected_v2', {
    p_tpa_id: tpaId,
    p_location: { lat: location.lat, lng: location.lng },
    p_expected_user_ids: expectedUserIds,
  });

  if (error || !data) {
    return { valid: false, message: error?.message ?? 'Gagal membuka sesi' };
  }

  const raw = data as any;
  const session = toCamelCase<Session>(raw.session);
  // QR token was returned by the RPC — store keeps the expiry for UI only
  const qr = raw.qr as { token: string; expiry: string };

  // Sync session to Zustand store (same contract as v1 openSessionWithExpected)
  useSessionStore.setState((state) => ({
    sessions: [...state.sessions.filter((s) => s.id !== session.id), session],
    activeSession: session,
  }));
  useAttendanceStore.getState().init();

  logEvent('session_opened_v2', session.id);
  return {
    valid: true,
    message: `Sesi dibuka dengan ${expectedUserIds.length} pengajar wajib hadir!`,
    data: { session, qr },
  };
}

// ─── checkInV2 ────────────────────────────────────────────────────────────────

export async function checkInV2(
  sessionId: string,
  token: string,
  location: Coordinates,
): Promise<ValidationResult> {
  const { data, error } = await supabase.rpc('check_in_v2', {
    p_session_id: sessionId,
    p_token: token,
    p_location: { lat: location.lat, lng: location.lng },
  });

  if (error || !data) {
    const msg = error?.message ?? 'Gagal melakukan presensi masuk';
    if (/radius/i.test(msg)) {
      logEvent('scan_in_gps_denied', sessionId, { error: msg });
    } else if (/tidak valid|kadaluarsa/i.test(msg)) {
      logEvent('qr_expired', sessionId, { error: msg });
    }
    return { valid: false, message: msg };
  }

  const raw = data as any;
  const attendance = toCamelCase<Attendance>(raw.attendance);
  const reason = (raw.reason as string | null) ?? null;

  logEvent('scan_in_success_v2', sessionId);
  return {
    valid: true,
    message:
      reason === 'FIRST_TEACHER_AUTO'
        ? 'Presensi Anda sudah otomatis tercatat saat membuka sesi'
        : 'Presensi masuk berhasil',
    data: { attendance, reason },
  };
}

// ─── closeSessionV2 ───────────────────────────────────────────────────────────

export async function closeSessionV2(
  sessionId: string,
  location?: Coordinates,
  notes?: string,
): Promise<ValidationResult> {
  const rpcParams: Record<string, unknown> = {
    p_session_id: sessionId,
  };
  if (notes) rpcParams.p_notes = notes;
  if (location) {
    rpcParams.p_location = { lat: location.lat, lng: location.lng };
  }

  const { data, error } = await supabase.rpc('close_session_v2', rpcParams);

  if (error || !data) {
    return { valid: false, message: error?.message ?? 'Gagal menutup sesi' };
  }

  const updated = toCamelCase<Session>(data);

  // Sync closed session to Zustand store (same contract as v1 closeSession)
  useSessionStore.setState((state) => ({
    sessions: state.sessions.map((s) => (s.id === sessionId ? updated : s)),
    activeSession: state.activeSession?.id === sessionId ? null : state.activeSession,
  }));
  useAttendanceStore.getState().init();

  logEvent('session_closed_v2', sessionId);
  return { valid: true, message: 'Sesi berhasil ditutup', data: updated };
}

// ─── rotateQRV2 ───────────────────────────────────────────────────────────────

export async function rotateQRV2(
  sessionId: string,
): Promise<ValidationResult> {
  const { data, error } = await supabase.rpc('rotate_qr_token_v2', {
    p_session_id: sessionId,
  });

  if (error || !data) {
    return { valid: false, message: error?.message ?? 'Gagal merotasi QR' };
  }

  const { token, expiry } = data as { token: string; expiry: string };
  return { valid: true, message: 'Token dirotasi', data: { token, expiry } };
}
