import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import PermissionPrompt from '../PermissionPrompt'

const mockGetCurrentLocation = vi.fn()

vi.mock('../../../../lib/gps-utils', () => ({
  getCurrentLocation: () => mockGetCurrentLocation(),
}))

vi.mock('../../../../config', () => ({
  GPS_DEBUG_MODE: false,
}))

function renderComponent() {
  return render(
    <PermissionPrompt>
      <div data-testid="scanner-content">QR Scanner</div>
    </PermissionPrompt>
  )
}

describe('PermissionPrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows "Izinkan Akses Lokasi" button initially', () => {
    renderComponent()
    expect(screen.getByRole('button', { name: /Izinkan Akses Lokasi/ })).toBeInTheDocument()
    expect(screen.queryByTestId('scanner-content')).not.toBeInTheDocument()
  })

  it('shows scanner when location permission is granted', async () => {
    mockGetCurrentLocation.mockResolvedValueOnce({ lat: -7.7, lng: 110.4 })
    renderComponent()
    fireEvent.click(screen.getByRole('button', { name: /Izinkan Akses Lokasi/ }))
    expect(await screen.findByTestId('scanner-content')).toBeInTheDocument()
  })

  it('shows recovery banner when permission is denied', async () => {
    mockGetCurrentLocation.mockRejectedValueOnce(new Error('Izinkan akses lokasi untuk melanjutkan'))
    renderComponent()
    fireEvent.click(screen.getByRole('button', { name: /Izinkan Akses Lokasi/ }))
    expect(await screen.findByText(/Buka pengaturan browser/)).toBeInTheDocument()
    expect(screen.queryByTestId('scanner-content')).not.toBeInTheDocument()
  })

  it('shows recovery instructions text', async () => {
    mockGetCurrentLocation.mockRejectedValueOnce(new Error('Izinkan akses lokasi untuk melanjutkan'))
    renderComponent()
    fireEvent.click(screen.getByRole('button', { name: /Izinkan Akses Lokasi/ }))
    expect(await screen.findByText(/izinkan lokasi untuk situs ini/)).toBeInTheDocument()
  })

  it('shows general error message for non-permission errors', async () => {
    mockGetCurrentLocation.mockRejectedValueOnce(new Error('Waktu permintaan lokasi habis'))
    renderComponent()
    fireEvent.click(screen.getByRole('button', { name: /Izinkan Akses Lokasi/ }))
    expect(await screen.findByText('Waktu permintaan lokasi habis')).toBeInTheDocument()
    expect(screen.queryByTestId('scanner-content')).not.toBeInTheDocument()
  })

  it('allows retry after a non-permission error', async () => {
    mockGetCurrentLocation
      .mockRejectedValueOnce(new Error('Waktu permintaan lokasi habis'))
      .mockResolvedValueOnce({ lat: -7.7, lng: 110.4 })
    renderComponent()
    fireEvent.click(screen.getByRole('button', { name: /Izinkan Akses Lokasi/ }))
    expect(await screen.findByText('Waktu permintaan lokasi habis')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Coba Lagi/ }))
    expect(await screen.findByTestId('scanner-content')).toBeInTheDocument()
  })
})
