import { describe, it, expect } from 'vitest';

describe('config', () => {
  it('APP_CONFIG has expected keys', async () => {
    const { APP_CONFIG } = await import('../config');
    expect(APP_CONFIG.QR_REFRESH_INTERVAL).toBe(20000);
    expect(APP_CONFIG.GPS_RADIUS_TOLERANCE).toBe(100);
    expect(APP_CONFIG.LATE_THRESHOLD_MINUTES).toBe(15);
  });
});
