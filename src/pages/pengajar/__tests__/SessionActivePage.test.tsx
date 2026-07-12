import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { Session, Attendance } from '../../../types'

let mockSession: Session | null = null
let mockAttendances: Attendance[] = []
const mockCloseSession = vi.fn()
const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate, useParams: () => ({ sessionId: 'session-1' }) }
})

vi.mock('../../../app/hooks/useRealtimeSessions', () => ({
  useRealtimeSessions: () => {},
}))

vi.mock('../../../store/authStore', () => ({
  useAuthStore: (selector?: any) => {
    const state = {
      user: { id: 'user-001', name: 'Budi Santoso', email: 'budi@uii.ac.id', role: 'pengajar' as const, nim: '21511001' },
      isAuthenticated: true,
    }
    return selector ? selector(state) : state
  },
}))

vi.mock('../../../store/sessionStore', () => ({
  useSessionStore: (selector?: any) => {
    const state = {
      sessions: mockSession ? [mockSession] : [],
      activeSession: mockSession,
      closeSession: mockCloseSession,
    }
    return selector ? selector(state) : state
  },
}))

vi.mock('../../../store/attendanceStore', () => ({
  useAttendanceStore: (selector?: any) => {
    const state = { attendances: mockAttendances }
    return selector ? selector(state) : state
  },
}))

vi.mock('../../../store/tpaStore', () => ({
  getTpaById: () => ({ id: 'tpa-001', name: 'TPA Al-Fath' }),
}))

vi.mock('../../../store/userStore', () => ({
  getUserById: () => ({ id: 'user-001', name: 'Budi Santoso' }),
  useUsersStore: (selector?: any) => {
    const state = {
      users: [{ id: 'user-001', name: 'Budi Santoso', email: 'budi@uii.ac.id', role: 'pengajar' }],
      loading: false,
      pengajarByTPA: {},
      fetchPengajarByTPA: vi.fn(),
    }
    return selector ? selector(state) : state
  },
}))

vi.mock('../../../lib/date-utils', () => ({
  formatTime: () => '08:00',
  formatDateTime: () => '01 Jan 2026 08:00',
}))

vi.mock('../../../app/hooks/useDynamicQR', () => ({
  useDynamicQR: () => ({ qrDataUrl: 'data:image/png;base64,mock', secondsLeft: 20 }),
}))

vi.mock('../../../lib/gps-utils', () => ({
  getCurrentLocation: () => Promise.resolve({ lat: -7.68, lng: 110.41 }),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import SessionActivePage from '../SessionActivePage'

function renderComponent() {
  return render(
    <MemoryRouter>
      <SessionActivePage />
    </MemoryRouter>
  )
}

describe('SessionActivePage - Konfirmasi Penutupan', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSession = {
      id: 'session-1',
      tpaId: 'tpa-001',
      firstTeacherId: 'user-001',
      dateOpened: new Date(),
      isActive: true,
    } as Session
    mockAttendances = []
  })

  it('renders session details when session is found', () => {
    renderComponent()
    expect(screen.getByText('TPA Al-Fath')).toBeInTheDocument()
  })

  it('shows Tutup Sesi button for first teacher when session is active', () => {
    renderComponent()
    expect(screen.getByRole('button', { name: /Tutup Sesi/ })).toBeInTheDocument()
  })

  it('opens AlertDialog when Tutup Sesi is clicked', () => {
    renderComponent()
    fireEvent.click(screen.getByRole('button', { name: /Tutup Sesi/ }))
    expect(screen.getByText('Tutup sesi?')).toBeInTheDocument()
  })

  it('shows confirmation description in the dialog', () => {
    renderComponent()
    fireEvent.click(screen.getByRole('button', { name: /Tutup Sesi/ }))
    expect(screen.getByText(/Menutup sesi akan memfinalisasi kehadiran hari ini/)).toBeInTheDocument()
  })

  it('calls closeSession when confirmed', async () => {
    mockCloseSession.mockResolvedValueOnce({ valid: true, message: 'Sesi berhasil ditutup' })
    renderComponent()
    fireEvent.click(screen.getByRole('button', { name: /Tutup Sesi/ }))
    
    // Fill in the notes field since it is required to enable the confirm button
    const textarea = screen.getByPlaceholderText(/Materi yang diberikan hari ini/)
    fireEvent.change(textarea, { target: { value: 'Belajar Tajwid' } })

    const confirmButton = screen.getByRole('button', { name: /^Tutup Sesi$/ })
    fireEvent.click(confirmButton)
    await vi.waitFor(() => {
      expect(mockCloseSession).toHaveBeenCalledWith('session-1', { lat: -7.68, lng: 110.41 }, 'Belajar Tajwid')
    })
  })

  it('does not call closeSession when cancelled', () => {
    renderComponent()
    fireEvent.click(screen.getByRole('button', { name: /Tutup Sesi/ }))
    const cancelButton = screen.getByRole('button', { name: /Batal/ })
    fireEvent.click(cancelButton)
    expect(mockCloseSession).not.toHaveBeenCalled()
  })

  it('hides the confirmation dialog after cancel', () => {
    renderComponent()
    fireEvent.click(screen.getByRole('button', { name: /Tutup Sesi/ }))
    expect(screen.getByText('Tutup sesi?')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Batal/ }))
    expect(screen.queryByText('Tutup sesi?')).not.toBeInTheDocument()
  })

  it('does not show Tutup Sesi button when session is inactive', () => {
    mockSession = { ...mockSession!, isActive: false }
    renderComponent()
    expect(screen.queryByRole('button', { name: /Tutup Sesi/ })).not.toBeInTheDocument()
  })

  it('shows Kembali ke Dashboard when session is inactive', () => {
    mockSession = { ...mockSession!, isActive: false }
    renderComponent()
    expect(screen.getByRole('button', { name: /Kembali ke Dashboard/ })).toBeInTheDocument()
  })
})
