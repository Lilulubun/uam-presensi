export async function logEvent(
  eventType: string,
  sessionId?: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    const { supabase } = await import('./supabase');
    await supabase.from('interaction_logs').insert({
      event_type: eventType,
      session_id: sessionId,
      metadata,
    });
  } catch {
    // Fire-and-forget; never block UX
  }
}
