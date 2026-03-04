'use client'
// Comparaison côte-à-côte de deux analyses de visibilité
// Affiche les scores, sous-scores et métriques clés avec indicateurs d'évolution

import type { VisibilityData, VisibilityScores } from '@/types/visibility'

export interface AnalysisRecord {
  id: string
  keyword: string
  domain: string
  commune: string | null
  scores: VisibilityScores
  resultats: VisibilityData
  headline: string | null
  created_at: string
}

interface Props {
  v1: AnalysisRecord
  v2: AnalysisRecord
  onClose: () => void
}

// Formatte une date ISO en français court
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

// Badge delta coloré : +5 ↑ / -3 ↓ / = (gris)
function DeltaBadge({ delta }: { delta: number }) {
  if (delta === 0) {
    return <span className="text-xs text-slate-400 font-medium tabular-nums">=</span>
  }
  const positive = delta > 0
  return (
    <span className={`text-xs font-semibold tabular-nums ${positive ? 'text-green-600' : 'text-red-500'}`}>
      {positive ? '+' : ''}{delta} {positive ? '↑' : '↓'}
    </span>
  )
}

// Barre de score visuelle
function ScoreBar({ score, max }: { score: number; max: number }) {
  const pct = Math.round((score / max) * 100)
  const color = pct >= 65 ? 'bg-green-500' : pct >= 40 ? 'bg-amber-400' : 'bg-red-400'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-slate-500 tabular-nums w-10 text-right">{score}/{max}</span>
    </div>
  )
}

// Ligne de comparaison de score
function ScoreRow({ label, s1, s2, max }: { label: string; s1: number; s2: number; max: number }) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center py-2 border-b border-slate-50 last:border-0">
      <div className="space-y-0.5">
        <div className="flex justify-between items-center">
          <span className="text-xs text-slate-500">{label}</span>
          <span className="text-sm font-bold text-slate-700 tabular-nums">{s1}</span>
        </div>
        <ScoreBar score={s1} max={max} />
      </div>
      <div className="flex justify-center">
        <DeltaBadge delta={s2 - s1} />
      </div>
      <div className="space-y-0.5">
        <div className="flex justify-between items-center">
          <span className="text-sm font-bold text-slate-700 tabular-nums">{s2}</span>
          <span className="text-xs text-slate-500">{label}</span>
        </div>
        <ScoreBar score={s2} max={max} />
      </div>
    </div>
  )
}

// Ligne de métrique booléenne (oui/non)
function BoolRow({ label, v1, v2 }: { label: string; v1: boolean; v2: boolean }) {
  const delta = v1 === v2 ? 0 : v2 ? 1 : -1
  return (
    <tr className="border-b border-slate-50 last:border-0">
      <td className="py-2 pr-3 text-xs text-slate-600">{v1 ? '✓' : '✗'}</td>
      <td className="py-2 text-xs text-center text-slate-500">{label}</td>
      <td className="py-2 pl-3 text-xs text-right text-slate-600">
        <span className="flex items-center justify-end gap-1.5">
          {delta !== 0 && <DeltaBadge delta={delta} />}
          {v2 ? '✓' : '✗'}
        </span>
      </td>
    </tr>
  )
}

// Ligne de métrique numérique (position, rang, %)
function NumRow({
  label,
  v1,
  v2,
  lowerIsBetter = false,
  suffix = '',
}: {
  label: string
  v1: number | string | null
  v2: number | string | null
  lowerIsBetter?: boolean
  suffix?: string
}) {
  const n1 = typeof v1 === 'number' ? v1 : null
  const n2 = typeof v2 === 'number' ? v2 : null
  let delta = 0
  if (n1 !== null && n2 !== null) {
    delta = lowerIsBetter ? n1 - n2 : n2 - n1
  }

  const display = (v: number | string | null) =>
    v === null ? <span className="text-slate-300">absent</span> : `${v}${suffix}`

  return (
    <tr className="border-b border-slate-50 last:border-0">
      <td className="py-2 pr-3 text-xs text-slate-600 tabular-nums">{display(v1)}</td>
      <td className="py-2 text-xs text-center text-slate-500">{label}</td>
      <td className="py-2 pl-3 text-xs text-right text-slate-600 tabular-nums">
        <span className="flex items-center justify-end gap-1.5">
          {delta !== 0 && <DeltaBadge delta={delta} />}
          {display(v2)}
        </span>
      </td>
    </tr>
  )
}

// Extraction des métriques clés depuis VisibilityData
function extractMetrics(d: VisibilityData) {
  const nominalPos = d.serpMain?.find((s) => s.isReferenceDomain)?.position ?? null
  const hasFeaturedSnippet = d.serpMain?.some((s) => s.isReferenceDomain && s.position === 0) ?? false
  const paaTotal = d.paaMain?.length ?? 0
  const cleanDomain = d.params?.domain?.replace('www.', '') ?? ''
  const paaSourced = d.paaMain?.filter((q) => q.sourceDomain?.includes(cleanDomain)).length ?? 0
  const rankedSet = new Set((d.rankedKeywords ?? []).map((r) => r.keyword.toLowerCase()))
  const relKw = d.relatedKeywords ?? []
  const coveredKw = relKw.filter((rk) => rankedSet.has(rk.keyword.toLowerCase())).length
  const kwCoverage = relKw.length > 0 ? Math.round((coveredKw / relKw.length) * 100) : 0

  return {
    nominalPos,
    hasKnowledgeGraph: d.knowledgeGraph?.exists ?? false,
    hasLocalPack: d.localPack?.exists ?? false,
    hasFeaturedSnippet,
    hebergRank: d.hebergementData?.referenceDomainRank ?? null,
    activitesRank: d.activitesData?.referenceDomainRank ?? null,
    paaSourced,
    paaTotal,
    kwCoverage,
  }
}

export default function VisibilityComparison({ v1, v2, onClose }: Props) {
  // Les scores sont directement sur l'enregistrement
  const s1 = v1.scores
  const s2 = v2.scores

  // Les données complètes sont dans resultats
  const d1 = v1.resultats
  const d2 = v2.resultats

  const m1 = extractMetrics(d1)
  const m2 = extractMetrics(d2)

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* En-tête */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50">
        <h2 className="text-sm font-semibold text-slate-700">Comparaison d&apos;analyses</h2>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 transition-colors"
          title="Fermer"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="p-5 space-y-6">
        {/* Identité des deux analyses */}
        <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-start">
          <div>
            <p className="text-xs font-semibold text-slate-700 truncate">{v1.keyword}</p>
            <p className="text-xs text-slate-400 truncate">{v1.domain}</p>
            <p className="text-xs text-slate-400">{formatDate(v1.created_at)}</p>
          </div>
          <div className="flex items-center justify-center pt-1">
            <span className="text-xs text-slate-400">vs</span>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold text-slate-700 truncate">{v2.keyword}</p>
            <p className="text-xs text-slate-400 truncate">{v2.domain}</p>
            <p className="text-xs text-slate-400">{formatDate(v2.created_at)}</p>
          </div>
        </div>

        {/* Scores */}
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">Scores</p>
          <div className="space-y-1">
            <ScoreRow label="Score global" s1={s1.total} s2={s2.total} max={100} />
            <ScoreRow label="Présence nominale" s1={s1.nominal} s2={s2.nominal} max={25} />
            <ScoreRow label="Résistance OTA" s1={s1.commercial} s2={s2.commercial} max={25} />
            <ScoreRow label="Couverture sémantique" s1={s1.semantic} s2={s2.semantic} max={25} />
            <ScoreRow label="Autorité de contenu" s1={s1.content} s2={s2.content} max={25} />
          </div>
        </div>

        {/* Métriques clés */}
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">Métriques clés</p>
          <table className="w-full text-sm">
            <tbody>
              <NumRow label="Position nominale" v1={m1.nominalPos} v2={m2.nominalPos} lowerIsBetter />
              <BoolRow label="Knowledge Graph" v1={m1.hasKnowledgeGraph} v2={m2.hasKnowledgeGraph} />
              <BoolRow label="Local Pack" v1={m1.hasLocalPack} v2={m2.hasLocalPack} />
              <BoolRow label="Featured snippet" v1={m1.hasFeaturedSnippet} v2={m2.hasFeaturedSnippet} />
              <NumRow label="Rang hébergement" v1={m1.hebergRank} v2={m2.hebergRank} lowerIsBetter />
              <NumRow label="Rang activités" v1={m1.activitesRank} v2={m2.activitesRank} lowerIsBetter />
              <NumRow
                label="PAA sourcées"
                v1={m1.paaTotal > 0 ? `${m1.paaSourced}/${m1.paaTotal}` : null}
                v2={m2.paaTotal > 0 ? `${m2.paaSourced}/${m2.paaTotal}` : null}
              />
              <NumRow label="Mots-clés couverts" v1={m1.kwCoverage} v2={m2.kwCoverage} suffix="%" />
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
