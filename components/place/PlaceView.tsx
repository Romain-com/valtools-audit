'use client'
// Composant principal — Vue 2 : Analyse d'un lieu touristique
// Étape 1 : saisie manuelle du lieu + commune
// Étape 2 : analyse complète (SERP lieu, SERP commune, Haloscan, diagnostic GPT)
// Sauvegarde Supabase + historique des analyses

import { useState, useCallback } from 'react'
import type { PlaceData, PlaceDiagnostic, PlaceSerpResult, CommuneSerpResult } from '@/types/place'
import StepInput from './StepInput'
import StepResults from './StepResults'

type Step = 'input' | 'results'

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

const VISIBILITY_LABELS: Record<string, { label: string; color: string }> = {
  SUPERIEURE:  { label: 'Supérieure',  color: 'text-green-600' },
  EQUIVALENTE: { label: 'Équivalente', color: 'text-amber-500' },
  INFERIEURE:  { label: 'Inférieure',  color: 'text-orange-500' },
  INEXISTANTE: { label: 'Inexistante', color: 'text-red-500' },
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

/** Calcule le diagnostic à partir des données brutes (sans headline/recommendations) */
function computeDiagnostic(
  placeSerp: PlaceSerpResult[],
  placeGmbExists: boolean,
  communeSerp: CommuneSerpResult[],
  placeTraffic: number | null,
  communeTraffic: number | null,
  placeFound: boolean
): Omit<PlaceDiagnostic, 'headline' | 'recommendations'> {
  const placeExists =
    placeSerp.some((s) => s.actorType === 'LIEU_OFFICIEL') || placeGmbExists

  const communeMentionsPlace = communeSerp.some((s) => s.mentionsPlace)

  let placeVisibilityVsCommune: PlaceDiagnostic['placeVisibilityVsCommune']
  if (!placeFound) {
    placeVisibilityVsCommune = 'INEXISTANTE'
  } else if ((placeTraffic ?? 0) >= (communeTraffic ?? 0) * 0.75) {
    placeVisibilityVsCommune = 'SUPERIEURE'
  } else if ((placeTraffic ?? 0) >= (communeTraffic ?? 0) * 0.25) {
    placeVisibilityVsCommune = 'EQUIVALENTE'
  } else {
    placeVisibilityVsCommune = 'INFERIEURE'
  }

  return { placeExists, communeMentionsPlace, placeVisibilityVsCommune }
}

export default function PlaceView() {
  const [step, setStep] = useState<Step>('input')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<PlaceData | null>(null)

  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  const [history, setHistory] = useState<HistoryItem[]>([])
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)

  const handleAnalyze = useCallback(async (placeName: string, commune: string) => {
    setLoading(true)
    setError(null)
    setSaveSuccess(false)

    try {
      const [serpPlaceRes, serpCommuneRes] = await Promise.all([
        fetch('/api/place/serp-place', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ placeName, commune }),
        }),
        fetch('/api/place/serp-commune', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ commune, placeName }),
        }),
      ])

      if (!serpPlaceRes.ok) {
        const d = await serpPlaceRes.json()
        throw new Error(d.error ?? 'Erreur lors de la recherche SERP du lieu')
      }
      if (!serpCommuneRes.ok) {
        const d = await serpCommuneRes.json()
        throw new Error(d.error ?? 'Erreur lors de la recherche SERP de la commune')
      }

      const [serpPlaceData, serpCommuneData] = await Promise.all([
        serpPlaceRes.json(),
        serpCommuneRes.json(),
      ])

      const placeSerp = serpPlaceData.placeSerp ?? []
      const placeGMB = serpPlaceData.placeGMB ?? {
        exists: false, name: null, rating: null,
        reviewCount: null, isClaimed: null, address: null, phone: null,
      }
      const communeSerp = serpCommuneData.communeSerp ?? []

      const placeDomain = placeSerp.find((s: PlaceSerpResult) => s.actorType === 'LIEU_OFFICIEL')?.domain ?? null
      const communeDomainFromPlaceSerp = placeSerp.find((s: PlaceSerpResult) => s.actorType === 'COMMUNE_OT')?.domain ?? null
      const communeDomain = communeDomainFromPlaceSerp ?? (communeSerp[0]?.domain ?? null)

      const rankedRes = await fetch('/api/place/ranked-place', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ placeDomain, communeDomain }),
      })

      const rankedData = rankedRes.ok ? await rankedRes.json() : { placeHaloscan: null, communeHaloscan: null }
      const { placeHaloscan, communeHaloscan } = rankedData

      const partialDiagnostic = computeDiagnostic(
        placeSerp,
        placeGMB.exists,
        communeSerp,
        placeHaloscan?.totalTraffic ?? null,
        communeHaloscan?.totalTraffic ?? null,
        placeHaloscan?.found ?? false
      )

      let headline = ''
      let recommendations: string[] = []

      try {
        const insightsRes = await fetch('/api/place/diagnostic-insights', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            placeName,
            commune,
            placeExists: partialDiagnostic.placeExists,
            communeMentionsPlace: partialDiagnostic.communeMentionsPlace,
            placeVisibilityVsCommune: partialDiagnostic.placeVisibilityVsCommune,
            placeTraffic: placeHaloscan?.totalTraffic ?? null,
            communeTraffic: communeHaloscan?.totalTraffic ?? null,
            gmbExists: placeGMB.exists,
            gmbIsClaimed: placeGMB.isClaimed,
            serpCount: placeSerp.length,
          }),
        })

        if (insightsRes.ok) {
          const insightsData = await insightsRes.json()
          headline = insightsData.headline ?? ''
          recommendations = insightsData.recommendations ?? []
        }
      } catch {
        // Diagnostic GPT non bloquant
      }

      const finalData = {
        placeName,
        commune,
        placeSerp,
        placeGMB,
        communeSerp,
        placeHaloscan: placeHaloscan ?? null,
        communeHaloscan: communeHaloscan ?? null,
        diagnostic: { ...partialDiagnostic, headline, recommendations },
      }

      setData(finalData)
      setStep('results')

      // Auto-save Supabase (non bloquant)
      setSaving(true)
      try {
        await fetch('/api/place/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(finalData),
        })
        setSaveSuccess(true)
      } catch {
        // Non bloquant
      } finally {
        setSaving(false)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }, [])

  function handleReset() {
    setStep('input')
    setData(null)
    setError(null)
    setSaveSuccess(false)
  }

  async function loadHistory() {
    setHistoryLoading(true)
    try {
      const res = await fetch('/api/place/history')
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

  async function deleteAnalysis(id: string) {
    await fetch('/api/place/history', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setHistory((prev) => prev.filter((h) => h.id !== id))
  }

  return (
    <div className="min-h-full">
      {step === 'input' && (
        <div className="flex min-h-[calc(100vh-3.5rem)]">
          <StepInput
            onAnalyze={handleAnalyze}
            loading={loading}
            error={error}
            history={history}
            historyOpen={historyOpen}
            historyLoading={historyLoading}
            onToggleHistory={toggleHistory}
            onDeleteHistory={deleteAnalysis}
            visibilityLabels={VISIBILITY_LABELS}
            formatDate={formatDate}
          />
        </div>
      )}

      {step === 'results' && data && (
        <StepResults
          data={data}
          onReset={handleReset}
          saving={saving}
          saveSuccess={saveSuccess}
        />
      )}
    </div>
  )
}
