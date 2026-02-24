// Tarifs unitaires des APIs — source de vérité unique
// Toutes les valeurs sont en euros par appel/run

export const API_COSTS = {
  dataforseo_maps: 0.006,       // par appel Maps live/advanced
  dataforseo_serp: 0.006,       // par appel SERP organique
  dataforseo_domain: 0.006,     // par appel domain_rank_overview/live (fallback Haloscan)
  apify_hashtag_stats: 0.05,    // par run instagram-hashtag-stats
  apify_hashtag_scraper: 0.05,  // par run instagram-hashtag-scraper
  openai_gpt4o_mini: 0.001,     // par appel gpt-4o-mini (estimation)
  haloscan: 0.01,               // par appel (1 crédit)
  pagespeed: 0,                 // gratuit (API Google)
  monitorank: 0,                // inclus dans le forfait
  data_economie: 0,             // API publique gratuite
} as const
