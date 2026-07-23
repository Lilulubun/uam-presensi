"use client"

import { useEffect, useState, useCallback, type ReactNode } from 'react'
import { X } from 'lucide-react'

interface SheetProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  side?: 'left' | 'right'
}

export default function Sheet({ open, onClose, children, side = 'right' }: SheetProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (open) {
      // Slight delay to trigger enter animation
      requestAnimationFrame(() => setVisible(true))
    } else {
      setVisible(false)
    }
  }, [open])

  const handleBackdrop = useCallback(() => onClose(), [onClose])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open && !visible) return null

  const slideIn =
    side === 'right'
      ? 'translate-x-full data-[open]:translate-x-0'
      : '-translate-x-full data-[open]:translate-x-0'

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-[#1A1A18]/20 backdrop-blur-sm transition-opacity duration-200 ${
          visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={handleBackdrop}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        data-open={visible ? 'true' : undefined}
        className={`fixed top-0 ${side === 'right' ? 'right-0' : 'left-0'} h-full w-[280px] bg-white shadow-2xl transform transition-transform duration-250 ease-out ${slideIn}`}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[#F7F7F5] flex items-center justify-center text-[#7A7A75] hover:text-[#1A1A18] active:scale-[0.97] transition-transform duration-100 ease-out"
          aria-label="Tutup menu"
        >
          <X className="w-4 h-4" strokeWidth={1.5} />
        </button>

        <div className="h-full overflow-y-auto pt-16 pb-8 px-5">
          {children}
        </div>
      </div>
    </div>
  )
}
