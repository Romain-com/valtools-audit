// Wrapper Bloc 3 — Schéma digital & Santé technique
// Responsabilité : adapter la signature de lancerBlocSchemaDigital() à l'interface standard

import { lancerBlocSchemaDigital } from '@/lib/blocs/schema-digital'
import type { ParamsAudit, ResultatBloc } from '../blocs-statuts'

/**
 * Lance le Bloc 3 et retourne les résultats au format standard de l'orchestrateur.
 * Le domaine OT détecté est accessible dans resultats.domaine_ot_detecte
 */
export async function lancerBloc3(params: ParamsAudit): Promise<ResultatBloc> {
  const resultat = await lancerBlocSchemaDigital(params.nom, params.audit_id)

  return {
    resultats: resultat as unknown as Record<string, unknown>,
    couts: {
      total: resultat.meta?.cout_total_euros ?? 0,
      total_bloc: resultat.meta?.cout_total_euros ?? 0,
    },
  }
}
