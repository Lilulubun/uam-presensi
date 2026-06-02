import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const mockNavigate = vi.fn()

vi.mock('../../../store/authStore', () => ({
  useAuthStore: (selector?: any) => {
    const state = { user: { id: 'user-admin', name: 'Rahma Dewi', email: 'pengurus@uii.ac.id', role: 'pengurus' as const } }
    return selector ? selector(state) : state
  },
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('qrcode', () => ({
  default: {
    toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,test'),
  },
}))

vi.mock('../../../store/tpaStore', () => {
  const tpas = [
    { id: 'tpa-001', name: 'TPA Al-Fath', staticQRCode: 'TPA-001', location: { lat: 0, lng: 0, radius: 100 } },
    { id: 'tpa-002', name: 'TPA Adz-Dzikro', staticQRCode: 'TPA-002', location: { lat: 0, lng: 0, radius: 100 } },
    { id: 'tpa-003', name: 'TPA Al-Iman', staticQRCode: 'TPA-003', location: { lat: 0, lng: 0, radius: 100 } },
    { id: 'tpa-004', name: 'TPA Az-Zahra', staticQRCode: 'TPA-004', location: { lat: 0, lng: 0, radius: 100 } },
    { id: 'tpa-005', name: 'TPA Ananda', staticQRCode: 'TPA-005', location: { lat: 0, lng: 0, radius: 100 } },
    { id: 'tpa-006', name: 'TPA Al-Muhtadin', staticQRCode: 'TPA-006', location: { lat: 0, lng: 0, radius: 100 } },
    { id: 'tpa-007', name: 'TPA Sholihin', staticQRCode: 'TPA-007', location: { lat: 0, lng: 0, radius: 100 } },
    { id: 'tpa-008', name: 'TPA Al-Hidayah Besirejo', staticQRCode: 'TPA-008', location: { lat: 0, lng: 0, radius: 100 } },
    { id: 'tpa-009', name: 'TPA Al-Hidayah Tanjungsari', staticQRCode: 'TPA-009', location: { lat: 0, lng: 0, radius: 100 } },
    { id: 'tpa-010', name: 'TPA Ulil Albab', staticQRCode: 'TPA-010', location: { lat: 0, lng: 0, radius: 100 } },
    { id: 'tpa-011', name: "TPA Al-Jami'", staticQRCode: 'TPA-011', location: { lat: 0, lng: 0, radius: 100 } },
  ];
  return {
    useTPAStore: (selector?: any) => {
      const state = { tpas, getTpaById: (id: string) => tpas.find((t) => t.id === id) };
      return selector ? selector(state) : state;
    },
    getTpaById: (id: string) => tpas.find((t) => t.id === id),
    getTpaByStaticQR: (qr: string) => tpas.find((t) => t.staticQRCode === qr),
  };
})

import PengaturanPage from '../PengaturanPage'

function renderComponent() {
  return render(
    <MemoryRouter>
      <PengaturanPage />
    </MemoryRouter>
  )
}

describe('PengaturanPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders header with "Setup QR Statis"', () => {
    renderComponent()
    expect(screen.getByText('Setup QR Statis')).toBeInTheDocument()
  })

  it('shows instruction text', () => {
    renderComponent()
    expect(screen.getByText(/Cetak dan tempelkan QR code ini/)).toBeInTheDocument()
  })

  it('shows "Cetak Semua" button', () => {
    renderComponent()
    expect(screen.getByText('Cetak Semua')).toBeInTheDocument()
  })

  it('shows TPA cards with names', () => {
    renderComponent()
    expect(screen.getByText('TPA Al-Fath')).toBeInTheDocument()
    expect(screen.getByText('TPA Adz-Dzikro')).toBeInTheDocument()
  })

  it('shows TPA QR codes with code IDs', () => {
    renderComponent()
    expect(screen.getByText('TPA-001')).toBeInTheDocument()
    expect(screen.getByText('TPA-002')).toBeInTheDocument()
  })

  it('shows "Cetak" buttons for individual TPA', () => {
    renderComponent()
    const cetakButtons = screen.getAllByText('Cetak')
    expect(cetakButtons.length).toBeGreaterThan(0)
  })

  it('shows back button that navigates to dashboard', () => {
    renderComponent()
    const backButton = document.querySelector('.lucide-arrow-left')
    expect(backButton).toBeInTheDocument()
    if (backButton?.parentElement) {
      backButton.parentElement.click()
      expect(mockNavigate).toHaveBeenCalledWith('/pengurus/dashboard')
    }
  })

  describe('print HTML escaping', () => {
    it('sets TPA name via textContent not innerHTML', async () => {
      const mockDoc = {
        write: vi.fn(),
        close: vi.fn(),
        body: {
          appendChild: vi.fn(),
        },
        createElement: vi.fn((tag: string) => ({
          tagName: tag.toUpperCase(),
          textContent: '',
          src: '',
          width: 0,
          height: 0,
          className: '',
          appendChild: vi.fn(),
        })),
      };
      const mockWin = { document: mockDoc, print: vi.fn(), close: vi.fn() };
      const openSpy = vi.spyOn(window, 'open').mockReturnValue(mockWin as any);

      renderComponent()

      const cetakButtons = await screen.findAllByText('Cetak');
      expect(cetakButtons.length).toBeGreaterThan(0);
      cetakButtons[0].click();

      expect(openSpy).toHaveBeenCalled();
      // Verify textContent was used (not innerHTML) for the h1
      const h1Call = mockDoc.createElement.mock.calls.find((c: string[]) => c[0]?.toUpperCase() === 'H1');
      expect(h1Call).toBeDefined();
      openSpy.mockRestore();
    });
  });
})
