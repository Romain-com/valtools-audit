// Wrapper Bloc 4 — Visibilité SEO & Gap (Phase A + Phase B)
// Responsabilité : adapter les signatures de lancerPhaseA() et lancerPhaseB() à l'interface standard

import { lancerPhaseA } from '@/lib/blocs/visibilite-seo-phase-a'
import { lancerPhaseB } from '@/lib/blocs/visibilite-seo-phase-b'
import type { KeywordClassifie, CoutsBloc4 } from '@/types/visibilite-seo'
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
 * Lance la Phase A (collecte + classification keywords).
 * Retourne statut 'en_attente_validation' — attend la validation utilisateur.
 */
export async function lancerBloc4PhaseA(params: ParamsAudit): Promise<ResultatBloc> {
  const domaine_ot = params.domaine_ot ?? ''

  const resultatPhaseA = await lancerPhaseA(params.nom, domaine_ot, params.audit_id)

  // Lire les coûts stockés par la Phase A (fire & forget interne)
  // Pour le suivi orchestrateur, on estime un coût global basé sur les appels
  const coutEstime = calculerCoutEstimePhaseA(domaine_ot)

  // ── Diagnostic — valeurs clés Bloc 4 Phase A ──
  logInfo(params.audit_id, 'Bloc 4 Phase A — résultats reçus', 'bloc4', {
    domaine_ot_utilise: domaine_ot || 'VIDE — domaine non détecté par Bloc 3',
    nb_keywords_marche: resultatPhaseA.keywords_marche?.length ?? 0,
    nb_keywords_positionnes_ot: resultatPhaseA.keywords_positionnes_ot?.length ?? 0,
    nb_keywords_classes: resultatPhaseA.keywords_classes?.length ?? 0,
    nb_gaps: resultatPhaseA.keywords_classes?.filter(k => k.gap)?.length ?? 0,
    nb_gaps_transac: resultatPhaseA.keywords_classes?.filter(k => k.gap && k.intent_transactionnel)?.length ?? 0,
    volume_marche_seeds: resultatPhaseA.volume_marche_seeds ?? 0,
    volume_positionne_ot: resultatPhaseA.volume_positionne_ot ?? 0,
    volume_transactionnel_gap: resultatPhaseA.volume_transactionnel_gap ?? 0,
    trafic_capte_ot_estime: resultatPhaseA.trafic_capte_ot_estime ?? 0,
    cout_estime: coutEstime,
    alerte: (resultatPhaseA.keywords_classes?.length ?? 0) === 0
      ? 'ANOMALIE — keywords_classes vide : domaine OT manquant ou Haloscan/DataForSEO sans résultats'
      : undefined,
  })

  return {
    resultats: {
      phase_a: resultatPhaseA,
      statut: 'en_attente_validation',
    },
    couts: {
      phase_a: { detail: 'voir couts_api.visibilite_seo_phase_a' },
      total: coutEstime,
      total_bloc: coutEstime,
    },
  }
}

/**
 * Lance la Phase B (SERP live + synthèse gap) avec les keywords validés.
 * Lit les données de Phase A et les coûts depuis Supabase.
 */
export async function lancerBloc4PhaseB(
  params: ParamsAudit & { keywords_valides: KeywordClassifie[] }
): Promise<ResultatBloc> {
  const domaine_ot = params.domaine_ot ?? ''

  // Lire les résultats Phase A depuis Supabase
  const visibiliteSEO = await lireResultatsBloc(params.audit_id, 'visibilite_seo') as {
    phase_a?: ReturnType<typeof lancerPhaseA> extends Promise<infer T> ? T : never
  } | null

  if (!visibiliteSEO?.phase_a) {
    throw new Error('[bloc4 PhaseB] Résultats Phase A introuvables en base')
  }

  // Lire les coûts Phase A depuis couts_api
  const couts_phase_a = await lireCoutsPhaseA(params.audit_id)

  const resultatPhaseB = await lancerPhaseB(
    params.nom,
    domaine_ot,
    visibiliteSEO.phase_a as Parameters<typeof lancerPhaseB>[2],
    params.keywords_valides,
    params.audit_id,
    couts_phase_a
  )

  const coutTotal = couts_phase_a.total + (resultatPhaseB as { synthese_narrative?: string } ? 0.001 : 0)

  // ── Diagnostic — valeurs clés Bloc 4 Phase B ──
  const phaseB = resultatPhaseB as Record<string, unknown>
  logInfo(params.audit_id, 'Bloc 4 Phase B — résultats reçus', 'bloc4', {
    nb_keywords_valides_recus: params.keywords_valides?.length ?? 0,
    nb_serp_results: (phaseB.serp_results as unknown[])?.length ?? 0,
    score_gap: phaseB.score_gap ?? null,
    taux_captation: phaseB.taux_captation ?? null,
    nb_top5_opportunites: (phaseB.top_5_opportunites as unknown[])?.length ?? 0,
    synthese_ok: !!phaseB.synthese_narrative,
    cout_total: coutTotal,
  })

  return {
    resultats: {
      phase_a: visibiliteSEO.phase_a,
      phase_b: resultatPhaseB,
      statut: 'termine',
    },
    couts: {
      phase_b: { detail: 'voir couts_api.visibilite_seo_phase_b' },
      total: coutTotal,
      total_bloc: coutTotal,
    },
  }
}

// ─── Helpers internes ────────────────────────────────────────────────────────

/**
 * Estime le coût Phase A d'après le nombre d'appels standard.
 * Valeurs approximatives — les coûts précis sont dans couts_api.visibilite_seo_phase_a
 */
function calculerCoutEstimePhaseA(domaine_ot: string): number {
  // 8 appels Haloscan + 4 DataForSEO related + 1 ranked + ~3 OpenAI
  const HALOSCAN_KEYWORDS = 0.01
  const DATAFORSEO_RELATED = 0.002
  const OPENAI_CALL = 0.001
  return (
    8 * HALOSCAN_KEYWORDS +
    4 * DATAFORSEO_RELATED +
    (domaine_ot ? 3 * OPENAI_CALL : 0)
  )
}

/**
 * Lit les coûts Phase A depuis couts_api Supabase.
 * Retourne un objet CoutsBloc4 vide si introuvable (Phase B fonctionnera quand même).
 */
async function lireCoutsPhaseA(auditId: string): Promise<CoutsBloc4> {
  const fallback: CoutsBloc4 = {
    haloscan_market: { nb_appels: 0, cout: 0 },
    dataforseo_related: { nb_appels: 0, cout: 0 },
    dataforseo_ranked: { nb_appels: 0, cout: 0 },
    dataforseo_serp_transac: { nb_appels: 0, cout: 0 },
    openai: { nb_appels: 0, cout: 0 },
    total: 0,
  }

  try {
    const supabase = getSupabase()
    const { data } = await supabase
      .from('audits')
      .select('couts_api')
      .eq('id', auditId)
      .single()

    const couts = data?.couts_api as Record<string, unknown> | null
    const phaseA = couts?.visibilite_seo_phase_a as CoutsBloc4 | undefined

    return phaseA ?? fallback
  } catch {
    return fallback
  }
}
