// Route Handler — SERPs commerciales (hébergement ou activités)
// Lance toutes les requêtes en parallèle, consolide par domaine racine

import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import type { CommercialQuery } from '@/lib/commercial-queries'
import type {
  NormalizedResult,
  ConsolidatedDomain,
  PaaByQuery,
  PaaQuestion,
  CommercialSectionData,
  PaidAd,
  HotelsPackItem,
  CompareSiteItem,
  SerpCommercialPresence,
  PaidAdByQuery,
} from '@/types/visibility'

const DATAFORSEO_LOGIN = process.env.DATAFORSEO_LOGIN!
const DATAFORSEO_PASSWORD = process.env.DATAFORSEO_PASSWORD!

function getAuth(): string {
  return Buffer.from(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`).toString('base64')
}

/** Extrait le domaine racine (ex: booking.com depuis fr.booking.com) */
function extractRootDomain(url: string): string {
  try {
    const hostname = new URL(url).hostname
    const parts = hostname.replace('www.', '').split('.')
    return parts.slice(-2).join('.')
  } catch {
    return url
  }
}

/** Extrait les PAA d'une liste d'items DataForSEO */
function extractPaa(items: unknown[]): PaaQuestion[] {
  const paaItems = items.filter((i: unknown) => (i as { type: string }).type === 'people_also_ask')
  return paaItems.map((item: unknown) => {
    const paaItem = item as {
      title?: string
      items?: { expanded_element?: { answer?: string; url?: string; domain?: string }[] }[]
    }
    const expanded = paaItem.items?.[0]?.expanded_element?.[0]
    return {
      question: paaItem.title ?? '',
      answer: expanded?.answer ?? null,
      sourceUrl: expanded?.url ?? null,
      sourceDomain: expanded?.domain ?? null,
    }
  })
}

export async function POST(req: NextRequest) {
  try {
    const {
      queries,
      referenceDomain,
      section,
    }: {
      queries: CommercialQuery[]
      referenceDomain: string
      section: 'hebergement' | 'activites'
    } = await req.json()

    if (!queries?.length || !referenceDomain?.trim()) {
      return NextResponse.json({ error: 'queries et referenceDomain sont requis' }, { status: 400 })
    }

    const cleanDomain = referenceDomain.replace('www.', '')

    // Lancement de tous les appels DataForSEO en parallèle
    // Les items paid sont inclus dans la réponse organique quand des annonces existent
    const serpResults = await Promise.all(
      queries.map(async (query) => {
        try {
          const res = await axios.post(
            'https://api.dataforseo.com/v3/serp/google/organic/live/advanced',
            [{ keyword: query.keyword, language_code: 'fr', location_code: 2250, depth: 10, people_also_ask_click_depth: 1 }],
            { headers: { Authorization: `Basic ${getAuth()}`, 'Content-Type': 'application/json' }, timeout: 60_000 }
          )
          return res.data?.tasks?.[0]?.result?.[0]?.items ?? []
        } catch {
          return []
        }
      })
    )

    // Étape 1 — Normaliser chaque résultat organique
    const allNormalized: NormalizedResult[] = []
    const paaByQuery: PaaByQuery[] = []
    const paidAdsByQuery: PaidAdByQuery[] = []

    for (let i = 0; i < queries.length; i++) {
      const query = queries[i]
      const items: unknown[] = serpResults[i]

      // Paid ads
      const paidAds: PaidAd[] = items
        .filter((it: unknown) => (it as { type: string }).type === 'paid')
        .map((it: unknown) => {
          const item = it as { domain?: string; url?: string; title?: string; description?: string; rank_absolute?: number }
          const rootDomain = extractRootDomain(item.url ?? item.domain ?? '')
          return {
            domain: rootDomain,
            url: item.url ?? '',
            title: item.title ?? '',
            description: item.description ?? '',
            position: item.rank_absolute ?? 0,
            isReferenceDomain: rootDomain.includes(cleanDomain) || cleanDomain.includes(rootDomain),
          }
        })

      // Hotels Pack
      const hotelsPackBlock = items.find((it: unknown) => (it as { type: string }).type === 'hotels_pack') as {
        items?: { title?: string; price?: { displayed_price?: string }; domain?: string | null; url?: string | null; is_paid?: boolean; rating?: { value?: number } | null }[]
      } | undefined
      const hotelsPack: HotelsPackItem[] = (hotelsPackBlock?.items ?? []).map((el) => ({
        title: el.title ?? '',
        displayedPrice: el.price?.displayed_price ?? null,
        domain: el.domain ?? null,
        url: el.url ?? null,
        isPaid: el.is_paid ?? false,
        rating: el.rating?.value ?? null,
      }))

      // Compare Sites
      const compareSitesBlock = items.find((it: unknown) => (it as { type: string }).type === 'compare_sites') as {
        items?: { title?: string; url?: string; domain?: string; source?: string | null }[]
      } | undefined
      const compareSites: CompareSiteItem[] = (compareSitesBlock?.items ?? [])
        .filter((el) => el.url && el.domain)
        .map((el) => ({
          title: el.title ?? '',
          url: el.url ?? '',
          domain: el.domain ?? '',
          source: el.source ?? null,
        }))

      const presence: SerpCommercialPresence = { paidAds, hotelsPack, compareSites }
      paidAdsByQuery.push({ queryId: query.id, queryLabel: query.label, queryKeyword: query.keyword, presence })

      const organics = items.filter((it: unknown) => (it as { type: string }).type === 'organic')
      for (const it of organics) {
        const item = it as {
          domain?: string
          url?: string
          title?: string
          description?: string
          rank_absolute?: number
        }
        const rootDomain = extractRootDomain(item.url ?? item.domain ?? '')
        allNormalized.push({
          serpId: query.id,
          serpLabel: query.label,
          position: item.rank_absolute ?? 0,
          url: item.url ?? '',
          title: item.title ?? '',
          description: item.description ?? '',
          rootDomain,
          isReferenceDomain: rootDomain.includes(cleanDomain) || cleanDomain.includes(rootDomain),
        })
      }

      paaByQuery.push({
        queryId: query.id,
        queryLabel: query.label,
        queryKeyword: query.keyword,
        questions: extractPaa(items),
      })
    }

    // Étape 2 — Consolider par domaine racine
    const domainMap = new Map<string, ConsolidatedDomain>()

    for (const result of allNormalized) {
      if (!domainMap.has(result.rootDomain)) {
        domainMap.set(result.rootDomain, {
          rootDomain: result.rootDomain,
          appearances: [],
          avgPosition: 0,
          effectiveScore: 0,
          frequency: 0,
          frequencyRatio: 0,
          bestPosition: 999,
          isReferenceDomain: result.isReferenceDomain,
          domainType: null,
        })
      }
      const entry = domainMap.get(result.rootDomain)!
      entry.appearances.push({
        serpId: result.serpId,
        serpLabel: result.serpLabel,
        position: result.position,
        url: result.url,
        title: result.title,
      })
      if (result.isReferenceDomain) entry.isReferenceDomain = true
    }

    // Calcul des métriques
    // avgPosition = moyenne des meilleures positions PAR SERP (pas toutes les apparitions)
    // effectiveScore = avgPosition / frequencyRatio — pénalise les domaines absents sur beaucoup de requêtes
    const totalSerps = queries.length
    for (const domain of domainMap.values()) {
      const allPositions = domain.appearances.map((a) => a.position)
      const distinctSerps = new Set(domain.appearances.map((a) => a.serpId)).size

      // Meilleure position par SERP distincte
      const bestPerSerp = new Map<string, number>()
      for (const a of domain.appearances) {
        const current = bestPerSerp.get(a.serpId)
        if (current === undefined || a.position < current) bestPerSerp.set(a.serpId, a.position)
      }
      const bestPositions = Array.from(bestPerSerp.values())

      domain.avgPosition = bestPositions.reduce((s, p) => s + p, 0) / bestPositions.length
      domain.frequency = distinctSerps
      domain.frequencyRatio = distinctSerps / totalSerps
      domain.bestPosition = Math.min(...allPositions)
      domain.effectiveScore = domain.avgPosition / domain.frequencyRatio
    }

    // Étape 3 — Trier par score effectif (avgPosition / fréquence)
    const consolidatedSerp: ConsolidatedDomain[] = Array.from(domainMap.values()).sort(
      (a, b) => a.effectiveScore - b.effectiveScore
    )

    // Rang du domaine de référence
    const refIndex = consolidatedSerp.findIndex((d) => d.isReferenceDomain)
    const referenceDomainRank = refIndex === -1 ? null : refIndex + 1

    // Étape 4 — Volumes de recherche pour chaque requête via Google Ads (fallback silencieux)
    // Endpoint keywords_data/google_ads/search_volume/live : accepte un tableau de keywords par tâche
    const queryVolumes: Record<string, number> = {}
    try {
      const keywords = queries.map((q) => q.keyword)
      const volRes = await axios.post(
        'https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live',
        [{ keywords, language_code: 'fr', location_code: 2250 }],
        {
          headers: { Authorization: `Basic ${getAuth()}`, 'Content-Type': 'application/json' },
          timeout: 30_000,
        }
      )
      const volItems: unknown[] = volRes.data?.tasks?.[0]?.result ?? []
      for (const item of volItems) {
        const it = item as { keyword?: string; search_volume?: number }
        if (it.keyword && it.search_volume != null) {
          queryVolumes[it.keyword] = it.search_volume
        }
      }
    } catch {
      // Volume non disponible — la UI affichera simplement rien
    }

    const data: CommercialSectionData = {
      section,
      queries: queries.map((q) => ({
        id: q.id,
        label: q.label,
        keyword: q.keyword,
        searchVolume: queryVolumes[q.keyword],
      })),
      consolidatedSerp,
      paaByQuery,
      paidAdsByQuery,
      totalUniqueDomainsFound: consolidatedSerp.length,
      referenceDomainRank,
    }

    return NextResponse.json({ data })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    console.error('[visibility/serp-commercial]', message)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
