// Section Couverture sémantique — deux niveaux d'analyse MARQUE et GLOBAL

import type { RelatedKeyword, RankedKeyword } from '@/types/visibility'

interface Props {
  matchKeywords: RelatedKeyword[]    // MARQUE : keywords/match (contiennent le seed)
  relatedKeywords: RelatedKeyword[]  // GLOBAL  : keywords/related (liés thématiquement)
  rankedKeywords: RankedKeyword[]
  score: number
  domain: string
}

function formatVolume(v: number): string {
  if (v >= 10000) return `${Math.round(v / 1000)}k`
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`
  return String(v)
}

// Normalise + trie les mots pour matcher "les 7 laux forfait" == "forfait les 7 laux"
function norm(s: string): string {
  return s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[''`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ').sort().join(' ')
}

function OpportunitiesTable({ keywords, rankedSet, label, color }: {
  keywords: RelatedKeyword[]
  rankedSet: Set<string>
  label: string
  color: 'amber' | 'blue'
}) {

  const covered = keywords.filter((rk) => rankedSet.has(norm(rk.keyword)))
  const missing = keywords
    .filter((rk) => !rankedSet.has(norm(rk.keyword)))
    .sort((a, b) => b.searchVolume - a.searchVolume)
    .slice(0, 20)

  const coveragePercent = keywords.length > 0
    ? Math.round((covered.length / keywords.length) * 100)
    : 0

  const totalVolume = keywords.reduce((s, rk) => s + rk.searchVolume, 0)
  const coveredVolume = covered.reduce((s, rk) => s + rk.searchVolume, 0)
  const volumePercent = totalVolume > 0 ? Math.round((coveredVolume / totalVolume) * 100) : 0

  return (
    <div>
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">{label}</p>

      {/* Stat principale : couverture en nombre de mots-clés */}
      <div className="flex items-center gap-2 mb-1">
        <span className={`text-2xl font-bold ${color === 'amber' ? 'text-amber-600' : 'text-blue-600'}`}>
          {coveragePercent}%
        </span>
        <span className="text-xs text-slate-500 leading-tight">
          des mots-clés<br />couverts
        </span>
      </div>
      <p className="text-xs text-slate-400 mb-3">{covered.length} / {keywords.length} mots-clés</p>

      {/* Stat complémentaire : couverture pondérée par le volume */}
      <div className="flex items-center gap-2 mb-1">
        <span className="text-base font-semibold text-slate-600">{volumePercent}%</span>
        <span className="text-xs text-slate-400 leading-tight">du volume de<br />recherche capté</span>
      </div>
      <p className="text-xs text-slate-400 mb-3">{formatVolume(coveredVolume)} / {formatVolume(totalVolume)} recherches/mois</p>

      <p className="text-xs text-slate-400 mb-2">{missing.length} opportunités manquées</p>
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
  )
}

export default function SectionSemantic({ matchKeywords, relatedKeywords, rankedKeywords, score, domain }: Props) {
  const rankedSet = new Set(rankedKeywords.map((r) => norm(r.keyword)))

  // Top 20 mots-clés du site entier, triés par trafic estimé décroissant
  const top20Site = rankedKeywords.slice(0, 20)

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-start justify-between mb-4">
        <h2 className="text-base font-semibold text-slate-800">Quelle part du marché captez-vous ?</h2>
        <span className="flex-shrink-0 ml-3 px-2 py-0.5 bg-slate-100 text-slate-600 text-xs font-semibold rounded-full">
          {score}/25
        </span>
      </div>

      <div className="mb-5 p-4 bg-slate-50 rounded-lg text-sm text-slate-700">
        Domaine analysé : <strong>{domain}</strong> — {rankedKeywords.length} positions connues
      </div>

      {/* Grille 2 colonnes : MARQUE | TOP 20 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">

        {/* Colonne 1 — Opportunités MARQUE */}
        <OpportunitiesTable
          keywords={matchKeywords}
          rankedSet={rankedSet}
          label="Opportunités Marque"
          color="amber"
        />

        {/* Colonne 2 — Top 20 mots-clés du site */}
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
            Top 20 mots-clés — site entier
          </p>
          {top20Site.length === 0 ? (
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
                  {top20Site.map((rk: RankedKeyword, i: number) => (
                    <tr key={i} className="border-b border-slate-50">
                      <td className="py-1.5 pr-3 text-slate-700 truncate max-w-[140px]">{rk.keyword}</td>
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

      {/* Bloc séparé — Opportunités Marché (GLOBAL) */}
      <div className="border-t border-slate-100 pt-5">
        <OpportunitiesTable
          keywords={relatedKeywords}
          rankedSet={rankedSet}
          label="Opportunités Marché"
          color="blue"
        />
      </div>
    </div>
  )
}
