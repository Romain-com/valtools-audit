// Wrapper Bloc 4 — Visibilité SEO & Gap (Phase A + Phase B)
// Responsabilité : adapter les signatures de lancerPhaseA() et lancerPhaseB() à l'interface standard

import { lancerPhaseA } from '@/lib/blocs/visibilite-seo-phase-a'
import { lancerPhaseB } from '@/lib/blocs/visibilite-seo-phase-b'
import type { KeywordClassifie, CoutsBloc4 } from '@/types/visibilite-seo'
import type { ParamsAudit, ResultatBloc } from '../blocs-statuts'
import { lireResultatsBloc } from '../supabase-updates'
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
