// Section "Ce lieu existe-t-il sur le web ?"
// Affiche les résultats SERP + la fiche GMB côte à côte

import type { PlaceSerpResult, PlaceGMB } from '@/types/place'

interface Props {
  placeSerp: PlaceSerpResult[]
  placeGMB: PlaceGMB
}

const actorTypeConfig: Record<
  PlaceSerpResult['actorType'],
  { label: string; className: string }
> = {
  LIEU_OFFICIEL: { label: 'Site officiel', className: 'bg-blue-100 text-blue-800' },
  COMMUNE_OT: { label: 'Commune / OT', className: 'bg-purple-100 text-purple-800' },
  AGGREGATEUR: { label: 'Agrégateur', className: 'bg-orange-100 text-orange-800' },
  MEDIA: { label: 'Média', className: 'bg-slate-100 text-slate-600' },
  AUTRE: { label: 'Autre', className: 'bg-gray-100 text-gray-500' },
}

export default function SectionExistence({ placeSerp, placeGMB }: Props) {
  const hasOfficialSite = placeSerp.some((s) => s.actorType === 'LIEU_OFFICIEL')

  return (
    <div>
      <h2 className="text-base font-semibold text-slate-800 mb-4">Ce lieu existe-t-il sur le web ?</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Bloc SERP */}
        <div className="bg-white border border-slate-100 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-slate-700">Présence sur Google</h3>
            <span className="text-xs text-slate-400">{placeSerp.length} résultat{placeSerp.length > 1 ? 's' : ''}</span>
          </div>

          {!hasOfficialSite && (
            <div className="flex items-start gap-2 mb-3 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
              <span className="shrink-0 mt-0.5">⚠️</span>
              <span>Ce lieu ne dispose pas de présence web officielle identifiable</span>
            </div>
          )}

          {placeSerp.length === 0 ? (
            <p className="text-sm text-slate-400">Aucun résultat trouvé sur Google.</p>
          ) : (
            <div className="divide-y divide-slate-50">
              {placeSerp.map((result, i) => {
                const config = actorTypeConfig[result.actorType]
                return (
                  <div key={i} className="py-2.5 flex items-start gap-3">
                    <span className="text-xs text-slate-300 w-4 shrink-0 mt-0.5">#{result.position}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <a
                          href={result.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-medium text-blue-600 hover:underline truncate max-w-[180px]"
                        >
                          {result.domain}
                        </a>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full shrink-0 ${config.className}`}>
                          {config.label}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{result.title}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Bloc GMB */}
        <div className="bg-white border border-slate-100 rounded-xl p-5">
          <h3 className="text-sm font-medium text-slate-700 mb-3">Fiche Google Maps</h3>

          {!placeGMB.exists ? (
            <div className="flex items-start gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              <span className="shrink-0 mt-0.5">⚠️</span>
              <span>Aucune fiche Google Maps trouvée pour ce lieu</span>
            </div>
          ) : (
            <>
              {placeGMB.isClaimed === false && (
                <div className="flex items-start gap-2 mb-3 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                  <span className="shrink-0 mt-0.5">⚠️</span>
                  <span>Fiche Google Maps non réclamée — le propriétaire n'en a pas pris le contrôle</span>
                </div>
              )}

              <div className="space-y-2.5">
                {placeGMB.name && (
                  <div>
                    <p className="text-xs text-slate-400 mb-0.5">Nom</p>
                    <p className="text-sm font-medium text-slate-800">{placeGMB.name}</p>
                  </div>
                )}

                {placeGMB.rating !== null && (
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="text-xs text-slate-400 mb-0.5">Note</p>
                      <div className="flex items-center gap-1">
                        <span className="text-amber-400 text-sm">★</span>
                        <span className="text-sm font-medium text-slate-800">{placeGMB.rating.toFixed(1)}</span>
                      </div>
                    </div>
                    {placeGMB.reviewCount !== null && (
                      <div>
                        <p className="text-xs text-slate-400 mb-0.5">Avis</p>
                        <p className="text-sm font-medium text-slate-800">{placeGMB.reviewCount.toLocaleString('fr-FR')}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-slate-400 mb-0.5">Statut</p>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${placeGMB.isClaimed ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {placeGMB.isClaimed ? 'Réclamée' : 'Non réclamée'}
                      </span>
                    </div>
                  </div>
                )}

                {placeGMB.address && (
                  <div>
                    <p className="text-xs text-slate-400 mb-0.5">Adresse</p>
                    <p className="text-xs text-slate-600">{placeGMB.address}</p>
                  </div>
                )}

                {placeGMB.phone && (
                  <div>
                    <p className="text-xs text-slate-400 mb-0.5">Téléphone</p>
                    <p className="text-xs text-slate-600">{placeGMB.phone}</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
