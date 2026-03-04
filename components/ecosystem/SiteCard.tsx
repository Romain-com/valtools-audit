'use client'
// Carte individuelle représentant un site officiel détecté — étape Validation

import type { ClassifiedSite, SiteCategory } from '@/types/ecosystem'

interface SiteCardProps {
  site: ClassifiedSite
  onRemove: () => void
  onCategoryChange: (category: SiteCategory) => void
}

const CATEGORY_LABELS: Record<SiteCategory, string> = {
  OT: 'Office de tourisme',
  STATION: 'Station / Domaine',
  INSTITUTIONNEL: 'Institutionnel',
  PARC: 'Parc naturel',
  AUTRE_OFFICIEL: 'Autre officiel',
}

const CATEGORY_STYLES: Record<SiteCategory, string> = {
  OT: 'bg-blue-100 text-blue-800',
  STATION: 'bg-green-100 text-green-800',
  INSTITUTIONNEL: 'bg-purple-100 text-purple-800',
  PARC: 'bg-emerald-100 text-emerald-800',
  AUTRE_OFFICIEL: 'bg-gray-100 text-gray-700',
}

export default function SiteCard({ site, onRemove, onCategoryChange }: SiteCardProps) {
  return (
    <div className="flex items-start gap-3 p-4 bg-white border border-slate-200 rounded-lg shadow-sm">
      {/* Favicon */}
      <img
        src={`https://www.google.com/s2/favicons?domain=${site.domain}&sz=32`}
        alt=""
        className="w-5 h-5 mt-0.5 shrink-0 rounded"
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
      />

      <div className="flex-1 min-w-0">
        {/* Domaine + position */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-slate-800 truncate">{site.domain}</span>
          {site.serpPosition !== null && (
            <span className="text-xs text-slate-400">#{site.serpPosition} sur Google</span>
          )}
          {site.manuallyAdded && (
            <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">Ajouté manuellement</span>
          )}
        </div>

        {/* Titre */}
        {site.title && (
          <p className="text-xs text-slate-500 mt-0.5 truncate">{site.title}</p>
        )}

        {/* Catégorie + badge confidence */}
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <select
            value={site.category ?? 'AUTRE_OFFICIEL'}
            onChange={(e) => onCategoryChange(e.target.value as SiteCategory)}
            className="text-xs px-2 py-1 border border-slate-200 rounded-md bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
          >
            {(Object.entries(CATEGORY_LABELS) as [SiteCategory, string][]).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>

          {site.category && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_STYLES[site.category]}`}>
              {CATEGORY_LABELS[site.category]}
            </span>
          )}

          {site.confidence === 'low' && (
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full flex items-center gap-1">
              ⚠️ À vérifier
            </span>
          )}
        </div>
      </div>

      {/* Bouton supprimer */}
      <button
        onClick={onRemove}
        className="text-slate-300 hover:text-red-400 transition-colors shrink-0 p-1"
        title="Supprimer ce site"
      >
        <svg viewBox="0 0 20 20" className="w-4 h-4" fill="currentColor">
          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>
    </div>
  )
}
