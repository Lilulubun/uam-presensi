import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadSecurityEnv } from './helpers/environment';

// Guard unit tests: pure rejection logic, zero network. Each case builds a
// temp env file and expects loadSecurityEnv to throw BEFORE any I/O.
const MARKER = 'a'.repeat(64);

function makeEnvFile(overrides: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'e2e-guard-'));
  const file = join(dir, 'security.env');
  const base: Record<string, string> = {
    E2E_BASE_URL: 'http://127.0.0.1:4173',
    E2E_SUPABASE_URL: 'http://127.0.0.1:54321',
    E2E_SUPABASE_ANON_KEY: 'anon-test-key',
    E2E_SUPABASE_SERVICE_ROLE_KEY: 'service-test-key',
    E2E_MARKER_HASH: MARKER,
    ...overrides,
  };
  writeFileSync(file, Object.entries(base).map(([k, v]) => `${k}=${v}`).join('\n'));
  return file;
}

function expectReject(overrides: Record<string, string>, match: string) {
  const file = makeEnvFile(overrides);
  try {
    expect(() => loadSecurityEnv({ E2E_SECURITY_ENV: file })).toThrow(match);
  } finally {
    rmSync(join(file, '..'), { recursive: true, force: true });
  }
}

describe('security environment guard (fail-closed)', () => {
  it('accepts a valid local config', () => {
    const file = makeEnvFile({});
    const env = loadSecurityEnv({ E2E_SECURITY_ENV: file });
    expect(env.backendUrl).toBe('http://127.0.0.1:54321');
    expect(env.frontendUrl).toBe('http://127.0.0.1:4173');
    rmSync(join(file, '..'), { recursive: true, force: true });
  });

  it('rejects production host aagmvgljdcrjtvhokhgm', () => {
    expectReject(
      { E2E_SUPABASE_URL: 'https://aagmvgljdcrjtvhokhgm.supabase.co' },
      'forbidden',
    );
  });

  it('rejects unknown hosted host', () => {
    expectReject(
      { E2E_SUPABASE_URL: 'https://zzzzzzzzzzzzzzzzzzzz.supabase.co' },
      'not allowlisted',
    );
  });

  it('rejects mismatched local frontend/backend hosts', () => {
    expectReject(
      { E2E_BASE_URL: 'http://localhost:4173' },
      'same host',
    );
  });

  it('rejects missing marker hash', () => {
    expectReject({ E2E_MARKER_HASH: '' }, 'marker');
  });

  it('rejects malformed marker hash', () => {
    expectReject({ E2E_MARKER_HASH: 'not-a-hash' }, 'sha256');
  });

  it('rejects missing env file', () => {
    expect(() =>
      loadSecurityEnv({ E2E_SECURITY_ENV: '/nonexistent/security.env' }),
    ).toThrow('not found');
  });

  it('rejects unset E2E_SECURITY_ENV', () => {
    expect(() => loadSecurityEnv({})).toThrow('E2E_SECURITY_ENV');
  });

  it('rejects non-http URL', () => {
    expectReject({ E2E_SUPABASE_URL: 'ftp://127.0.0.1:54321' }, 'http(s)');
  });

  it('rejects URL with embedded credentials', () => {
    expectReject(
      { E2E_SUPABASE_URL: 'http://user:pass@127.0.0.1:54321' },
      'credentials',
    );
  });

  it('rejects missing service role key', () => {
    expectReject({ E2E_SUPABASE_SERVICE_ROLE_KEY: '' }, 'service role key');
  });
});
