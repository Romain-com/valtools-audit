// Formulaire de saisie contextuel — adaptatif selon type=destination ou type=place

import { useState, useEffect } from 'react'
import type { VisibilityParams, VisibilityContext } from '@/types/visibility'

interface Props {
  initialParams: VisibilityParams
  loading: boolean
  error: string | null
  onAnalyze: (params: VisibilityParams) => void
}

const LABELS = {
  destination: {
    keywordLabel: 'Destination',
    keywordPlaceholder: 'ex : Les 7 Laux',
    domainLabel: "Domaine de l'OT",
    domainPlaceholder: 'ex : les7laux.com',
    communeLabel: null,
  },
  place: {
    keywordLabel: 'Lieu touristique',
    keywordPlaceholder: 'ex : Base nautique du lac de la Terrasse',
    domainLabel: 'Site du lieu (ou commune si absent)',
    domainPlaceholder: 'ex : base-nautique-terrasse.fr',
    communeLabel: 'Commune de rattachement',
  },
}

export default function HeaderForm({ initialParams, loading, error, onAnalyze }: Props) {
  const [type, setType] = useState<VisibilityContext>(initialParams.type)
  const [keyword, setKeyword] = useState(initialParams.keyword)
  const [domain, setDomain] = useState(initialParams.domain)
  const [commune, setCommune] = useState(initialParams.commune ?? '')

  // Synchronise si les initialParams changent (navigation URL)
  useEffect(() => {
    setType(initialParams.type)
    setKeyword(initialParams.keyword)
    setDomain(initialParams.domain)
    setCommune(initialParams.commune ?? '')
  }, [initialParams])

  const labels = LABELS[type]

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!keyword.trim() || !domain.trim()) return
    onAnalyze({
      type,
      keyword: keyword.trim(),
      domain: domain.trim().replace('https://', '').replace('http://', '').replace(/\/$/, ''),
      commune: commune.trim() || undefined,
    })
  }

  return (
    <div className="bg-white border-b border-slate-100">
      <div className="max-w-5xl mx-auto px-4 py-5">
        <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
          {/* Sélecteur type */}
          <div className="flex-shrink-0">
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Type</label>
            <div className="flex rounded-lg border border-slate-200 overflow-hidden">
              <button
                type="button"
                onClick={() => setType('destination')}
                className={`px-3 py-2 text-sm font-medium transition-colors ${
                  type === 'destination'
                    ? 'bg-blue-700 text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                Destination
              </button>
              <button
                type="button"
                onClick={() => setType('place')}
                className={`px-3 py-2 text-sm font-medium transition-colors border-l border-slate-200 ${
                  type === 'place'
                    ? 'bg-blue-700 text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                Lieu
              </button>
            </div>
          </div>

          {/* Mot-clé */}
          <div className="flex-1 min-w-48">
            <label className="block text-xs font-medium text-slate-500 mb-1.5">
              {labels.keywordLabel}
            </label>
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder={labels.keywordPlaceholder}
              disabled={loading}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
            />
          </div>

          {/* Domaine */}
          <div className="flex-1 min-w-40">
            <label className="block text-xs font-medium text-slate-500 mb-1.5">
              {labels.domainLabel}
            </label>
            <input
              type="text"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder={labels.domainPlaceholder}
              disabled={loading}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
            />
          </div>

          {/* Commune (uniquement pour type=place) */}
          {type === 'place' && (
            <div className="flex-shrink-0 min-w-36">
              <label className="block text-xs font-medium text-slate-500 mb-1.5">
                {labels.communeLabel}
              </label>
              <input
                type="text"
                value={commune}
                onChange={(e) => setCommune(e.target.value)}
                placeholder="ex : La Terrasse"
                disabled={loading}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
              />
            </div>
          )}

          {/* Bouton */}
          <div className="flex-shrink-0">
            <label className="block text-xs font-medium text-transparent mb-1.5">-</label>
            <button
              type="submit"
              disabled={!keyword.trim() || !domain.trim() || loading}
              className="px-4 py-2 bg-blue-700 text-white text-sm font-medium rounded-lg hover:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Analyse...
                </span>
              ) : 'Analyser →'}
            </button>
          </div>
        </form>

        {error && (
          <div className="mt-3 px-4 py-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}
      </div>
    </div>
  )
}
