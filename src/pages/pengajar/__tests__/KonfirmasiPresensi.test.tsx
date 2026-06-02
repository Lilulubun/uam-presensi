import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const mockNavigate = vi.fn()
let mockLocationState: any = null

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ state: mockLocationState }),
  }
})

import KonfirmasiPresensi from '../KonfirmasiPresensi'

function renderComponent() {
  return render(
    <MemoryRouter>
      <KonfirmasiPresensi />
    </MemoryRouter>
  )
}

describe('KonfirmasiPresensi - First-teacher auto scan', () => {
  it('shows info banner for FIRST_TEACHER_AUTO reason', () => {
    mockLocationState = {
      success: true,
      type: 'in',
      message: 'Presensi Anda sudah otomatis tercatat saat membuka sesi',
      reason: 'FIRST_TEACHER_AUTO',
      data: { attendance: { id: 'att-1', scanInTime: new Date() } },
    }
    renderComponent()
    expect(screen.getByText('Presensi Masuk Tercatat')).toBeInTheDocument()
    expect(screen.getByText(/sudah otomatis tercatat saat membuka sesi/)).toBeInTheDocument()
  })

  it('shows info icon (not success/error) for first-teacher auto', () => {
    mockLocationState = {
      success: true,
      type: 'in',
      message: 'Presensi Anda sudah otomatis tercatat saat membuka sesi',
      reason: 'FIRST_TEACHER_AUTO',
      data: { attendance: { id: 'att-1', scanInTime: new Date() } },
    }
    renderComponent()
    expect(screen.getByText(/Scan diabaikan/)).toBeInTheDocument()
  })

  it('shows normal success banner when reason is null', () => {
    mockLocationState = {
      success: true,
      type: 'in',
      message: 'Presensi masuk berhasil',
      reason: null,
      data: { attendance: { id: 'att-1', scanInTime: new Date() } },
    }
    renderComponent()
    expect(screen.getByText('Presensi Masuk Berhasil!')).toBeInTheDocument()
    expect(screen.queryByText(/Scan diabaikan/)).not.toBeInTheDocument()
  })

  it('redirects to dashboard when no state', () => {
    mockLocationState = null
    renderComponent()
    expect(mockNavigate).toHaveBeenCalledWith('/pengajar/dashboard')
  })
})
