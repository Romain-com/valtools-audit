// Accordéon PAA — Questions des internautes groupées par requête

'use client'

import { useState } from 'react'
import type { PaaByQuery } from '@/types/visibility'

interface Props {
  paaByQuery: PaaByQuery[]
  referenceDomain: string
}

function truncate(text: string | null, max = 150): string {
  if (!text) return ''
  return text.length > max ? text.slice(0, max) + '…' : text
}

export default function PaaAccordion({ paaByQuery, referenceDomain }: Props) {
  const [openIds, setOpenIds] = useState<Set<string>>(new Set())
  const cleanDomain = referenceDomain.replace('www.', '')

  function toggle(id: string) {
    setOpenIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <div className="space-y-1.5">
      {paaByQuery.map((paa) => {
        const isOpen = openIds.has(paa.queryId)
        const hasQuestions = paa.questions.length > 0

        return (
          <div key={paa.queryId} className="border border-slate-100 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => toggle(paa.queryId)}
              className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-slate-50 transition-colors"
            >
              <span className="text-sm text-slate-700">
                <span className="mr-1.5">📌</span>
                <span className="font-medium">&quot;{paa.queryKeyword}&quot;</span>
                <span className="ml-2 text-xs text-slate-400">
                  {hasQuestions ? `${paa.questions.length} question${paa.questions.length > 1 ? 's' : ''}` : 'aucune question'}
                </span>
              </span>
              <svg
                className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isOpen && (
              <div className="px-4 pb-3 border-t border-slate-50">
                {!hasQuestions ? (
                  <p className="text-sm text-slate-400 pt-2">Aucune question détectée pour cette requête.</p>
                ) : (
                  <ul className="space-y-2.5 pt-2.5">
                    {paa.questions.map((q, i) => {
                      const isRef = q.sourceDomain?.includes(cleanDomain) ?? false
                      return (
                        <li key={i} className="text-sm">
                          <p className="font-medium text-slate-700 mb-0.5">{q.question}</p>
                          {q.answer && (
                            <p className="text-xs text-slate-500 mb-1">{truncate(q.answer)}</p>
                          )}
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
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
