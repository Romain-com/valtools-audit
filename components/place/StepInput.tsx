// Étape 1 — Saisie du lieu touristique et de sa commune (saisie manuelle)
// Affiche aussi l'historique des analyses sauvegardées
import { useState } from 'react'

interface HistoryItem {
  id: string
  place_name: string
  commune: string
  place_domain: string | null
  place_exists: boolean
  place_visibility: string | null
  headline: string | null
  created_at: string
}

interface Props {
  onAnalyze: (placeName: string, commune: string) => void
  loading: boolean
  error: string | null
  history: HistoryItem[]
  historyOpen: boolean
  historyLoading: boolean
  onToggleHistory: () => void
  onDeleteHistory: (id: string) => void
  visibilityLabels: Record<string, { label: string; color: string }>
  formatDate: (iso: string) => string
}

export default function StepInput({
  onAnalyze, loading, error,
  history, historyOpen, historyLoading,
  onToggleHistory, onDeleteHistory,
  visibilityLabels, formatDate,
}: Props) {
  const [placeName, setPlaceName] = useState('')
  const [commune, setCommune] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (placeName.trim() && commune.trim()) {
      onAnalyze(placeName.trim(), commune.trim())
    }
  }

  return (
    <div className="flex-1 flex items-start justify-center pt-16 px-4">
      <div className="w-full max-w-xl">
        {/* En-tête */}
        <div className="mb-8">
          <h1 className="text-xl font-semibold text-slate-800 mb-1">Analyse d'un lieu touristique</h1>
          <p className="text-sm text-slate-500">
            Évaluez la visibilité digitale d'un équipement ou site naturel et comparez-la à sa commune.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Nom du lieu touristique
            </label>
            <input
              type="text"
              value={placeName}
              onChange={(e) => setPlaceName(e.target.value)}
              placeholder="Ex : Base nautique du lac de la Terrasse"
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Commune de rattachement
            </label>
            <input
              type="text"
              value={commune}
              onChange={(e) => setCommune(e.target.value)}
              placeholder="Ex : Saint-Hilaire-du-Touvet"
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={loading}
            />
          </div>

          {error && (
            <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!placeName.trim() || !commune.trim() || loading}
            className="w-full py-2.5 bg-blue-700 text-white text-sm font-medium rounded-lg hover:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Analyse en cours...
              </span>
            ) : 'Lancer l\'analyse →'}
          </button>
        </form>

        {/* Aide contextuelle */}
        <div className="mt-8 p-4 bg-blue-50 border border-blue-100 rounded-xl">
          <p className="text-xs font-medium text-blue-700 mb-2">Cette analyse vous permet de :</p>
          <ul className="space-y-1 text-xs text-blue-600">
            <li>• Vérifier si le lieu a une présence digitale (site officiel, fiche GMB)</li>
            <li>• Savoir si la commune/OT valorise ce lieu dans ses contenus Google</li>
            <li>• Comparer la visibilité SEO du lieu face à sa commune</li>
          </ul>
        </div>

        {/* Historique */}
        <div className="mt-6">
          <button
            type="button"
            onClick={onToggleHistory}
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {historyOpen ? 'Masquer l\'historique' : 'Voir l\'historique'}
          </button>

          {historyOpen && (
            <div className="mt-3 bg-white rounded-xl border border-slate-200 p-4">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Analyses récentes</h3>
              {historyLoading ? (
                <p className="text-sm text-slate-400">Chargement...</p>
              ) : history.length === 0 ? (
                <p className="text-sm text-slate-400">Aucune analyse sauvegardée.</p>
              ) : (
                <ul className="divide-y divide-slate-50">
                  {history.map((item) => {
                    const vis = item.place_visibility ? visibilityLabels[item.place_visibility] : null
                    return (
                      <li key={item.id} className="py-2.5 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="text-sm font-medium text-slate-700 truncate">{item.place_name}</p>
                            {vis && (
                              <span className={`text-xs font-medium flex-shrink-0 ${vis.color}`}>{vis.label}</span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400">
                            {item.commune}
                            {item.place_domain && ` · ${item.place_domain}`}
                            {' · '}{formatDate(item.created_at)}
                          </p>
                          {item.headline && (
                            <p className="text-xs text-slate-500 italic truncate mt-0.5">{item.headline}</p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => onDeleteHistory(item.id)}
                          className="flex-shrink-0 text-slate-300 hover:text-red-400 transition-colors mt-0.5"
                          title="Supprimer"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
