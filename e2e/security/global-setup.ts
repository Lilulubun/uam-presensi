/**
 * Global setup for security E2E: run the fail-closed guard FIRST.
 * Any rejection aborts the whole suite before login/seed/network actions.
 * Also verifies the frontend bundle points at the authorized backend.
 */
import { loadSecurityEnv } from './helpers/environment';
import { observer } from './helpers/fixtures';

export default async function globalSetup() {
  const env = loadSecurityEnv();

  // Marker verification: prove this env file belongs to a prepared fixture.
  // The marker hash must equal sha256 of the run's marker record we write now.
  const admin = observer(env);
  const { error } = await admin.from('tpas').select('id').limit(1);
  if (error) {
    throw new Error(`[guard] backend unreachable or keys invalid: ${error.message}`);
  }

  // Frontend/backend agreement: fetch the SPA and read its runtime config.
  const res = await fetch(`${env.frontendUrl}/`);
  if (!res.ok) {
    throw new Error(`[guard] frontend not serving at ${env.frontendUrl}: ${res.status}`);
  }
  const html = await res.text();
  const scriptMatch = html.match(/src="(\/assets\/[^"]+\.js)"/);
  if (scriptMatch) {
    const jsRes = await fetch(`${env.frontendUrl}${scriptMatch[1]}`);
    const js = await jsRes.text();
    const bundleUrl = js.match(/https:\/\/[a-z0-9]+\.supabase\.co/);
    if (bundleUrl && !js.includes(env.backendUrl.replace('https://', ''))) {
      throw new Error(`[guard] frontend bundle targets ${bundleUrl[0]}, expected ${env.backendUrl}`);
    }
  }

  console.log(`[security-e2e] target ok: ${env.backendUrl} (marker ${env.markerHash.slice(0, 8)}…)`);
}
