// Types TypeScript — Vue Score de visibilité digitale
// Partagés entre les composants client et les routes API

export type VisibilityContext = 'destination' | 'place'

export interface VisibilityParams {
  type: VisibilityContext
  keyword: string
  domain: string
  commune?: string
  communeDomain?: string
}

// --- SERP principal ---

export interface SerpOrganic {
  domain: string
  url: string
  title: string
  description: string
  position: number
  isReferenceDomain: boolean
}

export interface PaaQuestion {
  question: string
  answer: string | null
  sourceUrl: string | null
  sourceDomain: string | null
}

export interface KnowledgeGraph {
  exists: boolean
  title: string | null
  description: string | null
  hasPhone: boolean
  hasAddress: boolean
  hasSocialProfiles: boolean
}

export interface LocalPack {
  exists: boolean
  entries: { name: string; domain: string | null; rating: number | null; reviewCount: number | null }[]
}

export interface GoogleReviews {
  exists: boolean
  rating: number | null
  reviewCount: number | null
  title: string | null
}

// --- Présence commerciale dans le SERP (paid, hotels_pack, compare_sites) ---

export interface PaidAd {
  domain: string
  url: string
  title: string
  description: string
  position: number
  isReferenceDomain: boolean
}

export interface HotelsPackItem {
  title: string
  displayedPrice: string | null
  domain: string | null
  url: string | null
  isPaid: boolean
  rating: number | null
}

export interface CompareSiteItem {
  title: string
  url: string
  domain: string
  source: string | null
}

export interface SerpCommercialPresence {
  paidAds: PaidAd[]
  hotelsPack: HotelsPackItem[]
  compareSites: CompareSiteItem[]
}

export interface PaidAdByQuery {
  queryId: string
  queryLabel: string
  queryKeyword: string
  presence: SerpCommercialPresence
}

// --- SERP commerciales consolidées ---

export interface NormalizedResult {
  serpId: string
  serpLabel: string
  position: number
  url: string
  title: string
  description: string
  rootDomain: string
  isReferenceDomain: boolean
}

export interface ConsolidatedDomain {
  rootDomain: string
  appearances: {
    serpId: string
    serpLabel: string
    position: number
    url: string
    title: string
  }[]
  avgPosition: number
  effectiveScore: number
  frequency: number
  frequencyRatio: number
  bestPosition: number
  isReferenceDomain: boolean
  domainType: 'OFFICIEL' | 'INTERMEDIAIRE' | 'MEDIA' | 'INFORMATION' | null
}

export interface PaaByQuery {
  queryId: string
  queryLabel: string
  queryKeyword: string
  questions: PaaQuestion[]
}

export interface CommercialSectionData {
  section: 'hebergement' | 'activites'
  queries: { id: string; label: string; keyword: string; searchVolume?: number }[]
  consolidatedSerp: ConsolidatedDomain[]
  paaByQuery: PaaByQuery[]
  totalUniqueDomainsFound: number
  referenceDomainRank: number | null
  paidAdsByQuery: PaidAdByQuery[]
}

// --- Sémantique ---

export interface RelatedKeyword {
  keyword: string
  searchVolume: number
  cpc: number | null
  competition: string | null
}

export interface RankedKeyword {
  keyword: string
  position: number
  searchVolume: number
  etv: number  // Estimated Traffic Value — calculé par DataForSEO (CTR × volume)
  url: string
}

// --- Score ---

export interface VisibilityScores {
  nominal: number
  commercial: number
  semantic: number
  content: number
  total: number
}

// --- Données globales ---

export interface VisibilityData {
  params: VisibilityParams
  serpMain: SerpOrganic[]
  paaMain: PaaQuestion[]
  knowledgeGraph: KnowledgeGraph
  localPack: LocalPack
  googleReviews: GoogleReviews
  hebergementData: CommercialSectionData
  activitesData: CommercialSectionData
  paidAdsMain: PaidAd[]
  hotelsPackMain: HotelsPackItem[]
  compareSitesMain: CompareSiteItem[]
  relatedKeywords: RelatedKeyword[]
  rankedKeywords: RankedKeyword[]
  scores: VisibilityScores
  headline: string
  insights: string[]
}
