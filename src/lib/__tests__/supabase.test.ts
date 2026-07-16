import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('supabase client', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('exports a non-null client when env vars are set', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key');
    const mod = await import('../supabase');
    expect(mod.supabase).toBeTruthy();
    expect(typeof mod.supabase.from).toBe('function');
  });
});
