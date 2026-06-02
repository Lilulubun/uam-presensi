import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { Session, Attendance } from '../../../types'

let mockSessions: Session[] = []
let mockAttendances: Attendance[] = []
let mockTpas: import('../../../types').TPA[] = []
const mockLogout = vi.fn()
const mockNavigate = vi.fn()

vi.mock('../../../store/authStore', () => ({
  useAuthStore: (selector?: any) => {
    const state = {
      user: { id: 'user-admin', name: 'Rahma Dewi', email: 'pengurus@uii.ac.id', role: 'pengurus' as const },
      isAuthenticated: true,
      logout: mockLogout,
    }
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

vi.mock('../../../store/tpaStore', () => ({
  useTPAStore: (selector?: any) => {
    const state = { tpas: mockTpas }
    return selector ? selector(state) : state
  },
}))

vi.mock('../../../app/hooks/useRealtimeSessions', () => ({
  useRealtimeSessions: () => {},
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

import DashboardPengurus from '../DashboardPengurus'

function renderComponent() {
  return render(
    <MemoryRouter>
      <DashboardPengurus />
    </MemoryRouter>
  )
}

describe('DashboardPengurus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSessions = []
    mockAttendances = []
    mockTpas = [
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
    ]
  })

  it('renders the header with monitoring title', () => {
    renderComponent()
    expect(screen.getByText('UAM Monitoring')).toBeInTheDocument()
  })

  it('shows greeting with admin user name', () => {
    renderComponent()
    expect(screen.getByText(/Halo, Rahma Dewi/)).toBeInTheDocument()
  })

  it('shows summary stats cards', () => {
    renderComponent()
    expect(screen.getByText('Sesi Aktif')).toBeInTheDocument()
    expect(screen.getByText('Hadir Hari Ini')).toBeInTheDocument()
    expect(screen.getAllByText('Terlambat').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Total Bulan Ini')).toBeInTheDocument()
  })

  it('shows TPA grid section with location count', () => {
    renderComponent()
    expect(screen.getByText(/11 Lokasi/)).toBeInTheDocument()
  })

  it('shows TPA names in the grid', () => {
    renderComponent()
    expect(screen.getByText('TPA Al-Fath')).toBeInTheDocument()
    expect(screen.getByText('TPA Adz-Dzikro')).toBeInTheDocument()
  })

  it('shows "Laporan" button that navigates to laporan page', () => {
    renderComponent()
    const laporanBtns = screen.getAllByText('Laporan')
    expect(laporanBtns.length).toBeGreaterThanOrEqual(1)
    laporanBtns[0].click()
    expect(mockNavigate).toHaveBeenCalledWith('/pengurus/laporan')
  })

  it('shows "Setup QR" button that navigates to pengaturan page', () => {
    renderComponent()
    const setupBtns = screen.getAllByText('Setup QR')
    expect(setupBtns.length).toBeGreaterThanOrEqual(1)
    setupBtns[0].click()
    expect(mockNavigate).toHaveBeenCalledWith('/pengurus/pengaturan')
  })

  it('shows teacher stats table with "Rekap Pengajar" heading', () => {
    renderComponent()
    expect(screen.getByText('Rekap Pengajar')).toBeInTheDocument()
  })

  it('shows teacher stats table with correct columns', () => {
    renderComponent()
    expect(screen.getByText('Pengajar')).toBeInTheDocument()
    expect(screen.getByText('Total')).toBeInTheDocument()
    expect(screen.getByText('Tepat Waktu')).toBeInTheDocument()
    expect(screen.getByText('Kepatuhan')).toBeInTheDocument()
  })

  it('shows "Belum ada data presensi" when no attendance data', () => {
    renderComponent()
    // Dashboard now derives teacher rows from attendance records (not MOCK_USERS),
    // so empty attendances = empty teacher table = empty state visible.
    expect(screen.getByText('Belum ada data presensi')).toBeInTheDocument()
  })

  it('shows TPA click navigates to TPA detail page', () => {
    renderComponent()
    const tpaButton = screen.getByText('TPA Al-Fath').closest('button')
    expect(tpaButton).toBeInTheDocument()
    tpaButton!.click()
    expect(mockNavigate).toHaveBeenCalledWith('/pengurus/tpa/tpa-001')
  })

  it('shows active session badge for TPA with active session', () => {
    const now = new Date()
    mockSessions = [
      {
        id: 'session-1', tpaId: 'tpa-001',
        dateOpened: now, firstTeacherId: 'user-001',
        isActive: true,
      } as Session,
    ]
    renderComponent()
    const badge = screen.getByText('Aktif')
    expect(badge).toBeInTheDocument()
  })

  it('shows "Tutup" for TPA without active session', () => {
    renderComponent()
    const badges = screen.getAllByText('Tutup')
    expect(badges.length).toBeGreaterThan(0)
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

  it('shows summary stat values when no sessions active', () => {
    renderComponent()
    const zeroValues = screen.getAllByText('0')
    expect(zeroValues.length).toBeGreaterThanOrEqual(4)
  })

  it('shows correct session count in summary when sessions are active', () => {
    const now = new Date()
    mockSessions = [
      {
        id: 'session-1', tpaId: 'tpa-001',
        dateOpened: now, firstTeacherId: 'user-001',
        isActive: true,
      } as Session,
      {
        id: 'session-2', tpaId: 'tpa-002',
        dateOpened: now, firstTeacherId: 'user-002',
        isActive: true,
      } as Session,
    ]
    renderComponent()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('shows teacher names in rekap table', () => {
    mockAttendances = [
      {
        id: 'att-1', sessionId: 'session-1', userId: 'user-001',
        scanInTime: new Date(), isLate: false, lateMinutes: 0,
      } as Attendance,
    ]
    mockSessions = [
      { id: 'session-1', tpaId: 'tpa-001', isActive: false, dateOpened: new Date(), firstTeacherId: 'user-001' } as Session,
    ]
    renderComponent()
    // Dashboard derives teacher names from attendance userId until a useUsers() hook is wired (Phase 3.5)
    expect(screen.getByText('user-001')).toBeInTheDocument();
  })

  it('shows 100% compliance for teacher with perfect attendance', () => {
    mockAttendances = [
      {
        id: 'att-1', sessionId: 'session-1', userId: 'user-001',
        scanInTime: new Date(), isLate: false, lateMinutes: 0,
      } as Attendance,
      {
        id: 'att-2', sessionId: 'session-2', userId: 'user-001',
        scanInTime: new Date(Date.now() - 86400000), isLate: false, lateMinutes: 0,
      } as Attendance,
    ]
    mockSessions = [
      { id: 'session-1', tpaId: 'tpa-001', isActive: false, dateOpened: new Date(), firstTeacherId: 'user-001' } as Session,
      { id: 'session-2', tpaId: 'tpa-001', isActive: false, dateOpened: new Date(Date.now() - 86400000), firstTeacherId: 'user-001' } as Session,
    ]
    renderComponent()
    expect(screen.getByText('100%')).toBeInTheDocument()
  })

  it('shows 50% compliance for teacher with mixed attendance', () => {
    mockAttendances = [
      {
        id: 'att-1', sessionId: 'session-1', userId: 'user-001',
        scanInTime: new Date(), isLate: false, lateMinutes: 0,
      } as Attendance,
      {
        id: 'att-2', sessionId: 'session-2', userId: 'user-001',
        scanInTime: new Date(Date.now() - 86400000), isLate: true, lateMinutes: 5,
      } as Attendance,
    ]
    mockSessions = [
      { id: 'session-1', tpaId: 'tpa-001', isActive: false, dateOpened: new Date(), firstTeacherId: 'user-001' } as Session,
      { id: 'session-2', tpaId: 'tpa-001', isActive: false, dateOpened: new Date(Date.now() - 86400000), firstTeacherId: 'user-001' } as Session,
    ]
    renderComponent()
    expect(screen.getByText('50%')).toBeInTheDocument()
  })
})
