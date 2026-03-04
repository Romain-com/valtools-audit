// Calcul du score d'autorité d'un site dans l'écosystème digital d'une destination

/**
 * Calcule un score d'autorité (0-100) en combinant position SERP et trafic Haloscan.
 * - Position : 60% du score (1er = 100, chaque rang supplémentaire = -10)
 * - Trafic : 40% du score (échelle logarithmique)
 */
export function computeAuthorityScore(
  serpPosition: number | null,
  totalTraffic: number | null
): number {
  const scorePosition = serpPosition !== null
    ? Math.max(0, 100 - (serpPosition - 1) * 10)
    : 0;

  const scoreTraffic = totalTraffic !== null && totalTraffic > 0
    ? Math.min(100, Math.log10(totalTraffic + 1) * 25)
    : 0;

  return Math.round((scorePosition * 0.6) + (scoreTraffic * 0.4));
}
