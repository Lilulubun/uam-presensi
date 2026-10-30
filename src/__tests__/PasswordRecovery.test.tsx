import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mocks = vi.hoisted(() => ({
  callback: null as null | ((event: string, session: any) => unknown),
  getSession: vi.fn(), updateUser: vi.fn(), signIn: vi.fn(), signOut: vi.fn(), rpc: vi.fn(),
}));
vi.mock('../lib/supabase', () => ({ supabase: {
  auth: {
    onAuthStateChange: (callback: typeof mocks.callback) => { mocks.callback = callback; },
    getSession: mocks.getSession, updateUser: mocks.updateUser,
    signInWithPassword: mocks.signIn, signOut: mocks.signOut,
  }, rpc: mocks.rpc,
} }));
vi.mock('../store/sessionStore', () => ({ useSessionStore: { getState: () => ({ init: async () => {} }) } }));
vi.mock('../store/attendanceStore', () => ({ useAttendanceStore: { getState: () => ({ init: async () => {} }) } }));
vi.mock('../store/tpaStore', () => ({ useTPAStore: { getState: () => ({ init: async () => {} }) } }));
vi.mock('../store/userStore', () => ({ useUsersStore: { getState: () => ({ init: async () => {} }) } }));
vi.mock('../pages/LoginPage', () => ({ default: () => <p>Login screen</p> }));
vi.mock('../pages/pengajar/DashboardPengajar', () => ({ default: () => <p>Ordinary dashboard</p> }));
import App from '../app/App';
import ProfilePage from '../pages/profile';
import { useAuthStore } from '../store/authStore';

const session = () => ({ user: { id: 'recovery-user' }, expires_at: Date.now() / 1000 + 3600 });
const password = 'Test-only-new-pass-582!';

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState({}, '', '/');
  useAuthStore.setState({ user: null, isAuthenticated: false, loading: true, recoveryUserId: null });
  mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
  mocks.updateUser.mockResolvedValue({ error: null });
  mocks.rpc.mockResolvedValue({ data: [], error: null });
});

async function openRecovery() {
  mocks.getSession.mockImplementationOnce(async () => {
    mocks.callback!('PASSWORD_RECOVERY', session());
    return { data: { session: session() }, error: null };
  });
  mocks.getSession.mockResolvedValue({ data: { session: session() }, error: null });
  render(<App />);
  await screen.findByRole('heading', { name: 'Pulihkan Password' });
}

function fillRecovery(value = password, confirm = value) {
  fireEvent.change(screen.getByLabelText('Password Baru'), { target: { value } });
  fireEvent.change(screen.getByLabelText('Konfirmasi Password Baru'), { target: { value: confirm } });
  fireEvent.click(screen.getByRole('button', { name: 'Simpan Password' }));
}

describe('password recovery integration (mocked Supabase, no network)', () => {
  it('prioritizes legitimate recovery on root over ordinary sign-in redirect; saves without old password', async () => {
    await openRecovery();
    expect(screen.queryByText('Ordinary dashboard')).not.toBeInTheDocument();
    expect(screen.queryByText('Password Saat Ini')).not.toBeInTheDocument();
    fillRecovery();
    await screen.findByText(/Password berhasil diubah/);
    expect(mocks.updateUser).toHaveBeenCalledExactlyOnceWith({ password });
    expect(mocks.signIn).not.toHaveBeenCalled();
    expect(useAuthStore.getState().recoveryUserId).toBeNull();
  });

  it.each(['/login', '/profile', '/pengajar/dashboard'])('intercepts recovery at %s before normal routes', async (path) => {
    window.history.replaceState({}, '', path);
    await openRecovery();
    expect(window.location.pathname).toBe('/pulihkan-password');
  });

  it.each(['/pulihkan-password?type=recovery', '/?type=recovery', '/#type=recovery', '/#error=access_denied&error_code=otp_expired'])('does not trust URL or stored flags: %s', async (path) => {
    window.history.replaceState({}, '', path);
    Object.defineProperty(window, 'localStorage', { configurable: true, value: { getItem: () => 'true' } });
    mocks.getSession.mockResolvedValue({ data: { session: session() }, error: null });
    render(<App />);
    if (path.includes('?type=') && !path.startsWith('/pulihkan')) {
      await screen.findByText('Login screen');
    } else {
      await screen.findByText(/Tautan pemulihan tidak valid atau kedaluwarsa/);
    }
    expect(screen.queryByLabelText('Password Baru')).not.toBeInTheDocument();
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it('rejects mismatched confirmation without update', async () => {
    await openRecovery();
    fillRecovery(password, 'different-test-value');
    await screen.findByText('Konfirmasi password tidak cocok');
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it('rejects short passwords at store boundary', async () => {
    await openRecovery();
    expect((await useAuthStore.getState().recoverPassword('short')).valid).toBe(false);
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it.each([null, { user: { id: 'different-user' }, expires_at: Date.now() / 1000 + 3600 }, { user: { id: 'recovery-user' }, expires_at: 1 }])('rejects missing, changed or expired session at submit: %j', async (currentSession) => {
    await openRecovery();
    mocks.getSession.mockResolvedValue({ data: { session: currentSession }, error: null });
    fillRecovery();
    await screen.findAllByText(/Tautan pemulihan tidak valid atau kedaluwarsa/);
    expect(mocks.updateUser).not.toHaveBeenCalled();
    expect(useAuthStore.getState().recoveryUserId).toBeNull();
  });

  it('shows loading, blocks double submit, handles update failure and retry', async () => {
    await openRecovery();
    let resolve!: (value: any) => void;
    mocks.updateUser.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    fillRecovery();
    await screen.findByRole('button', { name: 'Menyimpan...' });
    expect(screen.getByRole('button', { name: 'Menyimpan...' })).toBeDisabled();
    fireEvent.submit(screen.getByLabelText('Password Baru').closest('form')!);
    expect(mocks.updateUser).toHaveBeenCalledTimes(1);
    resolve({ error: { message: 'not exposed' } });
    await screen.findByText(/Gagal menyimpan password/);
    expect(screen.getByLabelText('Password Baru')).toHaveValue('');
    fillRecovery();
    await screen.findByText(/Password berhasil diubah/);
  });

  it('rejects ordinary sign-in without recovery event', async () => {
    mocks.callback!('SIGNED_IN', session());
    expect((await useAuthStore.getState().recoverPassword(password)).valid).toBe(false);
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it('clears recovery on sign-out', async () => {
    await openRecovery();
    mocks.callback!('SIGNED_OUT', null);
    await screen.findByText(/Tautan pemulihan tidak valid/);
    expect(useAuthStore.getState().recoveryUserId).toBeNull();
  });

  it.each([null, { user: { id: 'recovery-user' }, expires_at: 1 }])('ignores recovery event without valid session: %j', async (invalid) => {
    mocks.callback!('PASSWORD_RECOVERY', invalid);
    expect(useAuthStore.getState().recoveryUserId).toBeNull();
    expect((await useAuthStore.getState().recoverPassword(password)).valid).toBe(false);
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it.each(['getSession', 'updateUser'] as const)('handles rejected %s without exposing details', async (method) => {
    await openRecovery();
    mocks[method].mockRejectedValueOnce(new Error('private-error-details'));
    fillRecovery();
    await screen.findByText('Gagal menyimpan password. Coba lagi.');
    expect(screen.queryByText('private-error-details')).not.toBeInTheDocument();
  });

  it('ordinary sign-in invalidates earlier recovery even for same account', async () => {
    await openRecovery();
    mocks.callback!('SIGNED_IN', session());
    expect((await useAuthStore.getState().recoverPassword(password)).valid).toBe(false);
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it.each([true, false])('ordinary profile requires current password; correct verification=%s', async (correct) => {
    useAuthStore.setState({ user: { id: 'ordinary', email: 'test@example.invalid', name: 'Test', role: 'pengajar' }, isAuthenticated: true, loading: false });
    mocks.signIn.mockResolvedValue({ error: null });
    const { container } = render(<MemoryRouter><ProfilePage /></MemoryRouter>);
    const inputs = container.querySelectorAll('input');
    if (correct) fireEvent.change(inputs[0], { target: { value: 'Test-only-current-password!' } });
    fireEvent.change(inputs[1], { target: { value: password } });
    fireEvent.change(inputs[2], { target: { value: password } });
    fireEvent.click(screen.getByRole('button', { name: 'Simpan Password' }));
    if (correct) {
      await waitFor(() => expect(mocks.updateUser).toHaveBeenCalledExactlyOnceWith({ password }));
      expect(mocks.signIn).toHaveBeenCalledExactlyOnceWith({ email: 'test@example.invalid', password: 'Test-only-current-password!' });
      expect(mocks.signIn.mock.invocationCallOrder[0]).toBeLessThan(mocks.updateUser.mock.invocationCallOrder[0]);
    } else {
      expect(mocks.signIn).not.toHaveBeenCalled();
      expect(mocks.updateUser).not.toHaveBeenCalled();
    }
  });

  it('ordinary profile still rejects wrong current password before update', async () => {
    useAuthStore.setState({ user: { id: 'ordinary', email: 'test@example.invalid', name: 'Test', role: 'pengajar' }, isAuthenticated: true, loading: false });
    mocks.signIn.mockResolvedValue({ error: { message: 'wrong password' } });
    const { container } = render(<MemoryRouter><ProfilePage /></MemoryRouter>);
    const inputs = container.querySelectorAll('input');
    fireEvent.change(inputs[0], { target: { value: 'wrong-test-old-password' } });
    fireEvent.change(inputs[1], { target: { value: password } });
    fireEvent.change(inputs[2], { target: { value: password } });
    fireEvent.click(screen.getByRole('button', { name: 'Simpan Password' }));
    await waitFor(() => expect(mocks.signIn).toHaveBeenCalledExactlyOnceWith({ email: 'test@example.invalid', password: 'wrong-test-old-password' }));
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });
});
