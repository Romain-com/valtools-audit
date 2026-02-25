// Orchestrateur — Bloc 7 Phase A : Identification et métriques des concurrents
// Responsabilité : identifier 5 concurrents via OpenAI, enrichir via Haloscan siteCompetitors,
//                  valider les domaines incertains (SERP), collecter les métriques
// Flux :
//   Parallèle : identification OpenAI + siteCompetitors Haloscan (domaine OT cible)
//   Séquentiel : validation domaines incertains → métriques × 5 (500ms entre chaque)
//   Enrichissement : si haloscan_match disponible et SEO = 0 → utiliser données siteCompetitors
// ⚠️ Métriques séquentielles avec 500ms de délai — respecte les rate limits Haloscan
// Termine en statut 'en_attente_validation' — la Phase B est déclenchée après validation

import { API_COSTS } from '@/lib/api-costs'
import { enregistrerCoutsBloc } from '@/lib/tracking-couts'
import type {
  ParamsBlocConcurrents,
  ConcurrentIdentifie,
  MetriquesConcurrent,
  ResultatPhaseAConcurrents,
  SiteCompetitorHaloscan,
} from '@/types/concurrents'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

// ─── Helper HTTP ──────────────────────────────────────────────────────────────

async function appelRoute<T>(chemin: string, body: object): Promise<T> {
  const reponse = await fetch(`${BASE_URL}${chemin}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify(body),
  })

  if (!reponse.ok) {
    throw new Error(`[${chemin}] Erreur HTTP ${reponse.status}`)
  }

  return reponse.json() as Promise<T>
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ─── Types des réponses de routes ─────────────────────────────────────────────

interface IdentificationReponse {
  concurrents: ConcurrentIdentifie[]
  analyse_paysage: string
}

interface MetriquesReponse {
  metriques: MetriquesConcurrent
  couts: {
    haloscan: { nb_appels: number; cout_total: number }
    haloscan_positions: { nb_appels: number; cout_total: number }
    dataforseo_ranked: { nb_appels: number; cout_total: number }
    dataforseo_maps: { nb_appels: number; cout_total: number }
  }
}

// ─── Haloscan siteCompetitors ─────────────────────────────────────────────────

/**
 * Interroge Haloscan siteCompetitors sur le domaine OT de la destination cible.
 * Retourne les vrais concurrents SEO avec common_keywords, total_traffic, missed_keywords.
 * Coût : 1 crédit site + ~10 export credits = ~0.010€
 * ⚠️ Timeout 60s — la réponse peut prendre jusqu'à 30s
 */
async function getSiteCompetitors(domaine_ot: string): Promise<SiteCompetitorHaloscan[]> {
  const apiKey = process.env.HALOSCAN_API_KEY
  if (!apiKey) {
    console.warn('[siteCompetitors] HALOSCAN_API_KEY manquant')
    return []
  }

  const response = await fetch('https://api.haloscan.com/api/domains/siteCompetitors', {
    method: 'POST',
    headers: {
      'haloscan-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ input: domaine_ot, mode: 'root', lineCount: 10 }),
    signal: AbortSignal.timeout(60_000),
  })

  if (!response.ok) {
    console.warn(`[siteCompetitors] HTTP ${response.status} pour ${domaine_ot}`)
    return []
  }

  const data = await response.json()

  // failure_reason non null → domaine absent ou pas de compétiteurs
  if (data.failure_reason) {
    console.warn(`[siteCompetitors] failure_reason : ${data.failure_reason}`)
    return []
  }

  return (data.results ?? []) as SiteCompetitorHaloscan[]
}

// ─── Validation domaine via SERP DataForSEO ───────────────────────────────────

/**
 * Tente de trouver le vrai domaine OT d'un concurrent via un appel SERP DataForSEO.
 * Utilisé uniquement pour les domaines marqués 'incertain' par OpenAI.
 * Filtre les OTA et Wikipedia — conserve le premier résultat organique pertinent.
 */
async function trouverDomainOTViaSERP(
  nomConcurrent: string,
  domaineEstime: string
): Promise<{ domaine_valide: string; nb_appels_serp: number }> {
  try {
    const auth = Buffer.from(
      `${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`
    ).toString('base64')

    const response = await fetch(
      'https://api.dataforseo.com/v3/serp/google/organic/live/advanced',
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([
          {
            keyword: `tourisme ${nomConcurrent}`,
            language_code: 'fr',
            location_code: 2250,
            depth: 5,
          },
        ]),
        signal: AbortSignal.timeout(30_000),
      }
    )

    if (!response.ok) {
      throw new Error(`SERP validation HTTP ${response.status}`)
    }

    const data = await response.json()
    const items = data?.tasks?.[0]?.result?.[0]?.items ?? []

    // Garder uniquement les résultats organiques hors OTA et Wikipedia
    const OTA_EXCLUS = [
      'booking',
      'tripadvisor',
      'wikipedia',
      'airbnb',
      'hotels',
      'lonelyplanet',
      'routard',
      'expedia',
    ]
    const organiques = items.filter(
      (i: Record<string, string>) =>
        i.type === 'organic' &&
        !OTA_EXCLUS.some((ota) => (i.domain ?? '').includes(ota))
    )

    if (organiques.length > 0) {
      const domaine = (organiques[0].domain as string)
        .replace(/^www\./, '') // normaliser sans www. pour la cohérence
      console.log(`[Validation domaine] ${nomConcurrent} : ${domaineEstime} → ${domaine} (SERP)`)
      return { domaine_valide: domaine, nb_appels_serp: 1 }
    }
  } catch (err) {
    console.warn(`[Validation domaine] SERP échoué pour ${nomConcurrent} :`, err)
  }

  // Fallback — conserver le domaine estimé par OpenAI
  return { domaine_valide: domaineEstime, nb_appels_serp: 1 }
}

// ─── Matching domaine — correspondance souple ─────────────────────────────────

/**
 * Vérifie si un domaine concurrent (issu de siteCompetitors) correspond au domaine OT.
 * Utilise .includes() dans les deux sens pour gérer les variantes www./nu/sous-domaines.
 */
function matcherDomaines(domaine_ot: string, root_domain: string): boolean {
  const d1 = domaine_ot.replace(/^www\./, '').toLowerCase()
  const d2 = root_domain.replace(/^www\./, '').toLowerCase()
  return d1.includes(d2) || d2.includes(d1)
}

// ─── Point d'entrée Phase A ───────────────────────────────────────────────────

export async function lancerPhaseAConcurrents(
  params: ParamsBlocConcurrents
): Promise<ResultatPhaseAConcurrents> {
  const { destination, contexte, audit_id, serp_cache, domaine_ot } = params
  const erreurs_partielles: string[] = []

  // Compteurs de coûts
  let nb_appels_haloscan = 0
  let nb_appels_haloscan_positions = 0
  let nb_appels_haloscan_competitors = 0
  let nb_appels_dataforseo_ranked = 0
  let nb_appels_dataforseo_maps = 0
  let nb_appels_serp_validation = 0

  // ─── Étapes 1 & 2 — OpenAI identification + Haloscan siteCompetitors (parallèle) ────

  console.log(
    `[Phase A] Lancement parallèle : identification OpenAI + siteCompetitors (${domaine_ot})`
  )

  let identification: IdentificationReponse
  let haloscan_competitors: SiteCompetitorHaloscan[] = []

  const [identificationSettled, siteCompetitorsSettled] = await Promise.allSettled([
    appelRoute<IdentificationReponse>('/api/blocs/concurrents/identification', {
      contexte,
      destination,
    }),
    getSiteCompetitors(domaine_ot),
  ])

  // Identification OpenAI — obligatoire
  if (identificationSettled.status === 'fulfilled') {
    identification = identificationSettled.value
  } else {
    throw new Error(
      `[Phase A Concurrents] Identification OpenAI échouée : ${identificationSettled.reason}`
    )
  }

  // siteCompetitors Haloscan — optionnel
  if (siteCompetitorsSettled.status === 'fulfilled') {
    haloscan_competitors = siteCompetitorsSettled.value
    nb_appels_haloscan_competitors = 1
    console.log(
      `[Phase A] siteCompetitors : ${haloscan_competitors.length} concurrent(s) SEO trouvés`
    )
  } else {
    erreurs_partielles.push(`siteCompetitors échoué : ${siteCompetitorsSettled.reason}`)
    console.warn('[Phase A] siteCompetitors échoué — poursuite sans enrichissement')
  }

  let concurrents = [...identification.concurrents]

  // ─── Étape 3 — Validation des domaines incertains ────────────────────────────

  for (let i = 0; i < concurrents.length; i++) {
    const c = concurrents[i]
    if (c.confiance_domaine === 'incertain') {
      console.log(`[Phase A] Validation domaine incertain : ${c.nom} (${c.domaine_ot})`)
      const { domaine_valide, nb_appels_serp } = await trouverDomainOTViaSERP(
        c.nom,
        c.domaine_ot
      )
      concurrents[i] = { ...c, domaine_valide }
      nb_appels_serp_validation += nb_appels_serp
      await sleep(300) // délai entre les appels SERP
    } else {
      // Domaine certain → domaine_valide = domaine_ot (normalisé sans www.)
      concurrents[i] = {
        ...c,
        domaine_valide: c.domaine_ot.replace(/^www\./, ''),
      }
    }
  }

  // ─── Étape 4 — Collecte des métriques (séquentielle) ─────────────────────────

  const concurrentsAvecMetriques: Array<
    ConcurrentIdentifie & {
      metriques: MetriquesConcurrent
      haloscan_match?: SiteCompetitorHaloscan
    }
  > = []

  for (const concurrent of concurrents) {
    console.log(`[Phase A] Métriques : ${concurrent.nom} (${concurrent.domaine_valide})`)

    // Chercher une correspondance dans siteCompetitors
    const haloscan_match = haloscan_competitors.find((hc) =>
      matcherDomaines(concurrent.domaine_valide, hc.root_domain)
    )

    if (haloscan_match) {
      console.log(
        `[Phase A] Match siteCompetitors : ${concurrent.nom} → ${haloscan_match.root_domain} ` +
          `(${haloscan_match.common_keywords} kw communs, ${haloscan_match.missed_keywords} kw manquants)`
      )
    }

    let metriques: MetriquesConcurrent

    try {
      const reponse = await appelRoute<MetriquesReponse>('/api/blocs/concurrents/metriques', {
        concurrent,
        serp_cache: serp_cache ?? [],
      })

      nb_appels_haloscan += reponse.couts.haloscan.nb_appels
      nb_appels_haloscan_positions += reponse.couts.haloscan_positions.nb_appels
      nb_appels_dataforseo_ranked += reponse.couts.dataforseo_ranked.nb_appels
      nb_appels_dataforseo_maps += reponse.couts.dataforseo_maps.nb_appels

      metriques = reponse.metriques

      // Enrichissement via haloscan_match : si la séquence 5 étapes retourne 0 mais que
      // siteCompetitors a des données → utiliser keywords + traffic de siteCompetitors
      if (metriques.site_non_indexe && haloscan_match && haloscan_match.keywords > 0) {
        console.log(
          `[Phase A] Enrichissement ${concurrent.nom} via siteCompetitors : ` +
            `${haloscan_match.keywords} kw, ${haloscan_match.total_traffic} visites`
        )
        metriques = {
          ...metriques,
          total_keywords: haloscan_match.keywords,
          total_traffic: haloscan_match.total_traffic,
          source_seo: 'haloscan_competitors',
          site_non_indexe: false,
        }
      }
    } catch (err) {
      erreurs_partielles.push(`Métriques ${concurrent.nom} échouées : ${err}`)
      // Fallback métriques via siteCompetitors si disponible, sinon zéros
      if (haloscan_match && haloscan_match.keywords > 0) {
        metriques = {
          total_keywords: haloscan_match.keywords,
          total_traffic: haloscan_match.total_traffic,
          source_seo: 'haloscan_competitors',
          site_non_indexe: false,
          note_google: null,
          nb_avis_google: null,
          position_serp_requete_principale: null,
        }
      } else {
        metriques = {
          total_keywords: 0,
          total_traffic: 0,
          source_seo: 'inconnu',
          site_non_indexe: true,
          note_google: null,
          nb_avis_google: null,
          position_serp_requete_principale: null,
        }
      }
    }

    concurrentsAvecMetriques.push({
      ...concurrent,
      metriques,
      ...(haloscan_match ? { haloscan_match } : {}),
    })

    // ⚠️ Délai entre chaque concurrent pour éviter les rate limits Haloscan
    await sleep(500)
  }

  // ─── Concurrents SEO Haloscan non proposés par OpenAI ────────────────────────

  const haloscan_suggestions = haloscan_competitors
    .filter(
      (hc) =>
        !concurrentsAvecMetriques.some((c) => matcherDomaines(c.domaine_valide, hc.root_domain))
    )
    .slice(0, 3) // max 3 suggestions

  if (haloscan_suggestions.length > 0) {
    console.log(
      `[Phase A] ${haloscan_suggestions.length} suggestion(s) Haloscan non proposées par OpenAI :`,
      haloscan_suggestions.map((s) => s.root_domain).join(', ')
    )
  }

  if (erreurs_partielles.length > 0) {
    console.warn('[Phase A] Erreurs partielles :', erreurs_partielles)
  }

  // ─── Tracking des coûts (fire & forget) ──────────────────────────────────────

  const couts = {
    openai_identification: API_COSTS.openai_gpt5_mini,
    haloscan: nb_appels_haloscan * API_COSTS.haloscan,
    haloscan_positions: nb_appels_haloscan_positions * API_COSTS.haloscan_positions,
    haloscan_competitors: nb_appels_haloscan_competitors * API_COSTS.haloscan_site_competitors,
    dataforseo_ranked: nb_appels_dataforseo_ranked * API_COSTS.dataforseo_ranked,
    dataforseo_maps: nb_appels_dataforseo_maps * API_COSTS.dataforseo_maps,
    dataforseo_serp_validation: nb_appels_serp_validation * API_COSTS.dataforseo_serp,
  }

  const total_phase_a =
    couts.openai_identification +
    couts.haloscan +
    couts.haloscan_positions +
    couts.haloscan_competitors +
    couts.dataforseo_ranked +
    couts.dataforseo_maps +
    couts.dataforseo_serp_validation

  enregistrerCoutsBloc(audit_id, 'concurrents_phase_a', {
    ...couts,
    total_phase_a,
    erreurs_partielles,
  })

  return {
    concurrents: concurrentsAvecMetriques,
    haloscan_suggestions,
    analyse_paysage: identification.analyse_paysage,
    statut: 'en_attente_validation',
    couts,
  }
}
