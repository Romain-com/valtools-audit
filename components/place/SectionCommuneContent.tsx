// Section "La commune met-elle ce lieu en avant ?"
// Affiche les résultats SERP sur la commune avec mise en évidence si mention du lieu

import type { CommuneSerpResult } from '@/types/place'

interface Props {
  communeSerp: CommuneSerpResult[]
  placeName: string
  commune: string
}

export default function SectionCommuneContent({ communeSerp, placeName, commune }: Props) {
  const mentionCount = communeSerp.filter((r) => r.mentionsPlace).length
  const noMentions = mentionCount === 0

  return (
    <div>
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-base font-semibold text-slate-800">La commune met-elle ce lieu en avant ?</h2>
        {communeSerp.length > 0 && (
          <span className="text-xs text-slate-400">
            Résultats Google pour « {commune} »
          </span>
        )}
      </div>

      {/* Stat synthétique */}
      <div className={`flex items-center gap-2 px-4 py-3 rounded-lg mb-4 text-sm ${
        noMentions
          ? 'bg-red-50 border border-red-200 text-red-700'
          : 'bg-green-50 border border-green-200 text-green-700'
      }`}>
        {noMentions ? (
          <>
            <span>⚠️</span>
            <span>
              Ce lieu n&apos;apparaît dans aucun des contenus visibles de la commune sur Google
            </span>
          </>
        ) : (
          <>
            <span>✓</span>
            <span>
              <strong>{mentionCount}</strong> résultat{mentionCount > 1 ? 's' : ''} sur {communeSerp.length} mentionne{mentionCount > 1 ? 'nt' : ''} ce lieu
            </span>
          </>
        )}
      </div>

      {/* Liste des résultats */}
      {communeSerp.length === 0 ? (
        <p className="text-sm text-slate-400">Aucun résultat trouvé pour cette commune.</p>
      ) : (
        <div className="bg-white border border-slate-100 rounded-xl overflow-hidden">
          <div className="divide-y divide-slate-50">
            {communeSerp.map((result, i) => (
              <div
                key={i}
                className={`px-4 py-3 flex items-start gap-3 ${
                  result.mentionsPlace ? 'bg-green-50' : ''
                }`}
              >
                <span className="text-xs text-slate-300 w-5 shrink-0 mt-0.5">#{result.position}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <a
                      href={result.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-blue-600 hover:underline truncate max-w-[200px]"
                    >
                      {result.domain}
                    </a>
                    {result.mentionsPlace && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 shrink-0">
                        Mentionne {placeName.split(' ')[0]}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5 line-clamp-1">{result.title}</p>
                  {result.description && (
                    <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{result.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
