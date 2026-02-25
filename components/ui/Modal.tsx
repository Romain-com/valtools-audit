'use client'
// Modale bloquante avec overlay — fermeture par bouton ou Échap
import { useEffect } from 'react'

interface ModalProps {
  open: boolean
  onClose?: () => void
  title: string
  children: React.ReactNode
  // Si true, pas de fermeture par clic extérieur ni Échap (validation obligatoire)
  blocking?: boolean
}

export default function Modal({ open, onClose, title, children, blocking = false }: ModalProps) {
  // Fermeture par Échap
  useEffect(() => {
    if (!open || blocking) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, blocking, onClose])

  // Blocage scroll body
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-brand-navy/60 backdrop-blur-sm animate-fade-in"
        onClick={blocking ? undefined : onClose}
      />

      {/* Panel */}
      <div className="relative bg-white rounded-xl shadow-lg w-full max-w-md animate-slide-down">
        {/* En-tête */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-brand-border">
          <h3 className="font-bold text-brand-navy text-lg">{title}</h3>
          {!blocking && onClose && (
            <button
              onClick={onClose}
              className="text-text-muted hover:text-brand-navy transition-colors p-1 rounded"
            >
              <svg viewBox="0 0 20 20" className="w-5 h-5" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          )}
        </div>

        {/* Contenu */}
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}
