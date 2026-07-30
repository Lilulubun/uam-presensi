import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockGetActiveSessionByTPA = vi.fn();
vi.mock('../../../store/sessionStore', () => ({
  useSessionStore: (selector?: any) => {
    const state = {
      getActiveSessionByTPA: mockGetActiveSessionByTPA,
      init: vi.fn(),
    };
    return selector ? selector(state) : state;
  },
}));

vi.mock('../../../store/attendanceStore', () => ({
  useAttendanceStore: (selector?: any) => {
    const state = { init: vi.fn() };
    return selector ? selector(state) : state;
  },
}));

const mockOpenSessionV2 = vi.fn();
const mockCheckInV2 = vi.fn();
vi.mock('../../../store/attendanceV2Adapter', () => ({
  openSessionV2: mockOpenSessionV2,
  checkInV2: mockCheckInV2,
}));

vi.mock('../../../store/tpaStore', () => ({
  getTpaByStaticQR: () => ({
    id: 'tpa-001',
    name: 'TPA Al-Fath',
    location: { lat: -7.68, lng: 110.41, radius: 500 },
  }),
  getTpaById: () => null,
}));

const mockFetchPengajarByTPA = vi.fn();
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
    mockOpenSessionV2.mockResolvedValue({
      valid: true,
      message: 'Sesi berhasil dibuka',
      data: { session: { id: 'session-1' } },
    });
  });

  async function grantLocationAndScan() {
    renderComponent();

    const locationBtn = screen.getByRole('button', { name: /Izinkan Akses Lokasi/ });
    await act(async () => {
      fireEvent.click(locationBtn);
    });

    await waitFor(() => {
      expect(screen.getByTestId('qr-scanner')).toBeInTheDocument();
    });

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

  it('calls openSessionV2 with selected IDs when submit clicked', async () => {
    await grantLocationAndScan();

    await waitFor(() => {
      expect(screen.getByText('Pilih Pengajar yang Wajib Hadir')).toBeInTheDocument();
    });

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]); // Budi
    fireEvent.click(checkboxes[1]); // Ani

    fireEvent.click(screen.getByRole('button', { name: /Buka Sesi/ }));

    await waitFor(() => {
      expect(mockOpenSessionV2).toHaveBeenCalledWith(
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

    fireEvent.click(screen.getAllByRole('checkbox')[0]);
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

  it('handles race condition gracefully when session is concurrently opened', async () => {
    mockOpenSessionV2.mockResolvedValueOnce({
      valid: false,
      message: 'TPA ini sudah memiliki sesi aktif',
    });

    await grantLocationAndScan();

    await waitFor(() => {
      expect(screen.getByText('Pilih Pengajar yang Wajib Hadir')).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    fireEvent.click(screen.getByRole('button', { name: /Buka Sesi/ }));

    await waitFor(() => {
      expect(screen.queryByText('Pilih Pengajar yang Wajib Hadir')).not.toBeInTheDocument();
      expect(screen.getByText('Sudah Ada Sesi Aktif')).toBeInTheDocument();
    });
  });
});
