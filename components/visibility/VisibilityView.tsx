'use client'
// Composant client principal — Vue Score de visibilité digitale
// Contexte destination ou lieu touristique via query params URL
// Orchestration des appels API séquentiels avec progression visuelle
// Sauvegarde Supabase + historique des analyses

import { useState, useCallback, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import type { VisibilityData, VisibilityParams } from '@/types/visibility'
import { getHebergementQueries, getActivitesQueries } from '@/lib/commercial-queries'
import { computeVisibilityScores } from '@/lib/visibility-scores'
import HeaderForm from './HeaderForm'
import LoadingOrchestra from './LoadingOrchestra'
import InsightBanner from './InsightBanner'
import ScoreDashboard from './ScoreDashboard'
import SectionNominal from './SectionNominal'
import SectionCommercial from './SectionCommercial'
import SectionSemantic from './SectionSemantic'
import SectionContent from './SectionContent'
import VisibilityComparison, { type AnalysisRecord } from './VisibilityComparison'

// --- Types historique ---

interface HistoryItem {
  id: string
  type: string
  keyword: string
  domain: string
  commune: string | null
  scores: VisibilityData['scores']
  headline: string | null
  created_at: string
}


// --- Utilitaire fetch ---

function defaultParams(): VisibilityParams {
  return { type: 'destination', keyword: '', domain: '' }
}

async function apiFetch<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const d = await res.json().catch(() => ({}))
    throw new Error(d.error ?? `Erreur ${res.status}`)
  }
  return res.json()
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function totalColor(score: number): string {
  if (score >= 65) return 'text-green-600'
  if (score >= 40) return 'text-amber-500'
  return 'text-red-500'
}

// --- Composant ---

export default function VisibilityView() {
  const searchParams = useSearchParams()
  const [initialParams, setInitialParams] = useState<VisibilityParams>(defaultParams)
  const [loading, setLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState('')
  const [completedSteps, setCompletedSteps] = useState<string[]>([])
  const [data, setData] = useState<VisibilityData | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Sauvegarde auto
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Historique
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [loadingId, setLoadingId] = useState<string | null>(null)

  // Comparaison
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([])
  const [compareMode, setCompareMode] = useState(false)
  const [compareData, setCompareData] = useState<[AnalysisRecord, AnalysisRecord] | null>(null)
  const [compareLoading, setCompareLoading] = useState(false)

  // Lecture des query params au montage
  useEffect(() => {
    const type = (searchParams.get('type') ?? 'destination') as VisibilityParams['type']
    const keyword = searchParams.get('keyword') ?? ''
    const domain = searchParams.get('domain') ?? ''
    const commune = searchParams.get('commune') ?? undefined
    const communeDomain = searchParams.get('communeDomain') ?? undefined
    setInitialParams({ type, keyword, domain, commune, communeDomain })
  }, [searchParams])

  function markStep(step: string) {
    setCompletedSteps((prev) => [...prev, step])
  }

  // --- Analyse ---

  const handleAnalyze = useCallback(async (params: VisibilityParams) => {
    setLoading(true)
    setError(null)
    setData(null)
    setSaveSuccess(false)
    setCompletedSteps([])

    const referenceDomain = params.domain.replace('www.', '')
    const hebergQueries = getHebergementQueries(params.keyword)
    const activitesQueries = getActivitesQueries(params.keyword)

    try {
      // Étape 1 — Appels parallèles : SERP principal + hébergement + activités + sémantique
      setLoadingStep('Analyse SERP principale')

      const [mainResult, hebergResult, activitesResult, relatedResult] = await Promise.all([
        apiFetch<{ serpMain: VisibilityData['serpMain']; paaMain: VisibilityData['paaMain']; knowledgeGraph: VisibilityData['knowledgeGraph']; localPack: VisibilityData['localPack']; googleReviews: VisibilityData['googleReviews']; paidAdsMain: VisibilityData['paidAdsMain']; hotelsPackMain: VisibilityData['hotelsPackMain']; compareSitesMain: VisibilityData['compareSitesMain'] }>(
          '/api/visibility/serp-main',
          { keyword: params.keyword, referenceDomain }
        ).then((r) => { markStep('Analyse SERP principale'); return r }),

        apiFetch<{ data: VisibilityData['hebergementData'] }>(
          '/api/visibility/serp-commercial',
          { queries: hebergQueries, referenceDomain, section: 'hebergement' }
        ).then((r) => { markStep('Analyse hébergement (5 requêtes)'); return r }),

        apiFetch<{ data: VisibilityData['activitesData'] }>(
          '/api/visibility/serp-commercial',
          { queries: activitesQueries, referenceDomain, section: 'activites' }
        ).then((r) => { markStep('Analyse activités (2 requêtes)'); return r }),

        apiFetch<{ relatedKeywords: VisibilityData['relatedKeywords'] }>(
          '/api/visibility/related',
          { keyword: params.keyword }
        ).then((r) => { markStep('Univers sémantique'); return r }),
      ])

      // Étape 2 — Classification GPT des domaines commerciaux
      setLoadingStep('Classification des acteurs')

      const allDomains = [
        ...hebergResult.data.consolidatedSerp.map((d) => d.rootDomain),
        ...activitesResult.data.consolidatedSerp.map((d) => d.rootDomain),
      ].filter((d, i, arr) => arr.indexOf(d) === i)

      const classifyResult = await apiFetch<{ classifications: { domain: string; type: string }[] }>(
        '/api/visibility/classify-commercial',
        { domains: allDomains, keyword: params.keyword, referenceDomain }
      )
      markStep('Classification des acteurs')

      // Fusion des classifications
      const classMap: Record<string, string> = Object.fromEntries(
        classifyResult.classifications.map((c) => [c.domain, c.type])
      )
      const hebergData = {
        ...hebergResult.data,
        consolidatedSerp: hebergResult.data.consolidatedSerp.map((d) => ({
          ...d,
          domainType: (classMap[d.rootDomain] as VisibilityData['hebergementData']['consolidatedSerp'][0]['domainType']) ?? null,
        })),
      }
      const activitesData = {
        ...activitesResult.data,
        consolidatedSerp: activitesResult.data.consolidatedSerp.map((d) => ({
          ...d,
          domainType: (classMap[d.rootDomain] as VisibilityData['activitesData']['consolidatedSerp'][0]['domainType']) ?? null,
        })),
      }

      // Étape 3 — Ranked keywords
      setLoadingStep('Analyse du domaine de référence')
      const rankedResult = await apiFetch<{ rankedKeywords: VisibilityData['rankedKeywords'] }>(
        '/api/visibility/ranked',
        { domain: referenceDomain }
      )
      markStep('Analyse du domaine de référence')

      // Étape 4 — Calcul du score
      setLoadingStep('Calcul du score')
      const partialData = {
        params,
        serpMain: mainResult.serpMain ?? [],
        paaMain: mainResult.paaMain ?? [],
        knowledgeGraph: mainResult.knowledgeGraph,
        localPack: mainResult.localPack,
        googleReviews: mainResult.googleReviews ?? { exists: false, rating: null, reviewCount: null, title: null },
        paidAdsMain: mainResult.paidAdsMain ?? [],
        hotelsPackMain: mainResult.hotelsPackMain ?? [],
        compareSitesMain: mainResult.compareSitesMain ?? [],
        hebergementData: hebergData,
        activitesData: activitesData,
        relatedKeywords: relatedResult.relatedKeywords ?? [],
        rankedKeywords: rankedResult.rankedKeywords ?? [],
      }
      const scores = computeVisibilityScores(partialData)
      markStep('Calcul du score')

      // Étape 5 — Insights GPT
      setLoadingStep('Génération du diagnostic')
      let headline = ''
      let insights: string[] = []
      try {
        const insightsResult = await apiFetch<{ headline: string; insights: string[] }>(
          '/api/visibility/insights',
          { scores, ...partialData, params }
        )
        headline = insightsResult.headline ?? ''
        insights = insightsResult.insights ?? []
      } catch {
        // Diagnostic GPT non bloquant
      }
      markStep('Génération du diagnostic')

      const finalData = { ...partialData, scores, headline, insights }
      setData(finalData)

      // Auto-save Supabase (non bloquant)
      setSaving(true)
      try {
        await fetch('/api/visibility/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(finalData),
        })
        setSaveSuccess(true)
        loadHistory()
      } catch {
        // Sauvegarde non bloquante
      } finally {
        setSaving(false)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
      setLoadingStep('')
    }
  }, [])

  // --- Historique ---

  async function loadHistory() {
    setHistoryLoading(true)
    try {
      const res = await fetch('/api/visibility/history')
      if (res.ok) {
        const d = await res.json()
        setHistory(d.analyses ?? [])
      }
    } finally {
      setHistoryLoading(false)
    }
  }

  function toggleHistory() {
    if (!historyOpen) loadHistory()
    setHistoryOpen(!historyOpen)
  }

  async function loadAnalysis(id: string) {
    setLoadingId(id)
    try {
      const res = await fetch(`/api/visibility/analysis/${id}`)
      if (!res.ok) return
      const d = await res.json()
      if (d.analysis?.resultats) {
        setData(d.analysis.resultats as VisibilityData)
        setHistoryOpen(false)
      }
    } finally {
      setLoadingId(null)
    }
  }

  async function deleteAnalysis(id: string) {
    await fetch('/api/visibility/history', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setHistory((prev) => prev.filter((h) => h.id !== id))
    setSelectedForCompare((prev) => prev.filter((s) => s !== id))
  }

  function toggleSelectForCompare(id: string) {
    setSelectedForCompare((prev) => {
      if (prev.includes(id)) return prev.filter((s) => s !== id)
      if (prev.length >= 2) return [prev[1], id] // glissement : garde le 2e + nouveau
      return [...prev, id]
    })
  }

  async function handleCompare() {
    if (selectedForCompare.length !== 2) return
    setCompareLoading(true)
    try {
      const [r1, r2] = await Promise.all(
        selectedForCompare.map((id) =>
          fetch(`/api/visibility/analysis/${id}`).then((r) => r.json()).then((d) => d.analysis)
        )
      )
      setCompareData([r1, r2])
      setCompareMode(true)
    } catch {
      // Erreur non bloquante
    } finally {
      setCompareLoading(false)
    }
  }

  // --- Rendu ---

  return (
    <div className="min-h-full">
      <HeaderForm
        initialParams={initialParams}
        loading={loading}
        error={error}
        onAnalyze={handleAnalyze}
      />

      {loading && (
        <LoadingOrchestra currentStep={loadingStep} completedSteps={completedSteps} />
      )}

      {!loading && data && (
        <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">
          {/* Barre d'actions */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">
              <span className="font-medium text-slate-700">{data.params.keyword}</span>
              {' · '}
              <span className="text-slate-400">{data.params.domain}</span>
            </p>
            <div className="flex items-center gap-3">
              {saving && (
                <span className="flex items-center gap-1 text-xs text-slate-400">
                  <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Sauvegarde...
                </span>
              )}
              {!saving && saveSuccess && (
                <span className="text-xs text-green-600">✓ Sauvegardé</span>
              )}
              <button
                onClick={toggleHistory}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Historique
              </button>
            </div>
          </div>

          {/* Panneau historique inline (comparaison) */}
          {historyOpen && (
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <HistoryPanel
                history={history}
                historyLoading={historyLoading}
                selectedForCompare={selectedForCompare}
                compareLoading={compareLoading}
                onToggleSelect={toggleSelectForCompare}
                onDelete={deleteAnalysis}
                onCompare={handleCompare}
                onLoad={loadAnalysis}
                loadingId={loadingId}
              />
            </div>
          )}

          {/* Mode comparaison — accessible même quand des résultats sont affichés */}
          {compareMode && compareData && (
            <VisibilityComparison
              v1={compareData[0]}
              v2={compareData[1]}
              onClose={() => { setCompareMode(false); setSelectedForCompare([]) }}
            />
          )}

          <InsightBanner headline={data.headline} insights={data.insights} />
          <ScoreDashboard scores={data.scores} type={data.params.type} />
          <SectionNominal
            serpMain={data.serpMain}
            paaMain={data.paaMain}
            knowledgeGraph={data.knowledgeGraph}
            googleReviews={data.googleReviews}
            paidAdsMain={data.paidAdsMain}
            hotelsPackMain={data.hotelsPackMain}
            compareSitesMain={data.compareSitesMain}
            score={data.scores.nominal}
            type={data.params.type}
            keyword={data.params.keyword}
            domain={data.params.domain}
          />
          <SectionCommercial
            hebergementData={data.hebergementData}
            activitesData={data.activitesData}
            score={data.scores.commercial}
            type={data.params.type}
            keyword={data.params.keyword}
            referenceDomain={data.params.domain}
          />
          <SectionSemantic
            relatedKeywords={data.relatedKeywords}
            rankedKeywords={data.rankedKeywords}
            score={data.scores.semantic}
            domain={data.params.domain}
          />
          <SectionContent
            paaMain={data.paaMain}
            serpMain={data.serpMain}
            knowledgeGraph={data.knowledgeGraph}
            score={data.scores.content}
            referenceDomain={data.params.domain}
          />
        </div>
      )}

      {/* État vide : formulaire vierge + historique */}
      {!loading && !data && !error && (
        <div className="max-w-5xl mx-auto px-4 py-8">
          {/* Bouton historique */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-slate-400 text-sm">
              Renseignez un mot-clé et un domaine ci-dessus pour lancer l&apos;analyse.
            </p>
            <button
              onClick={toggleHistory}
              className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Historique
            </button>
          </div>

          {/* Panneau historique */}
          {historyOpen && (
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <HistoryPanel
                history={history}
                historyLoading={historyLoading}
                selectedForCompare={selectedForCompare}
                compareLoading={compareLoading}
                onToggleSelect={toggleSelectForCompare}
                onDelete={deleteAnalysis}
                onCompare={handleCompare}
                onLoad={loadAnalysis}
                loadingId={loadingId}
              />
            </div>
          )}

          {/* Mode comparaison */}
          {compareMode && compareData && (
            <VisibilityComparison
              v1={compareData[0]}
              v2={compareData[1]}
              onClose={() => { setCompareMode(false); setSelectedForCompare([]) }}
            />
          )}
        </div>
      )}
    </div>
  )
}

// --- Composant HistoryPanel (partagé entre état vide et état avec résultats) ---

interface HistoryPanelProps {
  history: HistoryItem[]
  historyLoading: boolean
  selectedForCompare: string[]
  compareLoading: boolean
  onToggleSelect: (id: string) => void
  onDelete: (id: string) => void
  onCompare: () => void
  onLoad: (id: string) => void
  loadingId: string | null
}

function HistoryPanel({ history, historyLoading, selectedForCompare, compareLoading, onToggleSelect, onDelete, onCompare, onLoad, loadingId }: HistoryPanelProps) {
  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-700">Analyses récentes</h3>
        {selectedForCompare.length === 2 && (
          <button
            onClick={onCompare}
            disabled={compareLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {compareLoading ? (
              <>
                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Chargement...
              </>
            ) : (
              <>Comparer les 2 sélectionnées</>
            )}
          </button>
        )}
        {selectedForCompare.length === 1 && (
          <span className="text-xs text-slate-400">Sélectionnez une 2e analyse</span>
        )}
      </div>
      {historyLoading ? (
        <p className="text-sm text-slate-400">Chargement...</p>
      ) : history.length === 0 ? (
        <p className="text-sm text-slate-400">Aucune analyse sauvegardée.</p>
      ) : (
        <ul className="divide-y divide-slate-50">
          {history.map((item) => {
            const isSelected = selectedForCompare.includes(item.id)
            return (
              <li
                key={item.id}
                className={`py-2.5 flex items-center gap-3 ${isSelected ? 'bg-blue-50 -mx-1 px-1 rounded' : ''}`}
              >
                {/* Checkbox sélection comparaison */}
                <button
                  onClick={() => onToggleSelect(item.id)}
                  className={`flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                    isSelected ? 'bg-blue-600 border-blue-600' : 'border-slate-300 hover:border-blue-400'
                  }`}
                  title={isSelected ? 'Désélectionner' : 'Sélectionner pour comparer'}
                >
                  {isSelected && (
                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className={`text-base font-bold tabular-nums flex-shrink-0 ${totalColor(item.scores?.total ?? 0)}`}>
                    {item.scores?.total ?? '—'}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{item.keyword}</p>
                    <p className="text-xs text-slate-400">
                      {item.domain}
                      {item.commune && ` · ${item.commune}`}
                      {' · '}{formatDate(item.created_at)}
                    </p>
                    {item.headline && (
                      <p className="text-xs text-slate-500 italic truncate mt-0.5">{item.headline}</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => onLoad(item.id)}
                  disabled={loadingId === item.id}
                  className="flex-shrink-0 text-slate-400 hover:text-blue-600 transition-colors disabled:opacity-40"
                  title="Consulter cette analyse"
                >
                  {loadingId === item.id ? (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
                <button
                  onClick={() => onDelete(item.id)}
                  className="flex-shrink-0 text-slate-300 hover:text-red-400 transition-colors"
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
    </>
  )
}
