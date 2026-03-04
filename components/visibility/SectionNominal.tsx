// Section Présence nominale — SERP principal + PAA + Knowledge Graph + Local Pack + GMB

import type { SerpOrganic, PaaQuestion, KnowledgeGraph, GoogleReviews, PaidAd, HotelsPackItem, CompareSiteItem, VisibilityContext } from '@/types/visibility'

interface Props {
  serpMain: SerpOrganic[]
  paaMain: PaaQuestion[]
  knowledgeGraph: KnowledgeGraph
  googleReviews: GoogleReviews
  paidAdsMain: PaidAd[]
  hotelsPackMain: HotelsPackItem[]
  compareSitesMain: CompareSiteItem[]
  score: number
  type: VisibilityContext
  keyword: string
  domain: string
}

function StarRating({ rating }: { rating: number }) {
  const full = Math.floor(rating)
  const half = rating - full >= 0.5
  return (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <svg
          key={i}
          className={`w-3.5 h-3.5 ${i < full ? 'text-amber-400' : i === full && half ? 'text-amber-300' : 'text-slate-200'}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </span>
  )
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

export default function SectionNominal({ serpMain, paaMain, knowledgeGraph, googleReviews, paidAdsMain, hotelsPackMain, compareSitesMain, score, type, keyword, domain }: Props) {
  const title =
    type === 'destination'
      ? 'Qui est visible quand on cherche votre destination ?'
      : 'Qui est visible quand on cherche ce lieu ?'

  const cleanDomain = domain.replace('www.', '')

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-6">
      <div className="flex items-start justify-between">
        <h2 className="text-base font-semibold text-slate-800">{title}</h2>
        <span className="flex-shrink-0 ml-3 px-2 py-0.5 bg-slate-100 text-slate-600 text-xs font-semibold rounded-full">
          {score}/25
        </span>
      </div>

      {/* Résultats organiques — numérotation séquentielle 1 à 10 */}
      <div>
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
          Top Google pour &quot;{keyword}&quot;
        </p>
        {serpMain.length === 0 ? (
          <p className="text-sm text-slate-400">Aucun résultat trouvé.</p>
        ) : (
          <ul className="divide-y divide-slate-50">
            {serpMain.slice(0, 10).map((result, i) => (
              <li
                key={i}
                className={`py-2 ${result.isReferenceDomain ? 'bg-blue-50 -mx-2 px-2 rounded' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <span className={`text-xs font-semibold w-5 flex-shrink-0 mt-0.5 text-right ${result.isReferenceDomain ? 'text-blue-600' : 'text-slate-400'}`}>
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <a
                      href={result.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`text-sm font-medium hover:underline line-clamp-1 ${
                        result.isReferenceDomain ? 'text-blue-700' : 'text-slate-700'
                      }`}
                    >
                      {result.title}
                    </a>
                    <p className="text-xs text-slate-400 truncate">{result.domain}</p>
                  </div>
                  {result.isReferenceDomain && (
                    <span className="ml-auto flex-shrink-0 text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded font-medium">
                      vous
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Questions des internautes (PAA) — SERP principal */}
      {paaMain.length > 0 && (
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
            Quelles sont les questions liées à votre destination ?
          </p>
          <ul className="space-y-2">
            {paaMain.map((q, i) => (
              <li key={i} className="border border-slate-100 rounded-lg overflow-hidden">
                <div className="px-3 py-2 bg-slate-50">
                  <p className="text-xs font-medium text-slate-700">{q.question}</p>
                </div>
                {q.answer && (
                  <div className="px-3 py-2 text-xs text-slate-600">
                    <p className="line-clamp-2">{q.answer}</p>
                    {q.sourceDomain && (
                      <p className="mt-1 text-slate-400 truncate">Source : {q.sourceDomain}</p>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Knowledge Graph — carte visuelle */}
      {knowledgeGraph.exists ? (
        <div className="border border-green-200 bg-green-50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-xs font-semibold text-green-700 uppercase tracking-wide">Knowledge Graph</span>
          </div>
          {knowledgeGraph.title && (
            <p className="text-sm font-semibold text-slate-800 mb-1">{knowledgeGraph.title}</p>
          )}
          {knowledgeGraph.description && (
            <p className="text-xs text-slate-600 line-clamp-3 mb-3">{knowledgeGraph.description}</p>
          )}
          <div className="flex flex-wrap gap-2">
            <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${knowledgeGraph.hasPhone ? 'bg-green-100 text-green-700' : 'bg-white text-slate-400 border border-slate-200'}`}>
              {knowledgeGraph.hasPhone ? '✓' : '✗'} Téléphone
            </span>
            <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${knowledgeGraph.hasAddress ? 'bg-green-100 text-green-700' : 'bg-white text-slate-400 border border-slate-200'}`}>
              {knowledgeGraph.hasAddress ? '✓' : '✗'} Adresse
            </span>
            <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${knowledgeGraph.hasSocialProfiles ? 'bg-green-100 text-green-700' : 'bg-white text-slate-400 border border-slate-200'}`}>
              {knowledgeGraph.hasSocialProfiles ? '✓' : '✗'} Réseaux sociaux
            </span>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-500">
          <span>✗</span>
          <span>Pas de Knowledge Graph — la destination n&apos;a pas de fiche d&apos;entité Google.</span>
        </div>
      )}

      {/* Présence commerciale — pills compactes favicon + nom */}
      {(paidAdsMain.length > 0 || hotelsPackMain.length > 0 || compareSitesMain.length > 0) && (
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">
            Qui capte du trafic commercial sur ce mot-clé ?
          </p>
          <CommercialLegend />
          <div className="flex flex-wrap gap-2">
            {paidAdsMain.map((ad, i) => (
              <DomainPill key={`paid-${i}`} domain={ad.domain} title={ad.title} type="paid" />
            ))}
            {hotelsPackMain.map((h, i) => (
              <DomainPill key={`hotels-${i}`} domain={h.domain} title={h.title} type="hotels" />
            ))}
            {compareSitesMain.map((s, i) => (
              <DomainPill key={`compare-${i}`} domain={s.domain} title={s.title} type="compare" />
            ))}
          </div>
        </div>
      )}

      {/* &quot;Comment les gens vous notent ?&quot; — note Google (google_reviews SERP) */}
      {googleReviews.exists && googleReviews.rating !== null ? (
        <div className="border border-amber-200 bg-amber-50 rounded-xl p-4">
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-3">
            Comment les gens vous notent ?
          </p>
          <div className="flex items-center gap-4">
            <span className="text-4xl font-bold text-slate-800">{googleReviews.rating.toFixed(1)}</span>
            <div>
              <StarRating rating={googleReviews.rating} />
              {googleReviews.reviewCount && (
                <p className="text-xs text-slate-500 mt-1">
                  {googleReviews.reviewCount.toLocaleString('fr-FR')} avis Google
                </p>
              )}
              {googleReviews.title && (
                <p className="text-xs text-slate-400 mt-0.5">{googleReviews.title}</p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-500">
          <span>✗</span>
          <span>Pas de note Google visible sur ce mot-clé.</span>
        </div>
      )}
    </div>
  )
}
