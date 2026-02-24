// Orchestrateur — Bloc 3 : Schéma digital & Santé technique
// Responsabilité : orchestrer la séquence complète des appels et agréger les résultats
// Flux : SERP (5 requêtes) → Classification → (Haloscan ‖ PageSpeed ‖ Analyse OT) → OpenAI → coûts

import { API_COSTS } from '@/lib/api-costs'
import { enregistrerCoutsBloc } from '@/lib/tracking-couts'
import type {
  ResultatSchemaDigital,
  ResultatHaloscan,
  ResultatPageSpeed,
  AnalyseSiteOT,
  VisibiliteParIntention,
} from '@/types/schema-digital'

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
 * Point d'entrée du Bloc 3 — Schéma digital & Santé technique.
 *
 * @param destination - Nom de la destination (ex: "Annecy")
 * @param audit_id    - UUID de l'audit (pour le tracking des coûts Supabase)
 */
export async function lancerBlocSchemaDigital(
  destination: string,
  audit_id: string
): Promise<ResultatSchemaDigital> {
  try {
    // ─── Étape 1 : SERP (5 requêtes en parallèle) ────────────────────────────
    const { par_requete, tous_resultats } = await appelRoute<{
      par_requete: Array<{
        requete: string
        keyword: string
        top3: Array<{ position: number; url: string; domaine: string; titre: string; meta_description: string; requete_source: string }>
      }>
      tous_resultats: Array<{ position: number; url: string; domaine: string; titre: string; meta_description: string; requete_source: string }>
    }>('/api/blocs/schema-digital/serp', { destination })

    // ─── Étape 2 : classification OpenAI (contexte enrichi par intention) ────
    const { resultats_classes, top3_officiels, domaine_ot, visibilite_ot_par_intention, score_visibilite_ot } =
      await appelRoute<{
        resultats_classes: Array<{
          position: number
          domaine: string
          categorie: string
          titre: string
          meta_description: string
          url: string
          requete_source: string
        }>
        top3_officiels: ResultatSchemaDigital['top3_officiels']
        domaine_ot: string | null
        visibilite_ot_par_intention: Record<string, VisibiliteParIntention>
        score_visibilite_ot: number
      }>('/api/blocs/schema-digital/classification', {
        destination,
        tous_resultats,
        par_requete,
      })

    // Calcul des métriques SERP globales
    const nb_sites_officiels_top10 = resultats_classes.filter((r) =>
      r.categorie.startsWith('officiel_')
    ).length
    const nb_ota_top10 = resultats_classes.filter((r) => r.categorie === 'ota').length

    // Extraction des domaines des top 3 officiels pour Haloscan + PageSpeed
    const top3_domaines = top3_officiels.map((s) => s.domaine)

    if (!top3_domaines.length) {
      console.warn('[Bloc 3] Aucun site officiel identifié — résultat partiel')
    }

    // Données du site OT pour l'analyse
    const siteOT = domaine_ot
      ? top3_officiels.find((s) => s.categorie === 'officiel_ot') ?? top3_officiels[0]
      : null
    const urlOT = domaine_ot
      ? (tous_resultats.find((r) => r.domaine === domaine_ot)?.url ?? '')
      : ''

    // ─── Étape 3a : Haloscan séquentiel avec fallback DataForSEO ─────────────
    // Un appel par domaine — la décision de fallback est dans l'orchestrateur
    const haloscan: ResultatHaloscan[] = []
    const couts_seo = { haloscan: 0, dataforseo: 0 }

    for (const domaine of top3_domaines) {
      const haloscanData = await appelRoute<{
        domaine: string
        donnees_valides: boolean
        resultat: ResultatHaloscan
      }>('/api/blocs/schema-digital/haloscan', { domaine })

      // Crédit Haloscan consommé dans tous les cas (même si vide)
      couts_seo.haloscan++

      if (haloscanData.donnees_valides) {
        haloscan.push(haloscanData.resultat)
      } else {
        // Fallback DataForSEO domain_rank_overview
        const dfsData = await appelRoute<ResultatHaloscan>(
          '/api/blocs/schema-digital/domain-analytics',
          { domaine }
        )
        haloscan.push(dfsData)
        couts_seo.dataforseo++
      }
    }

    // ─── Étape 3b : PageSpeed + Analyse OT en parallèle ──────────────────────
    const [pagespeedReponse, analyseOT] = await Promise.all([
      top3_domaines.length
        ? appelRoute<{ resultats: ResultatPageSpeed[] }>(
            '/api/blocs/schema-digital/pagespeed',
            { domaines: top3_domaines }
          )
        : Promise.resolve({ resultats: [] }),

      domaine_ot && siteOT
        ? appelRoute<AnalyseSiteOT>('/api/blocs/schema-digital/analyse-ot', {
            destination,
            domaine_ot,
            titre_ot: siteOT.titre,
            meta_description_ot: siteOT.meta_description,
            url_ot: urlOT,
          })
        : Promise.resolve(null),
    ])

    const pagespeed = pagespeedReponse.resultats

    // ─── Étape 4 : synthèse OpenAI ───────────────────────────────────────────
    const openai = await appelRoute<ResultatSchemaDigital['openai']>(
      '/api/blocs/schema-digital/openai',
      {
        destination,
        top3_officiels,
        haloscan,
        pagespeed,
        nb_sites_officiels_top10,
        nb_ota_top10,
      }
    )

    // ─── Étape 5 : agrégation des coûts ──────────────────────────────────────
    // couts_seo.haloscan = nb d'appels Haloscan réels (crédits consommés même si vide)
    // couts_seo.dataforseo = nb d'appels DataForSEO fallback effectivement déclenchés
    const coutHaloscan = couts_seo.haloscan * API_COSTS.haloscan
    const coutDataForSEODomain = couts_seo.dataforseo * API_COSTS.dataforseo_domain

    // 3 appels OpenAI : classification + analyse OT (si domaine_ot) + synthèse finale
    const nbAppelsOpenAI = domaine_ot ? 3 : 2
    const coutOpenAI = nbAppelsOpenAI * API_COSTS.openai_gpt4o_mini
    const coutDataForSEO = 5 * API_COSTS.dataforseo_serp

    const couts = {
      dataforseo: {
        nb_appels: 5,
        cout_unitaire: API_COSTS.dataforseo_serp,
        cout_total: coutDataForSEO,
      },
      haloscan: {
        nb_appels: couts_seo.haloscan,
        cout_unitaire: API_COSTS.haloscan,
        cout_total: coutHaloscan,
      },
      dataforseo_domain: {
        nb_appels: couts_seo.dataforseo,
        cout_unitaire: API_COSTS.dataforseo_domain,
        cout_total: coutDataForSEODomain,
      },
      openai: {
        nb_appels: nbAppelsOpenAI,
        cout_unitaire: API_COSTS.openai_gpt4o_mini,
        cout_total: coutOpenAI,
      },
      pagespeed: {
        nb_appels: top3_domaines.length * 2,
        cout_unitaire: API_COSTS.pagespeed,
        cout_total: 0,
      },
      total_bloc: coutDataForSEO + coutHaloscan + coutDataForSEODomain + coutOpenAI,
    }

    // ─── Étape 6 : persistance des coûts (fire & forget) ────────────────────
    enregistrerCoutsBloc(audit_id, 'schema_digital', couts)

    // ─── Étape 7 : retour ────────────────────────────────────────────────────
    return {
      serp_fusionne: resultats_classes.map((r) => ({
        position: r.position,
        url: r.url,
        domaine: r.domaine,
        titre: r.titre,
        meta_description: r.meta_description,
        categorie: r.categorie as ResultatSchemaDigital['serp_fusionne'][0]['categorie'],
        requete_source: r.requete_source,
      })),
      top3_officiels,
      domaine_ot_detecte: domaine_ot,
      haloscan,
      pagespeed,
      analyse_site_ot: analyseOT,
      visibilite_ot_par_intention,
      score_visibilite_ot,
      openai,
      meta: {
        nb_sites_officiels_top10,
        nb_ota_top10,
        domaine_ot_source: 'auto',
        cout_total_euros: couts.total_bloc,
      },
    }
  } catch (err) {
    // Fallback global — ne jamais throw, retourner un résultat vide
    console.error('[Bloc 3] Erreur fatale :', err)

    return {
      serp_fusionne: [],
      top3_officiels: [],
      domaine_ot_detecte: null,
      haloscan: [],
      pagespeed: [],
      analyse_site_ot: null,
      visibilite_ot_par_intention: {},
      score_visibilite_ot: 0,
      openai: {
        synthese_schema: '',
        indicateurs_cles: [],
        points_attention: [],
      },
      meta: {
        nb_sites_officiels_top10: 0,
        nb_ota_top10: 0,
        domaine_ot_source: 'auto',
        cout_total_euros: 0,
      },
    }
  }
}
