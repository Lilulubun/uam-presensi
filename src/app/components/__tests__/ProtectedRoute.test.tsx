import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const mockNavigate = vi.fn()
let mockAuth: any = { isAuthenticated: false, user: null }

vi.mock('../../../store/authStore', () => ({
  useAuthStore: (selector?: any) => {
    const state = mockAuth
    return selector ? selector(state) : state
  },
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

import ProtectedRoute from '../ProtectedRoute'

function renderWithRouter(children: React.ReactNode) {
  return render(
    <MemoryRouter>
      <ProtectedRoute allowedRoles={['pengajar']}>{children}</ProtectedRoute>
    </MemoryRouter>
  )
}

describe('ProtectedRoute', () => {
  it('redirects to login when not authenticated', () => {
    mockAuth = { isAuthenticated: false, user: null }
    renderWithRouter(<p>rahasia</p>)
    expect(screen.queryByText('rahasia')).not.toBeInTheDocument()
  })

  it('renders children when authenticated with correct role', () => {
    mockAuth = { isAuthenticated: true, user: { id: 'u1', role: 'pengajar' as const } }
    renderWithRouter(<p>rahasia</p>)
    expect(screen.getByText('rahasia')).toBeInTheDocument()
  })

  it('redirects to pengajar dashboard when user is pengajar but allowedRoles excludes it', () => {
    mockAuth = { isAuthenticated: true, user: { id: 'u1', role: 'pengajar' as const } }
    render(
      <MemoryRouter>
        <ProtectedRoute allowedRoles={['pengurus']}><p>rahasia</p></ProtectedRoute>
      </MemoryRouter>
    )
    expect(screen.queryByText('rahasia')).not.toBeInTheDocument()
  })

  it('redirects to pengurus dashboard when user is pengurus but allowedRoles excludes it', () => {
    mockAuth = { isAuthenticated: true, user: { id: 'u1', role: 'pengurus' as const } }
    render(
      <MemoryRouter>
        <ProtectedRoute allowedRoles={['pengajar']}><p>rahasia</p></ProtectedRoute>
      </MemoryRouter>
    )
    expect(screen.queryByText('rahasia')).not.toBeInTheDocument()
  })
})
