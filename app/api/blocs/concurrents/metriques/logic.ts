// Logique métier — concurrents/metriques
// Collecte les métriques SEO + Google Maps pour UN concurrent
// SEO : séquence 5 étapes pour valider un "vrai 0" avant de conclure site_non_indexe
//   Étape 1 — Haloscan domains/overview domaine nu
//   Étape 2 — Haloscan domains/overview www.domaine
//   Étape 3 — Haloscan domains/positions (vérification existence, lineCount: 1)
//   Étape 4 — DataForSEO ranked_keywords domaine nu (limit: 1, métriques globales)
//   Étape 5 — DataForSEO ranked_keywords www.domaine
// Maps : DataForSEO Maps (1 appel)
// Position SERP : depuis le cache Bloc 3 uniquement (pas d'appel supplémentaire)
// ⚠️ Appeler séquentiellement entre chaque concurrent pour respecter les rate limits

import axios from 'axios'
import { API_COSTS } from '@/lib/api-costs'
import type { ConcurrentIdentifie, MetriquesConcurrent, SourceSEO } from '@/types/concurrents'

const HALOSCAN_OVERVIEW_URL = 'https://api.haloscan.com/api/domains/overview'
const HALOSCAN_POSITIONS_URL = 'https://api.haloscan.com/api/domains/positions'
const DATAFORSEO_RANKED_URL =
  'https://api.dataforseo.com/v3/dataforseo_labs/google/ranked_keywords/live'
const DATAFORSEO_MAPS_URL = 'https://api.dataforseo.com/v3/serp/google/maps/live/advanced'

// ─── Résultat interne de la séquence SEO ──────────────────────────────────────

interface ResultatSEOInterne {
  total_keywords: number
  total_traffic: number
  source_seo: SourceSEO
  site_non_indexe: boolean
  nb_appels_haloscan: number
  nb_appels_haloscan_positions: number
  nb_appels_dataforseo_ranked: number
}

// ─── Étapes 1 & 2 — Haloscan domains/overview ─────────────────────────────────

async function appelHaloscanOverview(
  domaine: string,
  apiKey: string
): Promise<{
  valide: boolean
  total_keywords: number
  total_traffic: number
}> {
  const response = await axios.post(
    HALOSCAN_OVERVIEW_URL,
    { input: domaine, mode: 'domain', requested_data: ['metrics'] },
    { headers: { 'haloscan-api-key': apiKey }, timeout: 30_000 }
  )

  // ⚠️ Niveau intermédiaire stats obligatoire — validé sur réponse réelle
  const metrics = (response.data.metrics?.stats as Record<string, number | string>) ?? {}
  const estVide =
    (response.data.metrics?.failure_reason !== null &&
      response.data.metrics?.failure_reason !== undefined) ||
    (!metrics.total_keyword_count && !metrics.total_traffic)

  if (estVide) return { valide: false, total_keywords: 0, total_traffic: 0 }

  return {
    valide: true,
    total_keywords: (metrics.total_keyword_count as number) ?? 0,
    total_traffic: (metrics.total_traffic as number) ?? 0,
  }
}

// ─── Étape 3 — Haloscan domains/positions ─────────────────────────────────────

async function appelHaloscanPositions(
  domaine: string,
  apiKey: string
): Promise<{ total_keyword_count: number }> {
  const response = await axios.post(
    HALOSCAN_POSITIONS_URL,
    { input: domaine, lineCount: 1, mode: 'auto' },
    { headers: { 'haloscan-api-key': apiKey }, timeout: 30_000 }
  )

  const data = response.data
  // failure_reason non null → domaine absent
  if (data.failure_reason !== null && data.failure_reason !== undefined) {
    return { total_keyword_count: 0 }
  }
  return { total_keyword_count: data.total_keyword_count ?? 0 }
}

// ─── Étapes 4 & 5 — DataForSEO ranked_keywords ────────────────────────────────

async function appelDataForSEORanked(
  domaine: string
): Promise<{ organic_count: number; organic_etv: number }> {
  const response = await axios.post(
    DATAFORSEO_RANKED_URL,
    [
      {
        target: domaine,
        location_code: 2250,
        language_code: 'fr',
        limit: 1,           // on veut juste les métriques globales, pas les keywords individuels
        item_types: ['organic'],
      },
    ],
    {
      auth: {
        username: process.env.DATAFORSEO_LOGIN!,
        password: process.env.DATAFORSEO_PASSWORD!,
      },
      timeout: 30_000,
    }
  )

  // ⚠️ Métriques globales du domaine : result[0].metrics.organic
  // (pas result[0].items[0] — les items sont les keywords individuels)
  const result = response.data?.tasks?.[0]?.result?.[0]
  if (!result) return { organic_count: 0, organic_etv: 0 }

  const organic = result.metrics?.organic
  return {
    organic_count: organic?.count ?? 0,
    organic_etv: Math.round(organic?.etv ?? 0),
  }
}

// ─── Séquence 5 étapes ────────────────────────────────────────────────────────

async function collecterSEOSequence(domaine: string): Promise<ResultatSEOInterne> {
  const apiKey = process.env.HALOSCAN_API_KEY!
  let nb_appels_haloscan = 0
  let nb_appels_haloscan_positions = 0
  let nb_appels_dataforseo_ranked = 0

  // Retour rapide avec compteurs courants
  function retourner(
    total_keywords: number,
    total_traffic: number,
    source_seo: SourceSEO,
    site_non_indexe: boolean
  ): ResultatSEOInterne {
    return {
      total_keywords,
      total_traffic,
      source_seo,
      site_non_indexe,
      nb_appels_haloscan,
      nb_appels_haloscan_positions,
      nb_appels_dataforseo_ranked,
    }
  }

  // ── Étape 1 — Haloscan overview domaine nu ──
  try {
    nb_appels_haloscan++
    const r1 = await appelHaloscanOverview(domaine, apiKey)
    if (r1.valide) {
      console.log(`[SEO Concurrent] ${domaine} → Haloscan overview (nu) : ${r1.total_keywords} kw`)
      return retourner(r1.total_keywords, r1.total_traffic, 'haloscan', false)
    }
  } catch (err) {
    console.warn(`[SEO Concurrent] Haloscan overview ${domaine} erreur :`, err)
  }

  // ── Étape 2 — Haloscan overview www. ──
  if (!domaine.startsWith('www.')) {
    try {
      nb_appels_haloscan++
      const r2 = await appelHaloscanOverview(`www.${domaine}`, apiKey)
      if (r2.valide) {
        console.log(
          `[SEO Concurrent] ${domaine} → Haloscan overview (www) : ${r2.total_keywords} kw`
        )
        return retourner(r2.total_keywords, r2.total_traffic, 'haloscan', false)
      }
    } catch (err) {
      console.warn(`[SEO Concurrent] Haloscan overview www.${domaine} erreur :`, err)
    }
  }

  // ── Étape 3 — Haloscan positions (vérification existence) ──
  try {
    nb_appels_haloscan_positions++
    const r3 = await appelHaloscanPositions(domaine, apiKey)
    if (r3.total_keyword_count > 0) {
      console.log(
        `[SEO Concurrent] ${domaine} → Haloscan positions : ${r3.total_keyword_count} kw (trafic non dispo)`
      )
      // total_traffic = 0 car non disponible sans charger tous les résultats positions
      return retourner(r3.total_keyword_count, 0, 'haloscan_positions', false)
    }
  } catch (err) {
    console.warn(`[SEO Concurrent] Haloscan positions ${domaine} erreur :`, err)
  }

  // ── Étape 4 — DataForSEO ranked_keywords domaine nu ──
  try {
    nb_appels_dataforseo_ranked++
    const r4 = await appelDataForSEORanked(domaine)
    if (r4.organic_count > 0) {
      console.log(
        `[SEO Concurrent] ${domaine} → DataForSEO ranked (nu) : ${r4.organic_count} kw`
      )
      return retourner(r4.organic_count, r4.organic_etv, 'dataforseo_ranked', false)
    }
  } catch (err) {
    console.warn(`[SEO Concurrent] DataForSEO ranked ${domaine} erreur :`, err)
  }

  // ── Étape 5 — DataForSEO ranked_keywords www. ──
  if (!domaine.startsWith('www.')) {
    try {
      nb_appels_dataforseo_ranked++
      const r5 = await appelDataForSEORanked(`www.${domaine}`)
      if (r5.organic_count > 0) {
        console.log(
          `[SEO Concurrent] ${domaine} → DataForSEO ranked (www) : ${r5.organic_count} kw`
        )
        return retourner(r5.organic_count, r5.organic_etv, 'dataforseo_ranked', false)
      }
    } catch (err) {
      console.warn(`[SEO Concurrent] DataForSEO ranked www.${domaine} erreur :`, err)
    }
  }

  // ── Toutes les sources épuisées → vrai 0 confirmé ──
  console.log(
    `[SEO Concurrent] ${domaine} : site_non_indexe confirmé (5 étapes épuisées)`
  )
  return retourner(0, 0, 'inconnu', true)
}

// ─── DataForSEO Maps ──────────────────────────────────────────────────────────

async function collecterMapsGoogle(nomConcurrent: string): Promise<{
  note_google: number | null
  nb_avis_google: number | null
}> {
  const auth = Buffer.from(
    `${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`
  ).toString('base64')

  // ⚠️ Une seule tâche dans l'array — erreur 40000 si plusieurs
  const response = await axios.post(
    DATAFORSEO_MAPS_URL,
    [
      {
        keyword: `Office de tourisme ${nomConcurrent}`,
        language_code: 'fr',
        location_code: 2250,
        depth: 3,
      },
    ],
    { headers: { Authorization: `Basic ${auth}` }, timeout: 60_000 }
  )

  const items = response.data?.tasks?.[0]?.result?.[0]?.items ?? []
  // Priorité au premier item organique avec une note
  const fiche =
    items.find(
      (i: Record<string, unknown>) =>
        i.type === 'organic' && (i.rating as Record<string, unknown>)?.value
    ) ??
    items.find((i: Record<string, unknown>) => (i.rating as Record<string, unknown>)?.value) ??
    null

  if (!fiche?.rating?.value) return { note_google: null, nb_avis_google: null }

  return {
    note_google: fiche.rating.value ?? null,
    nb_avis_google: fiche.rating.votes_count ?? null,
  }
}

// ─── Logique principale ────────────────────────────────────────────────────────

/**
 * Collecte les métriques SEO + Google Maps pour un concurrent.
 * @param concurrent   - Concurrent identifié avec son domaine validé
 * @param serp_cache   - Cache des positions SERP du Bloc 3 (pas d'appel API supplémentaire)
 */
export async function executerMetriquesConcurrents({
  concurrent,
  serp_cache,
}: {
  concurrent: ConcurrentIdentifie
  serp_cache?: Array<{ domaine: string; position: number }>
}): Promise<{
  metriques: MetriquesConcurrent
  couts: {
    haloscan: { nb_appels: number; cout_unitaire: number; cout_total: number }
    haloscan_positions: { nb_appels: number; cout_unitaire: number; cout_total: number }
    dataforseo_ranked: { nb_appels: number; cout_unitaire: number; cout_total: number }
    dataforseo_maps: { nb_appels: number; cout_unitaire: number; cout_total: number }
  }
}> {
  if (!concurrent?.domaine_valide) {
    throw new Error('concurrent.domaine_valide requis')
  }

  const domaine = concurrent.domaine_valide

  // SEO (séquence 5 étapes) et Maps en parallèle — indépendants
  const [seoSettled, mapsSettled] = await Promise.allSettled([
    collecterSEOSequence(domaine),
    collecterMapsGoogle(concurrent.nom),
  ])

  // ─── Traitement SEO ───────────────────────────────────────────────────────
  let seoResultat: ResultatSEOInterne

  if (seoSettled.status === 'fulfilled') {
    seoResultat = seoSettled.value
  } else {
    console.warn(
      `[Métriques concurrent] Séquence SEO échouée pour ${domaine} :`,
      seoSettled.reason
    )
    seoResultat = {
      total_keywords: 0,
      total_traffic: 0,
      source_seo: 'inconnu',
      site_non_indexe: true,
      nb_appels_haloscan: 0,
      nb_appels_haloscan_positions: 0,
      nb_appels_dataforseo_ranked: 0,
    }
  }

  // ─── Traitement Maps ──────────────────────────────────────────────────────
  let note_google: number | null = null
  let nb_avis_google: number | null = null

  if (mapsSettled.status === 'fulfilled') {
    note_google = mapsSettled.value.note_google
    nb_avis_google = mapsSettled.value.nb_avis_google
  } else {
    console.warn(
      `[Métriques concurrent] Maps échoué pour ${concurrent.nom} :`,
      mapsSettled.reason
    )
  }

  // ─── Position SERP depuis le cache (pas d'appel API) ─────────────────────
  let position_serp: number | null = null
  if (serp_cache?.length) {
    const entree = serp_cache.find(
      (e) =>
        e.domaine === domaine ||
        e.domaine === `www.${domaine}` ||
        `www.${e.domaine}` === domaine
    )
    if (entree) position_serp = entree.position
  }

  // ─── Résultat ─────────────────────────────────────────────────────────────
  const metriques: MetriquesConcurrent = {
    total_keywords: seoResultat.total_keywords,
    total_traffic: seoResultat.total_traffic,
    source_seo: seoResultat.source_seo,
    site_non_indexe: seoResultat.site_non_indexe,
    note_google,
    nb_avis_google,
    position_serp_requete_principale: position_serp,
  }

  const couts = {
    haloscan: {
      nb_appels: seoResultat.nb_appels_haloscan,
      cout_unitaire: API_COSTS.haloscan,
      cout_total: seoResultat.nb_appels_haloscan * API_COSTS.haloscan,
    },
    haloscan_positions: {
      nb_appels: seoResultat.nb_appels_haloscan_positions,
      cout_unitaire: API_COSTS.haloscan_positions,
      cout_total: seoResultat.nb_appels_haloscan_positions * API_COSTS.haloscan_positions,
    },
    dataforseo_ranked: {
      nb_appels: seoResultat.nb_appels_dataforseo_ranked,
      cout_unitaire: API_COSTS.dataforseo_ranked,
      cout_total: seoResultat.nb_appels_dataforseo_ranked * API_COSTS.dataforseo_ranked,
    },
    dataforseo_maps: {
      nb_appels: 1,
      cout_unitaire: API_COSTS.dataforseo_maps,
      cout_total: API_COSTS.dataforseo_maps,
    },
  }

  return { metriques, couts }
}
