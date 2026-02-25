// Orchestrateur — Bloc 4 Phase A : Visibilité SEO & Gap Transactionnel
// Responsabilité : orchestrer Haloscan market + DataForSEO related + DataForSEO ranked + classification OpenAI
// Flux : haloscan-market (8 seeds ‖) + dataforseo-related (4 seeds ‖) + dataforseo-ranked → classification → coûts
// ⚠️  Promise.allSettled — chaque source est indépendante. Une panne n'en bloque pas les autres.
// La Phase A est automatique et se termine en statut 'en_attente_validation'.

import { API_COSTS } from '@/lib/api-costs'
import { enregistrerCoutsBloc } from '@/lib/tracking-couts'
import type {
  KeywordMarche,
  KeywordPositionneOT,
  KeywordClassifie,
  ResultatPhaseA,
  CoutsBloc4,
} from '@/types/visibilite-seo'

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

// ─── Types des réponses de chaque route ──────────────────────────────────────

interface HaloscanMarketReponse {
  keywords_marche: KeywordMarche[]
  paa_detectes: KeywordMarche[]
  volume_marche_seeds: number
  cout: { nb_appels: number; cout_unitaire: number; cout_total: number }
}

interface DataForSEORelatedReponse {
  keywords: {
    keyword: string
    volume: number
    cpc: number | null
    source_seed: string
  }[]
  nb_keywords: number
  cout: { nb_appels: number; cout_unitaire: number; cout_total: number }
}

interface DataForSEORankedReponse {
  keywords_positionnes_ot: KeywordPositionneOT[]
  trafic_capte_estime: number
  cout: { nb_appels: number; cout_unitaire: number; cout_total: number }
}

/**
 * Point d'entrée de la Phase A — Bloc 4.
 * Lance Haloscan market (8 seeds) + DataForSEO related (4 seeds) + DataForSEO ranked en parallèle,
 * fusionne les corpus marché, puis classifie les keywords avec OpenAI.
 *
 * @param destination  - Nom de la destination (ex: "Annecy")
 * @param domaine_ot   - Domaine OT (ex: "lac-annecy.com") — issu du Bloc 3
 * @param audit_id     - UUID de l'audit (pour le tracking des coûts Supabase)
 */
export async function lancerPhaseA(
  destination: string,
  domaine_ot: string,
  audit_id: string
): Promise<ResultatPhaseA> {
  try {
    // ─── Étape 1 : 3 sources en parallèle — chaque source est indépendante ───
    const [haloscan_settled, related_settled, ranked_settled] = await Promise.allSettled([
      appelRoute<HaloscanMarketReponse>('/api/blocs/visibilite-seo/haloscan-market', { destination }),
      appelRoute<DataForSEORelatedReponse>('/api/blocs/visibilite-seo/dataforseo-related', { destination }),
      appelRoute<DataForSEORankedReponse>('/api/blocs/visibilite-seo/dataforseo-ranked', { domaine_ot }),
    ])

    // Extraire les valeurs — null si la source a échoué
    const haloscan_result = haloscan_settled.status === 'fulfilled' ? haloscan_settled.value : null
    const related_result  = related_settled.status === 'fulfilled'  ? related_settled.value  : null
    const ranked_result   = ranked_settled.status === 'fulfilled'   ? ranked_settled.value   : null

    // Logger les échecs sans bloquer
    if (haloscan_settled.status === 'rejected') console.warn('[Bloc 4] Haloscan market échoué :', haloscan_settled.reason)
    if (related_settled.status === 'rejected')  console.warn('[Bloc 4] DataForSEO related échoué :', related_settled.reason)
    if (ranked_settled.status === 'rejected')   console.warn('[Bloc 4] DataForSEO ranked échoué :', ranked_settled.reason)

    // ranked_result est obligatoire — sans lui, pas de domaine OT à analyser
    if (!ranked_result) {
      throw new Error('DataForSEO ranked_keywords indisponible — Phase A interrompue')
    }

    const { keywords_positionnes_ot, trafic_capte_estime } = ranked_result
    const paa_detectes = haloscan_result?.paa_detectes ?? []

    // ─── Étape 2 : fusion des corpus marché Haloscan + DataForSEO related ────
    const dest = destination.toLowerCase()
    const mapKeywords = new Map<string, KeywordMarche>()

    // 1. Ajouter keywords Haloscan en premier (priorité : CPC et competition fiables)
    for (const kw of haloscan_result?.keywords_marche ?? []) {
      mapKeywords.set(kw.keyword.toLowerCase().trim(), kw)
    }

    // 2. Ajouter keywords DataForSEO related filtrés — ne pas écraser Haloscan (CPC Haloscan plus fiable)
    // Filtre pertinence : contient la destination OU ≥ 3 mots (assez spécifique pour un OT)
    for (const kw of related_result?.keywords ?? []) {
      const cle = kw.keyword.toLowerCase().trim()
      if (!cle.includes(dest) && cle.split(' ').length < 3) continue
      if (!mapKeywords.has(cle)) {
        mapKeywords.set(cle, {
          keyword: kw.keyword,
          volume: kw.volume,
          source: 'dataforseo_related',
          seed: kw.source_seed,
          cpc: kw.cpc ?? undefined,
          competition: undefined,
        })
      }
    }

    const keywords_marche: KeywordMarche[] = Array.from(mapKeywords.values())
      .filter((kw) => kw.volume > 0)
      .sort((a, b) => b.volume - a.volume)

    const volume_marche_seeds = haloscan_result?.volume_marche_seeds ?? 0

    // ─── Étape 3 : classification OpenAI ─────────────────────────────────────
    const classificationReponse = await appelRoute<{
      keywords_classes: KeywordClassifie[]
      cout: { nb_appels: number; cout_unitaire: number; cout_total: number }
    }>('/api/blocs/visibilite-seo/classification', {
      destination,
      keywords_marche,
      keywords_positionnes_ot,
    })

    const { keywords_classes } = classificationReponse

    // ─── Étape 4 : calcul des volumes séparés ────────────────────────────────
    // Chaque volume a un périmètre distinct — ne pas les comparer entre eux.
    const volume_positionne_ot = keywords_positionnes_ot.reduce((sum, kw) => sum + (kw.volume || 0), 0)
    const volume_transactionnel_gap = keywords_classes
      .filter((kw) => kw.gap && kw.intent_transactionnel)
      .reduce((sum, kw) => sum + (kw.volume || 0), 0)

    // ─── Étape 5 : agrégation des coûts ──────────────────────────────────────
    const nb_appels_openai = classificationReponse.cout.nb_appels
    const nb_appels_related = related_result?.cout.nb_appels ?? 0

    const couts: CoutsBloc4 = {
      haloscan_market: {
        nb_appels: 8,
        cout: 8 * API_COSTS.haloscan_keywords,
      },
      dataforseo_related: {
        nb_appels: nb_appels_related,
        cout: nb_appels_related * API_COSTS.dataforseo_related,
      },
      dataforseo_ranked: {
        nb_appels: 1,
        cout: API_COSTS.dataforseo_ranked,
      },
      dataforseo_serp_transac: {
        nb_appels: 0,
        cout: 0,
      },
      openai: {
        nb_appels: nb_appels_openai,
        cout: nb_appels_openai * API_COSTS.openai_gpt4o_mini,
      },
      total:
        8 * API_COSTS.haloscan_keywords +
        nb_appels_related * API_COSTS.dataforseo_related +
        API_COSTS.dataforseo_ranked +
        nb_appels_openai * API_COSTS.openai_gpt4o_mini,
    }

    // ─── Étape 6 : persistance des coûts (fire & forget) ─────────────────────
    enregistrerCoutsBloc(audit_id, 'visibilite_seo_phase_a', couts)

    // ─── Étape 7 : retour ────────────────────────────────────────────────────
    return {
      keywords_marche,
      keywords_positionnes_ot,
      keywords_classes,
      paa_detectes,
      volume_marche_seeds,
      volume_positionne_ot,
      volume_transactionnel_gap,
      note_volumes: "volume_marche_seeds = demande autour de la destination (Haloscan). volume_positionne_ot = périmètre réel du site OT dans Google. volume_transactionnel_gap = potentiel non capté à fort intent commercial.",
      trafic_capte_ot_estime: trafic_capte_estime,
      statut: 'en_attente_validation',
    }
  } catch (err) {
    // Fallback global — ne jamais throw, retourner un résultat vide
    console.error('[Bloc 4 Phase A] Erreur fatale :', err)

    return {
      keywords_marche: [],
      keywords_positionnes_ot: [],
      keywords_classes: [],
      paa_detectes: [],
      volume_marche_seeds: 0,
      volume_positionne_ot: 0,
      volume_transactionnel_gap: 0,
      note_volumes: '',
      trafic_capte_ot_estime: 0,
      statut: 'en_attente_validation',
    }
  }
}
