'use client'
// Tableau SERP consolidée — lignes cliquables pour voir le détail par requête

import { useState } from 'react'
import type { CommercialSectionData, ConsolidatedDomain } from '@/types/visibility'

interface Props {
  data: CommercialSectionData
  section: 'hebergement' | 'activites'
  referenceDomainRank: number | null
}

function positionColor(pos: number): string {
  if (pos <= 3) return 'text-green-700 bg-green-100'
  if (pos <= 7) return 'text-amber-700 bg-amber-100'
  return 'text-red-700 bg-red-100'
}

/** Position pondérée : absences comptées comme position 11 (hors top 10) */
function weightedPosition(avgPos: number, frequency: number, total: number): number {
  const PENALTY = 11
  return (avgPos * frequency + PENALTY * (total - frequency)) / total
}

function FrequencyBar({ ratio, count, total }: { ratio: number; count: number; total: number }) {
  const color = ratio >= 0.8 ? 'bg-green-500' : ratio >= 0.4 ? 'bg-amber-400' : 'bg-red-400'
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.round(ratio * 100)}%` }} />
      </div>
      <span className="text-xs text-slate-500 tabular-nums">{count}/{total}</span>
    </div>
  )
}

function ExpandedRow({ domain, queries }: { domain: ConsolidatedDomain; queries: CommercialSectionData['queries'] }) {
  return (
    <tr className={domain.isReferenceDomain ? 'bg-blue-50' : 'bg-slate-50'}>
      <td colSpan={4} className="px-4 pb-3 pt-1">
        <div className="space-y-1.5">
          {queries.map((q, qi) => {
            // Meilleure position du domaine sur cette requête (un même domaine peut apparaître plusieurs fois)
            const serpAppearances = domain.appearances.filter((a) => a.serpId === q.id)
            const appearance = serpAppearances.reduce<typeof serpAppearances[0] | undefined>(
              (best, a) => (!best || a.position < best.position ? a : best),
              undefined
            )
            return (
              <div key={q.id} className="flex items-center gap-2 text-xs">
                <span className="text-slate-400 font-mono w-5 flex-shrink-0">R{qi + 1}</span>
                <span className="text-slate-600 flex-1 min-w-0 truncate" title={q.keyword}>{q.keyword}</span>
                {q.searchVolume != null && (
                  <span className="text-slate-400 flex-shrink-0">vol. {q.searchVolume.toLocaleString('fr-FR')}</span>
                )}
                {appearance ? (
                  <span className={`flex-shrink-0 px-1.5 py-0.5 rounded font-semibold ${positionColor(appearance.position)}`}>
                    #{appearance.position}
                  </span>
                ) : (
                  <span className="flex-shrink-0 px-1.5 py-0.5 rounded text-slate-400 bg-slate-100">absent</span>
                )}
              </div>
            )
          })}
        </div>
      </td>
    </tr>
  )
}

function Methodology({ section, referenceDomainRank }: { section: 'hebergement' | 'activites'; referenceDomainRank: number | null }) {
  const [open, setOpen] = useState(false)
  const maxPts = section === 'hebergement' ? 12 : 13
  const step = section === 'hebergement' ? 2 : 3
  const ranks = Array.from({ length: Math.ceil(maxPts / step) + 1 }, (_, i) => i + 1)

  return (
    <div className="mt-3 border-t border-slate-100 pt-2">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors"
      >
        <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
        Méthode de calcul du score
      </button>
      {open && (
        <div className="mt-2 p-3 bg-slate-50 rounded-lg text-xs text-slate-600 space-y-1.5">
          <p className="font-medium text-slate-700">
            Score {section === 'hebergement' ? 'hébergement' : 'activités'} — {maxPts} pts max
          </p>
          <p>Basé sur votre <strong>rang dans la SERP consolidée</strong> (position moyenne sur toutes les requêtes).</p>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {ranks.map((r) => {
              const pts = Math.max(0, maxPts - (r - 1) * step)
              return pts > 0 ? (
                <span key={r} className="px-2 py-0.5 bg-white border border-slate-200 rounded">
                  Rang {r} → {pts} pts
                </span>
              ) : null
            })}
            <span className="px-2 py-0.5 bg-white border border-slate-200 rounded text-slate-400">Absent → 0 pt</span>
          </div>
          {referenceDomainRank !== null && (
            <p className="mt-1 text-slate-500">
              Votre rang actuel : <strong className="text-blue-600">#{referenceDomainRank}</strong> →{' '}
              <strong className="text-blue-600">{Math.max(0, maxPts - (referenceDomainRank - 1) * step)} pts</strong>
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export default function ConsolidatedSerpTable({ data, section, referenceDomainRank }: Props) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null)
  const totalQueries = data.queries.length

  function toggle(domain: string) {
    setExpandedRow((prev) => (prev === domain ? null : domain))
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left py-2 pr-3 text-xs font-medium text-slate-500 w-8">#</th>
              <th className="text-left py-2 pr-3 text-xs font-medium text-slate-500">Domaine</th>
              <th className="text-left py-2 pr-3 text-xs font-medium text-slate-500 w-24">
                <span className="block">Pos. pond.</span>
                <span className="block text-[10px] font-normal text-slate-400 leading-tight">absences = #11</span>
              </th>
              <th className="text-left py-2 text-xs font-medium text-slate-500 w-28">Présence</th>
            </tr>
          </thead>
          <tbody>
            {data.consolidatedSerp.map((domain, index) => (
              <>
                <tr
                  key={domain.rootDomain}
                  onClick={() => toggle(domain.rootDomain)}
                  className={`border-b border-slate-50 cursor-pointer ${
                    domain.isReferenceDomain
                      ? 'bg-blue-50 border-l-2 border-l-blue-500'
                      : 'hover:bg-slate-50'
                  } ${expandedRow === domain.rootDomain ? 'border-b-0' : ''}`}
                >
                  <td className="py-2.5 pr-3 text-slate-400 text-xs">{index + 1}</td>
                  <td className="py-2.5 pr-3">
                    <div className="flex items-center gap-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`https://www.google.com/s2/favicons?domain=${domain.rootDomain}&sz=16`}
                        alt=""
                        width={16}
                        height={16}
                        className="rounded-sm flex-shrink-0"
                      />
                      <span className={`${domain.isReferenceDomain ? 'font-semibold text-blue-700' : 'text-slate-700'}`}>
                        {domain.rootDomain}
                      </span>
                      {domain.isReferenceDomain && (
                        <span className="text-xs text-blue-500">(vous)</span>
                      )}
                    </div>
                  </td>
                  <td className="py-2.5 pr-3 tabular-nums text-xs">
                    <span className={`px-1.5 py-0.5 rounded font-semibold ${positionColor(weightedPosition(domain.avgPosition, domain.frequency, totalQueries))}`}>
                      {weightedPosition(domain.avgPosition, domain.frequency, totalQueries).toFixed(1)}
                    </span>
                  </td>
                  <td className="py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <FrequencyBar ratio={domain.frequencyRatio} count={domain.frequency} total={totalQueries} />
                      <svg
                        className={`w-3.5 h-3.5 text-slate-300 flex-shrink-0 transition-transform ${expandedRow === domain.rootDomain ? 'rotate-180' : ''}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </td>
                </tr>
                {expandedRow === domain.rootDomain && (
                  <ExpandedRow key={`${domain.rootDomain}-expanded`} domain={domain} queries={data.queries} />
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {data.referenceDomainRank === null && (
        <div className="mt-3 flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
          <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          Votre domaine n&apos;apparaît sur aucune des {totalQueries} requêtes analysées pour cette catégorie.
        </div>
      )}

      <Methodology section={section} referenceDomainRank={referenceDomainRank} />
    </div>
  )
}
