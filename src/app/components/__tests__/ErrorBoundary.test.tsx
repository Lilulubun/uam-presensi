import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

let ErrorBoundary: any
let Bomb: any

describe('ErrorBoundary', () => {
  beforeEach(async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    ErrorBoundary = (await import('../ErrorBoundary')).default
    Bomb = () => { throw new Error('💥') }
  })

  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <p>selamat datang</p>
      </ErrorBoundary>
    )
    expect(screen.getByText('selamat datang')).toBeInTheDocument()
  })

  it('renders fallback when child throws', () => {
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>
    )
    expect(screen.getByText('Terjadi Kesalahan')).toBeInTheDocument()
  })

  it('renders custom fallback when provided', () => {
    render(
      <ErrorBoundary fallback={<p>custom error</p>}>
        <Bomb />
      </ErrorBoundary>
    )
    expect(screen.getByText('custom error')).toBeInTheDocument()
  })

  it('renders retry button that resets error state', async () => {
    let shouldThrow = true
    function ConditionalBomb() {
      if (shouldThrow) throw new Error('💥')
      return <p>pulih</p>
    }
    render(
      <ErrorBoundary>
        <ConditionalBomb />
      </ErrorBoundary>
    )
    expect(screen.getByText('Terjadi Kesalahan')).toBeInTheDocument()
    shouldThrow = false
    screen.getByText('Coba Lagi').click()
    expect(await screen.findByText('pulih')).toBeInTheDocument()
  })
})
