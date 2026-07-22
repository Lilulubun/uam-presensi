import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockNavigate = vi.fn();
const mockFetchAllIzins = vi.fn();

vi.mock('../../../store/izinStore', () => {
  return {
    useIzinStore: (selector?: any) => {
      const state = {
        allIzins: [
          {
            id: 'iz-1',
            userId: 'user-1',
            userName: 'Nawal Haq',
            startDate: '2026-07-22',
            endDate: '2026-07-23',
            alasan: 'Sakit demam',
            status: 'pending',
          },
          {
            id: 'iz-2',
            userId: 'user-2',
            userName: 'Budi Santoso',
            startDate: '2026-07-20',
            endDate: '2026-07-21',
            alasan: 'Keperluan keluarga',
            status: 'approved',
            reviewedByName: 'Admin',
          },
        ],
        fetchAllIzins: mockFetchAllIzins,
      };
      return selector ? selector(state) : state;
    },
  };
});

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

import RiwayatIzinPengurus from '../RiwayatIzinPengurus';

function renderComponent() {
  return render(
    <MemoryRouter>
      <RiwayatIzinPengurus />
    </MemoryRouter>
  );
}

describe('RiwayatIzinPengurus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders header with title', () => {
    renderComponent();
    expect(screen.getByText('Riwayat Izin')).toBeInTheDocument();
  });

  it('calls fetchAllIzins on mount', () => {
    renderComponent();
    expect(mockFetchAllIzins).toHaveBeenCalledOnce();
  });

  it('renders list of izin requests', () => {
    renderComponent();
    expect(screen.getByText('Nawal Haq')).toBeInTheDocument();
    expect(screen.getByText('Sakit demam')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();

    expect(screen.getByText('Budi Santoso')).toBeInTheDocument();
    expect(screen.getByText('Keperluan keluarga')).toBeInTheDocument();
    expect(screen.getByText('Disetujui')).toBeInTheDocument();
  });

  it('navigates to dashboard when back button is clicked', () => {
    renderComponent();
    const backButton = document.querySelector('.lucide-arrow-left');
    expect(backButton).toBeInTheDocument();
    if (backButton?.parentElement) {
      backButton.parentElement.click();
      expect(mockNavigate).toHaveBeenCalledWith('/pengurus/dashboard');
    }
  });
});
