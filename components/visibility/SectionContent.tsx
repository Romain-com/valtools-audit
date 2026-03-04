// Section Autorité de contenu — PAA principale + Featured Snippet + Knowledge Graph checklist

import type { PaaQuestion, SerpOrganic, KnowledgeGraph } from '@/types/visibility'

interface Props {
  paaMain: PaaQuestion[]
  serpMain: SerpOrganic[]
  knowledgeGraph: KnowledgeGraph
  score: number
  referenceDomain: string
}

export default function SectionContent({
  paaMain,
  serpMain,
  knowledgeGraph,
  score,
  referenceDomain,
}: Props) {
  const cleanDomain = referenceDomain.replace('www.', '')
  const hasFeaturedSnippet = serpMain.some((s) => s.isReferenceDomain && s.position === 0)

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-start justify-between mb-4">
        <h2 className="text-base font-semibold text-slate-800">Êtes-vous la référence informationnelle ?</h2>
        <span className="flex-shrink-0 ml-3 px-2 py-0.5 bg-slate-100 text-slate-600 text-xs font-semibold rounded-full">
          {score}/25
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* PAA de la SERP principale */}
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
            Questions détectées sur la SERP principale ({paaMain.length})
          </p>
          {paaMain.length === 0 ? (
            <p className="text-sm text-slate-400">Aucune PAA détectée sur la SERP principale.</p>
          ) : (
            <ul className="space-y-2">
              {paaMain.map((q, i) => {
                const isRef = q.sourceDomain?.includes(cleanDomain) ?? false
                return (
                  <li key={i} className="flex items-start gap-2.5 p-2.5 bg-slate-50 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 mb-0.5">{q.question}</p>
                      {q.sourceDomain && (
                        <span
                          className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                            isRef
                              ? 'bg-green-100 text-green-700'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {q.sourceDomain}
                        </span>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Featured Snippet + Knowledge Graph */}
        <div className="space-y-4">
          {/* Featured Snippet */}
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
              Position 0 (Featured Snippet)
            </p>
            <div
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-sm ${
                hasFeaturedSnippet
                  ? 'bg-green-50 border-green-200 text-green-700'
                  : 'bg-slate-50 border-slate-200 text-slate-500'
              }`}
            >
              <span className="text-base">{hasFeaturedSnippet ? '✓' : '✗'}</span>
              <span className="font-medium">
                {hasFeaturedSnippet ? 'Position 0 détectée' : 'Pas de position 0'}
              </span>
            </div>
          </div>

          {/* Knowledge Graph checklist */}
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
              Knowledge Graph
            </p>
            {!knowledgeGraph.exists ? (
              <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                <span>✗</span>
                <span>Pas de Knowledge Graph détecté</span>
              </div>
            ) : (
              <ul className="space-y-1.5">
                {[
                  { label: 'Numéro de téléphone', value: knowledgeGraph.hasPhone },
                  { label: 'Adresse', value: knowledgeGraph.hasAddress },
                  { label: 'Profils réseaux sociaux', value: knowledgeGraph.hasSocialProfiles },
                ].map(({ label, value }) => (
                  <li
                    key={label}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm ${
                      value
                        ? 'bg-green-50 border-green-200 text-green-700'
                        : 'bg-slate-50 border-slate-200 text-slate-500'
                    }`}
                  >
                    <span>{value ? '✓' : '✗'}</span>
                    <span>{label}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
