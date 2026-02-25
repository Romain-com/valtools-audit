'use client'
// Page de lancement d'un nouvel audit — recherche commune + vérification doublon
import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Modal from '@/components/ui/Modal'
import Spinner from '@/components/ui/Spinner'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Commune {
  nom: string
  code: string           // Code INSEE
  codesPostaux: string[]
  codeDepartement: string
  codeRegion: string
  nomRegion?: string     // Nom lisible (fourni par geo API ou map statique)
  population: number
  siren?: string
}

// Map statique des codes région INSEE → noms
const REGIONS_FR: Record<string, string> = {
  '01': 'Guadeloupe',
  '02': 'Martinique',
  '03': 'Guyane',
  '04': 'La Réunion',
  '06': 'Mayotte',
  '11': 'Île-de-France',
  '24': 'Centre-Val de Loire',
  '27': 'Bourgogne-Franche-Comté',
  '28': 'Normandie',
  '32': 'Hauts-de-France',
  '44': 'Grand Est',
  '52': 'Pays de la Loire',
  '53': 'Bretagne',
  '75': 'Nouvelle-Aquitaine',
  '76': 'Occitanie',
  '84': 'Auvergne-Rhône-Alpes',
  '93': 'Provence-Alpes-Côte d\'Azur',
  '94': 'Corse',
}

interface DestinationExistante {
  id: string
  nom: string
  audit?: {
    id: string
    created_at: string
  }
}

// ─── Utilitaire debounce ─────────────────────────────────────────────────────

function useDebounce<T extends (...args: Parameters<T>) => void>(fn: T, delay: number): T {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  return useCallback(
    ((...args: Parameters<T>) => {
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => fn(...args), delay)
    }) as T,
    [fn, delay]
  )
}

// ─── Composant principal ─────────────────────────────────────────────────────

export default function NouvelAuditPage() {
  const router = useRouter()
  const supabase = createClient()

  // État recherche
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<Commune[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)

  // Commune sélectionnée
  const [selected, setSelected] = useState<Commune | null>(null)

  // Doublon
  const [doublon, setDoublon] = useState<DestinationExistante | null>(null)
  const [showDoublonModal, setShowDoublonModal] = useState(false)

  // Lancement
  const [launching, setLaunching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── Recherche autocomplete via microservice local ──
  const rechercherCommunes = useCallback(async (q: string) => {
    if (q.length < 2) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }
    setSearchLoading(true)
    try {
      const baseUrl = process.env.NEXT_PUBLIC_DATA_TOURISME_API_URL || 'http://localhost:3001'
      const res = await fetch(`${baseUrl}/communes?nom=${encodeURIComponent(q)}`)
      if (res.ok) {
        const data = await res.json()
        setSuggestions(data.slice(0, 8))
        setShowSuggestions(true)
      } else {
        // Fallback : API geo.gouv.fr directement
        const geoRes = await fetch(
          `https://geo.api.gouv.fr/communes?nom=${encodeURIComponent(q)}&fields=nom,code,codesPostaux,codeDepartement,codeRegion,nomRegion,population&format=json&limit=8`
        )
        const geoData = await geoRes.json()
        setSuggestions(geoData)
        setShowSuggestions(true)
      }
    } catch {
      // Fallback geo.gouv.fr
      try {
        const res = await fetch(
          `https://geo.api.gouv.fr/communes?nom=${encodeURIComponent(q)}&fields=nom,code,codesPostaux,codeDepartement,codeRegion,nomRegion,population&format=json&limit=8`
        )
        const data = await res.json()
        setSuggestions(data)
        setShowSuggestions(true)
      } catch {
        setSuggestions([])
      }
    }
    setSearchLoading(false)
  }, [])

  const debouncedSearch = useDebounce(rechercherCommunes, 300)

  function handleQueryChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setQuery(val)
    setSelected(null)
    debouncedSearch(val)
  }

  // ── Sélection d'une commune ──
  async function selectCommune(commune: Commune) {
    setSelected(commune)
    setQuery(commune.nom)
    setShowSuggestions(false)
    setError(null)

    // Vérification doublon via Route Handler (SIREN ou INSEE)
    try {
      const res = await fetch(`/api/destinations/check?insee=${commune.code}`)
      if (res.ok) {
        const data = await res.json()
        if (data.existant) {
          setDoublon(data.existant)
          setShowDoublonModal(true)
        }
      }
    } catch {
      // Silencieux — le doublon sera vérifié au lancement
    }
  }

  // ── Lancement de l'audit ──
  async function lancerAudit(forcer = false) {
    if (!selected) return
    setLaunching(true)
    setError(null)
    setShowDoublonModal(false)

    try {
      const res = await fetch('/api/audits/lancer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commune: selected,
          forcer,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Erreur lors du lancement de l\'audit.')
        setLaunching(false)
        return
      }

      // Redirection vers la page de progression
      router.push(`/audit/${data.auditId}/progression`)
    } catch {
      setError('Impossible de contacter le serveur. Vérifiez que l\'app est bien lancée.')
      setLaunching(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      {/* En-tête */}
      <div className="mb-8">
        <a href="/dashboard" className="text-sm text-text-secondary hover:text-brand-orange transition-colors flex items-center gap-1 mb-4">
          <svg viewBox="0 0 20 20" className="w-4 h-4" fill="currentColor">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
          Retour au dashboard
        </a>
        <h1 className="text-2xl font-bold text-brand-navy">Nouvel audit</h1>
        <p className="text-text-secondary text-sm mt-1">
          Recherchez une commune française pour analyser son potentiel digital.
        </p>
      </div>

      {/* Barre de recherche */}
      <div className="card p-6 mb-4">
        <label className="block text-sm font-semibold text-brand-navy mb-3">
          Destination à auditer
        </label>

        <div className="relative">
          <div className="relative">
            <input
              type="text"
              value={query}
              onChange={handleQueryChange}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              placeholder="Nom de la commune (ex: Annecy, Chamonix...)"
              className="input-base pr-10"
              autoFocus
            />
            {/* Icône recherche / spinner */}
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {searchLoading ? (
                <Spinner size="sm" />
              ) : (
                <svg viewBox="0 0 20 20" className="w-4 h-4 text-text-muted" fill="currentColor">
                  <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                </svg>
              )}
            </div>
          </div>

          {/* Dropdown suggestions */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-brand-border rounded-lg shadow-md z-20 overflow-hidden animate-slide-down">
              {suggestions.map((commune) => (
                <button
                  key={commune.code}
                  onClick={() => selectCommune(commune)}
                  className="w-full px-4 py-3 text-left hover:bg-brand-bg flex items-center justify-between gap-3 border-b border-brand-border last:border-0 transition-colors"
                >
                  <div>
                    <span className="font-medium text-brand-navy">{commune.nom}</span>
                    <div className="text-xs text-text-secondary mt-0.5">
                      {commune.codesPostaux?.[0]} — Dép. {commune.codeDepartement}
                    </div>
                  </div>
                  {commune.population && (
                    <span className="text-xs text-text-muted shrink-0">
                      {commune.population.toLocaleString('fr-FR')} hab.
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Panel de confirmation — commune sélectionnée */}
      {selected && !showDoublonModal && (
        <div className="card p-6 border-brand-orange/30 animate-fade-in">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 rounded-full bg-brand-orange" />
            <h2 className="font-semibold text-brand-navy">Commune sélectionnée</h2>
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm mb-6">
            <div>
              <span className="text-text-muted">Nom</span>
              <p className="font-semibold text-brand-navy">{selected.nom}</p>
            </div>
            <div>
              <span className="text-text-muted">Code INSEE</span>
              <p className="font-mono font-semibold text-brand-navy">{selected.code}</p>
            </div>
            <div>
              <span className="text-text-muted">Code postal</span>
              <p className="font-semibold text-brand-navy">
                {selected.codesPostaux?.[0] || '—'}
              </p>
            </div>
            <div>
              <span className="text-text-muted">Département</span>
              <p className="font-semibold text-brand-navy">{selected.codeDepartement}</p>
            </div>
            <div>
              <span className="text-text-muted">Région</span>
              <p className="font-semibold text-brand-navy">
                {selected.nomRegion || REGIONS_FR[selected.codeRegion] || selected.codeRegion}
              </p>
            </div>
            <div>
              <span className="text-text-muted">Population</span>
              <p className="font-semibold text-brand-navy">
                {selected.population?.toLocaleString('fr-FR') || '—'} hab.
              </p>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 mb-4 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              <svg viewBox="0 0 20 20" className="w-4 h-4 shrink-0" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => lancerAudit(false)}
              disabled={launching}
              className="btn-primary flex-1 justify-center"
            >
              {launching ? (
                <>
                  <Spinner size="sm" color="white" />
                  Lancement...
                </>
              ) : (
                <>
                  <svg viewBox="0 0 20 20" className="w-4 h-4" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                  </svg>
                  Lancer l&apos;audit
                </>
              )}
            </button>
            <button
              onClick={() => { setSelected(null); setQuery('') }}
              className="btn-secondary"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Modale doublon */}
      {doublon && (
        <Modal
          open={showDoublonModal}
          onClose={() => setShowDoublonModal(false)}
          title="Destination déjà auditée"
        >
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <svg viewBox="0 0 20 20" className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="font-semibold text-amber-800">{doublon.nom} a déjà été auditée</p>
                {doublon.audit?.created_at && (
                  <p className="text-sm text-amber-700 mt-1">
                    Dernier audit : {new Date(doublon.audit.created_at).toLocaleDateString('fr-FR', {
                      day: 'numeric', month: 'long', year: 'numeric'
                    })}
                  </p>
                )}
              </div>
            </div>

            <p className="text-sm text-text-secondary">
              Souhaitez-vous relancer l&apos;audit ? Les données existantes seront <strong>écrasées</strong>.
            </p>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => lancerAudit(true)}
                disabled={launching}
                className="btn-primary flex-1 justify-center"
              >
                {launching ? <Spinner size="sm" color="white" /> : 'Relancer l\'audit'}
              </button>
              <button
                onClick={() => setShowDoublonModal(false)}
                className="btn-secondary flex-1 justify-center"
              >
                Annuler
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
