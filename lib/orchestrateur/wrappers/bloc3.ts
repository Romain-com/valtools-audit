// Wrapper Bloc 3 — Schéma digital & Santé technique
// Responsabilité : adapter la signature de lancerBlocSchemaDigital() à l'interface standard

import { lancerBlocSchemaDigital } from '@/lib/blocs/schema-digital'
import type { ParamsAudit, ResultatBloc } from '../blocs-statuts'
import { logInfo } from '../logger'

/**
 * Lance le Bloc 3 et retourne les résultats au format standard de l'orchestrateur.
 * Le domaine OT détecté est accessible dans resultats.domaine_ot_detecte
 */
export async function lancerBloc3(params: ParamsAudit): Promise<ResultatBloc> {
  const resultat = await lancerBlocSchemaDigital(params.nom, params.audit_id)

  // ── Diagnostic — valeurs clés du Bloc 3 ──
  const r = resultat as Record<string, unknown>
  const haloscan = (r.haloscan as Array<Record<string, unknown>>)?.[0]
  const serp = r.serp_fusionne as Array<Record<string, unknown>> | undefined
  logInfo(params.audit_id, 'Bloc 3 — résultats reçus', 'bloc3', {
    domaine_ot_detecte: r.domaine_ot_detecte ?? null,
    score_visibilite_ot: r.score_visibilite_ot ?? null,
    nb_top3_officiels: r.nb_top3_officiels ?? null,
    haloscan_total_keywords: haloscan?.total_keywords ?? null,
    haloscan_total_traffic: haloscan?.total_traffic ?? null,
    nb_serp_fusionne: serp?.length ?? null,
    cout_bloc: resultat.meta?.cout_total_euros ?? 0,
  })

  return {
    resultats: resultat as unknown as Record<string, unknown>,
    couts: {
      total: resultat.meta?.cout_total_euros ?? 0,
      total_bloc: resultat.meta?.cout_total_euros ?? 0,
    },
  }
}
