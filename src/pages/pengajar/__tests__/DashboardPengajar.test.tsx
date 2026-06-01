import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { User, Session, Attendance } from '../../../types'

// Shared mutable state for mocks
let mockAttendances: Attendance[] = []
let mockActiveSession: Session | null = null
let mockSessions: Session[] = []
const mockLogout = vi.fn()
const mockNavigate = vi.fn()

vi.mock('../../../store/authStore', () => ({
  useAuthStore: (selector?: any) => {
    const state = {
      user: { id: 'user-001', name: 'Budi Santoso', email: 'budi@uii.ac.id', role: 'pengajar' as const, nim: '21511001' },
      isAuthenticated: true,
      logout: mockLogout,
    }
    return selector ? selector(state) : state
  },
}))

vi.mock('../../../store/sessionStore', () => ({
  useSessionStore: (selector?: any) => {
    const state = { sessions: mockSessions, activeSession: mockActiveSession }
    return selector ? selector(state) : state
  },
}))

vi.mock('../../../store/attendanceStore', () => ({
  useAttendanceStore: (selector?: any) => {
    const state = { attendances: mockAttendances }
    return selector ? selector(state) : state
  },
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('../../../app/hooks/useWatchLocation', () => ({
  useWatchLocation: () => ({
    locationState: { status: 'idle' },
    nearestTPA: null,
    refetch: vi.fn(),
  }),
}))

import DashboardPengajar from '../DashboardPengajar'

function renderComponent() {
  return render(
    <MemoryRouter>
      <DashboardPengajar />
    </MemoryRouter>
  )
}

describe('DashboardPengajar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAttendances = []
    mockActiveSession = null
    mockSessions = []
  })

  it('renders the user name in the header', () => {
    renderComponent()
    expect(screen.getByText(/Budi Santoso/)).toBeInTheDocument()
  })

  it('shows "Belum Presensi" when no attendance for today', () => {
    renderComponent()
    expect(screen.getByText('Belum Presensi')).toBeInTheDocument()
  })

  it('shows scan QR button that navigates to scan page', () => {
    renderComponent()
    const scanButton = screen.getByRole('button', { name: /Scan QR Presensi/ })
    expect(scanButton).toBeInTheDocument()
    scanButton.click()
    expect(mockNavigate).toHaveBeenCalledWith('/pengajar/scan')
  })

  it('shows "Lihat semua riwayat" link when history exists', () => {
    mockAttendances = [
      {
        id: 'att-1', sessionId: 'session-1', userId: 'user-001',
        scanInTime: new Date(), scanOutTime: new Date(),
        isLate: false, lateMinutes: 0,
      } as Attendance,
    ]
    renderComponent()
    const link = screen.getByText('Lihat semua riwayat')
    expect(link).toBeInTheDocument()
    link.click()
    expect(mockNavigate).toHaveBeenCalledWith('/pengajar/riwayat')
  })

  it('shows active session button when session is active', () => {
    mockActiveSession = {
      id: 'session-1', tpaId: 'tpa-001',
      dateOpened: new Date(), firstTeacherId: 'user-001',
      isActive: true,
    } as Session
    renderComponent()
    expect(screen.getByText(/Kelola Sesi Aktif/)).toBeInTheDocument()
  })

  it('shows presence status when user has checked in', () => {
    mockAttendances = [
      {
        id: 'att-1', sessionId: 'session-1', userId: 'user-001',
        scanInTime: new Date(), isLate: false, lateMinutes: 0,
      } as Attendance,
    ]
    renderComponent()
    const now = new Date()
    const hours = String(now.getHours()).padStart(2, '0')
    const minutes = String(now.getMinutes()).padStart(2, '0')
    expect(screen.getByText(new RegExp(`Masuk pukul ${hours}:${minutes}`))).toBeInTheDocument()
  })

  it('shows late badge when late', () => {
    mockAttendances = [
      {
        id: 'att-1', sessionId: 'session-1', userId: 'user-001',
        scanInTime: new Date(), isLate: true, lateMinutes: 10,
      } as Attendance,
    ]
    renderComponent()
    expect(screen.getByText(/Terlambat 10 menit/)).toBeInTheDocument()
  })

  it('shows empty state when no attendance history', () => {
    renderComponent()
    expect(screen.getByText('Belum ada riwayat presensi')).toBeInTheDocument()
  })

  it('calls logout and navigates to login on logout click', () => {
    renderComponent()
    const logoutButton = document.querySelector('.lucide-log-out')
    expect(logoutButton).toBeInTheDocument()
    if (logoutButton?.parentElement) {
      logoutButton.parentElement.click()
      expect(mockLogout).toHaveBeenCalled()
    }
  })
})
