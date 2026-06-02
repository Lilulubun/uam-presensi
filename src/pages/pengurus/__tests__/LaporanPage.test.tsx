import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { Session, Attendance } from '../../../types'

let mockSessions: Session[] = []
let mockAttendances: Attendance[] = []
const mockNavigate = vi.fn()

vi.mock('../../../store/authStore', () => ({
  useAuthStore: (selector?: any) => {
    const state = { user: { id: 'user-admin', name: 'Rahma Dewi', email: 'pengurus@uii.ac.id', role: 'pengurus' as const } }
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
    const state = { attendances: mockAttendances }
    return selector ? selector(state) : state
  },
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

import LaporanPage from '../LaporanPage'

function renderComponent() {
  return render(
    <MemoryRouter>
      <LaporanPage />
    </MemoryRouter>
  )
}

describe('LaporanPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSessions = []
    mockAttendances = []
  })

  it('renders header with "Laporan Kehadiran"', () => {
    renderComponent()
    expect(screen.getByText('Laporan Kehadiran')).toBeInTheDocument()
  })

  it('shows filter section', () => {
    renderComponent()
    expect(screen.getByText('Filter')).toBeInTheDocument()
  })

  it('shows date filter inputs', () => {
    renderComponent()
    const dariLabel = screen.getByText('Dari')
    expect(dariLabel).toBeInTheDocument()
    const sampaiLabel = screen.getByText('Sampai')
    expect(sampaiLabel).toBeInTheDocument()
  })

  it('shows TPA filter dropdown with "Semua TPA" option', () => {
    renderComponent()
    expect(screen.getByText('Semua TPA')).toBeInTheDocument()
  })

  it('shows Pengajar filter dropdown with "Semua Pengajar" option', () => {
    renderComponent()
    expect(screen.getByText('Semua Pengajar')).toBeInTheDocument()
  })

  it('shows export buttons', () => {
    renderComponent()
    expect(screen.getByText('CSV')).toBeInTheDocument()
    expect(screen.getByText('Excel')).toBeInTheDocument()
    expect(screen.getByText('JSON')).toBeInTheDocument()
  })

  it('shows empty state when no data', () => {
    renderComponent()
    expect(screen.getByText('Tidak ada data untuk filter yang dipilih')).toBeInTheDocument()
  })

  it('shows record count when data is present', () => {
    const scanDate = new Date('2026-06-01T10:00:00+07:00');
    mockAttendances = [
      {
        id: 'att-1', sessionId: 'session-1', userId: 'user-001',
        scanInTime: scanDate, scanOutTime: scanDate,
        isLate: false, lateMinutes: 0,
      } as Attendance,
    ]
    mockSessions = [
      { id: 'session-1', tpaId: 'tpa-001', isActive: false, dateOpened: scanDate, firstTeacherId: 'user-001' } as Session,
    ]
    renderComponent()
    const recordText = screen.getAllByText(/record/)
    expect(recordText.length).toBeGreaterThan(0)
    expect(screen.getByText('01/06/2026')).toBeInTheDocument()
    expect(screen.getByText('Tepat Waktu')).toBeInTheDocument()
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

  it('shows late count when there are late records', () => {
    const scanDate = new Date('2026-06-01T10:00:00+07:00');
    mockAttendances = [
      {
        id: 'att-1', sessionId: 'session-1', userId: 'user-001',
        scanInTime: scanDate, scanOutTime: scanDate,
        isLate: true, lateMinutes: 10,
      } as Attendance,
    ]
    mockSessions = [
      { id: 'session-1', tpaId: 'tpa-001', isActive: false, dateOpened: scanDate, firstTeacherId: 'user-001' } as Session,
    ]
    renderComponent()
    expect(screen.getByText(/1 terlambat/)).toBeInTheDocument()
  })

  it('shows record for today date range', () => {
    const today = new Date()
    mockAttendances = [
      {
        id: 'att-1', sessionId: 'session-1', userId: 'user-001',
        scanInTime: today, scanOutTime: today,
        isLate: false, lateMinutes: 0,
      } as Attendance,
    ]
    mockSessions = [
      { id: 'session-1', tpaId: 'tpa-001', isActive: false, dateOpened: today, firstTeacherId: 'user-001' } as Session,
    ]
    renderComponent()
    expect(screen.getByText(/record/)).toBeInTheDocument()
  })

  it('shows multiple records in table', () => {
    mockAttendances = [
      {
        id: 'att-1', sessionId: 'session-1', userId: 'user-001',
        scanInTime: new Date('2026-06-01T08:00:00+07:00'), scanOutTime: new Date('2026-06-01T08:00:00+07:00'),
        isLate: false, lateMinutes: 0,
      } as Attendance,
      {
        id: 'att-2', sessionId: 'session-2', userId: 'user-002',
        scanInTime: new Date('2026-06-02T08:00:00+07:00'), scanOutTime: new Date('2026-06-02T08:00:00+07:00'),
        isLate: true, lateMinutes: 5,
      } as Attendance,
    ]
    mockSessions = [
      { id: 'session-1', tpaId: 'tpa-001', isActive: false, dateOpened: new Date('2026-06-01T08:00:00+07:00'), firstTeacherId: 'user-001' } as Session,
      { id: 'session-2', tpaId: 'tpa-002', isActive: false, dateOpened: new Date('2026-06-02T08:00:00+07:00'), firstTeacherId: 'user-002' } as Session,
    ]
    renderComponent()
    expect(screen.getByText('01/06/2026')).toBeInTheDocument()
    expect(screen.getByText('02/06/2026')).toBeInTheDocument()
  })
})
