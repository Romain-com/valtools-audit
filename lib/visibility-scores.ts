// Calcul des 4 scores de visibilité digitale
// Chaque score est sur 25 points, total sur 100

import type {
  SerpOrganic,
  PaaQuestion,
  KnowledgeGraph,
  LocalPack,
  CommercialSectionData,
  RelatedKeyword,
  RankedKeyword,
  VisibilityScores,
  VisibilityData,
} from '@/types/visibility'

/** Score 1 — Présence nominale (/25) */
export function scoreNominal(
  serpMain: SerpOrganic[],
  knowledgeGraph: KnowledgeGraph,
  localPack: LocalPack
): number {
  const otPosition = serpMain.find((s) => s.isReferenceDomain)?.position ?? null

  const posScore =
    otPosition === null ? 0
    : otPosition === 1 ? 15
    : otPosition <= 3 ? 12
    : otPosition <= 5 ? 8
    : otPosition <= 10 ? 4
    : 0

  const kgScore = knowledgeGraph.exists ? 5 : 0
  const localScore = localPack.exists ? 5 : 0

  return Math.min(25, posScore + kgScore + localScore)
}

/** Score 2 — Résistance aux intermédiaires (/25) */
export function scoreCommercial(
  hebergementData: CommercialSectionData,
  activitesData: CommercialSectionData
): number {
  // Hébergement : 12 points max
  const hebergScore =
    hebergementData.referenceDomainRank !== null
      ? Math.max(0, 12 - (hebergementData.referenceDomainRank - 1) * 2)
      : 0

  // Activités : 13 points max
  const activitesScore =
    activitesData.referenceDomainRank !== null
      ? Math.max(0, 13 - (activitesData.referenceDomainRank - 1) * 3)
      : 0

  // Pression commerciale OTA : pénalité légère (max -3 pts) proportionnelle
  // au nombre de requêtes où des OTA achètent des mots-clés (paid/hotels_pack/compare_sites)
  const allQueries = [...hebergementData.paidAdsByQuery, ...activitesData.paidAdsByQuery]
  const queriesWithOtaPressure = allQueries.filter((q) => {
    const p = q.presence
    return p.paidAds.length > 0 || p.hotelsPack.length > 0 || p.compareSites.length > 0
  }).length
  const pressurePenalty = allQueries.length > 0
    ? Math.round((queriesWithOtaPressure / allQueries.length) * 3)
    : 0

  return Math.max(0, Math.min(25, hebergScore + activitesScore - pressurePenalty))
}

/** Score 3 — Couverture sémantique (/25) */
export function scoreSemantic(
  relatedKeywords: RelatedKeyword[],
  rankedKeywords: RankedKeyword[]
): number {
  if (relatedKeywords.length === 0) return 0
  const rankedSet = new Set(rankedKeywords.map((r) => r.keyword.toLowerCase()))
  const covered = relatedKeywords.filter((rk) => rankedSet.has(rk.keyword.toLowerCase())).length
  return Math.round((covered / relatedKeywords.length) * 25)
}

/** Score 4 — Autorité de contenu (/25) */
export function scoreContent(
  paaMain: PaaQuestion[],
  serpMain: SerpOrganic[],
  referenceDomain: string
): number {
  const cleanDomain = referenceDomain.replace('www.', '')

  // PAA (max 15 pts) : neutre si Google ne génère aucune PAA, sinon 5 pts par réponse sourcée
  let paaScore: number
  if (paaMain.length === 0) {
    paaScore = 5 // pas de PAA dans ce SERP — ni bonus ni malus
  } else {
    const paaPresence = paaMain.filter((q) => q.sourceDomain?.includes(cleanDomain)).length
    paaScore = Math.min(15, paaPresence * 5)
  }

  // Featured Snippet (max 10 pts) : position 0 avec le domaine de référence
  const hasFeaturedSnippet = serpMain.some((s) => s.isReferenceDomain && s.position === 0)
  const snippetScore = hasFeaturedSnippet ? 10 : 0

  // Knowledge Graph volontairement exclu ici — déjà pris en compte dans scoreNominal

  return Math.min(25, paaScore + snippetScore)
}

/** Calcul du score global */
export function computeVisibilityScores(
  data: Omit<VisibilityData, 'scores' | 'headline' | 'insights'>
): VisibilityScores {
  const nominal = scoreNominal(data.serpMain, data.knowledgeGraph, data.localPack)
  const commercial = scoreCommercial(data.hebergementData, data.activitesData)
  const semantic = scoreSemantic(data.relatedKeywords, data.rankedKeywords)
  const content = scoreContent(data.paaMain, data.serpMain, data.params.domain)

  return { nominal, commercial, semantic, content, total: nominal + commercial + semantic + content }
}
