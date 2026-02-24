// Orchestrateur — Bloc 1 : Positionnement & Notoriété
// Responsabilité : orchestrer la séquence complète des appels et agréger les résultats
// Flux : POI → POI-sélection → (Maps ‖ Instagram) → OpenAI → tracking coûts

import { API_COSTS } from '@/lib/api-costs'
import { enregistrerCoutsBloc } from '@/lib/tracking-couts'
import type {
  ResultatMaps,
  ResultatInstagram,
  AnalysePositionnement,
  AnalysePositionnementErreur,
  ResultatBlocPositionnement,
  POIBrut,
  POISelectionne,
  CoutsBloc,
} from '@/types/positionnement'

// URL de base — à adapter selon l'environnement (dev / prod)
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

/**
 * Appelle une route API interne avec un body JSON.
 * Pas de cache — les données d'audit doivent toujours être fraîches.
 */
async function appelRoute<T>(chemin: string, body: object): Promise<T> {
  const response = await fetch(`${BASE_URL}${chemin}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw new Error(`[${chemin}] Erreur HTTP ${response.status}`)
  }

  return response.json() as Promise<T>
}

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
  const { poi: poiListe } = await appelRoute<{ poi: POIBrut[] }>(
    '/api/blocs/positionnement/poi',
    { code_insee }
  )

  // ─── Étape 2 : sélection IA des 3 POI représentatifs ─────────────────────
  const { poi_selectionnes } = await appelRoute<{ poi_selectionnes: POISelectionne[] }>(
    '/api/blocs/positionnement/poi-selection',
    { destination, poi_list: poiListe }
  )

  // ─── Étape 3 : Maps et Instagram en parallèle ────────────────────────────
  // Maps reçoit les POI sélectionnés, Instagram est indépendant
  const [google, instagram] = await Promise.all([
    appelRoute<ResultatMaps>('/api/blocs/positionnement/maps', {
      destination,
      poi_selectionnes,
    }),
    appelRoute<ResultatInstagram>('/api/blocs/positionnement/instagram', { hashtag }),
  ])

  // ─── Étape 4 : analyse OpenAI — nourrie par Maps et Instagram ────────────
  const positionnement = await appelRoute<AnalysePositionnement | AnalysePositionnementErreur>(
    '/api/blocs/positionnement/openai',
    { destination, google, instagram }
  )

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
      cout_unitaire: API_COSTS.openai_gpt4o_mini,
      cout_total: 2 * API_COSTS.openai_gpt4o_mini,
    },
    total_bloc:
      4 * API_COSTS.dataforseo_maps +
      2 * API_COSTS.apify_hashtag_stats +
      2 * API_COSTS.openai_gpt4o_mini,
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
