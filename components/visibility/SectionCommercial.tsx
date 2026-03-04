// Section SERPs commerciales — hébergement + activités avec SERP consolidée et PAA

import type { CommercialSectionData, PaidAdByQuery, SerpCommercialPresence, VisibilityContext } from '@/types/visibility'
import ConsolidatedSerpTable from './ConsolidatedSerpTable'
import PaaAccordion from './PaaAccordion'

interface Props {
  hebergementData: CommercialSectionData
  activitesData: CommercialSectionData
  score: number
  type: VisibilityContext
  keyword: string
  referenceDomain: string
}

/** Pill colorée avec favicon + nom de domaine (sans détails superflus) */
function DomainPill({ domain, title, type }: { domain: string | null; title: string; type: 'paid' | 'hotels' | 'compare' }) {
  const display = domain ?? title
  const colorMap = {
    paid: 'bg-amber-50 border-amber-200 text-amber-800',
    hotels: 'bg-sky-50 border-sky-200 text-sky-800',
    compare: 'bg-violet-50 border-violet-200 text-violet-800',
  }
  const dotMap = {
    paid: 'bg-amber-400',
    hotels: 'bg-sky-400',
    compare: 'bg-violet-400',
  }
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${colorMap[type]}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotMap[type]}`} />
      {domain && (
        <img
          src={`https://www.google.com/s2/favicons?domain=${domain}&sz=16`}
          className="w-3.5 h-3.5 rounded-sm flex-shrink-0"
          alt=""
          onError={(e) => { e.currentTarget.style.display = 'none' }}
        />
      )}
      <span>{display}</span>
    </span>
  )
}

/** Légende des 3 types de présence commerciale */
function CommercialLegend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3 text-xs text-slate-400">
      <span className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
        <strong className="text-slate-600">Ads</strong> — achète le mot-clé
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-sky-400 flex-shrink-0" />
        <strong className="text-slate-600">Hotels</strong> — bloc réservation Google
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-violet-400 flex-shrink-0" />
        <strong className="text-slate-600">OTA</strong> — mis en avant par Google
      </span>
    </div>
  )
}

/** Une ligne par requête : label + pills des acteurs présents */
function PresenceRow({ presence, label }: { presence: SerpCommercialPresence; label: string }) {
  const hasAny = presence.paidAds.length > 0 || presence.hotelsPack.length > 0 || presence.compareSites.length > 0
  if (!hasAny) return null
  return (
    <div className="flex items-start gap-3 py-2 border-t border-slate-50 first:border-0">
      <span className="text-xs text-slate-400 flex-shrink-0 w-36 truncate pt-1">{label}</span>
      <div className="flex flex-wrap gap-1.5 flex-1">
        {presence.paidAds.map((ad, i) => (
          <DomainPill key={`p-${i}`} domain={ad.domain} title={ad.title} type="paid" />
        ))}
        {presence.hotelsPack.map((h, i) => (
          <DomainPill key={`h-${i}`} domain={h.domain} title={h.title} type="hotels" />
        ))}
        {presence.compareSites.map((s, i) => (
          <DomainPill key={`c-${i}`} domain={s.domain} title={s.title} type="compare" />
        ))}
      </div>
    </div>
  )
}

function CommercialPresenceBlock({ paidAdsByQuery }: { paidAdsByQuery: PaidAdByQuery[] }) {
  const queriesWithData = paidAdsByQuery.filter((q) => {
    const p = q.presence
    return p.paidAds.length > 0 || p.hotelsPack.length > 0 || p.compareSites.length > 0
  })

  return (
    <div className="mt-3">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">
        Présence commerciale dans le SERP
      </p>
      {queriesWithData.length === 0 ? (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-500">
          <span>✗</span>
          <span>Aucun bloc commercial détecté sur ces requêtes.</span>
        </div>
      ) : (
        <div className="rounded-lg border border-slate-100 px-3 py-2">
          <CommercialLegend />
          <div>
            {queriesWithData.map((q) => (
              <PresenceRow key={q.queryId} presence={q.presence} label={q.queryLabel} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function SubSection({
  data,
  referenceDomain,
  icon,
  title,
}: {
  data: CommercialSectionData
  referenceDomain: string
  icon: string
  title: string
}) {
  return (
    <div className="border border-slate-100 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-700">
          {icon} {title}
        </h3>
        <span className="text-xs text-slate-400">{data.totalUniqueDomainsFound} domaines · {data.queries.length} requêtes — cliquer une ligne pour le détail</span>
      </div>

      {/* SERP consolidée — requêtes visibles dans le détail de chaque ligne */}
      <div className="mb-4">
        <ConsolidatedSerpTable data={data} section={data.section} referenceDomainRank={data.referenceDomainRank} />
      </div>

      {/* Présence commerciale (paid / hotels_pack / compare_sites) par requête */}
      <CommercialPresenceBlock paidAdsByQuery={data.paidAdsByQuery} />

      {/* PAA */}
      <div className="mt-3">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
          Questions des internautes (PAA)
        </p>
        <PaaAccordion paaByQuery={data.paaByQuery} referenceDomain={referenceDomain} />
      </div>
    </div>
  )
}

export default function SectionCommercial({
  hebergementData,
  activitesData,
  score,
  type,
  keyword,
  referenceDomain,
}: Props) {
  const subtitle =
    type === 'destination'
      ? 'Résistance aux OTA'
      : 'Résistance aux agrégateurs'

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-slate-800">Qui capte vos visiteurs avant vous ?</h2>
          <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
        </div>
        <span className="flex-shrink-0 ml-3 px-2 py-0.5 bg-slate-100 text-slate-600 text-xs font-semibold rounded-full">
          {score}/25
        </span>
      </div>

      <div className="space-y-4">
        <SubSection
          data={hebergementData}
          referenceDomain={referenceDomain}
          icon="🏨"
          title="Hébergement"
        />
        <SubSection
          data={activitesData}
          referenceDomain={referenceDomain}
          icon="🎯"
          title="Activités"
        />
      </div>
    </div>
  )
}
