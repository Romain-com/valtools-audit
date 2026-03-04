// Tableau de bord des scores — score /100 + 4 jauges
// Labels adaptatifs selon type=destination ou type=place

import type { VisibilityScores, VisibilityContext } from '@/types/visibility'

interface Props {
  scores: VisibilityScores
  type: VisibilityContext
}

const SCORE_LABELS = {
  destination: {
    nominal:    'Présence sur votre destination',
    commercial: 'Résistance aux OTA',
    semantic:   'Couverture de votre marché',
    content:    'Autorité informationnelle',
  },
  place: {
    nominal:    'Présence sur le nom du lieu',
    commercial: 'Résistance aux agrégateurs',
    semantic:   'Couverture sémantique du lieu',
    content:    'Autorité informationnelle',
  },
}

function totalColor(score: number): string {
  if (score >= 65) return 'text-green-600'
  if (score >= 40) return 'text-amber-500'
  return 'text-red-500'
}

function gaugeBg(score: number, max: number): string {
  const pct = score / max
  if (pct >= 0.65) return 'bg-green-500'
  if (pct >= 0.4) return 'bg-amber-400'
  return 'bg-red-400'
}

interface GaugeProps {
  label: string
  score: number
  max?: number
}

function Gauge({ label, score, max = 25 }: GaugeProps) {
  const pct = Math.round((score / max) * 100)
  return (
    <div>
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-sm text-slate-600">{label}</span>
        <span className="text-sm font-semibold text-slate-800">{score}<span className="text-slate-400 font-normal">/{max}</span></span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${gaugeBg(score, max)}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export default function ScoreDashboard({ scores, type }: Props) {
  const labels = SCORE_LABELS[type]

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-start gap-6">
        {/* Score total */}
        <div className="flex-shrink-0 text-center w-24">
          <div className={`text-5xl font-bold tabular-nums leading-none ${totalColor(scores.total)}`}>
            {scores.total}
          </div>
          <div className="text-slate-400 text-sm mt-1">/100</div>
          <div className="text-xs text-slate-500 mt-2">Score global</div>
        </div>

        {/* Séparateur */}
        <div className="w-px self-stretch bg-slate-100" />

        {/* 4 jauges */}
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Gauge label={labels.nominal} score={scores.nominal} />
          <Gauge label={labels.commercial} score={scores.commercial} />
          <Gauge label={labels.semantic} score={scores.semantic} />
          <Gauge label={labels.content} score={scores.content} />
        </div>
      </div>
    </div>
  )
}
