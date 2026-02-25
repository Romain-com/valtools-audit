'use client'
// Section dépliable — titre + chevron + contenu masqué par défaut
import { useState } from 'react'

interface ExpandableSectionProps {
  title: string
  subtitle?: string
  defaultOpen?: boolean
  badge?: React.ReactNode
  children: React.ReactNode
}

export default function ExpandableSection({
  title,
  subtitle,
  defaultOpen = false,
  badge,
  children,
}: ExpandableSectionProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="border border-brand-border rounded-lg overflow-hidden">
      {/* En-tête cliquable */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 bg-white hover:bg-brand-bg/50 transition-colors duration-150 text-left group"
      >
        <div className="flex items-center gap-3">
          <span className="font-semibold text-brand-navy text-sm">{title}</span>
          {subtitle && (
            <span className="text-xs text-text-muted">{subtitle}</span>
          )}
          {badge && badge}
        </div>

        {/* Chevron animé */}
        <svg
          viewBox="0 0 20 20"
          className={`w-4 h-4 text-text-secondary shrink-0 transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {/* Contenu */}
      {open && (
        <div className="border-t border-brand-border bg-white px-5 py-4 animate-slide-down">
          {children}
        </div>
      )}
    </div>
  )
}
