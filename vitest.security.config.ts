import { defineConfig } from 'vitest/config';

/**
 * Guard-only Vitest config: unit tests for the fail-closed environment guard.
 * Runs WITHOUT jsdom/setupFiles — pure Node logic, zero network.
 * Never discovers Playwright specs (testMatch limited to *.test.ts here).
 */
export default defineConfig({
  test: {
    include: ['e2e/security/**/*.test.ts'],
    environment: 'node',
    globals: false,
    testTimeout: 10_000,
  },
});
