import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { Session, Attendance } from '../../../types'

// Shared mutable state
let mockAttendances: Attendance[] = []
let mockSessions: Session[] = []
const mockNavigate = vi.fn()

// Cache for stabilizing selector results and preventing infinite re-renders
let lastAttendancesRef: Attendance[] | null = null
let lastSelectorResult: Attendance[] = []

vi.mock('../../../store/authStore', () => ({
  useAuthStore: (selector?: any) => {
    const state = { user: { id: 'user-001', name: 'Budi Santoso', email: 'budi@uii.ac.id', role: 'pengajar' as const } }
    return selector ? selector(state) : state
  },
}))

vi.mock('../../../store/sessionStore', () => ({
  useSessionStore: (selector?: any) => {
    const state = { sessions: mockSessions }
    return selector ? selector(state) : state
  },
}))

vi.mock('../../../store/attendanceStore', () => ({
  useAttendanceStore: (selector?: any) => {
    if (selector) {
      const state = { attendances: mockAttendances }
      if (mockAttendances !== lastAttendancesRef) {
        lastSelectorResult = selector(state)
        lastAttendancesRef = mockAttendances
      }
      return lastSelectorResult
    }
    return { attendances: mockAttendances }
  },
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

import RiwayatPage from '../RiwayatPage'

function renderComponent() {
  return render(
    <MemoryRouter>
      <RiwayatPage />
    </MemoryRouter>
  )
}

describe('RiwayatPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAttendances = []
    mockSessions = []
    lastAttendancesRef = null
    lastSelectorResult = []
  })

  it('shows "Belum ada riwayat presensi" when no records', () => {
    renderComponent()
    expect(screen.getByText('Belum ada riwayat presensi')).toBeInTheDocument()
  })

  it('shows summary cards with totals', () => {
    mockAttendances = [
      {
        id: 'att-1', sessionId: 'session-1', userId: 'user-001',
        scanInTime: new Date(), scanOutTime: new Date(),
        isLate: false, lateMinutes: 0,
      } as Attendance,
      {
        id: 'att-2', sessionId: 'session-2', userId: 'user-001',
        scanInTime: new Date(), scanOutTime: undefined,
        isLate: true, lateMinutes: 5,
      } as Attendance,
    ]
    mockSessions = [
      { id: 'session-1', tpaId: 'tpa-001', isActive: false, dateOpened: new Date(), firstTeacherId: 'user-001' } as Session,
      { id: 'session-2', tpaId: 'tpa-002', isActive: true, dateOpened: new Date(), firstTeacherId: 'user-002' } as Session,
    ]
    renderComponent()
    expect(screen.getByText('Total')).toBeInTheDocument()
    expect(screen.getByText('Tepat Waktu')).toBeInTheDocument()
    expect(screen.getByText('Terlambat')).toBeInTheDocument()
  })

  it('shows correct counts in summary', () => {
    mockAttendances = [
      {
        id: 'att-1', sessionId: 'session-1', userId: 'user-001',
        scanInTime: new Date(), scanOutTime: new Date(),
        isLate: false, lateMinutes: 0,
      } as Attendance,
      {
        id: 'att-2', sessionId: 'session-2', userId: 'user-001',
        scanInTime: new Date(), scanOutTime: undefined,
        isLate: true, lateMinutes: 5,
      } as Attendance,
    ]
    mockSessions = [
      { id: 'session-1', tpaId: 'tpa-001', isActive: false, dateOpened: new Date(), firstTeacherId: 'user-001' } as Session,
      { id: 'session-2', tpaId: 'tpa-002', isActive: true, dateOpened: new Date(), firstTeacherId: 'user-002' } as Session,
    ]
    renderComponent()
    expect(screen.getByText('2')).toBeInTheDocument() // Total
    const ones = screen.getAllByText('1')
    expect(ones).toHaveLength(2) // Tepat Waktu + Terlambat
  })

  it('shows back button that navigates to dashboard', () => {
    renderComponent()
    const backButton = document.querySelector('.lucide-arrow-left')
    expect(backButton).toBeInTheDocument()
    if (backButton?.parentElement) {
      backButton.parentElement.click()
      expect(mockNavigate).toHaveBeenCalledWith('/pengajar/dashboard')
    }
  })
})
