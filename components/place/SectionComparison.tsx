// Section "Visibilité du lieu vs sa commune"
// Tableau comparatif Haloscan + phrase de contexte calculée

import type { PlaceHaloscanData } from '@/types/place'
import { formatTraffic } from '@/lib/formatters'

interface Props {
  placeHaloscan: PlaceHaloscanData | null
  communeHaloscan: PlaceHaloscanData | null
  placeName: string
  commune: string
}

function MetricRow({ label, placeValue, communeValue }: {
  label: string
  placeValue: string
  communeValue: string
}) {
  return (
    <tr className="border-t border-slate-100">
      <td className="py-3 px-4 text-sm text-slate-600">{label}</td>
      <td className="py-3 px-4 text-sm font-medium text-slate-800 text-right">{placeValue}</td>
      <td className="py-3 px-4 text-sm font-medium text-slate-800 text-right">{communeValue}</td>
    </tr>
  )
}

/** Phrase de contexte calculée selon les trafics */
function contextPhrase(
  placeHaloscan: PlaceHaloscanData | null,
  communeHaloscan: PlaceHaloscanData | null,
  commune: string
): string {
  const communeTraffic = communeHaloscan?.totalTraffic ?? 0

  if (!placeHaloscan?.found) {
    const communeStr = communeTraffic > 0 ? ` face aux ${formatTraffic(communeTraffic)} visiteurs mensuels qui cherchent des informations sur ${commune}` : ` alors que la commune ${commune} est présente sur le web`
    return `Ce lieu n'a pas de présence digitale mesurable. Il est invisible${communeStr}.`
  }

  const placeTraffic = placeHaloscan.totalTraffic ?? 0

  if (communeTraffic > 0 && placeTraffic < communeTraffic * 0.1) {
    return `Le lieu génère moins de 10 % du trafic de sa commune. Il est sous-représenté dans l'offre digitale territoriale.`
  }

  if (communeTraffic > 0 && placeTraffic >= communeTraffic * 0.5) {
    return `Le lieu génère une visibilité comparable à sa commune — c'est un acteur digital fort du territoire.`
  }

  return `Le lieu est visible mais reste largement en retrait de sa commune sur le plan digital.`
}

export default function SectionComparison({ placeHaloscan, communeHaloscan, placeName, commune }: Props) {
  const placeNotFound = !placeHaloscan?.found
  const communeNotFound = !communeHaloscan?.found

  const placeTrafficStr = placeNotFound ? 'Non référencé' : formatTraffic(placeHaloscan?.totalTraffic ?? null)
  const placeKeywordsStr = placeNotFound ? '—' : (placeHaloscan?.uniqueKeywords?.toLocaleString('fr-FR') ?? '—')
  const placeTop10Str = placeNotFound ? '—' : (placeHaloscan?.totalTop10?.toLocaleString('fr-FR') ?? '—')

  const communeTrafficStr = communeNotFound ? 'Non référencé' : formatTraffic(communeHaloscan?.totalTraffic ?? null)
  const communeKeywordsStr = communeNotFound ? '—' : (communeHaloscan?.uniqueKeywords?.toLocaleString('fr-FR') ?? '—')
  const communeTop10Str = communeNotFound ? '—' : (communeHaloscan?.totalTop10?.toLocaleString('fr-FR') ?? '—')

  const phrase = contextPhrase(placeHaloscan, communeHaloscan, commune)

  return (
    <div>
      <h2 className="text-base font-semibold text-slate-800 mb-4">
        Visibilité du lieu vs sa commune
      </h2>

      <div className="bg-white border border-slate-100 rounded-xl overflow-hidden mb-4">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50">
              <th className="py-3 px-4 text-xs font-semibold text-slate-500 text-left">Métrique</th>
              <th className="py-3 px-4 text-xs font-semibold text-slate-500 text-right truncate max-w-[120px]">
                {placeName}
              </th>
              <th className="py-3 px-4 text-xs font-semibold text-slate-500 text-right">
                {commune}
              </th>
            </tr>
          </thead>
          <tbody>
            <MetricRow
              label="Trafic organique estimé / mois"
              placeValue={placeTrafficStr}
              communeValue={communeTrafficStr}
            />
            <MetricRow
              label="Mots-clés positionnés"
              placeValue={placeKeywordsStr}
              communeValue={communeKeywordsStr}
            />
            <MetricRow
              label="Positions top 10"
              placeValue={placeTop10Str}
              communeValue={communeTop10Str}
            />
          </tbody>
        </table>
      </div>

      {placeNotFound && (
        <p className="text-xs text-slate-400 mb-3">
          Ce domaine n'est pas encore dans la base Haloscan — trop récent ou trafic insuffisant.
        </p>
      )}

      {/* Phrase de contexte */}
      <div className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600 italic">
        {phrase}
      </div>

      {/* Source */}
      <p className="text-xs text-slate-300 mt-3">Source : Haloscan — données trafic estimées</p>
    </div>
  )
}
