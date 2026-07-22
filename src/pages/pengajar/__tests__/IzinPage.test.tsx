import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import IzinPage from '../IzinPage';

const mockNavigate = vi.fn();
const mockSubmitIzin = vi.fn().mockResolvedValue({ valid: true, message: 'Izin diajukan' });
const mockFetchMyIzins = vi.fn();

vi.mock('../../../store/authStore', () => ({
  useAuthStore: () => ({ user: { id: 'user-1', name: 'Nawal Haq' } }),
}));

vi.mock('../../../store/izinStore', () => ({
  useIzinStore: () => ({
    myIzins: [
      { id: 'iz-1', startDate: '2026-07-22', endDate: '2026-07-23', alasan: 'Sakit', status: 'pending' },
    ],
    loading: false,
    submitIzin: mockSubmitIzin,
    fetchMyIzins: mockFetchMyIzins,
  }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

function renderComponent() {
  return render(
    <MemoryRouter>
      <IzinPage />
    </MemoryRouter>
  );
}

describe('IzinPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly', () => {
    renderComponent();
    expect(screen.getByRole('heading', { name: 'Ajukan Izin' })).toBeInTheDocument();
    expect(screen.getByText('Form Izin')).toBeInTheDocument();
    expect(screen.getByText('Riwayat Pengajuan')).toBeInTheDocument();
  });

  it('submits izin form', async () => {
    renderComponent();
    fireEvent.change(screen.getByLabelText(/Tanggal Mulai/i), { target: { value: '2026-07-25' } });
    fireEvent.change(screen.getByLabelText(/Tanggal Akhir/i), { target: { value: '2026-07-26' } });
    fireEvent.change(screen.getByPlaceholderText(/Tuliskan alasan izin/i), { target: { value: 'Sakit' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ajukan Izin' }));
    expect(mockSubmitIzin).toHaveBeenCalledOnce();
  });
});
