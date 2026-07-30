/**
 * Feature-flag gating for Release C (compatible frontend cutover).
 *
 * When FINAL_GATES_RELEASE_C === true:
 *   - ScanPage calls openSessionV2 / checkInV2
 *   - SessionActivePage calls closeSessionV2
 *   - QR rotation calls rotateQRV2
 *   - sessionStore.init() uses a safe column list (always, regardless of flag)
 *
 * When false: legacy RPCs are used.
 *
 * This is consumed at runtime so tests can stub it without touching .env.
 */

const RELEASE_C =
  typeof import.meta !== 'undefined' &&
  import.meta.env?.VITE_FINAL_GATES_RELEASE_C === 'true';

export function isReleaseC(): boolean {
  return RELEASE_C;
}
