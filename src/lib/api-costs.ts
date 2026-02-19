/**
 * Grille de coûts estimés par API (en euros)
 * Valeurs centralisées pour mise à jour facile
 */

export const API_COSTS = {
  openai: {
    // GPT-4o-mini tarifs par token
    promptTokenCost: 0.000003,
    completionTokenCost: 0.000015,
  },
  dataforseo: {
    serp: 0.002,
    maps: 0.001,
    reviews: 0.002,
    resultsCount: 0.001,
  },
  haloscan: {
    perKeyword: 0.001,
  },
  datatourisme: 0,
  pagespeed: 0,
  duckduckgo: 0,
  dgfip: 0,
  apify: {
    perRun: 0.01,
  },
  gemini: {
    // Fallback LLM - gratuit sur free tier, sinon ~0.00001/token
    promptTokenCost: 0.0000001,
    completionTokenCost: 0.0000004,
  },
  rapidapi_instagram: {
    perCall: 0.005,
  },
} as const;
