// Section Couverture sémantique — mots-clés disponibles vs positionnés

import type { RelatedKeyword, RankedKeyword } from '@/types/visibility'

interface Props {
  relatedKeywords: RelatedKeyword[]
  rankedKeywords: RankedKeyword[]
  score: number
  domain: string
}

function formatVolume(v: number): string {
  if (v >= 10000) return `${Math.round(v / 1000)}k`
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`
  return String(v)
}

export default function SectionSemantic({ relatedKeywords, rankedKeywords, score, domain }: Props) {
  // Normalisation : supprime accents, apostrophes, espaces multiples
  // pour matcher "alpe d'huez" == "alpe d huez" == "alpes d huez"
  function norm(s: string): string {
    return s.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[''`]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  const rankedSet = new Set(rankedKeywords.map((r) => norm(r.keyword)))

  const covered = relatedKeywords.filter((rk) => rankedSet.has(norm(rk.keyword)))
  const missing = relatedKeywords
    .filter((rk) => !rankedSet.has(norm(rk.keyword)))
    .sort((a, b) => b.searchVolume - a.searchVolume)
    .slice(0, 20)

  // URL qui génère le plus de trafic estimé (somme des volumes de ses mots-clés)
  // URL qui génère le plus de trafic estimé (somme ETV de ses mots-clés)
  const etvParUrl = new Map<string, number>()
  for (const rk of rankedKeywords) {
    if (!rk.url) continue
    etvParUrl.set(rk.url, (etvParUrl.get(rk.url) ?? 0) + rk.etv)
  }
  const urlPrincipale = [...etvParUrl.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
  const kwUrlPrincipale = urlPrincipale
    ? rankedKeywords
        .filter((rk) => rk.url === urlPrincipale)
        .sort((a, b) => b.etv - a.etv)
        .slice(0, 20)
    : []

  const coveragePercent =
    relatedKeywords.length > 0
      ? Math.round((covered.length / relatedKeywords.length) * 100)
      : 0

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-start justify-between mb-4">
        <h2 className="text-base font-semibold text-slate-800">Quelle part du marché captez-vous ?</h2>
        <span className="flex-shrink-0 ml-3 px-2 py-0.5 bg-slate-100 text-slate-600 text-xs font-semibold rounded-full">
          {score}/25
        </span>
      </div>

      {/* Stat principale */}
      <div className="mb-5 p-4 bg-slate-50 rounded-lg">
        <p className="text-sm text-slate-700">
          Le domaine <strong>{domain}</strong> se positionne sur{' '}
          <strong>{covered.length} mots-clés</strong> parmi{' '}
          <strong>{relatedKeywords.length} disponibles</strong> (vol ≥ 100) —{' '}
          soit <strong>{coveragePercent}%</strong>
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Mots-clés absents à fort volume */}
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
            Top opportunités manquées ({missing.length})
          </p>
          {missing.length === 0 ? (
            <p className="text-sm text-slate-400">Tous les mots-clés sont couverts.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left py-1.5 pr-3 text-xs font-medium text-slate-400">Mot-clé</th>
                    <th className="text-right py-1.5 text-xs font-medium text-slate-400">Volume</th>
                  </tr>
                </thead>
                <tbody>
                  {missing.map((rk, i) => (
                    <tr key={i} className="border-b border-slate-50">
                      <td className="py-1.5 pr-3 text-slate-700">{rk.keyword}</td>
                      <td className="py-1.5 text-right text-slate-500 tabular-nums">
                        {formatVolume(rk.searchVolume)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Top 20 mots-clés de la page la plus performante */}
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
            Top 20 mots-clés — page la plus trafiquée
          </p>
          {urlPrincipale && (
            <p className="text-xs text-slate-400 truncate mb-2" title={urlPrincipale}>
              {urlPrincipale}
            </p>
          )}
          {kwUrlPrincipale.length === 0 ? (
            <p className="text-sm text-slate-400">Aucune donnée disponible.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left py-1.5 pr-3 text-xs font-medium text-slate-400">Mot-clé</th>
                    <th className="text-center py-1.5 pr-3 text-xs font-medium text-slate-400">Pos.</th>
                    <th className="text-right py-1.5 text-xs font-medium text-slate-400">Trafic est.</th>
                  </tr>
                </thead>
                <tbody>
                  {kwUrlPrincipale.map((rk: RankedKeyword, i: number) => (
                    <tr key={i} className="border-b border-slate-50">
                      <td className="py-1.5 pr-3 text-slate-700 truncate max-w-[160px]">{rk.keyword}</td>
                      <td className="py-1.5 pr-3 text-center">
                        <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">
                          {rk.position}
                        </span>
                      </td>
                      <td className="py-1.5 text-right text-slate-500 tabular-nums">
                        {formatVolume(rk.etv)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
