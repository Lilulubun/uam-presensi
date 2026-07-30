import { supabase } from './supabase';
import { useAuthStore } from '../store/authStore';

/**
 * Fire-and-forget telemetry. Never blocks UX.
 * Uses existing auth store state — no extra auth.getUser() call.
 */
export async function logEvent(
  eventType: string,
  sessionId?: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    const userId = useAuthStore.getState().user?.id;
    await supabase.from('interaction_logs').insert({
      event_type: eventType,
      session_id: sessionId,
      user_id: userId,
      metadata,
    });
  } catch {
    // Fire-and-forget; never block UX
  }
}
