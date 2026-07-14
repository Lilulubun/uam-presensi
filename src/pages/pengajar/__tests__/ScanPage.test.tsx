import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockOpenSessionWithExpected = vi.fn();
const mockGetActiveSessionByTPA = vi.fn().mockReturnValue(null);
const mockFetchPengajarByTPA = vi.fn();
const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../../../store/authStore', () => ({
  useAuthStore: (selector?: any) => {
    const state = {
      user: { id: 'user-001', name: 'Budi Santoso', email: 'budi@uii.ac.id', role: 'pengajar' as const, nim: '21511001' },
      isAuthenticated: true,
    };
    return selector ? selector(state) : state;
  },
}));

vi.mock('../../../store/sessionStore', () => ({
  useSessionStore: (selector?: any) => {
    const state = {
      openSessionWithExpected: mockOpenSessionWithExpected,
      getActiveSessionByTPA: mockGetActiveSessionByTPA,
    };
    return selector ? selector(state) : state;
  },
}));

vi.mock('../../../store/attendanceStore', () => ({
  useAttendanceStore: (selector?: any) => {
    const state = { checkIn: vi.fn(), checkOut: vi.fn() };
    return selector ? selector(state) : state;
  },
}));

vi.mock('../../../store/tpaStore', () => ({
  getTpaByStaticQR: () => ({ id: 'tpa-001', name: 'TPA Al-Fath', location: { lat: -7.68, lng: 110.41, radius: 500 } }),
}));

vi.mock('../../../store/userStore', () => ({
  useUsersStore: (selector?: any) => {
    const state = {
      pengajarByTPA: {
        'tpa-001': [
          { id: 'user-001', name: 'Budi Santoso', email: 'budi@uii.ac.id', role: 'pengajar', nim: '21511001' },
          { id: 'user-002', name: 'Ani Rahayu', email: 'ani@uii.ac.id', role: 'pengajar', nim: '21511002' },
          { id: 'user-003', name: 'Cici Dewi', email: 'cici@uii.ac.id', role: 'pengajar', nim: '21511003' },
        ],
      },
      fetchPengajarByTPA: mockFetchPengajarByTPA,
    };
    return selector ? selector(state) : state;
  },
}));

vi.mock('../../../app/hooks/useWatchLocation', () => ({
  useWatchLocation: () => ({
    locationState: { status: 'ready', coords: { lat: -7.68, lng: 110.41 } },
    nearestTPA: null,
    refetch: vi.fn(),
  }),
}));

vi.mock('../../../lib/gps-utils', () => ({
  getCurrentLocation: () => Promise.resolve({ lat: -7.68, lng: 110.41 }),
  calculateDistance: () => 0,
}));

vi.mock('../../../lib/qr-utils', () => ({
  decodeQRData: () => null,
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../../../app/components/qr/QRScanner', () => ({
  QRScanner: ({ onScan }: { onScan: (text: string) => void; onError: (err: string) => void }) => {
    // Expose scan trigger globally for test
    (window as any).__triggerQRScan = onScan;
    return <div data-testid="qr-scanner">QR Scanner Mock</div>;
  },
}));

import ScanPage from '../ScanPage';

function renderComponent() {
  return render(
    <MemoryRouter>
      <ScanPage />
    </MemoryRouter>
  );
}

describe('ScanPage — ExpectedTeacherSelector integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetActiveSessionByTPA.mockReturnValue(null);
    mockOpenSessionWithExpected.mockResolvedValue({
      valid: true,
      message: 'Sesi berhasil dibuka',
      data: { id: 'session-1' },
    });
  });

  async function grantLocationAndScan() {
    renderComponent();

    // First, grant location permission
    const locationBtn = screen.getByRole('button', { name: /Izinkan Akses Lokasi/ });
    await act(async () => {
      fireEvent.click(locationBtn);
    });

    // Wait for QR scanner to appear
    await waitFor(() => {
      expect(screen.getByTestId('qr-scanner')).toBeInTheDocument();
    });

    // Trigger static QR scan for TPA
    await act(async () => {
      (window as any).__triggerQRScan('static-qr-token');
    });
  }

  it('shows ExpectedTeacherSelector after static QR scan with valid GPS', async () => {
    await grantLocationAndScan();

    await waitFor(() => {
      expect(screen.getByText('Pilih Pengajar yang Wajib Hadir')).toBeInTheDocument();
    });
  });

  it('shows all TPA teachers as checkboxes after scan', async () => {
    await grantLocationAndScan();

    await waitFor(() => {
      expect(screen.getByText('Budi Santoso')).toBeInTheDocument();
      expect(screen.getByText('Ani Rahayu')).toBeInTheDocument();
      expect(screen.getByText('Cici Dewi')).toBeInTheDocument();
    });
  });

  it('calls openSessionWithExpected with selected IDs when submit clicked', async () => {
    await grantLocationAndScan();

    await waitFor(() => {
      expect(screen.getByText('Pilih Pengajar yang Wajib Hadir')).toBeInTheDocument();
    });

    // Check Budi and Ani
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]); // Budi
    fireEvent.click(checkboxes[1]); // Ani

    // Submit
    fireEvent.click(screen.getByRole('button', { name: /Buka Sesi/ }));

    await waitFor(() => {
      expect(mockOpenSessionWithExpected).toHaveBeenCalledWith(
        'tpa-001',
        { lat: -7.68, lng: 110.41 },
        ['user-001', 'user-002'],
      );
    });
  });

  it('navigates to session page after successful open', async () => {
    await grantLocationAndScan();

    await waitFor(() => {
      expect(screen.getByText('Pilih Pengajar yang Wajib Hadir')).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole('checkbox')[0]); // Select Budi
    fireEvent.click(screen.getByRole('button', { name: /Buka Sesi/ }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/pengajar/session/session-1');
    });
  });

  it('shows cancel button that hides the selector', async () => {
    await grantLocationAndScan();

    await waitFor(() => {
      expect(screen.getByText('Pilih Pengajar yang Wajib Hadir')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Batal/ }));

    await waitFor(() => {
      expect(screen.queryByText('Pilih Pengajar yang Wajib Hadir')).not.toBeInTheDocument();
    });
  });
});
