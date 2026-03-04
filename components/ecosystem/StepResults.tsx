'use client'
// Étape 3 — Tableau final avec métriques enrichies + score d'autorité
// Affiche la synthèse de l'écosystème digital de la destination

import type { EnrichedSite, SiteCategory } from '@/types/ecosystem'
import AuthorityBar from './AuthorityBar'
import { formatTraffic, formatPosition } from '@/lib/formatters'

interface StepResultsProps {
  sites: EnrichedSite[]
  destination: string
  onReset: () => void
}

const CATEGORY_LABELS: Record<SiteCategory, string> = {
  OT: 'Office de tourisme',
  STATION: 'Station / Domaine',
  INSTITUTIONNEL: 'Institutionnel',
  PARC: 'Parc naturel',
  AUTRE_OFFICIEL: 'Autre officiel',
}

const CATEGORY_STYLES: Record<SiteCategory, string> = {
  OT: 'bg-blue-100 text-blue-800',
  STATION: 'bg-green-100 text-green-800',
  INSTITUTIONNEL: 'bg-purple-100 text-purple-800',
  PARC: 'bg-emerald-100 text-emerald-800',
  AUTRE_OFFICIEL: 'bg-gray-100 text-gray-700',
}

function buildSummary(sites: EnrichedSite[], destination: string): string {
  if (sites.length === 0) return `Aucun acteur officiel identifié sur "${destination}".`

  const topSite = sites[0]
  let summary = ''

  if (topSite.category === 'OT')
    summary = `L'Office de Tourisme est la référence principale sur "${destination}".`
  else if (topSite.category === 'STATION')
    summary = `C'est le site de la station qui domine la visibilité sur "${destination}", devant l'Office de Tourisme.`
  else if (topSite.category === 'INSTITUTIONNEL')
    summary = `Le site institutionnel est le plus visible sur "${destination}".`
  else
    summary = `Aucun acteur ne s'impose clairement comme référence sur "${destination}".`

  // Signaler la fragmentation si écart < 10 pts entre les 3 premiers
  const isFragmented =
    sites.length >= 3 && sites[0].authorityScore - sites[2].authorityScore < 10
  if (isFragmented)
    summary += ` Attention : ${sites.slice(0, 3).length} acteurs se partagent la visibilité sans référence claire.`

  return summary
}

export default function StepResults({ sites, destination, onReset }: StepResultsProps) {
  // Trier par score d'autorité décroissant
  const sorted = [...sites].sort((a, b) => b.authorityScore - a.authorityScore)
  const summary = buildSummary(sorted, destination)

  return (
    <div className="py-8 px-4">
      {/* En-tête */}
      <div className="flex items-start justify-between mb-6 max-w-5xl mx-auto">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Écosystème digital — {destination}</h2>
          <p className="text-sm text-slate-500 mt-1">
            {sorted.length} acteur{sorted.length > 1 ? 's' : ''} officiel{sorted.length > 1 ? 's' : ''} analysé{sorted.length > 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={onReset}
          className="text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
        >
          ← Nouvelle analyse
        </button>
      </div>

      {/* Phrase de synthèse */}
      <div className="max-w-5xl mx-auto mb-6 px-4 py-3 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-800">
        {summary}
      </div>

      {/* Tableau */}
      <div className="max-w-5xl mx-auto overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="text-left py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-8">#</th>
              <th className="text-left py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Site</th>
              <th className="text-left py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Catégorie</th>
              <th className="text-right py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Position</th>
              <th className="text-right py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Trafic estimé</th>
              <th className="text-right py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Mots-clés</th>
              <th className="py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide min-w-[160px]">Score d&apos;autorité</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((site, index) => {
              const isTop = index === 0

              // Couleur du badge de position
              const posColor =
                site.serpPosition === null
                  ? 'bg-slate-100 text-slate-400'
                  : site.serpPosition <= 3
                  ? 'bg-green-100 text-green-700'
                  : site.serpPosition <= 10
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-red-100 text-red-600'

              return (
                <tr
                  key={site.domain}
                  className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${isTop ? 'bg-blue-50' : ''}`}
                >
                  {/* Rang */}
                  <td className="py-3.5 px-3 text-slate-400 font-medium">{index + 1}</td>

                  {/* Site */}
                  <td className="py-3.5 px-3">
                    <div className="flex items-center gap-2">
                      <img
                        src={`https://www.google.com/s2/favicons?domain=${site.domain}&sz=32`}
                        alt=""
                        className="w-4 h-4 rounded shrink-0"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                      />
                      <div>
                        <a
                          href={site.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-slate-800 hover:text-blue-700 transition-colors"
                        >
                          {site.domain}
                        </a>
                        {site.title && (
                          <p className="text-xs text-slate-400 truncate max-w-[220px]">{site.title}</p>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Catégorie */}
                  <td className="py-3.5 px-3">
                    {site.category && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_STYLES[site.category]}`}>
                        {CATEGORY_LABELS[site.category]}
                      </span>
                    )}
                  </td>

                  {/* Position */}
                  <td className="py-3.5 px-3 text-right">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${posColor}`}>
                      {formatPosition(site.serpPosition)}
                    </span>
                  </td>

                  {/* Trafic */}
                  <td className="py-3.5 px-3 text-right text-slate-600 font-medium">
                    {formatTraffic(site.totalTraffic)}
                  </td>

                  {/* Mots-clés */}
                  <td className="py-3.5 px-3 text-right text-slate-600">
                    {site.uniqueKeywords !== null ? site.uniqueKeywords.toLocaleString('fr-FR') : '—'}
                  </td>

                  {/* Score d'autorité */}
                  <td className="py-3.5 px-3">
                    <AuthorityBar score={site.authorityScore} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Légende score + sources */}
      <div className="max-w-5xl mx-auto mt-4 flex items-start justify-between gap-6 flex-wrap">
        <p className="text-xs text-slate-400">
          Sources : DataForSEO (positions Google) · Haloscan (trafic estimé, mots-clés)
        </p>
        <div className="flex items-center gap-4 text-xs text-slate-400 bg-slate-50 border border-slate-100 rounded-lg px-4 py-2.5">
          <span className="font-medium text-slate-500 shrink-0">Score d&apos;autorité</span>
          <span className="text-slate-300">|</span>
          <span><span className="font-medium text-slate-600">60%</span> position Google <span className="text-slate-300">(#1 = 100 pts, −10 par rang)</span></span>
          <span className="text-slate-300">+</span>
          <span><span className="font-medium text-slate-600">40%</span> trafic <span className="text-slate-300">(log, 0 si non indexé)</span></span>
          <span className="text-slate-300">|</span>
          <span className="flex items-center gap-1.5 shrink-0">
            <span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> &lt;34
            <span className="w-2 h-2 rounded-full bg-amber-400 inline-block ml-1" /> 34–66
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block ml-1" /> ≥67
          </span>
        </div>
      </div>
    </div>
  )
}
