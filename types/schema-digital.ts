// Types TypeScript — Bloc 3 : Schéma digital & Santé technique

// ─── SERP ────────────────────────────────────────────────────────────────────

// Catégorie d'un résultat Google identifiée par OpenAI
export type CategorieResultatSERP =
  | 'officiel_ot'      // Site de l'office de tourisme de la destination
  | 'officiel_mairie'  // Site de la mairie ou de la collectivité territoriale
  | 'officiel_autre'   // CDT, région, autre institutionnel lié à la destination
  | 'ota'              // Plateformes de réservation (Booking, TripAdvisor, Airbnb, Expedia...)
  | 'media'            // Presse, blogs, guides touristiques
  | 'autre'

// Résultat SERP brut enrichi avec sa catégorie
export interface ResultatSERP {
  position: number
  url: string
  domaine: string
  titre: string
  meta_description: string
  categorie: CategorieResultatSERP
  requete_source: string  // "destination", "tourisme", "hebergement", "que_faire", "restaurant"
}

// ─── Sites officiels ─────────────────────────────────────────────────────────

// Site officiel identifié parmi les résultats SERP
export interface SiteOfficiel {
  domaine: string
  categorie: CategorieResultatSERP
  titre: string
  meta_description: string
  position_serp: number
}

// ─── Visibilité par intention ─────────────────────────────────────────────────

// Présence d'un site officiel pour une intention de recherche donnée
export interface VisibiliteParIntention {
  position: number | null      // Position du premier site officiel_ dans la requête (null si absent du top 3)
  categorie_pos1: CategorieResultatSERP  // Catégorie du site réellement en position 1
}

// ─── Haloscan ─────────────────────────────────────────────────────────────────

// Métriques SEO d'un domaine issues de Haloscan (ou fallback DataForSEO)
export interface ResultatHaloscan {
  domaine: string
  total_keywords: number
  total_traffic: number
  top_3_positions: number
  top_10_positions: number
  visibility_index: number
  traffic_value: number
  site_non_indexe: boolean  // true si aucune source n'a retourné de données
  source: 'haloscan' | 'dataforseo' | 'inconnu'  // fournisseur effectif des données
}

// ─── PageSpeed ────────────────────────────────────────────────────────────────

// Métriques Core Web Vitals d'un domaine
export interface ResultatPageSpeed {
  domaine: string
  mobile: {
    score: number   // 0-100
    lcp: number     // en secondes
    cls: number     // score numérique
    inp: number     // en ms
  } | null
  desktop: {
    score: number
    lcp: number
    cls: number
    inp: number
  } | null
  erreur?: string   // message d'erreur si l'appel échoue
}

// ─── Analyse site OT ──────────────────────────────────────────────────────────

// Analyse des fonctionnalités et de la maturité digitale du site OT
export interface AnalyseSiteOT {
  fonctionnalites_detectees: {
    moteur_reservation: boolean | 'incertain'
    blog_actualites: boolean | 'incertain'
    newsletter: boolean | 'incertain'
    agenda_evenements: boolean | 'incertain'
    carte_interactive: boolean | 'incertain'
    application_mobile: boolean | 'incertain'
  }
  niveau_maturite_digital: 'faible' | 'moyen' | 'avance'
  commentaire: string
}

// ─── Résultat agrégé du bloc ─────────────────────────────────────────────────

export interface ResultatSchemaDigital {
  serp_fusionne: ResultatSERP[]                              // Résultats dédupliqués de toutes les requêtes
  top3_officiels: SiteOfficiel[]                             // Les 3 premiers sites officiels classés
  domaine_ot_detecte: string | null                          // Premier site officiel_ot trouvé
  haloscan: ResultatHaloscan[]                               // 3 résultats max
  pagespeed: ResultatPageSpeed[]                             // 3 résultats max
  analyse_site_ot: AnalyseSiteOT | null                      // null si aucun domaine OT détecté
  visibilite_ot_par_intention: Record<string, VisibiliteParIntention>  // par clé de requête
  score_visibilite_ot: number                                // 0-5 : nb d'intentions avec officiel_ en pos.1
  openai: {
    synthese_schema: string             // 80-100 mots pour GDoc
    indicateurs_cles: string[]          // 3 chiffres ou constats clés
    points_attention: string[]          // 2-3 points d'amélioration
  }
  meta: {
    nb_sites_officiels_top10: number
    nb_ota_top10: number
    domaine_ot_source: 'auto' | 'manuel'
    cout_total_euros: number
  }
}
