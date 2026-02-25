// Types — Bloc 4 : Visibilité SEO & Gap Transactionnel
// Responsabilité : interfaces TypeScript de toutes les données produites par le bloc

// ─── Catégorie de keyword ──────────────────────────────────────────────────────

export type CategorieKeyword =
  | 'activités'
  | 'hébergements'
  | 'services'
  | 'culture'
  | 'restauration'
  | 'transports'
  | 'hors-tourisme'

// ─── Keywords marché (source Haloscan keywords/overview) ──────────────────────

export interface KeywordMarche {
  keyword: string
  volume: number
  source: 'keyword_match' | 'similar_highlight' | 'related_question' | 'dataforseo_related'
  seed: string
  cpc?: number
  competition?: number
}

// ─── Keywords positionnés OT (source DataForSEO ranked_keywords) ─────────────

export interface KeywordPositionneOT {
  keyword: string
  volume: number
  position: number
  url_positionnee: string
  cpc?: number
}

// ─── Keyword classifié par OpenAI ────────────────────────────────────────────

export interface KeywordClassifie {
  keyword: string
  volume: number
  categorie: CategorieKeyword
  intent_transactionnel: boolean
  position_ot: number | null
  gap: boolean
  selectionne_phase_b?: boolean
}

// ─── Résultat SERP live Phase B ──────────────────────────────────────────────

export interface ResultatSERPTransac {
  keyword: string
  position_ot: number | null
  url_ot: string | null
  concurrent_pos1: string | null
  concurrent_pos1_url: string | null
}

// ─── Opportunité concrète ─────────────────────────────────────────────────────

export interface Opportunite {
  keyword: string
  volume: number
  categorie: CategorieKeyword
  position_ot: number | null
  concurrent_pos1: string | null
  gain_potentiel_trafic: number
}

// ─── Coûts du Bloc 4 ──────────────────────────────────────────────────────────

export interface CoutsBloc4 {
  haloscan_market: { nb_appels: number; cout: number }
  dataforseo_related: { nb_appels: number; cout: number }
  dataforseo_ranked: { nb_appels: number; cout: number }
  dataforseo_serp_transac: { nb_appels: number; cout: number }
  openai: { nb_appels: number; cout: number }
  total: number
}

// ─── Résultat Phase A ────────────────────────────────────────────────────────

export interface ResultatPhaseA {
  keywords_marche: KeywordMarche[]
  keywords_positionnes_ot: KeywordPositionneOT[]
  keywords_classes: KeywordClassifie[]
  paa_detectes: KeywordMarche[]
  // Volumes séparés pour éviter la confusion (les sources ont des périmètres différents)
  volume_marche_seeds: number        // Volume des keywords détectés via Haloscan (demande marché autour de la destination)
  volume_positionne_ot: number       // Volume des keywords où l'OT apparaît dans Google (DataForSEO ranked)
  volume_transactionnel_gap: number  // Volume des keywords gap + intent transactionnel uniquement
  note_volumes: string               // Texte explicatif à afficher dans l'UI
  trafic_capte_ot_estime: number
  statut: 'en_attente_validation'
}

// ─── Résultat Phase B ────────────────────────────────────────────────────────

export interface ResultatPhaseB {
  serp_results: ResultatSERPTransac[]
  volume_marche_transactionnel: number
  trafic_estime_capte: number  // visites/mois estimées via CTR par position (positions 1-20)
  taux_captation: number       // trafic_estime_capte / volume_marche_seeds × 100, plafonné à 100%
  top_5_opportunites: Opportunite[]
  paa_sans_reponse: string[]
  score_gap: number
  synthese_narrative: string
  statut: 'terminé'
}

// ─── Résultat complet Bloc 4 ─────────────────────────────────────────────────

export interface ResultatVisibiliteSEO {
  phase_a: ResultatPhaseA
  phase_b?: ResultatPhaseB
  couts: CoutsBloc4
}

// ─── Paramètres d'entrée ──────────────────────────────────────────────────────

export interface ParamsBloc4 {
  destination: string   // ex: "Annecy"
  domaine_ot: string    // ex: "lac-annecy.com" — issu du Bloc 3
  code_insee: string    // ex: "74010"
  audit_id: string      // UUID Supabase
}
