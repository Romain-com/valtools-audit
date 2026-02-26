// Orchestrateur — Bloc 4 Phase B : Visibilité SEO & Gap Transactionnel
// Responsabilité : SERP live transac + synthèse OpenAI
// Déclenchée uniquement après validation utilisateur de la Phase A.
// Flux : serp-transac (séquentiel) → synthèse OpenAI → coûts

import { API_COSTS } from '@/lib/api-costs'
import { enregistrerCoutsBloc } from '@/lib/tracking-couts'
import type {
  KeywordClassifie,
  ResultatPhaseA,
  ResultatPhaseB,
  CoutsBloc4,
} from '@/types/visibilite-seo'

// Imports directs des logiques métier — évite les appels HTTP auto-référentiels
import { executerSERPTransac } from '@/app/api/blocs/visibilite-seo/serp-transac/logic'
import { executerSyntheseVisibiliteSEO } from '@/app/api/blocs/visibilite-seo/synthese/logic'

/**
 * Point d'entrée de la Phase B — Bloc 4.
 * Prend les résultats de Phase A (avec les sélections utilisateur éventuelles)
 * et lance les SERP live + synthèse OpenAI.
 *
 * @param destination        - Nom de la destination (ex: "Annecy")
 * @param domaine_ot         - Domaine OT (ex: "lac-annecy.com")
 * @param phase_a            - Résultats complets de la Phase A
 * @param keywords_valides   - Keywords avec selectionne_phase_b mis à jour par l'utilisateur
 * @param audit_id           - UUID de l'audit (pour le tracking des coûts Supabase)
 * @param couts_phase_a      - Coûts déjà engagés en Phase A (pour le total bloc)
 */
export async function lancerPhaseB(
  destination: string,
  domaine_ot: string,
  phase_a: ResultatPhaseA,
  keywords_valides: KeywordClassifie[],
  audit_id: string,
  couts_phase_a: CoutsBloc4
): Promise<ResultatPhaseB> {
  try {
    // ─── Étape 1 : SERP live pour les keywords transactionnels sélectionnés ───
    const serpReponse = await executerSERPTransac({
      keywords_classes: keywords_valides,
      domaine_ot,
    }) as {
      serp_results: ResultatPhaseB['serp_results']
      keywords_analyses: string[]
      cout: { nb_appels: number; cout_unitaire: number; cout_total: number }
    }

    const { serp_results } = serpReponse
    const nb_appels_serp = serpReponse.cout.nb_appels

    // ─── Étape 2 : synthèse OpenAI ────────────────────────────────────────────
    const syntheseReponse = await executerSyntheseVisibiliteSEO({
      destination,
      domaine_ot,
      keywords_classes: keywords_valides,
      serp_results,
      paa_detectes: phase_a.paa_detectes,
      // volume_marche_seeds : dénominateur correct pour taux_captation (périmètre marché détecté)
      volume_marche_seeds: phase_a.volume_marche_seeds,
      // trafic_capte_ot_estime : déjà calculé avec CTR par position dans dataforseo-ranked
      trafic_capte_ot_estime: phase_a.trafic_capte_ot_estime,
    }) as ResultatPhaseB & {
      cout: { nb_appels: number; cout_unitaire: number; cout_total: number }
    }

    // ─── Étape 3 : agrégation des coûts Phase B + total bloc ──────────────────
    const couts_phase_b: CoutsBloc4 = {
      haloscan_market: couts_phase_a.haloscan_market,
      dataforseo_related: couts_phase_a.dataforseo_related,
      dataforseo_ranked: couts_phase_a.dataforseo_ranked,
      dataforseo_serp_transac: {
        nb_appels: nb_appels_serp,
        cout: nb_appels_serp * API_COSTS.dataforseo_serp,
      },
      openai: {
        nb_appels: couts_phase_a.openai.nb_appels + 1,
        cout: (couts_phase_a.openai.nb_appels + 1) * API_COSTS.openai_gpt5_mini,
      },
      total:
        couts_phase_a.haloscan_market.cout +
        couts_phase_a.dataforseo_related.cout +
        couts_phase_a.dataforseo_ranked.cout +
        nb_appels_serp * API_COSTS.dataforseo_serp +
        (couts_phase_a.openai.nb_appels + 1) * API_COSTS.openai_gpt5_mini,
    }

    // ─── Étape 4 : persistance des coûts Phase B (fire & forget) ──────────────
    enregistrerCoutsBloc(audit_id, 'visibilite_seo_phase_b', couts_phase_b)

    // ─── Étape 5 : retour ─────────────────────────────────────────────────────
    const {
      serp_results: _sr,
      cout: _cout,
      ...restePhaseB
    } = syntheseReponse

    return {
      serp_results,
      ...restePhaseB,
      statut: 'terminé',
    }
  } catch (err) {
    // Fallback global — ne jamais throw, retourner un résultat vide
    console.error('[Bloc 4 Phase B] Erreur fatale :', err)

    return {
      serp_results: [],
      volume_marche_transactionnel: phase_a.volume_transactionnel_gap,
      trafic_estime_capte: phase_a.trafic_capte_ot_estime,
      taux_captation: 0,
      top_5_opportunites: [],
      paa_sans_reponse: [],
      score_gap: 0,
      synthese_narrative: '',
      statut: 'terminé',
    }
  }
}
