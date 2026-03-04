// Tooltip de méthodologie pour la SERP consolidée

'use client'

import { useState } from 'react'

interface Props {
  keyword: string
  queryCount: number
  section: 'hebergement' | 'activites'
}

export default function MethodologyTooltip({ keyword, queryCount, section }: Props) {
  const [open, setOpen] = useState(false)

  const sectionLabel = section === 'hebergement' ? 'hébergements' : 'activités'

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Méthodologie
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-6 z-20 w-80 bg-white border border-slate-200 rounded-xl shadow-lg p-4">
            <p className="text-xs font-semibold text-slate-700 mb-2">
              Comment est construite cette SERP consolidée ?
            </p>
            <p className="text-xs text-slate-600 leading-relaxed">
              Nous avons analysé <strong>{queryCount} requêtes</strong> que vos visiteurs utilisent
              pour chercher des <strong>{sectionLabel}</strong> sur <strong>{keyword}</strong>.
            </p>
            <p className="text-xs text-slate-600 leading-relaxed mt-2">
              Pour chaque requête, nous avons récupéré les 10 premiers résultats Google,
              puis fusionné par domaine :
            </p>
            <ul className="text-xs text-slate-600 mt-2 space-y-1">
              <li><strong>Position moyenne :</strong> plus elle est basse, mieux c&apos;est</li>
              <li><strong>Présence X/{queryCount} :</strong> sur combien de requêtes ce domaine apparaît</li>
            </ul>
            <p className="text-xs text-slate-500 mt-2">
              Le classement est trié par position moyenne croissante.
            </p>
          </div>
        </>
      )}
    </div>
  )
}
