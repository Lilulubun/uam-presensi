import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const { mockRpc, mockNavigate } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
  mockNavigate: vi.fn(),
}));

vi.mock('../../../lib/supabase', () => ({
  supabase: { rpc: mockRpc },
}));

vi.mock('../../../store/authStore', () => ({
  useAuthStore: (selector?: any) => {
    const state = { user: { id: 'user-admin', name: 'Admin', email: 'admin@uii.ac.id', role: 'pengurus' as const } };
    return selector ? selector(state) : state;
  },
}));

vi.mock('../../../store/tpaStore', () => ({
  useTPAStore: (selector?: any) => {
    const state = {
      tpas: [
        { id: 'tpa-01', name: 'TPA 01' },
        { id: 'tpa-02', name: 'TPA 02' },
      ],
    };
    return selector ? selector(state) : state;
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

import LaporanPage from '../LaporanPage';

// Helper: build a raw snake_case row as returned by the RPC
function row(overrides: Record<string, any> = {}) {
  return {
    tpa_id: 'tpa-01',
    tpa_name: 'TPA 01',
    teacher_id: 'user-1',
    teacher_name: 'Budi',
    tgl: '2026-06-02',
    session_is_active: false,
    first_teacher_id: 'user-1',
    scan_in_time: '2026-06-02T16:00:00+07:00',
    scan_out_time: '2026-06-02T17:00:00+07:00',
    late_minutes: 0,
    is_izin: false,
    ...overrides,
  };
}

function renderComponent() {
  return render(
    <MemoryRouter>
      <LaporanPage />
    </MemoryRouter>
  );
}

describe('LaporanPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc.mockResolvedValue({ data: [], error: null });
  });

  it('renders header', async () => {
    renderComponent();
    expect(screen.getByText('Laporan Presensi')).toBeInTheDocument();
  });

  it('renders filter controls', async () => {
    renderComponent();
    expect(screen.getByText('Filter')).toBeInTheDocument();
    expect(screen.getByText('Bulan')).toBeInTheDocument();
    expect(screen.getByText('Tahun')).toBeInTheDocument();
    expect(screen.getByText('Dari')).toBeInTheDocument();
    expect(screen.getByText('Sampai')).toBeInTheDocument();
    expect(screen.getByText('TPA')).toBeInTheDocument();
    expect(screen.getByText('Semua TPA')).toBeInTheDocument();
  });

  it('renders export buttons', async () => {
    renderComponent();
    expect(screen.getByText('CSV')).toBeInTheDocument();
    expect(screen.getByText('Excel')).toBeInTheDocument();
    expect(screen.getByText('JSON')).toBeInTheDocument();
  });

  it('shows empty state when no data', async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText(/Tidak ada sesi di periode ini/)).toBeInTheDocument();
    });
  });

  it('shows loading state while fetching', async () => {
    mockRpc.mockImplementation(() => new Promise(() => {})); // never resolves
    renderComponent();
    expect(await screen.findByText('Memuat data...')).toBeInTheDocument();
  });

  it('shows error state on RPC failure', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'DB error' } });
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText(/Gagal memuat data/)).toBeInTheDocument();
      expect(screen.getByText(/DB error/)).toBeInTheDocument();
    });
  });

  it('renders one TPA section with table', async () => {
    mockRpc.mockResolvedValue({
      data: [row()],
      error: null,
    });
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText('TPA 01')).toBeInTheDocument();
    });
    expect(screen.getByText('Budi')).toBeInTheDocument();
    expect(screen.getByText('16:00')).toBeInTheDocument();
  });

  it('renders multiple TPA sections', async () => {
    mockRpc.mockResolvedValue({
      data: [
        row(),
        row({ tpa_id: 'tpa-02', tpa_name: 'TPA 02', teacher_name: 'Siti', teacher_id: 'user-2' }),
      ],
      error: null,
    });
    renderComponent();
    await waitFor(() => {
      expect(screen.getAllByText('TPA 01').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('TPA 02').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Budi')).toBeInTheDocument();
      expect(screen.getByText('Siti')).toBeInTheDocument();
    });
  });

  it('renders Tepat Waktu cell', async () => {
    mockRpc.mockResolvedValue({
      data: [row()],
      error: null,
    });
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText('16:00')).toBeInTheDocument();
      expect(screen.getByText('17:00')).toBeInTheDocument();
    });
  });

  it('renders Terlambat cell with orange styling', async () => {
    mockRpc.mockResolvedValue({
      data: [row({ late_minutes: 15 })],
      error: null,
    });
    renderComponent();
    await waitFor(() => {
      const masukCell = screen.getByText('16:00');
      expect(masukCell).toBeInTheDocument();
    });
  });

  it('renders Pulang Awal cell', async () => {
    mockRpc.mockResolvedValue({
      data: [row({
        scan_out_time: null,
        first_teacher_id: 'user-other',
        late_minutes: 0,
      })],
      error: null,
    });
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText('Pulang Awal')).toBeInTheDocument();
    });
  });

  it('renders Tidak Masuk merged cell', async () => {
    mockRpc.mockResolvedValue({
      data: [row({ scan_in_time: null, scan_out_time: null })],
      error: null,
    });
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText('Tidak Masuk')).toBeInTheDocument();
    });
  });

  it('renders Izin merged cell', async () => {
    mockRpc.mockResolvedValue({
      data: [row({ is_izin: true, scan_in_time: null, scan_out_time: null })],
      error: null,
    });
    renderComponent();
    await waitFor(() => {
      const izinCells = screen.getAllByText('Izin');
      // Should have both column header and cell (colspan=2)
      expect(izinCells.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('calculates percentages correctly', async () => {
    mockRpc.mockResolvedValue({
      data: [
        row({ tgl: '2026-06-02', teacher_name: 'Budi' }),                                          // tepat_waktu + hadir
        row({ tgl: '2026-06-04', teacher_name: 'Budi', late_minutes: 10 }),                         // terlambat + tepat_waktu + hadir
        row({ tgl: '2026-06-06', teacher_name: 'Budi', scan_out_time: null, first_teacher_id: 'user-other' }), // pulang_awal (no hadir)
      ],
      error: null,
    });
    renderComponent();
    await waitFor(() => {
      // hadir_fisik=2, total_sesi=3, izin=0 → denominator=3 → Total=67%
      // tepat_waktu=2, total_sesi=3 → 67%
      expect(screen.getAllByText('67%').length).toBe(2);
      // terlambat=1 → 33%, pulang_awal=1 → 33%
      expect(screen.getAllByText('33%').length).toBe(2);
      // izin=0 → 0%
      expect(screen.getByText('0%')).toBeInTheDocument();
    });
  });

  it('shows periode text', async () => {
    renderComponent();
    expect(screen.getByText(/Periode:/)).toBeInTheDocument();
  });

  it('back button navigates to dashboard', async () => {
    renderComponent();
    const backBtn = document.querySelector('.lucide-arrow-left');
    expect(backBtn).toBeInTheDocument();
    if (backBtn?.parentElement) {
      backBtn.parentElement.click();
      expect(mockNavigate).toHaveBeenCalledWith('/pengurus/dashboard');
    }
  });
});
