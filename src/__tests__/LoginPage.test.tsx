import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockLogin = vi.fn();

vi.mock('../store/authStore', () => ({
  useAuthStore: (selector?: any) => {
    const state = {
      user: null,
      isAuthenticated: false,
      loading: false,
      login: mockLogin,
      logout: vi.fn(),
    };
    return selector ? selector(state) : state;
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => vi.fn() };
});

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it('renders login form', async () => {
    vi.stubEnv('VITE_DEMO_MODE', 'false');
    const { default: LoginPage } = await import('../pages/LoginPage');
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );
    expect(screen.getByPlaceholderText('20521001')).toBeInTheDocument();
    expect(screen.getByText('Masuk')).toBeInTheDocument();
  });

  describe('demo credentials banner', () => {
    it('is hidden when VITE_DEMO_MODE is unset', async () => {
      const { default: LoginPage } = await import('../pages/LoginPage');
      render(
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      );
      expect(screen.queryByText('Demo Credentials:')).not.toBeInTheDocument();
    });

    it('is hidden when VITE_DEMO_MODE is "false"', async () => {
      vi.stubEnv('VITE_DEMO_MODE', 'false');
      const { default: LoginPage } = await import('../pages/LoginPage');
      render(
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      );
      expect(screen.queryByText('Demo Credentials:')).not.toBeInTheDocument();
    });

    it('is never shown — banner removed for production', async () => {
      vi.stubEnv('VITE_DEMO_MODE', 'true');
      const { default: LoginPage } = await import('../pages/LoginPage');
      render(
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      );
      expect(screen.queryByText('Demo Credentials:')).not.toBeInTheDocument();
    });
  });
});
