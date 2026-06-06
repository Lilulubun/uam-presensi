import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { Session, Attendance } from '../../../types'

let mockSessions: Session[] = []
let mockAttendances: Attendance[] = []
let mockUser: { id: string; name: string; email: string; role: 'pengurus' | 'pengajar' } = { id: 'user-admin', name: 'Rahma Dewi', email: 'pengurus@uii.ac.id', role: 'pengurus' }
const mockNavigate = vi.fn()
const mockForceCloseSession = vi.fn()
const mockUsers: any[] = [
  { id: 'user-001', name: 'Budi Santoso', email: 'budi@uii.ac.id', role: 'pengajar', nim: '21511001' },
  { id: 'user-002', name: 'Siti Rahayu', email: 'siti@uii.ac.id', role: 'pengajar', nim: '21511002' },
]

vi.mock('../../../store/authStore', () => ({
  useAuthStore: (selector?: any) => {
    const state = { user: mockUser }
    return selector ? selector(state) : state
  },
}))

vi.mock('../../../store/sessionStore', () => ({
  useSessionStore: (selector?: any) => {
    const state = { sessions: mockSessions, forceCloseSession: mockForceCloseSession }
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

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('../../../store/tpaStore', () => {
  const tpas = [
    { id: 'tpa-001', name: 'TPA Al-Fath', staticQRCode: 'TPA-001', location: { lat: 0, lng: 0, radius: 100 } },
    { id: 'tpa-002', name: 'TPA Adz-Dzikro', staticQRCode: 'TPA-002', location: { lat: 0, lng: 0, radius: 100 } },
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

vi.mock('../../../store/userStore', () => ({
  useUsersStore: (selector?: any) => {
    const state = { users: mockUsers, userTPAs: [], loading: false }
    return selector ? selector(state) : state
  },
}))

import TPADetailPage from '../TPADetailPage'

function renderWithRoute(tpaId: string = 'tpa-001') {
  return render(
    <MemoryRouter initialEntries={[`/pengurus/tpa/${tpaId}`]}>
      <Routes>
        <Route path="/pengurus/tpa/:tpaId" element={<TPADetailPage />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('TPADetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSessions = []
    mockAttendances = []
    mockUser = { id: 'user-admin', name: 'Rahma Dewi', email: 'pengurus@uii.ac.id', role: 'pengurus' as const }
    lastAttendancesRef = null
    lastSelectorResult = []
  })

  it('shows TPA not found for invalid ID', () => {
    renderWithRoute('invalid-id')
    expect(screen.getByText('TPA tidak ditemukan')).toBeInTheDocument()
  })

  it('shows TPA name in header', () => {
    renderWithRoute()
    expect(screen.getByText('TPA Al-Fath')).toBeInTheDocument()
  })

  it('shows QR code and radius info', () => {
    renderWithRoute()
    expect(screen.getByText(/Radius 100m/)).toBeInTheDocument()
  })

  it('shows "Belum ada sesi" when no sessions exist', () => {
    renderWithRoute()
    expect(screen.getByText('Belum ada sesi di TPA ini')).toBeInTheDocument()
  })

  it('shows session history when sessions exist', () => {
    mockSessions = [
      {
        id: 'session-1', tpaId: 'tpa-001',
        dateOpened: new Date(), firstTeacherId: 'user-001',
        isActive: false, dateClosed: new Date(),
      } as Session,
    ]
    renderWithRoute()
    expect(screen.getByText('Selesai')).toBeInTheDocument()
  })

  it('shows active badge for active session', () => {
    mockSessions = [
      {
        id: 'session-1', tpaId: 'tpa-001',
        dateOpened: new Date(), firstTeacherId: 'user-001',
        isActive: true,
      } as Session,
    ]
    renderWithRoute()
    const badges = screen.getAllByText('Aktif')
    expect(badges.length).toBeGreaterThan(0)
  })

  it('shows first teacher name in session info', () => {
    mockSessions = [
      {
        id: 'session-1', tpaId: 'tpa-001',
        dateOpened: new Date(), firstTeacherId: 'user-001',
        isActive: false, dateClosed: new Date(),
      } as Session,
    ]
    renderWithRoute()
    expect(screen.getByText(/Budi Santoso/)).toBeInTheDocument()
  })

  it('shows back button for invalid TPA that navigates to dashboard', () => {
    renderWithRoute('invalid-id')
    const backButton = screen.getByText('Kembali')
    expect(backButton).toBeInTheDocument()
    backButton.click()
    expect(mockNavigate).toHaveBeenCalledWith('/pengurus/dashboard')
  })

  describe('Admin force-close', () => {
    it('shows "Tutup Sesi (Admin)" button for pengurus when active session exists', () => {
      mockSessions = [
        {
          id: 'session-1', tpaId: 'tpa-001',
          dateOpened: new Date(), firstTeacherId: 'user-001',
          isActive: true,
        } as Session,
      ]
      renderWithRoute()
      expect(screen.getByRole('button', { name: /Tutup Sesi.*Admin/ })).toBeInTheDocument()
    })

    it('does not show admin close button for non-pengurus users', () => {
      mockUser = { ...mockUser, role: 'pengajar' }
      mockSessions = [
        {
          id: 'session-1', tpaId: 'tpa-001',
          dateOpened: new Date(), firstTeacherId: 'user-001',
          isActive: true,
        } as Session,
      ]
      renderWithRoute()
      expect(screen.queryByRole('button', { name: /Tutup Sesi.*Admin/ })).not.toBeInTheDocument()
    })

    it('opens confirmation dialog when admin close button is clicked', () => {
      mockSessions = [
        {
          id: 'session-1', tpaId: 'tpa-001',
          dateOpened: new Date(), firstTeacherId: 'user-001',
          isActive: true,
        } as Session,
      ]
      renderWithRoute()
      fireEvent.click(screen.getByRole('button', { name: /Tutup Sesi.*Admin/ }))
      expect(screen.getByText('Tutup sesi?')).toBeInTheDocument()
    })

    it('calls forceCloseSession when confirmed', () => {
      mockForceCloseSession.mockResolvedValue({ valid: true, message: 'Sesi berhasil ditutup' })
      mockSessions = [
        {
          id: 'session-1', tpaId: 'tpa-001',
          dateOpened: new Date(), firstTeacherId: 'user-001',
          isActive: true,
        } as Session,
      ]
      renderWithRoute()
      fireEvent.click(screen.getByRole('button', { name: /Tutup Sesi.*Admin/ }))
      const confirmButton = screen.getByRole('button', { name: /^Tutup Sesi$/ })
      fireEvent.click(confirmButton)
      expect(mockForceCloseSession).toHaveBeenCalledWith('session-1')
    })

    it('does not show admin close button when no active session', () => {
      renderWithRoute()
      expect(screen.queryByRole('button', { name: /Tutup Sesi.*Admin/ })).not.toBeInTheDocument()
    })
  })
})
