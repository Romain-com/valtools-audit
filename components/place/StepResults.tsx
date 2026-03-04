// Étape 2 — Résultats scrollables de l'analyse du lieu touristique
import type { PlaceData } from '@/types/place'
import DiagnosticBanner from './DiagnosticBanner'
import SectionExistence from './SectionExistence'
import SectionCommuneContent from './SectionCommuneContent'
import SectionComparison from './SectionComparison'

interface Props {
  data: PlaceData
  onReset: () => void
  saving: boolean
  saveSuccess: boolean
}

export default function StepResults({ data, onReset, saving, saveSuccess }: Props) {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      {/* Titre + bouton retour + indicateur auto-save */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-slate-800">{data.placeName}</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Commune : {data.commune} · Analyse de visibilité digitale
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {saving && (
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Sauvegarde...
            </span>
          )}
          {!saving && saveSuccess && <span className="text-xs text-green-600">✓ Sauvegardé</span>}
          <button
            onClick={onReset}
            className="px-3 py-1.5 text-xs text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            ← Nouvelle analyse
          </button>
        </div>
      </div>

      {/* 1. Diagnostic global */}
      <DiagnosticBanner diagnostic={data.diagnostic} placeName={data.placeName} />

      {/* 2. Existence digitale */}
      <SectionExistence placeSerp={data.placeSerp} placeGMB={data.placeGMB} />

      {/* 3. Commune et mentions */}
      <SectionCommuneContent
        communeSerp={data.communeSerp}
        placeName={data.placeName}
        commune={data.commune}
      />

      {/* 4. Comparaison de visibilité */}
      <SectionComparison
        placeHaloscan={data.placeHaloscan}
        communeHaloscan={data.communeHaloscan}
        placeName={data.placeName}
        commune={data.commune}
      />
    </div>
  )
}
