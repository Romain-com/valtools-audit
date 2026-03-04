// Bandeau de diagnostic final — affiche le headline GPT + badges + recommandations
import type { PlaceDiagnostic } from '@/types/place'

interface Props {
  diagnostic: PlaceDiagnostic
  placeName: string
}

const visibilityConfig: Record<
  PlaceDiagnostic['placeVisibilityVsCommune'],
  { label: string; className: string }
> = {
  SUPERIEURE: { label: 'SUPÉRIEURE', className: 'bg-green-100 text-green-800' },
  EQUIVALENTE: { label: 'ÉQUIVALENTE', className: 'bg-blue-100 text-blue-800' },
  INFERIEURE: { label: 'INFÉRIEURE', className: 'bg-amber-100 text-amber-800' },
  INEXISTANTE: { label: 'INEXISTANTE', className: 'bg-red-100 text-red-800' },
}

export default function DiagnosticBanner({ diagnostic, placeName }: Props) {
  const vis = visibilityConfig[diagnostic.placeVisibilityVsCommune]

  return (
    <div className="bg-slate-900 text-white rounded-xl p-6">
      {/* Headline */}
      {diagnostic.headline && (
        <p className="text-lg font-semibold leading-snug mb-5">
          {diagnostic.headline}
        </p>
      )}

      {/* 3 badges synthétiques */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2">
          <span className="text-xs text-white/60">Existence digitale</span>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${diagnostic.placeExists ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
            {diagnostic.placeExists ? '✓ Oui' : '✗ Non'}
          </span>
        </div>

        <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2">
          <span className="text-xs text-white/60">Porté par la commune</span>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${diagnostic.communeMentionsPlace ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
            {diagnostic.communeMentionsPlace ? '✓ Oui' : '✗ Non'}
          </span>
        </div>

        <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2">
          <span className="text-xs text-white/60">Visibilité relative</span>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${vis.className}`}>
            {vis.label}
          </span>
        </div>
      </div>

      {/* Recommandations */}
      {diagnostic.recommendations.length > 0 && (
        <ul className="space-y-2">
          {diagnostic.recommendations.map((rec, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm text-white/80">
              <span className="text-brand-orange mt-0.5 shrink-0">→</span>
              {rec}
            </li>
          ))}
        </ul>
      )}

      {/* Nom du lieu en bas à droite */}
      <p className="mt-4 text-xs text-white/30 text-right">{placeName}</p>
    </div>
  )
}
