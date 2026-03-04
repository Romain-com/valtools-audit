'use client'
// Composant principal — gère les 3 étapes de la Vue 1 : Écosystème digital
// Étape 1 : Détection via DataForSEO SERP + classification OpenAI
// Étape 2 : Validation / édition de la liste d'acteurs officiels
// Étape 3 : Enrichissement Haloscan + tableau final + sauvegarde automatique en base

import { useState, useEffect, useCallback } from 'react'
import type { ClassifiedSite, DetectedSite, EnrichedSite, HaloscanData } from '@/types/ecosystem'
import { computeAuthorityScore } from '@/lib/scores'
import StepDetection from './StepDetection'
import StepValidation from './StepValidation'
import StepResults from './StepResults'

type Step = 'detection' | 'validation' | 'results'

interface HistoryEntry {
  id: string
  destination: string
  sites: EnrichedSite[]
  created_at: string
}

interface SessionCosts {
  serp?: { nb_appels: number; cout_total: number }
  classify?: { nb_appels: number; cout_total: number }
  enrich?: { nb_appels: number; cout_total: number }
}

export default function EcosystemView() {
  const [step, setStep] = useState<Step>('detection')
  const [destination, setDestination] = useState('')
  const [detectedSites, setDetectedSites] = useState<ClassifiedSite[]>([])
  const [enrichedSites, setEnrichedSites] = useState<EnrichedSite[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sessionCosts, setSessionCosts] = useState<SessionCosts>({})
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [savedId, setSavedId] = useState<string | null>(null)
  const [saveError, setSaveError] = useState(false)

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const res = await fetch('/api/ecosystem/history')
      if (res.ok) {
        const { analyses } = await res.json()
        setHistory(analyses ?? [])
      }
    } catch {
      // Historique non critique
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  /** Étape 1 → 2 : Détection SERP + classification IA */
  async function handleDetect(keyword: string) {
    setLoading(true)
    setError(null)
    setDestination(keyword)
    setSessionCosts({})
    setSavedId(null)
    setSaveError(false)

    try {
      setLoadingMessage('Recherche des acteurs sur Google...')
      const serpRes = await fetch('/api/ecosystem/serp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword }),
      })

      if (!serpRes.ok) {
        const data = await serpRes.json()
        throw new Error(data.error ?? 'Erreur lors de la recherche Google')
      }

      const serpData = await serpRes.json()
      setSessionCosts((prev) => ({ ...prev, serp: serpData.cout }))

      setLoadingMessage('Classification des acteurs officiels...')
      const classRes = await fetch('/api/ecosystem/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sites: serpData.sites }),
      })

      if (!classRes.ok) {
        const data = await classRes.json()
        throw new Error(data.error ?? 'Erreur lors de la classification')
      }

      const classData = await classRes.json()
      setSessionCosts((prev) => ({ ...prev, classify: classData.cout }))
      setDetectedSites(classData.sites)
      setStep('validation')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
      setLoadingMessage('')
    }
  }

  /** Étape 2 → 3 : Enrichissement Haloscan + sauvegarde automatique */
  async function handleEnrich(sites: ClassifiedSite[]) {
    setLoading(true)
    setError(null)

    try {
      const enrichRes = await fetch('/api/ecosystem/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domains: sites.map((s) => s.domain) }),
      })

      if (!enrichRes.ok) {
        const data = await enrichRes.json()
        throw new Error(data.error ?? "Erreur lors de l'enrichissement Haloscan")
      }

      const enrichData = await enrichRes.json()
      const newCosts = { ...sessionCosts, enrich: enrichData.cout }
      setSessionCosts(newCosts)

      const enrichments: Record<string, HaloscanData> = enrichData.enrichments

      const enriched: EnrichedSite[] = sites.map((site) => {
        const haloscan = enrichments[site.domain]
        const totalTraffic = haloscan?.totalTraffic ?? null
        return {
          ...site,
          totalTraffic,
          uniqueKeywords: haloscan?.uniqueKeywords ?? null,
          totalTop10: haloscan?.totalTop10 ?? null,
          totalTop3: haloscan?.totalTop3 ?? null,
          haloscanFound: haloscan?.haloscanFound ?? false,
          authorityScore: computeAuthorityScore(site.serpPosition, totalTraffic),
        }
      })

      setEnrichedSites(enriched)
      setStep('results')

      // Sauvegarde automatique (non bloquante)
      fetch('/api/ecosystem/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destination, sites: enriched, couts_api: newCosts }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.id) {
            setSavedId(data.id)
            loadHistory()
          } else {
            setSaveError(true)
          }
        })
        .catch(() => setSaveError(true))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }

  function handleLoadHistory(entry: HistoryEntry) {
    setDestination(entry.destination)
    setEnrichedSites(entry.sites)
    setSavedId(entry.id)
    setSessionCosts({})
    setStep('results')
  }

  async function handleDeleteHistory(id: string) {
    await fetch('/api/ecosystem/history', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setHistory((prev) => prev.filter((e) => e.id !== id))
    if (savedId === id) setSavedId(null)
  }

  function handleReset() {
    setStep('detection')
    setDestination('')
    setDetectedSites([])
    setEnrichedSites([])
    setError(null)
    setSavedId(null)
    setSessionCosts({})
  }

  return (
    <div className="min-h-full">
      {/* Barre d'étapes (masquée à l'étape 1) */}
      {step !== 'detection' && (
        <div className="border-b border-slate-100 bg-white sticky top-28 z-10">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-6">
            <StepIndicator label="Détection" step={1} active={false} done />
            <div className="w-8 h-px bg-slate-200" />
            <StepIndicator label="Validation" step={2} active={step === 'validation'} done={step === 'results'} />
            <div className="w-8 h-px bg-slate-200" />
            <StepIndicator label="Résultats" step={3} active={step === 'results'} done={false} />
            {savedId && (
              <span className="ml-auto text-xs text-green-600 flex items-center gap-1">
                <svg viewBox="0 0 20 20" className="w-3.5 h-3.5" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Sauvegardé
              </span>
            )}
            {saveError && !savedId && (
              <span className="ml-auto text-xs text-amber-600 flex items-center gap-1" title="Vérifiez que la migration 006 a bien été appliquée sur Supabase">
                <svg viewBox="0 0 20 20" className="w-3.5 h-3.5" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                Non sauvegardé — table manquante ?
              </span>
            )}
          </div>
        </div>
      )}

      {/* Erreur globale (hors étape 1 qui gère sa propre erreur) */}
      {error && step !== 'detection' && (
        <div className="max-w-5xl mx-auto mt-4 px-4">
          <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        </div>
      )}

      {/* Étape 1 : formulaire + panneau historique latéral */}
      {step === 'detection' && (
        <div className="flex min-h-[calc(100vh-3.5rem)]">
          <div className="flex-1">
            <StepDetection
              onDetect={handleDetect}
              loading={loading}
              loadingMessage={loadingMessage}
              error={error}
            />
          </div>

          {/* Historique latéral */}
          <div className="w-72 shrink-0 border-l border-slate-100 bg-white px-5 py-8">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">
              Analyses récentes
            </h3>

            {historyLoading ? (
              <div className="flex flex-col gap-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-14 bg-slate-100 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : history.length === 0 ? (
              <p className="text-sm text-slate-400">Aucune analyse enregistrée.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {history.map((entry) => (
                  <div
                    key={entry.id}
                    className="group flex items-start gap-2 p-3 rounded-lg border border-slate-100 hover:border-blue-200 hover:bg-blue-50 transition-colors cursor-pointer"
                    onClick={() => handleLoadHistory(entry)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">{entry.destination}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {entry.sites.length} acteur{entry.sites.length > 1 ? 's' : ''} ·{' '}
                        {new Date(entry.created_at).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteHistory(entry.id) }}
                      className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-all p-0.5 shrink-0 mt-0.5"
                      title="Supprimer"
                    >
                      <svg viewBox="0 0 20 20" className="w-3.5 h-3.5" fill="currentColor">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {step === 'validation' && (
        <StepValidation
          sites={detectedSites}
          destination={destination}
          onEnrich={handleEnrich}
          loading={loading}
        />
      )}

      {step === 'results' && (
        <StepResults
          sites={enrichedSites}
          destination={destination}
          onReset={handleReset}
        />
      )}
    </div>
  )
}

function StepIndicator({ label, step, active, done }: { label: string; step: number; active: boolean; done: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${
          done ? 'bg-green-500 text-white' : active ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-400'
        }`}
      >
        {done ? (
          <svg viewBox="0 0 20 20" className="w-3.5 h-3.5" fill="currentColor">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        ) : step}
      </div>
      <span className={`text-sm font-medium ${active ? 'text-slate-800' : done ? 'text-green-600' : 'text-slate-400'}`}>
        {label}
      </span>
    </div>
  )
}
