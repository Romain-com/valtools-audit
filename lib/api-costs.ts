// Tarifs unitaires des APIs — source de vérité unique
// Toutes les valeurs sont en euros par appel/run

export const API_COSTS = {
  dataforseo_maps: 0.006,       // par appel Maps live/advanced
  dataforseo_serp: 0.006,       // par appel SERP organique
  dataforseo_domain: 0.006,     // par appel domain_rank_overview/live (fallback Haloscan)
  dataforseo_related: 0.006,    // par seed related_keywords/live (4 seeds = 0.024€ en Phase A)
  dataforseo_ranked: 0.006,     // par appel ranked_keywords/live (Bloc 4)
  apify_hashtag_stats: 0.05,    // par run instagram-hashtag-stats
  apify_hashtag_scraper: 0.05,  // par run instagram-hashtag-scraper
  openai_gpt4o_mini: 0.001,     // par appel gpt-4o-mini (estimation)
  haloscan: 0.01,               // par appel domains/overview (1 crédit)
  haloscan_keywords: 0.01,      // par appel keywords/overview (1 crédit)
  pagespeed: 0,                 // gratuit (API Google)
  monitorank: 0,                // inclus dans le forfait
  data_economie: 0,             // API publique gratuite
  sirene: 0,                    // API publique gratuite (INSEE open data)
  datatourisme_stocks: 0,       // microservice local — gratuit
  melodi_rp: 0,                 // API Mélodi INSEE RP — open data, gratuit
  melodi_bpe: 0,                // API Mélodi INSEE BPE — open data, gratuit
  airbnb_scraping: 0,           // scraping Playwright local — gratuit (risque CGU)
  booking_scraping: 0,          // scraping Playwright local — gratuit (risque CGU)
  viator_scraping: 0,           // scraping Playwright local — gratuit (risque CGU)
} as const
