import { describe, it, expect } from 'vitest';

describe('config', () => {
  it('GPS_DEBUG_MODE is false by default', async () => {
    const { GPS_DEBUG_MODE } = await import('../config');
    expect(GPS_DEBUG_MODE).toBe(false);
  });
});
