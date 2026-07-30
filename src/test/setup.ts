import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Keep tests isolated from developer, staging, and production credentials.
vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co')
vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key')
// Force v1 path in tests — feature flag should be enabled only via explicit test setup
vi.stubEnv('VITE_FINAL_GATES_RELEASE_C', 'false')

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

window.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver
