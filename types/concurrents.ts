// Types — Bloc 7 : Concurrents
// Identification de 5 destinations concurrentes + collecte de métriques comparatives

// ─── Contexte transmis à OpenAI pour l'identification ────────────────────────

export interface ContexteAuditPourConcurrents {
  destination: string
  code_departement: string
  population: number

  // Bloc 1 — Positionnement & notoriété
  positionnement: {
    type_destination: string        // ex: "ville lacustre de montagne"
    hashtag_volume: number          // postsCount Instagram
    note_google_destination: number
    note_google_ot: number
  }

  // Bloc 2 — Volume d'affaires
  volume_affaires: {
    montant_ts: number              // taxe de séjour en €
    nuitees_estimees: number
    type_collecteur: string
  }

  // Bloc 3 — Schéma digital
  schema_digital: {
    domaine_ot: string
    score_visibilite_ot: number     // 0-5
    total_keywords: number
    total_traffic: number
  }

  // Bloc 4 — Visibilité SEO
  visibilite_seo: {
    volume_marche_seeds: number
    volume_transactionnel_gap: number
    score_gap: number               // 0-10
    top_3_keywords: string[]        // les 3 keywords à plus fort volume marché
  }

  // Bloc 5 — Stocks physiques
  stocks_physiques: {
    total_hebergements: number
    total_activites: number
    ratio_particuliers: number      // % meublés particuliers
  }

  // Bloc 6 — Stock commercialisé en ligne
  stock_en_ligne: {
    total_airbnb: number
    total_booking: number
    taux_dependance_ota: number
    taux_reservable_direct: number
  }
}

// ─── Concurrent identifié par OpenAI ─────────────────────────────────────────

export interface ConcurrentIdentifie {
  nom: string
  code_insee: string              // peut être approximatif — utiliser uniquement pour info
  departement: string
  type_destination: string
  raison_selection: string        // 1 phrase expliquant pourquoi ce concurrent
  domaine_ot: string              // domaine estimé par OpenAI
  confiance_domaine: 'certain' | 'incertain'
  domaine_valide: string          // après validation SERP si incertain, = domaine_ot si certain
}

// ─── Concurrent Haloscan siteCompetitors ──────────────────────────────────────

export interface SiteCompetitorHaloscan {
  root_domain: string
  common_keywords: number       // keywords en commun avec la destination
  total_traffic: number         // trafic estimé du concurrent
  keywords_vs_max: number       // score similarité SEO (0-1)
  exclusive_keywords: number    // keywords où le concurrent est seul
  missed_keywords: number       // keywords du concurrent absents de la destination ← gap potentiel
  bested: number                // keywords où la destination est devant le concurrent
  keywords: number              // total keywords du concurrent
}

// ─── Source SEO — union discriminante ─────────────────────────────────────────

export type SourceSEO =
  | 'haloscan'             // Haloscan domains/overview (étapes 1-2)
  | 'haloscan_positions'   // Haloscan domains/positions (étape 3)
  | 'haloscan_competitors' // données issues de siteCompetitors (fallback enrichissement)
  | 'dataforseo_ranked'    // DataForSEO ranked_keywords (étapes 4-5)
  | 'inconnu'              // toutes sources épuisées → site_non_indexe: true

// ─── Métriques collectées par concurrent ─────────────────────────────────────

export interface MetriquesConcurrent {
  total_keywords: number
  total_traffic: number
  source_seo: SourceSEO
  site_non_indexe: boolean       // true uniquement si toutes les 5 sources retournent 0
  note_google: number | null
  nb_avis_google: number | null
  position_serp_requete_principale: number | null  // depuis le cache SERP Bloc 3 si disponible
}

// ─── Coûts du bloc (agrégés Phases A + B) ────────────────────────────────────

export interface CoutsBlocConcurrents {
  openai_identification: number
  haloscan: number                  // appels domains/overview (étapes 1-2)
  haloscan_positions: number        // appels domains/positions (étape 3 fallback)
  haloscan_competitors: number      // appel siteCompetitors (parallèle identification)
  dataforseo_ranked: number         // appels ranked_keywords (étapes 4-5 fallback)
  dataforseo_maps: number
  dataforseo_serp_validation: number
  openai_synthese: number
  total_bloc: number
}

// ─── Résultat Phase A ─────────────────────────────────────────────────────────

export interface ResultatPhaseAConcurrents {
  concurrents: Array<
    ConcurrentIdentifie & {
      metriques: MetriquesConcurrent
      haloscan_match?: SiteCompetitorHaloscan  // correspondance siteCompetitors si trouvée
    }
  >
  haloscan_suggestions: SiteCompetitorHaloscan[]  // concurrents SEO non proposés par OpenAI
  analyse_paysage: string
  statut: 'en_attente_validation'
  couts: {
    openai_identification: number
    haloscan: number
    haloscan_positions: number
    haloscan_competitors: number
    dataforseo_ranked: number
    dataforseo_maps: number
    dataforseo_serp_validation: number
  }
}

// ─── Tableau comparatif (Phase B) ────────────────────────────────────────────

export interface TableauComparatif {
  destination_cible: {
    nom: string
    total_keywords: number
    total_traffic: number
    note_google: number
    nb_avis_google: number
    score_visibilite_ot: number     // depuis Bloc 3
    taux_dependance_ota: number     // depuis Bloc 6
    nuitees_estimees: number        // depuis Bloc 2
  }
  concurrents: Array<{
    nom: string
    total_keywords: number
    total_traffic: number
    note_google: number | null
    nb_avis_google: number | null
    position_serp_requete_principale: number | null
  }>
}

// ─── Synthèse comparative ─────────────────────────────────────────────────────

export interface SyntheseConcurrents {
  position_globale: 'leader' | 'dans_la_moyenne' | 'en_retard'
  resume: string
  points_forts: Array<{ critere: string; valeur: string; benchmark: string }>
  points_faibles: Array<{ critere: string; valeur: string; benchmark: string }>
  opportunite_cle: string
  message_ot: string
}

// ─── Résultat final du bloc ───────────────────────────────────────────────────

export interface ResultatBlocConcurrents {
  phase_a: ResultatPhaseAConcurrents
  concurrents_valides: ConcurrentIdentifie[]  // après validation utilisateur
  tableau_comparatif: TableauComparatif
  synthese: SyntheseConcurrents
  statut: 'en_attente_validation' | 'termine'
  couts: CoutsBlocConcurrents
}

// ─── Paramètres d'entrée ──────────────────────────────────────────────────────

export interface ParamsBlocConcurrents {
  destination: string
  audit_id: string
  contexte: ContexteAuditPourConcurrents
  domaine_ot: string  // domaine de la destination cible — pour l'appel siteCompetitors Haloscan
  // Métriques de la destination cible (issue des blocs précédents) pour le tableau comparatif
  metriques_destination: {
    total_keywords: number
    total_traffic: number
    note_google: number
    nb_avis_google: number
    score_visibilite_ot: number
    taux_dependance_ota: number
    nuitees_estimees: number
  }
  // Cache SERP du Bloc 3 — évite des appels supplémentaires pour la position concurrents
  serp_cache?: Array<{ domaine: string; position: number }>
}

export interface ParamsPhaseB {
  audit_id: string
  destination: string
  phase_a: ResultatPhaseAConcurrents
  concurrents_valides: ConcurrentIdentifie[]
  metriques_destination: {
    total_keywords: number
    total_traffic: number
    note_google: number
    nb_avis_google: number
    score_visibilite_ot: number
    taux_dependance_ota: number
    nuitees_estimees: number
  }
}
