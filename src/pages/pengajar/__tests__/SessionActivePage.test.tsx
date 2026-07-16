import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { Session, Attendance } from '../../../types'

let mockSession: Session | null = null
let mockAttendances: Attendance[] = []
const mockCloseSession = vi.fn()
const mockNavigate = vi.fn()
const mockFetchPengajarByTPA = vi.fn()

// Module-level variables for test-specific data injection
let mockPengajarByTPA: Record<string, any[]> = {}
let mockExpectedUserIds: string[] = []

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate, useParams: () => ({ sessionId: 'session-1' }) }
})

vi.mock('../../../app/hooks/useRealtimeSessions', () => ({
  useRealtimeSessions: () => { },
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
      users: [
        { id: 'user-001', name: 'Budi Santoso', email: 'budi@uii.ac.id', role: 'pengajar' as const },
        { id: 'user-002', name: 'Ani Rahmawati', email: 'ani@uii.ac.id', role: 'pengajar' as const },
        { id: 'user-003', name: 'Citra Dewi', email: 'citra@uii.ac.id', role: 'pengajar' as const },
        { id: 'user-004', name: 'Dodi Prasetyo', email: 'dodi@uii.ac.id', role: 'pengajar' as const },
      ],
      loading: false,
      pengajarByTPA: mockPengajarByTPA,
      fetchPengajarByTPA: mockFetchPengajarByTPA,
    }
    return selector ? selector(state) : state
  },
}))

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'session_expected_teachers') {
        return {
          select: () => ({
            eq: () => ({
              then: (resolve: any) => resolve({
                data: mockExpectedUserIds.map(id => ({ user_id: id })),
                error: null,
              }),
            }),
          }),
        }
      }
      return { select: vi.fn() }
    },
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

// Helper: build an Attendance object for test scenarios
function makeAttendance(id: string, userId: string, scanIn: boolean, scanOut = false): Attendance {
  return {
    id,
    sessionId: 'session-1',
    userId,
    scanInTime: scanIn ? new Date('2026-01-01T08:00:00Z') : undefined,
    scanOutTime: scanOut ? new Date('2026-01-01T09:00:00Z') : undefined,
    isLate: false,
  } as Attendance
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
    mockPengajarByTPA = {}
    mockExpectedUserIds = []
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

describe('SessionActivePage - Expected-based Absent Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Session is CLOSED (inactive) — absent logic only applies after session closed
    mockSession = {
      id: 'session-1',
      tpaId: 'tpa-001',
      firstTeacherId: 'user-001',
      dateOpened: new Date(),
      isActive: false,
    } as Session
    // Default: 3 TPA teachers, expected = [001, 003], attendance = [001]
    mockPengajarByTPA = {
      'tpa-001': [
        { id: 'user-001', name: 'Budi Santoso', email: 'budi@uii.ac.id', role: 'pengajar' },
        { id: 'user-002', name: 'Ani Rahmawati', email: 'ani@uii.ac.id', role: 'pengajar' },
        { id: 'user-003', name: 'Citra Dewi', email: 'citra@uii.ac.id', role: 'pengajar' },
      ],
    }
    mockExpectedUserIds = ['user-001', 'user-003'] // Budi and Citra expected
    mockAttendances = [
      makeAttendance('att-1', 'user-001', true, true), // Budi scanned in & out
    ]
  })

  it('shows only expected-but-not-scanned teachers as "Tidak Hadir" after session closed', async () => {
    renderComponent()

    // Wait for the useEffect to fetch expected teachers
    await vi.waitFor(() => {
      // Citra (user-003) is expected but didn't scan → should be "Tidak Hadir"
      expect(screen.getByText('Citra Dewi')).toBeInTheDocument()
    })

    // Verifikasi: Ani (user-002) is in TPA but NOT expected → should NOT be absent
    expect(screen.queryByText('Ani Rahmawati')).not.toBeInTheDocument()

    // Verify the "Tidak Hadir" section exists
    expect(screen.getByText(/Tidak Hadir/)).toBeInTheDocument()
  })

  it('does not show non-expected TPA pengajar as "Tidak Hadir"', async () => {
    // Same setup as above: Ani is in TPA but not expected
    renderComponent()

    await vi.waitFor(() => {
      // Citra appears as absent (expected + not scanned)
      expect(screen.getByText('Citra Dewi')).toBeInTheDocument()
    })

    // Ani is pengajar TPA but not expected → must NOT appear
    screen.getByText(/Tidak Hadir/).closest('div')
    expect(screen.queryByText('Ani Rahmawati')).not.toBeInTheDocument()
  })

  it('shows non-expected attendees in "Tidak Dijadwalkan" expandable section', async () => {
    // Setup: Dodi (user-004) is NOT in TPA, NOT expected, but scanned in
    // He should appear in the "Tidak Dijadwalkan" section
    mockAttendances = [
      makeAttendance('att-1', 'user-001', true, true), // Budi
      makeAttendance('att-2', 'user-004', true, false), // Dodi — non-TPA, non-expected
    ]

    renderComponent()

    await vi.waitFor(() => {
      // The "Tidak Dijadwalkan" section should appear
      expect(screen.getByText(/Tidak Dijadwalkan/)).toBeInTheDocument()
    })

    // Dodi should be in that section
    const dodiElements = screen.getAllByText('Dodi Prasetyo');
    expect(dodiElements.length).toBeGreaterThanOrEqual(1);
    // Dodi should have "Non-Jadwal" label
    expect(screen.getByText('Non-Jadwal')).toBeInTheDocument();
  })

  it('includes non-expected attendees in "Hadir" list', async () => {
    // Dodi scans in even though he's not in TPA / not expected
    // He should still appear in the "Daftar Kehadiran" (Hadir) list
    mockAttendances = [
      makeAttendance('att-1', 'user-001', true, true),
      makeAttendance('att-2', 'user-004', true, false),
    ]

    renderComponent()

    await vi.waitFor(() => {
      // Dodi appears in the attendee list (and also in Tidak Dijadwalkan)
      const dodiElements = screen.getAllByText('Dodi Prasetyo');
      expect(dodiElements.length).toBe(2); // in both Hadir and Tidak Dijadwalkan
    })

    // Verify "Daftar Kehadiran" heading exists
    expect(screen.getByText('Daftar Kehadiran')).toBeInTheDocument()
  })

  it('does not show "Tidak Dijadwalkan" section when all attendees are expected', async () => {
    // Both attendees are expected → no non-expected section
    mockAttendances = [
      makeAttendance('att-1', 'user-001', true, true),
      makeAttendance('att-2', 'user-003', true, false),
    ]

    renderComponent()

    await vi.waitFor(() => {
      // Citra appears in attendee list (she scanned in)
      expect(screen.getByText('Citra Dewi')).toBeInTheDocument()
    })

    // No "Tidak Dijadwalkan" section should appear
    expect(screen.queryByText(/Tidak Dijadwalkan/)).not.toBeInTheDocument()
  })

  it('does not show "Tidak Hadir" section when all expected teachers scanned in', async () => {
    // All 3 TPA teachers are expected, all scanned in → no absent
    mockPengajarByTPA['tpa-001'] = [
      { id: 'user-001', name: 'Budi Santoso', email: 'budi@uii.ac.id', role: 'pengajar' },
      { id: 'user-002', name: 'Ani Rahmawati', email: 'ani@uii.ac.id', role: 'pengajar' },
    ]
    mockExpectedUserIds = ['user-001', 'user-002']
    mockAttendances = [
      makeAttendance('att-1', 'user-001', true, true),
      makeAttendance('att-2', 'user-002', true, true),
    ]

    renderComponent()

    await vi.waitFor(() => {
      expect(screen.getByText('Ani Rahmawati')).toBeInTheDocument()
    })

    // No "Tidak Hadir" section — all expected scanned in
    expect(screen.queryByText(/Tidak Hadir/)).not.toBeInTheDocument()
  })

  it('does not show absent section while session is still active', () => {
    // When session is ACTIVE, absent section should NOT appear
    // even if we have TPA users and expected teachers fetched
    mockSession = { ...mockSession!, isActive: true }
    mockPengajarByTPA['tpa-001'] = [
      { id: 'user-001', name: 'Budi Santoso', email: 'budi@uii.ac.id', role: 'pengajar' },
      { id: 'user-002', name: 'Ani Rahmawati', email: 'ani@uii.ac.id', role: 'pengajar' },
      { id: 'user-003', name: 'Citra Dewi', email: 'citra@uii.ac.id', role: 'pengajar' },
    ]
    mockExpectedUserIds = ['user-001', 'user-003']
    mockAttendances = [
      makeAttendance('att-1', 'user-001', true, false),
    ]

    renderComponent()

    // No "Tidak Hadir" during active session
    expect(screen.queryByText(/Tidak Hadir/)).not.toBeInTheDocument()
    // No "Tidak Dijadwalkan" during active session
    expect(screen.queryByText(/Tidak Dijadwalkan/)).not.toBeInTheDocument()
  })

  it('shows correct count of absent teachers in header', async () => {
    // user-003 (Citra) is expected but didn't scan → 1 absent
    // user-002 (Ani) is TPA but not expected → NOT counted as absent
    renderComponent()

    await vi.waitFor(() => {
      // The absent section header should show "(1)"
      const absentHeader = screen.getByText(/Tidak Hadir \(1\)/)
      expect(absentHeader).toBeInTheDocument()
    })

    // Ani should not appear at all (not expected, not attending)
    expect(screen.queryByText('Ani Rahmawati')).not.toBeInTheDocument()
  })

  it('counts multiple absent teachers correctly', async () => {
    // Both Citra and Ani are expected, neither scanned → 2 absent
    mockExpectedUserIds = ['user-002', 'user-003']
    mockAttendances = [
      makeAttendance('att-1', 'user-001', true, false),
    ]

    renderComponent()

    await vi.waitFor(() => {
      expect(screen.getByText(/Tidak Hadir \(2\)/)).toBeInTheDocument()
    })
  })
})
