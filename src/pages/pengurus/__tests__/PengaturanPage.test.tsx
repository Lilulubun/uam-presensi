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
})
