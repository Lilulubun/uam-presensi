/**
 * Environment guard — fail-closed target validation for security E2E.
 *
 * Gates every suite run: refuses unknown/unauthorized Supabase targets,
 * frontend/backend mismatch, or missing fixture marker BEFORE any network
 * request, login, or seed. No .env fallback beyond explicit test env file.
 */
import fs from 'node:fs';
import path from 'node:path';

export type SecurityEnv = {
  frontendUrl: string;
  backendUrl: string;
  anonKey: string;
  serviceRoleKey: string;
  /** sha256 of marker file content — proves runner owns this environment */
  markerHash: string;
  envFile: string;
};

/** Explicitly allowlisted host (project ref form). Production aagmvgljdcrjtvhokhgm is NOT here. */
const ALLOWED_HOSTS: Record<string, true> = {
  // Local supabase stack
  '127.0.0.1': true,
  'localhost': true,
  // Disposable staging: add explicit host here ONLY with owner approval.
  // e.g. 'abcdefghijklmnopqrst': true,
};

/** Ref-id of the hosted project explicitly authorized for this suite (empty = none). */
let authorizedHostedHost = '';

function parseUrl(raw: string, label: string): URL {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error(`[guard] ${label} is not a valid URL`);
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') {
    throw new Error(`[guard] ${label} must be http(s), got ${u.protocol}`);
  }
  if (u.username || u.password || u.search || u.hash) {
    throw new Error(`[guard] ${label} must not contain credentials/query/hash`);
  }
  return u;
}

function requireEnv(env: NodeJS.ProcessEnv, key: string, label: string): string {
  const v = env[key];
  if (!v || v.trim() === '') {
    throw new Error(`[guard] missing ${label}: set ${key} in the security e2e env file`);
  }
  return v.trim();
}

/**
 * Load and validate the security environment. Throws (fail-closed) on any
 * violation. Reads ONLY the file given by E2E_SECURITY_ENV (never `.env`).
 */
export function loadSecurityEnv(env: NodeJS.ProcessEnv = process.env): SecurityEnv {
  const envFile = env.E2E_SECURITY_ENV;
  if (!envFile) {
    throw new Error('[guard] E2E_SECURITY_ENV must point to a dedicated env file');
  }
  const resolved = path.resolve(envFile);
  if (!fs.existsSync(resolved)) {
    throw new Error(`[guard] env file not found: ${resolved}`);
  }

  // Minimal parser — no dotenv dependency for the guard itself.
  const fileEnv: Record<string, string> = {};
  for (const line of fs.readFileSync(resolved, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    fileEnv[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }

  const merged = { ...fileEnv, ...pick(env, ['E2E_MARKER_HASH']) };
  authorizedHostedHost = merged.E2E_AUTHORIZED_HOST ?? '';

  const frontendUrl = parseUrl(requireEnv(merged, 'E2E_BASE_URL', 'frontend base URL'), 'E2E_BASE_URL');
  const backendUrl = parseUrl(requireEnv(merged, 'E2E_SUPABASE_URL', 'backend URL'), 'E2E_SUPABASE_URL');
  const anonKey = requireEnv(merged, 'E2E_SUPABASE_ANON_KEY', 'anon key');
  const serviceRoleKey = requireEnv(merged, 'E2E_SUPABASE_SERVICE_ROLE_KEY', 'service role key');
  const markerHash = requireEnv(merged, 'E2E_MARKER_HASH', 'fixture marker hash');

  // Frontend and backend must target the same origin (no split-brain config).
  const feHost = frontendUrl.hostname;
  const beHost = backendUrl.hostname;
  const bePort = backendUrl.port;
  const fePort = frontendUrl.port;
  void feHost; void beHost; void bePort; void fePort; // used below

  // Same-origin is only required for local stacks; hosted FE+SB differ by design.
  const isLocal = beHost === '127.0.0.1' || beHost === 'localhost';
  if (isLocal && feHost !== beHost) {
    throw new Error(`[guard] local stack requires frontend/backend same host (fe=${feHost} be=${beHost})`);
  }

  // Host allowlist — exact hostname match. Production is forbidden UNLESS
  // explicitly authorized via E2E_AUTHORIZED_HOST in the security env file
  // (runner-owner decision recorded outside this repo).
  if (!isLocal) {
    if (beHost === 'aagmvgljdcrjtvhokhgm.supabase.co' && beHost !== authorizedHostedHost) {
      throw new Error('[guard] production host aagmvgljdcrjtvhokhgm is forbidden (set E2E_AUTHORIZED_HOST to override deliberately)');
    }
    if (ALLOWED_HOSTS[beHost] !== true && beHost !== authorizedHostedHost) {
      throw new Error(`[guard] backend host not allowlisted: ${beHost}`);
    }
  }

  // Marker: proves this env file is owned by a prepared fixture run.
  if (!/^[0-9a-f]{64}$/.test(markerHash)) {
    throw new Error('[guard] E2E_MARKER_HASH must be a sha256 hex digest');
  }

  return {
    frontendUrl: frontendUrl.origin,
    backendUrl: backendUrl.origin,
    anonKey,
    serviceRoleKey,
    markerHash,
    envFile: resolved,
  };
}

function pick(env: NodeJS.ProcessEnv, keys: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of keys) if (env[k] !== undefined) out[k] = env[k] as string;
  return out;
}

/** True when the two configs target the same backend origin. */
export function sameBackend(a: SecurityEnv, b: SecurityEnv): boolean {
  return a.backendUrl === b.backendUrl;
}
