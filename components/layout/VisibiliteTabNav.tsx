'use client'
// Sous-navigation partagée entre les vues "Visibilité digitale"
// Affichée en haut de /ecosystem, /place et /visibility

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function VisibiliteTabNav() {
  const pathname = usePathname()

  return (
    <div className="border-b border-slate-100 bg-white">
      <div className="max-w-5xl mx-auto px-4">
        <div className="flex items-center gap-0">
          <Link
            href="/ecosystem"
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              pathname?.startsWith('/ecosystem')
                ? 'border-blue-700 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Écosystème destination
          </Link>
          <Link
            href="/place"
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              pathname?.startsWith('/place')
                ? 'border-blue-700 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Lieu touristique
          </Link>
          <Link
            href="/visibility"
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              pathname?.startsWith('/visibility')
                ? 'border-blue-700 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Score de visibilité
          </Link>
        </div>
      </div>
    </div>
  )
}
