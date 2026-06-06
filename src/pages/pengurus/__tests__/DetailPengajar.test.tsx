import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { Session, Attendance } from '../../../types'

let mockSessions: Session[] = []
let mockAttendances: Attendance[] = []
const mockNavigate = vi.fn()
const mockIzinMonthlyReport: any[] = []
const mockFetchMonthlyReport = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('../../../store/sessionStore', () => ({
  useSessionStore: (selector?: any) => {
    const state = { sessions: mockSessions }
    return selector ? selector(state) : state
  },
}))

let lastAttendancesRef: Attendance[] | null = null
let lastSelectorResult: Attendance[] = []

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

const mockUsers: any[] = [
  { id: 'user-001', name: 'Budi Santoso', email: 'budi@uii.ac.id', role: 'pengajar', nim: '21511001' },
  { id: 'user-002', name: 'Siti Rahayu', email: 'siti@uii.ac.id', role: 'pengajar', nim: '21511002' },
]

vi.mock('../../../store/userStore', () => ({
  useUsersStore: (selector?: any) => {
    const state = { users: mockUsers, userTPAs: [], loading: false }
    return selector ? selector(state) : state
  },
  getUserById: (id: string) => mockUsers.find((u) => u.id === id) ?? null,
}))

vi.mock('../../../store/izinStore', () => ({
  useIzinStore: (selector?: any) => {
    const state = {
      myIzins: [],
      pendingIzins: [],
      monthlyReport: mockIzinMonthlyReport,
      loading: false,
      submitIzin: vi.fn(),
      approveIzin: vi.fn(),
      rejectIzin: vi.fn(),
      fetchMyIzins: vi.fn(),
      fetchPendingIzins: vi.fn(),
      fetchMonthlyReport: mockFetchMonthlyReport,
    }
    return selector ? selector(state) : state
  },
}))

import DetailPengajar from '../DetailPengajar'

function renderWithRoute(userId: string = 'user-001') {
  return render(
    <MemoryRouter initialEntries={[`/pengurus/pengajar/${userId}`]}>
      <Routes>
        <Route path="/pengurus/pengajar/:userId" element={<DetailPengajar />} />
      </Routes>
    </MemoryRouter>
  )
}

const closedSession: Session = {
  id: 'session-1',
  tpaId: 'tpa-001',
  firstTeacherId: 'user-001',
  dateOpened: new Date('2026-06-02T10:00:00Z'),
  dateClosed: new Date('2026-06-02T12:00:00Z'),
  isActive: false,
}

describe('DetailPengajar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSessions = []
    mockAttendances = []
    lastAttendancesRef = null
    lastSelectorResult = []
  })

  it('shows pengajar not found for invalid ID', () => {
    renderWithRoute('invalid-id')
    expect(screen.getByText('Pengajar tidak ditemukan')).toBeInTheDocument()
  })

  it('shows teacher name and email in header', () => {
    renderWithRoute()
    expect(screen.getByText('Budi Santoso')).toBeInTheDocument()
    expect(screen.getByText(/budi@uii.ac.id/)).toBeInTheDocument()
  })

  it('shows NIM when available', () => {
    renderWithRoute()
    expect(screen.getByText(/21511001/)).toBeInTheDocument()
  })

  it('shows empty state when no attendances', () => {
    renderWithRoute()
    expect(screen.getByText('Belum ada riwayat presensi')).toBeInTheDocument()
  })

  it('shows summary cards with counts', () => {
    mockSessions = [closedSession]
    mockAttendances = [
      { id: 'att-1', sessionId: 'session-1', userId: 'user-001', scanInTime: new Date(), scanOutTime: new Date(), isLate: false, lateMinutes: 0 } as Attendance,
      { id: 'att-2', sessionId: 'session-1', userId: 'user-001', scanInTime: new Date(), isLate: true, lateMinutes: 10 } as Attendance,
    ]
    renderWithRoute()
    expect(screen.getByText('Total')).toBeInTheDocument()
    expect(screen.getByText('Tepat')).toBeInTheDocument()
    expect(screen.getByText('Telat')).toBeInTheDocument()
    expect(screen.getByText('Awal')).toBeInTheDocument()
  })

  it('shows attendance entries grouped by session', () => {
    mockSessions = [closedSession]
    mockAttendances = [
      { id: 'att-1', sessionId: 'session-1', userId: 'user-001', scanInTime: new Date('2026-06-02T10:00:00Z'), scanOutTime: new Date('2026-06-02T11:00:00Z'), isLate: false, lateMinutes: 0 } as Attendance,
    ]
    renderWithRoute()
    expect(screen.getByText('02/06/2026')).toBeInTheDocument()
  })

  it('shows late badge for late attendances', () => {
    mockSessions = [closedSession]
    mockAttendances = [
      { id: 'att-1', sessionId: 'session-1', userId: 'user-001', scanInTime: new Date('2026-06-02T10:00:00Z'), isLate: true, lateMinutes: 15 } as Attendance,
    ]
    renderWithRoute()
    expect(screen.getByText('+15m')).toBeInTheDocument()
  })

  it('does not mark first teacher as early exit', () => {
    mockSessions = [closedSession]
    mockAttendances = [
      { id: 'att-1', sessionId: 'session-1', userId: 'user-001', scanInTime: new Date('2026-06-02T10:00:00Z'), scanOutTime: undefined, isLate: false, lateMinutes: 0 } as Attendance,
    ]
    renderWithRoute('user-001')
    expect(screen.queryByText('Pulang awal')).not.toBeInTheDocument()
  })

  it('marks non-first teacher as early exit when no scanOut and session closed', () => {
    mockSessions = [closedSession]
    mockAttendances = [
      { id: 'att-1', sessionId: 'session-1', userId: 'user-002', scanInTime: new Date('2026-06-02T10:00:00Z'), scanOutTime: undefined, isLate: false, lateMinutes: 0 } as Attendance,
    ]
    renderWithRoute('user-002')
    expect(screen.getByText('Pulang awal')).toBeInTheDocument()
  })
})
