// Orchestrateur — Bloc 1 : Positionnement & Notoriété
// Responsabilité : orchestrer la séquence complète des appels et agréger les résultats
// Flux : POI → POI-sélection → (Maps ‖ Instagram) → OpenAI → tracking coûts
// Les fonctions logiques sont importées directement pour éviter les appels HTTP auto-référentiels

import { API_COSTS } from '@/lib/api-costs'
import { enregistrerCoutsBloc } from '@/lib/tracking-couts'
import { executerPOI } from '@/app/api/blocs/positionnement/poi/logic'
import { executerPOISelection } from '@/app/api/blocs/positionnement/poi-selection/logic'
import { executerMaps } from '@/app/api/blocs/positionnement/maps/logic'
import { executerInstagram } from '@/app/api/blocs/positionnement/instagram/logic'
import { executerOpenAIPositionnement } from '@/app/api/blocs/positionnement/openai/logic'
import type {
  ResultatMaps,
  ResultatInstagram,
  AnalysePositionnement,
  AnalysePositionnementErreur,
  ResultatBlocPositionnement,
  CoutsBloc,
} from '@/types/positionnement'

/**
 * Point d'entrée du Bloc 1 — Positionnement & Notoriété.
 *
 * @param auditId     - UUID de l'audit (pour le tracking des coûts Supabase)
 * @param destination - Nom de la destination (ex: "Annecy")
 * @param code_insee  - Code INSEE de la commune (ex: "74010")
 * @param hashtag     - Hashtag Instagram sans # (ex: "annecy")
 */
export async function auditPositionnement(
  auditId: string,
  destination: string,
  code_insee: string,
  hashtag: string
): Promise<ResultatBlocPositionnement> {

  // ─── Étape 1 : récupération des POI bruts ────────────────────────────────
  const { poi: poiListe } = await executerPOI({ code_insee })

  // ─── Étape 2 : sélection IA des 3 POI représentatifs ─────────────────────
  const { poi_selectionnes } = await executerPOISelection({ destination, poi_list: poiListe })

  // ─── Étape 3 : Maps et Instagram en parallèle ────────────────────────────
  // Maps reçoit les POI sélectionnés, Instagram est indépendant
  const [google, instagram] = await Promise.all([
    executerMaps({ destination, poi_selectionnes }) as Promise<ResultatMaps>,
    executerInstagram({ hashtag }) as Promise<ResultatInstagram>,
  ])

  // ─── Étape 4 : analyse OpenAI — nourrie par Maps et Instagram ────────────
  const positionnement = await executerOpenAIPositionnement({
    destination,
    google,
    instagram,
  }) as AnalysePositionnement | AnalysePositionnementErreur

  // ─── Étape 5 : agrégation des coûts ──────────────────────────────────────
  // 2 appels OpenAI : poi-selection + analyse finale
  const couts_bloc: CoutsBloc = {
    dataforseo: {
      nb_appels: 4,
      cout_unitaire: API_COSTS.dataforseo_maps,
      cout_total: 4 * API_COSTS.dataforseo_maps,
    },
    apify: {
      nb_appels: 2,
      cout_unitaire: API_COSTS.apify_hashtag_stats,
      cout_total: 2 * API_COSTS.apify_hashtag_stats,
    },
    openai: {
      nb_appels: 2,
      cout_unitaire: API_COSTS.openai_gpt5_mini,
      cout_total: 2 * API_COSTS.openai_gpt5_mini,
    },
    total_bloc:
      4 * API_COSTS.dataforseo_maps +
      2 * API_COSTS.apify_hashtag_stats +
      2 * API_COSTS.openai_gpt5_mini,
  }

  // ─── Étape 6 : persistance des coûts (sans await — fire & forget) ────────
  // N'attend pas la réponse Supabase pour ne pas bloquer le retour au client
  enregistrerCoutsBloc(auditId, 'positionnement', couts_bloc)

  // ─── Étape 7 : retour ────────────────────────────────────────────────────
  return {
    google,
    instagram,
    positionnement,
    couts_bloc,
  }
}
