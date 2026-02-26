// Wrapper Bloc 7 — Concurrents (Phase A + Phase B)
// Responsabilité : adapter les signatures de lancerPhaseAConcurrents() et lancerPhaseBConcurrents()
//                  à l'interface standard, en lisant le contexte des blocs précédents depuis Supabase

import { lancerPhaseAConcurrents } from '@/lib/blocs/concurrents-phase-a'
import { lancerPhaseBConcurrents } from '@/lib/blocs/concurrents-phase-b'
import type { ConcurrentIdentifie, ContexteAuditPourConcurrents, ResultatPhaseAConcurrents } from '@/types/concurrents'
import type { ParamsAudit, ResultatBloc } from '../blocs-statuts'
import { lireResultatsBloc } from '../supabase-updates'
import { logInfo } from '../logger'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Variables Supabase manquantes')
  return createClient(url, key)
}

/**
 * Lance la Phase A (identification + métriques concurrents).
 * Construit le contexte depuis les résultats des blocs 1-6.
 * Retourne statut 'en_attente_validation'.
 */
export async function lancerBloc7PhaseA(params: ParamsAudit): Promise<ResultatBloc> {
  const domaine_ot = params.domaine_ot ?? ''

  // Lire les résultats des blocs précédents pour construire le contexte
  const contexte = await construireContexte(params)

  // Métriques de la destination cible depuis Bloc 3 et autres blocs
  const metriques = await extraireMetriquesDestination(params.audit_id)

  // Cache SERP depuis Bloc 3 — évite des appels supplémentaires
  const serp_cache = await extraireCacheSERP(params.audit_id)

  const resultatPhaseA = await lancerPhaseAConcurrents({
    destination: params.nom,
    audit_id: params.audit_id,
    contexte,
    domaine_ot,
    metriques_destination: metriques,
    serp_cache,
  })

  // Lire les coûts Phase A stockés par le bloc
  const coutsPhaseA = await lireCoutsPhaseAConcurrents(params.audit_id)
  const totalCouts = Object.values(coutsPhaseA).reduce(
    (sum, v) => sum + (typeof v === 'number' ? v : 0),
    0
  )

  // ── Diagnostic — valeurs clés Bloc 7 Phase A ──
  const phaseA = resultatPhaseA as unknown as Record<string, unknown>
  const concurrents = phaseA.concurrents as unknown[] | undefined
  logInfo(params.audit_id, 'Bloc 7 Phase A — résultats reçus', 'bloc7', {
    nb_concurrents: concurrents?.length ?? 0,
    domaine_ot_utilise: domaine_ot || 'VIDE',
    position_globale: phaseA.position_globale ?? null,
    cout_bloc: totalCouts,
  })

  return {
    resultats: {
      phase_a: resultatPhaseA,
      statut: 'en_attente_validation',
    },
    couts: {
      phase_a: coutsPhaseA,
      total: totalCouts,
      total_bloc: totalCouts,
    },
  }
}

/**
 * Lance la Phase B (synthèse comparative) avec les concurrents validés.
 */
export async function lancerBloc7PhaseB(
  params: ParamsAudit & { concurrents_valides: ConcurrentIdentifie[] }
): Promise<ResultatBloc> {
  // Lire les résultats Phase A depuis Supabase
  const concurrentsData = await lireResultatsBloc(params.audit_id, 'concurrents') as {
    phase_a?: ResultatPhaseAConcurrents
  } | null

  if (!concurrentsData?.phase_a) {
    throw new Error('[bloc7 PhaseB] Résultats Phase A introuvables en base')
  }

  const metriques = await extraireMetriquesDestination(params.audit_id)

  const resultatPhaseB = await lancerPhaseBConcurrents({
    audit_id: params.audit_id,
    destination: params.nom,
    phase_a: concurrentsData.phase_a,
    concurrents_valides: params.concurrents_valides,
    metriques_destination: metriques,
  })

  const coutsBloc = (resultatPhaseB.couts?.total_bloc ?? 0) as number

  // ── Diagnostic — valeurs clés Bloc 7 Phase B ──
  const phaseB = resultatPhaseB as unknown as Record<string, unknown>
  logInfo(params.audit_id, 'Bloc 7 Phase B — résultats reçus', 'bloc7', {
    nb_concurrents_valides: params.concurrents_valides?.length ?? 0,
    position_globale: phaseB.position_globale ?? null,
    score_comparatif: phaseB.score_comparatif ?? null,
    synthese_ok: !!phaseB.synthese_narrative,
    cout_bloc: coutsBloc,
  })

  return {
    resultats: resultatPhaseB as unknown as Record<string, unknown>,
    couts: {
      total: coutsBloc,
      total_bloc: coutsBloc,
    },
  }
}

// ─── Helpers internes ────────────────────────────────────────────────────────

/**
 * Construit le contexte complet pour l'identification des concurrents
 * en lisant les résultats des blocs 1-6 depuis Supabase.
 */
async function construireContexte(params: ParamsAudit): Promise<ContexteAuditPourConcurrents> {
  const [bloc1, bloc2, bloc3, bloc4, bloc5, bloc6] = await Promise.all([
    lireResultatsBloc(params.audit_id, 'positionnement').catch(() => null),
    lireResultatsBloc(params.audit_id, 'volume_affaires').catch(() => null),
    lireResultatsBloc(params.audit_id, 'schema_digital').catch(() => null),
    lireResultatsBloc(params.audit_id, 'visibilite_seo').catch(() => null),
    lireResultatsBloc(params.audit_id, 'stocks_physiques').catch(() => null),
    lireResultatsBloc(params.audit_id, 'stock_en_ligne').catch(() => null),
  ]) as [
    Record<string, unknown> | null,
    Record<string, unknown> | null,
    Record<string, unknown> | null,
    Record<string, unknown> | null,
    Record<string, unknown> | null,
    Record<string, unknown> | null,
  ]

  const google = (bloc1?.google as Record<string, unknown> | undefined)
  const ot = (google?.ot as Record<string, unknown> | undefined)

  const collecteur = (bloc2?.collecteur as Record<string, unknown> | undefined)

  const schemaMeta = (bloc3 as Record<string, unknown> | null)
  const haloscan = (schemaMeta?.haloscan as Array<Record<string, unknown>> | undefined)
  const haloscanOT = haloscan?.[0]

  const phaseA = (bloc4 as { phase_a?: Record<string, unknown> } | null)?.phase_a
  const phaseB = (bloc4 as { phase_b?: Record<string, unknown> } | null)?.phase_b

  const stocks = (bloc5 as Record<string, unknown> | null)?.stocks as Record<string, unknown> | undefined
  const stocksHebergements = stocks?.hebergements as Record<string, unknown> | undefined
  const stocksActivites = stocks?.activites as Record<string, unknown> | undefined

  const indicateurs = (bloc6 as Record<string, unknown> | null)?.indicateurs as Record<string, unknown> | undefined

  // Top 3 keywords par volume
  const keywordsClasses = (phaseA?.keywords_classes as Array<Record<string, unknown>>) ?? []
  const top3Keywords = keywordsClasses
    .sort((a, b) => ((b.volume as number) ?? 0) - ((a.volume as number) ?? 0))
    .slice(0, 3)
    .map(k => k.keyword as string)

  return {
    destination: params.nom,
    code_departement: params.code_departement,
    population: params.population,

    positionnement: {
      type_destination: 'destination touristique',
      hashtag_volume: ((bloc1?.instagram as Record<string, unknown> | undefined)?.posts_count as number) ?? 0,
      note_google_destination: ((ot?.note as number) ?? 0),
      note_google_ot: ((ot?.note as number) ?? 0),
    },

    volume_affaires: {
      montant_ts: (collecteur?.montant_taxe_euros as number) ?? 0,
      nuitees_estimees: (collecteur?.nuitees_estimees as number) ?? 0,
      type_collecteur: (collecteur?.type_collecteur as string) ?? 'inconnu',
    },

    schema_digital: {
      domaine_ot: params.domaine_ot ?? '',
      score_visibilite_ot: (schemaMeta?.score_visibilite_ot as number) ?? 0,
      total_keywords: (haloscanOT?.total_keywords as number) ?? 0,
      total_traffic: (haloscanOT?.total_traffic as number) ?? 0,
    },

    visibilite_seo: {
      volume_marche_seeds: (phaseA?.volume_marche_seeds as number) ?? 0,
      volume_transactionnel_gap: (phaseA?.volume_transactionnel_gap as number) ?? 0,
      score_gap: (phaseB?.score_gap as number) ?? 0,
      top_3_keywords: top3Keywords,
    },

    stocks_physiques: {
      total_hebergements: (stocksHebergements?.total as number) ?? 0,
      total_activites: (stocksActivites?.total as number) ?? 0,
      ratio_particuliers: 0,
    },

    stock_en_ligne: {
      total_airbnb: ((bloc6 as Record<string, unknown> | null)?.airbnb as Record<string, unknown> | undefined)?.total_annonces as number ?? 0,
      total_booking: ((bloc6 as Record<string, unknown> | null)?.booking as Record<string, unknown> | undefined)?.total_annonces as number ?? 0,
      taux_dependance_ota: (indicateurs?.taux_dependance_ota as number) ?? 0,
      taux_reservable_direct: (indicateurs?.taux_reservable_direct as number) ?? 0,
    },
  }
}

/**
 * Extrait les métriques de la destination depuis Bloc 3, 2, 5, 6.
 */
async function extraireMetriquesDestination(auditId: string) {
  const [bloc2, bloc3, , bloc6] = await Promise.all([
    lireResultatsBloc(auditId, 'volume_affaires').catch(() => null),
    lireResultatsBloc(auditId, 'schema_digital').catch(() => null),
    lireResultatsBloc(auditId, 'stocks_physiques').catch(() => null),
    lireResultatsBloc(auditId, 'stock_en_ligne').catch(() => null),
  ]) as [
    Record<string, unknown> | null,
    Record<string, unknown> | null,
    Record<string, unknown> | null,
    Record<string, unknown> | null,
  ]

  const haloscan = (bloc3?.haloscan as Array<Record<string, unknown>> | undefined)
  const haloscanOT = haloscan?.[0]

  const google = await lireResultatsBloc(auditId, 'positionnement').catch(() => null) as Record<string, unknown> | null
  const googleOT = (google?.google as Record<string, unknown> | undefined)?.ot as Record<string, unknown> | undefined

  const indicateurs = (bloc6?.indicateurs as Record<string, unknown> | undefined)
  const collecteur = (bloc2?.collecteur as Record<string, unknown> | undefined)

  return {
    total_keywords: (haloscanOT?.total_keywords as number) ?? 0,
    total_traffic: (haloscanOT?.total_traffic as number) ?? 0,
    note_google: (googleOT?.note as number) ?? 0,
    nb_avis_google: (googleOT?.avis as number) ?? 0,
    score_visibilite_ot: (bloc3?.score_visibilite_ot as number) ?? 0,
    taux_dependance_ota: (indicateurs?.taux_dependance_ota as number) ?? 0,
    nuitees_estimees: (collecteur?.nuitees_estimees as number) ?? 0,
  }
}

/**
 * Extrait le cache SERP depuis Bloc 3 pour éviter des appels redondants.
 */
async function extraireCacheSERP(auditId: string): Promise<Array<{ domaine: string; position: number }>> {
  try {
    const bloc3 = await lireResultatsBloc(auditId, 'schema_digital') as Record<string, unknown> | null
    const serpFusionne = (bloc3?.serp_fusionne as Array<{ domaine: string; position: number }>) ?? []
    return serpFusionne.map(r => ({ domaine: r.domaine, position: r.position }))
  } catch {
    return []
  }
}

/**
 * Lit les coûts Phase A des concurrents depuis couts_api.
 */
async function lireCoutsPhaseAConcurrents(auditId: string): Promise<Record<string, number>> {
  try {
    const supabase = getSupabase()
    const { data } = await supabase
      .from('audits')
      .select('couts_api')
      .eq('id', auditId)
      .single()

    const couts = data?.couts_api as Record<string, unknown> | null
    const phaseA = couts?.concurrents_phase_a as Record<string, unknown> | undefined

    if (!phaseA) return { total: 0 }

    const total = Object.values(phaseA)
      .filter((v): v is Record<string, unknown> => typeof v === 'object' && v !== null)
      .reduce((sum, item) => sum + ((item.cout_total as number) ?? 0), 0)

    return { ...phaseA as Record<string, number>, total }
  } catch {
    return { total: 0 }
  }
}
